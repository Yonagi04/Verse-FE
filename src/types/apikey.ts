// ========== API Key 管理 ==========

// 创建请求
export interface ApiKeyCreateReqDTO {
  name: string
  expiresAt?: string | null
}

// 创建响应（仅创建时一次性返回完整 Key）
export interface ApiKeyRespDTO {
  apiKeyId: string
  name: string
  expiresAt: string | null
  apiKey: string
  keyPrefix: string
  createdAt: string
}

// 列表项（不含完整 Key）
export interface ApiKeyListRespDTO {
  apiKeyId: string
  name: string
  keyPrefix: string
  status: number
  lastUsedAt: string | null
  expiresAt: string | null
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