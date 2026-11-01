import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import * as Vue from 'vue'
import { defineComponent, h, reactive, ssrContextKey, type App } from 'vue'
import Detail from '../src/views/skill/SkillDetailPage.vue'
import { attachClientRender, hostNode, hostNodes, hostRenderer, settleHost, type HostNode } from './helpers/vueHost'

const mocks = vi.hoisted(() => ({ detail: vi.fn(), options: vi.fn(), fileMounts: 0, commentMounts: 0,
  route: { params: { skillId: '20' } }, identity: { token: 'session-a' } }))
vi.mock('vue-router', () => ({ useRoute: () => Vue.reactive(mocks.route) }))
vi.mock('@/stores/user', () => ({ useUserStore: () => Vue.reactive(mocks.identity) }))
vi.mock('@/utils/auth', () => ({ getToken: () => mocks.identity.token }))
vi.mock('@/api/request', () => ({ handleExpiredSession: vi.fn() }))
vi.mock('@/api/skill', () => ({ skillDetail: mocks.detail, skillOptions: mocks.options, skillDownload: vi.fn(), readSkillArchive: vi.fn() }))
vi.mock('@/views/skill/SkillMarkdown.vue', () => ({ default: { render: () => null } }))
vi.mock('@/views/skill/SkillFileBrowser.vue', () => ({ default: defineComponent({ props: ['skillId', 'versionId'],
  setup(props) { mocks.fileMounts++; return () => h('files', { skillId: props.skillId, versionId: props.versionId }) } }) }))
vi.mock('@/views/skill/SkillCommentSection.vue', () => ({ default: defineComponent({ props: ['skillId'],
  setup(props) { mocks.commentMounts++; return () => h('comments', { skillId: props.skillId }) } }) }))
attachClientRender(Detail, new URL('../src/views/skill/SkillDetailPage.vue', import.meta.url))
let app: App | undefined
let root: HostNode
const tab = (key: string) => hostNodes(root).find(node => node.props.id === 'skill-tab-' + key)!
const panel = (key: string) => hostNodes(root).find(node => node.props.id === 'skill-panel-' + key)!
async function click(key: string) { (tab(key).props.onClick as () => void)(); await settleHost() }
beforeEach(async () => {
  vi.clearAllMocks(); mocks.fileMounts = 0; mocks.commentMounts = 0
  reactive(mocks.route).params.skillId = '20'; reactive(mocks.identity).token = 'session-a'
  mocks.detail.mockImplementation((id: string) => Promise.resolve({ availability: 'AVAILABLE',
    skill: { skillId: id, versionId: '70', slug: 'test', version: '1.0.0', name: '测试', categoryId: 'development',
      tags: [], publisher: { handle: 'author', publicName: '作者' } } }))
  mocks.options.mockResolvedValue({ categories: [], tags: [], maxArchiveBytes: 1024 })
  root = hostNode('root'); app = hostRenderer.createApp(Detail); app.provide(ssrContextKey, {})
  const passthrough = defineComponent({ inheritAttrs: false, setup: (_, { slots }) => () => slots.default?.() })
  for (const name of ['a-spin', 'a-tag', 'a-alert', 'router-link']) app.component(name, passthrough)
  app.component('a-button', defineComponent({ setup: (_, { attrs, slots }) => () => h('button', attrs, slots.default?.()) }))
  app.mount(root); await settleHost()
})
afterEach(() => app?.unmount())

it('默认介绍，文件和评论首次访问挂载，切换页签保留已有模块', async () => {
  expect(tab('introduction').props['aria-selected']).toBe(true)
  expect(panel('introduction').style.display).not.toBe('none')
  expect(panel('comments').style.display).toBe('none')
  expect(mocks.fileMounts).toBe(0); expect(mocks.commentMounts).toBe(0)
  await click('comments')
  expect(mocks.commentMounts).toBe(1); expect(panel('comments').style.display).not.toBe('none')
  expect(hostNodes(panel('comments')).find(node => node.type === 'comments')?.props.skillId).toBe('20')
  await click('files')
  expect(panel('comments').style.display).toBe('none')
  expect(hostNodes(panel('files')).find(node => node.type === 'files')?.props.versionId).toBe('70')
  await click('comments'); expect(mocks.commentMounts).toBe(1); expect(mocks.fileMounts).toBe(1)
})

it('路由或会话变化恢复介绍，销毁旧资源模块', async () => {
  await click('files'); reactive(mocks.route).params.skillId = '21'; await settleHost()
  expect(tab('introduction').props['aria-selected']).toBe(true)
  expect(hostNodes(root).some(node => node.type === 'files')).toBe(false)
  await click('files'); expect(hostNodes(root).find(node => node.type === 'files')?.props.skillId).toBe('21')
  reactive(mocks.identity).token = 'session-b'; await settleHost()
  expect(tab('introduction').props['aria-selected']).toBe(true)
  expect(hostNodes(root).some(node => node.type === 'files')).toBe(false)
})

it('页签响应左右、Home、End键并移动焦点，普通按键不切换', async () => {
  const focus = vi.fn(), preventDefault = vi.fn()
  const event = (key: string) => ({ key, preventDefault, currentTarget: { parentElement: { querySelectorAll: () => [
    { focus }, { focus }, { focus },
  ] } } })
  ;(tab('introduction').props.onKeydown as (event: unknown) => void)(event('ArrowRight')); await settleHost()
  expect(tab('files').props['aria-selected']).toBe(true)
  ;(tab('files').props.onKeydown as (event: unknown) => void)(event('End')); await settleHost()
  expect(tab('comments').props['aria-selected']).toBe(true)
  ;(tab('comments').props.onKeydown as (event: unknown) => void)(event('Home')); await settleHost()
  expect(tab('introduction').props['aria-selected']).toBe(true)
  ;(tab('introduction').props.onKeydown as (event: unknown) => void)(event('ArrowLeft')); await settleHost()
  expect(tab('comments').props['aria-selected']).toBe(true)
  ;(tab('comments').props.onKeydown as (event: unknown) => void)(event('a')); await settleHost()
  expect(focus).toHaveBeenCalledTimes(4); expect(preventDefault).toHaveBeenCalledTimes(4)
})
