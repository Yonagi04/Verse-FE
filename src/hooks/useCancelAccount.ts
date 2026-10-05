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
  const error = ref('')
  const handoverRequired = ref(false)
  let timer: ReturnType<typeof setInterval> | null = null

  // 保留服务端租户名称；HTTP 错误和业务错误都在注销弹窗内展示。
  function recordError(failure: unknown, fallback: string) {
    const details = failure as { code?: string; message?: string; response?: { data?: { code?: string; message?: string } } } | null
    error.value = details?.response?.data?.message || details?.message || fallback
    const errorCode = details?.code || details?.response?.data?.code
    handoverRequired.value = errorCode === 'B000224'
    return errorCode
  }

  // 获取警告信息
  async function fetchPrepare(): Promise<boolean> {
    loading.value = true
    error.value = ''
    handoverRequired.value = false
    prepareData.value = null
    try {
      prepareData.value = await getCancelPrepare()
      return true
    } catch (failure) {
      recordError(failure, '暂时无法检查注销条件，请稍后重试。')
      return false
    } finally {
      loading.value = false
    }
  }

  // 发送验证码
  async function sendCode(): Promise<boolean> {
    loading.value = true
    error.value = ''
    try {
      await sendCancelCode()
      message.success('验证码已发送')
      startCountdown()
      return true
    } catch (failure) {
      // 只有成功或明确限频才进入倒计时，交接拒绝不表示验证码已发送。
      if (recordError(failure, '验证码发送失败，请稍后重试。') === 'B000211') startCountdown()
      return false
    } finally {
      loading.value = false
    }
  }

  // 确认注销
  async function confirm(codeValue: string): Promise<boolean> {
    loading.value = true
    error.value = ''
    try {
      await confirmCancel({ code: codeValue })
      return true
    } catch (failure) {
      recordError(failure, '暂时无法注销，请稍后重试。')
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
    error.value = ''
    handoverRequired.value = false
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
    error,
    handoverRequired,
    fetchPrepare,
    sendCode,
    confirm,
    reset,
    cleanup,
  }
}
