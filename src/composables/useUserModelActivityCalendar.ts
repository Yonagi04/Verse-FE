import { onBeforeUnmount, ref, watch } from 'vue'
import { getUserModelActivityCalendar } from '@/api/userModelActivityCalendar'
import { apiErrorDetails } from '@/utils/apiError'
import { useUserStore } from '@/stores/user'
import { buildModelActivityCells } from '@/utils/userModelActivityCalendar'
import type { UserModelActivityCalendar } from '@/types/userModelActivityCalendar'

/** 状态只存本页内存；最后一次选择与当前登录会话共同决定写入资格。 */
export function useUserModelActivityCalendar() {
  const user = useUserStore()
  const selection = ref('ROLLING_365'), data = ref<UserModelActivityCalendar | null>(null), loading = ref(false), error = ref('')
  const today = ref('')
  let sequence = 0, controller: AbortController | undefined, lastRefresh = 0
  async function refresh() {
    const current = ++sequence, identity = user.token
    controller?.abort(); controller = new AbortController(); loading.value = true; error.value = ''
    lastRefresh = Date.now()
    try {
      const result = await getUserModelActivityCalendar(selection.value === 'ROLLING_365' ? 'ROLLING_365' : 'YEAR',
        selection.value === 'ROLLING_365' ? undefined : Number(selection.value), controller.signal)
      buildModelActivityCells(result)
      if (current === sequence && identity === user.token) { data.value = result; today.value = result.today }
    } catch (failure) {
      if (current === sequence && identity === user.token && !apiErrorDetails(failure).cancelled) error.value = apiErrorDetails(failure).message
    } finally { if (current === sequence && identity === user.token) loading.value = false }
  }
  watch(selection, () => { if (user.token) void refresh() })
  watch(() => user.token, () => {
    ++sequence; controller?.abort(); data.value = null; today.value = ''; error.value = ''; loading.value = false
    const resetRange = selection.value !== 'ROLLING_365'
    selection.value = 'ROLLING_365'
    if (user.token && !resetRange) void refresh()
  })
  function visible() { if (document.visibilityState === 'visible' && Date.now() - lastRefresh > 60000 && !loading.value) void refresh() }
  document.addEventListener('visibilitychange', visible)
  onBeforeUnmount(() => { ++sequence; controller?.abort(); data.value = null; document.removeEventListener('visibilitychange', visible) })
  void refresh()
  return { selection, data, today, loading, error, refresh }
}
