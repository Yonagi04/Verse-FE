import request from './request'
import type {
  LlmServiceAddReqDTO,
  LlmServiceInfoRespDTO,
  LlmServiceListRespDTO,
  LlmServiceRemovePreRespDTO,
  LlmServiceRemoveReqDTO,
  LlmServiceUpdateReqDTO,
  TagInfo,
} from '@/types/llmService'

// 添加模型服务
export function addLlmService(tenantId: string, data: LlmServiceAddReqDTO): Promise<boolean> {
  return request.post(`/llm-service/${tenantId}/add`, data)
}

// 分页获取模型服务列表（keyword 可选，按服务别名或供应商模糊搜索）
export function listLlmServices(
  tenantId: string,
  pageNum: number,
  pageSize: number,
  keyword?: string,
  tagCodes?: string[],
): Promise<LlmServiceListRespDTO> {
  return request.get(`/llm-service/${tenantId}/list`, {
    params: { pageNum, pageSize, ...(keyword ? { keyword } : {}), ...(tagCodes?.length ? { tagCodes: tagCodes.join(',') } : {}) },
  })
}

export function listLlmServiceTags(): Promise<TagInfo[]> {
  return request.get('/llm-service/tags')
}

// 更新模型服务（部分更新）
export function updateLlmService(tenantId: string, serviceId: string, data: LlmServiceUpdateReqDTO): Promise<boolean> {
  return request.post(`/llm-service/${tenantId}/update/${serviceId}`, data)
}

// 获取模型服务详情（apiKey 为脱敏值）
export function getLlmServiceInfo(tenantId: string, serviceId: string): Promise<LlmServiceInfoRespDTO> {
  return request.get(`/llm-service/${tenantId}/info/${serviceId}`)
}

// 停用模型服务
export function disableLlmService(tenantId: string, serviceId: string): Promise<boolean> {
  return request.post(`/llm-service/${tenantId}/disable/${serviceId}`)
}

// 启用模型服务
export function enableLlmService(tenantId: string, serviceId: string): Promise<boolean> {
  return request.post(`/llm-service/${tenantId}/enable/${serviceId}`)
}

// 删除模型服务 — 准备阶段（获取警告信息与确认 token）
export function prepareRemoveLlmService(tenantId: string, serviceId: string): Promise<LlmServiceRemovePreRespDTO> {
  return request.post(`/llm-service/${tenantId}/remove/prepare/${serviceId}`)
}

// 删除模型服务 — 确认阶段（携带 token）
export function removeLlmService(tenantId: string, serviceId: string, data: LlmServiceRemoveReqDTO): Promise<boolean> {
  return request.post(`/llm-service/${tenantId}/remove/${serviceId}`, data)
}

// 获取当前租户内 LLM 数量
export function getLlmCount(tenantId: string): Promise<number> {
  return request.get(`/llm-service/${tenantId}/get-llm-count`)
}
