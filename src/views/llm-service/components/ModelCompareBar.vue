<script setup lang="ts">
import { computed } from 'vue'
import type { LlmServiceInfo } from '@/types/llmService'

const props = defineProps<{
  visible: boolean
  selected: LlmServiceInfo[]
}>()

const emit = defineEmits<{
  (e: 'cancel'): void
  (e: 'compare'): void
}>()

const names = computed(() => props.selected.length
  ? props.selected.map((record) => record.name).join('  VS  ')
  : '尚未选择模型')
</script>

<template>
  <Transition name="compare-bar">
    <div v-if="visible" class="compare-bar" role="status" aria-live="polite">
      <div class="count">{{ selected.length }}</div>
      <div class="compare-copy">
        <strong>已选 {{ selected.length }}/2</strong>
        <span :title="names">{{ names }}</span>
      </div>
      <a-button @click="emit('cancel')">取消</a-button>
      <a-button type="primary" :disabled="selected.length !== 2" @click="emit('compare')">开始对比</a-button>
    </div>
  </Transition>
</template>

<style lang="scss" scoped>
.compare-bar {
  position: fixed;
  z-index: 40;
  bottom: 24px;
  left: 50%;
  display: flex;
  width: min(520px, calc(100vw - 32px));
  min-height: 64px;
  padding: 10px 12px 10px 18px;
  align-items: center;
  gap: 12px;
  border: 1px solid #d6e8ff;
  border-radius: 14px;
  background: $color-bg;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  transform: translateX(-50%);
}

.count {
  display: grid;
  width: 34px;
  height: 34px;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 9px;
  color: $color-bg;
  background: $color-primary;
  font-weight: 700;
}

.compare-copy {
  min-width: 0;
  flex: 1;

  strong,
  span {
    display: block;
  }

  strong {
    font-size: 13px;
  }

  span {
    overflow: hidden;
    margin-top: 2px;
    color: $color-text-secondary;
    font-size: 11px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.compare-bar-enter-active,
.compare-bar-leave-active {
  transition: opacity 0.2s, transform 0.2s;
}

.compare-bar-enter-from,
.compare-bar-leave-to {
  opacity: 0;
  transform: translate(-50%, 24px);
}

@media (max-width: 580px) {
  .compare-bar {
    bottom: 12px;
    gap: 8px;
  }

  .compare-copy span {
    display: none;
  }
}
</style>
