<script setup lang="ts">
import { computed } from 'vue'
import type { TagInfo } from '@/types/llmService'

const props = withDefaults(defineProps<{
  codes?: string[] | null
  dictionary?: TagInfo[] | null
}>(), { codes: () => [], dictionary: () => [] })

interface TagItem { code: string; name: string }

const items = computed<TagItem[]>(() =>
  (props.codes ?? []).map((code) => ({
    code,
    name: props.dictionary?.find((tag) => tag.code === code)?.displayName ?? code,
  })),
)
</script>

<template>
  <span v-if="!items.length" class="empty-tags">未配置标签</span>
  <span v-else class="tag-list">
    <a-tag v-for="tag in items.slice(0, 2)" :key="tag.code">{{ tag.name }}</a-tag>
    <a-popover v-if="items.length > 2" trigger="click" placement="top">
      <template #content>
        <div class="all-tags" aria-label="全部模型标签">
          <a-tag v-for="tag in items.slice(2)" :key="tag.code">{{ tag.name }}</a-tag>
        </div>
      </template>
      <a-button type="link" size="small" class="more-button" :aria-label="`查看其余 ${items.length - 2} 个标签`">+{{ items.length - 2 }}</a-button>
    </a-popover>
  </span>
</template>

<style lang="scss" scoped>
.tag-list, .all-tags { display: inline-flex; flex-wrap: wrap; gap: 4px; align-items: center; }
.empty-tags { color: $color-text-secondary; font-size: 13px; }
.more-button { padding: 0 4px; height: auto; }
</style>
