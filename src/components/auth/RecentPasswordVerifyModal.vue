<script setup lang="ts">
import { ref, watch } from 'vue'
import { reauthExternal } from '@/api/externalAuth'
import { errorMessage } from '@/hooks/useExternalAuthFlow'
import type { ReauthInput } from '@/types/externalAuth'
const props = defineProps<{ open: boolean; input: Omit<ReauthInput, 'password'>; flowToken?: string }>()
const emit = defineEmits<{ verified: [token: string]; close: [] }>()
const password = ref(''); const busy = ref(false); const error = ref('')
watch(() => props.open, () => { password.value = ''; error.value = '' })
watch(password, () => { error.value = '' })
async function verify() {
  if (busy.value || !password.value) return
  busy.value = true; error.value = ''
  try { const result = await reauthExternal({ ...props.input, password: password.value }, props.flowToken); password.value = ''; emit('verified', result.reauthToken) }
  catch (e) {
    // 密码验证失败使用字段提示，其他错误保留服务端的具体原因。
    const failure = e as { code?: string; response?: { data?: { code?: string } } }
    error.value = (failure.code || failure.response?.data?.code) === 'B000206' ? '密码错误' : errorMessage(e)
  } finally { busy.value = false }
}
</script>
<template>
  <a-modal :open="open" title="验证当前 Verse 账号" :confirm-loading="busy" :mask-closable="false" :closable="!busy" :keyboard="!busy" ok-text="验证并继续" cancel-text="取消" @ok="verify" @cancel="emit('close')">
    <p class="verify-description">为了保护账号安全，请输入当前 Verse 账号的登录密码。</p>
    <a-input-password v-model:value="password" autofocus autocomplete="current-password" placeholder="请输入密码" :disabled="busy" :maxlength="72" :status="error ? 'error' : undefined" aria-label="当前 Verse 密码" :aria-invalid="!!error" :aria-describedby="error ? 'reauth-password-error' : undefined" @press-enter="verify" />
    <p v-if="error" id="reauth-password-error" class="password-error" role="alert">{{ error }}</p>
  </a-modal>
</template>

<style lang="scss" scoped>
.verify-description { margin: 0 0 20px; line-height: 1.7; }
.password-error { margin: 6px 0 0; color: $color-danger; font-size: 12px; line-height: 1.5; text-align: left; }
</style>
