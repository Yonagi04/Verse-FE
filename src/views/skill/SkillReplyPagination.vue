<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ currentPage: number; totalPages: number; disabled?: boolean }>()
const emit = defineEmits<{ change: [page: number]; collapse: [] }>()
const pages = computed(() => {
  const numbers = [...new Set([1, props.currentPage - 1, props.currentPage, props.currentPage + 1, props.totalPages])]
    .filter(page => page >= 1 && page <= props.totalPages).sort((a, b) => a - b)
  const items: Array<number | string> = []
  for (const page of numbers) {
    const previous = items.at(-1)
    if (typeof previous === 'number' && page - previous > 1) items.push(`gap-${page}`)
    items.push(page)
  }
  return items
})
function change(page: number) {
  if (!props.disabled && page !== props.currentPage && page >= 1 && page <= props.totalPages) emit('change', page)
}
</script>
<template>
  <nav v-if="totalPages > 1" class="reply-pagination" aria-label="子评论分页">
    <span class="page-total">共{{ totalPages }}页</span>
    <template v-for="page in pages" :key="page">
      <button v-if="typeof page === 'number'" type="button" :disabled="disabled"
        :class="{ current: page === currentPage }" :aria-current="page === currentPage ? 'page' : undefined"
        :aria-label="`第${page}页`" @click="change(page)">{{ page }}</button>
      <span v-else class="page-gap" aria-hidden="true">…</span>
    </template>
    <button v-if="currentPage < totalPages" type="button" :disabled="disabled" @click="change(currentPage + 1)">下一页</button>
    <button type="button" :disabled="disabled" @click="emit('collapse')">收起</button>
  </nav>
</template>
<style lang="scss" scoped>
.reply-pagination { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; margin-top: 8px; font-size: 13px; line-height: 24px; }
.page-total { margin-right: 8px; color: $color-text-secondary; }
button { padding: 0; border: 0; background: transparent; color: $color-text-secondary; font: inherit; cursor: pointer; }
button.current, button:hover { color: $color-primary; }
button:disabled { color: $color-text-tertiary; cursor: default; }
button:focus-visible { outline: 2px solid $color-primary; outline-offset: 3px; border-radius: 2px; }
.page-gap { color: $color-text-tertiary; }
</style>
