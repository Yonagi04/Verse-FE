<script setup lang="ts">
import { computed, ref } from 'vue'
import type { MenuProps } from 'ant-design-vue'
import {
  MoreOutlined,
  GlobalOutlined,
  DollarOutlined,
  EditOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  DeleteOutlined,
} from '@ant-design/icons-vue'
import ProviderLogo from '@/components/ProviderLogo.vue'
import { getProviderBySlug } from '@/constants/providers'
import type { LlmServiceInfo, LlmServiceInfoRespDTO, TagInfo } from '@/types/llmService'
import ModelHoverDetail from './ModelHoverDetail.vue'

const props = withDefaults(defineProps<{
  record: LlmServiceInfo
  dictionary?: TagInfo[]
  compareMode?: boolean
  selected?: boolean
  selectionDisabled?: boolean
  canUpdate?: boolean
  canDelete?: boolean
  detail?: LlmServiceInfoRespDTO | null
  detailLoading?: boolean
  detailError?: boolean
  fallbackName?: string | null
}>(), {
  dictionary: () => [],
  compareMode: false,
  selected: false,
  selectionDisabled: false,
  canUpdate: false,
  canDelete: false,
  detail: null,
  detailLoading: false,
  detailError: false,
  fallbackName: null,
})

const emit = defineEmits<{
  (e: 'detail', record: LlmServiceInfo): void
  (e: 'edit', record: LlmServiceInfo): void
  (e: 'toggle-status', record: LlmServiceInfo): void
  (e: 'remove', record: LlmServiceInfo): void
  (e: 'toggle-compare', record: LlmServiceInfo): void
  (e: 'request-detail', record: LlmServiceInfo): void
}>()

const providerName = computed(() => getProviderBySlug(props.record.provider)?.displayName ?? props.record.provider)
const visibleTags = computed(() => (props.record.tagCodes ?? []).slice(0, 3).map((code) => ({
  code,
  name: props.dictionary.find((tag) => tag.code === code)?.displayName ?? code,
})))
const allTagNames = computed(() => (props.record.tagCodes ?? []).map((code) =>
  props.dictionary.find((tag) => tag.code === code)?.displayName ?? code,
).join('、'))
const modelIdentifier = computed(() => props.record.modelName || '未配置')
const hasActions = computed(() => props.canUpdate || props.canDelete)
const menuOpen = ref(false)

function tokenText(value: number | null | undefined) {
  if (value == null) return '未配置'
  if (value >= 1_000_000) return `${Number((value / 1_000_000).toFixed(1))}M`
  if (value >= 1_000) return `${Number((value / 1_000).toFixed(1))}K`
  return value.toLocaleString()
}

function billingText() {
  if (!props.record.billingStatus || props.record.billingStatus === 'UNPRICED') return '未启用计费'
  return props.record.billingStatus === 'TOKEN' ? 'Token 计费' : '按请求计费'
}

function handleCardClick() {
  if (props.compareMode) {
    if (!props.selectionDisabled || props.selected) emit('toggle-compare', props.record)
    return
  }
  emit('detail', props.record)
}

const handleMenuClick: MenuProps['onClick'] = ({ key }) => {
  if (key === 'edit') emit('edit', props.record)
  if (key === 'toggle') emit('toggle-status', props.record)
  if (key === 'remove') emit('remove', props.record)
}
</script>

<template>
  <ModelHoverDetail
    :record="record"
    :detail="detail"
    :fallback-name="fallbackName"
    :loading="detailLoading"
    :error="detailError"
    :disabled="compareMode || menuOpen"
    @request="emit('request-detail', record)"
  >
    <article
      class="model-card"
      :class="{ selected, disabled: record.status === 0, 'selection-disabled': selectionDisabled }"
      tabindex="0"
      :aria-label="`${record.name}，${record.status === 0 ? '已停用' : '启用中'}`"
      @click="handleCardClick"
      @keydown.enter.self.prevent="handleCardClick"
      @keydown.space.self.prevent="handleCardClick"
    >
      <div class="card-top">
        <span class="logo-shell">
          <ProviderLogo :slug="record.provider" :size="23" />
        </span>
        <div class="title-wrap">
          <div class="title-line">
            <strong class="card-title" :title="record.name">{{ record.name }}</strong>
            <a-tooltip :title="record.status === 0 ? '已停用' : '启用中'">
              <span class="status-dot" :class="{ stopped: record.status === 0 }" />
            </a-tooltip>
          </div>
          <span class="provider-name">{{ providerName }}</span>
        </div>

        <a-checkbox
          v-if="compareMode"
          class="compare-check"
          :checked="selected"
          :disabled="selectionDisabled && !selected"
          :aria-label="`选择 ${record.name} 对比`"
          @click.stop
          @change="emit('toggle-compare', record)"
        />

        <a-dropdown
          v-else-if="hasActions"
          :trigger="['click']"
          placement="bottomRight"
          @open-change="menuOpen = $event"
        >
          <a-button
            type="text"
            class="more-button"
            :aria-label="`${record.name} 更多操作`"
            @click.stop
          >
            <template #icon><MoreOutlined /></template>
          </a-button>
          <template #overlay>
            <a-menu @click="handleMenuClick">
              <a-menu-item v-if="canUpdate" key="edit"><EditOutlined /> 编辑模型</a-menu-item>
              <a-menu-item v-if="canUpdate" key="toggle">
                <PlayCircleOutlined v-if="record.status === 0" />
                <PauseCircleOutlined v-else />
                {{ record.status === 0 ? '启用模型' : '停用模型' }}
              </a-menu-item>
              <a-menu-divider v-if="canUpdate && canDelete" />
              <a-menu-item v-if="canDelete" key="remove" danger><DeleteOutlined /> 删除模型</a-menu-item>
            </a-menu>
          </template>
        </a-dropdown>
      </div>

      <div class="card-main">
        <div class="model-id" :title="modelIdentifier">{{ modelIdentifier }}</div>
        <div class="tag-row" :title="allTagNames || '未配置能力标签'">
          <a-tag v-for="tag in visibleTags" :key="tag.code">{{ tag.name }}</a-tag>
          <span v-if="!visibleTags.length" class="empty-value">未配置能力标签</span>
        </div>
      </div>

      <div class="metrics">
        <div class="metric">
          <div class="metric-label"><GlobalOutlined /> 上下文</div>
          <div class="metric-value" :title="`${record.contextWindow ?? '未配置'} · 输出 ${record.maxOutputTokens ?? '未配置'}`">
            {{ tokenText(record.contextWindow) }} · 输出 {{ tokenText(record.maxOutputTokens) }}
          </div>
        </div>
        <div class="metric">
          <div class="metric-label"><DollarOutlined /> 计费</div>
          <div class="metric-value" :class="{ muted: billingText() === '未启用计费' }">{{ billingText() }}</div>
        </div>
      </div>
    </article>
  </ModelHoverDetail>
