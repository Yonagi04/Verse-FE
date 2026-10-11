<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import type { CostLimitDraft } from '@/types/costBudget'
import type { LlmCostWarningConfig, CostNotificationReadiness } from '@/types/llmCostBudget'
import { getCostNotificationReadiness } from '@/api/llmCostBudget'
import { COST_WARNING_CHANNEL_LABELS } from '@/utils/llmCostBudget'
const props = defineProps<{
  modelValue: CostLimitDraft
  warning: LlmCostWarningConfig
  pricingEligible: boolean
  tenantId: string
  disabled?: boolean
  availability?: 'READY' | 'INITIALIZING' | 'UNAVAILABLE'
}>()
const emit = defineEmits<{ (e: 'update:modelValue', value: CostLimitDraft): void; (e: 'update:warning', value: LlmCostWarningConfig): void }>()
const readiness = ref<CostNotificationReadiness | null>(null)
const readinessLoading = ref(false)
let revision = 0
const dataUnavailable = computed(() => props.availability !== undefined && props.availability !== 'READY')
const warningEffective = computed(() => props.modelValue.enabled && props.pricingEligible && !dataUnavailable.value)
const fields = [{ key: 'daily', label: '日限额（元）', hint: '每日 00:00 至次日 00:00' },
  { key: 'weekly', label: '周限额（元）', hint: '每周一 00:00 至下周一 00:00（周一至周日）' },
  { key: 'monthly', label: '月限额（元）', hint: '每月 1 日 00:00 至下月 1 日 00:00' }] as const
watch(() => [props.tenantId, props.modelValue.enabled] as const, async ([tenant, enabled]) => {
  const ticket = ++revision
  readiness.value = null
  readinessLoading.value = false
  if (!enabled || !tenant) return
  readinessLoading.value = true
  try {
    const result = await getCostNotificationReadiness(tenant)
    if (ticket === revision) readiness.value = result
  } catch { /* 缺口查询失败不阻断保存。 */ }
  finally { if (ticket === revision) readinessLoading.value = false }
}, { immediate: true })
onBeforeUnmount(() => { revision++ })
const readinessGaps = computed(() => {
  if (!readiness.value) return []
  const { administrators, channels } = readiness.value
  const reasons: Record<string, string> = { CHANNEL_DISABLED: '渠道尚未启用', TEMPLATE_MISSING: '签名或通知模板缺失', CHANNEL_NOT_CONFIGURED: '渠道尚未配置完整' }
  const gaps = channels.filter(channel => !channel.configured).map(channel => `${COST_WARNING_CHANNEL_LABELS[channel.channel]}：${reasons[channel.reasonCode ?? ''] || '渠道暂不可用'}，请联系平台管理员`)
  if (administrators.missingPhoneCount) gaps.push(`${administrators.missingPhoneCount} 位管理员未绑定可用手机号`)
  if (administrators.missingEmailCount) gaps.push(`${administrators.missingEmailCount} 位管理员未绑定可用邮箱`)
  if (!administrators.total) gaps.push('当前没有有效管理员接收短信和邮件')
  return gaps
})
function limit(field: keyof CostLimitDraft, value: string | boolean) { emit('update:modelValue', { ...props.modelValue, [field]: value }) }
function updateWarning(value: Partial<LlmCostWarningConfig>) { emit('update:warning', { ...props.warning, ...value }) }
</script>
<template>
  <section class="cost-form" aria-label="调用成本限额配置">
    <div class="section-heading">
      <div><h3>调用成本限额</h3><p class="hint">预算消耗：API + PlayGround</p></div>
      <a-switch :checked="modelValue.enabled" aria-label="开启成本限额"
        :disabled="disabled || ((!pricingEligible || dataUnavailable) && !modelValue.enabled)" @update:checked="limit('enabled', $event)" />
    </div>
    <p class="hint">达到任一周期限额后停止此模型的新调用，已开始的调用可能继续产生费用。</p>
    <a-alert v-if="!pricingEligible" type="warning" message="请先配置模型价格" description="启用完整有效的 Token 或按请求价格后，才能开启成本限额。零价格也可使用。" show-icon />
    <a-alert v-if="dataUnavailable" type="warning" :message="availability === 'INITIALIZING' ? '历史费用尚未完成核对' : '消费数据暂不可用'"
      :description="availability === 'INITIALIZING'
        ? '平台需完成历史费用回填与核对后，才能开启成本限额。刷新页面不会自动完成核对；已开启的限额仍可关闭。'
        : '当前无法可靠核对费用，暂不能开启成本限额；已开启的限额仍可关闭。'" show-icon />
    <template v-if="modelValue.enabled">
      <div class="limit-fields">
        <a-form-item v-for="field in fields" :key="field.key" :label="field.label">
          <a-input :value="modelValue[field.key]" :disabled="disabled" inputmode="decimal" placeholder="留空表示该周期不限" @update:value="limit(field.key, $event)" />
          <p class="hint">{{ field.hint }}</p>
        </a-form-item>
      </div>
      <p class="hint">北京时间 GMT+8 · 至少填写一个周期，金额大于 0，最多两位小数。保存后按新限额重新判断，本周期历史费用不清零。</p>
      <p class="hint example">例如：设置该模型日限额 10 元后，API 与 PlayGround 的可计算费用合计达到 10 元，当日所有对此模型的新调用都会被限制。次日 00:00 重置日周期；如周或月限额也已达到，限制将继续。已开始的调用可能继续产生费用。以上时间均为 GMT+8。</p>
    </template>
    <p v-else class="hint">当前不执行模型成本限制，关闭前填写的限额和预警设置会保留。</p>

    <div class="warning-section">
      <div class="section-heading">
        <div><h4>成本预警</h4><p class="hint">在达到限额前提醒，预警不会停止调用。</p></div>
        <a-switch :checked="warning.enabled" aria-label="开启成本预警" :disabled="disabled || (!warningEffective && !warning.enabled)" @update:checked="updateWarning({ enabled: $event })" />
      </div>
      <p v-if="!warningEffective" class="hint">{{ warning.enabled ? '预警设置已保留，当前不生效；可关闭预警。' : '有效价格与成本限额开启后，可设置预警。' }}</p>
      <template v-if="modelValue.enabled && warning.enabled">
        <a-form-item class="threshold-field" label="预警阈值">
          <div class="threshold-heading"><span class="hint">所有已配置周期共用</span><strong>{{ warning.thresholdPercent }}%</strong></div>
          <a-slider :value="warning.thresholdPercent" :min="50" :max="99" :step="1" :marks="{ 50: '50%', 80: '80%', 99: '99%' }" :disabled="disabled || !warningEffective" @update:value="updateWarning({ thresholdPercent: $event as number })" />
        </a-form-item>
        <a-form-item label="阈值预警渠道" :validate-status="warning.channels.length ? undefined : 'error'" :help="warning.channels.length ? undefined : '开启预警时至少选择一个渠道'">
          <a-checkbox-group :value="warning.channels" :disabled="disabled || !warningEffective" @update:value="updateWarning({ channels: $event as LlmCostWarningConfig['channels'] })">
            <a-checkbox value="IN_APP">站内系统公告</a-checkbox><a-checkbox value="SMS">短信</a-checkbox><a-checkbox value="EMAIL">邮件</a-checkbox>
          </a-checkbox-group>
          <p class="hint">站内公告面向全体成员，短信和邮件仅发送给有效管理员。</p>
        </a-form-item>
        <p class="hint example">例如：日限额 10 元、周限额 30 元，预警阈值设置为 80%，则今日消费达到 8 元、本周消费达到 24 元时，分别通过所选渠道发送一次预警。预警不会停止调用；达到任一周期 100% 限额后才限制新的调用，并固定发送三种达限通知。所有周期使用北京时间 GMT+8。</p>
      </template>
    </div>
    <aside v-if="modelValue.enabled" class="notification-section">
      <h4>达限通知 <span class="optional">固定开启</span></h4>
      <p class="hint">达到成本限额时，系统仍会向全体成员发送站内公告，并向管理员发送短信和邮件，且记录租户动态（已开启动态记录时）。</p>
      <p class="hint">达限通知不受预警开关和预警渠道选择影响。</p>
      <p v-if="readinessLoading" class="hint" role="status">正在查询通知配置…</p>
      <a-alert v-else-if="!readiness" type="warning" message="通知能力暂不可查询" description="这不影响保存合法预算，可稍后重新查看。" show-icon />
      <a-alert v-else-if="readinessGaps.length" type="warning" message="部分通知渠道需要补充配置" show-icon>
        <template #description><ul class="readiness-gaps"><li v-for="gap in readinessGaps" :key="gap">{{ gap }}</li></ul><p>不影响预算保存或其他渠道通知，请补充绑定或联系平台管理员。</p></template>
      </a-alert>
      <p v-else class="hint">通知配置已齐备，覆盖 {{ readiness.administrators.total }} 位有效管理员。实际发送结果以系统记录为准。</p>
    </aside>
  </section>
