<script setup lang="ts">
import { computed } from 'vue'
import type { UsageSummary, UsageTimeseriesPoint } from '@/types/usage'
import { formatYuan, sumFen } from '@/utils/money'

const props = defineProps<{ summary?: UsageSummary | null; personalPoints?: UsageTimeseriesPoint[]; member?: boolean }>()
const personalCost = computed(() => sumFen(props.personalPoints?.map((point) => point.estimatedCostFen) ?? []))
const totalTokens = computed(() => (props.personalPoints ?? []).reduce((total, point) => total + point.totalTokens, 0))
const requests = computed(() => (props.personalPoints ?? []).reduce((total, point) => total + point.requestCount, 0))
const cost = computed(() => props.member ? formatYuan(personalCost.value, '暂无可计算费用') : formatYuan(props.summary?.total?.estimatedCostFen, '暂无可计算费用'))
</script>
<template>
  <a-row :gutter="16" class="summary-cards">
    <a-col :xs="24" :sm="8"><a-card :bordered="false"><a-statistic :title="member ? '我的预估费用' : '租户预估费用'" :value="cost" /><a-alert v-if="!member && (summary?.total?.uncalculableRequestCount ?? 0) > 0" type="warning" show-icon :message="`${summary?.total?.uncalculableRequestCount} 个请求无法计算费用`" /></a-card></a-col>
    <a-col :xs="24" :sm="8"><a-card :bordered="false"><a-statistic title="请求数" :value="member ? requests : (summary?.total?.requestCount ?? 0)" /></a-card></a-col>
    <a-col :xs="24" :sm="8"><a-card :bordered="false"><a-statistic title="总 Token" :value="member ? totalTokens : (summary?.total?.totalTokens ?? 0)" /><div v-if="!member && (summary?.unpricedModelCount ?? 0) > 0" class="warning">{{ summary?.unpricedModelCount }} 个未计费模型未纳入费用</div></a-card></a-col>
  </a-row>
</template>
<style lang="scss" scoped>.summary-cards { margin-bottom: 16px; }.warning { margin-top: 8px; color: $color-warning; font-size: 12px; }</style>
