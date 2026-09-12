<script setup lang="ts">
import { SwapOutlined, CloseOutlined } from '@ant-design/icons-vue'
import type { TagInfo } from '@/types/llmService'
import ModelTagFilter from './ModelTagFilter.vue'

withDefaults(defineProps<{
  keyword: string
  tags: TagInfo[]
  selectedCodes: string[]
  resultCount?: number
  tagsLoading?: boolean
  tagsError?: boolean
  compareMode?: boolean
  canCompare?: boolean
}>(), {
  resultCount: 0,
  tagsLoading: false,
  tagsError: false,
  compareMode: false,
  canCompare: false,
})

const emit = defineEmits<{
  (e: 'update:keyword', value: string): void
  (e: 'update:selectedCodes', value: string[]): void
  (e: 'search', value: string): void
  (e: 'retry-tags'): void
  (e: 'toggle-compare'): void
  (e: 'reset'): void
}>()

function handleKeywordChange(value: string) {
  emit('update:keyword', value)
  if (value === '') emit('search', '')
}
</script>

<template>
  <div class="catalog-toolbar">
    <div class="toolbar-main">
      <a-input-search
        :value="keyword"
        placeholder="搜索模型名称或供应商"
        allow-clear
        class="model-search"
        @update:value="handleKeywordChange"
        @search="emit('search', $event)"
      />
      <a-button v-if="keyword || selectedCodes.length" type="link" @click="emit('reset')">重置筛选</a-button>
      <span class="toolbar-spacer" />
      <span class="result-count">共 <strong>{{ resultCount }}</strong> 个模型</span>
      <a-button
        v-if="canCompare"
        :class="{ 'compare-active': compareMode }"
        @click="emit('toggle-compare')"
      >
        <CloseOutlined v-if="compareMode" />
        <SwapOutlined v-else />
        {{ compareMode ? '退出对比' : '模型对比' }}
      </a-button>
    </div>
    <div class="capability-row">
      <span class="capability-label">能力</span>
      <ModelTagFilter
        :selected-codes="selectedCodes"
        :tags="tags"
        :loading="tagsLoading"
        :error="tagsError"
        @update:selected-codes="emit('update:selectedCodes', $event)"
        @retry="emit('retry-tags')"
      />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.catalog-toolbar {
  border-bottom: 1px solid $color-border;
}

.toolbar-main {
  display: flex;
  padding: 16px;
  align-items: center;
  gap: 8px;
}

.model-search {
  width: 320px;
}

.toolbar-spacer {
  flex: 1;
}

.result-count {
  color: $color-text-secondary;
  font-size: 13px;
  white-space: nowrap;

  strong {
    color: $color-text-primary;
  }
}

.compare-active {
  border-color: #91caff;
  color: $color-primary;
  background: rgba($color-primary, 0.06);
}

.capability-row {
  display: flex;
  min-height: 54px;
  padding: 12px 16px;
  overflow-x: auto;
  align-items: flex-start;
  gap: 10px;
  border-top: 1px solid $color-border;
}

.capability-label {
  padding-top: 5px;
  color: #98a2b3;
  font-size: 12px;
  white-space: nowrap;
}

@media (max-width: 720px) {
  .toolbar-main {
    flex-wrap: wrap;
  }

  .model-search {
    width: 100%;
  }

  .result-count {
    margin-left: auto;
  }
}
</style>
