<script setup lang="ts">
import { reactive, ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { resetPassword } from '@/api/user'
import type { UserResetPasswordReqDTO } from '@/types/user'

const route = useRoute()
const router = useRouter()
const loading = ref(false)

const form = reactive<UserResetPasswordReqDTO>({
  token: '',
  phone: '',
  password: '',
})

const confirmPassword = ref('')

function validateConfirmPassword() {
  if (!confirmPassword.value) {
    return Promise.reject('请再次输入新密码')
  }
  if (confirmPassword.value !== form.password) {
    return Promise.reject('两次输入的密码不一致')
  }
  return Promise.resolve()
}

onMounted(() => {
  form.phone = (route.query.phone as string) || ''
  form.token = (route.query.token as string) || ''
  if (!form.token) {
    message.error('请先验证手机号')
    router.push('/reset-password/send-code')
  }
})

async function handleSubmit() {
  loading.value = true
  try {
    await resetPassword({ ...form })
    message.success('密码重置成功，请重新登录')
    router.push('/login')
  } catch {
    // handled by interceptor
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="reset-page-wrapper">
    <div class="reset-card">
      <div class="reset-header">
        <h1 class="reset-title">设置新密码</h1>
        <p class="reset-desc">第 3 步：为 {{ form.phone }} 设置新密码</p>
      </div>
      <a-form :model="form" layout="vertical" @finish="handleSubmit">
        <a-form-item
          name="password"
          label="新密码"
          :rules="[
            { required: true, message: '请输入新密码' },
            { min: 8, max: 32, message: '密码长度为 8-32 个字符' },
          ]"
        >
          <a-input-password v-model:value="form.password" placeholder="输入新密码" size="large" />
        </a-form-item>
        <a-form-item
          name="confirmPassword"
          label="确认密码"
          :rules="[
            { required: true, validator: validateConfirmPassword, trigger: 'blur' },
          ]"
        >
          <a-input-password v-model:value="confirmPassword" placeholder="再次输入新密码" size="large" />
        </a-form-item>
        <a-form-item>
          <a-button type="primary" html-type="submit" :loading="loading" block size="large">
            重置密码
          </a-button>
        </a-form-item>
      </a-form>
      <div class="reset-footer">
        <router-link to="/login" custom v-slot="{ href, navigate }">
          <a-button type="link" block :href="href" @click="navigate">
            返回登录
          </a-button>
        </router-link>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.reset-page-wrapper {
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: $color-bg-secondary;
}

.reset-card {
  width: 400px;
  padding: 40px;
  background: $color-bg;
  border-radius: $radius-card;
  box-shadow: $shadow-light;
}

.reset-header {
  text-align: center;
  margin-bottom: 32px;
}

.reset-title {
  font-size: $font-size-title;
  font-weight: 600;
  color: $color-text-primary;
  margin: 0 0 8px 0;
}

.reset-desc {
  color: $color-text-secondary;
  margin: 0;
}

.reset-footer {
  margin-top: 8px;
}
</style>
