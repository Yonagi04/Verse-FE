import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { RouteRecordRaw, RouterOptions } from 'vue-router'

const mocks = vi.hoisted(() => ({
  profile: vi.fn(),
  tenant: { initialize: vi.fn(), reset: vi.fn(), setCurrentTenant: vi.fn(), currentTenantId: null },
  playground: { reset: vi.fn(), refresh: vi.fn() },
}))
vi.mock('vue-router', async original => {
  const actual = await original<typeof import('vue-router')>()
  const views = (routes: RouteRecordRaw[]): RouteRecordRaw[] => routes.map(route => ({
    ...route,
    ...('component' in route ? { component: { render: () => null } } : {}),
    ...('children' in route && route.children ? { children: views(route.children) } : {}),
  } as RouteRecordRaw))
  return { ...actual, createWebHistory: actual.createMemoryHistory,
    createRouter: (options: RouterOptions) => actual.createRouter({ ...options, routes: views(options.routes) }) }
})
vi.mock('@/api/user', () => ({ getCurrentUser: mocks.profile, login: vi.fn(), logout: vi.fn() }))
vi.mock('@/api/request', () => ({ resetAuthRequests: vi.fn() }))
vi.mock('@/stores/tenant', () => ({ useTenantStore: () => mocks.tenant }))
vi.mock('@/stores/playground', () => ({ usePlaygroundStore: () => mocks.playground }))
vi.mock('@/composables/useWebSocketNotification', () => ({
  useWebSocketNotification: () => ({ disconnect: vi.fn() }), unreadCount: { value: 0 }, newNotification: { value: null },
}))
vi.mock('@/hooks/useExternalAuthFlow', () => ({
  hasStoredFlow: () => false, readFlow: vi.fn(), cancelAbandonedFlows: () => Promise.resolve(),
}))
vi.mock('@/api/externalAuth', () => ({ getFlow: vi.fn() }))

let storage: Map<string, string>
const profile = { userId: '1', username: 'account-a', nickname: '真实昵称', email: '', phone: '' }
beforeEach(() => {
  vi.clearAllMocks()
  storage = new Map([['verse_token', 'session-a']])
  vi.stubGlobal('localStorage', { getItem: (key: string) => storage.get(key) || null,
    setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key) })
  setActivePinia(createPinia())
  mocks.profile.mockResolvedValue(profile)
})
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules() })

it.each(['/skills', '/skills/20', '/skills/publish/30', '/skills/mine'])(
  '刷新%s会恢复真实用户资料且不初始化租户', async path => {
    const { useUserStore } = await import('../src/stores/user')
    const user = useUserStore()
    expect(user.user).toBeNull()
    const router = (await import('../src/router')).default
    await router.push(path)
    expect(router.currentRoute.value.fullPath).toBe(path)
    expect(user.user?.nickname).toBe('真实昵称')
    expect(user.user?.userId).toBe('1')
    expect(mocks.profile).toHaveBeenCalledOnce()
    expect(mocks.tenant.initialize).not.toHaveBeenCalled()
  },
)

it('已有真实资料时在Skill页面之间导航不重复读取用户', async () => {
  const { useUserStore } = await import('../src/stores/user')
  const user = useUserStore()
  user.user = profile
  const router = (await import('../src/router')).default
  await router.push('/skills'); await router.push('/skills/20')
  expect(user.user.nickname).toBe('真实昵称')
  expect(mocks.profile).not.toHaveBeenCalled()
  expect(mocks.tenant.initialize).not.toHaveBeenCalled()
})

it('没有会话的直达仍跳转登录并保留完整Skill地址', async () => {
  storage.clear()
  const router = (await import('../src/router')).default
  await router.push('/skills/20?source=plaza#usage')
  expect(router.currentRoute.value.path).toBe('/login')
  expect(router.currentRoute.value.query.redirect).toBe('/skills/20?source=plaza#usage')
  expect(mocks.profile).not.toHaveBeenCalled()
})

it('刷新资料期间切换账号，旧账号的晚到资料不能覆盖新账号', async () => {
  let resolve!: (value: typeof profile) => void
  mocks.profile.mockImplementation(() => new Promise<typeof profile>(accept => { resolve = accept }))
  const { useUserStore } = await import('../src/stores/user')
  const user = useUserStore()
  const router = (await import('../src/router')).default
  const pending = router.push('/skills')
  for (let index = 0; index < 8; index++) await Promise.resolve()
  expect(mocks.profile).toHaveBeenCalledOnce()
  user.acceptLogin({ token: 'session-b', userId: '2', username: 'account-b', nickname: '新账号',
    expiresAt: '2026-10-26T00:00:00+08:00', currentTenant: null })
  resolve(profile)
  await pending
  expect(user.user?.userId).toBe('2')
  expect(user.user?.nickname).toBe('新账号')
  expect(mocks.tenant.initialize).not.toHaveBeenCalled()
})
