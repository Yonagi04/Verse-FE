import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as Vue from 'vue'
import { createRenderer, defineComponent, h, reactive, ssrContextKey, type App } from 'vue'
import { parse, compileScript, compileTemplate } from '@vue/compiler-sfc'
import { readFileSync } from 'node:fs'
import { setImmediate } from 'node:timers'
import ExternalFlowPage from '../src/views/external-auth/ExternalFlowPage.vue'
import { readFlow, saveFlow } from '../src/hooks/useExternalAuthFlow'
import type { ExternalFlowContext } from '../src/types/externalAuth'

const mocks = vi.hoisted(() => ({
  getFlow: vi.fn(), cancelFlow: vi.fn(), acknowledgeFlow: vi.fn(), confirmExternalBinding: vi.fn(),
  completeExternalLogin: vi.fn(), startExternalLogin: vi.fn(), replace: vi.fn(),
  message: { error: vi.fn(), success: vi.fn() }, token: 'session-one',
  route: {} as { path: string; fullPath: string; query: Record<string, string>; meta: Record<string, unknown> },
  user: { user: { userId: 'verse-user' } },
}))
vi.mock('@/api/externalAuth', () => mocks)
vi.mock('@/utils/auth', () => ({ getToken: () => mocks.token }))
vi.mock('@/stores/user', () => ({ useUserStore: () => mocks.user }))
vi.mock('@/stores/tenant', () => ({ useTenantStore: () => ({}) }))
vi.mock('vue-router', () => ({ useRoute: () => mocks.route, useRouter: () => ({ replace: mocks.replace }) }))
vi.mock('ant-design-vue', () => ({ message: mocks.message }))
vi.mock('@/components/auth/AuthShell.vue', () => ({ default: { setup: (_: unknown, ctx: { slots: { default?: () => unknown } }) => () => h('auth-shell', ctx.slots.default?.()) } }))
vi.mock('@/components/auth/ExternalAccountSummary.vue', () => ({ default: { render: () => h('account-summary') } }))
vi.mock('@/components/auth/RegistrationFields.vue', () => ({ default: { render: () => h('registration-fields') } }))

class MemoryStorage {
  private data = new Map<string, string>()
  get length() { return this.data.size }
  key(index: number) { return Array.from(this.data.keys())[index] ?? null }
  getItem(key: string) { return this.data.get(key) ?? null }
  setItem(key: string, value: string) { this.data.set(key, value) }
  removeItem(key: string) { this.data.delete(key) }
}

// 用 Vue 的真实渲染和生命周期验证回调页面，无需浏览器 DOM 或新增测试依赖。
interface HostNode { type: string; text: string; props: Record<string, any>; children: HostNode[]; parent: HostNode | null }
const node = (type: string, text = ''): HostNode => ({ type, text, props: {}, children: [], parent: null })
const renderer = createRenderer<HostNode, HostNode>({
  createElement: type => node(type), createText: text => node('text', text), createComment: text => node('comment', text),
  setText: (target, text) => { target.text = text },
  setElementText: (target, text) => { target.text = text; target.children = [] },
  parentNode: target => target.parent,
  nextSibling: target => target.parent?.children[target.parent.children.indexOf(target) + 1] ?? null,
  patchProp: (target, key, _old, value) => { target.props[key] = value },
  insert(target, parent, anchor = null) {
    if (target.parent) target.parent.children.splice(target.parent.children.indexOf(target), 1)
    target.parent = parent
    const index = anchor ? parent.children.indexOf(anchor) : -1
    parent.children.splice(index < 0 ? parent.children.length : index, 0, target)
  },
  remove(target) {
    if (target.parent) target.parent.children.splice(target.parent.children.indexOf(target), 1)
    target.parent = null
  },
})
const element = (tag: string) => defineComponent({
  inheritAttrs: false,
  setup(_, { attrs, slots }) { return () => h(tag, attrs, slots.default?.()) },
})
// Vitest 的 Node 环境默认生成 SSR 模板；给真实 setup 配上客户端模板以执行交互。
const filename = new URL('../src/views/external-auth/ExternalFlowPage.vue', import.meta.url).pathname
const { descriptor } = parse(readFileSync(new URL('../src/views/external-auth/ExternalFlowPage.vue', import.meta.url), 'utf8'), { filename })
const script = compileScript(descriptor, { id: 'external-flow-test' })
const template = compileTemplate({ source: descriptor.template!.content, filename, id: 'external-flow-test', compilerOptions: { bindingMetadata: script.bindings } })
if (template.errors.length) throw new Error(String(template.errors))
const renderCode = template.code.replace(/import \{([^}]+)\} from "vue"/g, (_, names: string) => 'const {' + names.replace(/ as /g, ': ') + '} = Vue')
  .replace('export function render', 'return function render')
