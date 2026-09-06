<script setup lang="ts">
import { computed, ref } from 'vue'
import Decimal from 'decimal.js'
import type { UsageTimeseriesPoint } from '@/types/usage'
import { formatPreciseYuan, formatYuan } from '@/utils/money'

const props = defineProps<{ points: UsageTimeseriesPoint[]; metric: 'cost' | 'requests' | 'tokens' }>()
const active = ref<UsageTimeseriesPoint | null>(null)
const values = computed(() => props.points.map((point) => props.metric === 'cost' ? (point.estimatedCostFen == null ? null : new Decimal(point.estimatedCostFen)) : new Decimal(props.metric === 'requests' ? point.requestCount : point.totalTokens)))
const range = computed(() => { const valid = values.value.filter((value): value is Decimal => value != null); if (!valid.length) return { min: new Decimal(0), max: new Decimal(1) }; const min = Decimal.min(...valid); const max = Decimal.max(...valid); return { min, max: max.eq(min) ? min.plus(1) : max } })
const points = computed(() => props.points.map((point, index) => { const value = values.value[index]; const x = props.points.length < 2 ? 50 : 8 + (84 * index) / (props.points.length - 1); const y = value == null ? null : 86 - Number(value.minus(range.value.min).div(range.value.max.minus(range.value.min)).mul(72)); return { point, x, y, label: props.metric === 'cost' ? formatYuan(point.estimatedCostFen) : value?.toFixed() } }))
const segments = computed(() => { const output: string[] = []; let current: string[] = []; points.value.forEach((point) => { if (point.y == null) { if (current.length) output.push(current.join(' ')); current = [] } else current.push(`${point.x},${point.y}`) }); if (current.length) output.push(current.join(' ')); return output })
function precise(point: UsageTimeseriesPoint) { return props.metric === 'cost' ? formatPreciseYuan(point.estimatedCostFen) : String(props.metric === 'requests' ? point.requestCount : point.totalTokens) }
</script>
<template>
  <div class="chart" role="region" aria-label="用量趋势图"><svg viewBox="0 0 100 100" role="img"><title>用量趋势</title><desc>可通过键盘聚焦数据点读取精确值</desc><line x1="8" x2="92" y1="86" y2="86" stroke="#f0f0f0" /><polyline v-for="(segment, index) in segments" :key="index" :points="segment" fill="none" stroke="#1677ff" stroke-width="1.2" vector-effect="non-scaling-stroke" /><circle v-for="item in points.filter((item) => item.y != null)" :key="item.point.bucketStart" :cx="item.x" :cy="item.y ?? 0" r="1.8" fill="#1677ff" tabindex="0" @focus="active = item.point" @mouseenter="active = item.point" /></svg><div v-if="active" class="tooltip">{{ active.bucketStart }}：{{ precise(active) }}；请求 {{ active.requestCount }}；不可计算 {{ active.uncalculableRequestCount }}</div><div class="sr-only"><div v-for="point in props.points" :key="point.bucketStart">{{ point.bucketStart }}：{{ precise(point) }}</div></div></div>
</template>
<style lang="scss" scoped>.chart { min-height: 250px; }.chart svg { width: 100%; height: 240px; overflow: visible; }.tooltip { color: $color-text-secondary; font-size: 12px; }.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0,0,0,0); }</style>
