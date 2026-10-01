import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { listTenants, getTenantInfo, switchTenant as switchTenantApi, getTenantMembers, saveTenantPreference } from '@/api/tenant'
import type { TenantInfoListRespDTO, TenantInfoRespDTO, TenantMembersListRespDTO } from '@/types/tenant'
import type { TenantInfo } from '@/types/user'
import { usePermissionStore } from '@/stores/permission'

export const useTenantStore = defineStore('tenant', () => {
  const tenants = ref<TenantInfoListRespDTO[]>([])
  const currentTenant = ref<TenantInfo | null>(null)
  const isLoading = ref(false)
  const isSwitching = ref(false)
  const settingsDirty = ref(false)
  const preferenceSavingIds = ref<string[]>([])
  const initialized = ref(false)
  let initializationPromise: Promise<void> | null = null
  let listRequestSequence = 0
  let tenantStateRevision = 0
  const switchGuards = new Set<() => boolean | Promise<boolean>>()

  /** 页面登记活跃操作确认；卸载时移除，不影响其他页面的租户切换。 */
  function registerSwitchGuard(guard: () => boolean | Promise<boolean>) {
    switchGuards.add(guard)
    return () => switchGuards.delete(guard)
  }

  const currentRole = computed(() => currentTenant.value?.role ?? null)
  const currentTenantId = computed(() => currentTenant.value?.tenantId ?? null)

  /** 设置当前租户（登录后调用） */
  function setCurrentTenant(tenant: TenantInfo | null) {
    currentTenant.value = tenant
    const permissionStore = usePermissionStore()
    if (tenant) permissionStore.setRole(tenant.role)
    else permissionStore.clearPermissions()
  }

  /** 刷新租户列表 */
  async function fetchTenants() {
    const requestSequence = ++listRequestSequence
    const revision = tenantStateRevision
    isLoading.value = true
    try {
      const result = await listTenants()
      // 切换成功后的状态不能被较早发出的列表请求覆盖。
      if (requestSequence !== listRequestSequence || revision !== tenantStateRevision) return
      tenants.value = result
      const current = result.find((tenant) => tenant.current)
      setCurrentTenant(current
        ? { tenantId: current.tenantId, name: current.name, type: current.type, role: current.role }
        : null)
    } finally {
      if (requestSequence === listRequestSequence) isLoading.value = false
    }
  }

  /** 登录恢复与路由进入共享的单飞初始化。 */
  async function initialize(force = false): Promise<void> {
    if (initialized.value && !force) return
    if (initializationPromise) return initializationPromise
    initializationPromise = fetchTenants()
      .then(() => { initialized.value = true })
      .finally(() => { initializationPromise = null })
    return initializationPromise
  }

  /** 获取单个租户详情 */
  async function fetchTenantInfo(tenantId: string): Promise<TenantInfoRespDTO> {
    return getTenantInfo(tenantId)
  }

  /** 切换租户（调用远端 API + 更新本地状态） */
  async function switchToTenant(tenantId: string): Promise<boolean> {
    if (isSwitching.value) return false
    if (currentTenantId.value === tenantId) return true
    if (settingsDirty.value && !window.confirm('租户设置有未保存的更改，确定切换租户吗？')) return false
    isSwitching.value = true
    try {
      for (const guard of switchGuards) if (!(await guard())) return false
      const result = await switchTenantApi(tenantId)
      tenantStateRevision++
      listRequestSequence++
      isLoading.value = false
      setCurrentTenant({
        tenantId: result.tenantId,
        name: result.name,
        type: result.type,
        role: result.role,
      })
      tenants.value = tenants.value.map((tenant) => ({
        ...tenant,
        current: tenant.tenantId === result.tenantId,
      }))
      // 切换响应先更新界面，再向服务端读取完整列表；对账失败仍保留成功的切换结果。
      try { await fetchTenants() } catch { /* 请求拦截器已提示，保留切换结果。 */ }
      return true
    } finally {
      isSwitching.value = false
    }
  }

  /** 保存本人偏好，成功后以服务端返回值更新列表，避免失败时产生虚假的本地状态。 */
  async function setPreference(tenantId: string, favorite: boolean, pinned: boolean): Promise<boolean> {
    if (preferenceSavingIds.value.includes(tenantId)) return false
    preferenceSavingIds.value = [...preferenceSavingIds.value, tenantId]
    try {
      const saved = await saveTenantPreference(tenantId, favorite, pinned)
      tenantStateRevision++
      listRequestSequence++
      isLoading.value = false
      tenants.value = tenants.value.map((tenant) => tenant.tenantId === saved.tenantId
        ? { ...tenant, favorite: saved.favorite, pinned: saved.pinned } : tenant)
      return true
    } finally {
      preferenceSavingIds.value = preferenceSavingIds.value.filter((id) => id !== tenantId)
    }
  }

  /** 获取成员列表 */
  async function fetchMembers(tenantId: string, pageNum: number, pageSize: number): Promise<TenantMembersListRespDTO> {
    return getTenantMembers(tenantId, pageNum, pageSize)
  }

  return {
    tenants,
    currentTenant,
    isLoading,
    isSwitching,
    settingsDirty,
    preferenceSavingIds,
    initialized,
    currentRole,
    currentTenantId,
    setCurrentTenant,
    fetchTenants,
    initialize,
    fetchTenantInfo,
    fetchMembers,
    switchToTenant,
    registerSwitchGuard,
    setPreference,
  }
})
