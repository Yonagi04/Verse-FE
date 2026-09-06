<script setup lang="ts">
import { computed } from 'vue'
import type { TagInfo } from '@/types/llmService'

const props = defineProps<{ tags: TagInfo[]; tagCodes: string[]; contextWindow: number | null; maxOutputTokens: number | null }>()
const emit = defineEmits<{
  (e: 'update:tagCodes', value: string[]): void
  (e: 'update:contextWindow', value: number | null): void
  (e: 'update:maxOutputTokens', value: number | null): void
}>()
const tokenError = computed(() => props.contextWindow != null && props.maxOutputTokens != null && props.maxOutputTokens > props.contextWindow
  ? '最大输出 Token 不能超过上下文长度' : '')

function getPopupContainer(triggerNode: HTMLElement): HTMLElement {
  return triggerNode.parentElement ?? triggerNode
}
</script>

<template>
  <a-form-item label="能力标签">
    <a-select
      :value="tagCodes"
      mode="multiple"
      :options="tags.map((tag) => ({ value: tag.code, label: tag.displayName }))"
      :get-popup-container="getPopupContainer"
      placeholder="选择固定能力标签（可选）"
      @update:value="emit('update:tagCodes', $event)"
    />
  </a-form-item>
  <a-form-item label="上下文长度">
    <a-input-number :value="contextWindow" :min="1" :precision="0" style="width: 100%" placeholder="未配置" @update:value="emit('update:contextWindow', $event)" />
  </a-form-item>
  <a-form-item label="最大输出 Token" :validate-status="tokenError ? 'error' : undefined" :help="tokenError || undefined">
    <a-input-number :value="maxOutputTokens" :min="1" :precision="0" style="width: 100%" placeholder="未配置" @update:value="emit('update:maxOutputTokens', $event)" />
  </a-form-item>
</template>
