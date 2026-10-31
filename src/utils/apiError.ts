import axios from 'axios'

export function apiErrorDetails(error: unknown) {
  const data = axios.isAxiosError(error) ? error.response?.data as { code?: string; message?: string; requestId?: string } | undefined : undefined
  const business = error as { code?: string; message?: string; requestId?: string } | null
  return { code: data?.code || business?.code, message: data?.message || business?.message || '请求失败，请重试',
    requestId: data?.requestId || business?.requestId, cancelled: axios.isCancel(error), uncertain: axios.isAxiosError(error) && !error.response }
}
