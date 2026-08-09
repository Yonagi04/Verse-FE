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
  DeviceInfo,
  LoginHistoryPage,
  PrivacyUpdateReqDTO,
} from '@/types/user'

// ========== Mock helpers ==========

function mockDelay<T>(data: T, ms: number): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(data), ms))
}

// ========== Mock data ==========

const mockLoginHistoryRecords = [
  {
    loginTime: '2026-08-09T10:30:00',
    deviceName: 'Mac Firefox',
    ip: '113.45.67.89',
    region: '广州',
    result: 'SUCCESS' as const,
    failReason: null,
  },
  {
    loginTime: '2026-08-09T10:29:00',
    deviceName: 'Windows Chrome',
    ip: '114.55.66.77',
    region: '北京',
    result: 'FAIL' as const,
    failReason: '密码错误',
  },
  {
    loginTime: '2026-08-08T14:00:00',
    deviceName: 'Mac Safari',
    ip: '113.45.67.88',
    region: '广州',
    result: 'SUCCESS' as const,
    failReason: null,
  },
  {
    loginTime: '2026-08-07T08:15:00',
    deviceName: 'iPhone Chrome',
    ip: '112.33.44.55',
    region: '上海',
    result: 'FAIL' as const,
    failReason: '用户已被禁用',
  },
  {
    loginTime: '2026-08-06T22:00:00',
    deviceName: 'Windows Edge',
    ip: '116.22.33.44',
    region: '深圳',
    result: 'SUCCESS' as const,
    failReason: null,
  },
  {
    loginTime: '2026-08-05T18:45:00',
    deviceName: 'Android Chrome',
    ip: '111.88.99.00',
    region: '杭州',
    result: 'FAIL' as const,
    failReason: '用户不存在',
  },
  {
    loginTime: '2026-08-05T09:20:00',
    deviceName: 'Mac Firefox',
    ip: '113.45.67.89',
    region: '广州',
    result: 'SUCCESS' as const,
    failReason: null,
  },
]

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
  return request.put('/users/me', data)
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

// 上传头像 (mock — 后端未实现)
export function uploadAvatar(_file: File): Promise<string> {
  return mockDelay('https://cdn.verse.example.com/avatars/10000001/mock-avatar.webp', 500)
}

// 更新隐私设置 (mock — 后端未实现)
export function updatePrivacy(_data: PrivacyUpdateReqDTO): Promise<boolean> {
  return mockDelay(true, 300)
}

// 获取登录设备列表
export function getDevices(): Promise<DeviceInfo[]> {
  return request.get('/users/me/devices')
}

// 踢设备下线
export function kickDevice(deviceId: string): Promise<boolean> {
  return request.delete(`/users/me/devices/${deviceId}`)
}

// 获取登录历史 (mock — 后端未实现)
export function getLoginHistory(page: number = 1, size: number = 20): Promise<LoginHistoryPage> {
  const total = mockLoginHistoryRecords.length
  const start = (page - 1) * size
  const records = mockLoginHistoryRecords.slice(start, start + size)
  return mockDelay({ total, records }, 500)
}
