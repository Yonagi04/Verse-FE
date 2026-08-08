<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { UserOutlined, LockOutlined } from '@ant-design/icons-vue'
import { useUserStore } from '@/stores/user'
import { useTenantStore } from '@/stores/tenant'
import { usePermissionStore } from '@/stores/permission'
import type { UserLoginReqDTO } from '@/types/user'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const tenantStore = useTenantStore()
const permissionStore = usePermissionStore()

const form = reactive<UserLoginReqDTO>({
  username: '',
  password: '',
})

const loading = ref(false)

// ========== 已注销用户弹窗 ==========
const deactivatedVisible = ref(false)
const deactivatedMessage = ref('')

async function handleSubmit() {
  loading.value = true
  try {
    const currentTenant = await userStore.login({ ...form })
    tenantStore.setCurrentTenant(currentTenant)
    permissionStore.setRole(currentTenant?.role ?? null)
    await tenantStore.fetchTenants()
    message.success('登录成功')

    const redirect = route.query.redirect
    if (typeof redirect === 'string' && redirect.startsWith('/') && !redirect.startsWith('//')) {
      router.push(redirect)
    } else {
      router.push('/dashboard')
    }
  } catch (err: unknown) {
    const code = (err as any)?.code
    if (code === 'B000218') {
      deactivatedMessage.value = (err as Error).message || ''
      deactivatedVisible.value = true
    }
    // 其他错误已在 request 拦截器中 toast 处理
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-page">
    <div class="login-card">
      <div class="login-header">
        <h1 class="login-title">Verse</h1>
        <p class="login-desc">统一 LLM 管理平台</p>
      </div>
      <a-form
        :model="form"
        layout="vertical"
        size="large"
        @finish="handleSubmit"
      >
        <a-form-item name="username" :rules="[{ required: true, message: '请输入用户名' }]">
          <a-input
            v-model:value="form.username"
            placeholder="用户名"
            autocomplete="username"
          >
            <template #prefix>
              <UserOutlined />
            </template>
          </a-input>
        </a-form-item>
        <a-form-item name="password" :rules="[{ required: true, message: '请输入密码' }]">
          <a-input-password
            v-model:value="form.password"
            placeholder="密码"
            autocomplete="current-password"
          >
            <template #prefix>
              <LockOutlined />
            </template>
          </a-input-password>
        </a-form-item>
        <a-form-item>
          <a-button
            type="primary"
            html-type="submit"
            :loading="loading"
            block
          >
            登录
          </a-button>
        </a-form-item>
      </a-form>
      <div class="login-footer">
        <router-link to="/register" custom v-slot="{ href, navigate }">
          <a-button type="link" :href="href" @click="navigate">
            还没有账号？立即注册
          </a-button>
        </router-link>
        <router-link to="/reset-password/send-code" custom v-slot="{ href, navigate }">
          <a-button type="link" :href="href" @click="navigate">
            忘记密码？
          </a-button>
        </router-link>
      </div>
    </div>

    <!-- ========== 已注销用户弹窗 ========== -->
    <a-modal
      :open="deactivatedVisible"
      title="账号已注销"
      :footer="null"
      :width="440"
      @cancel="deactivatedVisible = false"
    >
      <p class="deactivated-msg">{{ deactivatedMessage }}</p>
      <a-button type="primary" block @click="deactivatedVisible = false">确认</a-button>
    </a-modal>
  </div>
</template>

<style lang="scss" scoped>
.login-page {
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: $color-bg-secondary;
}

.login-card {
  width: 400px;
  padding: 40px;
  background: $color-bg;
  border-radius: $radius-card;
  box-shadow: $shadow-light;
}

.login-header {
  text-align: center;
  margin-bottom: 32px;
}

.login-title {
  font-size: 32px;
  font-weight: 700;
  color: $color-primary;
  letter-spacing: 2px;
  margin: 0 0 8px 0;
}

.login-desc {
  color: $color-text-secondary;
  font-size: $font-size-body;
  margin: 0;
}

.login-footer {
  display: flex;
  justify-content: space-between;
}

// ========== 已注销用户弹窗 ==========
.deactivated-msg {
  color: $color-text-primary;
  font-size: 14px;
  line-height: 1.8;
  text-align: center;
  padding: 8px 0;
}
</style>
