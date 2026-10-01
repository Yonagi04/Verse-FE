import request from './request'
import { getToken, clearAuth } from '@/utils/auth'
import { triggerTenantContextRecovery } from '@/utils/tenantContextRecovery'
import type { Attempt, WorkbenchResource, WorkbenchModel, WorkbenchEvent, WorkbenchConfig } from '@/types/playgroundWorkbench'

const root = (tenant: string) => `/tenants/${tenant}/playground/workbench`
export const workbenchModels = (t: string): Promise<WorkbenchModel[]> => request.get(`${root(t)}/models`)
export const workbenchList = (t: string, kind = 'groups', keyword = ''): Promise<WorkbenchResource[]> => request.get(`${root(t)}/${kind}`, { params: { keyword } })
export const workbenchDetail = (t: string, id: string, kind = 'groups'): Promise<WorkbenchResource> => request.get(`${root(t)}/${kind}/${id}`)
export const workbenchCreate = (t: string, kind: string, title: string, config: WorkbenchConfig, description = ''): Promise<WorkbenchResource> => request.post(`${root(t)}/${kind}`, { title, config, description })
export const workbenchUpdate = (t: string, resource: WorkbenchResource, body: object): Promise<WorkbenchResource> => request.put(`${root(t)}/${resource.kind === 'GROUP' ? 'groups' : 'presets'}/${resource.id}`, { ...body, revision: resource.revision })
export const workbenchDelete = (t: string, r: WorkbenchResource): Promise<boolean> => request.delete(`${root(t)}/${r.kind === 'GROUP' ? 'groups' : 'presets'}/${r.id}`)
export const workbenchRound = (t: string, id: string, prompt: string, key: string): Promise<{ roundId: string; attempts: Attempt[] }> => request.post(`${root(t)}/groups/${id}/rounds`, { prompt }, { headers: { 'Idempotency-Key': key } })
export const workbenchStop = (t: string, id: string): Promise<boolean> => request.post(`${root(t)}/attempts/${id}/stop`)
export const workbenchRetry = (t: string, id: string, key: string): Promise<Attempt> => request.post(`${root(t)}/attempts/${id}/retry`, null, { headers: { 'Idempotency-Key': key } })
export const workbenchFork = (t: string, id: string, body: object): Promise<WorkbenchResource> => request.post(`${root(t)}/groups/${id}/fork`, body)
export const workbenchRestore = (t: string, id: string, version: number): Promise<WorkbenchResource> => request.post(`${root(t)}/presets/${id}/restore`, { version })

/** 各栏独立 fetch 流；断连会触发后端取消，不影响其他栏。 */
export async function streamWorkbenchAttempt(t: string, id: string, signal: AbortSignal, onEvent: (e: WorkbenchEvent) => void) {
  const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}${root(t)}/attempts/${id}/stream`, {
    method: 'POST', headers: { Authorization: `Bearer ${getToken() ?? ''}`, Accept: 'text/event-stream' }, signal,
  })
  if (!response.ok || !response.headers.get('content-type')?.includes('text/event-stream')) {
    const result = await response.json().catch(() => null)
    if (response.status === 401 && ['A000210', 'A000212'].includes(result?.code)) { clearAuth(); window.location.href = '/login' }
    if (result?.code === 'B000338') void triggerTenantContextRecovery().catch(() => {})
    throw new Error(result?.message || `流式连接失败（${response.status}）`)
  }
  if (!response.body) throw new Error('流式连接不可用')
  const reader = response.body.getReader(), decoder = new TextDecoder()
  let buffer = '', terminal = false
  try {
    while (true) {
      const { value, done } = await reader.read()
      buffer += decoder.decode(value, { stream: !done }); buffer = buffer.replace(/\r\n/g, '\n')
      let boundary = buffer.indexOf('\n\n')
      while (boundary >= 0) {
        const block = buffer.slice(0, boundary); buffer = buffer.slice(boundary + 2)
        const type = block.split('\n').find(l => l.startsWith('event:'))?.slice(6).trim()
        const data = block.split('\n').filter(l => l.startsWith('data:')).map(l => l.slice(5).trimStart()).join('\n')
        if (type && data) { onEvent({ ...JSON.parse(data), type }); if (['completed', 'error'].includes(type)) terminal = true }
        boundary = buffer.indexOf('\n\n')
      }
      if (done) break
    }
    if (!terminal && !signal.aborted) throw new Error('连接提前结束，请刷新查看已保存的结果')
  } finally { reader.releaseLock() }
}
