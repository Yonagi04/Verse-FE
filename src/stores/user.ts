import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getToken, setToken, setStoredUser, clearAuth } from '@/utils/auth'
import { login as loginApi, logout as logoutApi, getCurrentUser } from '@/api/user'
import type { UserLoginReqDTO, UserRespDTO } from '@/types/user'

export const useUserStore = defineStore('user', () => {
  const token = ref<string | null>(getToken())
  const user = ref<UserRespDTO | null>(null)
  const isLoading = ref(false)

  const isLoggedIn = computed(() => !!token.value)

  async function login(params: UserLoginReqDTO) {
    isLoading.value = true
    try {
      const res = await loginApi(params)
      token.value = res.token
      setToken(res.token)
      setStoredUser({
        userId: res.userId,
        username: res.username,
        nickname: res.nickname,
      })
      await fetchProfile(false)
      // 返回 currentTenant 供租户 store 使用
      return res.currentTenant
    } finally {
      isLoading.value = false
    }
  }

  async function fetchProfile(mask: boolean = true) {
    try {
      user.value = await getCurrentUser(mask)
    } catch {
      // 获取用户信息失败不影响其他操作
    }
  }

  async function signOut() {
    try {
      await logoutApi()
    } catch {
      // 即使后端登出失败，前端也清除状态
    } finally {
      clearAuth()
      token.value = null
      user.value = null
    }
  }

  return {
    token,
    user,
    isLoading,
    isLoggedIn,
    login,
    fetchProfile,
    signOut,
  }
})
