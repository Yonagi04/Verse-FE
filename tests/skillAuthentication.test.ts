import { AxiosError } from 'axios'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
vi.mock('ant-design-vue', () => ({ message: { error: vi.fn() } }))

let values: Map<string, string>
let location: { pathname: string; search: string; hash: string; href: string }
const archivePath = '/api/v1/skills/downloads/' + 'a'.repeat(64)
beforeEach(() => {
  values = new Map([['verse_token', 'session-a']])
  location = { pathname: '/skills/20', search: '?source=plaza', hash: '#usage', href: '' }
  vi.stubGlobal('localStorage', { getItem: (key: string) => values.get(key) || null,
    removeItem: (key: string) => values.delete(key) })
  vi.stubGlobal('window', { location })
})
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules() })

it('广场、词表、详情及下载授权都携带当前账号会话', async () => {
  const http = (await import('../src/api/request')).default
  const headers: unknown[] = []
  http.defaults.adapter = async config => {
    headers.push(config.headers.Authorization)
    return { status: 200, statusText: 'OK', headers: {}, config, data: { code: '0', data: null } }
  }
  const api = await import('../src/api/skill')
  await api.skillOptions(); await api.searchSkills({ page: 1, size: 12 })
  await api.skillDetail('20'); await api.skillDownload('20', '70')
  await api.skillFiles('20', '70'); await api.skillFileContent('20', '70', 'SKILL.md')
  expect(headers).toEqual(Array(6).fill('Bearer session-a'))
})

it.each(['search', 'detail', 'grant'])('%s会话失效时清理登录态并保留完整Skill路径', async operation => {
  const http = (await import('../src/api/request')).default
  http.defaults.adapter = async config => {
    throw new AxiosError('expired', 'ERR_BAD_REQUEST', config, undefined,
      { status: 401, statusText: 'Unauthorized', headers: {}, config, data: { code: 'EXPIRED' } })
  }
  const api = await import('../src/api/skill')
  const request = operation === 'search' ? api.searchSkills({ page: 1, size: 12 })
    : operation === 'detail' ? api.skillDetail('20') : api.skillDownload('20', '70')
  await expect(request).rejects.toBeDefined()
  expect(values.has('verse_token')).toBe(false)
  expect(location.href).toBe('/login?redirect=%2Fskills%2F20%3Fsource%3Dplaza%23usage')
})

it('最终ZIP请求携带同一Bearer并返回原字节', async () => {
  const fetch = vi.fn().mockResolvedValue(new Response(new Uint8Array([1, 2, 3]), {
    headers: { 'Content-Type': 'application/zip' },
  }))
  vi.stubGlobal('fetch', fetch)
  const { readSkillArchive } = await import('../src/api/skill')
  const blob = await readSkillArchive(archivePath, 1024)
  expect([...new Uint8Array(await blob.arrayBuffer())]).toEqual([1, 2, 3])
  expect(fetch.mock.calls[0]?.[1].headers).toEqual({ Authorization: 'Bearer session-a' })
})

it('最终ZIP的401同样触发登录，下载token不能替代会话', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 401 })))
  const { readSkillArchive } = await import('../src/api/skill')
  await expect(readSkillArchive(archivePath, 1024)).rejects.toThrow('登录已过期')
  expect(values.has('verse_token')).toBe(false)
  expect(location.href).toContain('/login?redirect=')
})

it.each([200, 401])('旧会话下载返回%s时不能清理新会话或交付文件', async status => {
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => {
    values.set('verse_token', 'session-b')
    return new Response(new Uint8Array([1]), { status, headers: { 'Content-Type': 'application/zip' } })
  }))
  const { readSkillArchive } = await import('../src/api/skill')
  await expect(readSkillArchive(archivePath, 1024)).rejects.toThrow()
  expect(values.get('verse_token')).toBe('session-b')
  expect(location.href).toBe('')
})

it('接收ZIP正文期间会话变化同样拒绝交付', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 200, ok: true,
    headers: new Headers({ 'Content-Type': 'application/zip' }), blob: async () => {
      values.set('verse_token', 'session-b')
      return new Blob([new Uint8Array([1])])
    } }))
  const { readSkillArchive } = await import('../src/api/skill')
  await expect(readSkillArchive(archivePath, 1024)).rejects.toThrow('登录账号已变更')
  expect(location.href).toBe('')
})

it('没有会话时不发送ZIP请求并回到登录页', async () => {
  values.clear()
  const fetch = vi.fn()
  vi.stubGlobal('fetch', fetch)
  const { readSkillArchive } = await import('../src/api/skill')
  await expect(readSkillArchive(archivePath, 1024)).rejects.toThrow('请登录后下载')
  expect(fetch).not.toHaveBeenCalled()
  expect(location.href).toContain('/login?redirect=')
})

it('无Token旧请求的401晚到时不能清除刚建立的新会话', async () => {
  values.clear()
  const http = (await import('../src/api/request')).default
  http.defaults.adapter = async config => {
    expect(config.headers.Authorization).toBeUndefined()
    values.set('verse_token', 'new-session')
    throw new AxiosError('expired', 'ERR_BAD_REQUEST', config, undefined,
      { status: 401, statusText: 'Unauthorized', headers: {}, config, data: { code: 'EXPIRED' } })
  }
  const { searchSkills } = await import('../src/api/skill')
  await expect(searchSkills({ page: 1, size: 12 })).rejects.toBeDefined()
  expect(values.get('verse_token')).toBe('new-session')
  expect(location.href).toBe('')
})
