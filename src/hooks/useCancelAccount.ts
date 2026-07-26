import { ref } from 'vue'
import { message } from 'ant-design-vue'
import { getCancelPrepare, sendCancelCode, confirmCancel } from '@/api/user'
import type { CancelPrepareRespDTO } from '@/types/user'

export function useCancelAccount() {
  const step = ref<1 | 2>(1)
  const loading = ref(false)
  const prepareData = ref<CancelPrepareRespDTO | null>(null)
  const code = ref('')
  const countdown = ref(0)
  let timer: ReturnType<typeof setInterval> | null = null

  // 获取警告信息
  async function fetchPrepare(): Promise<boolean> {
    loading.value = true
    try {
      prepareData.value = await getCancelPrepare()
      return true
    } catch {
      // handled by interceptor
      return false
    } finally {
      loading.value = false
    }
  }

  // 发送验证码
  async function sendCode(): Promise<boolean> {
    loading.value = true
    try {
      await sendCancelCode()
      message.success('验证码已发送')
      startCountdown()
      return true
    } catch {
      // handled by interceptor — 包括 B000211（60秒限流）
      // 若拦截器已 toast，这里仍然启动倒计时以置灰按钮
      startCountdown()
      return false
    } finally {
      loading.value = false
    }
  }

  // 确认注销
  async function confirm(codeValue: string): Promise<boolean> {
    loading.value = true
    try {
      await confirmCancel({ code: codeValue })
      return true
    } catch {
      // handled by interceptor（B000212 验证码错误等）
      return false
    } finally {
      loading.value = false
    }
  }

  // 60 秒倒计时
  function startCountdown() {
    countdown.value = 60
    stopTimer()
    timer = setInterval(() => {
      countdown.value--
      if (countdown.value <= 0) {
        stopTimer()
      }
    }, 1000)
  }

  function stopTimer() {
    if (timer) {
      clearInterval(timer)
      timer = null
    }
  }

  // 重置整个流程
  function reset() {
    step.value = 1
    code.value = ''
    countdown.value = 0
    prepareData.value = null
    stopTimer()
  }

  // 在组件 onUnmounted 中调用
  function cleanup() {
    stopTimer()
  }

  return {
    step,
    loading,
    prepareData,
    code,
    countdown,
    fetchPrepare,
    sendCode,
    confirm,
    reset,
    cleanup,
  }
}
