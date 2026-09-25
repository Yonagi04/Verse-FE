<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import { DownloadOutlined, DownOutlined, FilterOutlined, ReloadOutlined } from '@ant-design/icons-vue'
import { useTenantStore } from '@/stores/tenant'
import { downloadUsageExport, getUsageBreakdown, getUsageFilterOptions, getUsageTimeseries } from '@/api/usage'
import { formatYuan } from '@/utils/money'
import type { UsageBreakdown, UsageBreakdownDimension, UsageBreakdownFilters, UsageBreakdownOrder, UsageExportType, UsageFilterOptions, UsageGranularity, UsageReport } from '@/types/usage'
import UsageBreakdownChart from './components/UsageBreakdownChart.vue'
import UsageTrendChart from './components/UsageTrendChart.vue'
import UsageSummaryCards from './components/UsageSummaryCards.vue'

const tenantStore=useTenantStore()
const tenantId=computed(()=>tenantStore.currentTenantId)
const granularity=ref<UsageGranularity>('day')
const dateRange=ref<[string,string]|null>(null);const userId=ref<string>();const apiKeyId=ref<string>();const serviceId=ref<string>()
const dimension=ref<UsageBreakdownDimension>('model');const orderBy=ref<UsageBreakdownOrder>('totalTokens');const limit=ref(10)
const report=ref<UsageReport|null>(null);const breakdown=ref<UsageBreakdown|null>(null);const options=ref<UsageFilterOptions|null>(null)
const loading=ref(false);const optionsLoading=ref(false);const error=ref('');const exporting=ref<UsageExportType|null>(null)
let reportSequence=0;let optionSequence=0;let timer:number|undefined

function startOfDay(value?:string){return value?`${value}T00:00:00`:undefined}
function startOfNextDay(value?:string){
 if(!value)return undefined
 const [year,month,day]=value.split('-').map(Number)
 const next=new Date(Date.UTC(year,month-1,day+1))
 return `${next.getUTCFullYear()}-${String(next.getUTCMonth()+1).padStart(2,'0')}-${String(next.getUTCDate()).padStart(2,'0')}T00:00:00`
}
const params=computed<UsageBreakdownFilters>(()=>({granularity:granularity.value,from:startOfDay(dateRange.value?.[0]),to:startOfNextDay(dateRange.value?.[1]),userId:userId.value,apiKeyId:apiKeyId.value,serviceId:serviceId.value,dimension:dimension.value,orderBy:orderBy.value,limit:limit.value}))
const hasActiveFilters=computed(()=>Boolean(dateRange.value||userId.value||apiKeyId.value||serviceId.value||granularity.value!=='day'))
const columns=[{title:'名称',dataIndex:'label',key:'label'},{title:'总 Token',key:'totalTokens'},{title:'请求数',key:'requestCount'},{title:'预估费用',key:'cost'},{title:'精确 / 预估 / 未知',key:'quality'},{title:'占比',key:'ratio'}]
const integer=(value:string)=>BigInt(value).toLocaleString()
const percent=(value:string)=>`${(Number(value)*100).toFixed(2)}%`

function validateRange(){const range=dateRange.value;if(!range)return true;if(!range[0]||!range[1]||range[0]>range[1]){error.value='请选择完整且有效的开始、结束日期';return false}return true}
async function loadOptions(){const id=tenantId.value;const current=++optionSequence;if(!id){options.value=null;return}optionsLoading.value=true;try{const value=await getUsageFilterOptions(id);if(current===optionSequence){options.value=value;if(!value.canReadAll&&dimension.value==='member')dimension.value='model';if(userId.value&&!value.members.some(v=>v.id===userId.value))userId.value=undefined;if(apiKeyId.value&&!value.apiKeys.some(v=>v.id===apiKeyId.value))apiKeyId.value=undefined}}catch(e){if(current===optionSequence)error.value=e instanceof Error?e.message:'筛选项加载失败'}finally{if(current===optionSequence)optionsLoading.value=false}}
async function load(){const id=tenantId.value;const current=++reportSequence;if(!id){report.value=null;breakdown.value=null;return}error.value='';if(!validateRange())return;loading.value=true;try{const [trend,rank]=await Promise.all([getUsageTimeseries(id,params.value),getUsageBreakdown(id,params.value)]);if(current===reportSequence){report.value=trend;breakdown.value=rank}}catch(e){if(current===reportSequence){error.value=e instanceof Error?e.message:'加载失败';report.value=null;breakdown.value=null}}finally{if(current===reportSequence)loading.value=false}}
function scheduleLoad(){window.clearTimeout(timer);timer=window.setTimeout(load,250)}
function resetFilters(){dateRange.value=null;userId.value=undefined;apiKeyId.value=undefined;serviceId.value=undefined;granularity.value='day'}
function handleExportMenu({key}:{key:string}){exportReport(key as UsageExportType)}
async function exportReport(type:UsageExportType){const id=tenantId.value;if(!id||!validateRange())return;exporting.value=type;try{await downloadUsageExport(id,type,{...params.value,limit:type==='breakdown'?100:params.value.limit});message.success('报表已开始下载')}catch(e){message.error(e instanceof Error?e.message:'导出失败')}finally{exporting.value=null}}

