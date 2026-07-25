<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { register as registerApi } from '@/api/user'
import type { UserRegisterReqDTO } from '@/types/user'

const router = useRouter()
const loading = ref(false)

const form = reactive<UserRegisterReqDTO>({
  username: '',
  nickname: '',
  password: '',
  email: '',
  phone: '',
})

async function handleSubmit() {
  loading.value = true
  try {
    await registerApi({ ...form })
    message.success('注册成功，请登录')
    router.push('/login')
  } catch {
    // 错误已由拦截器处理
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="register-page">
    <div class="register-card">
      <div class="register-header">
        <h1 class="register-title">注册 Verse</h1>
        <p class="register-desc">创建你的 Verse 账号</p>
      </div>
      <a-form
        :model="form"
        layout="vertical"
        @finish="handleSubmit"
      >
        <a-form-item
          name="username"
          label="用户名"
          :rules="[
            { required: true, message: '请输入用户名' },
            { min: 4, max: 20, message: '长度为 4-20 个字符' },
            { pattern: /^[a-zA-Z0-9_]+$/, message: '仅支持字母、数字、下划线' },
          ]"
        >
          <a-input v-model:value="form.username" placeholder="4-20 个字符" />
        </a-form-item>
        <a-form-item name="nickname" label="昵称">
          <a-input v-model:value="form.nickname" placeholder="给自己取个昵称（可选）" />
        </a-form-item>
        <a-form-item
          name="password"
          label="密码"
          :rules="[
            { required: true, message: '请输入密码' },
            { min: 8, max: 32, message: '长度为 8-32 个字符' },
          ]"
        >
          <a-input-password v-model:value="form.password" placeholder="8-32 个字符" />
        </a-form-item>
        <a-form-item
          name="email"
          label="邮箱"
          :rules="[
            { required: true, message: '请输入邮箱' },
            { type: 'email', message: '请输入有效的邮箱地址' },
          ]"
        >
          <a-input v-model:value="form.email" placeholder="example@email.com" />
        </a-form-item>
        <a-form-item
          name="phone"
          label="手机号"
          :rules="[
            { required: true, message: '请输入手机号' },
            { pattern: /^1[3-9]\d{9}$/, message: '请输入有效的手机号' },
          ]"
        >
          <a-input v-model:value="form.phone" placeholder="13800138000" />
        </a-form-item>
        <a-form-item>
          <a-button
            type="primary"
            html-type="submit"
            :loading="loading"
            block
            size="large"
          >
            注册
          </a-button>
        </a-form-item>
      </a-form>
      <div class="register-footer">
        <router-link to="/login" custom v-slot="{ href, navigate }">
          <a-button type="link" block :href="href" @click="navigate">
            已有账号？立即登录
          </a-button>
        </router-link>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.register-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: $color-bg-secondary;
  padding: 40px 0;
}

.register-card {
  width: 440px;
  padding: 40px;
  background: $color-bg;
  border-radius: $radius-card;
  box-shadow: $shadow-light;
}

.register-header {
  text-align: center;
  margin-bottom: 32px;
}

.register-title {
  font-size: $font-size-title;
  font-weight: 600;
  color: $color-text-primary;
  margin: 0 0 8px 0;
}

.register-desc {
  color: $color-text-secondary;
  margin: 0;
}

.register-footer {
  margin-top: 8px;
}
</style>
