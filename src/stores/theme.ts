import { defineStore } from 'pinia'
import { computed, onScopeDispose, ref, watch } from 'vue'
import {
  parseThemeMode, readThemeMode, resolveTheme, saveThemeMode,
  SYSTEM_THEME_QUERY, THEME_STORAGE_KEY, type ThemeMode,
} from '@/utils/appearance'

export const useThemeStore = defineStore('theme', () => {
  const mode = ref<ThemeMode>(readThemeMode())
  const systemDark = ref(false)
  const resolvedMode = computed(() => resolveTheme(mode.value, systemDark.value))
  const sidebarCollapsed = ref(false)
  let cleanup: (() => void) | undefined

  function initialize() {
    if (cleanup) return
    const media = window.matchMedia?.(SYSTEM_THEME_QUERY)
    systemDark.value = media?.matches ?? false
    const onSystemChange = (event: MediaQueryListEvent) => { systemDark.value = event.matches }
    if (media?.addEventListener) media.addEventListener('change', onSystemChange)
    else media?.addListener(onSystemChange)

    const onStorage = (event: StorageEvent) => {
      if (event.key !== THEME_STORAGE_KEY && event.key !== null) return
      // A sessionStorage event must not overwrite the browser appearance preference.
      try {
        if (event.storageArea && event.storageArea !== window.localStorage) return
      } catch { return }
      mode.value = parseThemeMode(event.newValue)
    }
    window.addEventListener('storage', onStorage)
    const stop = watch(resolvedMode, (value) => {
      document.documentElement.dataset.theme = value
      document.documentElement.style.colorScheme = value
    }, { immediate: true, flush: 'sync' })

    cleanup = () => {
      stop()
      if (media?.removeEventListener) media.removeEventListener('change', onSystemChange)
      else media?.removeListener(onSystemChange)
      window.removeEventListener('storage', onStorage)
      cleanup = undefined
    }
  }

  function dispose() { cleanup?.() }
  onScopeDispose(dispose)

  function setMode(value: ThemeMode) {
    mode.value = parseThemeMode(value)
    saveThemeMode(mode.value)
  }

  function toggleSidebar() {
    sidebarCollapsed.value = !sidebarCollapsed.value
  }

  function setSidebarCollapsed(collapsed: boolean) {
    sidebarCollapsed.value = collapsed
  }

  return {
    mode,
    resolvedMode,
    setMode,
    initialize,
    dispose,
    sidebarCollapsed,
    toggleSidebar,
    setSidebarCollapsed,
  }
})
