import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getPlaygroundStatus } from '@/api/playground'
import type { PlaygroundStatus } from '@/types/playground'

/** PlayGround 入口状态只属于当前租户；切换后立即丢弃旧结果。 */
export const usePlaygroundStore = defineStore('playground', () => {
  const tenantId = ref<string | null>(null)
  const status = ref<PlaygroundStatus | null>(null)
  let revision = 0
  let loading: Promise<PlaygroundStatus | null> | null = null

  function reset(nextTenantId: string | null) {
    revision++
    tenantId.value = nextTenantId
    status.value = null
    loading = null
  }

  async function refresh(nextTenantId: string): Promise<PlaygroundStatus | null> {
    if (tenantId.value !== nextTenantId) reset(nextTenantId)
    if (loading) return loading
    const current = revision
    loading = getPlaygroundStatus(nextTenantId).then(result => {
      if (revision === current && tenantId.value === nextTenantId) status.value = result
      return revision === current ? result : null
    }).catch(() => {
      if (revision === current) status.value = null
      return null
    }).finally(() => { if (revision === current) loading = null })
    return loading
  }

  return { tenantId, status, reset, refresh }
})