</template>

<style lang="scss" scoped>
.model-card {
  position: relative;
  display: flex;
  min-width: 0;
  min-height: 238px;
  height: 100%;
  padding: 16px;
  overflow: hidden;
  border: 1px solid #eaecf0;
  border-radius: $radius-card;
  outline: none;
  background: $color-bg;
  cursor: pointer;
  transition: border-color 0.18s, box-shadow 0.18s, transform 0.18s;
  flex-direction: column;

  &:hover,
  &:focus-visible,
  &:focus-within {
    border-color: #b2d6ff;
    box-shadow: $shadow-light;
    transform: translateY(-2px);
  }

  &.selected {
    border-color: $color-primary;
    box-shadow: 0 0 0 2px rgba($color-primary, 0.1);
  }

  &.disabled {
    background: #fcfcfd;
  }

  &.disabled .card-main,
  &.disabled .metrics {
    opacity: 0.72;
  }

  &.selection-disabled:not(.selected) {
    cursor: not-allowed;
  }
}

.card-top {
  display: flex;
  align-items: flex-start;
  gap: 11px;
}

.logo-shell {
  display: grid;
  width: 38px;
  height: 38px;
  flex: 0 0 auto;
  place-items: center;
  border: 1px solid $color-border;
  border-radius: 11px;
  background: $color-bg;
}

.title-wrap {
  min-width: 0;
  flex: 1;
}

.title-line {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 8px;
}

.card-title {
  overflow: hidden;
  color: $color-text-primary;
  font-size: 15px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.status-dot {
  display: block;
  width: 7px;
  height: 7px;
  flex: 0 0 auto;
  border-radius: 50%;
  background: $color-success;
  box-shadow: 0 0 0 3px rgba($color-success, 0.1);

  &.stopped {
    background: #98a2b3;
    box-shadow: 0 0 0 3px #f2f4f7;
  }
}

.provider-name {
  display: block;
  overflow: hidden;
  margin-top: 2px;
  color: $color-text-secondary;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.more-button {
  width: 30px;
  height: 30px;
  margin: -5px -6px 0 0;
}

.compare-check {
  margin-top: 3px;
}

.card-main {
  flex: 1;
}

.model-id {
  overflow: hidden;
  margin-top: 15px;
  color: #344054;
  font-family: $font-family;
  font-size: 12px;
  line-height: 1.4;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tag-row {
  display: flex;
  min-height: 48px;
  margin-top: 11px;
  align-content: flex-start;
  flex-wrap: wrap;
  gap: 6px;

  :deep(.ant-tag) {
    max-width: 100%;
    height: 23px;
    overflow: hidden;
    margin: 0;
    border: 0;
    border-radius: 6px;
    color: #475467;
    background: #f2f4f7;
    font-size: 11px;
    line-height: 23px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.empty-value {
  color: #98a2b3;
  font-size: 12px;
}

.metrics {
  display: grid;
  margin-top: 13px;
  padding-top: 12px;
  border-top: 1px solid $color-border;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.metric {
  min-width: 0;

  & + & {
    padding-left: 12px;
    border-left: 1px solid $color-border;
  }
}

.metric-label {
  display: flex;
  align-items: center;
  gap: 5px;
  color: #98a2b3;
  font-size: 11px;
}

.metric-value {
  overflow: hidden;
  margin-top: 3px;
  color: #344054;
  font-size: 12px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;

  &.muted {
    color: $color-text-secondary;
    font-weight: 400;
  }
}
</style>
