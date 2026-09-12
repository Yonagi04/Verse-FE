<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { SwapOutlined } from '@ant-design/icons-vue'
import { getLlmServiceInfo } from '@/api/llmService'
import { getProviderBySlug } from '@/constants/providers'
import { formatYuan } from '@/utils/money'
import ProviderLogo from '@/components/ProviderLogo.vue'
import ModelTagList from './ModelTagList.vue'
import type { LlmServiceInfo, LlmServiceInfoRespDTO, TagInfo } from '@/types/llmService'

const props = defineProps<{
  open: boolean
  tenantId: string
  baseline: LlmServiceInfo | null
  comparison: LlmServiceInfo | null
  dictionary?: TagInfo[] | null
}>()
const emit = defineEmits<{ (e: 'update:open', value: boolean): void }>()

const loading = ref(false)
const left = ref<LlmServiceInfoRespDTO | null>(null)
const right = ref<LlmServiceInfoRespDTO | null>(null)
const error = ref(false)

const dictionaryMap = computed(() => new Map((props.dictionary ?? []).map((tag) => [tag.code, tag.displayName])))
function tagName(code: string) { return dictionaryMap.value.get(code) ?? code }

const commonCodes = computed(() => {
  const rightCodes = new Set(right.value?.tagCodes ?? [])
  return new Set((left.value?.tagCodes ?? []).filter((code) => rightCodes.has(code)))
})
const leftCommon = computed(() => (left.value?.tagCodes ?? []).filter((code) => commonCodes.value.has(code)).map(tagName).join('、') || '无')
const rightCommon = computed(() => (right.value?.tagCodes ?? []).filter((code) => commonCodes.value.has(code)).map(tagName).join('、') || '无')

async function load() {
  if (!props.baseline || !props.comparison) return
  loading.value = true
  error.value = false
  try {
    ;[left.value, right.value] = await Promise.all([
      getLlmServiceInfo(props.tenantId, props.baseline.serviceId),
      getLlmServiceInfo(props.tenantId, props.comparison.serviceId),
    ])
  } catch {
    error.value = true
  } finally {
    loading.value = false
  }
}
watch(() => props.open, (open) => { if (open) load() })

function swap() { [left.value, right.value] = [right.value, left.value] }

function providerDisplayName(slug: string): string {
  return getProviderBySlug(slug)?.displayName ?? slug
}

function rateLimit(info: LlmServiceInfoRespDTO | null): string {
  if (!info) return ''
  const parts: string[] = []
  if (info.rateLimitRpm != null) parts.push(`RPM ${info.rateLimitRpm}`)
  if (info.rateLimitTpm != null) parts.push(`TPM ${info.rateLimitTpm}`)
  return parts.join(' / ') || '不限'
}

function price(info: LlmServiceInfoRespDTO | null) {
  if (!info?.pricing?.enabled) return '未启用计费'
  if (info.pricing.billingMode === 'TOKEN') {
    const tp = info.pricing.baseTokenPrices
    return `TOKEN：输入 ${formatYuan(tp.cacheMissInputPriceFen)}，输出 ${formatYuan(tp.outputPriceFen)}`
  }
  return `REQUEST：${formatYuan(info.pricing.baseRequestPriceFen)}`
}
</script>

<template>
  <a-drawer :open="open" title="模型对比" :width="720" @close="emit('update:open', false)">
    <a-spin :spinning="loading">
      <a-alert v-if="error" type="error" show-icon message="模型详情加载失败" />
      <template v-else-if="left && right">
        <div class="compare-header">
          <strong>基准：{{ left.name }}</strong>
          <a-tooltip title="交换模型">
            <a-button type="text" shape="circle" aria-label="交换模型" @click="swap">
              <template #icon><SwapOutlined /></template>
            </a-button>
          </a-tooltip>
          <strong>对比：{{ right.name }}</strong>
        </div>
        <a-descriptions bordered :column="2">
          <a-descriptions-item label="供应商">
            <span class="provider-cell">
              <ProviderLogo :slug="left.provider" :size="22" />
              <span>{{ providerDisplayName(left.provider) }}</span>
            </span>
          </a-descriptions-item>
          <a-descriptions-item label="供应商">
            <span class="provider-cell">
              <ProviderLogo :slug="right.provider" :size="22" />
              <span>{{ providerDisplayName(right.provider) }}</span>
            </span>
          </a-descriptions-item>
          <a-descriptions-item label="标签">
            <ModelTagList :codes="left.tagCodes" :dictionary="props.dictionary" />
            <small>共同：{{ leftCommon }}</small>
          </a-descriptions-item>
          <a-descriptions-item label="模型介绍">{{ left.description || '暂无模型元数据' }}</a-descriptions-item>
          <a-descriptions-item label="模型介绍">{{ right.description || '暂无模型元数据' }}</a-descriptions-item>
          <a-descriptions-item label="标签">
            <ModelTagList :codes="right.tagCodes" :dictionary="props.dictionary" />
            <small>共同：{{ rightCommon }}</small>
          </a-descriptions-item>
          <a-descriptions-item label="上下文长度">{{ left.contextWindow ?? '未配置' }}</a-descriptions-item>
          <a-descriptions-item label="上下文长度">{{ right.contextWindow ?? '未配置' }}</a-descriptions-item>
          <a-descriptions-item label="最大输出 Token">{{ left.maxOutputTokens ?? '未配置' }}</a-descriptions-item>
          <a-descriptions-item label="最大输出 Token">{{ right.maxOutputTokens ?? '未配置' }}</a-descriptions-item>
          <a-descriptions-item label="限流">{{ rateLimit(left) }}</a-descriptions-item>
          <a-descriptions-item label="限流">{{ rateLimit(right) }}</a-descriptions-item>
          <a-descriptions-item label="价格">{{ price(left) }}</a-descriptions-item>
          <a-descriptions-item label="价格">{{ price(right) }}</a-descriptions-item>
        </a-descriptions>
      </template>
    </a-spin>
  </a-drawer>
</template>

<style lang="scss" scoped>
.compare-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.compare-header strong { width: 36%; }
.compare-header strong:last-child { text-align: right; }
.provider-cell { display: inline-flex; align-items: center; gap: 8px; }
small { display: block; color: $color-text-secondary; margin-top: 6px; }
</style>
