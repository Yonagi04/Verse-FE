<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useTenantStore } from '@/stores/tenant'
import { getLlmCostStatus } from '@/api/llmCostBudget'
import type { LlmCostStatus } from '@/types/llmCostBudget'
import type { BudgetPeriod } from '@/types/costBudget'
import { COST_STATE_LABELS, COST_STATE_DESCRIPTIONS, COST_WARNING_CHANNEL_LABELS } from '@/utils/llmCostBudget'
import { BUDGET_PERIOD_LABELS } from '@/utils/costBudget'
import { formatBudgetDateTime } from '@/utils/date'
import CostBudgetPeriodCard from '@/components/cost-budget/CostBudgetPeriodCard.vue'
import CostBudgetNotes from '@/components/cost-budget/CostBudgetNotes.vue'

const props = defineProps<{ tenantId: string; serviceId: string; visible?: boolean; canAdjust?: boolean }>()
const emit = defineEmits<{ (e: 'adjust'): void }>()
const store = useTenantStore()
const status = ref<LlmCostStatus | null>(null)
const loading = ref(false)
const failed = ref(false)
let revision = 0
async function refresh() {
  const ticket = ++revision, tenant = props.tenantId, service = props.serviceId
  status.value = null; failed.value = false; loading.value = false
  if (props.visible === false || store.currentTenantId !== tenant) return
  loading.value = true
  try {
    const result = await getLlmCostStatus(tenant, service)
    if (ticket === revision) status.value = result
  } catch {
    if (ticket === revision) failed.value = true
  } finally {
    if (ticket === revision) loading.value = false
  }
}
watch(() => [props.tenantId, props.serviceId, props.visible, store.currentRole, store.currentTenantId], refresh, { immediate: true, flush: 'sync' })
onBeforeUnmount(() => { revision++ })
const periodOrder: BudgetPeriod[] = ['DAY', 'WEEK', 'MONTH']
const fullStatus = computed(() => status.value?.visibility === 'FULL' ? status.value : null)
const periods = computed(() => periodOrder.flatMap(type => fullStatus.value?.periods.filter(period => period.period === type) ?? []))
const hitLabels = computed(() => [...new Set(status.value?.limits.map(hit => `${BUDGET_PERIOD_LABELS[hit.period]}限额`) ?? [])])
const dataReady = computed(() => fullStatus.value?.availability === 'READY' && status.value?.budgetState !== 'UNKNOWN')
const warningChannels = computed(() => fullStatus.value?.costWarning.channels.map(channel => COST_WARNING_CHANNEL_LABELS[channel]).join('、') || '未选择')
</script>

