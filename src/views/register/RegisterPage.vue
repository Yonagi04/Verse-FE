<script setup lang="ts">
import { reactive, ref, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { register as registerApi } from '@/api/user'
import RegistrationFields from '@/components/auth/RegistrationFields.vue'
import AuthShell from '@/components/auth/AuthShell.vue'
import AuthPageHeader from '@/components/auth/AuthPageHeader.vue'
const router = useRouter(); const loading = ref(false)
const form = reactive({ username:'', nickname:'', password:'', email:'', phone:'' })
async function handleSubmit() {
  if (loading.value) return
  loading.value = true
  try { await registerApi({ ...form }); form.password = ''; message.success('注册成功，请登录'); await router.replace('/login') }
  catch { /* 错误已由拦截器处理 */ } finally { loading.value = false }
}
onUnmounted(() => { form.password = '' })
</script>

<template>
  <AuthShell>
    <AuthPageHeader eyebrow="CREATE YOUR ACCOUNT" title="注册 Verse" description="创建你的 Verse 账号" />
    <a-form :model="form" layout="vertical" size="large" :disabled="loading" @finish="handleSubmit">
      <RegistrationFields :form="form" />
      <a-form-item>
        <a-button class="submit" type="primary" html-type="submit" :loading="loading" block size="large">注册</a-button>
      </a-form-item>
    </a-form>
    <div class="register-footer">
      <router-link to="/login" custom v-slot="{ href, navigate }">
        <a-button type="link" block :href="href" @click="navigate">已有账号？立即登录</a-button>
      </router-link>
    </div>
  </AuthShell>
</template>

<style lang="scss" scoped>
.submit { height: 46px; font-size: 14px; }
.register-footer { margin-top: 8px; text-align: center; }
:deep(.ant-input), :deep(.ant-input-affix-wrapper) { min-height: 44px; font-size: 13px; }
:deep(.ant-input-affix-wrapper .ant-input) { min-height: unset; }
:deep(.ant-form-item-label label) { font-size: 13px; }
</style>
