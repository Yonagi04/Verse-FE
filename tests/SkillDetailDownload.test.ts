import { readFileSync } from 'node:fs'
import { parse, compileScript, compileTemplate } from '@vue/compiler-sfc'
import * as Vue from 'vue'
import { createRenderer, defineComponent, h, nextTick, type App } from 'vue'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import Detail from '../src/views/skill/SkillDetailPage.vue'

const mocks = vi.hoisted(() => ({ detail: vi.fn(), options: vi.fn(), grant: vi.fn(), read: vi.fn(),
  session: 'session-a', identity: { token: 'session-a' } }))
vi.mock('vue-router', () => ({ useRoute: () => ({ params: { skillId: '20' } }) }))
vi.mock('@/stores/user', () => ({ useUserStore: () => Vue.reactive(mocks.identity) }))
vi.mock('@/utils/auth', () => ({ getToken: () => mocks.session }))
vi.mock('@/api/request', () => ({ handleExpiredSession: vi.fn() }))
vi.mock('@/api/skill', () => ({ skillDetail: mocks.detail, skillOptions: mocks.options,
  skillDownload: mocks.grant, readSkillArchive: mocks.read }))
vi.mock('@/views/skill/SkillMarkdown.vue', () => ({ default: { render: () => null } }))
vi.mock('@/views/skill/SkillCommentSection.vue', () => ({ default: { render: () => null } }))

interface Host { type: string; text: string; props: Record<string, unknown>; children: Host[]; parent: Host | null }
const node = (type: string, text = ''): Host => ({ type, text, props: {}, children: [], parent: null })
const renderer = createRenderer<Host, Host>({
  createElement: type => node(type), createText: text => node('text', text), createComment: () => node('comment'),
  setText: (target, text) => { target.text = text }, setElementText: (target, text) => { target.text = text },
  parentNode: target => target.parent, nextSibling: () => null,
  patchProp: (target, key, _old, value) => { target.props[key] = value },
  insert(target, parent) { target.parent = parent; parent.children.push(target) },
  remove(target) { if (target.parent) target.parent.children.splice(target.parent.children.indexOf(target), 1) },
})
const filename = new URL('../src/views/skill/SkillDetailPage.vue', import.meta.url)
const { descriptor } = parse(readFileSync(filename, 'utf8'), { filename: filename.pathname })
const script = compileScript(descriptor, { id: 'skill-detail' })
const template = compileTemplate({ source: descriptor.template!.content, filename: filename.pathname,
  id: 'skill-detail', compilerOptions: { bindingMetadata: script.bindings } })
if (template.errors.length) throw new Error(String(template.errors))
const render = template.code.replace(/import \{([^}]+)\} from "vue"/g,
  (_, names: string) => 'const {' + names.replace(/ as /g, ': ') + '} = Vue')
  .replace('export function render', 'return function render')
Detail.render = new Function('Vue', render)(Vue)
const text = (target: Host): string => target.text + target.children.map(text).join(' ')
const buttons = (target: Host): Host[] => [...(target.type === 'button' ? [target] : []), ...target.children.flatMap(buttons)]
let app: App | undefined
let root: Host
let save: ReturnType<typeof vi.fn>
let objectUrl: ReturnType<typeof vi.fn>
let digest: ReturnType<typeof vi.fn>
async function settle() { for (let index = 0; index < 8; index++) { await Promise.resolve(); await nextTick() } }
beforeEach(async () => {
  vi.clearAllMocks(); vi.useFakeTimers()
  mocks.session = 'session-a'; mocks.identity.token = 'session-a'
  mocks.detail.mockResolvedValue({ availability: 'AVAILABLE', skill: { skillId: '20', versionId: '70',
    slug: 'test', version: '1.0.0', name: '测试', categoryId: 'development', tags: [], publisher: { handle: 'author' } } })
  mocks.options.mockResolvedValue({ categories: [], tags: [], maxArchiveBytes: 1024 })
  mocks.grant.mockResolvedValue({ downloadUrl: '/api/v1/skills/downloads/' + 'a'.repeat(64), sha256: '00'.repeat(32) })
  mocks.read.mockResolvedValue(new Blob([new Uint8Array([1, 2, 3])]))
  save = vi.fn(); objectUrl = vi.fn(() => 'blob:verified'); digest = vi.fn().mockResolvedValue(new ArrayBuffer(32))
  vi.stubGlobal('crypto', { subtle: { digest } })
  vi.stubGlobal('URL', { createObjectURL: objectUrl, revokeObjectURL: vi.fn() })
  vi.stubGlobal('document', { createElement: () => ({ click: save, remove() {} }), body: { appendChild() {} } })
  root = node('root'); app = renderer.createApp(Detail); app.provide(Vue.ssrContextKey, {})
  const passthrough = defineComponent({ inheritAttrs: false, setup: (_, { slots }) => () => slots.default?.() })
  for (const name of ['a-spin', 'a-tag', 'a-alert', 'router-link']) app.component(name, passthrough)
  app.component('a-button', defineComponent({ setup: (_, { attrs, slots }) => () => h('button', attrs, slots.default?.()) }))
  app.mount(root); await settle()
})
afterEach(() => { app?.unmount(); vi.runAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals() })

it('同一会话完成摘要校验后才触发浏览器保存', async () => {
  const download = buttons(root).find(button => text(button).includes('下载'))!
  await (download.props.onClick as () => Promise<void>)()
  expect(save).toHaveBeenCalledOnce()
  expect(mocks.read.mock.calls[0]?.[3]).toBe('session-a')
})

it('摘要计算期间切换会话，完成后也不能保存旧文件', async () => {
  let finish!: (value: ArrayBuffer) => void
  digest.mockImplementation(() => new Promise<ArrayBuffer>(resolve => { finish = resolve }))
  const download = buttons(root).find(button => text(button).includes('下载'))!
  const pending = (download.props.onClick as () => Promise<void>)()
  await settle()
  expect(digest).toHaveBeenCalledOnce()
  mocks.session = 'session-b'
  finish(new ArrayBuffer(32)); await pending
  expect(objectUrl).not.toHaveBeenCalled()
  expect(save).not.toHaveBeenCalled()
})
