import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { useTenantStore } from '@/stores/tenant'
import { usePlaygroundStore } from '@/stores/playground'
import { hasStoredFlow } from '@/hooks/useExternalAuthFlow'
import { getFlow } from '@/api/externalAuth'
import { readFlow } from '@/hooks/useExternalAuthFlow'

const routes: RouteRecordRaw[] = [
  ...['/auth/external/callback', '/auth/external/error', '/login/select-account', '/register/external'].map(path => ({
    path, component: () => import('@/views/external-auth/ExternalFlowPage.vue'), meta: { requiresAuth: false, layout: 'auth', externalFlow: true },
  })),
  { path: '/profile/external-account/confirm', component: () => import('@/views/external-auth/ExternalFlowPage.vue'), meta: { requiresAuth: true, layout: 'app', externalFlow: true } },
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
    path: '/tenants/:tenantId/activities',
    name: 'TenantActivities',
    component: () => import('@/views/tenant/TenantActivityPage.vue'),
    meta: { requiresAuth: true, tenantScoped: true },
  },
  {
    path: '/tenants/:tenantId',
    name: 'TenantDetail',
    component: () => import('@/views/tenant/TenantDetail.vue'),
    meta: { requiresAuth: true, tenantScoped: true },
  },
  {
    path: '/api-keys',
    name: 'ApiKeyList',
    component: () => import('@/views/apikey/ApiKeyList.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/llm-services',
    name: 'LlmServiceList',
    component: () => import('@/views/llm-service/LlmServiceList.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/logs',
    name: 'AuditList',
    component: () => import('@/views/audit/AuditList.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/usage',
    name: 'Usage',
    component: () => import('@/views/usage/UsagePage.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/playground',
    name: 'Playground',
    component: () => import('@/views/playground/PlaygroundPage.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/profile',
    name: 'UserCenter',
    component: () => import('@/views/user/UserCenter.vue'),
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

routes.forEach(route => { if (route.meta && !route.meta.layout) route.meta.layout = route.meta.requiresAuth === false ? 'auth' : 'app' })
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
  const tenantStore = useTenantStore()

  if (to.meta.requiresAuth === false) {
    // 公开页面
    let pendingBinding = false
    if (to.path === '/login' && typeof to.query.flow === 'string' && hasStoredFlow(to.query.flow)) {
      try { const flow = readFlow(to.query.flow); pendingBinding = (await getFlow(flow.flowId, flow.flowToken)).stage === 'EXISTING_ACCOUNT_LOGIN' } catch { /* 登录页显示流程错误 */ }
    }
    if (userStore.isLoggedIn && to.path === '/login' && !pendingBinding && !to.query.flow) {
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
      try {
        await Promise.all([
          !userStore.user && !userStore.isLoading ? userStore.fetchProfile() : Promise.resolve(),
          tenantStore.initialize(),
        ])
      } catch {
        // 列表失败仍允许进入列表的重试页；详情由 info 接口独立判断目标访问资格。
        if (to.name === 'TenantList' || to.name === 'TenantDetail' || to.name === 'Dashboard' || to.meta.externalFlow) {
          next()
          return
        }
        next('/tenants')
        return
      }

      // 详情页由 info 接口校验目标成员资格，保留无权访问时的错误页面。
      // 动态等当前租户业务页面仍须匹配服务端当前上下文。
      if (to.meta.tenantScoped === true && to.name !== 'TenantDetail') {
        const targetTenantId = String(to.params.tenantId)
        if (tenantStore.currentTenantId !== targetTenantId) {
          next('/dashboard')
          return
        }
      }
      if (to.path === '/playground') {
        const currentTenantId = tenantStore.currentTenantId
        const playground = usePlaygroundStore()
        if (!currentTenantId || !(await playground.refresh(currentTenantId))?.enabled) {
          next('/dashboard')
          return
        }
      }
      next()
    }
  }
})

export default router
