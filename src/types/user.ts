/** 租户类型 */
export type TenantType = 'PERSONAL' | 'TEAM'

/** 角色 */
export type Role = 'SUPER_ADMIN' | 'ADMIN' | 'MEMBER'

// ========== 请求 DTO ==========

export interface UserRegisterReqDTO {
  username: string
  nickname?: string
  password: string
  email: string
  phone: string
}

export interface UserLoginReqDTO {
  username: string
  password: string
}

export interface UserUpdateReqDTO {
  nickname: string
  email: string
  phone: string
  bio?: string
  region?: string
  timezone?: string
}

export interface UserUpdatePasswordReqDTO {
  oldPassword: string
  password: string
}

export interface UserSendingPhoneCodeReqDTO {
  phone: string
}

export interface UserVerifyPhoneCodeReqDTO {
  phone: string
  code: string
}

export interface UserResetPasswordReqDTO {
  token: string
  phone: string
  password: string
}

// ========== 响应 DTO ==========

export interface TenantInfo {
  tenantId: string
  name: string
  type: TenantType
  role: Role
}

export interface UserRegisterRespDTO {
  userId: string
  username: string
  nickname: string
}

export interface UserLoginRespDTO {
  userId: string
  username: string
  nickname: string
  token: string
  expiresAt: string
  currentTenant: TenantInfo | null
}

export interface PrivacySettings {
  showBio: boolean
  showRegion: boolean
  showTimezone: boolean
}

export interface UserRespDTO {
  userId: string
  username: string
  nickname: string
  email: string
  phone: string
  avatar?: string | null
  bio?: string | null
  region?: string | null
  timezone?: string | null
  privacy?: PrivacySettings
}

export interface UserInfoRespDTO {
  userId: string
  username: string
  nickname: string
}

export interface UserVerifyPhoneCodeRespDTO {
  token: string
}

// ========== 注销账号 ==========

/** 注销 - 准备响应 */
export interface CancelPrepareRespDTO {
  warningDescription: string
  warningTips: string[]
}

/** 注销 - 确认请求 */
export interface CancelConfirmReqDTO {
  code: string
}

// ========== 登录设备 ==========

export interface DeviceInfo {
  deviceId: string
  deviceName: string
  region: string
  ip: string
  lastLoginAt: string
  online: boolean
  currentDevice: boolean
}

// ========== 登录历史 ==========

export interface LoginHistoryItem {
  loginTime: string
  deviceName: string
  ip: string
  region: string
  result: 'SUCCESS' | 'FAIL'
  failReason: string | null
}

export interface LoginHistoryPage {
  total: number
  totalPages: number
  page: number
  pageSize: number
  historyInfos: LoginHistoryItem[]
}

// ========== 隐私设置更新 ==========

export interface PrivacyUpdateReqDTO {
  showBio?: boolean
  showRegion?: boolean
  showTimezone?: boolean
}
