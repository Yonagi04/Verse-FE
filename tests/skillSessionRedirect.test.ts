import { AxiosError } from 'axios'
import { afterEach, expect, it, vi } from 'vitest'
vi.mock('ant-design-vue', () => ({ message: { error: vi.fn() } }))
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules() })

async function unauthorized(pathname: string, search = '') {
  const values = new Map([['verse_token', 'fixture-token']])
  vi.stubGlobal('localStorage', { getItem: (key: string) => values.get(key) || null, removeItem: (key: string) => values.delete(key) })
  const location = { pathname, search, href: '' }
  vi.stubGlobal('window', { location })
  const request = (await import('../src/api/request')).default
  request.defaults.adapter = async config => {
    throw new AxiosError('expired', 'ERR_BAD_REQUEST', config, undefined,
      { status: 401, statusText: 'Unauthorized', headers: {}, config, data: { code: 'EXPIRED', message: 'expired' } })
  }
  await request.get('/skills/drafts/30').catch(() => {})
  return { location, values }
}

it('Skill私人接口会话过期后保留草稿地址用于登录回跳', async () => {
  const { location, values } = await unauthorized('/skills/publish/30', '?source=mine')
  expect(location.href).toBe('/login?redirect=%2Fskills%2Fpublish%2F30%3Fsource%3Dmine')
  expect(values.has('verse_token')).toBe(false)
})

it('其他已有页面保持原登录跳转契约', async () => {
  const { location } = await unauthorized('/dashboard')
  expect(location.href).toBe('/login')
})
