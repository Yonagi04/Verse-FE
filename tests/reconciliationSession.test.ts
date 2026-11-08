import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { listCases } from '../src/api/costReconciliation'
import { exchangeReconciliationHandoff, issueReconciliationHandoff } from '../src/api/reconciliationTransport'
import {
  createReconciliationContinuation, parseReconciliationContinuation,
  reconciliationContinuationPath, takeReconciliationProof,
} from '../src/utils/reconciliationContinuation'

const BATCH = 'A1b2C3d4'
const MAIN = 'http://localhost:3000'
const RECONCILIATION = 'http://reconciliation.localhost:3000'
const CODE = 'A'.repeat(43)
const TOKEN = `crs_${CODE}`

beforeEach(() => {
  const storage = new Map<string, string>()
  vi.stubGlobal('sessionStorage', {
    getItem: (key: string) => storage.get(key),
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  })
  vi.stubEnv('VITE_MAIN_SITE_ORIGIN', MAIN)
  vi.stubEnv('VITE_API_BASE_URL', '/api/v1')
  vi.stubGlobal('window', { location: { origin: RECONCILIATION } })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

it('续接只公开挑战值，兑换证明限同一批次和当前标签页且只取一次', async () => {
  const target = new URL(await createReconciliationContinuation(BATCH))
  const state = target.searchParams.get('state')
  const callback = `#code=${CODE}&state=${state}`
  const proof = takeReconciliationProof(BATCH, callback)
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(proof.verifier))
  expect(target.origin).toBe(MAIN)
  expect(target.href).not.toContain(proof.verifier)
  expect(parseReconciliationContinuation(target.pathname + target.search)).toEqual({
    batchCode: BATCH, challenge: Buffer.from(digest).toString('base64url'), state,
  })
  expect(proof.code).toBe(CODE)
  expect(() => takeReconciliationProof(BATCH, callback)).toThrow('补账登录已失效')
})

it('拒绝外部回跳、错误批次、伪造 state 和重复参数', async () => {
  const target = new URL(await createReconciliationContinuation(BATCH))
  expect(reconciliationContinuationPath(target.href)).toBeUndefined()
  expect(reconciliationContinuationPath(target.pathname + target.search + '&batch=A1b2C3d4')).toBeUndefined()
  expect(() => takeReconciliationProof(BATCH, `#code=${CODE}&state=${CODE}`)).toThrow('补账登录已失效')
  const fresh = new URL(await createReconciliationContinuation(BATCH))
  expect(() => takeReconciliationProof('Z1b2C3d4', `#code=${CODE}&state=${fresh.searchParams.get('state')}`))
    .toThrow('补账登录已失效')
})

it('主站凭证只用于同源签发，补账兑换匿名且账单只携带批次凭证', async () => {
  const fetch = vi.fn(async () => new Response(JSON.stringify({ code: '0', data: { token: TOKEN } })))
  vi.stubGlobal('fetch', fetch)
  vi.stubGlobal('localStorage', { getItem: vi.fn(() => 'legacy-main-token') })
  await exchangeReconciliationHandoff(BATCH, CODE, CODE)
  await listCases(TOKEN, BATCH, 'PENDING', '40')
  vi.stubGlobal('window', { location: { origin: MAIN } })
  await issueReconciliationHandoff('valid-main-token', BATCH, CODE)

  expect(fetch).toHaveBeenNthCalledWith(1, new URL(`${RECONCILIATION}/api/v1/cost-reconciliation-session/exchanges`),
    expect.objectContaining({ credentials: 'omit', redirect: 'error', headers: { 'Content-Type': 'application/json' } }))
  expect(fetch).toHaveBeenNthCalledWith(2, new URL(`${RECONCILIATION}/api/v1/cost-reconciliation-batches/${BATCH}/cases?state=PENDING&after=40`),
    expect.objectContaining({ headers: { Authorization: `Bearer ${TOKEN}` } }))
  expect(fetch).toHaveBeenNthCalledWith(3, new URL(`${MAIN}/api/v1/cost-reconciliation-session/handoffs`),
    expect.objectContaining({ headers: { Authorization: 'Bearer valid-main-token', 'Content-Type': 'application/json' } }))
  expect(localStorage.getItem).not.toHaveBeenCalled()
})

it('保留 401 与 503 的区分，拒绝把令牌发给异源 API', async () => {
  const fetch = vi.fn()
    .mockResolvedValueOnce(new Response('{"message":"expired"}', { status: 401 }))
    .mockResolvedValueOnce(new Response('{"message":"unavailable"}', { status: 503 }))
  vi.stubGlobal('fetch', fetch)
  await expect(listCases(TOKEN, BATCH, 'PENDING')).rejects.toMatchObject({ status: 401, message: 'expired' })
  await expect(listCases(TOKEN, BATCH, 'PENDING')).rejects.toMatchObject({ status: 503, message: 'unavailable' })
  vi.stubEnv('VITE_API_BASE_URL', 'https://invalid.example/api/v1')
  await expect(listCases(TOKEN, BATCH, 'PENDING')).rejects.toThrow('补账接口地址配置无效')
  expect(fetch).toHaveBeenCalledTimes(2)
})
