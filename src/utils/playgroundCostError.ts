import { formatBudgetDateTime } from './date'

/** 调用错误只保留协议字段，禁止从 UI 推断金额或模型可用性。 */
export interface PlaygroundFailure extends Error { code?: string; data?: unknown; httpStatus?: number }
export const isCostFailure = (code?: string) => code === 'A000809' || code === 'B000802'
export function costFailureDescription(code?: string, data?: unknown): string | undefined {
  if (code === 'B000802') return '预算校验暂不可用，请稍后手动重试或联系管理员。'
  if (code !== 'A000809') return undefined
  if (!data || typeof data !== 'object') return '模型调用成本已达限，请联系管理员。'
  const value = data as Record<string, unknown>
  const period = value.period === 'DAY' ? '日' : value.period === 'WEEK' ? '周' : value.period === 'MONTH' ? '月' : ''
  const end = typeof value.retryAt === 'string' && Number.isFinite(Date.parse(value.retryAt)) ? formatBudgetDateTime(value.retryAt) : ''
  return `此模型${period}调用成本已达限${end ? `，预计 ${end} 恢复` : ''}。请联系管理员或等待周期重置。`
}
export function playgroundFailure(result: unknown, status: number): PlaygroundFailure {
  const value = result && typeof result === 'object' ? result as Record<string, unknown> : {}
  const error: PlaygroundFailure = new Error(typeof value.message === 'string' ? value.message : `流式连接失败（${status}）`)
  error.code = typeof value.code === 'string' ? value.code : undefined
  error.data = value.data; error.httpStatus = status
  return error
}
