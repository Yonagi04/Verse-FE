<script setup lang="ts">
import { reactive, ref, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { register as registerApi } from '@/api/user'
import RegistrationFields from '@/components/auth/RegistrationFields.vue'
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
<template><div class="register-page"><div class="register-card"><div class="register-header"><h1 class="register-title">注册 Verse</h1><p class="register-desc">创建你的 Verse 账号</p></div>
  <a-form :model="form" layout="vertical" :disabled="loading" @finish="handleSubmit"><RegistrationFields :form="form" /><a-form-item><a-button type="primary" html-type="submit" :loading="loading" block size="large">注册</a-button></a-form-item></a-form>
  <div class="register-footer"><router-link to="/login" custom v-slot="{href,navigate}"><a-button type="link" block :href="href" @click="navigate">已有账号？立即登录</a-button></router-link></div>
</div></div></template>
<style lang="scss" scoped>
.register-page { min-height:100vh; display:flex; align-items:center; justify-content:center; background:$color-bg-secondary; padding:40px 20px; }.register-card { width:440px; max-width:100%; padding:40px; background:$color-bg; border-radius:$radius-card; box-shadow:$shadow-light; }.register-header { text-align:center; margin-bottom:32px; }.register-title { font-size:$font-size-title; font-weight:600; color:$color-text-primary; margin:0 0 8px; }.register-desc { color:$color-text-secondary; margin:0; }.register-footer { margin-top:8px; }
</style>
