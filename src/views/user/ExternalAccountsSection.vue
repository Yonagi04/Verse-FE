<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { message } from 'ant-design-vue'
import ProviderIcon from '@/components/auth/ProviderIcon.vue'
import RecentPasswordVerifyModal from '@/components/auth/RecentPasswordVerifyModal.vue'
import { getExternalAccounts, startExternalBinding, unbindExternal } from '@/api/externalAuth'
import { leaveForAuthorization, errorMessage, cancelStoredFlows } from '@/hooks/useExternalAuthFlow'
import { providerNames, type BindingInfo, type ReauthInput } from '@/types/externalAuth'
import { useUserStore } from '@/stores/user'
const props = defineProps<{ disabled?: boolean; beforeLeave: () => boolean }>()
const emit = defineEmits<{ busy: [value: boolean]; navigate: [panel: string] }>()
const user = useUserStore(); const rows = ref<BindingInfo[]>([]); const loading = ref(false); const error = ref('')
const selected = ref<BindingInfo>(); const verifyOpen = ref(false); const unbindOpen = ref(false); const working = ref(false)
const proof = ref(''); const operation = ref(''); const reauth = ref<Omit<ReauthInput, 'password'>>({ action:'BIND' })
async function refresh() { loading.value = true; try { rows.value = await getExternalAccounts(); error.value = '' } catch (e) { error.value = errorMessage(e) } finally { loading.value = false } }
onMounted(refresh)
function choose(row: BindingInfo) {
  if (props.disabled || working.value || !props.beforeLeave()) return
  selected.value = row; error.value = ''; proof.value = ''; operation.value = crypto.randomUUID()
  if (row.binding) { unbindOpen.value = true; reauth.value = { action:'UNBIND', bindingId:row.binding.bindingId } }
  else { reauth.value = { action:'BIND', provider:row.provider }; verifyOpen.value = true }
}
async function verified(token: string) {
  proof.value = token; verifyOpen.value = false
  if (!selected.value || selected.value.binding) return
  working.value = true; emit('busy',true)
  try { await cancelStoredFlows(); const provider = selected.value.provider; await leaveForAuthorization(await startExternalBinding(provider, token), provider, 'BIND') }
  catch (e) { message.error(errorMessage(e)); working.value = false; emit('busy',false) }
}
async function unbind() {
  if (!selected.value?.binding || working.value) return
  if (!proof.value) { verifyOpen.value = true; return }
  working.value = true; emit('busy',true)
  try { const result = await unbindExternal(selected.value.binding.bindingId, proof.value, operation.value); message.success(result.outcome === 'ALREADY_UNBOUND' ? '该绑定已解除' : '已解除当前账号绑定，已登录设备保持在线'); unbindOpen.value = false; proof.value = ''; await refresh() }
  catch (e) { error.value = errorMessage(e); if ((e as { code?: string }).code === 'A002105') { proof.value = ''; verifyOpen.value = true } }
  finally { working.value = false; emit('busy',false) }
}
function close() { if (working.value) return; verifyOpen.value = false; unbindOpen.value = false; proof.value = ''; selected.value = undefined }
</script>
<template>
  <section id="external-accounts" class="external-card" aria-labelledby="external-title" tabindex="-1">
    <div class="section-heading"><h3 id="external-title">外部账户</h3><p>连接你本人控制的账户，使用熟悉的方式登录。不会修改联系邮箱或租户权限。</p></div>
    <a-alert v-if="error" role="alert" type="error" :message="error" show-icon style="margin-bottom:16px" />
    <a-spin v-if="loading" aria-label="正在加载绑定列表" />
    <div v-for="row in rows" :key="row.provider" class="external-row">
      <ProviderIcon :provider="row.provider" /><div class="row-details"><strong>{{ providerNames[row.provider] }} <a-tag :color="row.binding ? 'success' : 'default'">{{ row.binding ? '已绑定' : '未绑定' }}</a-tag><a-tag v-if="!row.enabled">已停用</a-tag></strong>
        <span v-if="row.binding">{{ row.binding.username ? '@' + row.binding.username : row.binding.displayName || '平台账户' }} <small>{{ row.binding.maskedEmail }}</small></span>
        <small v-if="row.binding">绑定于 {{ new Date(row.binding.boundAt).toLocaleString() }}</small><small v-if="row.unavailableReason">{{ row.unavailableReason }}</small>
      </div><a-button :disabled="disabled || working || (row.binding ? !row.canUnbind : !row.canBind)" :loading="working && selected?.provider === row.provider" @click="choose(row)">{{ row.binding ? '解绑' : '绑定' }}</a-button>
    </div>
    <p v-if="!loading && !rows.length && !error" class="hint">当前部署尚未启用外部登录平台。</p><p v-if="rows.length" class="hint">每个平台的外部账户最多关联 3 个 Verse 账号。绑定关系仅你自己可见。</p><a-button v-if="error && !working" type="link" @click="refresh">重新加载</a-button>
    <RecentPasswordVerifyModal :open="verifyOpen" :input="reauth" @verified="verified" @close="close" />
    <a-modal :open="unbindOpen" title="解除外部账户绑定" :confirm-loading="working" :closable="!working" :keyboard="!working" :mask-closable="false" ok-text="确认解绑" cancel-text="取消" @ok="unbind" @cancel="close">
      <p>将 {{ selected ? providerNames[selected.provider] : '' }} {{ selected?.binding?.username || selected?.binding?.displayName }} 从 Verse <strong>@{{ user.user?.username }}</strong> 解绑。</p><p>只解除当前 Verse 账号的关系，已登录设备保持在线。</p>
      <a-alert v-if="error" role="alert" type="error" :message="error" show-icon /><p v-if="proof">密码已验证，请点击“确认解绑”完成操作。</p><a-button type="link" @click="close(); emit('navigate','devices')">管理已登录设备</a-button>
    </a-modal>
  </section>
</template>
<style lang="scss" scoped>
.external-card { background:$color-bg; border:1px solid $color-border; border-radius:$radius-card; padding:24px; margin-top:20px; }.section-heading h3 { font-size:16px; margin:0 0 8px; }.section-heading p,.hint { color:$color-text-secondary; font-size:12px; line-height:1.8; }.external-row { display:flex; align-items:center; gap:14px; padding:18px 0; border-bottom:1px solid $color-border; }.row-details { flex:1; min-width:0; display:flex; flex-direction:column; gap:5px; overflow-wrap:anywhere; strong { font-size:14px; }span,small { color:$color-text-secondary; font-size:12px; }strong :deep(.ant-tag) { font-size:10px; margin-left:6px; } }.hint { margin:16px 0 0; }@media(max-width:500px) { .external-card { padding:18px; }.external-row { gap:10px; } }
</style>
