<script setup lang="ts">
import type { CostLimitDraft } from '@/types/costBudget'
const props = defineProps<{ modelValue: CostLimitDraft; disabled?: boolean }>()
const emit = defineEmits<{ (e: 'update:modelValue', value: CostLimitDraft): void }>()
function update(field: keyof CostLimitDraft, value: string | boolean) { emit('update:modelValue', { ...props.modelValue, [field]: value }) }
const fields = [
  { key: 'daily', name: '日限额（元）', hint: '每日 00:00 至次日 00:00' },
  { key: 'weekly', name: '周限额（元）', hint: '每周一 00:00 至下周一 00:00（周一至周日）' },
  { key: 'monthly', name: '月限额（元）', hint: '每月 1 日 00:00 至下月 1 日 00:00' },
] as const
</script>
<template>
  <section class="cost-section">
    <a-form-item label="调用成本限额">
      <a-switch :checked="modelValue.enabled" :disabled="disabled" @update:checked="update('enabled', $event)" />
      <span class="switch-label">开启成本限额</span>
    </a-form-item>
    <p class="hint">成本限额仅累计已配置价格且可计算的预估费用，未计价不代表免费。达到限额后停止新的调用，已开始的调用可能继续产生费用。</p>
    <template v-if="modelValue.enabled">
      <a-form-item v-for="field in fields" :key="field.key" :label="field.name">
        <a-input :value="modelValue[field.key]" :disabled="disabled" inputmode="decimal" placeholder="留空表示该周期不限"
          @update:value="update(field.key, $event)" />
        <div class="hint">{{ field.hint }}</div>
      </a-form-item>
      <p class="hint">以上时间均为北京时间 GMT+8。开启时至少填写一个周期，保存后按新限额重新判断。</p>
      <p class="hint">例如：设置日限额 10 元、周限额 30 元。每日累计预估费用达到 10 元后，当日停止新调用；周一至周三每天消费 10 元，周三累计达到 30 元后，将持续限制至下周一 00:00。已开始的调用可能继续产生费用。以上时间均为 GMT+8。</p>
    </template>
  </section>
</template>
<style lang="scss" scoped>
.cost-section { border-top: 1px solid $color-border; padding-top: 16px; margin-top: 8px; }
.switch-label { margin-left: 12px; }
.hint { color: $color-text-secondary; font-size: 12px; line-height: 1.7; margin-top: 6px; }
</style>
