<script setup lang="ts">
import { computed, ref, watch, onBeforeUnmount } from 'vue'
import { KeyOutlined, ReloadOutlined, SettingOutlined, InfoCircleOutlined } from '@ant-design/icons-vue'
import { getApiKeyCostStatus } from '@/api/apikey'
import type { ApiKeyListRespDTO } from '@/types/apikey'
import type { ApiKeyCostStatusRespDTO, BudgetPeriod } from '@/types/costBudget'
import { BUDGET_PERIOD_LABELS } from '@/utils/costBudget'
import { formatBudgetDateTime } from '@/utils/date'
import CostBudgetPeriodCard from './components/CostBudgetPeriodCard.vue'

const props = defineProps<{
  visible: boolean
  tenantId: string
  record: ApiKeyListRespDTO | null
  refreshVersion: number
}>()
const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'edit', value: ApiKeyListRespDTO): void
}>()
const status = ref<ApiKeyCostStatusRespDTO | null>(null)
const loading = ref(false)
const error = ref('')
let sequence = 0
let controller: AbortController | undefined
let pendingEdit: { tenantId: string; record: ApiKeyListRespDTO } | null = null

function handleAdjustLimit() {
  if (!props.record || props.record.status === 0) return
  pendingEdit = { tenantId: props.tenantId, record: props.record }
  emit('update:visible', false)
}
function handleOpenChange(open: boolean) {
  if (open || !pendingEdit) return
  const pending = pendingEdit
  pendingEdit = null
  // 等成本详情关闭后再打开编辑，切换租户或 Key 时取消这次跳转。
  if (!props.visible && pending.tenantId === props.tenantId && pending.record.apiKeyId === props.record?.apiKeyId) {
    emit('edit', pending.record)
  }
}

function cancel() {
  sequence++
  controller?.abort()
  loading.value = false
}
async function refresh() {
  cancel()
  if (!props.visible || !props.record) return
  const current = sequence
  const tenant = props.tenantId
  const key = props.record.apiKeyId
  controller = new AbortController()
  loading.value = true
  error.value = ''
  try {
    const response = await getApiKeyCostStatus(tenant, key, { signal: controller.signal, silentError: true })
    // 关闭、切换租户或 Key 后丢弃旧响应，避免跨上下文展示费用。
    if (current === sequence) status.value = response
  } catch {
    if (current === sequence) {
      error.value = '成本状态查询失败，请刷新重试'
      status.value = null
    }
  } finally {
    if (current === sequence) loading.value = false
  }
}
watch(() => [props.visible, props.tenantId, props.record?.apiKeyId], () => {
  cancel()
  status.value = null
  error.value = ''
  void refresh()
}, { immediate: true })
watch(() => props.refreshVersion, () => { void refresh() })
onBeforeUnmount(cancel)

const labels = { DISABLED: '成本限额已关闭', AVAILABLE: '当前未达到成本限额', LIMITED: '成本受限', UNKNOWN: '预算校验暂不可用' }
const stateColor = computed(() => status.value?.budgetState === 'LIMITED' ? 'error'
  : status.value?.budgetState === 'UNKNOWN' ? 'warning' : 'default')
const stateDescription = computed(() => {
  switch (status.value?.budgetState) {
    case 'DISABLED': return '当前不执行成本限制，仍统计本周期预估费用。'
    case 'AVAILABLE': return '达到任一周期限额后，将停止此 Key 的新模型调用。'
    case 'LIMITED': return '此 Key 的新模型调用已受成本限制，已开始的调用可继续完成。'
    case 'UNKNOWN': return '当前无法确认成本状态，请刷新重试。'
    default: return ''
  }
})
// 三周期固定顺序；仅依据服务端状态展示命中与预计恢复时间。
const periodOrder: BudgetPeriod[] = ['DAY', 'WEEK', 'MONTH']
const periods = computed(() => periodOrder.flatMap(type => status.value?.periods.filter(period => period.period === type) ?? []))
const hitLabels = computed(() => [...new Set(status.value?.limits.map(hit => `${BUDGET_PERIOD_LABELS[hit.period]}限额`) ?? [])])
</script>

