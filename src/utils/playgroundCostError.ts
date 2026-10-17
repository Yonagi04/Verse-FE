import { formatBudgetDateTime } from './date'

/** 调用错误只保留协议字段，禁止从 UI 推断金额或模型可用性。 */
export interface PlaygroundFailure extends Error { code?: string; data?: unknown; httpStatus?: number; requestId?: string | null }
export const isCostFailure = (code?: string) => code === 'A000809' || code === 'B000802'
export function costFailureDescription(code?: string, data?: unknown): string | undefined {
  if (code === 'B000802') return '预算校验暂不可用，请稍后手动重试或联系管理员。'
  if (code !== 'A000809') return undefined
  if (!data || typeof data !== 'object') return '模型调用成本已达限，请联系管理员。'
  const value = data as Record<string, unknown>
  const period = value.period === 'DAY' ? '日' : value.period === 'WEEK' ? '周' : value.period === 'MONTH' ? '月' : ''
  const retry = value.retryAt ?? value.retry_at
  const end = typeof retry === 'string' && Number.isFinite(Date.parse(retry)) ? formatBudgetDateTime(retry) : ''
  const scope = value.scope === 'TENANT' ? '此租户' : value.scope === 'LLM' ? '此模型' : value.scope === 'API_KEY' ? '此 API Key' : '模型调用'
  return `${scope}${period ? `本${period}` : ''}调用成本已达限${end ? `，预计 ${end} 恢复` : ''}。请联系管理员或等待周期重置。`
}
export function playgroundFailure(result: unknown, status: number): PlaygroundFailure {
  const value = result && typeof result === 'object' ? result as Record<string, unknown> : {}
  const error: PlaygroundFailure = new Error(typeof value.message === 'string' ? value.message : `流式连接失败（${status}）`)
  error.code = typeof value.code === 'string' ? value.code : undefined
  error.requestId = typeof value.requestId === 'string' ? value.requestId : null
  error.data = value.data; error.httpStatus = status
  return error
}

/** 同时支持 Axios 业务错误与非2xx响应，不丢弃结构化成本上下文。 */
export function normalizePlaygroundFailure(error: unknown): PlaygroundFailure {
  const e = error as PlaygroundFailure & { response?: { status?: number; data?: unknown } }
  if (e?.response?.data) return playgroundFailure(e.response.data, e.response.status ?? 500)
  return e
}
