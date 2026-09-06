export type UsageGranularity = 'hour' | 'day' | 'week' | 'month'
export type UsageBreakdownDimension = 'model' | 'apiKey'

export interface UsageFilter {
  from: string
  to: string
  granularity: UsageGranularity
  serviceId?: string
}

export interface UsageCostTotal {
  requestCount: number
  inputTokens: number
  cachedInputTokens: number
  outputTokens: number
  totalTokens: number
  estimatedCostFen: string | null
  uncalculableRequestCount: number
}

export interface UsageSummary {
  hasData: boolean
  currency: string
  amountUnit: string
  timezone: string
  unpricedModelCount: number
  total: UsageCostTotal
  filter?: Record<string, unknown>
}

export interface UsageTimeseriesPoint extends UsageCostTotal {
  bucketStart: string
  bucketEnd: string
}

export interface UsageTimeseries {
  hasData: boolean
  currency: string
  amountUnit: string
  timezone: string
  unpricedModelCount: number
  points: UsageTimeseriesPoint[]
  filter?: Record<string, unknown>
}

export interface UsageBreakdownItem extends UsageCostTotal {
  userId?: string | null
  username?: string | null
  serviceId?: string | null
  serviceName?: string | null
  provider?: string | null
  apiKeyId?: string | null
  apiKeyName?: string | null
  keyPrefix?: string | null
}

export interface UsageBreakdownPage {
  dimension: UsageBreakdownDimension
  items: UsageBreakdownItem[]
  total: number
  totalPages: number
  page: number
  pageSize: number
  filter?: Record<string, unknown>
}

export interface UsageBreakdownQuery extends UsageFilter {
  dimension: UsageBreakdownDimension
  pageNum: number
  pageSize: number
}
