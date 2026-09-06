<script setup lang="ts">
import type { UsageBreakdownDimension, UsageBreakdownItem, UsageBreakdownPage } from '@/types/usage'
import { formatYuan } from '@/utils/money'

const props = defineProps<{ dimension: UsageBreakdownDimension; data: UsageBreakdownPage | null; loading: boolean }>()
const emit = defineEmits<{ (e: 'update:dimension', value: UsageBreakdownDimension): void; (e: 'page', page: number, pageSize: number): void; (e: 'retry'): void }>()

function identity(record: UsageBreakdownItem) {
  if (props.dimension === 'model') return record.serviceName || '已删除模型'
  return record.apiKeyName || '已删除的 API Key'
}
function secondary(record: UsageBreakdownItem) {
  return props.dimension === 'apiKey' ? (record.keyPrefix || record.apiKeyId) : ''
}
function rowKey(record: UsageBreakdownItem) {
  return props.dimension === 'model' ? `model-${record.serviceId ?? 'unknown'}` : `key-${record.apiKeyId ?? 'unknown'}`
}
</script>
<template>
  <a-tabs :active-key="dimension" @update:active-key="emit('update:dimension', $event as UsageBreakdownDimension)">
    <a-tab-pane key="model" tab="按模型" />
    <a-tab-pane key="apiKey" tab="我的 API Key" />
  </a-tabs>
  <a-table :data-source="data?.items ?? []" :loading="loading" :row-key="rowKey" :pagination="false" :scroll="{ x: 760 }">
    <a-table-column title="对象"><template #default="{ record }">{{ identity(record) }}<div class="secondary">{{ secondary(record) }}</div></template></a-table-column>
    <a-table-column title="请求数" data-index="requestCount" align="right" />
    <a-table-column title="总 Token" data-index="totalTokens" align="right" />
    <a-table-column title="预估费用" align="right"><template #default="{ record }">{{ formatYuan(record.estimatedCostFen) }}</template></a-table-column>
    <a-table-column title="不可计算请求" data-index="uncalculableRequestCount" align="right" />
  </a-table>
  <a-pagination v-if="data && data.total" :current="data.page" :page-size="data.pageSize" :total="data.total" show-size-changer class="pagination" @change="emit('page', $event, data.pageSize)" @show-size-change="(_: number, size: number) => emit('page', 1, size)" />
</template>
<style lang="scss" scoped>.pagination { margin-top: 16px; text-align: right; }.secondary { color: $color-text-secondary; font-size: 12px; }</style>
