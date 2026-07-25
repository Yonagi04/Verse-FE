<script setup lang="ts">
import { reactive, ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { verifyPhoneCode } from '@/api/user'
import type { UserVerifyPhoneCodeReqDTO } from '@/types/user'

const route = useRoute()
const router = useRouter()
const loading = ref(false)

const form = reactive<UserVerifyPhoneCodeReqDTO>({
  phone: '',
  code: '',
})

onMounted(() => {
  form.phone = (route.query.phone as string) || ''
  if (!form.phone) {
    message.error('请先输入手机号')
    router.push('/reset-password/send-code')
  }
})

async function handleSubmit() {
  loading.value = true
  try {
    const res = await verifyPhoneCode({ ...form })
    router.push(`/reset-password/reset?phone=${encodeURIComponent(form.phone)}&token=${encodeURIComponent(res.token)}`)
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
        <h1 class="reset-title">验证验证码</h1>
        <p class="reset-desc">第 2 步：输入发送至 {{ form.phone }} 的验证码</p>
      </div>
      <a-form :model="form" layout="vertical" @finish="handleSubmit">
        <a-form-item name="phone" label="手机号">
          <a-input v-model:value="form.phone" disabled size="large" />
        </a-form-item>
        <a-form-item
          name="code"
          label="验证码"
          :rules="[{ required: true, message: '请输入验证码' }]"
        >
          <a-input v-model:value="form.code" placeholder="请输入 6 位验证码" size="large" maxlength="6" />
        </a-form-item>
        <a-form-item>
          <a-button type="primary" html-type="submit" :loading="loading" block size="large">
            验证
          </a-button>
        </a-form-item>
      </a-form>
      <div class="reset-footer">
        <router-link to="/reset-password/send-code" custom v-slot="{ href, navigate }">
          <a-button type="link" block :href="href" @click="navigate">
            重新获取验证码
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
