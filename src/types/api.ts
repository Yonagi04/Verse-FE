/** 统一响应体 */
export interface Result<T = unknown> {
  code: string
  message: string | null
  data: T
  requestId: string | null
}
