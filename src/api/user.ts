import request from './request'
import type {
  UserRegisterReqDTO,
  UserRegisterRespDTO,
  UserLoginReqDTO,
  UserLoginRespDTO,
  UserRespDTO,
  UserInfoRespDTO,
  UserUpdateReqDTO,
  UserUpdatePasswordReqDTO,
  UserSendingPhoneCodeReqDTO,
  UserVerifyPhoneCodeReqDTO,
  UserVerifyPhoneCodeRespDTO,
  UserResetPasswordReqDTO,
  CancelPrepareRespDTO,
  CancelConfirmReqDTO,
} from '@/types/user'

// 检查用户名是否存在
export function hasUsername(username: string): Promise<boolean> {
  return request.get('/user/hasUsername', { params: { username } })
}

// 注册
export function register(data: UserRegisterReqDTO): Promise<UserRegisterRespDTO> {
  return request.post('/users/register', data)
}

// 登录
export function login(data: UserLoginReqDTO): Promise<UserLoginRespDTO> {
  return request.post('/users/login', data)
}

// 获取当前用户信息
export function getCurrentUser(mask: boolean = true): Promise<UserRespDTO> {
  return request.get('/users/me', { params: { mask } })
}

// 获取其他用户信息
export function getUserInfo(userId: string): Promise<UserInfoRespDTO> {
  return request.get('/user/getUserInfo', { params: { userId } })
}

// 更新个人信息
export function updateProfile(data: UserUpdateReqDTO): Promise<boolean> {
  return request.post('/users/me', data)
}

// 登出
export function logout(): Promise<boolean> {
  return request.get('/users/logout')
}

// 修改密码
export function updatePassword(data: UserUpdatePasswordReqDTO): Promise<boolean> {
  return request.post('/users/updatePassword', data)
}

// 发送验证码
export function sendPhoneCode(data: UserSendingPhoneCodeReqDTO): Promise<boolean> {
  return request.post('/users/password/reset/sendCode', data)
}

// 验证验证码
export function verifyPhoneCode(data: UserVerifyPhoneCodeReqDTO): Promise<UserVerifyPhoneCodeRespDTO> {
  return request.post('/users/password/reset/verifyCode', data)
}

// 重置密码
export function resetPassword(data: UserResetPasswordReqDTO): Promise<boolean> {
  return request.post('/users/password/reset', data)
}

// 获取注销警告信息
export function getCancelPrepare(): Promise<CancelPrepareRespDTO> {
  return request.get('/users/account/cancel/prepare')
}

// 发送注销验证码
export function sendCancelCode(): Promise<boolean> {
  return request.post('/users/account/cancel/sendCode')
}

// 确认注销
export function confirmCancel(data: CancelConfirmReqDTO): Promise<boolean> {
  return request.post('/users/account/cancel/confirm', data)
}
