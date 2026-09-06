<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useTenantStore } from '@/stores/tenant'
import { getUsageTimeseries } from '@/api/usage'
import type { UsageGranularity, UsageReport } from '@/types/usage'
import UsageTrendChart from './components/UsageTrendChart.vue'
import UsageSummaryCards from './components/UsageSummaryCards.vue'
const tenantStore=useTenantStore(); const tenantId=computed(()=>tenantStore.currentTenantId??tenantStore.tenants[0]?.tenantId??null)
const granularity=ref<UsageGranularity>('day'); const report=ref<UsageReport|null>(null); const loading=ref(false); const error=ref(''); let sequence=0
async function load(){const id=tenantId.value;const current=++sequence;if(!id){report.value=null;return} loading.value=true;error.value='';try{const value=await getUsageTimeseries(id,{granularity:granularity.value});if(current===sequence)report.value=value}catch(e){if(current===sequence){error.value=e instanceof Error?e.message:'加载失败';report.value=null}}finally{if(current===sequence)loading.value=false}}
onMounted(async()=>{if(!tenantStore.tenants.length)await tenantStore.fetchTenants();await load()}); watch([tenantId,granularity],load)
</script>
<template><div class="usage-page"><div class="header"><div><h2>用量统计</h2><p>查看当前权限范围内的 Token 与预估费用</p></div><a-select v-model:value="granularity" style="width:140px"><a-select-option value="hour">最近24小时</a-select-option><a-select-option value="day">最近7天</a-select-option><a-select-option value="week">最近8周</a-select-option><a-select-option value="month">最近6个月</a-select-option></a-select></div><a-alert v-if="error" type="error" :message="error" show-icon/><UsageSummaryCards :metrics="report?.total??null" :loading="loading"/><UsageTrendChart class="trend" title="Token 用量趋势" :points="report?.points??[]" :loading="loading" :data-delay-minutes="report?.dataDelayMinutes"/></div></template>
<style scoped>.usage-page{max-width:1200px}.header{display:flex;justify-content:space-between;align-items:center;margin-bottom:20px}.header h2{margin:0}.header p{color:#8c8c8c;margin:6px 0 0}.trend{margin-top:16px}@media(max-width:576px){.header{align-items:flex-start;gap:12px;flex-direction:column}}</style>
