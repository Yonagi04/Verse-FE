import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import * as Vue from 'vue'
import { createRenderer, defineComponent, h, reactive, ssrContextKey, nextTick, type App } from 'vue'
import { parse, compileScript, compileTemplate } from '@vue/compiler-sfc'
import { readFileSync } from 'node:fs'
import Status from '../src/views/llm-service/components/LlmCostBudgetStatus.vue'
const mocks = vi.hoisted(() => ({ get: vi.fn(), store: { currentTenantId: 't1', currentRole: 'ADMIN' } }))
vi.mock('@/api/llmCostBudget', () => ({ getLlmCostStatus: mocks.get }))
vi.mock('@/stores/tenant', () => ({ useTenantStore: () => reactive(mocks.store) }))
vi.mock('@/components/cost-budget/CostBudgetPeriodCard.vue', () => ({ default: { inheritAttrs: false, setup(_: unknown, { attrs }: { attrs: Record<string, unknown> }) { return () => h('period-card', attrs) } } }))
interface HostNode { type: string; text: string; props: Record<string, unknown>; children: HostNode[]; parent: HostNode | null }
const node = (type: string, text = ''): HostNode => ({ type, text, props: {}, children: [], parent: null })
const renderer = createRenderer<HostNode, HostNode>({
  createElement: type => node(type), createText: text => node('text', text), createComment: text => node('comment', text),
  setText: (target, text) => { target.text = text }, setElementText: (target, text) => { target.text = text; target.children = [] },
  parentNode: target => target.parent, nextSibling: target => target.parent?.children[target.parent.children.indexOf(target) + 1] ?? null,
  patchProp: (target, key, _old, value) => { target.props[key] = value },
  insert(target, parent, anchor = null) { target.parent = parent; const index = anchor ? parent.children.indexOf(anchor) : -1; parent.children.splice(index < 0 ? parent.children.length : index, 0, target) },
  remove(target) { if (target.parent) target.parent.children.splice(target.parent.children.indexOf(target), 1); target.parent = null },
})
const filename = new URL('../src/views/llm-service/components/LlmCostBudgetStatus.vue', import.meta.url)
const { descriptor } = parse(readFileSync(filename, 'utf8'), { filename: filename.pathname })
const script = compileScript(descriptor, { id: 'status' })
const template = compileTemplate({ source: descriptor.template!.content, filename: filename.pathname, id: 'status', compilerOptions: { bindingMetadata: script.bindings } })
if (template.errors.length) throw new Error(String(template.errors))
const code = template.code.replace(/import \{([^}]+)\} from "vue"/g, (_, names: string) => 'const {' + names.replace(/ as /g, ': ') + '} = Vue').replace('export function render', 'return function render')
Status.render = new Function('Vue', code)(Vue)
const full = { serviceId: '10', visibility: 'FULL', budgetState: 'AVAILABLE', retryAt: null, timezone: 'Asia/Shanghai', asOf: '2026-10-11T00:00:00+08:00', limits: [], availability: 'READY', costLimit: { enabled: true }, costWarning: { enabled: true, effective: true, thresholdPercent: 80, channels: ['EMAIL'] }, periods: [] }
const summary = { serviceId: '10', visibility: 'SUMMARY', budgetState: 'LIMITED', retryAt: '2026-10-12T00:00:00+08:00', timezone: 'Asia/Shanghai', asOf: full.asOf, limits: [], message: '请联系管理员' }
let app: App | undefined, root: HostNode
const text = (n: HostNode): string => n.text + n.children.map(text).join(' ')
const all = (n: HostNode, type: string): HostNode[] => [...(n.type === type ? [n] : []), ...n.children.flatMap(child => all(child, type))]
async function settle() { await Promise.resolve(); await nextTick(); await Promise.resolve(); await nextTick() }
async function mount() {
  root = node('root'); app = renderer.createApp(defineComponent({ setup: () => () => h(Status, { tenantId: 't1', serviceId: '10', visible: true }) }))
  app.provide(ssrContextKey, {})
  for (const tag of ['a-button','a-tag','a-alert','a-skeleton','a-empty']) app.component(tag, defineComponent({ inheritAttrs: false, setup(_, { attrs, slots }) { return () => h(tag,attrs,slots.default?.()) } }))
  app.mount(root); await settle()
}
beforeEach(() => { vi.resetAllMocks(); Object.assign(reactive(mocks.store), { currentTenantId: 't1', currentRole: 'ADMIN' }) })
afterEach(() => { app?.unmount(); app = undefined })
it('角色降级立即清除 FULL，再展示独立 SUMMARY', async () => {
  mocks.get.mockResolvedValueOnce(full).mockResolvedValueOnce(summary)
  await mount(); expect(text(root)).toContain('80%'); expect(text(root)).toContain('邮件'); expect(text(root)).not.toContain('EMAIL')
  reactive(mocks.store).currentRole = 'MEMBER'; await settle()
  expect(text(root)).not.toContain('80%'); expect(text(root)).not.toContain('预警渠道'); expect(text(root)).toContain('请联系管理员')
})
it('迟到的 FULL 不能覆盖角色变化后的 SUMMARY', async () => {
  let resolveOld!: (value: unknown) => void
  mocks.get.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve })).mockResolvedValueOnce(summary)
  await mount(); reactive(mocks.store).currentRole = 'MEMBER'; await settle()
  resolveOld(full); await settle()
  expect(text(root)).not.toContain('EMAIL'); expect(text(root)).toContain('请联系管理员')
})
it('租户变化立即清空详情；请求失败不展示零费用或可用状态', async () => {
  mocks.get.mockResolvedValueOnce(full); await mount()
  reactive(mocks.store).currentTenantId = 't2'; await settle()
  expect(text(root)).not.toContain('EMAIL'); expect(mocks.get).toHaveBeenCalledTimes(1)
})
it('按日周月排序，UNKNOWN 即使费用已就绪也不绘制金额和进度', async () => {
  mocks.get.mockResolvedValue({ ...full, budgetState: 'UNKNOWN', periods: [{ period: 'MONTH' }, { period: 'DAY' }, { period: 'WEEK' }] })
  await mount()
  const cards = all(root, 'period-card')
  expect(cards.map(card => (card.props.period as { period: string }).period)).toEqual(['DAY', 'WEEK', 'MONTH'])
  expect(cards.every(card => card.props['data-ready'] === false)).toBe(true)
  expect(text(root)).toContain('预算校验暂不可用')
})
it('成员摘要展示全部命中周期和后端恢复时间，不展示费用和预警', async () => {
  mocks.get.mockResolvedValue({ ...summary, limits: [{ period: 'DAY' }, { period: 'WEEK' }, { period: 'DAY' }] })
  await mount()
  expect(text(root)).toContain('日限额')
  expect(text(root)).toContain('周限额')
  expect(text(root)).toContain('2026-10-12 00:00:00（GMT+8）')
  expect(all(root, 'period-card')).toHaveLength(0)
  expect(text(root)).not.toContain('预警渠道')
  expect(text(root)).not.toContain('周期费用')
})
it('刷新失败清除旧费用，明确提示重试，不显示可用余额', async () => {
  mocks.get.mockResolvedValueOnce({ ...full, periods: [{ period: 'DAY' }] }).mockRejectedValueOnce(new Error('offline'))
  await mount()
  expect(all(root, 'period-card')).toHaveLength(1)
  ;(all(root, 'a-button')[0]!.props.onClick as () => void)()
  await settle()
  expect(all(root, 'period-card')).toHaveLength(0)
  expect(all(root, 'a-alert')[0]!.props.message).toBe('成本状态暂不可获取')
  expect(text(root)).not.toContain('限额生效中')
})
