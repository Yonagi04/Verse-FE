<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  currentPage: number
  totalPages: number
  total: number
  pageSize: number
  pageSizeOptions?: number[]
  pageJumpId?: string
  totalLabel?: string
}>()

const emit = defineEmits<{
  (e: 'update:currentPage', value: number): void
  (e: 'update:pageSize', value: number): void
}>()

const sizes = computed(() => props.pageSizeOptions ?? [5, 10, 20, 50])
const jumpId = computed(() => props.pageJumpId ?? 'paginationJump')

function handlePageSizeChange(val: number) {
  emit('update:pageSize', val)
}

function goPrev() {
  if (props.currentPage > 1) {
    emit('update:currentPage', props.currentPage - 1)
  }
}

function goNext() {
  if (props.currentPage < props.totalPages) {
    emit('update:currentPage', props.currentPage + 1)
  }
}

function handleJump(e: KeyboardEvent) {
  const input = e.target as HTMLInputElement
  const page = parseInt(input.value)
  if (isNaN(page) || page < 1 || page > props.totalPages) return
  emit('update:currentPage', page)
  input.value = ''
}
</script>

<template>
  <div class="pagination-bar">
    <div class="pagination-left">
      <span class="pagination-label">每页</span>
      <a-select
        :value="pageSize"
        size="small"
        style="width: 70px;"
        @change="handlePageSizeChange"
      >
        <a-select-option v-for="s in sizes" :key="s" :value="s">{{ s }}</a-select-option>
      </a-select>
      <span class="pagination-label">条</span>
    </div>
    <div class="pagination-center">
      <a-button
        size="small"
        :disabled="currentPage <= 1"
        @click="goPrev"
      >
        上一页
      </a-button>
      <span class="page-indicator">{{ currentPage }} / {{ totalPages }}</span>
      <a-button
        size="small"
        :disabled="currentPage >= totalPages"
        @click="goNext"
      >
        下一页
      </a-button>
      <span class="pagination-total">共 {{ total }} {{ totalLabel ?? '条' }}</span>
    </div>
    <div class="pagination-right">
      <span class="pagination-label">跳至</span>
      <a-input
        :id="jumpId"
        size="small"
        style="width: 52px; text-align: center;"
        :placeholder="String(currentPage)"
        @keydown.enter="handleJump"
      />
      <span class="pagination-label">页</span>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.pagination-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 16px;
  padding-top: 16px;
}

.pagination-left,
.pagination-center,
.pagination-right {
  display: flex;
  align-items: center;
  gap: 6px;
}

.pagination-label {
  font-size: 13px;
  color: $color-text-secondary;
}

.pagination-total {
  font-size: 13px;
  color: $color-text-secondary;
  margin-left: 4px;
}

.page-indicator {
  font-size: 13px;
  color: $color-text-primary;
  min-width: 60px;
  text-align: center;
}
</style>
