<script setup lang="ts">
defineProps<{
  /** 页眉提示文字 */
  eyebrow?: string
  /** 页面标题 */
  title: string
  /** 页面说明 */
  description: string
}>()
</script>

<template>
  <header class="auth-page-header">
    <div v-if="eyebrow" class="eyebrow">{{ eyebrow }}</div>
    <h2>{{ title }}</h2>
    <p>{{ description }}</p>
  </header>
</template>

<style lang="scss" scoped>
.auth-page-header { margin-bottom: 28px; }
.eyebrow { margin-bottom: 12px; font-size: 12px; letter-spacing: 1.7px; color: $color-text-secondary; font-weight: 700; }
h2 { margin: 0 0 8px; font-size: 28px; font-weight: 700; letter-spacing: -.8px; line-height: 1.3; }
p { margin: 0; color: $color-text-secondary; font-size: 13px; line-height: 1.7; }
</style>
