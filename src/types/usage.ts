export type UsageGranularity = 'hour' | 'day' | 'week' | 'month'
export interface UsageMetrics { inputTokens:string; outputTokens:string; totalTokens:string; requestCount:string; estimatedCostFen:string; exactUsageCount:string; estimatedUsageCount:string; unknownUsageCount:string; calculatedCount:string; unpricedCount:string; uncalculableCount:string; notChargeableCount:string }
export interface UsagePoint extends UsageMetrics { bucket:string }
export interface UsageReport { granularity:UsageGranularity; from:string; to:string; updatedAt:string; dataDelayMinutes:number; total:UsageMetrics; points:UsagePoint[] }
export interface UsageDashboard { today:UsageMetrics; recent24Hours:UsageReport; recent7Days:UsageReport; updatedAt:string; dataDelayMinutes:number }
export type UsageBreakdownDimension = 'model' | 'api_key' | 'member'
export type UsageBreakdownOrder = 'totalTokens' | 'estimatedCostFen' | 'requestCount'
export type UsageExportType = 'timeseries' | 'breakdown' | 'raw'
export interface UsageReportFilters { granularity:UsageGranularity; from?:string; to?:string; userId?:string; apiKeyId?:string; serviceId?:string }
export interface UsageBreakdownFilters extends UsageReportFilters { dimension:UsageBreakdownDimension; orderBy:UsageBreakdownOrder; limit:number }
export interface UsageOption { id:string; label:string }
export interface UsageFilterOptions { services:UsageOption[]; apiKeys:UsageOption[]; members:UsageOption[]; canReadAll:boolean }
export interface UsageBreakdownItem { id:string; label:string; ratio:string; metrics:UsageMetrics }
export interface UsageBreakdown { dimension:UsageBreakdownDimension; orderBy:string; total:UsageMetrics; items:UsageBreakdownItem[] }
