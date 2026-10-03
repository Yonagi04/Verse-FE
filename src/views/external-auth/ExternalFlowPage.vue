<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import AuthShell from '@/components/auth/AuthShell.vue'
import ExternalAccountSummary from '@/components/auth/ExternalAccountSummary.vue'
import RegistrationFields from '@/components/auth/RegistrationFields.vue'
import { useUserStore } from '@/stores/user'
import { useTenantStore } from '@/stores/tenant'
import { providerNames, type ExternalLoginCompletion } from '@/types/externalAuth'
import * as api from '@/api/externalAuth'
import { readFlow, endFlow, useExternalAuthFlow, leaveForAuthorization, errorMessage, cancelStoredFlows, storedFlowPurpose } from '@/hooks/useExternalAuthFlow'

const route = useRoute(); const router = useRouter(); const user = useUserStore(); const tenant = useTenantStore()
const { context, load, loading, error } = useExternalAuthFlow()
const busy = ref(false); const selected = ref<string>(); const registrationCompleted = ref(false)
const bindingIntent = ref(false); const returningToProfile = ref(false)
const form = reactive({ username: '', nickname: '', password: '', email: '', phone: '' })
const brand = computed(() => context.value ? providerNames[context.value.provider] : '')
const allDisabled = computed(() => !!context.value && !context.value.accounts.some(a => a.status === 'NORMAL'))
const terminal = computed(() => !!context.value && ['FAILED','CANCELLED','INVALIDATED','EXPIRED'].includes(context.value.stage))
const binding = computed(() => bindingIntent.value || context.value?.purpose === 'BIND' || route.meta.layout === 'app')
let timer: ReturnType<typeof setTimeout> | undefined; let disposed = false; let sequence = 0
const reasons: Record<string, string> = {
  AUTHORIZATION_CANCELLED:'已取消外部平台授权，你可以使用密码或重新认证。', FLOW_EXPIRED:'认证流程已过期，请重新认证。',
  PROVIDER_UNAVAILABLE:'外部平台暂时不可用，请重试或使用其他登录方式。', PROVIDER_RESPONSE_INVALID:'外部身份验证失败，请重新认证。',
  FLOW_STATE_CHANGED:'账号关联已变化，请重新选择并确认。', FLOW_INVALID:'认证流程无效，请重新认证。',
}
function bindingFailureReason(reason: string | null) {
  const messages: Record<string, string> = {
    AUTHORIZATION_CANCELLED: '已取消' + brand.value + '授权，未完成本次绑定。',
    FLOW_EXPIRED: '绑定认证已过期，请从个人信息页重新发起绑定。',
    PROVIDER_UNAVAILABLE: '外部平台暂时不可用，请稍后重新绑定。',
    PROVIDER_RESPONSE_INVALID: '外部账户身份验证失败，请重新绑定。',
    FLOW_STATE_CHANGED: '账号关联已变化，请重新发起绑定。',
    FLOW_INVALID: '绑定认证流程无效，请重新发起绑定。',
    VERSE_SESSION_CHANGED: '发起绑定的登录会话已变化，请重新发起绑定。',
  }
  return messages[reason || ''] || '本次外部账户绑定未完成，请重新发起绑定。'
}
async function returnBindingFailure(reason: string) {
  if (returningToProfile.value) return
  returningToProfile.value = true; busy.value = true; sequence++; clearTimeout(timer); form.password = ''; error.value = ''
  // 失败立即返回；后台取消失败保留证明，后续离开或新发起时继续清理。
  void cancelStoredFlows().catch(() => {})
  await router.replace('/profile?panel=profile')
  message.error(reason)
}
function locator() {
  const fragment = new URLSearchParams(window.location.hash.slice(1)).get('flow')
  if (fragment) window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search)
  return fragment || (typeof route.query.flow === 'string' ? route.query.flow : undefined)
}
async function initialize() {
  if (returningToProfile.value) return
  const flowId = locator()
  bindingIntent.value = storedFlowPurpose(flowId) === 'BIND'
  if (route.path === '/auth/external/error') {
    if (binding.value) await returnBindingFailure('无法确认这次外部授权，请从个人信息页重新发起绑定。')
    else error.value = '无法确认这次外部授权，请返回登录页重新认证。'
    return
  }
  const current = ++sequence
  selected.value = undefined; form.password = ''; clearTimeout(timer)
  try {
    const result = await load(flowId)
    if (disposed || current !== sequence) return
    if (result.stage === 'AUTHENTICATING') { await poll(Date.now() + 15000, current); return }
    await dispatch()
  } catch (e) {
    if (!disposed && current === sequence && binding.value) await returnBindingFailure(errorMessage(e))
  }
}
async function poll(deadline: number, current: number) {
  if (disposed || current !== sequence) return
  if (Date.now() > deadline) {
    if (binding.value) await returnBindingFailure('绑定认证仍在处理中，请稍后从个人信息页重新发起绑定。')
    else error.value = '认证仍在处理中，请稍后查询或重新认证。'
    return
  }
  timer = setTimeout(async () => {
    try { const result = await load(); if (disposed || current !== sequence) return; if (result.stage === 'AUTHENTICATING') await poll(deadline, current); else await dispatch() }
    catch (e) { if (!disposed && current === sequence && binding.value) await returnBindingFailure(errorMessage(e)) }
  }, 1000)
}
async function dispatch() {
  const current = context.value
  if (!current) return
  if (current.purpose === 'BIND' && (terminal.value || current.errorReason)) {
    await returnBindingFailure(bindingFailureReason(current.errorReason)); return
  }
  if (current.errorReason) error.value = reasons[current.errorReason] || '此认证流程无法继续，请重新认证。'
  const locations: Partial<Record<string, string>> = { SELECT_REQUIRED:'/login/select-account', REGISTER_REQUIRED:'/register/external',
    EXISTING_ACCOUNT_LOGIN:'/login', BIND_CONFIRM_REQUIRED:'/profile/external-account/confirm' }
  const destination = locations[current.stage]
  if (destination && destination !== route.path) { await router.replace(`${destination}?flow=${current.flowId}`); return }
  if (current.stage === 'REGISTER_REQUIRED') {
    form.nickname ||= (current.registrationDefaults?.nickname || '').slice(0, 50); form.email ||= current.registrationDefaults?.verifiedEmail || ''
  }
  if (current.stage === 'BIND_CONFIRM_REQUIRED') {
    if (user.user?.userId !== current.targetAccount?.userId) { await returnBindingFailure('发起绑定的账号已变化，请从个人信息页重新发起绑定。'); return }
  }
  if (current.stage === 'LOGIN_READY') await complete()
  if (current.stage === 'COMPLETED') {
    if (current.purpose === 'BIND') { await endFlow(current.flowId, true).catch(() => {}); await router.replace('/profile?panel=profile'); return }
    if (current.completion?.registrationCompleted && current.completion.sessionStatus !== 'ISSUED') {
      registrationCompleted.value = true; form.password = ''; error.value = '账号已创建并完成绑定，请重新登录。'; await endFlow(current.flowId, true); return
    }
    await complete()
  }
}
async function accept(result: ExternalLoginCompletion) {
  const id = context.value!.flowId
  form.password = ''
  if (!result.login) {
    registrationCompleted.value = result.registrationCompleted
    error.value = result.registrationCompleted ? '账号已创建并完成绑定，请重新登录。' : '登录结果无法恢复，请重新认证。'
    if (result.registrationCompleted) await endFlow(id, true)
    return
  }
  user.acceptLogin(result.login)
  await endFlow(id, true)
  await Promise.allSettled([user.fetchProfile(), tenant.initialize()])
  await router.replace('/dashboard')
}
async function complete() {
  if (busy.value || !context.value) return
  busy.value = true
  try { const flow = readFlow(context.value.flowId); await accept(await api.completeExternalLogin(flow.flowId, flow.flowToken, selected.value)) }
  catch (e) { error.value = errorMessage(e); selected.value = undefined; await load().catch(() => {}) }
  finally { busy.value = false }
}
async function register() {
  if (busy.value || registrationCompleted.value || context.value?.stage !== 'REGISTER_REQUIRED') return
  busy.value = true; error.value = ''
  try { const flow = readFlow(context.value.flowId); await accept(await api.registerExternal(flow.flowId, flow.flowToken, { ...form })) }
  catch (e) {
    // 外部注册接口关闭了全局错误提示，在此通过 toast 展示服务端错误。
    message.error(errorMessage(e))
    // 响应丢失先查询完成状态，不能直接恢复为可重复注册。
    try { const latest = await load(); if (latest.stage === 'COMPLETED') { busy.value = false; await dispatch() } } catch { registrationCompleted.value = true; error.value += '。提交结果暂无法确认，请重新查询流程。' }
  } finally { busy.value = false }
}
async function existingAccount() {
  if (!context.value || busy.value) return
  busy.value = true; form.password = ''
  try { const flow = readFlow(context.value.flowId); await api.continueBinding(flow.flowId, flow.flowToken); await router.replace(`/login?flow=${flow.flowId}`) }
  catch (e) { error.value = errorMessage(e) } finally { busy.value = false }
}
async function confirm() {
  if (busy.value || !context.value || user.user?.userId !== context.value.targetAccount?.userId) return
  busy.value = true; error.value = ''
  try { const flow = readFlow(context.value.flowId); await api.confirmExternalBinding(flow.flowId, flow.flowToken); await endFlow(flow.flowId, true).catch(() => {}); message.success('外部账户绑定成功'); await router.replace('/profile?panel=profile') }
  catch (e) { await returnBindingFailure(errorMessage(e)) }
  finally { busy.value = false }
}
async function changeAccount() {
  if (!context.value || busy.value) return
  const provider = context.value.provider
  if (context.value.purpose === 'BIND') { await cancel(); return }
  const keep = context.value.stage === 'REGISTER_REQUIRED' && window.confirm('更换外部账户时保留已填写的用户名、昵称和联系方式吗？密码会被清除。')
  form.password = ''; if (!keep) Object.assign(form, { username:'', nickname:'', email:'', phone:'' })
  busy.value = true
  try {
    await cancelStoredFlows()
    await leaveForAuthorization(await api.startExternalLogin(provider), provider, 'LOGIN')
  } catch (e) { error.value = errorMessage(e); busy.value = false }
}
async function cancel() {
  form.password = ''
  try { await cancelStoredFlows() } catch (e) { error.value = errorMessage(e); return }
  await router.replace(binding.value || context.value?.purpose === 'BIND' ? '/profile?panel=profile' : '/login')
}
function sessionChanged() { form.password = ''; void initialize() }
watch(() => route.fullPath, () => { void initialize() })
onMounted(() => { void initialize(); window.addEventListener('verse-session-changed', sessionChanged) })
onUnmounted(() => { disposed = true; sequence++; clearTimeout(timer); form.password = ''; window.removeEventListener('verse-session-changed', sessionChanged) })
</script>
<template>
  <component v-if="!returningToProfile" :is="binding ? 'div' : AuthShell" :class="{ 'binding-page':binding }">
    <div class="eyebrow">{{ binding ? 'ACCOUNT SECURITY' : 'CONNECTED TO VERSE' }}</div>
    <h2>{{ context?.stage === 'SELECT_REQUIRED' ? '选择要登录的 Verse 账号' : context?.stage === 'REGISTER_REQUIRED' ? `通过 ${brand} 注册 Verse` : binding ? '确认绑定外部账户' : registrationCompleted ? '账号已创建' : '外部账户认证' }}</h2>
    <p class="intro" v-if="context?.stage === 'SELECT_REQUIRED'">每个账号的资料、租户与权限保持独立。</p>
    <p class="intro" v-if="context?.stage === 'REGISTER_REQUIRED'">此外部账户尚未绑定 Verse 账号。创建你的账号并完成绑定。</p>
    <a-alert v-if="error" role="alert" :type="registrationCompleted ? 'info' : 'error'" :message="error" show-icon class="flow-alert" />
    <div v-if="loading || (!error && ['AUTHORIZING','AUTHENTICATING','LOGIN_READY'].includes(context?.stage || ''))" class="processing" aria-live="polite"><a-spin /><p>正在安全验证你的账户…</p></div>
    <ExternalAccountSummary v-if="context" :provider="context.provider" :account="context.externalAccount" />
    <template v-if="context?.stage === 'SELECT_REQUIRED' && !terminal">
      <a-alert v-if="allDisabled" type="warning" message="此身份已关联账号，但目前没有可登录账号。" show-icon class="flow-alert" />
      <a-radio-group v-model:value="selected" class="account-list" aria-label="选择 Verse 账号">
        <div v-for="account in context.accounts" :key="account.userId" class="account-option" :class="{ disabled:account.status === 'DISABLED', selected:selected === account.userId }">
          <a-radio :value="account.userId" :disabled="account.status === 'DISABLED' || busy"><span class="avatar">{{ (account.nickname || account.username).slice(0,1) }}</span><span><strong>{{ account.nickname || account.username }}</strong><small>@{{ account.username }}</small></span></a-radio><a-tag v-if="account.status === 'DISABLED'">已禁用</a-tag>
        </div>
      </a-radio-group><a-button block type="primary" size="large" :loading="busy" :disabled="!selected || allDisabled" @click="complete">登录所选账号 →</a-button>
    </template>
    <a-form v-if="context?.stage === 'REGISTER_REQUIRED' && !registrationCompleted" :model="form" layout="vertical" :disabled="busy" @finish="register">
      <RegistrationFields :form="form" external /><p class="help">填写联系方式不代表完成 Verse 邮箱或手机号验证。注册后将创建个人租户。</p>
      <a-button block type="primary" size="large" html-type="submit" :loading="busy">创建 Verse 账号并绑定 {{ brand }}</a-button>
      <a-button type="link" block :disabled="busy" @click="existingAccount">已有账号？登录后绑定</a-button>
    </a-form>
    <div v-if="context?.stage === 'BIND_CONFIRM_REQUIRED'" class="confirm-content">
      <p>将 {{ brand }} 账户绑定到 Verse <strong>@{{ context.targetAccount?.username }}</strong></p><p class="help">此外部账户将可以登录它绑定的全部 Verse 账号，请仅绑定你本人控制的账户。不会修改你的联系邮箱或租户权限。</p><p class="help" v-if="context.boundAccountCount">此外部账户已关联 {{ context.boundAccountCount }} 个 Verse 账号。</p>
      <a-button block type="primary" size="large" :loading="busy" :disabled="user.user?.userId !== context.targetAccount?.userId" @click="confirm">确认绑定 {{ brand }}</a-button>
    </div>
    <div class="flow-actions"><a-button v-if="context && !busy && !binding" type="link" @click="changeAccount">{{ registrationCompleted || terminal ? '重新认证' : '更换外部账户' }}</a-button><a-button type="link" :disabled="busy" @click="cancel">{{ binding ? '取消并返回个人资料' : '返回登录' }}</a-button><a-button v-if="error && !terminal" type="link" :disabled="busy" @click="initialize">重新查询</a-button></div>
  </component>