ExternalFlowPage.render = new Function('Vue', renderCode)(Vue)
let app: App | undefined
let root: HostNode
const id = 'a'.repeat(32)
const profile = '/profile?panel=profile'
function context(overrides: Partial<ExternalFlowContext> = {}): ExternalFlowContext {
  return {
    flowId: id, purpose: 'BIND', stage: 'FAILED', provider: 'feishu', externalAccount: null, accounts: [],
    registrationDefaults: null, targetAccount: { userId: 'verse-user', username: 'yonagi', nickname: '', avatar: null, status: 'NORMAL' },
    boundAccountCount: 0, expiresAt: new Date(Date.now() + 300000).toISOString(), errorReason: 'AUTHORIZATION_CANCELLED', completion: null,
    ...overrides,
  }
}
async function store(purpose: 'LOGIN' | 'BIND' = 'BIND', expiresAt = new Date(Date.now() + 600000).toISOString()) {
  await saveFlow({ flowId: id, flowToken: 'tab-proof', expiresAt, authorizationUrl: 'https://accounts.feishu.cn/' }, 'feishu', purpose)
}
async function settle() {
  for (let i = 0; i < 15; i++) await new Promise<void>(resolve => setImmediate(resolve))
}
async function mount() {
  root = node('root'); app = renderer.createApp(ExternalFlowPage)
  app.provide(ssrContextKey, {})
  for (const name of ['a-alert', 'a-spin', 'a-tag', 'a-radio-group', 'a-radio', 'a-form']) app.component(name, element(name))
  app.component('a-button', element('button'))
  app.mount(root)
  await settle()
}
function find(target: HostNode, predicate: (target: HostNode) => boolean): HostNode | undefined {
  if (predicate(target)) return target
  for (const child of target.children) { const found = find(child, predicate); if (found) return found }
}
function text(target: HostNode): string { return target.text + target.children.map(text).join('') }
beforeEach(() => {
  vi.resetAllMocks(); mocks.token = 'session-one'; mocks.user.user.userId = 'verse-user'
  mocks.route = reactive({ path: '/auth/external/callback', fullPath: '/auth/external/callback', query: {}, meta: { layout: 'auth' } })
  vi.stubGlobal('sessionStorage', new MemoryStorage())
  vi.stubGlobal('window', { location: { hash: '#flow=' + id, pathname: '/auth/external/callback', search: '', assign: vi.fn() },
    history: { state: {}, replaceState: vi.fn() }, addEventListener: vi.fn(), removeEventListener: vi.fn() })
  mocks.cancelFlow.mockResolvedValue(undefined); mocks.acknowledgeFlow.mockResolvedValue(undefined)
  mocks.replace.mockResolvedValue(undefined); mocks.getFlow.mockResolvedValue(context())
})
afterEach(() => { app?.unmount(); app = undefined; vi.useRealTimers(); vi.unstubAllGlobals() })

