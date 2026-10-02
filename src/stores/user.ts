import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getToken, setToken, setStoredUser, clearAuth } from '@/utils/auth'
import { login as loginApi, logout as logoutApi, getCurrentUser } from '@/api/user'
import type { UserLoginReqDTO, UserRespDTO, UserLoginRespDTO } from '@/types/user'
import { useTenantStore } from './tenant'
import { usePlaygroundStore } from './playground'
import { resetAuthRequests } from '@/api/request'
import { useWebSocketNotification, unreadCount, newNotification } from '@/composables/useWebSocketNotification'

export const useUserStore = defineStore('user', () => {
  const token = ref<string | null>(getToken())
  const user = ref<UserRespDTO | null>(null)
  const isLoading = ref(false)
  let generation = 0
  function resetIdentity() {
    generation++; resetAuthRequests(); user.value = null
    useTenantStore().reset(); usePlaygroundStore().reset(null)
    useWebSocketNotification().disconnect(); unreadCount.value = 0; newNotification.value = null
  }
  function acceptLogin(res: UserLoginRespDTO) {
    if (!res.token || !res.userId) throw new Error('登录响应不完整，请重新登录')
    resetIdentity(); token.value = res.token; setToken(res.token)
    setStoredUser({ userId: res.userId, username: res.username, nickname: res.nickname })
    user.value = { userId: res.userId, username: res.username, nickname: res.nickname, email: '', phone: '' }
    useTenantStore().setCurrentTenant(res.currentTenant)
  }
  function synchronizeStorage() { resetIdentity(); token.value = getToken() }

  const isLoggedIn = computed(() => !!token.value)

  async function login(params: UserLoginReqDTO) {
    isLoading.value = true
    try {
      const res = await loginApi(params)
      acceptLogin(res)
      await fetchProfile(false)
      // 返回 currentTenant 供租户 store 使用
      return res.currentTenant
    } finally {
      isLoading.value = false
    }
  }

  async function fetchProfile(mask: boolean = true) {
    const current = generation
    try {
      const profile = await getCurrentUser(mask)
      if (current === generation) user.value = profile
    } catch {
      // 获取用户信息失败不影响其他操作
    }
  }

  async function signOut() {
    const outgoing = token.value
    try {
      await logoutApi()
    } catch {
      // 即使后端登出失败，前端也清除状态
    } finally {
      resetIdentity()
      if (getToken() === outgoing) clearAuth()
      token.value = getToken()
      user.value = null
    }
  }

  return {
    acceptLogin,
    synchronizeStorage,
    token,
    user,
    isLoading,
    isLoggedIn,
    login,
    fetchProfile,
    signOut,
  }
})
