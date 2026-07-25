import request from './request'
import type { TenantCreateReqDTO, TenantInfoListRespDTO } from '@/types/tenant'

// 获取当前用户的租户列表
export function listTenants(): Promise<TenantInfoListRespDTO[]> {
  return request.get('/tenants')
}

// 创建团队租户
export function createTenant(data: TenantCreateReqDTO): Promise<boolean> {
  return request.post('/tenants/create', data)
}
