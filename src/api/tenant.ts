import request from './request'
import type { TenantCreateReqDTO, TenantInfoListRespDTO, TenantInfoRespDTO, TenantUpdateReqDTO, TenantSwitchRespDTO } from '@/types/tenant'

// 获取当前用户的租户列表
export function listTenants(): Promise<TenantInfoListRespDTO[]> {
  return request.get('/tenants')
}

// 创建团队租户
export function createTenant(data: TenantCreateReqDTO): Promise<boolean> {
  return request.post('/tenants/create', data)
}

// 获取租户详情
export function getTenantInfo(tenantId: string): Promise<TenantInfoRespDTO> {
  return request.get(`/tenants/${tenantId}/info`)
}

// 更新租户信息
export function updateTenant(tenantId: string, data: TenantUpdateReqDTO): Promise<boolean> {
  return request.post(`/tenants/${tenantId}/update`, data)
}

// 切换租户
export function switchTenant(tenantId: string): Promise<TenantSwitchRespDTO> {
  return request.post(`/tenants/${tenantId}/switch`)
}
