<script setup lang="ts">
import type { TagInfo } from '@/types/llmService'

const props = withDefaults(defineProps<{
  tags: TagInfo[]
  selectedCodes: string[]
  loading?: boolean
  error?: boolean
}>(), { loading: false, error: false })
const emit = defineEmits<{ (e: 'update:selectedCodes', value: string[]): void; (e: 'retry'): void }>()

function toggle(code?: string) {
  if (!code) return emit('update:selectedCodes', [])
  emit('update:selectedCodes', props.selectedCodes.includes(code)
    ? props.selectedCodes.filter((item) => item !== code)
    : [...props.selectedCodes, code])
}
</script>

<template>
  <div class="tag-filter" aria-label="按模型能力标签筛选">
    <a-spin v-if="loading" size="small" />
    <template v-else-if="error">
      <span class="error-text">标签字典加载失败</span>
      <a-button type="link" size="small" @click="emit('retry')">重试</a-button>
    </template>
    <template v-else>
      <a-checkable-tag
        :checked="selectedCodes.length === 0"
        class="filter-tag"
        @change="toggle()"
      >全部</a-checkable-tag>
      <a-checkable-tag
        v-for="tag in tags"
        :key="tag.code"
        :checked="selectedCodes.includes(tag.code)"
        class="filter-tag"
        @change="toggle(tag.code)"
      >{{ tag.displayName }}</a-checkable-tag>
    </template>
  </div>
</template>

<style lang="scss" scoped>
.tag-filter { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; min-height: 28px; }
.filter-tag {
  margin-inline-end: 0;
  padding: 4px 12px;
  border: 1px solid $color-border;
  border-radius: $radius-input;
  background: $color-bg;
  color: $color-text-primary;
  font-size: $font-size-body;
  line-height: 20px;
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s, background-color 0.15s;
}
.filter-tag:hover { border-color: $color-primary; color: $color-primary; }
.filter-tag.ant-tag-checkable-checked { color: $color-primary; background: rgba($color-primary, .08); border-color: $color-primary; }
.error-text { color: $color-text-secondary; font-size: 13px; }
</style>
