import request from './request'
import type {
  TenantCreateReqDTO,
  TenantInfoListRespDTO,
  TenantInfoRespDTO,
  TenantUpdateReqDTO,
  TenantSwitchRespDTO,
  TenantClosePrepareRespDTO,
  TenantCloseReqDTO,
  TenantInviteRespDTO,
  TenantInviteReqDTO,
  TenantJoinReqDTO,
  TenantMembersListRespDTO,
  TenantMemberRoleUpdateReqDTO,
} from '@/types/tenant'

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

// 关闭租户 — 准备阶段
export function closeTenantPrepare(tenantId: string): Promise<TenantClosePrepareRespDTO> {
  return request.post(`/tenants/${tenantId}/disable/prepare`)
}

// 关闭租户 — 确认
export function closeTenantConfirm(tenantId: string, data: TenantCloseReqDTO): Promise<boolean> {
  return request.post(`/tenants/${tenantId}/disable/confirm`, data)
}

// 生成邀请码
export function generateInvite(tenantId: string, data?: TenantInviteReqDTO): Promise<TenantInviteRespDTO> {
  return request.post(`/tenants/${tenantId}/invites`, data || {})
}

// 通过邀请码加入租户
export function joinTenant(data: TenantJoinReqDTO): Promise<boolean> {
  return request.post('/tenants/join', data)
}

// 获取租户成员列表
export function getTenantMembers(tenantId: string, pageNum: number, pageSize: number): Promise<TenantMembersListRespDTO> {
  return request.get(`/tenants/${tenantId}/members`, { params: { pageNum, pageSize } })
}

// 修改成员角色
export function updateMemberRole(tenantId: string, memberId: number, data: TenantMemberRoleUpdateReqDTO): Promise<boolean> {
  return request.post(`/tenants/${tenantId}/members/${memberId}/role`, data)
}

// 移除成员
export function removeMember(tenantId: string, memberId: number): Promise<boolean> {
  return request.delete(`/tenants/${tenantId}/members/${memberId}/remove`)
}