<template>
  <a-drawer :open="visible" title="API Key 成本详情" width="min(600px, 100vw)"
    :body-style="{ padding: '24px' }" @close="emit('update:visible', false)" @after-open-change="handleOpenChange">
    <div class="cost-detail" :aria-busy="loading">
      <div class="key-identity">
        <div class="key-icon"><KeyOutlined aria-hidden="true" /></div>
        <div class="key-info">
          <div class="key-name-row">
            <h3>{{ record?.name }}</h3>
            <a-tag :color="record?.status === 0 ? 'error' : record?.status === 2 ? 'default' : 'success'">
              {{ record?.status === 2 ? '已过期' : record?.status === 0 ? '已吊销' : '正常' }}
            </a-tag>
          </div>
          <code>{{ record?.keyPrefix }}…</code>
        </div>
      </div>

      <a-alert v-if="error" type="error" :message="error" description="未取得最新状态，刷新后重新查询。" show-icon role="alert" />
      <div v-else-if="loading && !status" class="loading-state" role="status" aria-label="正在查询成本状态">
        <a-skeleton active :paragraph="{ rows: 3 }" />
        <a-skeleton active :paragraph="{ rows: 5 }" />
      </div>
      <template v-else-if="status">
        <section class="budget-summary" :class="`state-${status.budgetState.toLowerCase()}`" aria-label="成本状态">
          <div class="summary-heading">
            <span class="summary-label">成本状态</span>
            <a-tag :color="stateColor">{{ labels[status.budgetState] }}</a-tag>
          </div>
          <p>{{ stateDescription }}</p>
          <template v-if="status.budgetState === 'LIMITED'">
            <div v-if="hitLabels.length" class="active-limits"><span>生效限制</span><a-tag v-for="label in hitLabels" :key="label" color="error">{{ label }}</a-tag></div>
            <div v-if="status.retryAt" class="recovery-time"><span>预计恢复</span><strong>{{ formatBudgetDateTime(status.retryAt) }}</strong></div>
            <p v-if="status.retryAt">配置不变且无更多在途费用触发更晚限制时自然恢复，到时仍需重新校验。</p>
          </template>
        </section>

        <a-alert v-if="status.costLimit.enabled && status.availability !== 'READY'" type="warning" show-icon
          :message="status.availability === 'INITIALIZING' ? '消费数据初始化中' : '消费数据暂不可用'"
          description="已用费用、剩余额度和调用数量暂无法确认。" />

        <section class="period-section" aria-label="周期费用">
          <div class="section-heading"><h3>周期费用</h3><span>人民币 · 预估费用</span></div>
          <div class="period-list">
            <CostBudgetPeriodCard v-for="period in periods" :key="period.period" :period="period"
              :enabled="status.costLimit.enabled" :data-ready="status.availability === 'READY' && status.budgetState !== 'UNKNOWN'" />
          </div>
          <a-empty v-if="!periods.length" description="暂无周期费用数据" />
          <p class="period-caption">北京时间 GMT+8 · 按请求开始时间归属，含开始、不含结束。</p>
        </section>
      </template>
      <a-empty v-else description="暂无成本状态" />

      <aside class="cost-notes">
        <InfoCircleOutlined aria-hidden="true" />
        <div><h4>费用口径</h4><p>仅累计已配置价格且可计算的预估费用，未计价不代表免费。已开始的调用可能继续产生费用。</p></div>
      </aside>
    </div>

    <template #footer>
      <div class="drawer-footer">
        <div class="snapshot-time">
          <template v-if="status">查询时间 <time :datetime="status.asOf">{{ formatBudgetDateTime(status.asOf) }}</time></template>
          <template v-else>{{ loading ? '正在查询最新状态…' : '尚未取得成本状态' }}</template>
        </div>
        <div class="footer-actions">
          <a-button :loading="loading" @click="refresh"><template #icon><ReloadOutlined /></template>刷新</a-button>
          <a-button v-if="record?.costLimit && record.status !== 0" type="primary" @click="handleAdjustLimit"><template #icon><SettingOutlined /></template>调整限额</a-button>
        </div>
      </div>
    </template>
  </a-drawer>
</template>

<style lang="scss" scoped>
.cost-detail { display: flex; flex-direction: column; gap: 20px; color: $color-text-primary; }
.key-identity { display: flex; gap: 12px; align-items: center; }
.key-icon { display: grid; place-items: center; flex-shrink: 0; width: 44px; height: 44px; background: $color-bg-secondary; border: 1px solid $color-border; border-radius: $radius-card; color: $color-text-secondary; font-size: 20px; }
.key-info { min-width: 0; flex: 1; }
.key-name-row {
  display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 4px;
  h3 { font-size: $font-size-h3; font-weight: 600; margin: 0; overflow-wrap: anywhere; }
  :deep(.ant-tag) { margin: 0; }
}
.key-info code { color: $color-text-secondary; font-size: 12px; font-family: 'SF Mono', Consolas, monospace; overflow-wrap: anywhere; }
.budget-summary {
  padding: 14px 16px; border-radius: $radius-button; background: $color-bg-secondary; border: 1px solid $color-border;
  p { margin: 8px 0 0; font-size: $font-size-caption; line-height: 1.7; color: $color-text-secondary; }
  &.state-limited { background: theme-alpha('danger', .04); border-color: theme-alpha('danger', .25); }
  &.state-unknown { background: theme-alpha('warning', .05); border-color: theme-alpha('warning', .3); }
}
.summary-heading { display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; :deep(.ant-tag) { margin: 0; } }
.summary-label { font-size: $font-size-body; font-weight: 500; }
.active-limits, .recovery-time { display: flex; align-items: baseline; flex-wrap: wrap; gap: 8px; margin-top: 12px; font-size: $font-size-caption; > span { color: $color-text-secondary; } }
.active-limits :deep(.ant-tag) { margin: 0; }
.recovery-time strong { font-weight: 500; font-variant-numeric: tabular-nums; color: $color-text-primary; overflow-wrap: anywhere; }
.section-heading { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 12px; h3 { font-size: $font-size-body; font-weight: 600; margin: 0; } > span { color: $color-text-secondary; font-size: $font-size-caption; } }
.period-list { display: flex; flex-direction: column; gap: 12px; }
.period-caption { margin: 10px 0 0; color: $color-text-tertiary; font-size: $font-size-caption; line-height: 1.7; }
.cost-notes {
  display: flex; align-items: baseline; gap: 8px; padding-top: 16px; border-top: 1px solid $color-border; color: $color-text-secondary;
  h4 { margin: 0 0 4px; font-size: $font-size-caption; font-weight: 500; color: $color-text-secondary; }
  p { margin: 0; font-size: $font-size-caption; line-height: 1.8; }
}
.loading-state { display: flex; flex-direction: column; gap: 24px; }
.drawer-footer { display: flex; justify-content: space-between; align-items: center; gap: 16px; padding: 4px 0; }
.snapshot-time { color: $color-text-secondary; font-size: $font-size-caption; line-height: 1.5; time { font-variant-numeric: tabular-nums; white-space: nowrap; } }
.footer-actions { display: flex; flex-shrink: 0; gap: 8px; }
@media (max-width: 480px) {
  .drawer-footer { flex-wrap: wrap; gap: 12px; }
  .footer-actions { margin-left: auto; }
}
</style>
