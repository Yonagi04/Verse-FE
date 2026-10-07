import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { AxiosAdapter } from 'axios'
import * as Vue from 'vue'
import { createRenderer, defineComponent, h, reactive, ssrContextKey, type App } from 'vue'
import { parse, compileScript, compileTemplate } from '@vue/compiler-sfc'
import { readFileSync } from 'node:fs'
import { setImmediate } from 'node:timers'
import request from '../src/api/request'
import DetailDrawer from '../src/views/llm-service/LlmServiceDetailDrawer.vue'
import EditDrawer from '../src/views/llm-service/LlmServiceEditDrawer.vue'
import type { LlmServiceInfo, LlmServiceInfoRespDTO } from '../src/types/llmService'

const mocks = vi.hoisted(() => ({ message: { error: vi.fn(), success: vi.fn() } }))
vi.mock('ant-design-vue', () => ({ message: mocks.message }))
vi.mock('@ant-design/icons-vue', () => ({ CopyOutlined: { render: () => null } }))
vi.mock('@/utils/auth', () => ({ getToken: () => null, clearAuth: vi.fn() }))
vi.mock('@/stores/playground', () => ({ usePlaygroundStore: () => ({ tenantId: 'tenant', status: { enabled: false } }) }))
vi.mock('@/components/ProviderLogo.vue', () => ({ default: { render: () => null } }))
vi.mock('@/views/llm-service/components/ModelTagList.vue', () => ({ default: { render: () => null } }))
vi.mock('@/views/llm-service/components/ModelMetadataFields.vue', () => ({ default: { render: () => null } }))
vi.mock('@/views/llm-service/components/PlaygroundCapabilityFields.vue', () => ({ default: { render: () => null } }))
vi.mock('@/views/llm-service/components/PricingFormSection.vue', () => ({ default: { render: () => null } }))

const models: LlmServiceInfo[] = Array.from({ length: 205 }, (_, index) => ({
  serviceId: String(index + 1), name: `model-${index + 1}`, provider: 'openai',
  modelName: 'upstream', status: index === 150 ? 0 : 1, createdByUsername: 'owner',
}))
const detail: LlmServiceInfoRespDTO = {
  ...models[0]!, apiUrl: 'https://example.test/v1', apiKey: 'masked', description: '模型介绍',
  rateLimitRpm: 10, rateLimitTpm: null, fallbackServiceId: '205', createTime: '2026-10-07T12:00:00',
  tagCodes: [], contextWindow: 8192, maxOutputTokens: 2048, pricing: { enabled: false },
}
let failedPage: number | undefined
const adapter = vi.fn<AxiosAdapter>(async config => {
  let data: unknown
  let code = '0'
  if (config.url?.endsWith('/list')) {
    const { pageNum, pageSize } = config.params as { pageNum: number; pageSize: number }
    if (pageSize > 100 || pageNum === failedPage) code = 'A000001'
    data = {
      serviceInfoList: models.slice((pageNum - 1) * pageSize, pageNum * pageSize),
      total: models.length, totalPages: Math.ceil(models.length / pageSize), page: pageNum, pageSize,
    }
  } else if (config.url?.includes('/info/')) data = detail
  else data = []
  return { data: { code, message: code === '0' ? null : '分页读取失败', data }, config, status: 200, statusText: '', headers: {} }
})

