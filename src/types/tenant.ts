import type { Role, TenantType } from './user'

export interface TenantCreateReqDTO {
  name: string
  description?: string
}

export interface TenantInfoRespDTO {
  tenantId: string
  name: string
  type: TenantType
  description: string | null
  logoUrl: string | null
  bannerUrl: string | null
  role: Role
  memberCount: number
}

export interface TenantMediaUploadRespDTO {
  url: string
}

export interface TenantInfoListRespDTO {
  tenantId: string
  name: string
  type: TenantType
  role: Role
  current: boolean
  joinedAt: string
  lastAccessedAt: string
}

export interface TenantUpdateReqDTO {
  name: string
  description?: string
}

export interface TenantSettingsRespDTO {
  tenantId: string
  type: TenantType
  name: string
  description: string | null
  joinApprovalMode: 0 | 1
  auditEnabled: boolean
  activityRecordingEnabled: boolean
  rateLimitRpm: number | null
  rateLimitTpm: number | null
  role: Role
  editable: boolean
}

export interface TenantSettingsUpdateReqDTO {
  name: string
  description: string | null
  joinApprovalMode: 0 | 1
  auditEnabled: boolean
  activityRecordingEnabled: boolean
  rateLimitRpm: number | null
  rateLimitTpm: number | null
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
  inviteUrl: string
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
  userId: string
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
  targetTenantId: string
}

// ========== 邀请码公开信息（无需登录） ==========

export interface TenantJoinInfoRespDTO {
  name: string
  inviteCode: string
}

// ========== 租户通知 ==========

export type ReceiverType = 1 | 2 | 3 // 1=全员, 2=仅成员, 3=仅管理员

export interface TenantSendNotificationReq {
  severity: string // INFO | WARNING | CRITICAL
  title: string
  content: string
  receiverType: ReceiverType
}

// ========== 租户动态 ==========

export interface TenantActivityStatusRespDTO {
  enabled: boolean
}

export interface TenantActivityDetails {
  changedFields?: string[]
  joinSource?: string
  oldRole?: string
  newRole?: string
  status?: string
  expiresAt?: string
  provider?: string
  modelName?: string
  credentialChanged?: boolean
  [key: string]: unknown
}

export interface TenantActivityItemRespDTO {
  eventId: string
  category: string
  activityType: string
  actorUserId: string
  actorUsername: string
  actorNickname: string | null
  targetType: string | null
  targetId: string | null
  targetName: string | null
  details: TenantActivityDetails
  occurredAt: string
}

export interface TenantActivityListRespDTO {
  items: TenantActivityItemRespDTO[]
  nextCursor: string | null
  hasMore: boolean
}

export interface TenantActivityListParams {
  limit?: number
  cursor?: string
}
