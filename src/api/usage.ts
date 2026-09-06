import request from './request'
import type { UsageDashboard, UsageGranularity, UsageMetrics, UsageReport } from '@/types/usage'

export const getUsageDashboard = (tenantId:string):Promise<UsageDashboard> => request.get(`/usage/${tenantId}/dashboard`)
export const getUsageOverview = (tenantId:string, params:{from?:string;to?:string;userId?:string}):Promise<UsageMetrics> => request.get(`/usage/${tenantId}/overview`,{params})
export const getUsageTimeseries = (tenantId:string, params:{granularity:UsageGranularity;from?:string;to?:string;userId?:string}):Promise<UsageReport> => request.get(`/usage/${tenantId}/timeseries`,{params})
