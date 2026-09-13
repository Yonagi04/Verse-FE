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
  TenantJoinRespDTO,
  TenantMembersListRespDTO,
  TenantMemberRoleUpdateReqDTO,
  TenantInviteListRespDTO,
  TenantJoinReqListRespDTO,
  TenantJoinRejectReqDTO,
  TenantLeavePrepareRespDTO,
  TenantLeaveRespDTO,
  TenantJoinInfoRespDTO,
  TenantSendNotificationReq,
  TenantMediaUploadRespDTO,
  TenantSettingsRespDTO,
  TenantSettingsUpdateReqDTO,
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

// 获取租户设置完整快照
export function getTenantSettings(tenantId: string): Promise<TenantSettingsRespDTO> {
  return request.get(`/tenants/${tenantId}/settings`)
}

// 保存租户设置完整快照
export function updateTenantSettings(
  tenantId: string,
  data: TenantSettingsUpdateReqDTO,
): Promise<TenantSettingsRespDTO> {
  return request.post(`/tenants/${tenantId}/settings/update`, data)
}

// 上传租户 Logo
export function uploadTenantLogo(tenantId: string, file: File): Promise<TenantMediaUploadRespDTO> {
  return uploadTenantMedia(tenantId, 'logo', file)
}

// 上传租户头图
export function uploadTenantBanner(tenantId: string, file: File): Promise<TenantMediaUploadRespDTO> {
  return uploadTenantMedia(tenantId, 'banner', file)
}

// 选择租户内置头图
export function selectTenantBannerPreset(
  tenantId: string,
  presetId: string,
): Promise<TenantMediaUploadRespDTO> {
  return request.post(`/tenants/${tenantId}/banner/preset`, { presetId })
}

function uploadTenantMedia(
  tenantId: string,
  kind: 'logo' | 'banner',
  file: File,
): Promise<TenantMediaUploadRespDTO> {
  const formData = new FormData()
  formData.append('file', file)
  return request.post(`/tenants/${tenantId}/${kind}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
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
export function joinTenant(data: TenantJoinReqDTO): Promise<TenantJoinRespDTO> {
  return request.post('/tenants/join', data)
}

// 获取邀请码列表
export function listInviteCodes(tenantId: string, pageNum: number, pageSize: number): Promise<TenantInviteListRespDTO> {
  return request.get(`/tenants/${tenantId}/invites`, { params: { pageNum, pageSize } })
}

// 停用邀请码
export function deactivateInviteCode(tenantId: string, inviteCodeId: string): Promise<boolean> {
  return request.post(`/tenants/${tenantId}/invites/${inviteCodeId}/deactivate`)
}

// 启用邀请码
export function activateInviteCode(tenantId: string, inviteCodeId: string): Promise<boolean> {
  return request.post(`/tenants/${tenantId}/invites/${inviteCodeId}/activate`)
}

// 获取未审批的申请单数量
export function getUnreviewedJoinRequestCount(tenantId: string): Promise<number> {
  return request.get(`/tenants/${tenantId}/join-requests/unreviewed-count`)
}

// 获取加入申请列表
export function listJoinRequests(tenantId: string, pageNum: number, pageSize: number): Promise<TenantJoinReqListRespDTO> {
  return request.get(`/tenants/${tenantId}/join-requests`, { params: { pageNum, pageSize } })
}

// 通过加入申请
export function approveJoinRequest(tenantId: string, requestId: string): Promise<boolean> {
  return request.post(`/tenants/${tenantId}/join-requests/${requestId}/approve`)
}

// 拒绝加入申请
export function rejectJoinRequest(tenantId: string, requestId: string, data: TenantJoinRejectReqDTO): Promise<boolean> {
  return request.post(`/tenants/${tenantId}/join-requests/${requestId}/reject`, data)
}

// 获取邀请码公开信息（无需登录）
export function getInviteCodeInfo(inviteCode: string): Promise<TenantJoinInfoRespDTO> {
  return request.get(`/tenants/invites/${inviteCode}/info`)
}

// 退出租户 — 准备阶段
export function leaveTenantPrepare(tenantId: string): Promise<TenantLeavePrepareRespDTO> {
  return request.post(`/tenants/${tenantId}/leave/prepare`)
}

// 退出租户 — 确认
export function leaveTenantConfirm(tenantId: string): Promise<TenantLeaveRespDTO> {
  return request.post(`/tenants/${tenantId}/leave/confirm`)
}

// 获取租户成员列表
export function getTenantMembers(tenantId: string, pageNum: number, pageSize: number): Promise<TenantMembersListRespDTO> {
  return request.get(`/tenants/${tenantId}/members`, { params: { pageNum, pageSize } })
}

// 修改成员角色
export function updateMemberRole(tenantId: string, memberId: string, data: TenantMemberRoleUpdateReqDTO): Promise<boolean> {
  return request.post(`/tenants/${tenantId}/members/${memberId}/role`, data)
}

// 移除成员
export function removeMember(tenantId: string, memberId: string): Promise<boolean> {
  return request.delete(`/tenants/${tenantId}/members/${memberId}/remove`)
}

// 发送租户内通知
export function sendTenantNotification(tenantId: string, data: TenantSendNotificationReq): Promise<boolean> {
  return request.post(`/tenants/${tenantId}/notifications/send`, data)
}
