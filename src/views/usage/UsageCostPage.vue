<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import dayjs from 'dayjs'
import { useTenantStore } from '@/stores/tenant'
import { getUsageBreakdown, getUsageSummary, getUsageTimeseries } from '@/api/usage'
import { listLlmServices } from '@/api/llmService'
import UsageSummaryCards from './components/UsageSummaryCards.vue'
import UsageTrendChart from './components/UsageTrendChart.vue'
import UsageBreakdownTable from './components/UsageBreakdownTable.vue'
import type { LlmServiceInfo } from '@/types/llmService'
import type { UsageBreakdownDimension, UsageBreakdownPage, UsageFilter, UsageGranularity, UsageSummary, UsageTimeseries } from '@/types/usage'

const tenantStore = useTenantStore()
const selectedTenantId = ref<string | null>(null)
const services = ref<LlmServiceInfo[]>([])
const draft = reactive({ dates: [] as unknown[], granularity: 'day' as UsageGranularity, serviceId: undefined as string | undefined })
const applied = ref<UsageFilter | null>(null)
const summary = ref<UsageSummary | null>(null); const trend = ref<UsageTimeseries | null>(null); const breakdown = ref<UsageBreakdownPage | null>(null)
const summaryLoading = ref(false); const trendLoading = ref(false); const breakdownLoading = ref(false)
const summaryError = ref(false); const trendError = ref(false); const breakdownError = ref(false)
const dimension = ref<UsageBreakdownDimension>('model'); const pageNum = ref(1); const pageSize = ref(10); const metric = ref<'cost' | 'requests' | 'tokens'>('cost'); const generation = ref(0)
const selectedTenant = computed(() => tenantStore.tenants.find((tenant) => tenant.tenantId === selectedTenantId.value))
const admin = computed(() => selectedTenant.value?.role === 'ADMIN' || selectedTenant.value?.role === 'SUPER_ADMIN')
const tenantOptions = computed(() => tenantStore.tenants.map((tenant) => ({ value: tenant.tenantId, label: tenant.name })))
const serviceOptions = computed(() => services.value.map((service) => ({ value: service.serviceId, label: service.name })))

