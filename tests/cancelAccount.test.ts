import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { AxiosError, type AxiosAdapter, type AxiosResponse } from 'axios'
import * as Vue from 'vue'
import { createRenderer, defineComponent, h, reactive, ssrContextKey, type App } from 'vue'
import { parse, compileScript, compileTemplate } from '@vue/compiler-sfc'
import { readFileSync } from 'node:fs'
import { setImmediate } from 'node:timers'
import request from '../src/api/request'
import { useCancelAccount } from '../src/hooks/useCancelAccount'
import CancelAccountModal from '../src/views/user/CancelAccountModal.vue'

const messages = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }))
vi.mock('ant-design-vue', () => ({ message: messages }))
vi.mock('@/utils/auth', () => ({ getToken: () => null, clearAuth: vi.fn() }))
vi.mock('@ant-design/icons-vue', () => ({ CloseOutlined: { render: () => h('icon') }, ReloadOutlined: { render: () => h('icon') } }))
const handoverMessage = '您仍担任以下团体租户的超级管理员，请先完成租户交接后再注销：停用租户测试、停用租户测试、加入需要审批'
let payload: { code: string; message: string | null; data: unknown }
let httpFailure: boolean
const adapter = vi.fn<AxiosAdapter>(async config => {
  const response: AxiosResponse = { data: payload, config, status: httpFailure ? 400 : 200, statusText: '', headers: {} }
  if (httpFailure) throw new AxiosError('Request failed with status code 400', undefined, config, undefined, response)
  return response
})
const flows: ReturnType<typeof useCancelAccount>[] = []
let app: App | undefined
beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
  request.defaults.adapter = adapter
  payload = { code: 'B000224', message: handoverMessage, data: null }
  httpFailure = false
})
afterEach(() => { app?.unmount(); app = undefined; flows.splice(0).forEach(flow => flow.cleanup()); vi.useRealTimers() })
function flow() { const result = useCancelAccount(); flows.push(result); return result }

it('预检查保留完整租户名称，并抑制全局错误提示', async () => {
  const state = flow()
  expect(await state.fetchPrepare()).toBe(false)
  expect(state.error.value).toBe(handoverMessage)
  expect(state.handoverRequired.value).toBe(true)
  expect(state.prepareData.value).toBeNull()
  expect(adapter.mock.calls[0]?.[0].silentError).toBe(true)
  expect(messages.error).not.toHaveBeenCalled()
})
it('发送和确认时新出现的交接限制同样保留在弹窗状态，不启动验证码倒计时', async () => {
  const state = flow()
  expect(await state.sendCode()).toBe(false)
  expect(state.countdown.value).toBe(0)
  expect(await state.confirm('123456')).toBe(false)
  expect(state.error.value).toBe(handoverMessage)
  expect(state.handoverRequired.value).toBe(true)
  expect(adapter.mock.calls.every(([config]) => config.silentError)).toBe(true)
  expect(messages.error).not.toHaveBeenCalled()
  expect(messages.success).not.toHaveBeenCalled()
})
it('HTTP 错误优先显示服务端交接提示，而非 Axios 通用状态文本', async () => {
  httpFailure = true
  const state = flow()
  expect(await state.fetchPrepare()).toBe(false)
  expect(state.error.value).toBe(handoverMessage)
  expect(state.handoverRequired.value).toBe(true)
  expect(messages.error).not.toHaveBeenCalled()
})
it('交接后重新检查会清除旧错误并恢复注销准备数据', async () => {
  const state = flow()
  await state.fetchPrepare()
  payload = { code: '0', message: null, data: { warningDescription: '注销不可恢复', warningTips: ['退出所有租户'] } }
  expect(await state.fetchPrepare()).toBe(true)
  expect(state.error.value).toBe('')
  expect(state.handoverRequired.value).toBe(false)
  expect(state.prepareData.value?.warningDescription).toBe('注销不可恢复')
})
it('验证码限频和成功仍启动倒计时，其余失败保留具体错误且允许重试', async () => {
  const state = flow()
  payload = { code: 'B000211', message: '验证码发送过于频繁', data: null }
  expect(await state.sendCode()).toBe(false)
  expect(state.countdown.value).toBe(60)
  expect(state.handoverRequired.value).toBe(false)
  state.reset()
  payload = { code: 'B000212', message: '验证码错误', data: null }
  expect(await state.confirm('000000')).toBe(false)
  expect(state.error.value).toBe('验证码错误')
  expect(state.countdown.value).toBe(0)
  payload = { code: '0', message: null, data: true }
  expect(await state.sendCode()).toBe(true)
  expect(state.countdown.value).toBe(60)
  expect(state.error.value).toBe('')
  expect(messages.success).toHaveBeenCalledOnce()
})
it('关闭后重置清除交接提示，不把上次错误带入下一次打开', async () => {
  const state = flow(); await state.fetchPrepare(); state.reset()
  expect(state.error.value).toBe('')
  expect(state.handoverRequired.value).toBe(false)
})

