import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { listTenants, getTenantInfo, switchTenant as switchTenantApi, getTenantMembers } from '@/api/tenant'
import type { TenantInfoListRespDTO, TenantInfoRespDTO, TenantMembersListRespDTO } from '@/types/tenant'
import type { TenantInfo } from '@/types/user'
import { usePermissionStore } from '@/stores/permission'

export const useTenantStore = defineStore('tenant', () => {
  const tenants = ref<TenantInfoListRespDTO[]>([])
  const currentTenant = ref<TenantInfo | null>(null)
  const isLoading = ref(false)
  const isSwitching = ref(false)
  const initialized = ref(false)
  let initializationPromise: Promise<void> | null = null

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
    isLoading.value = true
    try {
      tenants.value = await listTenants()
      const current = tenants.value.find((tenant) => tenant.current)
      setCurrentTenant(current
        ? { tenantId: current.tenantId, name: current.name, type: current.type, role: current.role }
        : null)
    } finally {
      isLoading.value = false
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
  async function switchToTenant(tenantId: string): Promise<void> {
    isSwitching.value = true
    try {
      const result = await switchTenantApi(tenantId)
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
    } finally {
      isSwitching.value = false
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
    initialized,
    currentRole,
    currentTenantId,
    setCurrentTenant,
    fetchTenants,
    initialize,
    fetchTenantInfo,
    fetchMembers,
    switchToTenant,
  }
})
