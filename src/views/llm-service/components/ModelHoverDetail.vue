<script setup lang="ts">
import { ref, watch, onBeforeUnmount } from 'vue'
import type { LlmServiceInfo, LlmServiceInfoRespDTO } from '@/types/llmService'

const props = withDefaults(defineProps<{
  record: LlmServiceInfo
  detail?: LlmServiceInfoRespDTO | null
  fallbackName?: string | null
  loading?: boolean
  error?: boolean
  disabled?: boolean
}>(), {
  detail: null,
  fallbackName: null,
  loading: false,
  error: false,
  disabled: false,
})

const emit = defineEmits<{ (e: 'request'): void }>()
const open = ref(false)
let openTimer: ReturnType<typeof setTimeout> | undefined
let closeTimer: ReturnType<typeof setTimeout> | undefined

function clearTimers() {
  if (openTimer) clearTimeout(openTimer)
  if (closeTimer) clearTimeout(closeTimer)
  openTimer = undefined
  closeTimer = undefined
}

function show(delay = 300) {
  if (props.disabled) return
  if (closeTimer) clearTimeout(closeTimer)
  if (open.value || openTimer) return
  openTimer = setTimeout(() => {
    openTimer = undefined
    open.value = true
    emit('request')
  }, delay)
}

function hide() {
  if (openTimer) clearTimeout(openTimer)
  openTimer = undefined
  if (closeTimer) clearTimeout(closeTimer)
  closeTimer = setTimeout(() => {
    closeTimer = undefined
    open.value = false
  }, 100)
}

function handleFocusOut(event: FocusEvent) {
  const current = event.currentTarget as HTMLElement
  if (event.relatedTarget instanceof Node && current.contains(event.relatedTarget)) return
  hide()
}

function limitText(value: number | null | undefined, suffix: string) {
  return value == null ? '不限' : `${value.toLocaleString()} ${suffix}`
}

function tokenText(value: number | null | undefined) {
  return value == null ? '未配置' : value.toLocaleString()
}

watch(() => props.disabled, (disabled) => {
  if (disabled) {
    clearTimers()
    open.value = false
  }
})

onBeforeUnmount(clearTimers)
</script>

<template>
  <a-popover
    :open="open && !disabled"
    placement="rightTop"
    :destroy-tooltip-on-hide="false"
    overlay-class-name="model-hover-popover"
  >
    <template #content>
      <div class="hover-detail" aria-live="polite">
        <div class="hover-head">
          <strong>模型运行配置</strong>
          <span class="live-badge" :class="{ stopped: record.status === 0 }">
            {{ record.status === 0 ? '当前停用' : '运行正常' }}
          </span>
        </div>

        <p class="detail-description">
          {{ detail?.description || record.description || '暂无模型元数据' }}
        </p>

        <a-skeleton v-if="loading" active :paragraph="{ rows: 3 }" size="small" />
        <div v-else-if="error" class="detail-error">详情加载失败</div>
        <dl v-else-if="detail" class="detail-grid">
          <div>
            <dt>供应商模型 ID</dt>
            <dd :title="detail.modelName">{{ detail.modelName || '未配置' }}</dd>
          </div>
          <div>
            <dt>上下文 / 最大输出</dt>
            <dd>{{ tokenText(detail.contextWindow) }} / {{ tokenText(detail.maxOutputTokens) }}</dd>
          </div>
          <div>
            <dt>请求限流</dt>
            <dd>{{ limitText(detail.rateLimitRpm, 'RPM') }}</dd>
          </div>
          <div>
            <dt>Token 限流</dt>
            <dd>{{ limitText(detail.rateLimitTpm, 'TPM') }}</dd>
          </div>
          <div>
            <dt>备用模型</dt>
            <dd :title="fallbackName || detail.fallbackServiceId || ''">
              {{ fallbackName || detail.fallbackServiceId || '无降级' }}
            </dd>
          </div>
          <div>
            <dt>创建者</dt>
            <dd :title="detail.createdByUsername">{{ detail.createdByUsername }}</dd>
          </div>
        </dl>

        <div class="hover-foot">点击卡片查看完整详情 →</div>
      </div>
    </template>

    <div
      class="hover-trigger"
      @mouseenter="show()"
      @mouseleave="hide"
      @focusin="show(0)"
      @focusout="handleFocusOut"
      @click="hide"
    >
      <slot />
    </div>
  </a-popover>
</template>

<style lang="scss" scoped>
.hover-trigger {
  height: 100%;
}

.hover-detail {
  width: 310px;
}

.hover-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid $color-border;

  strong {
    font-size: 13px;
  }
}

.live-badge {
  flex-shrink: 0;
  padding: 2px 8px;
  border-radius: 999px;
  color: $color-success;
  background: rgba($color-success, 0.08);
  font-size: 11px;

  &.stopped {
    color: $color-text-secondary;
    background: $color-bg-secondary;
  }
}

.detail-description {
  min-height: 38px;
  margin: 12px 0;
  color: $color-text-secondary;
  font-size: $font-size-caption;
  line-height: 1.6;
  white-space: pre-wrap;
}

.detail-error {
  display: grid;
  min-height: 106px;
  place-items: center;
  color: $color-text-secondary;
  font-size: 13px;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px 16px;

  dt {
    color: $color-text-secondary;
    font-size: 11px;
  }

  dd {
    overflow: hidden;
    margin: 3px 0 0;
    color: $color-text-primary;
    font-size: 12px;
    font-weight: 500;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.hover-foot {
  margin-top: 14px;
  padding-top: 11px;
  border-top: 1px solid $color-border;
  color: $color-primary;
  font-size: 11px;
  text-align: right;
}
</style>
