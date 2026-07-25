import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { ROLE_PERMISSIONS, type Permission } from '@/utils/constants'

export const usePermissionStore = defineStore('permission', () => {
  const role = ref<string | null>(null)
  const permissions = ref<Permission[]>([])
  const authorities = ref<string[]>([])

  const hasPermission = computed(() => {
    return (perm: Permission): boolean => {
      return authorities.value.includes(perm)
    }
  })

  const hasAnyPermission = computed(() => {
    return (...perms: Permission[]): boolean => {
      return perms.some((p) => authorities.value.includes(p))
    }
  })

  function setRole(r: string | null) {
    role.value = r
    if (r && r in ROLE_PERMISSIONS) {
      permissions.value = ROLE_PERMISSIONS[r]
      authorities.value = permissions.value
    } else {
      permissions.value = []
      authorities.value = []
    }
  }

  function clearPermissions() {
    role.value = null
    permissions.value = []
    authorities.value = []
  }

  return {
    role,
    permissions,
    authorities,
    hasPermission,
    hasAnyPermission,
    setRole,
    clearPermissions,
  }
})
