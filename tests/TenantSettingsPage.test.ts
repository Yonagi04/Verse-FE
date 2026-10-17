import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import * as Vue from 'vue'
import { createRenderer, defineComponent, h, reactive, ssrContextKey, nextTick, type App } from 'vue'
import { parse, compileScript, compileTemplate } from '@vue/compiler-sfc'
import { readFileSync } from 'node:fs'
import { transpileModule, ScriptTarget } from 'typescript'
import Page from '../src/views/tenant/TenantSettingsTab.vue'
const mocks = vi.hoisted(() => ({ settings: vi.fn(), cost: vi.fn(), save: vi.fn(), ready: vi.fn(), success: vi.fn(), warning: vi.fn(), error: vi.fn(),
  tenant: { currentTenantId: '2', currentRole: 'ADMIN', settingsDirty: false, settingsSaving: false, fetchTenants: vi.fn(), registerSwitchGuard: vi.fn(() => vi.fn()) },
  user: { token: 'auth', user: { userId: '1' } } }))
vi.mock('@/api/tenant', () => ({ getTenantSettings: mocks.settings, getTenantCostStatus: mocks.cost, saveTenantSettings: mocks.save, getTenantCostReadiness: mocks.ready }))
vi.mock('@/stores/tenant', () => ({ useTenantStore: () => reactive(mocks.tenant) }))
vi.mock('@/stores/user', () => ({ useUserStore: () => reactive(mocks.user) }))
vi.mock('@/stores/playground', () => ({ usePlaygroundStore: () => ({ refresh: vi.fn().mockResolvedValue({}) }) }))
vi.mock('ant-design-vue', () => ({ message: { success: mocks.success, warning: mocks.warning, error: mocks.error } }))
vi.mock('@/views/tenant/components/TenantCostBudgetSection.vue', () => ({ default: { inheritAttrs: false, setup(_: unknown, { attrs }: { attrs: Record<string,unknown> }) { return () => h('budget-section',attrs) } } }))
vi.mock('@/views/tenant/components/TenantCostBudgetStatus.vue', () => ({ default: { inheritAttrs: false, setup(_: unknown, { attrs }: { attrs: Record<string,unknown> }) { return () => h('budget-status',attrs) } } }))
vi.mock('@/views/tenant/components/TenantSettingsConfirmationModal.vue', () => ({ default: { inheritAttrs: false, setup(_: unknown, { attrs }: { attrs: Record<string,unknown> }) { return () => h('confirmation',attrs) } } }))
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

