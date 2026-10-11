import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import * as Vue from 'vue'
import { createRenderer, defineComponent, h, reactive, ssrContextKey, nextTick, type App } from 'vue'
import { parse, compileScript, compileTemplate } from '@vue/compiler-sfc'
import { readFileSync } from 'node:fs'
import { transpileModule, ScriptTarget } from 'typescript'
import Form from '../src/views/llm-service/components/LlmCostBudgetFormSection.vue'
import { emptyCostDraft } from '../src/utils/costBudget'
import { emptyWarning } from '../src/utils/llmCostBudget'
const mocks = vi.hoisted(() => ({ readiness: vi.fn() }))
vi.mock('@/api/llmCostBudget', () => ({ getCostNotificationReadiness: mocks.readiness }))
interface HostNode { type: string; text: string; props: Record<string, any>; children: HostNode[]; parent: HostNode | null }
const node = (type: string, text = ''): HostNode => ({ type, text, props: {}, children: [], parent: null })
const renderer = createRenderer<HostNode, HostNode>({
  createElement: type => node(type), createText: text => node('text', text), createComment: text => node('comment', text),
  setText: (target, text) => { target.text = text }, setElementText: (target, text) => { target.text = text; target.children = [] },
  parentNode: target => target.parent, nextSibling: target => target.parent?.children[target.parent.children.indexOf(target) + 1] ?? null,
  patchProp: (target, key, _old, value) => { target.props[key] = value },
  insert(target, parent, anchor = null) { if (target.parent) target.parent.children.splice(target.parent.children.indexOf(target), 1); target.parent = parent; const index = anchor ? parent.children.indexOf(anchor) : -1; parent.children.splice(index < 0 ? parent.children.length : index, 0, target) },
  remove(target) { if (target.parent) target.parent.children.splice(target.parent.children.indexOf(target), 1); target.parent = null },
})
const filename = new URL('../src/views/llm-service/components/LlmCostBudgetFormSection.vue', import.meta.url)
const { descriptor } = parse(readFileSync(filename, 'utf8'), { filename: filename.pathname })
const script = compileScript(descriptor, { id: 'costForm' })
const template = compileTemplate({ source: descriptor.template!.content, filename: filename.pathname, id: 'costForm', compilerOptions: { bindingMetadata: script.bindings } })
if (template.errors.length) throw new Error(String(template.errors))
const code = template.code.replace(/import \{([^}]+)\} from "vue"/g, (_, names: string) => 'const {' + names.replace(/ as /g, ': ') + '} = Vue').replace('export function render', 'return function render')
Form.render = new Function('Vue', transpileModule(code, { compilerOptions: { target: ScriptTarget.ES2022 } }).outputText)(Vue)
const ready = { channels: [], administrators: { total: 2, missingPhoneCount: 0, missingEmailCount: 0 }, asOf: '2026-10-11T12:00:00+08:00' }
let app: App | undefined, root: HostNode
const text = (n: HostNode): string => n.text + n.children.map(text).join(' ')
const all = (n: HostNode, type: string): HostNode[] => [...(n.type === type ? [n] : []), ...n.children.flatMap(child => all(child, type))]
async function settle() { await Promise.resolve(); await nextTick(); await Promise.resolve(); await nextTick() }
async function mount(enabled = true) {
  const props = reactive({ modelValue: { ...emptyCostDraft(), enabled, daily: '10' }, warning: { ...emptyWarning(), enabled: true, channels: ['EMAIL' as const] }, pricingEligible: true, tenantId: 't1', availability: 'READY' as 'READY' | 'INITIALIZING' | 'UNAVAILABLE' })
  root = node('root')
  app = renderer.createApp(defineComponent({ setup: () => () => h(Form, { ...props, 'onUpdate:modelValue': value => { props.modelValue = value }, 'onUpdate:warning': value => { props.warning = value } }) }))
  app.provide(ssrContextKey, {})
  for (const tag of ['a-switch', 'a-alert', 'a-form-item', 'a-input', 'a-slider', 'a-checkbox-group', 'a-checkbox']) app.component(tag, defineComponent({ inheritAttrs: false, setup(_, { attrs, slots }) { return () => h(tag, attrs, [...(slots.default?.() ?? []), ...(slots.description?.() ?? [])]) } }))
  app.mount(root); await settle()
  return props
}
const switchFor = (label: string) => all(root, 'a-switch').find(item => item.props['aria-label'] === label)!
beforeEach(() => { vi.resetAllMocks(); mocks.readiness.mockResolvedValue(ready) })
afterEach(() => { app?.unmount(); app = undefined })
it('关闭限额保留金额及预警草稿，再开启恢复输入，不清空阈值与渠道', async () => {
  const props = await mount()
  switchFor('开启成本限额').props['onUpdate:checked'](false); await settle()
  expect(all(root, 'a-input')).toHaveLength(0)
  expect(props.modelValue.daily).toBe('10')
  expect(props.warning.channels).toEqual(['EMAIL'])
  expect(text(root)).toContain('预警设置已保留，当前不生效')
  switchFor('开启成本限额').props['onUpdate:checked'](true); await settle()
  expect(all(root, 'a-input')[0]!.props.value).toBe('10')
  expect(all(root, 'a-slider')[0]!.props.value).toBe(80)
})
it('费用未就绪阻止新开启，但已有预算和预警仍可关闭', async () => {
  const props = await mount(false)
  expect(mocks.readiness).not.toHaveBeenCalled()
  props.availability = 'INITIALIZING'; await settle()
  expect(switchFor('开启成本限额').props.disabled).toBe(true)
  props.modelValue.enabled = true; await settle()
  expect(switchFor('开启成本限额').props.disabled).toBe(false)
  expect(switchFor('开启成本预警').props.disabled).toBe(false)
  expect(all(root, 'a-slider')[0]!.props.disabled).toBe(true)
})
it('预警渠道为空显示行内错误，达限通知独立显示固定开启', async () => {
  const props = await mount()
  all(root, 'a-checkbox-group')[0]!.props['onUpdate:value']([]); await settle()
  expect(props.warning.channels).toEqual([])
  expect(all(root, 'a-form-item').find(item => item.props.label === '阈值预警渠道')!.props.help).toBe('开启预警时至少选择一个渠道')
  expect(text(root)).toContain('固定开启')
  expect(text(root)).toContain('达限通知不受预警开关和预警渠道选择影响')
})
it('通知缺口以中文解释，不暴露原因码、不禁用预算输入', async () => {
  mocks.readiness.mockResolvedValue({ ...ready, channels: [{ channel: 'SMS', configured: false, reasonCode: 'TEMPLATE_MISSING' }], administrators: { total: 2, missingPhoneCount: 1, missingEmailCount: 2 } })
  await mount()
  expect(text(root)).toContain('短信：签名或通知模板缺失')
  expect(text(root)).toContain('1 位管理员未绑定可用手机号')
  expect(text(root)).not.toContain('TEMPLATE_MISSING')
  expect(all(root, 'a-input').every(item => !item.props.disabled)).toBe(true)
})
it('通知查询失败结束加载并明确提示，不影响编辑', async () => {
  mocks.readiness.mockRejectedValue(new Error('offline'))
  await mount()
  expect(all(root, 'a-alert').some(item => item.props.message === '通知能力暂不可查询')).toBe(true)
  expect(all(root, 'a-input')[0]!.props.disabled).toBeFalsy()
})
it('租户往返后丢弃迟到的通知能力结果', async () => {
  let resolveOld!: (value: unknown) => void
  mocks.readiness.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve }))
  const props = await mount()
  props.tenantId = 't2'; await settle()
  props.tenantId = 't1'; await settle()
  resolveOld({ ...ready, administrators: { total: 9, missingPhoneCount: 9, missingEmailCount: 9 } }); await settle()
  expect(text(root)).not.toContain('9 位管理员')
  expect(text(root)).toContain('覆盖 2 位有效管理员')
})
