import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useSettingsStore = defineStore('settings', () => {
  // TODO: 后续从 localStorage 或后端同步用户偏好设置
  const locale = ref('zh-CN')
  const timezone = ref('Asia/Shanghai')

  return {
    locale,
    timezone,
  }
})
