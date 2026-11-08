import type { Result } from '@/types/api'

const SESSION_PATH = '/cost-reconciliation-session'

export class ReconciliationRequestError extends Error {
  constructor(readonly status: number, message: string) {
    super(message)
  }
}

// 主站凭证仅用于同源签发请求。补账和兑换均绕开公共客户端的全站凭证注入。
export async function reconciliationRequest<T>(path: string, token: string | null, body?: unknown): Promise<T> {
  const base = import.meta.env.VITE_API_BASE_URL
  if (!base) throw new Error('补账接口地址配置无效')
  const url = new URL(base + path, window.location.origin)
  if (url.origin !== window.location.origin) throw new Error('补账接口地址配置无效')
  const response = await fetch(url, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: 'omit',
    redirect: 'error',
    referrerPolicy: 'no-referrer',
    cache: 'no-store',
    signal: AbortSignal.timeout(30_000),
  })
  const result = await response.json().catch(() => null) as Result<T> | null
  if (!response.ok || result?.code !== '0') {
    throw new ReconciliationRequestError(response.status, result?.message || '补账服务暂时不可用，请重试')
  }
  return result.data
}

export function issueReconciliationHandoff(token: string, batchCode: string, challenge: string) {
  return reconciliationRequest<{ code: string; target: string }>(`${SESSION_PATH}/handoffs`, token, { batchCode, challenge })
}

export function exchangeReconciliationHandoff(batchCode: string, code: string, verifier: string) {
  return reconciliationRequest<{ token: string; expiresAt: number }>(`${SESSION_PATH}/exchanges`, null,
    { batchCode, code, verifier })
}
