import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { useUserStore } from '@/stores/user'

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/login/LoginPage.vue'),
    meta: { requiresAuth: false },
  },
  {
    path: '/register',
    name: 'Register',
    component: () => import('@/views/register/RegisterPage.vue'),
    meta: { requiresAuth: false },
  },
  {
    path: '/reset-password/send-code',
    name: 'SendCode',
    component: () => import('@/views/reset-password/SendCode.vue'),
    meta: { requiresAuth: false },
  },
  {
    path: '/reset-password/verify-code',
    name: 'VerifyCode',
    component: () => import('@/views/reset-password/VerifyCode.vue'),
    meta: { requiresAuth: false },
  },
  {
    path: '/reset-password/reset',
    name: 'ResetPassword',
    component: () => import('@/views/reset-password/ResetPassword.vue'),
    meta: { requiresAuth: false },
  },
  {
    path: '/join/:code',
    name: 'JoinByInvite',
    component: () => import('@/views/join/JoinPage.vue'),
    meta: { requiresAuth: false },
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: () => import('@/views/dashboard/DashboardPage.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/tenants',
    name: 'TenantList',
    component: () => import('@/views/tenant/TenantList.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/tenants/create',
    name: 'TenantCreate',
    redirect: '/tenants?action=create',
  },
  {
    path: '/notifications',
    name: 'NotificationList',
    component: () => import('@/views/notification/NotificationList.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/tenants/:tenantId',
    name: 'TenantDetail',
    component: () => import('@/views/tenant/TenantDetail.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/',
    redirect: '/dashboard',
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/dashboard',
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

// 检查是否为安全的内部路径
function isSafeRedirect(path: unknown): path is string {
  return typeof path === 'string'
    && !path.startsWith('http://')
    && !path.startsWith('https://')
    && !path.startsWith('//')
    && path.startsWith('/')
}

// 全局前置守卫
router.beforeEach(async (to, _from, next) => {
  const userStore = useUserStore()

  if (to.meta.requiresAuth === false) {
    // 公开页面
    if (userStore.isLoggedIn && to.path === '/login') {
      // 登录页：已登录用户优先看 redirect 参数
      const redirect = to.query.redirect
      if (isSafeRedirect(redirect)) {
        next(redirect)
      } else {
        next('/dashboard')
      }
    } else {
      next()
    }
  } else {
    // 需认证页面：未登录跳转登录
    if (!userStore.isLoggedIn) {
      next(`/login?redirect=${encodeURIComponent(to.fullPath)}`)
    } else {
      // 刷新页面后 store 中 user 为 null，需要重新拉取以显示昵称等
      if (!userStore.user && !userStore.isLoading) {
        await userStore.fetchProfile()
      }
      next()
    }
  }
})

export default router
