<script setup lang="ts">
import type { TenantCostStatus } from '@/types/tenantCostBudget'
import CostBudgetPeriodCard from '@/components/cost-budget/CostBudgetPeriodCard.vue'
import CostBudgetNotes from '@/components/cost-budget/CostBudgetNotes.vue'
import { formatBudgetDateTime } from '@/utils/date'
defineProps<{ status: TenantCostStatus | null; failed?: boolean }>()
const emit = defineEmits<{ refresh: [] }>()
const labels = { DISABLED: '租户限额未生效', AVAILABLE: '租户限额生效中', LIMITED: '租户成本受限：全部新的 API 与 PlayGround 模型调用受限', UNKNOWN: '预算校验暂不可用' }
</script>
<template>
  <section class="tenant-cost-status" aria-label="整个租户的成本状态">
    <header class="status-heading">
      <div>
        <h3>当前周期消耗</h3>
        <p v-if="status" class="status-summary" :class="{ limited: status.budgetState === 'LIMITED' }">{{ labels[status.budgetState] }}</p>
      </div>
      <a-button @click="emit('refresh')">刷新成本状态</a-button>
    </header>
    <a-alert v-if="failed || !status" type="warning" message="成本状态暂不可获取；显示值不保证是最新状态，请刷新。" show-icon />
    <template v-if="status">
      <p v-if="status.retryAt" class="recovery">预计最晚恢复：{{ formatBudgetDateTime(status.retryAt) }}，仍需满足 Key、模型等独立限制。</p>
      <template v-if="status.visibility === 'FULL'">
        <div class="periods"><CostBudgetPeriodCard v-for="period in status.periods" :key="period.period" :period="period" :enabled="status.costLimit.enabled" :data-ready="!failed && status.availability === 'READY'" /></div>
        <CostBudgetNotes />
      </template>
      <p v-else class="summary-message">{{ status.message || '页面状态仅供参考，以服务端调用校验为准。' }}</p>
      <p class="observed-at">查询时刻：{{ formatBudgetDateTime(status.asOf) }}</p>
    </template>
  </section>
</template>
<style lang="scss" scoped>
.tenant-cost-status { container-type: inline-size; display: grid; gap: 20px; margin-top: 32px; padding-top: 28px; border-top: 1px solid $color-border; }
.status-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; }
.status-heading > div { min-width: 0; }
.status-heading :deep(.ant-btn) { flex-shrink: 0; }
h3 { margin: 0; color: $color-text-primary; font-size: $font-size-body; font-weight: 600; line-height: 1.6; }
p { margin: 0; color: $color-text-secondary; line-height: 1.8; }
.status-summary { margin-top: 6px; font-size: $font-size-caption; }
.limited { color: $color-danger; }
.periods { display: grid; grid-template-columns: minmax(0, 1fr); gap: 20px; }
.periods :deep(.period-card) { padding: 20px; }
.periods :deep(.period-heading) { margin-bottom: 20px; }
.periods :deep(.metrics) { margin-bottom: 20px; column-gap: 24px; }
.periods :deep(.cost-counts) { margin-top: 14px; padding-top: 14px; gap: 8px 24px; }
.observed-at { color: $color-text-tertiary; font-size: $font-size-caption; }
.recovery, .summary-message { font-size: $font-size-body; }
@container (min-width: 960px) { .periods { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
@media (max-width: 600px) {
  .tenant-cost-status { margin-top: 28px; padding-top: 24px; }
  .status-heading { flex-wrap: wrap; gap: 12px; }
  .periods :deep(.period-card) { padding: 16px; }
}
</style>
