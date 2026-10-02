import { ref } from 'vue'
import * as api from '@/api/externalAuth'
import type { ExternalFlowStart, ExternalProvider, ExternalFlowContext } from '@/types/externalAuth'
import { getToken } from '@/utils/auth'
const prefix = 'verse_external_flow:'
const currentKey = 'verse_external_current'
interface StoredFlow { flowId: string; flowToken: string; provider: ExternalProvider; purpose: 'LOGIN' | 'BIND'; expiresAt: string; sessionFingerprint?: string }
async function fingerprint() {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(getToken() || ''))
  return Array.from(new Uint8Array(digest), v => v.toString(16).padStart(2, '0')).join('')
}
export function readFlow(id?: string): StoredFlow {
  const key = id || sessionStorage.getItem(currentKey)
  if (!key || !/^[a-f0-9]{32}$/.test(key)) throw new Error('请先在当前标签页完成外部账户认证')
  const flow = JSON.parse(sessionStorage.getItem(prefix + key) || 'null') as StoredFlow | null
  if (!flow || flow.flowId !== key || !flow.flowToken) throw new Error('请在发起认证的标签页继续，或重新认证')
  if (Date.parse(flow.expiresAt) <= Date.now()) { clearFlow(key); throw new Error('认证已过期，请重新认证') }
  return flow
}
export function hasStoredFlow(id: string) { try { readFlow(id); return true } catch { return false } }
export function clearFlow(id: string) {
  sessionStorage.removeItem(prefix + id)
  if (sessionStorage.getItem(currentKey) === id) sessionStorage.removeItem(currentKey)
}
export async function saveFlow(start: ExternalFlowStart, provider: ExternalProvider, purpose: 'LOGIN' | 'BIND') {
  const record: StoredFlow = { flowId: start.flowId, flowToken: start.flowToken, expiresAt: start.expiresAt, provider, purpose,
    sessionFingerprint: purpose === 'BIND' ? await fingerprint() : undefined }
  sessionStorage.setItem(prefix + start.flowId, JSON.stringify(record)); sessionStorage.setItem(currentKey, start.flowId)
}
export async function leaveForAuthorization(start: ExternalFlowStart, provider: ExternalProvider, purpose: 'LOGIN' | 'BIND') {
  const expected = { google: 'accounts.google.com', github: 'github.com', gitlab: 'gitlab.com' }[provider]
  const url = new URL(start.authorizationUrl)
  if (url.protocol !== 'https:' || url.hostname !== expected || url.username || url.password) throw new Error('认证地址无效')
  try { await saveFlow(start, provider, purpose) }
  catch { await api.cancelFlow(start.flowId, start.flowToken).catch(() => {}); throw new Error('无法保存本标签页认证流程，请允许会话存储后重试') }
  window.location.assign(start.authorizationUrl)
}
export async function endFlow(id: string, acknowledge = false) {
  const flow = readFlow(id)
  await (acknowledge ? api.acknowledgeFlow : api.cancelFlow)(id, flow.flowToken).catch(() => {})
  clearFlow(id)
}
export function useExternalAuthFlow() {
  let requestSequence = 0
  const context = ref<ExternalFlowContext | null>(null)
  const error = ref('')
  const loading = ref(false)
  async function load(id?: string) {
    const sequence = ++requestSequence
    loading.value = true; error.value = ''
    try {
      const stored = readFlow(id)
      if (stored.purpose === 'BIND' && stored.sessionFingerprint !== await fingerprint()) throw new Error('发起绑定的登录会话已变化，请重新发起')
      const result = await api.getFlow(stored.flowId, stored.flowToken)
      stored.expiresAt = result.expiresAt; stored.purpose = result.purpose
      if (result.purpose === 'BIND' && !stored.sessionFingerprint) stored.sessionFingerprint = await fingerprint()
      if (sequence !== requestSequence) throw new Error('认证流程已切换')
      sessionStorage.setItem(prefix + stored.flowId, JSON.stringify(stored)); context.value = result
      return result
    } catch (e) { if (sequence === requestSequence) { context.value = null; error.value = errorMessage(e) } throw e }
    finally { if (sequence === requestSequence) loading.value = false }
  }
  return { context, error, loading, load }
}
export function errorMessage(e: unknown) {
  const err = e as { message?: string; response?: { data?: { message?: string } } }
  return err.response?.data?.message || err.message || '暂时无法完成操作，请稍后重试'
}
