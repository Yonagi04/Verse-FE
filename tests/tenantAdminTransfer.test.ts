import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import * as Vue from 'vue'
import { createRenderer, defineComponent, h, reactive, ssrContextKey, type App } from 'vue'
import { parse, compileScript, compileTemplate } from '@vue/compiler-sfc'
import { readFileSync } from 'node:fs'
import { setImmediate } from 'node:timers'
import TenantMemberTab from '../src/views/tenant/TenantMemberTab.vue'

const mocks = vi.hoisted(() => ({
  fetchMembers: vi.fn(), transferSuperAdmin: vi.fn(), updateMemberRole: vi.fn(), updateTenantRole: vi.fn(),
  confirm: vi.fn(), success: vi.fn(), modal: { destroy: vi.fn(), update: vi.fn() },
  tenant: {} as any,
}))
vi.mock('@/stores/tenant', () => ({ useTenantStore: () => mocks.tenant }))
vi.mock('@/stores/user', () => ({ useUserStore: () => ({ user: { userId: '10' } }) }))
vi.mock('@/api/tenant', () => ({ transferSuperAdmin: mocks.transferSuperAdmin, updateMemberRole: mocks.updateMemberRole,
  removeMember: vi.fn(), getUnreviewedJoinRequestCount: vi.fn().mockResolvedValue(0) }))
vi.mock('ant-design-vue', () => ({ message: { success: mocks.success }, Modal: { confirm: mocks.confirm } }))
vi.mock('@ant-design/icons-vue', () => ({ ExclamationCircleOutlined: { render: () => h('icon') } }))
vi.mock('../src/views/tenant/TenantJoinRequestPanel.vue', () => ({ default: { render: () => null } }))
vi.mock('../src/views/tenant/UserPublicProfileModal.vue', () => ({ default: { render: () => null } }))
vi.mock('@/components/PaginationBar.vue', () => ({ default: { render: () => null } }))

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
const element = (tag: string) => defineComponent({ inheritAttrs: false,
  setup(_, { attrs, slots }) { return () => h(tag, attrs, slots.default?.()) },
})
const filename = new URL('../src/views/tenant/TenantMemberTab.vue', import.meta.url)
const { descriptor } = parse(readFileSync(filename, 'utf8'), { filename: filename.pathname })
const script = compileScript(descriptor, { id: 'transfer-test' })
const template = compileTemplate({ source: descriptor.template!.content, filename: filename.pathname, id: 'transfer-test',
  compilerOptions: { bindingMetadata: script.bindings } })
if (template.errors.length) throw new Error(String(template.errors))
const renderCode = template.code.replace(/import \{([^}]+)\} from "vue"/g, (_, names: string) =>
  'const {' + names.replace(/ as /g, ': ') + '} = Vue').replace('export function render', 'return function render')
TenantMemberTab.render = new Function('Vue', renderCode)(Vue)
let app: App | undefined
let root: HostNode
let props: { tenantId: string }
const member = (userId: string, role: string) => ({ userId, role, nickname: '用户' + userId, username: 'user' + userId, joinedAt: '2026-10-01T00:00:00' })
const rows = () => [member('10', 'SUPER_ADMIN'), member('30', 'ADMIN'), member('32', 'MEMBER')]
const response = (members = rows()) => ({ tenantMembers: members, total: members.length, totalPages: 1, page: 1, pageSize: 10 })
async function settle() { for (let i = 0; i < 5; i++) await new Promise<void>(resolve => setImmediate(resolve)) }
async function mount() {
  root = node('root'); props = reactive({ tenantId: '20' })
  app = renderer.createApp({ render: () => h(TenantMemberTab, props) }); app.provide(ssrContextKey, {})
  for (const tag of ['a-select', 'a-select-option', 'a-button', 'a-tag']) app.component(tag, element(tag))
  app.component('a-table', defineComponent({ props: ['dataSource', 'columns'], setup(props, { slots }) {
    return () => h('table', props.dataSource.flatMap((record: any) => props.columns.map((column: any) =>
      h('cell', { memberId: record.userId }, slots.bodyCell?.({ record, column })))))
  } }))
  app.mount(root); await settle()
}
function all(target: HostNode, predicate: (node: HostNode) => boolean): HostNode[] {
  return [...(predicate(target) ? [target] : []), ...target.children.flatMap(child => all(child, predicate))]
}
function selectFor(userId: string) {
  const cell = all(root, n => n.type === 'cell' && n.props.memberId === userId).find(n => all(n, m => m.type === 'a-select').length)!
  return all(cell, n => n.type === 'a-select')[0]!
}
function openTransfer() { selectFor('30').props.onChange('TRANSFER_SUPER_ADMIN'); return mocks.confirm.mock.calls[0]![0] }
beforeEach(() => {
  vi.clearAllMocks()
  mocks.tenant = reactive({ tenants: [{ tenantId: '20', role: 'SUPER_ADMIN' }], fetchMembers: mocks.fetchMembers,
    updateTenantRole: mocks.updateTenantRole })
  mocks.fetchMembers.mockResolvedValue(response())
  mocks.confirm.mockReturnValue(mocks.modal)
  mocks.transferSuperAdmin.mockResolvedValue(true)
})
afterEach(() => { app?.unmount(); app = undefined })

