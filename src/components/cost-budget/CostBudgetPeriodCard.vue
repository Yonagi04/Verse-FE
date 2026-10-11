<script setup lang="ts">
import { computed } from 'vue'
import { ClockCircleOutlined } from '@ant-design/icons-vue'
import type { CostBudgetPeriodStatus } from '@/types/costBudget'
import { BUDGET_PERIOD_LABELS, formatBudgetYuan, getBudgetUsage } from '@/utils/costBudget'
import { formatBudgetDateTime } from '@/utils/date'

const props = defineProps<{ period: CostBudgetPeriodStatus; enabled: boolean; dataReady: boolean }>()
// 数据未就绪时不展示上次费用或进度，避免误导为零消耗或仍有可用额度。
const used = computed(() => props.dataReady ? props.period.usedCostFen : null)
const remaining = computed(() => props.dataReady && props.enabled && props.period.limitFen !== null
  ? props.period.remainingCostFen : null)
const usage = computed(() => props.enabled ? getBudgetUsage(used.value, props.period.limitFen) : null)
const limited = computed(() => props.dataReady && props.enabled && props.period.effective)
const periodTitles = { DAY: '今日', WEEK: '本周', MONTH: '本月' }
const stateLabel = computed(() => {
  if (!props.enabled) return '限额未生效'
  if (!props.dataReady) return '数据未就绪'
  if (limited.value) return '已达限额'
  return props.period.limitFen === null ? '不限额' : '限额生效中'
})
const counts = computed(() => [
  { label: '已计算', value: props.period.calculatedCount },
  { label: '未计价', value: props.period.unpricedCount },
  { label: '不可计算', value: props.period.uncalculableCount },
  { label: '不计费', value: props.period.notChargeableCount },
])
function formatCount(value: string | null) {
  return props.dataReady && value !== null ? value.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : '--'
}
function periodTime(value: string) {
  return formatBudgetDateTime(value).replace('（GMT+8）', '')
}
</script>

<template>
  <section class="period-card" :class="{ 'is-limited': limited }" :aria-label="`${BUDGET_PERIOD_LABELS[period.period]}周期成本`">
    <div class="period-heading">
      <h4>{{ periodTitles[period.period] }}<span>{{ BUDGET_PERIOD_LABELS[period.period] }}周期</span></h4>
      <span class="period-state" :class="{ 'is-limited': limited }"><span v-if="limited" class="state-dot"></span>{{ stateLabel }}</span>
    </div>

    <dl class="metrics">
      <div class="metric metric-used"><dt>已用费用</dt><dd :title="formatBudgetYuan(used)">{{ formatBudgetYuan(used) }}</dd></div>
      <div class="metric"><dt>{{ enabled ? '周期限额' : '保留限额' }}</dt><dd :title="period.limitFen === null ? '不限' : formatBudgetYuan(period.limitFen)">{{ period.limitFen === null ? '不限' : formatBudgetYuan(period.limitFen) }}</dd></div>
      <div class="metric"><dt>剩余额度</dt><dd :title="formatBudgetYuan(remaining)">{{ formatBudgetYuan(remaining) }}</dd></div>
    </dl>

    <div v-if="usage" class="usage-row">
      <a-progress :percent="usage.percent" :show-info="false" :stroke-width="4"
        :stroke-color="limited ? 'var(--verse-danger)' : 'var(--verse-link)'" trail-color="var(--verse-border)"
        :aria-label="`${periodTitles[period.period]}限额使用比例 ${usage.label}`" />
      <span class="usage-label">{{ usage.label }}</span>
    </div>

    <div class="period-range">
      <ClockCircleOutlined aria-hidden="true" />
      <span><time :datetime="period.periodStart" :title="`开始时间（含）：${formatBudgetDateTime(period.periodStart)}`">{{ periodTime(period.periodStart) }}</time><span class="range-separator"> → </span><time :datetime="period.periodEnd" :title="`结束时间（不含）：${formatBudgetDateTime(period.periodEnd)}`">{{ periodTime(period.periodEnd) }}</time></span>
    </div>
    <div class="cost-counts">
      <span v-for="item in counts" :key="item.label">{{ item.label }}<strong>{{ formatCount(item.value) }}</strong></span>
    </div>
  </section>
</template>

<style lang="scss" scoped>
.period-card {
  padding: 16px;
  border: 1px solid $color-border;
  border-radius: $radius-card;
  background: $color-bg;
  &.is-limited { border-color: theme-alpha('danger', .35); }
}
.period-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
  h4 { margin: 0; font-size: $font-size-body; font-weight: 600; color: $color-text-primary; }
  h4 span { margin-left: 8px; font-size: $font-size-caption; font-weight: 400; color: $color-text-tertiary; }
}
.period-state {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: $color-text-secondary;
  font-size: $font-size-caption;
  &.is-limited { color: $color-danger; }
}
.state-dot { width: 5px; height: 5px; border-radius: 50%; background: currentColor; }
.metrics { display: grid; grid-template-columns: 1.25fr 1fr 1fr; gap: 12px; margin: 0 0 12px; }
.metric {
  min-width: 0;
  dt { color: $color-text-secondary; font-size: $font-size-caption; margin-bottom: 4px; }
  dd { margin: 0; color: $color-text-primary; font-size: 16px; font-weight: 500; line-height: 28px; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
}
.metric-used dd { font-size: 22px; font-weight: 600; letter-spacing: -.4px; }
.is-limited .metric-used dd { color: $color-danger; }
.usage-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: -4px 0 10px;
  :deep(.ant-progress) { flex: 1; min-width: 0; margin: 0; line-height: 1; }
}
.usage-label { color: $color-text-secondary; font-size: $font-size-caption; font-variant-numeric: tabular-nums; white-space: nowrap; }
.period-range { display: flex; align-items: baseline; gap: 7px; color: $color-text-secondary; font-size: $font-size-caption; line-height: 1.7; }
.period-range time { white-space: nowrap; }
.range-separator { color: $color-text-tertiary; }
.cost-counts {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 16px;
  margin-top: 8px;
  padding-top: 10px;
  border-top: 1px solid $color-border;
  color: $color-text-tertiary;
  font-size: $font-size-caption;
  strong { margin-left: 6px; color: $color-text-secondary; font-weight: 500; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
}
@media (max-width: 480px) {
  .metrics { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
  .metric dd { font-size: 14px; }
  .metric-used dd { font-size: 18px; }
  .period-range time { white-space: normal; }
  .cost-counts { gap: 4px 12px; }
}
</style>
