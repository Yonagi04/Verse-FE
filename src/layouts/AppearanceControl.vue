<script setup lang="ts">
import { computed } from 'vue'
import Icon, { DesktopOutlined } from '@ant-design/icons-vue'
import { useThemeStore } from '@/stores/theme'
import type { ThemeMode } from '@/utils/appearance'

const themeStore = useThemeStore()
const options: { mode: ThemeMode; label: string }[] = [
  { mode: 'light', label: '浅色' },
  { mode: 'dark', label: '深色' },
  { mode: 'auto', label: '自动（跟随系统）' },
]
const description = computed(() => {
  const name = themeStore.resolvedMode === 'dark' ? '深色' : '浅色'
  return themeStore.mode === 'auto' ? `跟随系统 · 当前${name}` : `始终使用${name}`
})
</script>

<template>
  <div class="appearance-control">
    <span class="appearance-label">外观</span>
    <div class="appearance-options" role="group" aria-label="外观">
      <a-tooltip v-for="option in options" :key="option.mode" :title="option.label" :trigger="['hover', 'focus']">
        <button
          type="button"
          class="appearance-option"
          :aria-label="option.label"
          :aria-pressed="themeStore.mode === option.mode"
          @click="themeStore.setMode(option.mode)"
        >
          <Icon v-if="option.mode === 'light'" view-box="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1.8" />
            <path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
          </Icon>
          <Icon v-else-if="option.mode === 'dark'" view-box="0 0 24 24" aria-hidden="true">
            <path d="M20.6 14A9 9 0 0 1 10 3.4 9 9 0 1 0 20.6 14Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" />
          </Icon>
          <DesktopOutlined v-else aria-hidden="true" />
        </button>
      </a-tooltip>
    </div>
    <p class="appearance-description" aria-live="polite">{{ description }}</p>
  </div>
</template>

<style lang="scss" scoped>
.appearance-control { padding: 6px 9px 9px; }
.appearance-label { display: block; margin-bottom: 8px; color: $color-text-secondary; font-size: $font-size-caption; }
.appearance-options { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 3px; padding: 3px; border-radius: $radius-input; background: $color-bg-sidebar; }
.appearance-option {
  min-width: 0; min-height: 36px; display: flex; align-items: center; justify-content: center;
  border: 0; border-radius: 6px; background: transparent; color: $color-text-secondary; font-size: 16px; cursor: pointer;
  &:hover { background: $color-bg-hover; }
  &[aria-pressed='true'] { background: var(--verse-selected); color: $color-primary; box-shadow: inset 0 0 0 1px $color-primary; }
  &:focus-visible { outline: 2px solid $color-focus; outline-offset: 2px; }
}
.appearance-description { margin: 7px 0 0; color: $color-text-secondary; font-size: $font-size-caption; line-height: 1.5; }
@media (pointer: coarse) { .appearance-option { min-height: 44px; } }
</style>