it('仅超管可在管理员行看到交接，不向成员或自己展示', async () => {
  await mount()
  expect(all(root, n => n.props.value === 'TRANSFER_SUPER_ADMIN')).toHaveLength(1)
  mocks.tenant.tenants[0].role = 'ADMIN'; await settle()
  expect(all(root, n => n.props.value === 'TRANSFER_SUPER_ADMIN')).toHaveLength(0)
})
it('只有成员和超管时隐藏交接入口', async () => {
  mocks.fetchMembers.mockResolvedValue(response([member('10','SUPER_ADMIN'),member('32','MEMBER')]))
  await mount(); expect(all(root, n => n.props.value === 'TRANSFER_SUPER_ADMIN')).toHaveLength(0)
})
it('二次确认包含目标名称及降级说明，取消不请求接口', async () => {
  await mount(); const confirm = openTransfer()
  expect(confirm.content.children[0]).toBe('即将把租户的超级管理员权限交接给')
  expect(confirm.content.children[1].children).toBe('用户30')
  expect(confirm.content.children[2]).toBe('，您将转为管理员，确定继续吗？')
  confirm.onCancel(); expect(mocks.transferSuperAdmin).not.toHaveBeenCalled()
})
it('确认只发一次交接请求，成功立即同步权限并刷新成员', async () => {
  let resolve!: (value: boolean) => void
  mocks.transferSuperAdmin.mockImplementationOnce(() => new Promise(r => { resolve = r }))
  await mount(); const confirm = openTransfer(); const pending = confirm.onOk()
  await confirm.onOk(); expect(mocks.transferSuperAdmin).toHaveBeenCalledTimes(1)
  expect(mocks.updateTenantRole).not.toHaveBeenCalled()
  resolve(true); await pending
  expect(mocks.transferSuperAdmin).toHaveBeenCalledWith('20','30')
  expect(mocks.updateTenantRole).toHaveBeenCalledWith('20','ADMIN')
  expect(mocks.fetchMembers).toHaveBeenCalledTimes(2)
  expect(mocks.updateMemberRole).not.toHaveBeenCalled()
})
it('失败保留角色并允许重试', async () => {
  mocks.transferSuperAdmin.mockRejectedValueOnce(new Error('transfer failed'))
  await mount(); const confirm = openTransfer()
  await expect(confirm.onOk()).rejects.toThrow('transfer failed')
  expect(mocks.updateTenantRole).not.toHaveBeenCalled()
  await confirm.onOk(); expect(mocks.updateTenantRole).toHaveBeenCalledWith('20','ADMIN')
})
it('切换页面租户后销毁旧确认，旧回调不能提交', async () => {
  await mount(); const confirm = openTransfer()
  props.tenantId = '21'; await settle(); expect(mocks.modal.destroy).toHaveBeenCalled()
  await confirm.onOk(); expect(mocks.transferSuperAdmin).not.toHaveBeenCalled()
})
