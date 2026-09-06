export type UsageGranularity = 'hour' | 'day' | 'week' | 'month'
export interface UsageMetrics { inputTokens:string; outputTokens:string; totalTokens:string; requestCount:string; estimatedCostFen:string; exactUsageCount:string; estimatedUsageCount:string; unknownUsageCount:string; calculatedCount:string; unpricedCount:string; uncalculableCount:string; notChargeableCount:string }
export interface UsagePoint extends UsageMetrics { bucket:string }
export interface UsageReport { granularity:UsageGranularity; from:string; to:string; updatedAt:string; dataDelayMinutes:number; total:UsageMetrics; points:UsagePoint[] }
export interface UsageDashboard { today:UsageMetrics; recent24Hours:UsageReport; recent7Days:UsageReport; updatedAt:string; dataDelayMinutes:number }
