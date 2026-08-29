// ========== API Key 管理 ==========

// 创建请求
export interface ApiKeyCreateReqDTO {
  name: string
  expiresAt?: string | null
  rpm?: number | null
  tpm?: number | null
}

// 创建响应（仅创建时一次性返回完整 Key）
export interface ApiKeyRespDTO {
  apiKeyId: string
  name: string
  expiresAt: string | null
  apiKey: string
  createKeyMessage: string
  createKeyTip: string
}

// 列表项（不含完整 Key）
export interface ApiKeyListRespDTO {
  apiKeyId: string
  name: string
  keyPrefix: string
  status: number
  lastUsedAt: string | null
  expiresAt: string | null
  rateLimitRpm: number | null
  rateLimitTpm: number | null
  createTime: string
}

// 分页列表响应
export interface ApiKeyPageRespDTO {
  records: ApiKeyListRespDTO[]
  total: number
  totalPages: number
  page: number
  pageSize: number
}

export interface ApiKeyRevokeReqDTO {
  apiKeyId: string
}

// 编辑请求（名称 / 过期时间 / 限流）
export interface ApiKeyUpdateReqDTO {
  name: string
  expiresAt?: string | null
  rpm?: number | null
  tpm?: number | null
}