<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { useUserStore } from '@/stores/user'
import { useTenantStore } from '@/stores/tenant'
import AuthShell from '@/components/auth/AuthShell.vue'
import ExternalProviderButtons from '@/components/auth/ExternalProviderButtons.vue'
import RecentPasswordVerifyModal from '@/components/auth/RecentPasswordVerifyModal.vue'
import ExternalAccountSummary from '@/components/auth/ExternalAccountSummary.vue'
import * as external from '@/api/externalAuth'
import { readFlow, useExternalAuthFlow, leaveForAuthorization, errorMessage } from '@/hooks/useExternalAuthFlow'
import type { ProviderInfo, ExternalProvider } from '@/types/externalAuth'

const router = useRouter(); const route = useRoute(); const user = useUserStore(); const tenant = useTenantStore()
const form = reactive({ username: '', password: '' }); const loading = ref(false); const error = ref('')
const providers = ref<ProviderInfo[]>([]); const providerLoading = ref<ExternalProvider | null>(null); const providersFailed = ref(false)
const { context, load } = useExternalAuthFlow(); const pending = ref(false); const invalidPending = ref(false); const verifyOpen = ref(false)
const deactivatedVisible = ref(false); const deactivatedMessage = ref('')
async function loadProviders() { try { providers.value = await external.getProviders(); providersFailed.value = false } catch { providersFailed.value = true } }
async function checkPending() {
  if (typeof route.query.flow !== 'string') return
  try { const result = await load(route.query.flow); if (result.stage !== 'EXISTING_ACCOUNT_LOGIN') throw new Error('此绑定流程已无法续接，请重新认证'); pending.value = true; if (user.isLoggedIn) await user.fetchProfile() }
  catch (e) { error.value = errorMessage(e); invalidPending.value = true }
}
onMounted(() => { void loadProviders(); void checkPending(); window.addEventListener('verse-session-changed', sessionChanged) })
onUnmounted(() => { form.password = ''; window.removeEventListener('verse-session-changed', sessionChanged) })
function sessionChanged() { verifyOpen.value = false; form.password = ''; void checkPending() }
async function start(provider: ExternalProvider) {
  if (providerLoading.value || loading.value) return
  providerLoading.value = provider; error.value = ''
  try { await leaveForAuthorization(await external.startExternalLogin(provider), provider, 'LOGIN') }
  catch (e) { error.value = errorMessage(e); providerLoading.value = null }
}
async function submit() {
  if (loading.value || invalidPending.value) return
  loading.value = true; error.value = ''
  // 密码只在当前提交闭包中使用，登录成功后不保存在表单中。
  const password = form.password
  let loginSucceeded = false
  try {
    await user.login({ ...form }); loginSucceeded = true; form.password = ''
    if (pending.value && context.value) {
      const flow = readFlow(context.value.flowId)
      const proof = await external.reauthExternal({ password, action: 'ATTACH', provider: context.value.provider, flowId: flow.flowId })
      await attach(proof.reauthToken); return
    }
    await tenant.initialize().catch(() => {})
    const redirect = route.query.redirect
    await router.replace(typeof redirect === 'string' && redirect.startsWith('/') && !redirect.startsWith('//') && !redirect.includes('\\') ? redirect : '/dashboard')
  } catch (e) {
    // 登录错误由请求拦截器提示；后续绑定请求静默处理，需要在此弹出 toast。
    if (loginSucceeded) message.error(errorMessage(e))
    if ((e as { code?: string }).code === 'B000218') { deactivatedVisible.value = true; deactivatedMessage.value = errorMessage(e) }
  } finally { loading.value = false }
}
async function attach(token: string) {
  if (!context.value) return
  verifyOpen.value = false
  try { const flow = readFlow(context.value.flowId); await external.attachCurrentUser(flow.flowId, flow.flowToken, token); await router.replace(`/profile/external-account/confirm?flow=${flow.flowId}`) }
  catch (e) { error.value = errorMessage(e) }
}
async function useOtherAccount() { await user.signOut(); form.password = '' }
</script>
<template>
  <AuthShell>
    <div class="eyebrow">{{ pending ? 'CONNECT YOUR ACCOUNT' : 'WELCOME BACK' }}</div><h2>{{ pending ? '登录后绑定你的账号' : '欢迎回来' }}</h2><p class="intro">{{ pending ? '使用你的 Verse 账号继续，确认后才会建立绑定。' : '用你熟悉的方式，登录 Verse。' }}</p>
    <a-alert v-if="error" role="alert" type="error" :message="error" show-icon class="error" />
    <ExternalAccountSummary v-if="pending && context" :provider="context.provider" :account="context.externalAccount" />
    <template v-if="!pending && !invalidPending">
      <ExternalProviderButtons :providers="providers" :loading="providerLoading" :disabled="loading" @select="start" />
      <div v-if="providersFailed" class="provider-retry">外部登录暂时无法加载 <a-button type="link" size="small" @click="loadProviders">重试</a-button></div>
      <a-divider v-if="providers.length" class="divider">或使用 Verse 账号</a-divider>
    </template>
    <div v-if="pending && user.isLoggedIn" class="current-account"><p>以当前 Verse <strong>@{{ user.user?.username }}</strong> 继续绑定</p><a-button type="primary" block size="large" @click="verifyOpen = true">验证密码并继续</a-button><a-button block type="link" @click="useOtherAccount">使用其他 Verse 账号</a-button></div>
    <a-form v-else-if="!invalidPending" :model="form" layout="vertical" size="large" :disabled="loading || !!providerLoading" @finish="submit">
      <a-form-item label="用户名或手机号" name="username" :rules="[{required:true,message:'请输入用户名或手机号'}]"><a-input v-model:value="form.username" autocomplete="username" placeholder="输入你的 Verse 用户名或手机号" :maxlength="50" /></a-form-item>
      <div class="password-label"><span>密码</span><router-link to="/reset-password/send-code" custom v-slot="{href,navigate}"><a-button type="link" size="small" :href="href" @click="navigate">忘记密码？</a-button></router-link></div>
      <a-form-item name="password" :rules="[{required:true,message:'请输入密码'}]"><a-input-password v-model:value="form.password" autocomplete="current-password" placeholder="请输入密码" :maxlength="72" aria-label="密码" /></a-form-item>
      <a-button class="submit" type="primary" html-type="submit" block :loading="loading">{{ pending ? '登录并继续绑定' : '登录' }} <span aria-hidden="true">→</span></a-button>
    </a-form>
    <div class="register-link">还没有 Verse 账号？<router-link to="/register" custom v-slot="{href,navigate}"><a-button type="link" :href="href" @click="navigate">创建账号</a-button></router-link></div>
    <p class="login-note">外部账户关联多个账号时，你可以选择本次登录的账号。</p>
    <RecentPasswordVerifyModal v-if="context" :open="verifyOpen" :input="{ action:'ATTACH', provider:context.provider, flowId:context.flowId }" @verified="attach" @close="verifyOpen = false" />
    <a-modal v-model:open="deactivatedVisible" title="账号已注销" :footer="null"><p>{{ deactivatedMessage }}</p></a-modal>
  </AuthShell>
