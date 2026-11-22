import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import * as Vue from 'vue'
import { defineComponent, ssrContextKey, type App, type VNode } from 'vue'
import Host from '../src/views/skill/favorites/SkillFavoriteHost.vue'
import { attachClientRender, hostNode, hostRenderer, settleHost } from './helpers/vueHost'

const mocks = vi.hoisted(() => ({ open: vi.fn(), destroy: vi.fn(), retry: vi.fn(), restore: vi.fn(),
  state: { dialog: undefined as { type: 'create'; skillId: string; name: string; folderId: string } | undefined,
    notice: '', noticeType: 'success' as 'success' | 'warning' | 'info', actionError: '',
    pending: undefined as object | undefined, undo: undefined as object | undefined,
    locked: false, busy: false, uncertain: false, selectedFolder: '0' } }))
vi.mock('ant-design-vue', () => ({ Button: 'toast-button', message: { open: mocks.open, destroy: mocks.destroy } }))
vi.mock('@/stores/skillFavorite', () => ({ useSkillFavoriteStore: () => Object.assign(Vue.reactive(mocks.state), {
  retry: mocks.retry, restore: mocks.restore,
}) }))
vi.mock('@/utils/auth', () => ({ getToken: () => 'session-a' }))
vi.mock('@/views/skill/favorites/SkillFavoriteFolderForm.vue', () => ({ default: defineComponent({ setup: () => () => null }) }))
attachClientRender(Host, new URL('../src/views/skill/favorites/SkillFavoriteHost.vue', import.meta.url))
let app: App | undefined
const lastToast = () => mocks.open.mock.calls.at(-1)![0] as { key: string; type: string; duration: number; content: VNode | string }
function action() { return ((lastToast().content as VNode).children as VNode[]).find(node => node.type === 'toast-button')! }
async function mount() {
  app = hostRenderer.createApp(Host); app.provide(ssrContextKey, {})
  for (const name of ['a-modal', 'a-button', 'a-alert']) app.component(name, defineComponent({ setup: () => () => null }))
  app.mount(hostNode('root')); await settleHost()
}
beforeEach(() => {
  vi.clearAllMocks()
  Object.assign(Vue.reactive(mocks.state), { dialog: undefined, notice: '', noticeType: 'success', actionError: '',
    pending: undefined, undo: undefined, locked: false, busy: false, uncertain: false, selectedFolder: '0' })
})
afterEach(() => app?.unmount())

it('结果未知时保留常驻警告，允许原请求重试并在重试中禁用按钮', async () => {
  Object.assign(Vue.reactive(mocks.state), { actionError: '结果待确认', uncertain: true, locked: true, pending: {} })
  await mount()
  expect(lastToast()).toMatchObject({ type: 'warning', duration: 0 })
  expect(action().props?.disabled).toBe(false)
  action().props?.onClick(); expect(mocks.retry).toHaveBeenCalledOnce(); expect(mocks.restore).not.toHaveBeenCalled()
  Vue.reactive(mocks.state).busy = true; await settleHost()
  expect(action().props?.disabled).toBe(true); expect(action().props?.loading).toBe(true)
  Vue.reactive(mocks.state).busy = false; await settleHost()
  expect(action().props?.disabled).toBe(false)
})
it('撤销提示使用通用 toast，到期关闭且不会重新弹出普通成功提示', async () => {
  Object.assign(Vue.reactive(mocks.state), { notice: '已取消收藏', undo: {} })
  await mount()
  expect(lastToast()).toMatchObject({ type: 'success', duration: 5 })
  action().props?.onClick(); expect(mocks.restore).toHaveBeenCalledOnce()
  const key = lastToast().key; mocks.open.mockClear(); mocks.destroy.mockClear()
  Vue.reactive(mocks.state).undo = undefined; await settleHost()
  expect(mocks.destroy).toHaveBeenCalledWith(key); expect(mocks.open).not.toHaveBeenCalled()
  Object.assign(Vue.reactive(mocks.state), { busy: true, locked: true }); await settleHost()
  Object.assign(Vue.reactive(mocks.state), { busy: false, locked: false }); await settleHost()
  expect(mocks.open).not.toHaveBeenCalled()
})
it('弹窗中的业务错误留在弹窗内，不重复弹出全局提示', async () => {
  Object.assign(Vue.reactive(mocks.state), { dialog: { type: 'create', skillId: '20', name: 'Sample', folderId: '0' }, actionError: '收藏已达上限' })
  await mount(); expect(mocks.open).not.toHaveBeenCalled()
})
