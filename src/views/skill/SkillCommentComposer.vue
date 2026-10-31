<script setup lang="ts">
import { computed } from 'vue'
import { commentLength } from '@/utils/skillComment'

const props = defineProps<{ modelValue: string; loading?: boolean; label?: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string]; send: [] }>()
const length = computed(() => commentLength(props.modelValue))
</script>
<template>
  <div class="comment-composer">
    <a-textarea :value="modelValue" :rows="4" :disabled="loading" :aria-label="label || '评论内容'"
      :placeholder="label || '分享你的使用体验，或提出问题…'"
      @update:value="emit('update:modelValue', $event)" />
    <div class="composer-actions">
      <span :class="{ excessive: length > 1000 }">{{ length }} / 1000</span>
      <a-button type="primary" :loading="loading" :disabled="!modelValue.trim() || length > 1000"
        @click="emit('send')">发送</a-button>
    </div>
  </div>
</template>
<style lang="scss" scoped>
.comment-composer textarea { resize: none; overflow-y: auto; height: 108px; }
.composer-actions { display: flex; justify-content: space-between; align-items: center; margin-top: 10px; }
.composer-actions span { color: $color-text-tertiary; font-size: 12px; }
.composer-actions .excessive { color: $color-danger; }
</style>
