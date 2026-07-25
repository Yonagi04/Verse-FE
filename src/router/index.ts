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
    path: '/dashboard',
    name: 'Dashboard',
    component: () => import('@/views/dashboard/DashboardPage.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/profile',
    name: 'UserProfile',
    component: () => import('@/views/user/UserProfile.vue'),
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
    component: () => import('@/views/tenant/TenantCreate.vue'),
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

// 全局前置守卫
router.beforeEach((to, _from, next) => {
  const userStore = useUserStore()

  if (to.meta.requiresAuth === false) {
    // 公开页面：已登录则跳转到 dashboard
    if (userStore.isLoggedIn && to.path === '/login') {
      next('/dashboard')
    } else {
      next()
    }
  } else {
    // 需认证页面：未登录跳转登录
    if (!userStore.isLoggedIn) {
      next('/login')
    } else {
      next()
    }
  }
})

export default router
