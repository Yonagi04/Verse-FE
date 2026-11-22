import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import * as Vue from 'vue'
import { defineComponent, h, reactive, ssrContextKey, type App } from 'vue'
import Page from '../src/views/skill/SkillFavoritesPage.vue'
import { attachClientRender, hostNode, hostNodes, hostText, hostRenderer, settleHost, type HostNode } from './helpers/vueHost'
const mocks = vi.hoisted(() => ({ page: vi.fn(), options: vi.fn(), replace: vi.fn(), push: vi.fn(),
  route: { fullPath: '/skills/favorites', query: {} as Record<string, string> }, token: 'a', identity: { token: 'a' },
  store: { revision: 0, deletedFolder: undefined as string | undefined, notice: '', readError: '',
    folders: { total: 1, folders: [{ folderId: '0', name: '默认收藏夹', defaultFolder: true, count: 1 }, { folderId: '10', name: 'Dev', defaultFolder: false, count: 0 }] },
    observeItems: vi.fn(), loadFolders: vi.fn() } }))
vi.mock('vue-router', () => ({ useRoute: () => Vue.reactive(mocks.route), useRouter: () => ({ replace: mocks.replace, push: mocks.push }) }))
vi.mock('@/stores/user', () => ({ useUserStore: () => Vue.reactive(mocks.identity) }))
vi.mock('@/stores/skillFavorite', () => ({ useSkillFavoriteStore: () => Vue.reactive(mocks.store) }))
vi.mock('@/utils/auth', () => ({ getToken: () => mocks.token }))
vi.mock('@/api/skillFavorite', () => ({ favoritePage: mocks.page }))
vi.mock('@/api/skill', () => ({ skillOptions: mocks.options }))
vi.mock('@/views/skill/favorites/SkillFavoriteFolders.vue', () => ({ default: defineComponent({ setup: () => () => h('folders') }) }))
vi.mock('@/views/skill/favorites/SkillFavoriteButton.vue', () => ({ default: defineComponent({ props: ['name'], setup: props => () => h('favorite-button', {}, props.name) }) }))
attachClientRender(Page, new URL('../src/views/skill/SkillFavoritesPage.vue', import.meta.url))
let app: App | undefined, root: HostNode
const item = (available = true) => ({ favoriteId: '100', skillId: '20', folderId: '0', folderName: '默认收藏夹', savedAt: '2026-11-01T00:00:00Z',
  availability: available ? 'AVAILABLE' : 'UNAVAILABLE', skill: { name: 'Secret Title', summary: 'Secret Summary', categoryId: 'dev',
    tags: [], version: 'v1', publishedAt: '2026-11-20T17:00:00Z', publisher: { publicName: 'Secret Author' } } })
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done }); return { resolve, promise } }
async function mount() {
  root = hostNode('root'); app = hostRenderer.createApp(Page); app.provide(ssrContextKey, {})
  const passthrough = defineComponent({ inheritAttrs: false, setup: (_, { slots }) => () => slots.default?.() })
  for (const name of ['a-spin', 'a-tag', 'a-card']) app.component(name, passthrough)
  app.component('a-alert', defineComponent({ props: ['message'], setup: (props, { slots }) => () => h('alert', {}, [props.message, slots.action?.()]) }))
  app.component('a-empty', defineComponent({ props: ['description'], setup: (props, { slots }) => () => h('empty', {}, [props.description, slots.default?.()]) }))
  app.component('router-link', defineComponent({ props: ['to', 'custom'], setup: (props, { slots }) => () => h('a', { to: props.to }, slots.default?.({ href: '#', navigate() {} })) }))
  for (const name of ['a-button', 'a-input-search', 'a-select', 'a-pagination']) app.component(name, defineComponent({ setup: (_, { attrs, slots }) => () => h(name, attrs, slots.default?.()) }))
  app.mount(root); await settleHost()
}
beforeEach(() => {
  vi.resetAllMocks(); mocks.token = 'a'; reactive(mocks.identity).token = 'a'
  reactive(mocks.route).query = {}; reactive(mocks.route).fullPath = '/skills/favorites'
  Object.assign(reactive(mocks.store), { revision: 0, deletedFolder: undefined, notice: '', readError: '' }); mocks.store.folders.total = 1
  mocks.page.mockResolvedValue({ page: 1, size: 12, total: 1, items: [item()] })
  mocks.options.mockResolvedValue({ categories: [], tags: [] }); mocks.store.loadFolders.mockResolvedValue(true)
})
afterEach(() => app?.unmount())

