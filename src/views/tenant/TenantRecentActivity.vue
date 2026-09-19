<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { message } from 'ant-design-vue'
import { getTenantActivityStatus, listTenantActivities } from '@/api/tenant'
import { isTenantActivityDisabledError } from '@/utils/tenantActivity'
import TenantActivityEntry from './TenantActivityEntry.vue'
import type { TenantActivityItemRespDTO } from '@/types/tenant'

const props = defineProps<{
  tenantId: string
}>()

const visible = ref(false)
const loading = ref(false)
const loaded = ref(false)
const failed = ref(false)
const items = ref<TenantActivityItemRespDTO[]>([])

onMounted(async () => {
  try {
    const status = await getTenantActivityStatus(props.tenantId)
    if (!status.enabled) return
    visible.value = true
    loading.value = true
    try {
      const response = await listTenantActivities(
        props.tenantId,
        { limit: 3 },
        { silentError: true },
      )
      items.value = response.items.slice(0, 3)
      loaded.value = true
    } catch (error) {
      if (isTenantActivityDisabledError(error)) {
        visible.value = false
        return
      }
      failed.value = true
      const text = error instanceof Error ? error.message : '动态加载失败'
      message.error(text)
    } finally {
      loading.value = false
    }
  } catch {
    // 状态请求错误由统一请求拦截器处理。
  }
})
</script>

<template>
  <a-card v-if="visible" size="small" class="recent-activity-card" title="最新动态">
    <template #extra>
      <router-link :to="`/tenants/${tenantId}/activities`">全部</router-link>
    </template>
    <a-spin :spinning="loading">
      <div v-if="items.length" class="recent-list">
        <TenantActivityEntry
          v-for="item in items"
          :key="item.eventId"
          :item="item"
          compact
        />
      </div>
      <div v-else-if="loaded" class="recent-empty">租户暂时没有动态哦</div>
      <div v-else-if="failed" class="recent-empty">暂时无法加载动态</div>
    </a-spin>
  </a-card>
</template>

<style lang="scss" scoped>
.recent-activity-card {
  border-radius: $radius-card;
  background: $color-bg-secondary;

  :deep(.ant-card-body) {
    padding: 4px 16px 8px;
  }
}

.recent-list > :deep(.activity-entry:not(:last-child)) {
  border-bottom: 1px solid $color-border;
}

.recent-empty {
  padding: 22px 0;
  color: $color-text-secondary;
  text-align: center;
}
</style>
