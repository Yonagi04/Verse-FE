import { beforeEach, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useTenantStore } from '../src/stores/tenant'
const mocks=vi.hoisted(() => ({ list:vi.fn(), clear:vi.fn(), role:vi.fn() }))
vi.mock('@/api/tenant', () => ({listTenants:mocks.list,getTenantInfo:vi.fn(),switchTenant:vi.fn(),getTenantMembers:vi.fn(),saveTenantPreference:vi.fn()}))
vi.mock('@/stores/permission', () => ({usePermissionStore:() => ({clearPermissions:mocks.clear,setRole:mocks.role})}))
beforeEach(() => { setActivePinia(createPinia()); vi.clearAllMocks() })
it('换账号后清空租户和权限，旧请求不能写回或标记初始化成功', async () => {
  const store=useTenantStore(); let oldResolve!: (value:unknown[]) => void
  mocks.list.mockImplementationOnce(() => new Promise(resolve => { oldResolve=resolve }))
  const old=store.initialize(); store.reset(); oldResolve([{tenantId:'old',current:true,role:'SUPER_ADMIN'}]); await old
  expect(store.tenants).toEqual([]); expect(store.currentTenant).toBeNull(); expect(store.initialized).toBe(false); expect(mocks.clear).toHaveBeenCalled()
})
it('新账号可以独立初始化，旧promise结束不能覆盖新初始化', async () => {
  const store=useTenantStore(); let oldResolve!: (value:unknown[]) => void
  mocks.list.mockImplementationOnce(() => new Promise(resolve => { oldResolve=resolve })).mockResolvedValueOnce([{tenantId:'new',name:'新租户',type:'PERSONAL',role:'MEMBER',current:true}])
  const old=store.initialize(); store.reset(); await store.initialize(); oldResolve([{tenantId:'old',current:true,role:'SUPER_ADMIN'}]); await old
  expect(store.currentTenantId).toBe('new'); expect(store.initialized).toBe(true); expect(store.currentRole).toBe('MEMBER')
})
