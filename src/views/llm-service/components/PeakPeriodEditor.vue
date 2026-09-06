<script setup lang="ts">
import { computed } from 'vue'
import type { BillingMode, PeakPeriod } from '@/types/llmService'
import { validatePeakPeriods } from '@/utils/peakPeriod'
import { fenToYuanDecimal, yuanToFenString } from '@/utils/money'

const props = defineProps<{ modelValue: PeakPeriod[]; mode: BillingMode }>()
const emit = defineEmits<{ (e: 'update:modelValue', value: PeakPeriod[]): void }>()
const weekdayOptions = [{ label: '周一', value: 1 }, { label: '周二', value: 2 }, { label: '周三', value: 3 }, { label: '周四', value: 4 }, { label: '周五', value: 5 }, { label: '周六', value: 6 }, { label: '周日', value: 7 }]
const validation = computed(() => validatePeakPeriods(props.modelValue))

function patch(index: number, value: Partial<PeakPeriod>) { emit('update:modelValue', props.modelValue.map((period, i) => i === index ? { ...period, ...value } : period)) }
function add() { emit('update:modelValue', [...props.modelValue, { weekdays: [1, 2, 3, 4, 5], startTime: '09:00', endTime: '18:00', ...(props.mode === 'TOKEN' ? { tokenPrices: { cacheMissInputPriceFen: '0', cacheHitInputPriceFen: null, outputPriceFen: '0' } } : { requestPriceFen: '0' }) }]) }
function remove(index: number) { emit('update:modelValue', props.modelValue.filter((_, i) => i !== index)) }
function setPreset(index: number, preset: 'workdays' | 'everyday') { patch(index, { weekdays: preset === 'workdays' ? [1, 2, 3, 4, 5] : [1, 2, 3, 4, 5, 6, 7] }) }
function yuan(fen: string | null | undefined) { return fen == null ? '' : fenToYuanDecimal(fen).toFixed() }
function setTokenPrice(index: number, field: 'cacheMissInputPriceFen' | 'cacheHitInputPriceFen' | 'outputPriceFen', value: string) {
  const prices = props.modelValue[index]?.tokenPrices
  if (!prices) return
  const priceFen = value === '' && field === 'cacheHitInputPriceFen' ? null : yuanToFenString(value || '0')
  patch(index, { tokenPrices: { ...prices, [field]: priceFen } })
}
function setRequestPrice(index: number, value: string) { patch(index, { requestPriceFen: yuanToFenString(value || '0') }) }
</script>

<template>
  <a-collapse ghost>
    <a-collapse-panel key="peak" header="高峰时段（可选）">
      <p class="hint">时间范围均以 Asia/Shanghai 时区为准</p>
      <div v-for="(period, index) in modelValue" :key="index" class="period-row">
        <div class="period-actions">
          <a-button size="small" @click="setPreset(index, 'workdays')">工作日</a-button>
          <a-button size="small" @click="setPreset(index, 'everyday')">每天</a-button>
          <a-button size="small" danger @click="remove(index)">删除</a-button>
        </div>
        <a-checkbox-group :value="period.weekdays" :options="weekdayOptions" @update:value="patch(index, { weekdays: $event })" />
        <div class="time-row"><a-time-picker value-format="HH:mm" :value="period.startTime" @update:value="patch(index, { startTime: $event })" /><span>至</span><a-time-picker value-format="HH:mm" :value="period.endTime" @update:value="patch(index, { endTime: $event })" /></div>
        <div v-if="mode === 'TOKEN' && period.tokenPrices" class="price-grid">
          <a-form-item label="缓存未命中输入价（元 / 百万 Token）">
            <a-input :value="yuan(period.tokenPrices.cacheMissInputPriceFen)" inputmode="decimal" @change="setTokenPrice(index, 'cacheMissInputPriceFen', ($event.target as HTMLInputElement).value)" />
          </a-form-item>
          <a-form-item label="缓存命中输入价（元 / 百万 Token，可选）">
            <a-input :value="yuan(period.tokenPrices.cacheHitInputPriceFen)" inputmode="decimal" @change="setTokenPrice(index, 'cacheHitInputPriceFen', ($event.target as HTMLInputElement).value)" />
          </a-form-item>
          <a-form-item label="输出价（元 / 百万 Token）">
            <a-input :value="yuan(period.tokenPrices.outputPriceFen)" inputmode="decimal" @change="setTokenPrice(index, 'outputPriceFen', ($event.target as HTMLInputElement).value)" />
          </a-form-item>
        </div>
        <a-form-item v-else-if="mode === 'REQUEST'" label="每次成功请求价格（元）" class="request-price">
          <a-input :value="yuan(period.requestPriceFen)" inputmode="decimal" @change="setRequestPrice(index, ($event.target as HTMLInputElement).value)" />
        </a-form-item>
      </div>
      <a-alert v-if="!validation.valid" type="error" show-icon :message="validation.message" />
      <a-button type="dashed" block @click="add">添加高峰时段</a-button>
    </a-collapse-panel>
  </a-collapse>
</template>

<style lang="scss" scoped>
.hint { margin: 0 0 12px; color: $color-text-secondary; font-size: 12px; }
.period-row { padding: 12px; margin-bottom: 12px; background: $color-bg-secondary; border: 1px solid $color-border; border-radius: $radius-input; }
.period-actions, .time-row { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }.period-actions { justify-content: flex-end; }
.price-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 12px; }
.price-grid :deep(.ant-form-item), .request-price { margin-bottom: 10px; }
@media (max-width: 640px) { .price-grid { grid-template-columns: 1fr; } }
</style>