describe('已登录用户的外部账户绑定失败返回', () => {
  it.each([
    ['FAILED', 'AUTHORIZATION_CANCELLED', '已取消飞书授权'],
    ['FAILED', 'PROVIDER_RESPONSE_INVALID', '身份验证失败'],
    ['FAILED', 'PROVIDER_UNAVAILABLE', '暂时不可用'],
    ['EXPIRED', 'FLOW_EXPIRED', '认证已过期'],
    ['INVALIDATED', 'FLOW_STATE_CHANGED', '账号关联已变化'],
    ['CANCELLED', null, '绑定未完成'],
  ] as const)('%s / %s 自动返回个人信息并只显示一次 Toast', async (stage, errorReason, expected) => {
    await store(); mocks.getFlow.mockResolvedValue(context({ stage, errorReason }))
    await mount()
    expect(mocks.replace).toHaveBeenCalledExactlyOnceWith(profile)
    expect(mocks.message.error).toHaveBeenCalledExactlyOnceWith(expect.stringContaining(expected))
    expect(mocks.cancelFlow).toHaveBeenCalledWith(id, 'tab-proof')
    expect(sessionStorage.getItem('verse_external_flow:' + id)).toBeNull()
    expect(mocks.token).toBe('session-one')
    expect(mocks.startExternalLogin).not.toHaveBeenCalled()
    expect(find(root, target => target.type === 'auth-shell')).toBeUndefined()
  })
  it('普通外部登录拒绝授权继续在认证页显示错误，不触发绑定返回', async () => {
    await store('LOGIN'); mocks.getFlow.mockResolvedValue(context({ purpose: 'LOGIN', targetAccount: null }))
    await mount()
    expect(mocks.replace).not.toHaveBeenCalled(); expect(mocks.cancelFlow).not.toHaveBeenCalled()
    expect(mocks.message.error).not.toHaveBeenCalled()
    expect(find(root, target => target.type === 'a-alert')?.props.message).toContain('已取消外部平台授权')
    expect(find(root, target => target.type === 'auth-shell')).toBeDefined()
  })
  it('本地证明已过期仍能识别绑定场景并清理，不调用认证接口', async () => {
    await store('BIND', new Date(Date.now() - 1000).toISOString())
    await mount()
    expect(mocks.getFlow).not.toHaveBeenCalled()
    expect(mocks.replace).toHaveBeenCalledWith(profile)
    expect(mocks.message.error).toHaveBeenCalledWith(expect.stringContaining('过期'))
    expect(mocks.cancelFlow).toHaveBeenCalledWith(id, 'tab-proof')
  })
  it('回调没有合法 state 时，根据本标签页绑定场景返回', async () => {
    await store(); mocks.route.path = '/auth/external/error'; window.location.hash = ''
    await mount()
    expect(mocks.getFlow).not.toHaveBeenCalled()
    expect(mocks.replace).toHaveBeenCalledWith(profile)
    expect(mocks.message.error).toHaveBeenCalledWith(expect.stringContaining('无法确认这次外部授权'))
  })
  it('显式流程定位无证明时，不误用本标签页其他绑定流程', async () => {
    await store(); window.location.hash = '#flow=' + 'b'.repeat(32)
    await mount()
    expect(mocks.replace).not.toHaveBeenCalled(); expect(mocks.cancelFlow).not.toHaveBeenCalled()
    expect(readFlow(id).purpose).toBe('BIND')
  })
  it('绑定流程查询失败时仍根据本地场景返回并显示服务端原因', async () => {
    await store(); mocks.getFlow.mockRejectedValue(new Error('无法读取认证结果'))
    await mount()
    expect(mocks.replace).toHaveBeenCalledWith(profile)
    expect(mocks.message.error).toHaveBeenCalledExactlyOnceWith('无法读取认证结果')
  })
  it('登录会话变化后返回个人信息，不恢复旧账号绑定', async () => {
    await store(); mocks.token = 'another-session'
    await mount()
    expect(mocks.getFlow).not.toHaveBeenCalled()
    expect(mocks.replace).toHaveBeenCalledWith(profile)
    expect(mocks.message.error).toHaveBeenCalledWith(expect.stringContaining('登录会话已变化'))
  })
  it('取消接口失败不阻止返回，保留证明供下一次清理重试', async () => {
    await store(); mocks.cancelFlow.mockRejectedValue(new Error('network error'))
    await mount()
    expect(mocks.replace).toHaveBeenCalledWith(profile)
    expect(mocks.message.error).toHaveBeenCalledExactlyOnceWith(expect.stringContaining('已取消飞书授权'))
    expect(readFlow(id).flowToken).toBe('tab-proof')
  })
  it('取消请求未返回也立即回到个人信息，不让网络延迟阻塞错误提示', async () => {
    await store()
    let finishCancellation!: () => void
    mocks.cancelFlow.mockImplementation(() => new Promise<void>(resolve => { finishCancellation = resolve }))
    await mount()
    expect(mocks.replace).toHaveBeenCalledWith(profile)
    expect(mocks.message.error).toHaveBeenCalledExactlyOnceWith(expect.stringContaining('已取消飞书授权'))
    expect(readFlow(id).flowToken).toBe('tab-proof')
    finishCancellation(); await settle()
    expect(sessionStorage.getItem('verse_external_flow:' + id)).toBeNull()
  })
  it.each(['A002103', 'A002104', 'A002105'])('确认绑定失败 %s 返回个人信息并展示错误', async code => {
    await store(); mocks.route.path = '/profile/external-account/confirm'; mocks.route.meta.layout = 'app'
    mocks.getFlow.mockResolvedValue(context({ stage: 'BIND_CONFIRM_REQUIRED', errorReason: null }))
    mocks.confirmExternalBinding.mockRejectedValue(Object.assign(new Error('具体绑定错误'), { code }))
    await mount()
    const button = find(root, target => target.type === 'button' && text(target).includes('确认绑定'))!
    expect(button).toBeDefined(); await button.props.onClick(); await settle()
    expect(mocks.replace).toHaveBeenCalledExactlyOnceWith(profile)
    expect(mocks.message.error).toHaveBeenCalledExactlyOnceWith('具体绑定错误')
    expect(mocks.cancelFlow).toHaveBeenCalledWith(id, 'tab-proof')
    expect(mocks.token).toBe('session-one')
  })
  it('绑定已成功时，结果确认请求失败也不会被误报为绑定失败', async () => {
    await store(); mocks.route.path = '/profile/external-account/confirm'; mocks.route.meta.layout = 'app'
    mocks.getFlow.mockResolvedValue(context({ stage: 'BIND_CONFIRM_REQUIRED', errorReason: null }))
    mocks.confirmExternalBinding.mockResolvedValue({ outcome: 'BOUND' })
    mocks.acknowledgeFlow.mockRejectedValue(new Error('response lost'))
    await mount()
    const button = find(root, target => target.type === 'button' && text(target).includes('确认绑定'))!
    await button.props.onClick(); await settle()
    expect(mocks.replace).toHaveBeenCalledWith(profile)
    expect(mocks.message.error).not.toHaveBeenCalled()
    expect(mocks.message.success).toHaveBeenCalledWith('外部账户绑定成功')
    expect(readFlow(id).flowToken).toBe('tab-proof')
  })
  it('认证处理中查询失败同样返回个人信息', async () => {
    await store(); mocks.getFlow.mockResolvedValueOnce(context({ stage: 'AUTHENTICATING', errorReason: null })).mockRejectedValue(new Error('查询认证失败'))
    vi.useFakeTimers(); await mount(); await vi.advanceTimersByTimeAsync(1000); await settle()
    expect(mocks.replace).toHaveBeenCalledWith(profile)
    expect(mocks.message.error).toHaveBeenCalledWith('查询认证失败')
  })
  it('认证处理超过查询期限后返回个人信息，清理轮询定时器', async () => {
    await store(); mocks.getFlow.mockResolvedValue(context({ stage: 'AUTHENTICATING', errorReason: null }))
    vi.useFakeTimers()
    const startedAt = Date.now()
    vi.setSystemTime(startedAt)
    await mount()
    // 直接越过查询期限，再触发下一轮轮询。避免一次推进 16 秒时依赖
    // 多轮 setTimeout -> Promise -> setTimeout 在不同 CI 运行时中的排空顺序。
    vi.setSystemTime(startedAt + 15001)
    await vi.advanceTimersToNextTimerAsync()
    await settle()
    expect(mocks.replace).toHaveBeenCalledExactlyOnceWith(profile)
    expect(mocks.message.error).toHaveBeenCalledWith(expect.stringContaining('认证仍在处理中'))
    expect(vi.getTimerCount()).toBe(0)
  })
})