onMounted(async()=>{await loadOptions();await load()})
watch(tenantId,async()=>{reportSequence++;userId.value=undefined;apiKeyId.value=undefined;serviceId.value=undefined;await loadOptions();await load()})
watch([granularity,dateRange,userId,apiKeyId,serviceId,dimension,orderBy,limit],scheduleLoad,{deep:true})
onBeforeUnmount(()=>window.clearTimeout(timer))
</script>

<template>
 <div class="usage-page">
  <div class="page-header">
   <div><h2 class="page-title">API 调用用量</h2><p class="page-desc">按时间、模型服务、API Key 和成员查看 API 调用的 Token 与预估费用</p></div>
   <a-dropdown :disabled="Boolean(exporting)" placement="bottomRight">
    <a-button :loading="Boolean(exporting)"><DownloadOutlined/>导出报表<DownOutlined/></a-button>
    <template #overlay>
     <a-menu @click="handleExportMenu">
      <a-menu-item key="timeseries">导出趋势</a-menu-item>
      <a-menu-item key="breakdown">导出排行</a-menu-item>
      <a-menu-divider/>
      <a-menu-item key="raw">导出明细</a-menu-item>
     </a-menu>
    </template>
   </a-dropdown>
  </div>
  <a-empty v-if="!tenantId" description="暂无有效当前租户，请先进入租户管理选择或创建租户"><router-link to="/tenants">前往租户管理</router-link></a-empty>
  <a-card class="filters" :bordered="false">
   <template #title><div class="filter-title"><FilterOutlined/><span>数据筛选</span></div></template>
   <template #extra><a-button type="text" :disabled="!hasActiveFilters" @click="resetFilters"><ReloadOutlined/>重置筛选</a-button></template>
   <section class="filter-section">
    <a-form layout="vertical" class="filter-grid">
     <a-form-item label="日期范围" class="range-field"><a-range-picker v-model:value="dateRange" class="full-width" size="large" format="YYYY-MM-DD" value-format="YYYY-MM-DD" :placeholder="['开始日期','结束日期']" separator="至" allow-clear/></a-form-item>
     <a-form-item label="统计粒度"><a-radio-group v-model:value="granularity" button-style="solid" size="large"><a-radio-button value="hour">时</a-radio-button><a-radio-button value="day">日</a-radio-button><a-radio-button value="week">周</a-radio-button><a-radio-button value="month">月</a-radio-button></a-radio-group></a-form-item>
     <a-form-item label="模型服务"><a-select v-model:value="serviceId" size="large" allow-clear show-search option-filter-prop="label" placeholder="全部模型服务" :loading="optionsLoading"><a-select-option v-for="item in options?.services??[]" :key="item.id" :value="item.id" :label="item.label">{{ item.label }}</a-select-option></a-select></a-form-item>
     <a-form-item label="API Key"><a-select v-model:value="apiKeyId" size="large" allow-clear show-search option-filter-prop="label" placeholder="全部 API Key" :loading="optionsLoading"><a-select-option v-for="item in options?.apiKeys??[]" :key="item.id" :value="item.id" :label="item.label">{{ item.label }}</a-select-option></a-select></a-form-item>
     <a-form-item v-if="options?.canReadAll" label="成员"><a-select v-model:value="userId" size="large" show-search option-filter-prop="label" allow-clear placeholder="全部成员"><a-select-option v-for="item in options.members" :key="item.id" :value="item.id" :label="item.label">{{ item.label }}</a-select-option></a-select></a-form-item>
    </a-form>
   </section>
  </a-card>
  <a-alert v-if="error" class="error" type="error" :message="error" show-icon/>
  <UsageSummaryCards :metrics="report?.total??null" :loading="loading"/>
  <UsageTrendChart class="section" title="Token 用量趋势" :points="report?.points??[]" :loading="loading" :data-delay-minutes="report?.dataDelayMinutes"/>
  <UsageBreakdownChart class="section ranking-card" :items="breakdown?.items??[]" :order-by="orderBy" :loading="loading">
   <template #extra>
    <div class="rank-controls">
     <a-select v-model:value="dimension" size="large" aria-label="排行维度"><a-select-option value="model">按模型</a-select-option><a-select-option value="api_key">按 API Key</a-select-option><a-select-option v-if="options?.canReadAll" value="member">按成员</a-select-option></a-select>
     <a-select v-model:value="orderBy" size="large" aria-label="排序指标"><a-select-option value="totalTokens">总 Token</a-select-option><a-select-option value="estimatedCostFen">预估费用</a-select-option><a-select-option value="requestCount">请求数</a-select-option></a-select>
     <a-select v-model:value="limit" size="large" aria-label="显示数量"><a-select-option :value="5">前 5 项</a-select-option><a-select-option :value="10">前 10 项</a-select-option><a-select-option :value="20">前 20 项</a-select-option><a-select-option :value="50">前 50 项</a-select-option></a-select>
    </div>
   </template>
  </UsageBreakdownChart>
  <a-card class="section" title="排行明细" :loading="loading">
   <a-table :columns="columns" :data-source="breakdown?.items??[]" row-key="id" :pagination="false" :scroll="{x:900}">
    <template #bodyCell="{column,record}"><template v-if="column.key==='totalTokens'">{{ integer(record.metrics.totalTokens) }}</template><template v-else-if="column.key==='requestCount'">{{ integer(record.metrics.requestCount) }}</template><template v-else-if="column.key==='cost'">{{ formatYuan(record.metrics.estimatedCostFen) }}</template><template v-else-if="column.key==='quality'">{{ integer(record.metrics.exactUsageCount) }} / {{ integer(record.metrics.estimatedUsageCount) }} / {{ integer(record.metrics.unknownUsageCount) }}</template><template v-else-if="column.key==='ratio'">{{ percent(record.ratio) }}</template></template>
    <template #emptyText><a-empty description="当前范围暂无排行数据"/></template>
   </a-table>
  </a-card>
 </div>
