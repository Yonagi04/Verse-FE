import { usePermissionStore } from '@/stores/permission'
import type { Permission } from '@/utils/constants'

export function usePermission() {
  const permissionStore = usePermissionStore()

  function hasPermission(perm: Permission): boolean {
    return permissionStore.authorities.includes(perm)
  }

  function hasAnyPermission(...perms: Permission[]): boolean {
    return perms.some((p) => permissionStore.authorities.includes(p))
  }

  function hasAllPermissions(...perms: Permission[]): boolean {
    return perms.every((p) => permissionStore.authorities.includes(p))
  }

  return {
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
  }
}