it('失效项即使错误带回源卡片也不在正文、作者或按钮中渲染', async () => {
  mocks.page.mockResolvedValue({ page: 1, size: 12, total: 1, items: [item(false)] }); await mount()
  expect(hostText(root)).toContain('Skill 暂不可用'); expect(hostText(root)).toContain('默认收藏夹')
  for (const content of ['Secret Title', 'Secret Summary', 'Secret Author', '最近更新']) expect(hostText(root)).not.toContain(content)
  expect(hostNodes(root).filter(node => typeof node.props.to === 'object' && String((node.props.to as { path?: string }).path).includes('/skills/20'))).toHaveLength(0)
})
it('可用卡片带北京时间日期，详情链接携带完整筛选返回地址', async () => {
  reactive(mocks.route).query = { folder: '0', keyword: 'Title', sort: 'updated', page: '1' }
  reactive(mocks.route).fullPath = '/skills/favorites?folder=0&keyword=Title&sort=updated'; await mount()
  expect(hostText(root)).toContain('最近更新 2026-11-21')
  const link = hostNodes(root).find(node => (node.props.to as { path?: string })?.path === '/skills/20')!
  expect((link.props.to as { query: unknown }).query).toEqual({ returnTo: mocks.route.fullPath })
})
it('末页为空时按total回到最后有效页，保留夹、关键词和排序', async () => {
  reactive(mocks.route).query = { folder: '10', keyword: 'Title', sort: 'updated', page: '3' }
  mocks.page.mockResolvedValue({ page: 3, size: 12, total: 13, items: [] }); await mount()
  expect(mocks.replace).toHaveBeenCalledWith({ path: '/skills/favorites', query: { folder: '10', keyword: 'Title', sort: 'updated', page: '2' } })
})
it('被动发现夹404回全部第一页、清关键词并保留排序', async () => {
  reactive(mocks.route).query = { folder: '10', keyword: 'Title', sort: 'updated', page: '2' }
  mocks.page.mockRejectedValue({ code: 'A001702' }); await mount()
  expect(mocks.replace).toHaveBeenCalledWith({ path: '/skills/favorites', query: { folder: undefined, keyword: undefined, sort: 'updated', page: undefined } })
  expect(mocks.store.notice).toContain('已返回全部收藏'); expect(hostText(root)).not.toContain('Secret Title')
})
it('主动删除当前夹跳默认第一页并清关键词', async () => {
  reactive(mocks.route).query = { folder: '10', keyword: 'Title', sort: 'updated', page: '2' }; await mount()
  mocks.replace.mockClear(); reactive(mocks.store).deletedFolder = '10'; reactive(mocks.store).revision++
  await settleHost()
  expect(mocks.replace).toHaveBeenCalledWith({ path: '/skills/favorites', query: { folder: '0', keyword: undefined, sort: 'updated', page: undefined } })
})
it('读取失败不能显示空收藏，重试保留查询', async () => {
  mocks.page.mockRejectedValueOnce(new Error('offline')); await mount()
  expect(hostText(root)).toContain('收藏暂时无法加载'); expect(hostText(root)).not.toContain('还没有收藏')
  const retry = hostNodes(root).find(node => node.type === 'a-button' && hostText(node).includes('重试'))!
  ;(retry.props.onClick as () => void)(); await settleHost()
  expect(hostText(root)).toContain('Secret Title'); expect(hostText(root)).not.toContain('收藏暂时无法加载')
})
it('切账号立即清旧列表，旧请求晚到不污染新列表', async () => {
  const waiting = deferred<unknown>(); mocks.page.mockReturnValueOnce(waiting.promise); await mount()
  mocks.page.mockResolvedValueOnce({ page: 1, size: 12, total: 1, items: [{ ...item(), skill: { ...item().skill, name: 'New Account Content' } }] })
  mocks.token = 'b'; reactive(mocks.identity).token = 'b'; await settleHost()
  waiting.resolve({ page: 1, size: 12, total: 1, items: [item()] }); await settleHost()
  expect(hostText(root)).toContain('New Account Content'); expect(hostText(root)).not.toContain('Secret Title')
})
