import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { listTenants } from '@/api/tenant'
import type { TenantInfoListRespDTO } from '@/types/tenant'
import type { TenantInfo } from '@/types/user'

export const useTenantStore = defineStore('tenant', () => {
  const tenants = ref<TenantInfoListRespDTO[]>([])
  const currentTenant = ref<TenantInfo | null>(null)
  const isLoading = ref(false)

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

  /** 切换租户后更新 */
  function switchToTenant(tenant: TenantInfoListRespDTO) {
    currentTenant.value = {
      tenantId: tenant.tenantId,
      name: tenant.name,
      type: tenant.type,
      role: tenant.role,
    }
  }

  return {
    tenants,
    currentTenant,
    isLoading,
    currentRole,
    currentTenantId,
    setCurrentTenant,
    fetchTenants,
    switchToTenant,
  }
})
