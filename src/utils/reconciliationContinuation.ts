const continuePath = '/reconciliation/continue'
const pendingKey = 'verse_reconciliation_handoff'
const batchPattern = /^[A-Za-z][A-Za-z0-9]{7}$/
const proofPattern = /^[A-Za-z0-9_-]{43}$/

interface Continuation {
  batchCode: string
  challenge: string
  state: string
}

function encodeProof(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function randomProof(): string {
  return encodeProof(crypto.getRandomValues(new Uint8Array(32)))
}

export function reconciliationBatch(path: string): string | undefined {
  return /^\/([A-Za-z][A-Za-z0-9]{7})\/?$/.exec(path)?.[1]
}

export function validReconciliationProof(value: unknown): value is string {
  return typeof value === 'string' && proofPattern.test(value)
}

export function mainSiteOrigin(): string {
  const origin = import.meta.env.VITE_MAIN_SITE_ORIGIN || (import.meta.env.DEV ? 'http://localhost:3000' : '')
  if (!URL.canParse(origin)) throw new Error('Verse 主站地址配置无效')
  const url = new URL(origin)
  if (url.origin !== origin || (url.protocol !== 'https:' && !(url.protocol === 'http:' && url.hostname === 'localhost'))) {
    throw new Error('Verse 主站地址配置无效')
  }
  return origin
}

export function parseReconciliationContinuation(path: unknown): Continuation | undefined {
  if (typeof path !== 'string' || path.length > 160 || !path.startsWith(`${continuePath}?`)) return
  const query = new URLSearchParams(path.slice(continuePath.length + 1))
  const batchCode = query.get('batch')
  const challenge = query.get('challenge')
  const state = query.get('state')
  if (query.size !== 3 || !batchCode || !batchPattern.test(batchCode)
    || !validReconciliationProof(challenge) || !validReconciliationProof(state)) return
  return { batchCode, challenge, state }
}

// 回跳只能使用站内指定路由。第三方登录只需保存这个规范化的地址。
export function reconciliationContinuationPath(path: unknown): string | undefined {
  const continuation = parseReconciliationContinuation(path)
  return continuation && toContinuationPath(continuation)
}

function toContinuationPath({ batchCode, challenge, state }: Continuation): string {
  return `${continuePath}?${new URLSearchParams({ batch: batchCode, challenge, state })}`
}

export async function createReconciliationContinuation(batchCode: string): Promise<string> {
  if (!batchPattern.test(batchCode)) throw new Error('补账批次地址无效')
  const origin = mainSiteOrigin()
  const verifier = randomProof()
  const state = randomProof()
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  const challenge = encodeProof(new Uint8Array(digest))
  sessionStorage.setItem(pendingKey, JSON.stringify({ batchCode, verifier, state }))
  return origin + toContinuationPath({ batchCode, challenge, state })
}

export function takeReconciliationProof(batchCode: string, fragment: string): { code: string; verifier: string } {
  const query = new URLSearchParams(fragment.slice(1))
  const code = query.get('code')
  const state = query.get('state')
  const pending = JSON.parse(sessionStorage.getItem(pendingKey) || 'null') as Record<string, unknown> | null
  sessionStorage.removeItem(pendingKey)
  if (query.size !== 2 || !validReconciliationProof(code) || !validReconciliationProof(state)
    || pending?.batchCode !== batchCode || pending.state !== state || !validReconciliationProof(pending.verifier)) {
    throw new Error('补账登录已失效，请重新连接 Verse')
  }
  return { code, verifier: pending.verifier }
}
