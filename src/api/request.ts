import axios, { type AxiosError, type AxiosResponse } from 'axios'
import { message } from 'ant-design-vue'
import { getToken, clearAuth } from '@/utils/auth'
import type { Result } from '@/types/api'

const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
})

// 请求拦截器：注入 JWT
http.interceptors.request.use((config) => {
  const token = getToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// 响应拦截器：解包 Result<T>，错误统一处理
http.interceptors.response.use(
  <T>(response: AxiosResponse<Result<T>>): T => {
    const result = response.data
    if (result.code !== '0') {
      // B000218（账号已注销）由登录页弹窗处理，此处不弹 toast
      if (result.code !== 'B000218') {
        message.error(result.message || '请求失败')
      }
      const bizError = new Error(result.message || '请求失败') as Error & { code: string }
      bizError.code = result.code
      throw bizError
    }
    return result.data as T
  },
  (error: AxiosError<Result>) => {
    const status = error.response?.status
    const result = error.response?.data

    if (status === 401) {
      clearAuth()
      if (window.location.pathname !== '/login') {
        message.error('登录已过期，请重新登录')
        window.location.href = '/login'
      }
    } else if (result?.message) {
      message.error(result.message)
    } else {
      message.error('网络错误，请稍后重试')
    }

    return Promise.reject(error)
  },
)

export default http