// 沿用仓库的 Vue 原生渲染 fixture，验证真实弹窗分支和按钮交互，无需新增 DOM 依赖。
interface HostNode { type: string; text: string; props: Record<string, unknown>; children: HostNode[]; parent: HostNode | null }
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
const filename = new URL('../src/views/user/CancelAccountModal.vue', import.meta.url)
const { descriptor } = parse(readFileSync(filename, 'utf8'), { filename: filename.pathname })
const script = compileScript(descriptor, { id: 'cancel-account-test' })
const template = compileTemplate({ source: descriptor.template!.content, filename: filename.pathname, id: 'cancel-account-test', compilerOptions: { bindingMetadata: script.bindings } })
if (template.errors.length) throw new Error(String(template.errors))
const renderCode = template.code.replace(/import \{([^}]+)\} from "vue"/g, (_, names: string) => 'const {' + names.replace(/ as /g, ': ') + '} = Vue')
  .replace('export function render', 'return function render')
CancelAccountModal.render = new Function('Vue', renderCode)(Vue)
function all(target: HostNode, predicate: (value: HostNode) => boolean): HostNode[] {
  return [...(predicate(target) ? [target] : []), ...target.children.flatMap(child => all(child, predicate))]
}
function text(target: HostNode): string { return target.text + target.children.map(text).join('') }
async function settle() { for (let i = 0; i < 5; i++) await new Promise<void>(resolve => setImmediate(resolve)) }
it('注销用户弹窗显示完整交接提示，隐藏注销表单，重新检查成功后恢复', async () => {
  const root = node('root'), props = reactive({ visible: false, phone: '13012345678' })
  app = renderer.createApp({ render: () => h(CancelAccountModal, props) }); app.provide(ssrContextKey, {})
  for (const tag of ['a-modal', 'a-button', 'a-skeleton', 'a-form', 'a-form-item', 'a-input', 'a-checkbox']) {
    app.component(tag, defineComponent({ inheritAttrs: false, setup(_, { attrs, slots }) { return () => h(tag, attrs, slots.default?.()) } }))
  }
  app.mount(root); props.visible = true; await settle()
  expect(text(root)).toContain('注销用户')
  expect(all(root, item => item.props.role === 'alert').map(text)).toEqual([handoverMessage])
  expect(all(root, item => item.type === 'a-form')).toHaveLength(0)
  expect(messages.error).not.toHaveBeenCalled()
  payload = { code: '0', message: null, data: { warningDescription: '注销不可恢复', warningTips: [] } }
  const retry = all(root, item => item.type === 'a-button' && text(item).includes('重新检查'))[0]!
  await (retry.props.onClick as () => Promise<void>)(); await settle()
  expect(all(root, item => item.type === 'a-form')).toHaveLength(1)
  expect(text(root)).not.toContain(handoverMessage)
})