</template>
<style lang="scss" scoped>
.cost-form { border-top: 1px solid $color-border; margin-top: 16px; padding-top: 20px; color: $color-text-primary; }
.section-heading { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 8px; }
h3, h4 { margin: 0; font-size: $font-size-body; font-weight: 600; }
h3 { font-size: $font-size-h3; }
.hint { color: $color-text-secondary; font-size: $font-size-caption; line-height: 1.7; margin: 6px 0 0; }
.optional { color: $color-text-tertiary; font-size: $font-size-caption; font-weight: 400; margin-left: 6px; }
.limit-fields { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 16px; margin-top: 16px; :deep(.ant-form-item) { margin-bottom: 0; } }
.example { padding: 12px; background: $color-bg-secondary; border-radius: $radius-button; margin-top: 12px; }
.warning-section { border-top: 1px solid $color-border; margin-top: 20px; padding-top: 20px; }
.threshold-field { margin-top: 16px; }
.threshold-heading { display: flex; justify-content: space-between; align-items: center; gap: 12px; strong { color: $color-primary; font-size: $font-size-h3; font-variant-numeric: tabular-nums; } }
:deep(.ant-slider) { margin-left: 12px; margin-right: 12px; }
:deep(.ant-checkbox-group) { display: flex; flex-wrap: wrap; gap: 8px 12px; }
.notification-section { margin-top: 20px; padding: 16px; background: $color-bg-secondary; border: 1px solid $color-border; border-radius: $radius-button; }
:deep(.ant-alert) { margin-top: 12px; }
.readiness-gaps { padding-left: 18px; margin: 0 0 8px; }
</style>
