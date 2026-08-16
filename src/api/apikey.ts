import request from './request'
import type { ApiKeyCreateReqDTO, ApiKeyPageRespDTO, ApiKeyRespDTO, ApiKeyRevokeReqDTO } from '@/types/apikey'

// 获取当前用户在某租户下的 API Key 列表（分页）
export function listApiKeys(tenantId: string, pageNum: number, pageSize: number): Promise<ApiKeyPageRespDTO> {
  return request.get(`/api-keys/${tenantId}/list`, { params: { pageNum, pageSize } })
}

// 创建 API Key（完整 Key 仅在创建响应中返回一次）
export function createApiKey(tenantId: string, data: ApiKeyCreateReqDTO): Promise<ApiKeyRespDTO> {
  return request.post(`/api-keys/${tenantId}/create`, data)
}

// 吊销 API Key（软删除）
export function revokeApiKey(tenantId: string, data: ApiKeyRevokeReqDTO): Promise<boolean> {
  return request.delete(`/api-keys/${tenantId}/delete`, { data })
}