</template>

<style lang="scss" scoped>
.usage-page { width: 100%; }
.page-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 24px; }
.page-title { margin: 0 0 8px; color: $color-text-primary; font-size: $font-size-title; font-weight: 600; line-height: 1.35; }
.page-desc { margin: 0; color: $color-text-secondary; }
.filters { margin-bottom: 16px; background: $color-bg; border-radius: $radius-card; box-shadow: $shadow-light; }
.filter-title { display: flex; align-items: center; gap: 10px; font-size: $font-size-h3; font-weight: 600; }
.filter-title :first-child { color: $color-primary; }
.filter-section { padding-top: 4px; }
.filter-grid { display: grid; grid-template-columns: minmax(260px, 300px) 188px repeat(3, minmax(150px, 1fr)); gap: 0 16px; align-items: end; }
.full-width { width: 100%; }
.filter-grid :deep(.ant-form-item) { margin-bottom: 4px; }
.filter-grid :deep(.ant-form-item-label) { padding-bottom: 6px; }
.filter-grid :deep(.ant-select) { width: 100%; }
.error { margin-bottom: 16px; }
.section { margin-top: 16px; }
.usage-page :deep(.ant-card) { border-radius: $radius-card; }
.usage-page :deep(.ant-btn) { border-radius: $radius-button; }
.usage-page :deep(.ant-select-selector), .usage-page :deep(.ant-picker) { border-radius: $radius-input; }
.rank-controls { display: flex; align-items: center; gap: 8px; }
.rank-controls :deep(.ant-select) { width: 124px; text-align: left; }
.rank-controls :deep(.ant-select:last-child) { width: 96px; }
@media (max-width: 1200px) {
 .filter-grid { grid-template-columns: minmax(260px, 1.5fr) 188px repeat(2, minmax(160px, 1fr)); }
}
@media (max-width: 768px) {
 .filter-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
 .range-field { grid-column: span 2; }
 .ranking-card :deep(.ant-card-head-wrapper) { align-items: flex-start; flex-direction: column; gap: 12px; padding: 12px 0; }
 .ranking-card :deep(.ant-card-extra) { margin-inline-start: 0; padding: 0; width: 100%; }
 .rank-controls { width: 100%; }
 .rank-controls :deep(.ant-select) { flex: 1; width: auto; }
}
@media (max-width: 576px) {
 .page-header { flex-direction: column; }
 .filter-grid { grid-template-columns: 1fr; }
 .range-field { grid-column: span 1; }
 .filter-grid :deep(.ant-radio-group) { display: flex; }
 .filter-grid :deep(.ant-radio-button-wrapper) { flex: 1; text-align: center; }
 .filters :deep(.ant-card-head-wrapper) { align-items: flex-start; }
 .filters :deep(.ant-card-extra) { padding-top: 18px; }
 .rank-controls { flex-wrap: wrap; }
 .rank-controls :deep(.ant-select) { min-width: calc(50% - 4px); }
}
</style>