</template>
<style lang="scss" scoped>
.eyebrow { font-size:12px; letter-spacing:1.7px; color:#929ca8; font-weight:700; }h2 { font-size:28px; font-weight:700; margin:12px 0 8px; letter-spacing:-.8px; }.intro { color:$color-text-secondary; font-size:13px; margin-bottom:28px; line-height:1.7; }.error { margin-bottom:20px; }.divider { color:#8a939f; font-size:11px; margin:24px 0; }.password-label { display:flex; justify-content:space-between; align-items:center; font-size:13px; margin-bottom:8px; :deep(a) { padding:0; font-size:12px; } }.submit { height:46px; font-size:14px; margin-top:-6px; span { margin-left:10px; } }.register-link { margin-top:22px; text-align:center; font-size:12px; color:$color-text-secondary; :deep(a) { padding:0 6px; font-size:12px; } }.login-note { margin:20px 0 0; text-align:center; font-size:11px; color:#929ba7; line-height:1.8; }.provider-retry { font-size:12px; color:$color-text-secondary; margin-bottom:20px; }.current-account { padding:12px 0; }:deep(.ant-input),:deep(.ant-input-affix-wrapper) { min-height:44px; font-size:13px; }:deep(.ant-form-item-label label) { font-size:13px; }:deep(.ant-input-affix-wrapper .ant-input) { min-height:unset; }
</style>
