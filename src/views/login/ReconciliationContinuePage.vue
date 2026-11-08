<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AuthShell from '@/components/auth/AuthShell.vue'
import { issueReconciliationHandoff, ReconciliationRequestError } from '@/api/reconciliationTransport'
import { useUserStore } from '@/stores/user'
import { clearAuth, getToken } from '@/utils/auth'
import {
  mainSiteOrigin, parseReconciliationContinuation, reconciliationContinuationPath, validReconciliationProof,
} from '@/utils/reconciliationContinuation'

const route = useRoute()
const router = useRouter()
const user = useUserStore()
const busy = ref(false)
const error = ref('')
let disposed = false

async function connect() {
  if (busy.value) return
  busy.value = true
  error.value = ''
  const continuation = parseReconciliationContinuation(route.fullPath)
  const redirect = reconciliationContinuationPath(route.fullPath)
  let token: string | null = null
  try {
    if (!continuation || !redirect || window.location.origin !== mainSiteOrigin() || window.parent !== window) {
      throw new Error('补账续接地址无效，请重新打开通知中的链接')
    }
    token = getToken()
    if (!token) {
      user.synchronizeStorage()
      await router.replace({ path: '/login', query: { redirect } })
      return
    }
    const { batchCode, challenge, state } = continuation
    const result = await issueReconciliationHandoff(token, batchCode, challenge)
    if (disposed) return
    if (getToken() !== token) throw new Error('当前 Verse 账号已变化，请重试')
    const target = new URL(result.target)
    if (target.pathname !== `/${batchCode}` || target.search || target.hash || target.username || target.password
      || (target.protocol !== 'https:' && !(target.protocol === 'http:' && target.hostname === 'reconciliation.localhost'))
      || !validReconciliationProof(result.code)) {
      throw new Error('补账服务返回的地址无效')
    }
    target.hash = new URLSearchParams({ code: result.code, state }).toString()
    window.location.replace(target.href)
  } catch (failure) {
    if (disposed) return
    if (redirect && token && failure instanceof ReconciliationRequestError && failure.status === 401) {
      if (getToken() === token) {
        clearAuth()
        user.synchronizeStorage()
        await router.replace({ path: '/login', query: { redirect } })
        return
      }
      error.value = '当前 Verse 账号已变化，请重试'
    } else {
      error.value = failure instanceof Error ? failure.message : '无法连接自助补账，请重试'
    }
  } finally {
    busy.value = false
  }
}

onMounted(() => void connect())
onUnmounted(() => { disposed = true })
</script>

<template>
  <AuthShell>
    <h2>正在连接自助补账</h2>
    <p v-if="busy" role="status">正在验证当前 Verse 登录状态…</p>
    <a-alert v-if="error" :message="error" type="error" show-icon />
    <a-button v-if="error" class="retry" type="primary" @click="connect">重试</a-button>
  </AuthShell>
</template>

<style scoped lang="scss">
h2 { font-size: $font-size-title; margin-bottom: 12px; }
.retry { margin-top: 12px; }
</style>
