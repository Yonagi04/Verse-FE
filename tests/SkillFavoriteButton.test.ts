import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import * as Vue from 'vue'
import { defineComponent, h, reactive, ssrContextKey, type App } from 'vue'
import Button from '../src/views/skill/favorites/SkillFavoriteButton.vue'
import { attachClientRender, hostNode, hostNodes, hostText, hostRenderer, settleHost, type HostNode } from './helpers/vueHost'
const mocks = vi.hoisted(() => ({ state: { statuses: {} as Record<string, { favoriteId: string | null; folderName?: string }>, locked: false }, select: vi.fn(), submit: vi.fn() }))
vi.mock('@/stores/skillFavorite', () => ({ useSkillFavoriteStore: () => ({ ...Vue.toRefs(Vue.reactive(mocks.state)),
  get statuses() { return Vue.reactive(mocks.state).statuses }, get locked() { return Vue.reactive(mocks.state).locked },
  openSelection: mocks.select, submit: mocks.submit }) }))
attachClientRender(Button, new URL('../src/views/skill/favorites/SkillFavoriteButton.vue', import.meta.url))
let app: App | undefined, root: HostNode
async function mount(props: { available?: boolean } = {}) {
  root = hostNode('root'); app = hostRenderer.createApp(Button, { skillId: '20', name: 'Sample', compact: true, ...props }); app.provide(ssrContextKey, {})
  app.component('a-button', defineComponent({ setup: (_, { attrs, slots }) => () => h('button', attrs, slots.default?.()) }))
  app.component('a-dropdown', defineComponent({ setup: (_, { slots }) => () => slots.default?.() }))
  for (const name of ['a-menu', 'a-menu-item']) app.component(name, defineComponent({ setup: (_, { slots }) => () => slots.default?.() }))
  app.mount(root); await settleHost()
}
beforeEach(() => { vi.clearAllMocks(); reactive(mocks.state).locked = false; reactive(mocks.state).statuses = { '20': { favoriteId: null } } })
afterEach(() => app?.unmount())
const button = () => hostNodes(root).find(node => node.type === 'button')!
it('广场未显式传可用标记时，可用的未收藏按钮可打开选择弹窗', async () => {
  await mount(); expect(button().props.disabled).toBe(false)
  ;(button().props.onClick as () => void)()
  expect(mocks.select).toHaveBeenCalledWith('20', 'Sample'); expect(mocks.submit).not.toHaveBeenCalled()
  expect(hostNodes(root).some(node => node.type === 'a')).toBe(false)
})
it('状态未返回或资源明确失效时不允许误发新增收藏', async () => {
  reactive(mocks.state).statuses = {}; await mount(); expect(button().props.disabled).toBe(true)
  app?.unmount(); app = undefined; await mount({ available: false }); expect(button().props.disabled).toBe(true)
})
it('失效的既有收藏保留整理菜单，不把点击已收藏当取消', async () => {
  reactive(mocks.state).statuses = { '20': { favoriteId: '100', folderName: 'Dev' } }; await mount({ available: false })
  expect(button().props.disabled).toBe(false); expect(button().props['aria-label']).toContain('已收藏')
  expect(hostText(root)).not.toContain('取消收藏'); expect(mocks.submit).not.toHaveBeenCalled()
})
