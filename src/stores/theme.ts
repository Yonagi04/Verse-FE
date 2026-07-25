import { defineStore } from 'pinia'
import { ref } from 'vue'

type ThemeMode = 'light' | 'dark'

export const useThemeStore = defineStore('theme', () => {
  const mode = ref<ThemeMode>('light')
  const sidebarCollapsed = ref(false)

  function toggleSidebar() {
    sidebarCollapsed.value = !sidebarCollapsed.value
  }

  function setSidebarCollapsed(collapsed: boolean) {
    sidebarCollapsed.value = collapsed
  }

  return {
    mode,
    sidebarCollapsed,
    toggleSidebar,
    setSidebarCollapsed,
  }
})
