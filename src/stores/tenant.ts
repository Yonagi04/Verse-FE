import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { listTenants, getTenantInfo, switchTenant as switchTenantApi, getTenantMembers } from '@/api/tenant'
import type { TenantInfoListRespDTO, TenantInfoRespDTO, TenantMembersListRespDTO } from '@/types/tenant'
import type { TenantInfo } from '@/types/user'

export const useTenantStore = defineStore('tenant', () => {
  const tenants = ref<TenantInfoListRespDTO[]>([])
  const currentTenant = ref<TenantInfo | null>(null)
  const isLoading = ref(false)
  const isSwitching = ref(false)

  const currentRole = computed(() => currentTenant.value?.role ?? null)
  const currentTenantId = computed(() => currentTenant.value?.tenantId ?? null)

  /** 设置当前租户（登录后调用） */
  function setCurrentTenant(tenant: TenantInfo | null) {
    currentTenant.value = tenant
  }

  /** 刷新租户列表 */
  async function fetchTenants() {
    isLoading.value = true
    try {
      tenants.value = await listTenants()
    } finally {
      isLoading.value = false
    }
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
      currentTenant.value = {
        tenantId: result.tenantId,
        name: result.name,
        type: result.type,
        role: result.role,
      }
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
    currentRole,
    currentTenantId,
    setCurrentTenant,
    fetchTenants,
    fetchTenantInfo,
    fetchMembers,
    switchToTenant,
  }
})