<template>
  <section class="cost-status" aria-label="调用成本限额" :aria-busy="loading">
    <div class="section-heading">
      <div><h3>调用成本限额</h3><p class="caption">预算消耗：API + PlayGround</p></div>
      <a-button size="small" :loading="loading" @click="refresh">刷新</a-button>
    </div>
    <a-alert v-if="failed" type="error" message="成本状态暂不可获取" description="未取得最新状态，请刷新重试。" show-icon role="alert" />
    <a-skeleton v-else-if="loading" active :paragraph="{ rows: 4 }" />
    <template v-else-if="status">
      <div class="budget-summary" :class="`state-${status.budgetState.toLowerCase()}`">
        <div class="summary-heading"><span>成本状态</span><a-tag :color="status.budgetState === 'LIMITED' ? 'error' : status.budgetState === 'UNKNOWN' ? 'warning' : 'default'">{{ COST_STATE_LABELS[status.budgetState] }}</a-tag></div>
        <p>{{ COST_STATE_DESCRIPTIONS[status.budgetState] }}</p>
        <template v-if="status.budgetState === 'LIMITED'">
          <div v-if="hitLabels.length" class="active-limits"><span>生效限制</span><a-tag v-for="label in hitLabels" :key="label" color="error">{{ label }}</a-tag></div>
          <div v-if="status.retryAt" class="recovery-time"><span>预计恢复</span><strong>{{ formatBudgetDateTime(status.retryAt) }}</strong></div>
          <p v-if="status.retryAt">配置不变且无更多在途费用触发更晚限制时自然恢复，到时仍需重新校验。</p>
        </template>
        <p v-if="status.visibility === 'SUMMARY'">{{ status.message || '成本状态由服务端实时判断' }}。需要调整时请联系管理员。</p>
        <a-button v-if="fullStatus && canAdjust" class="adjust-button" size="small" @click="emit('adjust')">调整限额</a-button>
      </div>
      <template v-if="fullStatus">
        <a-alert v-if="fullStatus.availability !== 'READY'" type="warning" show-icon
          :message="fullStatus.availability === 'INITIALIZING' ? '历史费用尚未完成核对' : '消费数据暂不可用'"
          :description="fullStatus.availability === 'INITIALIZING' ? '需由平台完成历史费用回填与核对，当前费用和调用数量暂无法确认。' : '已用费用、剩余额度和调用数量暂无法确认。'" />
        <div class="period-section">
          <div class="section-heading"><h4>周期费用</h4><span class="caption">人民币 · 预估费用</span></div>
          <div class="periods"><CostBudgetPeriodCard v-for="period in periods" :key="period.period" :period="period" :enabled="fullStatus.costLimit.enabled" :data-ready="dataReady" /></div>
          <a-empty v-if="!periods.length" description="暂无周期费用数据" />
          <p class="caption">北京时间 GMT+8 · 按请求开始时间归属，含开始、不含结束。</p>
        </div>
        <div class="warning-summary">
          <div class="summary-heading"><h4>成本预警</h4><a-tag>{{ !fullStatus.costWarning.enabled ? '未开启' : fullStatus.costWarning.effective ? '生效中' : '已保留，当前不生效' }}</a-tag></div>
          <dl v-if="fullStatus.costWarning.enabled"><div><dt>共用阈值</dt><dd>{{ fullStatus.costWarning.thresholdPercent }}%</dd></div><div><dt>预警渠道</dt><dd>{{ warningChannels }}</dd></div></dl>
          <p class="caption">达限始终通过站内系统公告、短信、邮件通知，不受预警开关和渠道选择影响。</p>
        </div>
        <CostBudgetNotes />
      </template>
      <p class="snapshot-time">查询时间 <time :datetime="status.asOf">{{ formatBudgetDateTime(status.asOf) }}</time></p>
    </template>
    <a-empty v-else description="暂无成本状态" />
  </section>
</template>

<style lang="scss" scoped>
.cost-status { display: flex; flex-direction: column; gap: 16px; border-top: 1px solid $color-border; margin-top: 20px; padding-top: 20px; color: $color-text-primary; }
h3, h4, p { margin: 0; }
h3 { font-size: $font-size-h3; font-weight: 600; }
h4 { font-size: $font-size-body; font-weight: 600; }
.section-heading, .summary-heading { display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; }
.caption, .snapshot-time { color: $color-text-secondary; font-size: $font-size-caption; line-height: 1.7; }
.section-heading .caption { margin-top: 4px; }
.budget-summary, .warning-summary { padding: 14px 16px; border: 1px solid $color-border; border-radius: $radius-button; background: $color-bg-secondary; }
.budget-summary {
  p { margin-top: 8px; color: $color-text-secondary; font-size: $font-size-caption; line-height: 1.7; }
  &.state-limited { border-color: theme-alpha('danger', .25); background: theme-alpha('danger', .04); }
  &.state-unknown { border-color: theme-alpha('warning', .3); background: theme-alpha('warning', .05); }
}
.summary-heading :deep(.ant-tag), .active-limits :deep(.ant-tag) { margin: 0; }
.active-limits, .recovery-time { display: flex; gap: 8px; flex-wrap: wrap; align-items: baseline; margin-top: 12px; font-size: $font-size-caption; }
.active-limits > span, .recovery-time > span { color: $color-text-secondary; }
.recovery-time strong { overflow-wrap: anywhere; }
.adjust-button { margin-top: 12px; }
.periods { display: grid; gap: 12px; margin: 12px 0; }
.warning-summary { dl { margin: 12px 0; display: grid; gap: 8px; } dl > div { display: flex; gap: 16px; font-size: $font-size-caption; } dt { color: $color-text-secondary; flex-shrink: 0; } dd { margin: 0; overflow-wrap: anywhere; } .caption { margin-top: 8px; } }
.snapshot-time { padding-top: 12px; border-top: 1px solid $color-border; }
</style>
