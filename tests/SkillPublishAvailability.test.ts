import { readFileSync } from 'node:fs'
import { parse, compileScript, compileTemplate } from '@vue/compiler-sfc'
import * as Vue from 'vue'
import { createRenderer, defineComponent, h, reactive, ref, type App } from 'vue'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import Publish from '../src/views/skill/SkillPublishPage.vue'
import RequiredFormItem from '../src/components/form/RequiredFormItem.vue'
import { attachClientRender } from './helpers/vueHost'

attachClientRender(RequiredFormItem, new URL('../src/components/form/RequiredFormItem.vue', import.meta.url))

const mocks = vi.hoisted(() => ({ state: {} as Record<string, unknown> }))
vi.mock('@/composables/useSkillPublication', () => ({ useSkillPublication: () => mocks.state }))
vi.mock('@/views/skill/SkillMarkdown.vue', () => ({ default: { render: () => null } }))
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
const filename = new URL('../src/views/skill/SkillPublishPage.vue', import.meta.url)
const { descriptor } = parse(readFileSync(filename, 'utf8'), { filename: filename.pathname })
const script = compileScript(descriptor, { id: 'skill-publish' })
const template = compileTemplate({ source: descriptor.template!.content, filename: filename.pathname,
  id: 'skill-publish', compilerOptions: { bindingMetadata: script.bindings } })
if (template.errors.length) throw new Error(String(template.errors))
const render = template.code.replace(/import \{([^}]+)\} from "vue"/g,
  (_, names: string) => 'const {' + names.replace(/ as /g, ': ') + '} = Vue')
  .replace('export function render', 'return function render')
Publish.render = new Function('Vue', render)(Vue)
const text = (target: Host): string => target.text + target.children.map(text).join(' ')
const all = (target: Host): Host[] => [target, ...target.children.flatMap(all)]
let app: App | undefined
beforeEach(() => vi.stubGlobal('window', { addEventListener: vi.fn(), removeEventListener: vi.fn() }))

it('HTML表单pattern在浏览器UnicodeSets模式下均合法', () => {
  for (const match of descriptor.template!.content.matchAll(/\bpattern="([^"]+)"/g)) {
    expect(() => new RegExp(match[1]!, 'v')).not.toThrow()
  }
})
function mount(stage: 'create' | 'READY' | 'SUBMITTED') {
  mocks.state = {
    authorName: ref('现有账号昵称'),
    options: ref({ categories: [], tags: [], maxArchiveBytes: 20 * 1024 * 1024,
      maxUnpackedBytes: 50 * 1024 * 1024, maxFiles: 500 }),
    draft: ref(['READY', 'SUBMITTED'].includes(stage)
      ? { draftId: '30', slug: 'test-skill', status: stage, skillId: '20', revision: 2 } : null),
    task: ref(null), publication: ref(null), submitIntent: ref(null),
    githubIntent: ref(null), sourceType: ref('ZIP'), sourceChanged: ref(false), waiting: ref(false),
    ready: ref(stage === 'READY'), hasUnsavedChanges: ref(false), githubInput: ref({ repositoryUrl: '', refType: 'AUTO', ref: '', directory: '' }),
    candidates: ref(null), candidatesLoading: ref(false), files: ref(null), filesLoading: ref(false),
    form: reactive({ name: '', summary: '', categoryId: '', tags: [], version: '1.0.0', releaseNotes: '',
      license: '', originalAuthor: '', sourceUrl: '', compatibility: '', dependencies: '',
      distributionAuthorized: false, declarationsConfirmed: false }),
    slug: ref(''), loading: ref(false), busy: ref(false),
    error: ref(''), notice: ref(''), editable: ref(stage === 'READY'), checking: ref(false),
  }
  const root = node('root'); app = renderer.createApp(Publish); app.provide(Vue.ssrContextKey, {})
  const passthrough = defineComponent({ inheritAttrs: false, setup: (_, { slots }) => () => slots.default?.() })
  for (const name of ['router-link', 'a-spin', 'a-tag', 'a-form', 'a-form-item', 'a-checkbox', 'a-radio-group', 'a-radio-button']) app.component(name, passthrough)
  app.component('a-modal', defineComponent({ render: () => null }))
  for (const name of ['a-button', 'a-alert', 'a-input', 'a-textarea', 'a-select', 'a-result']) {
    app.component(name, defineComponent({ setup: (_, { attrs, slots }) => () => h(name, attrs, slots.default?.()) }))
  }
  app.mount(root)
  return root
}
afterEach(() => { app?.unmount(); app = undefined; vi.unstubAllGlobals() })

it('仅未保存的发布编辑触发关闭提示，卸载时移除监听', () => {
  mount('READY')
  const listener = vi.mocked(window.addEventListener).mock.calls
    .find(([type]) => type === 'beforeunload')![1] as (event: BeforeUnloadEvent) => void
  const event = { preventDefault: vi.fn(), returnValue: undefined } as unknown as BeforeUnloadEvent
  listener(event)
  expect(event.preventDefault).not.toHaveBeenCalled()
  ;(mocks.state.hasUnsavedChanges as ReturnType<typeof ref<boolean>>).value = true
  listener(event)
  expect(event.preventDefault).toHaveBeenCalledOnce()
  expect(event.returnValue).toBe('')
  app?.unmount(); app = undefined
  expect(window.removeEventListener).toHaveBeenCalledWith('beforeunload', listener)
})

it.each([['create', '创建草稿'], ['READY', '确认声明并发布']] as const)(
  '%s阶段不依赖环境能力字段开放正常操作', (stage, label) => {
    const nodes = all(mount(stage))
    expect(nodes.some(item => item.props.message === '当前运行环境暂不支持发布')).toBe(false)
    const button = nodes.find(item => item.type === 'a-button' && text(item).includes(label))
    expect(button).toBeDefined()
    expect(Boolean(button?.props.disabled)).toBe(false)
  },
)

it('删除环境门槛后，已提交草稿仍不能重复发布', () => {
  const nodes = all(mount('SUBMITTED'))
  const button = nodes.find(item => item.type === 'a-button' && text(item).includes('确认声明并发布'))
  expect(Boolean(button?.props.disabled)).toBe(true)
})

it('新用户直接进入创建草稿，显示既有账号而不要求作者身份表单', () => {
  const root = mount('create')
  expect(text(root)).toContain('现有账号昵称')
  expect(text(root)).not.toContain('作者标识')
  expect(text(root)).not.toContain('确认公开身份')
  expect(all(root).some(item => item.type === 'a-button' && text(item).includes('创建草稿'))).toBe(true)
})
