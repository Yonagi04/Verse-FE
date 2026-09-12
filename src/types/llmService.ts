// ========== LLM 服务管理 ==========

export interface TagInfo {
  code: string
  displayName: string
  description?: string | null
  sortOrder?: number | null
}

export type BillingMode = 'TOKEN' | 'REQUEST'
export type BillingStatus = 'UNPRICED' | 'TOKEN' | 'REQUEST'

/**
 * API price values are Fen 十进制字符串。后端在部分响应中会把 BigDecimal 序列化为 JSON number，
 * 但 Decimal 同时接受 string | number，因此这里统一按 string 声明，页面一律经由 utils/money.ts 处理。
 */
export interface TokenPrice {
  cacheMissInputPriceFen: string
  cacheHitInputPriceFen: string | null
  outputPriceFen: string
}

export interface PeakPeriod {
  periodId?: string | null
  weekdays: number[]
  startTime: string
  endTime: string
  tokenPrices?: TokenPrice
  requestPriceFen?: string | null
}

export interface PricingDisabled {
  enabled: false
}

export interface TokenPricingEnabled {
  enabled: true
  billingMode: 'TOKEN'
  currency?: string
  pricingId?: string | null
  baseTokenPrices: TokenPrice
  peakPeriods: PeakPeriod[]
}

export interface RequestPricingEnabled {
  enabled: true
  billingMode: 'REQUEST'
  currency?: string
  pricingId?: string | null
  baseRequestPriceFen: string
  peakPeriods: PeakPeriod[]
}

export type PricingRequest = PricingDisabled | TokenPricingEnabled | RequestPricingEnabled
export type PricingResponse = PricingRequest

// 新增请求
export interface LlmServiceAddReqDTO {
  name: string
  provider: string
  apiUrl: string
  apiKey: string
  modelName: string
  description?: string | null
  rpm?: number | null
  tpm?: number | null
  tagCodes?: string[]
  contextWindow?: number
  maxOutputTokens?: number
  pricing?: PricingRequest
}

// 更新请求（部分更新：仅提交非空字段；rpm/tpm/fallbackServiceId 中 0=清除，null=不修改）
export interface LlmServiceUpdateReqDTO {
  name?: string
  apiUrl?: string
  apiKey?: string
  modelName?: string
  description?: string | null
  rpm?: number | null
  tpm?: number | null
  fallbackServiceId?: string | number | null
  tagCodes?: string[]
  contextWindow?: number
  maxOutputTokens?: number
  pricing?: PricingRequest
}

// 列表项
export interface LlmServiceInfo {
  serviceId: string
  name: string
  provider: string
  modelName: string
  description?: string | null
  status: number
  createdByUsername: string
  tagCodes?: string[]
  contextWindow?: number | null
  maxOutputTokens?: number | null
  billingStatus?: BillingStatus
  currency?: string
}

// 分页列表响应
export interface LlmServiceListRespDTO {
  serviceInfoList: LlmServiceInfo[]
  total: number
  totalPages: number
  page: number
  pageSize: number
}

// 详情响应（apiKey 为脱敏值）
export interface LlmServiceInfoRespDTO {
  serviceId: string
  name: string
  provider: string
  apiUrl: string
  apiKey: string
  modelName: string
  description: string | null
  status: number
  rateLimitRpm: number | null
  rateLimitTpm: number | null
  fallbackServiceId: string | null
  createdByUsername: string
  createTime: string
  tagCodes: string[]
  contextWindow: number | null
  maxOutputTokens: number | null
  pricing: PricingResponse
}

// 删除准备阶段响应
export interface LlmServiceRemovePreRespDTO {
  info: string
  token: string
  expires: string
}

// 删除确认请求
export interface LlmServiceRemoveReqDTO {
  token: string
}
