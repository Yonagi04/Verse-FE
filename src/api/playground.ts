import request from './request'
import { getToken, clearAuth } from '@/utils/auth'
import { triggerTenantContextRecovery } from '@/utils/tenantContextRecovery'
import type {
  PlaygroundStatus, PlaygroundModel, PlaygroundPrompt, PlaygroundSession, PlaygroundSessions,
  PlaygroundDetail, PlaygroundEvent,
} from '@/types/playground'

const path = (tenantId: string) => `/tenants/${tenantId}/playground`

export const getPlaygroundStatus = (tenantId: string): Promise<PlaygroundStatus> =>
  request.get(`${path(tenantId)}/status`)

export const getPlaygroundModels = (tenantId: string): Promise<{ items: PlaygroundModel[] }> =>
  request.get(`${path(tenantId)}/models`)

export const getPlaygroundPrompts = (tenantId: string): Promise<{ items: PlaygroundPrompt[] }> =>
  request.get(`${path(tenantId)}/prompts`)

export const createPlaygroundSession = (tenantId: string, serviceId: string): Promise<PlaygroundSession> =>
  request.post(`${path(tenantId)}/sessions`, { serviceId })

export const listPlaygroundSessions = (tenantId: string, pageNum = 1, pageSize = 20, keyword = ''):
  Promise<PlaygroundSessions> => request.get(`${path(tenantId)}/sessions`, {
    params: { pageNum, pageSize, keyword: keyword || undefined },
  })

export const getPlaygroundSession = (tenantId: string, sessionId: string): Promise<PlaygroundDetail> =>
  request.get(`${path(tenantId)}/sessions/${sessionId}`)

export const updatePlaygroundSessionModel = (tenantId: string, sessionId: string, serviceId: string):
  Promise<PlaygroundSession> => request.post(`${path(tenantId)}/sessions/${sessionId}/model/update`, { serviceId })

export const deletePlaygroundSession = (tenantId: string, sessionId: string): Promise<boolean> =>
  request.delete(`${path(tenantId)}/sessions/${sessionId}`)

export interface PlaygroundStreamError extends Error { code?: string; data?: unknown }

/** 原生 fetch 读取命名 SSE；控制器在发流前仍可返回 JSON Result。 */
export async function streamPlaygroundTurn(
  tenantId: string, sessionId: string, prompt: string, idempotencyKey: string,
  signal: AbortSignal, onEvent: (event: PlaygroundEvent) => void,
): Promise<void> {
  const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}${path(tenantId)}/sessions/${sessionId}/turns/stream`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getToken() ?? ''}`,
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({ prompt }),
    signal,
  })
  if (!response.ok || !response.headers.get('content-type')?.includes('text/event-stream')) {
    const result = await response.json().catch(() => null) as {
      code?: string; message?: string; data?: unknown
    } | null
    // 只有明确的 Token 无效或过期才清除登录态；流式接口的其他 401 保留现场供排查。
    if (response.status === 401 && (result?.code === 'A000210' || result?.code === 'A000212')) {
      clearAuth()
      window.location.href = '/login'
      throw new Error('登录已过期')
    }
    if (result?.code === 'B000338') void triggerTenantContextRecovery().catch(() => {})
    const error = new Error(result?.message || `发送失败（HTTP ${response.status}）`) as PlaygroundStreamError
    error.code = result?.code
    error.data = result?.data
    throw error
  }
  if (!response.body) throw new Error('流式连接不可用')
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    while (true) {
      const { value, done } = await reader.read()
      buffer += decoder.decode(value, { stream: !done })
      // 保留跨读取块的 CRLF，再统一归一化，避免 SSE 分隔符被拆开后一直无法解析。
      buffer = buffer.replace(/\r\n/g, '\n')
      let boundary = buffer.indexOf('\n\n')
      while (boundary >= 0) {
        const block = buffer.slice(0, boundary)
        buffer = buffer.slice(boundary + 2)
        const kind = block.split('\n').find(line => line.startsWith('event:'))?.slice(6).trim()
        const data = block.split('\n').filter(line => line.startsWith('data:'))
          .map(line => line.slice(5).trimStart()).join('\n')
        if (kind && data) {
          const parsed = JSON.parse(data) as Record<string, unknown>
          onEvent({ ...parsed, type: kind } as PlaygroundEvent)
        }
        boundary = buffer.indexOf('\n\n')
      }
      if (done) break
    }
  } finally {
    reader.releaseLock()
  }
}