const filename = new URL('../src/views/tenant/TenantSettingsTab.vue', import.meta.url)
const { descriptor } = parse(readFileSync(filename, 'utf8'), { filename: filename.pathname })
const script = compileScript(descriptor, { id: 'settingsPage' })
const template = compileTemplate({ source: descriptor.template!.content, filename: filename.pathname, id: 'settingsPage', compilerOptions: { bindingMetadata: script.bindings } })
if (template.errors.length) throw new Error(String(template.errors))
const code = template.code.replace(/import \{([^}]+)\} from "vue"/g, (_, names: string) => 'const {' + names.replace(/ as /g, ': ') + '} = Vue').replace('export function render', 'return function render')
Page.render = new Function('Vue', transpileModule(code, { compilerOptions: { target: ScriptTarget.ES2022 } }).outputText)(Vue)
let app: App | undefined, root: HostNode
const text = (n: HostNode): string => n.text + n.children.map(text).join(' ')
const all = (n: HostNode, type: string): HostNode[] => [...(n.type === type ? [n] : []), ...n.children.flatMap(child => all(child, type))]
async function settle() { for (let i=0;i<5;i++) { await Promise.resolve(); await nextTick() } }
const base = { tenantId:'2',settingsVersion:'3',name:'team',type:'TEAM',description:null,joinApprovalMode:0,auditEnabled:false,activityRecordingEnabled:false,playgroundEnabled:true,rateLimitRpm:null,rateLimitTpm:null,role:'ADMIN',editable:true }
const full = { tenantId:'2',visibility:'FULL',observedSettingsVersion:'3',costLimit:{enabled:false,dailyLimitFen:'100',weeklyLimitFen:null,monthlyLimitFen:null,version:'4'},costWarning:{enabled:false,effective:false,thresholdPercent:80,channels:[]},availability:'READY',periods:[],limits:[],budgetState:'DISABLED',asOf:'2026-10-17T00:00:00+08:00',retryAt:null,timezone:'Asia/Shanghai' }
async function mount() {
 root=node('root'); app=renderer.createApp(defineComponent({setup:()=>()=>h(Page,{tenantId:'2'})}));app.provide(ssrContextKey,{})
 for(const tag of ['a-spin','a-alert','a-card','a-form','a-form-item','a-input','a-textarea','a-radio-group','a-radio','a-switch','a-input-number','a-button','a-space','a-empty']) app.component(tag,defineComponent({inheritAttrs:false,setup(_, {attrs,slots}){return()=>h(tag,attrs,[...(slots.default?.()??[]),...(slots.description?.()??[])])}}))
 app.mount(root);await settle()
}
function editName(name='changed'){all(root,'a-input')[0]!.props['onUpdate:value'](name)}
function saveButton(){return all(root,'a-button').find(n=>text(n).includes('保存更改'))!}
beforeEach(()=>{vi.clearAllMocks();mocks.tenant.currentRole='ADMIN';mocks.tenant.currentTenantId='2';mocks.user.token='auth';mocks.settings.mockResolvedValue({...base});mocks.cost.mockResolvedValue({...full});mocks.ready.mockResolvedValue(null);mocks.tenant.fetchTenants.mockResolvedValue([]);vi.stubGlobal('document',{visibilityState:'visible',addEventListener:vi.fn(),removeEventListener:vi.fn()})})
afterEach(()=>{app?.unmount();vi.unstubAllGlobals()})
it('两个版本未对齐不创建成本草稿；仅基础设置可以保存且省略成本',async()=>{
 mocks.cost.mockResolvedValue({...full,observedSettingsVersion:'9'});await mount();expect(all(root,'budget-section')).toHaveLength(0);expect(mocks.settings).toHaveBeenCalledTimes(2)
 editName();await settle();mocks.save.mockResolvedValue({status:'SAVED',requiresConfirmation:false,savedSnapshot:{settings:{...base,name:'changed',settingsVersion:'4'},costLimit:full.costLimit,costWarning:full.costWarning}})
 saveButton().props.onClick();await settle();expect(mocks.save.mock.calls[0]?.[1]).not.toHaveProperty('costLimit');expect(mocks.success).toHaveBeenCalledOnce()
})
it('刷新期间新增编辑不会被迟到设置覆盖',async()=>{
 await mount();let resolve!: (value:unknown)=>void;mocks.settings.mockReturnValue(new Promise(r=>{resolve=r}));mocks.cost.mockResolvedValue({...full,observedSettingsVersion:'4'})
 all(root,'budget-status')[0]!.props.onRefresh();await settle();editName('my draft');resolve({...base,name:'other',settingsVersion:'4'});await settle()
 expect(all(root,'a-input')[0]!.props.value).toBe('my draft');expect(mocks.tenant.settingsDirty).toBe(true)
})
it('SUMMARY 建立新权限世代，迟到 FULL 不恢复金额或编辑草稿',async()=>{
 await mount();let resolve!: (value:unknown)=>void;mocks.settings.mockReturnValue(new Promise(r=>{resolve=r}));mocks.cost.mockResolvedValue({...full,observedSettingsVersion:'4'})
 all(root,'budget-status')[0]!.props.onRefresh();await settle()
 mocks.cost.mockResolvedValue({tenantId:'2',visibility:'SUMMARY',budgetState:'LIMITED',retryAt:null,limits:[],timezone:'Asia/Shanghai',asOf:'now',message:'联系管理员'})
 all(root,'budget-status')[0]!.props.onRefresh();await settle();expect(all(root,'budget-section')).toHaveLength(0)
 resolve({...base,settingsVersion:'4'});await settle();expect(all(root,'budget-section')).toHaveLength(0);expect(all(root,'budget-status')[0]!.props.status.visibility).toBe('SUMMARY')
})
it('保存已完成后状态刷新失败仍成功一次且清 dirty',async()=>{
 await mount();editName();await settle();mocks.save.mockResolvedValue({status:'SAVED',requiresConfirmation:false,savedSnapshot:{settings:{...base,name:'changed',settingsVersion:'4'},costLimit:{...full.costLimit,version:'5'},costWarning:full.costWarning}});mocks.cost.mockRejectedValue(new Error('offline'))
 saveButton().props.onClick();await settle();expect(mocks.success).toHaveBeenCalledOnce();expect(mocks.tenant.settingsDirty).toBe(false);expect(mocks.save).toHaveBeenCalledOnce();expect(all(root,'budget-section')[0]!.props.modelValue.daily).toBe('1.00')
})

it('未知结果显式放弃后确实载入新版本并清草稿',async()=>{
 await mount();editName();await settle();mocks.save.mockRejectedValue(new Error('timeout'));saveButton().props.onClick();await settle()
 mocks.settings.mockResolvedValue({...base,name:'latest',settingsVersion:'9'});mocks.cost.mockResolvedValue({...full,observedSettingsVersion:'9'})
 const discard=all(root,'a-button').find(n=>text(n).includes('放弃草稿并载入最新配置'))!;discard.props.onClick();await settle()
 expect(all(root,'a-input')[0]!.props.value).toBe('latest');expect(mocks.tenant.settingsDirty).toBe(false);expect(all(root,'budget-section')).toHaveLength(1)
})
