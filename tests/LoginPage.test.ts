import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { AxiosError, type AxiosAdapter, type AxiosResponse } from 'axios'
import * as Vue from 'vue'
import { createRenderer, defineComponent, h, ssrContextKey, type App } from 'vue'
import { parse, compileScript, compileTemplate } from '@vue/compiler-sfc'
import { readFileSync } from 'node:fs'
import { setImmediate } from 'node:timers'
import request from '../src/api/request'
import { login } from '../src/api/user'
import LoginPage from '../src/views/login/LoginPage.vue'

const mocks = vi.hoisted(() => ({
  message: { error: vi.fn() }, replace: vi.fn(), reauth: vi.fn(),
  query: {} as Record<string, string>, context: null as Record<string, unknown> | null,
}))
vi.mock('ant-design-vue', () => ({ message: mocks.message }))
vi.mock('@/utils/auth', () => ({ getToken: () => null, clearAuth: vi.fn() }))
vi.mock('vue-router', () => ({ useRoute: () => ({ query: mocks.query }), useRouter: () => ({ replace: mocks.replace }) }))
vi.mock('@/stores/user', () => ({ useUserStore: () => ({ login, isLoggedIn: false }) }))
vi.mock('@/stores/tenant', () => ({ useTenantStore: () => ({ initialize: async () => {} }) }))
vi.mock('@/api/externalAuth', () => ({ getProviders: async () => [], reauthExternal: mocks.reauth }))
vi.mock('@/hooks/useExternalAuthFlow', async importOriginal => ({
  ...await importOriginal<typeof import('../src/hooks/useExternalAuthFlow')>(),
  cancelStoredFlows: async () => {}, readFlow: () => ({ flowId: 'flow', flowToken: 'proof' }),
  useExternalAuthFlow: () => ({ context: Vue.ref(mocks.context), load: async () => mocks.context }),
}))
vi.mock('@/components/auth/AuthShell.vue', () => ({ default: { setup: (_: unknown, ctx: { slots: { default?: () => unknown } }) => () => h('auth-shell', ctx.slots.default?.()) } }))
vi.mock('@/components/auth/ExternalProviderButtons.vue', () => ({ default: { render: () => h('providers') } }))
vi.mock('@/components/auth/ExternalAccountSummary.vue', () => ({ default: { render: () => h('summary') } }))
vi.mock('@/components/auth/RecentPasswordVerifyModal.vue', () => ({ default: { render: () => h('verify-modal') } }))

const closedMessage = '您的账号已于2026年10月05日申请并完成了注销，感谢您使用 Verse，祝您生活愉快！'
let payload: { code: string; message: string | null; data: unknown }
let status: number
const adapter = vi.fn<AxiosAdapter>(async config => {
  const response: AxiosResponse = { data: payload, config, status, statusText: '', headers: {} }
  if (status >= 400) throw new AxiosError(`Request failed with status code ${status}`, 'ERR_BAD_REQUEST', config, undefined, response)
  return response
})

// 沿用仓库的 Vue 原生渲染 fixture，执行真实登录页提交和错误分支。
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
const filename = new URL('../src/views/login/LoginPage.vue', import.meta.url)
const { descriptor } = parse(readFileSync(filename, 'utf8'), { filename: filename.pathname })
const script = compileScript(descriptor, { id: 'login-page-test' })
const template = compileTemplate({ source: descriptor.template!.content, filename: filename.pathname, id: 'login-page-test', compilerOptions: { bindingMetadata: script.bindings } })
if (template.errors.length) throw new Error(String(template.errors))
const renderCode = template.code.replace(/import \{([^}]+)\} from "vue"/g, (_, names: string) => 'const {' + names.replace(/ as /g, ': ') + '} = Vue')
  .replace('export function render', 'return function render')
