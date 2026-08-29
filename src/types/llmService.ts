// ========== LLM 服务管理 ==========

// 新增请求
export interface LlmServiceAddReqDTO {
  name: string
  provider: string
  apiUrl: string
  apiKey: string
  modelName: string
  rpm?: number | null
  tpm?: number | null
}

// 更新请求（部分更新：仅提交非空字段；rpm/tpm/fallbackServiceId 中 0=清除，null=不修改）
export interface LlmServiceUpdateReqDTO {
  name?: string
  apiUrl?: string
  apiKey?: string
  modelName?: string
  rpm?: number | null
  tpm?: number | null
  fallbackServiceId?: string | number | null
}

// 列表项
export interface LlmServiceInfo {
  serviceId: string
  name: string
  provider: string
  status: number
  createdByUsername: string
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
  status: number
  rateLimitRpm: number | null
  rateLimitTpm: number | null
  fallbackServiceId: string | null
  createdByUsername: string
  createTime: string
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
