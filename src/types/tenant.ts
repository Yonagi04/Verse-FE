import type { Role, TenantType } from './user'

export interface TenantCreateReqDTO {
  name: string
  description?: string
}

export interface TenantInfoRespDTO {
  tenantId: string
  name: string
  type: TenantType
  description: string
}

export interface TenantInfoListRespDTO {
  tenantId: string
  name: string
  type: TenantType
  role: Role
  joinedAt: string
  lastAccessedAt: string
}

export interface TenantUpdateReqDTO {
  name: string
  description?: string
}

export interface TenantSwitchRespDTO {
  tenantId: string
  name: string
  type: TenantType
  role: Role
}

// 关闭租户 — 准备阶段响应
export interface TenantClosePrepareRespDTO {
  disableToken: string
  tokenExpireTime: string
  warningDescription: string
  warningTips: string[]
}

// 关闭租户 — 确认请求
export interface TenantCloseReqDTO {
  disableToken: string
  confirmText: string
}

// 生成邀请码
export interface TenantInviteRespDTO {
  inviteCode: string
  expiresAt: string | null
}

export interface TenantInviteReqDTO {
  expireAt?: string | null
}

// 通过邀请码加入租户
export interface TenantJoinReqDTO {
  inviteCode: string
}

// 成员信息
export interface TenantMemberInfo {
  userId: number
  username: string
  nickname: string
  role: Role
  joinedAt: string
}

// 成员列表响应
export interface TenantMembersListRespDTO {
  tenantMembers: TenantMemberInfo[]
  total: number
  totalPages: number
  page: number
  pageSize: number
}

// 修改成员角色
export interface TenantMemberRoleUpdateReqDTO {
  newRole: string
}