function isoDay(value: unknown, exclusive = false): string | null {
  const text = value && typeof (value as { format?: unknown }).format === 'function' ? (value as { format: (pattern: string) => string }).format('YYYY-MM-DD') : typeof value === 'string' ? value.slice(0, 10) : null
  if (!text || !/^\d{4}-\d{2}-\d{2}$/.test(text)) return null
  if (!exclusive) return `${text}T00:00:00+08:00`
  const date = new Date(`${text}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + 1)
  return `${date.toISOString().slice(0, 10)}T00:00:00+08:00`
}
function defaultDates() { const end = dayjs(); const start = end.subtract(6, 'day'); draft.dates = [start, end] }
function makeFilter(): UsageFilter | null {
  const from = isoDay(draft.dates[0]); const to = isoDay(draft.dates[1], true)
  if (!from || !to) { message.error('请选择时间范围'); return null }
  const start = new Date(from).getTime(); const end = new Date(to).getTime()
  if (end <= start) { message.error('结束时间必须晚于开始时间'); return null }
  if (end - start > 366 * 24 * 60 * 60 * 1000) { message.error('时间范围不能超过 366 天'); return null }
  return { from, to, granularity: draft.granularity, ...(draft.serviceId ? { serviceId: draft.serviceId } : {}) }
}
async function loadServices() { if (!selectedTenantId.value) return; try { services.value = (await listLlmServices(selectedTenantId.value, 1, 200)).serviceInfoList } catch { services.value = [] } }
async function loadAll() {
  const filter = applied.value; const tenantId = selectedTenantId.value; if (!filter || !tenantId) return
  const current = ++generation.value; summary.value = null; trend.value = null; breakdown.value = null
  if (admin.value) { summaryLoading.value = true; summaryError.value = false; getUsageSummary(tenantId, filter).then((value) => { if (current === generation.value) summary.value = value }).catch(() => { if (current === generation.value) summaryError.value = true }).finally(() => { if (current === generation.value) summaryLoading.value = false }) }
  trendLoading.value = true; trendError.value = false; getUsageTimeseries(tenantId, filter).then((value) => { if (current === generation.value) trend.value = value }).catch(() => { if (current === generation.value) trendError.value = true }).finally(() => { if (current === generation.value) trendLoading.value = false })
  loadBreakdown(current)
}
function loadBreakdown(current = generation.value) { const filter = applied.value; const tenantId = selectedTenantId.value; if (!filter || !tenantId) return; breakdownLoading.value = true; breakdownError.value = false; getUsageBreakdown(tenantId, { ...filter, dimension: dimension.value, pageNum: pageNum.value, pageSize: pageSize.value }).then((value) => { if (current === generation.value) breakdown.value = value }).catch(() => { if (current === generation.value) breakdownError.value = true }).finally(() => { if (current === generation.value) breakdownLoading.value = false }) }
function apply() { const filter = makeFilter(); if (!filter) return; applied.value = filter; pageNum.value = 1; loadAll() }
function switchDimension(value: UsageBreakdownDimension) { dimension.value = value; pageNum.value = 1; loadBreakdown() }
function changePage(page: number, size: number) { pageNum.value = page; pageSize.value = size; loadBreakdown() }
watch(selectedTenantId, async () => { generation.value += 1; summary.value = null; trend.value = null; breakdown.value = null; pageNum.value = 1; dimension.value = 'model'; await loadServices(); apply() })
onMounted(async () => { if (!tenantStore.tenants.length) await tenantStore.fetchTenants(); selectedTenantId.value = tenantStore.currentTenant?.tenantId ?? tenantStore.tenants[0]?.tenantId ?? null; defaultDates() })
</script>
<template>
  <div class="usage-page"><div class="page-header"><div><h2>用量与费用</h2><p>查看租户或个人范围内的模型调用量与预估费用</p></div><a-select v-model:value="selectedTenantId" :options="tenantOptions" placeholder="选择租户" style="width: 200px" /></div>
    <a-card v-if="selectedTenantId" :bordered="false" class="filter-card"><a-form layout="vertical"><a-row :gutter="16"><a-col :xs="24" :md="10"><a-form-item label="时间范围"><a-range-picker v-model:value="draft.dates" style="width: 100%" /></a-form-item></a-col><a-col :xs="24" :md="5"><a-form-item label="粒度"><a-select v-model:value="draft.granularity"><a-select-option value="hour">小时</a-select-option><a-select-option value="day">天</a-select-option><a-select-option value="week">周</a-select-option><a-select-option value="month">月</a-select-option></a-select></a-form-item></a-col><a-col :xs="24" :md="5"><a-form-item label="实际模型"><a-select v-model:value="draft.serviceId" allow-clear :options="serviceOptions" placeholder="全部模型" /></a-form-item></a-col><a-col :xs="24" :md="4" class="query-action"><a-button type="primary" @click="apply">查询</a-button></a-col></a-row></a-form></a-card>
    <template v-if="selectedTenantId"><a-card v-if="admin" :bordered="false" class="section"><a-spin :spinning="summaryLoading"><a-alert v-if="summaryError" type="error" show-icon message="总览加载失败" action=""><template #action><a-button size="small" @click="loadAll">重试</a-button></template></a-alert><UsageSummaryCards v-else :summary="summary" /></a-spin></a-card><a-card v-else :bordered="false" class="section"><UsageSummaryCards member :personal-points="trend?.points" /></a-card>
      <a-card :bordered="false" class="section" title="趋势"><a-radio-group v-model:value="metric" class="metric-switch"><a-radio-button value="cost">预估费用</a-radio-button><a-radio-button value="requests">请求数</a-radio-button><a-radio-button value="tokens">Token</a-radio-button></a-radio-group><a-spin :spinning="trendLoading"><a-alert v-if="trendError" type="error" show-icon message="趋势加载失败"><template #action><a-button size="small" @click="loadAll">重试</a-button></template></a-alert><a-empty v-else-if="trend && !trend.hasData && !trend.points.length" description="所选范围没有用量数据" /><UsageTrendChart v-else :points="trend?.points ?? []" :metric="metric" /></a-spin></a-card>
      <a-card :bordered="false" class="section" title="分组明细"><a-alert v-if="breakdownError" type="error" show-icon message="明细加载失败"><template #action><a-button size="small" @click="loadBreakdown">重试</a-button></template></a-alert><UsageBreakdownTable v-else :dimension="dimension" :data="breakdown" :loading="breakdownLoading" @update:dimension="switchDimension" @page="changePage" @retry="loadBreakdown" /></a-card></template>
    <a-card v-else :bordered="false"><a-empty description="你还没有加入任何租户"><router-link to="/tenants" custom v-slot="{ href, navigate }"><a-button type="primary" :href="href" @click="navigate">前往租户管理</a-button></router-link></a-empty></a-card>
  </div>
</template>
<style lang="scss" scoped>.usage-page { max-width: 1200px; }.page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }.page-header h2 { margin: 0 0 8px; font-size: $font-size-title; color: $color-text-primary; }.page-header p { margin: 0; color: $color-text-secondary; }.filter-card, .section { margin-bottom: 16px; }.query-action { display: flex; align-items: flex-end; padding-bottom: 24px; }.metric-switch { margin-bottom: 12px; }</style>
