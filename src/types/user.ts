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
  tenantId: number
  name: string
  type: TenantType
  role: Role
}

export interface UserRegisterRespDTO {
  userId: number
  username: string
  nickname: string
}

export interface UserLoginRespDTO {
  userId: number
  username: string
  nickname: string
  token: string
  expiresAt: string
  currentTenant: TenantInfo | null
}

export interface UserRespDTO {
  userId: number
  username: string
  nickname: string
  email: string
  phone: string
}

export interface UserInfoRespDTO {
  userId: number
  username: string
  nickname: string
}

export interface UserVerifyPhoneCodeRespDTO {
  token: string
}
