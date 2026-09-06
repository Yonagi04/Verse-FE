<script setup lang="ts">
import type { UsageMetrics } from '@/types/usage'
import { formatYuan } from '@/utils/money'
defineProps<{metrics:UsageMetrics|null;loading?:boolean}>()
const format=(v?:string)=>v==null?'--':BigInt(v).toLocaleString()
</script>
<template><a-row :gutter="[16,16]">
 <a-col v-for="item in [{l:'总 Token',v:format(metrics?.totalTokens)},{l:'成功请求',v:format(metrics?.requestCount)},{l:'预估费用',v:metrics?formatYuan(metrics.estimatedCostFen):'--'},{l:'未定价请求',v:format(metrics?.unpricedCount)}]" :key="item.l" :xs="24" :sm="12" :lg="6"><a-card :loading="loading"><a-statistic :title="item.l" :value="item.v"/></a-card></a-col>
 </a-row>
</template>
