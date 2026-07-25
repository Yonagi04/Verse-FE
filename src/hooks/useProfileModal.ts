import { ref } from 'vue'

/** 个人信息弹窗可见状态 — 全局单例 */
const visible = ref(false)

export function useProfileModal() {
  function open() {
    visible.value = true
  }

  function close() {
    visible.value = false
  }

  return { visible, open, close }
}
