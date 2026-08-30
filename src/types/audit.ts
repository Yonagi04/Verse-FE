// ========== LLM 调用审计 ==========

// 列表项（索引 + 概略）
export interface LlmAuditInfo {
  id: number
  requestId: string
  userId: number
  username: string
  model: string
  promptPreview: string
  responsePreview: string
  promptTokens: number
  completionTokens: number
  totalTokens: number
  latencyMs: number
  status: 'SUCCESS' | 'FAIL'
  errorCode: string | null
  createTime: string
}

// 分页列表响应
export interface LlmAuditListRespDTO {
  auditList: LlmAuditInfo[]
  total: number
  totalPages: number
  page: number
  pageSize: number
}

// 详情响应（在列表项基础上增加完整输入/输出 JSON 原文）
export interface LlmAuditDetailRespDTO extends LlmAuditInfo {
  prompt: string | null
  response: string | null
}
