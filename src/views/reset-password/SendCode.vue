<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { sendPhoneCode } from '@/api/user'
import type { UserSendingPhoneCodeReqDTO } from '@/types/user'

const router = useRouter()
const loading = ref(false)

const form = reactive<UserSendingPhoneCodeReqDTO>({
  phone: '',
})

async function handleSubmit() {
  loading.value = true
  try {
    await sendPhoneCode({ ...form })
    message.success('验证码已发送')
    router.push(`/reset-password/verify-code?phone=${encodeURIComponent(form.phone)}`)
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
        <h1 class="reset-title">找回密码</h1>
        <p class="reset-desc">第 1 步：输入你的注册手机号</p>
      </div>
      <a-form :model="form" layout="vertical" @finish="handleSubmit">
        <a-form-item
          name="phone"
          label="手机号"
          :rules="[
            { required: true, message: '请输入手机号' },
            { pattern: /^1[3-9]\d{9}$/, message: '请输入有效的手机号' },
          ]"
        >
          <a-input v-model:value="form.phone" placeholder="请输入注册手机号" size="large" />
        </a-form-item>
        <a-form-item>
          <a-button type="primary" html-type="submit" :loading="loading" block size="large">
            发送验证码
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
