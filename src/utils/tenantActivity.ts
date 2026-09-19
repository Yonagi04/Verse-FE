import type { TenantActivityDetails, TenantActivityItemRespDTO } from '@/types/tenant'

export const TENANT_ACTIVITY_DISABLED_CODE = 'B000339'

export type TenantActivityIcon = 'setting' | 'member' | 'invite' | 'service' | 'default'

export interface FormattedTenantActivity {
  action: string
  targetName: string | null
  actorName: string
  detailText: string | null
  icon: TenantActivityIcon
}

const actionByType: Record<string, string> = {
  ACTIVITY_RECORDING_ENABLED: '开启了租户动态记录',
  ACTIVITY_RECORDING_DISABLED: '关闭了租户动态记录',
  TENANT_SETTINGS_UPDATED: '更新了租户设置',
  TENANT_PROFILE_UPDATED: '更新了租户资料',
  TENANT_DISABLED: '停用了租户',
  MEMBER_JOINED: '加入了租户',
  MEMBER_LEFT: '离开了租户',
  MEMBER_REMOVED: '移除了成员',
  MEMBER_ROLE_CHANGED: '调整了成员角色',
  JOIN_REQUEST_REJECTED: '拒绝了加入申请',
  INVITE_ENABLED: '启用了邀请码',
  INVITE_DISABLED: '停用了邀请码',
  LLM_SERVICE_CREATED: '创建了模型服务',
  LLM_SERVICE_UPDATED: '更新了模型服务',
  LLM_SERVICE_ENABLED: '启用了模型服务',
  LLM_SERVICE_DISABLED: '停用了模型服务',
  LLM_SERVICE_REMOVED: '移除了模型服务',
}

const changedFieldLabels: Record<string, string> = {
  name: '名称',
  description: '简介',
  joinApprovalMode: '加入审批',
  auditEnabled: '模型调用审计',
  activityRecordingEnabled: '动态记录',
  rateLimitRpm: 'RPM 上限',
  rateLimitTpm: 'TPM 上限',
  provider: '提供商',
  modelName: '模型名称',
  credential: '访问凭据',
  enabled: '启用状态',
}

const roleLabels: Record<string, string> = {
  MEMBER: '成员',
  ADMIN: '管理员',
  SUPER_ADMIN: '超级管理员',
}

const joinSourceLabels: Record<string, string> = {
  INVITE: '通过邀请码加入',
  APPROVAL: '通过管理员审批加入',
  CREATE: '创建租户时加入',
  DIRECT: '直接加入',
}

const categoryIcons: Record<string, TenantActivityIcon> = {
  TENANT: 'setting',
  MEMBER: 'member',
  INVITE: 'invite',
  LLM_SERVICE: 'service',
}

export function formatTenantActivity(item: TenantActivityItemRespDTO): FormattedTenantActivity {
  return {
    action: actionByType[item.activityType] ?? '发生了一项租户变更',
    targetName: item.targetName,
    actorName: item.actorNickname?.trim() || item.actorUsername?.trim() || '系统',
    detailText: formatDetails(item.details),
    icon: categoryIcons[item.category] ?? 'default',
  }
}

export function isTenantActivityDisabledError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const candidate = error as {
    code?: string
    response?: { data?: { code?: string } }
  }
  return candidate.code === TENANT_ACTIVITY_DISABLED_CODE
    || candidate.response?.data?.code === TENANT_ACTIVITY_DISABLED_CODE
}

function formatDetails(details: TenantActivityDetails): string | null {
  const parts: string[] = []
  if (Array.isArray(details.changedFields) && details.changedFields.length > 0) {
    parts.push(`变更：${details.changedFields.map((field) => changedFieldLabels[field] ?? field).join('、')}`)
  }
  if (typeof details.joinSource === 'string') {
    parts.push(joinSourceLabels[details.joinSource] ?? `加入方式：${details.joinSource}`)
  }
  if (typeof details.oldRole === 'string' || typeof details.newRole === 'string') {
    const oldRole = typeof details.oldRole === 'string' ? roleLabels[details.oldRole] ?? details.oldRole : '-'
    const newRole = typeof details.newRole === 'string' ? roleLabels[details.newRole] ?? details.newRole : '-'
    parts.push(`角色：${oldRole} → ${newRole}`)
  }
  if (typeof details.provider === 'string') parts.push(`提供商：${details.provider}`)
  if (typeof details.modelName === 'string') parts.push(`模型：${details.modelName}`)
  if (details.credentialChanged === true) parts.push('已更新访问凭据')
  if (typeof details.status === 'string') parts.push(`状态：${details.status}`)
  if (typeof details.expiresAt === 'string') parts.push(`有效期至：${details.expiresAt}`)
  return parts.length > 0 ? parts.join('；') : null
}
