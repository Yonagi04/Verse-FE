import request from './request'
import type { UsageBreakdownPage, UsageBreakdownQuery, UsageFilter, UsageSummary, UsageTimeseries } from '@/types/usage'

export function getUsageSummary(tenantId: string, params: UsageFilter): Promise<UsageSummary> {
  return request.get(`/usage/${tenantId}/cost/summary`, { params })
}

export function getUsageTimeseries(tenantId: string, params: UsageFilter): Promise<UsageTimeseries> {
  return request.get(`/usage/${tenantId}/cost/timeseries`, { params })
}

export function getUsageBreakdown(tenantId: string, params: UsageBreakdownQuery): Promise<UsageBreakdownPage> {
  return request.get(`/usage/${tenantId}/cost/breakdown`, { params })
}
