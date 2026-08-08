<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { useUserStore } from '@/stores/user'
import { getInviteCodeInfo, joinTenant } from '@/api/tenant'
import type { TenantJoinInfoRespDTO } from '@/types/tenant'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

type PageState =
  | 'loading'
  | 'fetch_error'
  | 'unauthenticated'
  | 'confirm'
  | 'joining'
  | 'success'
  | 'pending'
  | 'error'
  | 'already_joined'

const pageState = ref<PageState>('loading')
const inviteInfo = ref<TenantJoinInfoRespDTO | null>(null)
const errorMessage = ref('')

const inviteCode = (route.params.code as string)?.toUpperCase() ?? ''

onMounted(async () => {
  // 1. 获取邀请码公开信息（无需登录，后端公开接口）
  try {
    inviteInfo.value = await getInviteCodeInfo(inviteCode)
  } catch (e: unknown) {
    // 未登录用户调用接口失败（如 401）→ 展示未登录引导，不跳转登录页
    if (!userStore.isLoggedIn) {
      pageState.value = 'unauthenticated'
      return
    }
    const code = (e as any)?.code
    const msg = (e as any)?.message || ''
    if (code === 'B000304' || code === 'B000325') {
      errorMessage.value = '该邀请码已过期或已被停用'
    } else if (code === 'B000324') {
      errorMessage.value = '邀请码不存在'
    } else {
      errorMessage.value = msg || '获取邀请信息失败'
    }
    pageState.value = 'fetch_error'
    return
  }

  // 2. 如果已登录但 user 信息未加载（如页面刷新后），先拉取用户信息
  //    注意：必须在 getInviteCodeInfo 之后，避免 401 触发 interceptor 跳转
  if (userStore.isLoggedIn && !userStore.user) {
    await userStore.fetchProfile()
  }

  // 3. 根据登录状态决定页面展示
  if (userStore.isLoggedIn) {
    pageState.value = 'confirm'
  } else {
    pageState.value = 'unauthenticated'
  }
})

function goLogin() {
  router.push(`/login?redirect=${encodeURIComponent(`/join/${inviteCode}`)}`)
}

async function handleJoin() {
  pageState.value = 'joining'
  try {
    const result = await joinTenant({ inviteCode })
    if (result.pendingApproval) {
      pageState.value = 'pending'
      message.info('加入申请已提交，等待管理员审批')
    } else {
      pageState.value = 'success'
      message.success('加入成功')
      setTimeout(() => {
        router.push('/dashboard')
      }, 3000)
    }
  } catch (e: unknown) {
    const code = (e as any)?.code
    if (code === 'B000305') {
      pageState.value = 'already_joined'
    } else {
      pageState.value = 'error'
    }
  }
}

function goDashboard() {
  router.push('/dashboard')
}
</script>

