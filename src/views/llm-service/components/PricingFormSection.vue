<script setup lang="ts">
import { computed } from 'vue'
import type { PricingRequest, BillingMode, PeakPeriod, TokenPricingEnabled, RequestPricingEnabled } from '@/types/llmService'
import { fenToYuanDecimal, yuanToFenString } from '@/utils/money'
import PeakPeriodEditor from './PeakPeriodEditor.vue'

const props = defineProps<{ modelValue: PricingRequest | undefined }>()
const emit = defineEmits<{ (e: 'update:modelValue', value: PricingRequest): void }>()

const enabled = computed(() => props.modelValue?.enabled === true)

function activePricing(): TokenPricingEnabled | RequestPricingEnabled | undefined {
  const value = props.modelValue
  if (!value || !value.enabled) return undefined
  return value
}
const pricing = computed(() => activePricing())
const mode = computed<BillingMode>(() => activePricing()?.billingMode === 'REQUEST' ? 'REQUEST' : 'TOKEN')

function yuan(fen: string | null | undefined) { return fen == null ? '' : fenToYuanDecimal(fen).toFixed() }

function setEnabled(value: boolean) {
  emit('update:modelValue', value
    ? { enabled: true, billingMode: 'TOKEN', baseTokenPrices: { cacheMissInputPriceFen: '0', cacheHitInputPriceFen: null, outputPriceFen: '0' }, peakPeriods: [] }
    : { enabled: false })
}
function setMode(value: BillingMode) {
  emit('update:modelValue', value === 'TOKEN'
    ? { enabled: true, billingMode: 'TOKEN', baseTokenPrices: { cacheMissInputPriceFen: '0', cacheHitInputPriceFen: null, outputPriceFen: '0' }, peakPeriods: [] }
    : { enabled: true, billingMode: 'REQUEST', baseRequestPriceFen: '0', peakPeriods: [] })
}
function setToken(field: 'cacheMissInputPriceFen' | 'cacheHitInputPriceFen' | 'outputPriceFen', value: string) {
  const p = activePricing()
  if (!p || p.billingMode !== 'TOKEN') return
  emit('update:modelValue', { ...p, baseTokenPrices: { ...p.baseTokenPrices, [field]: value === '' && field === 'cacheHitInputPriceFen' ? null : yuanToFenString(value || '0') } })
}
function setRequest(value: string) {
  const p = activePricing()
  if (!p || p.billingMode !== 'REQUEST') return
  emit('update:modelValue', { ...p, baseRequestPriceFen: yuanToFenString(value || '0') })
}
function setPeriods(periods: PeakPeriod[]) {
  const p = activePricing()
  if (!p) return
  emit('update:modelValue', { ...p, peakPeriods: periods })
}
</script>

<template>
  <a-form-item label="启用预估计费">
    <a-switch :checked="enabled" @update:checked="setEnabled" />
    <span class="switch-tip">关闭后模型仍可调用</span>
  </a-form-item>
  <template v-if="enabled && pricing">
    <a-form-item label="计费方式"><a-radio-group :value="mode" @update:value="setMode"><a-radio value="TOKEN">按 Token</a-radio><a-radio value="REQUEST">按成功请求</a-radio></a-radio-group></a-form-item>
    <template v-if="pricing.billingMode === 'TOKEN'">
      <a-form-item label="缓存未命中输入价（元 / 百万 Token）"><a-input :value="yuan(pricing.baseTokenPrices.cacheMissInputPriceFen)" inputmode="decimal" @change="setToken('cacheMissInputPriceFen', ($event.target as HTMLInputElement).value)" /></a-form-item>
      <a-form-item label="缓存命中输入价（元 / 百万 Token，可选）"><a-input :value="yuan(pricing.baseTokenPrices.cacheHitInputPriceFen)" inputmode="decimal" @change="setToken('cacheHitInputPriceFen', ($event.target as HTMLInputElement).value)" /><div class="hint">留空时使用同一时段的缓存未命中输入价</div></a-form-item>
      <a-form-item label="输出价（元 / 百万 Token）"><a-input :value="yuan(pricing.baseTokenPrices.outputPriceFen)" inputmode="decimal" @change="setToken('outputPriceFen', ($event.target as HTMLInputElement).value)" /></a-form-item>
    </template>
    <a-form-item v-else label="每次成功请求价格（元）"><a-input :value="yuan(pricing.baseRequestPriceFen)" inputmode="decimal" @change="setRequest(($event.target as HTMLInputElement).value)" /></a-form-item>
    <PeakPeriodEditor :model-value="pricing.peakPeriods" :mode="pricing.billingMode" @update:model-value="setPeriods" />
  </template>
</template>

<style lang="scss" scoped>.switch-tip, .hint { margin-left: 8px; color: $color-text-secondary; font-size: 12px; }.hint { margin-left: 0; margin-top: 4px; }</style>
