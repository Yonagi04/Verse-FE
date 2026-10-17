<script setup lang="ts">
import type { CostLimitDraft, CostWarningConfig } from '@/types/costBudget'
import type { CostNotificationReadiness } from '@/types/llmCostBudget'
import CostLimitFields from '@/components/cost-budget/CostLimitFields.vue'
import CostWarningFields from '@/components/cost-budget/CostWarningFields.vue'
defineProps<{ modelValue: CostLimitDraft; warning: CostWarningConfig; disabled?: boolean; availability?: string; readiness: CostNotificationReadiness | null }>()
const emit = defineEmits<{ 'update:modelValue': [value: CostLimitDraft]; 'update:warning': [value: CostWarningConfig] }>()
</script>
<template>
  <section class="tenant-budget-form" aria-label="租户调用成本限额">
    <div class="budget-block">
      <div class="section-heading">
        <div>
          <h3>租户调用成本限额</h3>
          <p class="hint">预算消耗：API + PlayGround · 覆盖整个租户的全部模型</p>
        </div>
        <a-switch :checked="modelValue.enabled" aria-label="开启租户成本限额"
          :disabled="disabled || (!modelValue.enabled && availability !== 'READY')"
          @update:checked="emit('update:modelValue', { ...modelValue, enabled: $event })" />
      </div>
      <a-alert v-if="availability !== 'READY'" type="warning" message="消费数据暂不可用，不能开启或修改生效金额；已有预算和预警仍可关闭。" show-icon />
      <CostLimitFields v-if="modelValue.enabled" :model-value="modelValue" :disabled="disabled || availability !== 'READY'" @update:model-value="emit('update:modelValue', $event)" />
      <aside class="example">
        <span class="example-title">限额示例</span>
        <p>租户日限额设为 10 元，全部模型的 API 与 PlayGround 可计算费用合计达到 10 元后，当日所有新模型调用都会受限。</p>
        <p>次日 00:00 重置日周期，周、月限额独立生效。时间均为 GMT+8，已开始的调用可能继续产生费用。</p>
      </aside>
    </div>

    <div class="budget-block warning-block">
      <div class="section-heading">
        <div>
          <h3>成本预警</h3>
          <p class="hint">在达到限额前通过所选渠道提醒，预警不会阻断调用。</p>
        </div>
        <a-switch :checked="warning.enabled" aria-label="开启租户成本预警"
          :disabled="disabled || (!modelValue.enabled && !warning.enabled)"
          @update:checked="emit('update:warning', { ...warning, enabled: $event })" />
      </div>
      <CostWarningFields v-if="warning.enabled && modelValue.enabled" :model-value="warning" :disabled="disabled" @update:model-value="emit('update:warning', $event)" />
      <p v-if="!modelValue.enabled" class="hint">限额与预警草稿已保留，当前不生效；关闭不代表所有模型均可调用。</p>
    </div>

    <aside class="notification-info">
      <div class="notification-heading"><h4>达限通知</h4><span class="fixed-label">固定开启</span></div>
      <p>达到任一周期 100% 限额时，固定发送全员站内公告、管理员短信和邮件；动态记录开启时生成系统动态。</p>
      <p v-if="!readiness" class="readiness">通知能力暂不可查询，不影响保存合法配置。</p>
      <template v-else>
        <p class="readiness">有效管理员 {{ readiness.administrators.total }} 位 · 缺少手机号 {{ readiness.administrators.missingPhoneCount }} 位 · 缺少邮箱 {{ readiness.administrators.missingEmailCount }} 位</p>
        <p>{{ readiness.channels.some(c => !c.configured) ? '部分通知渠道尚未配置完整，请联系平台管理员。' : '平台通知配置已齐备，实际结果以发送记录为准。' }}</p>
      </template>
    </aside>
  </section>
</template>
<style lang="scss" scoped>
.tenant-budget-form { display: grid; gap: 28px; }
.budget-block { display: grid; gap: 18px; min-width: 0; }
.section-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 24px; }
.section-heading > div { min-width: 0; }
.section-heading :deep(.ant-switch) { flex-shrink: 0; margin-top: 2px; }
h3, h4 { margin: 0; color: $color-text-primary; font-size: $font-size-body; font-weight: 600; line-height: 1.6; }
p { margin: 0; }
.hint { color: $color-text-secondary; font-size: $font-size-caption; line-height: 1.85; }
.section-heading .hint { margin-top: 6px; }
.example, .notification-info { padding: 16px 20px; background: $color-bg-secondary; border: 1px solid $color-border; border-radius: $radius-button; color: $color-text-secondary; font-size: $font-size-caption; line-height: 1.85; }
.example-title { display: block; margin-bottom: 6px; font-weight: 500; color: $color-text-secondary; }
.example p + p { margin-top: 6px; }
.warning-block { padding-top: 24px; border-top: 1px solid $color-border; }
.notification-info { display: grid; gap: 8px; }
.notification-heading { display: flex; align-items: center; gap: 10px; margin-bottom: 2px; }
.fixed-label { padding: 1px 7px; border: 1px solid $color-border; border-radius: 4px; color: $color-text-tertiary; font-size: $font-size-caption; }
.readiness { padding-top: 8px; border-top: 1px solid $color-border; }
@media (max-width: 600px) {
  .tenant-budget-form { gap: 24px; }
  .example, .notification-info { padding: 14px 16px; }
  .section-heading { gap: 16px; }
}
</style>
