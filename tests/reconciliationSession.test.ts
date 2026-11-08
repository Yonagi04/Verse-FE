import { AxiosError } from 'axios'
import { afterEach, expect, it, vi } from 'vitest'

vi.mock('ant-design-vue', () => ({ message: { error: vi.fn() } }))

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

it('补账会话过期在原批次链接重新登录', async () => {
  const storage = new Map([['verse_token', 'fixture-token']])
  const location = { pathname: '/A1b2C3d4', href: '' }
  const dispatchEvent = vi.fn()
  vi.stubGlobal('localStorage', { getItem: (key: string) => storage.get(key), removeItem: (key: string) => storage.delete(key) })
  vi.stubGlobal('window', { location, dispatchEvent })
  vi.stubGlobal('document', { documentElement: { dataset: { verseSurface: 'cost-reconciliation' } } })
  const request = (await import('../src/api/request')).default
  request.defaults.adapter = async config => {
    throw new AxiosError('expired', 'ERR_BAD_REQUEST', config, undefined,
      { status: 401, statusText: 'Unauthorized', headers: {}, config, data: { code: 'EXPIRED' } })
  }
  const { listCases } = await import('../src/api/costReconciliation')

  await expect(listCases('A1b2C3d4', 'PENDING')).rejects.toThrow('expired')

  expect(storage.has('verse_token')).toBe(false)
  expect(location.href).toBe('')
  expect(dispatchEvent).toHaveBeenCalledOnce()
  expect(dispatchEvent.mock.calls[0]?.[0].type).toBe('verse-session-changed')
})