// 沿用 Vue 原生渲染 fixture，验证抽屉真实加载流程和模板，不增加 DOM 测试依赖。
interface HostNode { type: string; text: string; props: Record<string, any>; children: HostNode[]; parent: HostNode | null }
const node = (type: string, text = ''): HostNode => ({ type, text, props: {}, children: [], parent: null })
const renderer = createRenderer<HostNode, HostNode>({
  createElement: type => node(type), createText: text => node('text', text), createComment: text => node('comment', text),
  setText: (target, text) => { target.text = text }, setElementText: (target, text) => { target.text = text; target.children = [] },
  parentNode: target => target.parent, nextSibling: target => target.parent?.children[target.parent.children.indexOf(target) + 1] ?? null,
  patchProp: (target, key, _old, value) => { target.props[key] = value },
  insert(target, parent, anchor = null) {
    if (target.parent) target.parent.children.splice(target.parent.children.indexOf(target), 1)
    target.parent = parent
    const index = anchor ? parent.children.indexOf(anchor) : -1
    parent.children.splice(index < 0 ? parent.children.length : index, 0, target)
  },
  remove(target) { if (target.parent) target.parent.children.splice(target.parent.children.indexOf(target), 1); target.parent = null },
})
for (const [component, name] of [[DetailDrawer, 'LlmServiceDetailDrawer'], [EditDrawer, 'LlmServiceEditDrawer']] as const) {
  const filename = new URL(`../src/views/llm-service/${name}.vue`, import.meta.url)
  const { descriptor } = parse(readFileSync(filename, 'utf8'), { filename: filename.pathname })
  const script = compileScript(descriptor, { id: name })
  const template = compileTemplate({ source: descriptor.template!.content, filename: filename.pathname, id: name, compilerOptions: { bindingMetadata: script.bindings } })
  if (template.errors.length) throw new Error(String(template.errors))
  const code = template.code.replace(/import \{([^}]+)\} from "vue"/g, (_, names: string) => 'const {' + names.replace(/ as /g, ': ') + '} = Vue')
    .replace('export function render', 'return function render')
  component.render = new Function('Vue', code)(Vue)
}
function all(target: HostNode, predicate: (value: HostNode) => boolean): HostNode[] {
  return [...(predicate(target) ? [target] : []), ...target.children.flatMap(child => all(child, predicate))]
}
let app: App | undefined
let root: HostNode
async function settle() { for (let i = 0; i < 5; i++) await new Promise<void>(resolve => setImmediate(resolve)) }
async function mount(component: typeof DetailDrawer | typeof EditDrawer) {
  const props = reactive({ visible: false, tenantId: 'tenant', record: models[0]! })
  root = node('root')
  app = renderer.createApp(defineComponent({ setup: () => () => h(component, props) }))
  app.provide(ssrContextKey, {})
  for (const tag of ['a-drawer', 'a-spin', 'a-form', 'a-form-item', 'a-input', 'a-textarea', 'a-input-password', 'a-input-number', 'a-switch', 'a-select', 'a-select-option', 'a-button', 'a-tag', 'a-empty']) {
    app.component(tag, defineComponent({ inheritAttrs: false, setup(_, { attrs, slots }) { return () => h(tag, attrs, slots.default?.()) } }))
  }
  app.mount(root)
  props.visible = true
  await settle()
}
const listCalls = () => adapter.mock.calls.map(([config]) => config).filter(config => config.url?.endsWith('/list'))
beforeEach(() => { vi.clearAllMocks(); failedPage = undefined; request.defaults.adapter = adapter })
afterEach(() => { app?.unmount(); app = undefined })

it('详情抽屉使用合法分页展示第 3 页的备用模型名称', async () => {
  await mount(DetailDrawer)
  expect(all(root, item => item.text === 'model-205')).toHaveLength(1)
  expect(all(root, item => item.text === '模型介绍')).toHaveLength(2)
  expect(listCalls().map(call => call.params)).toEqual([
    { pageNum: 1, pageSize: 100 }, { pageNum: 2, pageSize: 100 }, { pageNum: 3, pageSize: 100 },
  ])
  expect(mocks.message.error).not.toHaveBeenCalled()
})

it('编辑抽屉填充详情，并保留后续页选项、排除自身及停用状态', async () => {
  await mount(EditDrawer)
  expect(all(root, item => item.type === 'a-form')[0]?.props.model).toMatchObject({ name: 'model-1', apiUrl: detail.apiUrl, description: detail.description })
  const options = all(root, item => item.type === 'a-select-option')
  expect(options.find(option => option.props.value === '205')?.props.disabled).toBe(false)
  expect(options.find(option => option.props.value === '151')?.props.disabled).toBe(true)
  expect(options.some(option => option.props.value === '1')).toBe(false)
  expect(all(root, item => item.type === 'a-select')[0]?.props.value).toBe('205')
  expect(listCalls()).toHaveLength(3)
  expect(mocks.message.error).not.toHaveBeenCalled()
})

it.each([DetailDrawer, EditDrawer])('中间页失败不采用部分备用模型列表，结束加载并显示请求错误', async component => {
  failedPage = 2
  await mount(component)
  expect(listCalls()).toHaveLength(2)
  expect(all(root, item => item.type === 'a-spin')[0]?.props.spinning).toBe(false)
  expect(all(root, item => item.text === 'model-205')).toHaveLength(0)
  expect(mocks.message.error).toHaveBeenCalledExactlyOnceWith('分页读取失败')
})
