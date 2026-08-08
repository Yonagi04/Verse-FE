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

// ========== 邀请码管理 ==========

export interface TenantInviteInfo {
  id: string
  code: string
  inviteUrl: string
  createdBy: string
  createdByUsername: string
  usageCount: number
  isActive: number // 0/1
  expiresAt: string | null
  createTime: string
}

export interface TenantInviteListRespDTO {
  inviteCodes: TenantInviteInfo[]
  total: number
  totalPages: number
  page: number
  pageSize: number
}

// ========== 加入审批 ==========

export interface TenantJoinReqInfo {
  requestId: string
  userId: string
  username: string
  inviteCode: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  reviewedBy: string | null
  reviewComment: string | null
  requestedAt: string
  reviewedAt: string | null
}

export interface TenantJoinReqListRespDTO {
  requestList: TenantJoinReqInfo[]
  total: number
  totalPages: number
  page: number
  pageSize: number
}

export interface TenantJoinRejectReqDTO {
  reviewComment?: string
}

// ========== 加入租户响应 ==========

export interface TenantJoinRespDTO {
  pendingApproval: boolean
}

// ========== 退出租户 ==========

export interface TenantLeavePrepareRespDTO {
  warningDescription: string
  warningTips: string[]
}

export interface TenantLeaveRespDTO {
  targetTenantId: number
}