LoginPage.render = new Function('Vue', renderCode)(Vue)
function all(target: HostNode, predicate: (value: HostNode) => boolean): HostNode[] {
  return [...(predicate(target) ? [target] : []), ...target.children.flatMap(child => all(child, predicate))]
}
let app: App | undefined
let root: HostNode
async function settle() { for (let i = 0; i < 5; i++) await new Promise<void>(resolve => setImmediate(resolve)) }
async function mount() {
  root = node('root'); app = renderer.createApp(LoginPage); app.provide(ssrContextKey, {})
  for (const tag of ['a-alert', 'a-form', 'a-form-item', 'a-input', 'a-input-password', 'a-button', 'a-divider', 'a-modal']) {
    app.component(tag, defineComponent({ inheritAttrs: false, setup(_, { attrs, slots }) { return () => h(tag, attrs, slots.default?.()) } }))
  }
  app.component('router-link', defineComponent({ setup(_, { slots }) { return () => h('link', slots.default?.({ href: '/', navigate: () => {} })) } }))
  app.mount(root); await settle()
}
async function submit() {
  const form = all(root, item => item.type === 'a-form')[0]!
  Object.assign(form.props.model, { username: 'closed-user', password: 'test-password' })
  await form.props.onFinish(); await settle()
}
const alerts = () => all(root, item => item.props.role === 'alert')
beforeEach(() => {
  vi.clearAllMocks(); mocks.query = {}; mocks.context = null
  request.defaults.adapter = adapter; status = 200
  payload = { code: 'B000218', message: closedMessage, data: null }
  vi.stubGlobal('window', { location: { pathname: '/login' }, addEventListener: vi.fn(), removeEventListener: vi.fn() })
})
afterEach(() => { app?.unmount(); app = undefined; vi.unstubAllGlobals() })

it.each([200, 400, 401])('注销账号登录（HTTP %s）只在业务区显示标题和完整说明', async httpStatus => {
  status = httpStatus; await mount(); await submit()
  expect(alerts()).toHaveLength(1)
  expect(alerts()[0]?.props).toMatchObject({ message: '账号已注销', description: closedMessage })
  expect(all(root, item => item.type === 'a-modal')).toHaveLength(0)
  expect(adapter.mock.calls[0]?.[0].silentError).toBe(true)
  expect(mocks.message.error).not.toHaveBeenCalled()
  expect(mocks.replace).not.toHaveBeenCalled()
})
it.each([200, 400])('普通登录错误（HTTP %s）同样只显示一次', async httpStatus => {
  status = httpStatus; payload = { code: 'B000206', message: '密码错误', data: null }
  await mount(); await submit()
  expect(alerts()).toHaveLength(1)
  expect(alerts()[0]?.props).toMatchObject({ message: '密码错误', description: undefined })
  expect(mocks.message.error).not.toHaveBeenCalled()
})
it('网络错误只显示在登录业务区', async () => {
  adapter.mockImplementationOnce(async config => { throw new AxiosError('Network Error', 'ERR_NETWORK', config) })
  await mount(); await submit()
  expect(alerts()).toHaveLength(1)
  expect(alerts()[0]?.props.message).toBe('Network Error')
  expect(mocks.message.error).not.toHaveBeenCalled()
})
it('重新登录清除注销标题，成功登录清除错误并跳转', async () => {
  await mount(); await submit()
  payload = { code: 'B000206', message: '密码错误', data: null }; await submit()
  expect(alerts()[0]?.props).toMatchObject({ message: '密码错误', description: undefined })
  payload = { code: '0', message: null, data: { token: 'new-session' } }; await submit()
  expect(alerts()).toHaveLength(0)
  expect(mocks.replace).toHaveBeenCalledWith('/dashboard')
  expect(mocks.message.error).not.toHaveBeenCalled()
})
it('登录后绑定验证失败只显示业务区错误', async () => {
  mocks.query = { flow: 'flow' }; mocks.context = { flowId: 'flow', provider: 'github', stage: 'EXISTING_ACCOUNT_LOGIN' }
  payload = { code: '0', message: null, data: { token: 'new-session' } }
  mocks.reauth.mockRejectedValueOnce(new Error('绑定验证失败'))
  await mount(); await submit()
  expect(mocks.reauth).toHaveBeenCalled()
  expect(alerts()).toHaveLength(1)
  expect(alerts()[0]?.props.message).toBe('绑定验证失败')
  expect(mocks.message.error).not.toHaveBeenCalled()
})
it('其他未静默处理的请求仍显示全局业务错误', async () => {
  await expect(request.get('/users/me')).rejects.toMatchObject({ code: 'B000218' })
  expect(mocks.message.error).toHaveBeenCalledExactlyOnceWith(closedMessage)
})
