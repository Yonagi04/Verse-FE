<script setup lang="ts">
import type { CostWarningConfig } from '@/types/costBudget'
const props = defineProps<{ modelValue: CostWarningConfig; disabled?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: CostWarningConfig] }>()
function updateWarning(value: Partial<CostWarningConfig>) { emit('update:modelValue', { ...props.modelValue, ...value }) }
</script>
<template>
  <div class="warning-fields">
        <a-form-item class="threshold-field" label="预警阈值" :colon="false" :label-col="{ span: 24 }" :wrapper-col="{ span: 24 }">
          <div class="threshold-heading"><span class="hint">所有已配置周期共用</span><strong>{{ modelValue.thresholdPercent }}%</strong></div>
          <a-slider :value="modelValue.thresholdPercent" :min="50" :max="99" :step="1" :marks="{ 50: '50%', 80: '80%', 99: '99%' }" :disabled="disabled" @update:value="updateWarning({ thresholdPercent: $event as number })" />
        </a-form-item>
        <a-form-item label="阈值预警渠道" :colon="false" :label-col="{ span: 24 }" :wrapper-col="{ span: 24 }" :validate-status="modelValue.channels.length ? undefined : 'error'" :help="modelValue.channels.length ? undefined : '开启预警时至少选择一个渠道'">
          <a-checkbox-group :value="modelValue.channels" :disabled="disabled" @update:value="updateWarning({ channels: $event as CostWarningConfig['channels'] })">
            <a-checkbox value="IN_APP">站内系统公告</a-checkbox><a-checkbox value="SMS">短信</a-checkbox><a-checkbox value="EMAIL">邮件</a-checkbox>
          </a-checkbox-group>
          <p class="hint">站内公告面向全体成员，短信和邮件仅发送给有效管理员。</p>
        </a-form-item>
  </div>
</template>
<style lang="scss" scoped>
.warning-fields { display: grid; gap: 28px; min-width: 0; }
:deep(.ant-form-item) { margin-bottom: 0; min-width: 0; }
:deep(.ant-form-item-row) { flex-direction: column; align-items: stretch; }
:deep(.ant-form-item-label) { flex: none; padding: 0 0 8px; text-align: left; white-space: normal; }
:deep(.ant-form-item-control) { flex: none; width: 100%; min-width: 0; max-width: 100%; }
.hint { margin: 8px 0 0; color: $color-text-secondary; font-size: $font-size-caption; line-height: 1.8; }
.threshold-heading { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.threshold-heading .hint { margin: 0; }
:deep(.ant-slider) { margin: 12px 12px 24px; }
:deep(.ant-checkbox-group) { display: flex; align-items: center; flex-wrap: wrap; gap: 12px 24px; }
:deep(.ant-checkbox-wrapper) { display: inline-flex; align-items: center; margin-inline: 0; min-height: 24px; line-height: 24px; }
</style>