</template>
<style lang="scss" scoped>
.binding-page { max-width:560px; margin:32px auto; padding:32px; background:$color-bg; border:1px solid $color-border; border-radius:$radius-card; }.eyebrow { font-size:11px; color:var(--verse-adaptive-text-tertiary, #929ca8); letter-spacing:1.7px; font-weight:700; }h2 { font-size:25px; margin:12px 0; font-weight:650; }.intro,.help { color:$color-text-secondary; line-height:1.8; font-size:12px; }.flow-alert { margin:18px 0; }.processing { text-align:center; padding:28px; color:$color-text-secondary; }.account-list { display:grid; gap:10px; margin-bottom:24px; }.account-option { display:flex; align-items:center; justify-content:space-between; border:1px solid var(--verse-adaptive-border-input, #e1e6ed); border-radius:$radius-card; padding:16px; cursor:pointer; &.selected { border-color:$color-primary; background:$color-primary-bg; }&.disabled { background:$color-bg-secondary; cursor:not-allowed; } :deep(.ant-radio-wrapper) { flex:1; align-items:center; > span:last-child { display:flex; gap:12px; align-items:center; } }strong { font-size:14px; display:block; }small { color:$color-text-secondary; display:block; margin-top:4px; }.avatar { width:36px; height:36px; border-radius:50%; background:var(--verse-adaptive-selected, #eaf2ff); color:$color-primary; display:grid; place-items:center; } }.flow-actions { display:flex; flex-wrap:wrap; justify-content:center; margin-top:20px; :deep(button) { font-size:12px; padding:4px 8px; } }.confirm-content p { line-height:1.8; }.help { margin:16px 0; }@media(max-width:680px) { .binding-page { margin:0; padding:22px; } }
</style>
