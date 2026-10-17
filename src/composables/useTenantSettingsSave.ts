import { ref, shallowRef } from 'vue'
import { saveTenantSettings } from '@/api/tenant'
import type { TenantSettingsSaveRequest, TenantSettingsConfirmation, TenantSettingsSaveOutcome, TenantSettingsSnapshot } from '@/types/tenantCostBudget'
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value))
/** 单次保存生命周期；用户每次明确点击才能继续确认或核对未知结果。 */
export function useTenantSettingsSave(onSaved: (snapshot: TenantSettingsSnapshot) => void, onError: (message: string) => void) {
  const inFlight = ref(false), unknown = ref(false), pending = shallowRef<TenantSettingsConfirmation | null>(null)
  let epoch = 0, frozen: TenantSettingsSaveRequest | null = null, sent: TenantSettingsSaveRequest | null = null, tenant: string | null = null
  function invalidate() { epoch++; inFlight.value = false; unknown.value = false; pending.value = null; frozen = null; sent = null; tenant = null }
  function cancel() { if (!inFlight.value && !unknown.value) { pending.value = null; frozen = null; sent = null } }
  function valid(result: TenantSettingsSaveOutcome) {
    if (result.status === 'SAVED') return result.requiresConfirmation === false && !!result.savedSnapshot?.settings?.settingsVersion && !!result.savedSnapshot?.costLimit?.version && !!result.savedSnapshot?.costWarning
    return result.status === 'CONFIRMATION_REQUIRED' && result.requiresConfirmation === true && !!result.confirmationToken && !!result.expectedSettingsVersion && !!result.expectedCostConfigVersion && !!result.confirmationExpiresAt
  }
  async function send(payload: TenantSettingsSaveRequest) {
    if (inFlight.value || !tenant) return
    const ticket = epoch, targetTenant = tenant
    inFlight.value = true; sent = clone(payload)
    try {
      const result = await saveTenantSettings(targetTenant, clone(payload), { silentError: true })
      if (ticket !== epoch) return
      if (!valid(result)) throw new Error('保存响应不完整，提交结果暂未确认')
      unknown.value = false
      if (result.status === 'SAVED') { pending.value = null; frozen = null; sent = null; onSaved(result.savedSnapshot) }
      else { pending.value = result }
    } catch (error) {
      if (ticket !== epoch) return
      const e = error as { code?: string; message?: string; httpStatus?: number; response?: { status?: number; data?: { code?: string; message?: string } } }
      const code = e.response?.data?.code || e.code
      // 领域拒绝证明未保存；断连/超时/未知5xx保留原请求，禁止新写。
      if (code && ['A000604','A000605','A000606','A000609','A000610','A000611'].includes(code) && (e.response?.status ?? e.httpStatus ?? 200) < 500) { pending.value = null; onError(e.response?.data?.message || e.message || '设置未保存') }
      else { unknown.value = true; onError('提交结果暂未确认，请核对后继续') }
    } finally { if (ticket === epoch) inFlight.value = false }
  }
  async function start(tenantId: string, initial: TenantSettingsSaveRequest, fullTarget: TenantSettingsSaveRequest) {
    if (inFlight.value || pending.value || unknown.value) return
    tenant = tenantId; frozen = clone(fullTarget); await send(initial)
  }
  async function confirm() {
    if (!pending.value || !frozen || inFlight.value || unknown.value) return
    const preview = pending.value
    await send({ ...clone(frozen), settingsVersion: preview.expectedSettingsVersion,
      costLimit: { ...frozen.costLimit, expectedVersion: preview.expectedCostConfigVersion }, confirmationToken: preview.confirmationToken })
  }
  async function reconcile() { if (unknown.value && sent && !inFlight.value) await send(clone(sent)) }
  return { inFlight, unknown, pending, start, confirm, cancel, reconcile, invalidate }
}