<template>
  <div class="join-page">
    <div class="join-card">
      <!-- Brand -->
      <div class="join-header">
        <h1 class="join-brand">Verse</h1>
        <p class="join-subtitle">统一 LLM 管理平台</p>
      </div>

      <!-- Loading -->
      <template v-if="pageState === 'loading'">
        <div class="join-body">
          <a-spin size="large" />
        </div>
      </template>

      <!-- Fetch Error -->
      <template v-else-if="pageState === 'fetch_error'">
        <div class="join-body">
          <div class="status-icon error">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="15" y1="9" x2="9" y2="15"/>
              <line x1="9" y1="9" x2="15" y2="15"/>
            </svg>
          </div>
          <h3 class="status-title error-text">邀请链接无效</h3>
          <p class="status-desc">{{ errorMessage }}，请联系管理员获取新的邀请链接</p>
          <a-button block @click="goDashboard">返回首页</a-button>
        </div>
      </template>

      <!-- Unauthenticated — 引导登录 -->
      <template v-else-if="pageState === 'unauthenticated'">
        <div class="join-body">
          <div class="status-icon invite">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <line x1="19" y1="8" x2="19" y2="14"/>
              <line x1="22" y1="11" x2="16" y2="11"/>
            </svg>
          </div>
          <h3 class="status-title">加入 {{ inviteInfo?.name || '团队' }}</h3>
          <p class="status-desc">
            {{ inviteInfo ? '你收到了一个 Verse 团队邀请，登录后即可一键加入' : '请登录后查看并加入团队' }}
          </p>
          <a-button type="primary" size="large" block @click="goLogin">登录并加入</a-button>
          <div class="extra-link">
            <router-link to="/register" custom v-slot="{ href, navigate }">
              <a-button type="link" :href="href" @click="navigate">还没有账号？立即注册</a-button>
            </router-link>
          </div>
          <p class="code-hint">邀请码 {{ inviteCode }}</p>
        </div>
      </template>

      <!-- Confirm (authenticated) -->
      <template v-else-if="pageState === 'confirm'">
        <div class="join-body">
          <div class="status-icon invite">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <line x1="19" y1="8" x2="19" y2="14"/>
              <line x1="22" y1="11" x2="16" y2="11"/>
            </svg>
          </div>
          <h3 class="status-title">加入 {{ inviteInfo?.name }}</h3>
          <p class="status-desc">
            当前登录：<strong>{{ userStore.user?.username }}</strong><br>
            确认后将作为 <strong>成员</strong> 角色加入该团队
          </p>
          <a-button type="primary" size="large" block :loading="false" @click="handleJoin">确认加入</a-button>
          <p class="code-hint">邀请码 {{ inviteCode }}</p>
        </div>
      </template>

      <!-- Joining -->
      <template v-else-if="pageState === 'joining'">
        <div class="join-body">
          <a-spin size="large" />
          <p class="status-desc" style="margin-top: 16px;">正在加入...</p>
        </div>
      </template>

      <!-- Success -->
      <template v-else-if="pageState === 'success'">
        <div class="join-body">
          <div class="status-icon success">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <h3 class="status-title success-text">加入成功！</h3>
          <p class="status-desc">你已成功加入 <strong>{{ inviteInfo?.name }}</strong></p>
          <a-button type="primary" size="large" block @click="goDashboard">进入工作台</a-button>
        </div>
      </template>

      <!-- Pending Approval -->
      <template v-else-if="pageState === 'pending'">
        <div class="join-body">
          <div class="status-icon pending">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
          </div>
          <h3 class="status-title">申请已提交</h3>
          <p class="status-desc">
            加入 <strong>{{ inviteInfo?.name }}</strong> 需要管理员审批<br>
            请耐心等待，审批结果将通过通知告知
          </p>
          <a-button size="large" block @click="goDashboard">返回首页</a-button>
        </div>
      </template>

      <!-- Already Joined -->
      <template v-else-if="pageState === 'already_joined'">
        <div class="join-body">
          <div class="status-icon invite">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
            </svg>
          </div>
          <h3 class="status-title">你已加入该团队</h3>
          <p class="status-desc">你已经是 <strong>{{ inviteInfo?.name }}</strong> 的成员</p>
          <a-button type="primary" size="large" block @click="goDashboard">进入工作台</a-button>
        </div>
      </template>

      <!-- Generic Error -->
      <template v-else-if="pageState === 'error'">
        <div class="join-body">
          <div class="status-icon error">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="15" y1="9" x2="9" y2="15"/>
              <line x1="9" y1="9" x2="15" y2="15"/>
            </svg>
          </div>
          <h3 class="status-title error-text">加入失败</h3>
          <p class="status-desc">加入 {{ inviteInfo?.name }} 时发生错误，请稍后重试</p>
          <a-button size="large" block @click="goDashboard">返回首页</a-button>
        </div>
      </template>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.join-page {
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: $color-bg-secondary;
}

.join-card {
  width: 400px;
  padding: 40px;
  background: $color-bg;
  border-radius: $radius-card;
  box-shadow: $shadow-light;
}

.join-header {
  text-align: center;
  margin-bottom: 32px;
}

.join-brand {
  font-size: 32px;
  font-weight: 700;
  color: $color-primary;
  letter-spacing: 2px;
  margin: 0 0 8px 0;
}

.join-subtitle {
  color: $color-text-secondary;
  font-size: $font-size-body;
  margin: 0;
}

.join-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-height: 200px;
  justify-content: center;
}

.status-icon {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
  flex-shrink: 0;

  &.invite {
    background: #e6f4ff;
    color: $color-primary;
  }

  &.success {
    background: #f6ffed;
    color: $color-success;
  }

  &.pending {
    background: #fffbe6;
    color: $color-warning;
  }

  &.error {
    background: #fff1f0;
    color: $color-danger;
  }
}

.status-title {
  font-size: 20px;
  font-weight: 600;
  margin: 0 0 8px 0;
  color: $color-text-primary;
  line-height: 1.4;
}

.success-text { color: $color-success; }
.error-text  { color: $color-danger; }

.status-desc {
  font-size: 14px;
  color: $color-text-secondary;
  text-align: center;
  margin: 0 0 24px 0;
  line-height: 1.7;

  strong {
    color: $color-text-primary;
    font-weight: 500;
  }
}

.extra-link {
  margin-top: 14px;
}

.code-hint {
  font-size: 12px;
  color: $color-text-secondary;
  margin: 12px 0 0;
}
</style>
