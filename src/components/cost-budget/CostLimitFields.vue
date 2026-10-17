<script setup lang="ts">
import { budgetYuanToFenString } from '@/utils/costBudget'
import type { CostLimitDraft } from '@/types/costBudget'
const props = defineProps<{ modelValue: CostLimitDraft; disabled?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: CostLimitDraft] }>()
const fields = [{ key: 'daily', label: '日限额（元）', hint: '每日 00:00 至次日 00:00' },
  { key: 'weekly', label: '周限额（元）', hint: '每周一 00:00 至下周一 00:00（周一至周日）' },
  { key: 'monthly', label: '月限额（元）', hint: '每月 1 日 00:00 至下月 1 日 00:00' }] as const
function error(value: string) { try { budgetYuanToFenString(value); return '' } catch (e) { return (e as Error).message } }
function limit(field: keyof CostLimitDraft, value: string | boolean) { emit('update:modelValue', { ...props.modelValue, [field]: value }) }
</script>
<template>
      <div class="limit-fields">
        <a-form-item v-for="field in fields" :key="field.key" :label="field.label" :colon="false" :label-col="{ span: 24 }" :wrapper-col="{ span: 24 }" :validate-status="error(modelValue[field.key]) ? 'error' : undefined" :help="error(modelValue[field.key])">
          <a-input :value="modelValue[field.key]" :disabled="disabled" inputmode="decimal" placeholder="留空表示该周期不限" @update:value="limit(field.key, $event)" />
          <p class="hint">{{ field.hint }}</p>
        </a-form-item>
      </div>
</template>
<style lang="scss" scoped>
.limit-fields { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); align-items: start; gap: 24px; }
:deep(.ant-form-item) { min-width: 0; margin-bottom: 0; }
:deep(.ant-form-item-row) { flex-direction: column; align-items: stretch; }
:deep(.ant-form-item-label) { flex: none; padding: 0 0 8px; text-align: left; white-space: normal; }
:deep(.ant-form-item-control) { flex: none; width: 100%; min-width: 0; max-width: 100%; }
:deep(.ant-input) { width: 100%; }
.hint { margin: 8px 0 0; color: $color-text-secondary; font-size: $font-size-caption; line-height: 1.8; }
@media (max-width: 760px) { .limit-fields { grid-template-columns: minmax(0, 1fr); gap: 20px; } }
</style>
