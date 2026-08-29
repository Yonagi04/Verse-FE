<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { message } from 'ant-design-vue'
import { CopyOutlined } from '@ant-design/icons-vue'
import { getLlmServiceInfo, listLlmServices } from '@/api/llmService'
import { getProviderBySlug } from '@/constants/providers'
import { formatDateTime } from '@/utils/date'
import ProviderLogo from '@/components/ProviderLogo.vue'
import type { LlmServiceInfo, LlmServiceInfoRespDTO } from '@/types/llmService'

const props = defineProps<{
  visible: boolean
  tenantId: string
  record: LlmServiceInfo | null
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
}>()

const loading = ref(false)
const info = ref<LlmServiceInfoRespDTO | null>(null)
const services = ref<LlmServiceInfo[]>([])

const rateLimitText = computed(() => {
  const rpm = info.value?.rateLimitRpm
  const tpm = info.value?.rateLimitTpm
  if (rpm == null && tpm == null) return '不限'
  const parts: string[] = []
  if (rpm != null) parts.push(`RPM ${rpm}`)
  if (tpm != null) parts.push(`TPM ${tpm}`)
  return parts.join(' / ')
})

const fallbackName = computed(() => {
  const fid = info.value?.fallbackServiceId
  if (fid == null) return '无降级'
  const s = services.value.find((x) => x.serviceId === fid)
  return s ? s.name : fid
})

watch(
  () => props.visible,
  async (v) => {
    if (!v || !props.record) return
    loading.value = true
    info.value = null
    services.value = []
    try {
      const [detail, resp] = await Promise.all([
        getLlmServiceInfo(props.tenantId, props.record.serviceId),
        listLlmServices(props.tenantId, 1, 200),
      ])
      info.value = detail
      services.value = resp.serviceInfoList ?? []
    } catch {
      // handled by interceptor
    } finally {
      loading.value = false
    }
  },
)

function providerDisplayName(slug: string): string {
  return getProviderBySlug(slug)?.displayName ?? slug
}

function handleCopyName(name: string) {
  navigator.clipboard.writeText(name).then(() => {
    message.success('名称已复制')
  }).catch(() => {
    message.error('复制失败，请手动复制')
  })
}

function handleClose() {
  emit('update:visible', false)
}
</script>

<template>
  <a-drawer
    :open="visible"
    title="模型服务详情"
    :width="520"
    :mask-closable="false"
    @close="handleClose"
  >
    <a-spin :spinning="loading">
      <template v-if="info">
        <div class="detail-item">
          <span class="detail-label">名称</span>
          <span class="detail-value name-value">
            <span>{{ info.name }}</span>
            <a-button
              type="text"
              size="small"
              class="copy-btn"
              aria-label="复制名称"
              @click="handleCopyName(info.name)"
            >
              <template #icon><CopyOutlined /></template>
            </a-button>
          </span>
        </div>

        <div class="detail-item">
          <span class="detail-label">供应商</span>
          <span class="detail-value provider-cell">
            <ProviderLogo :slug="info.provider" :size="22" />
            <span>{{ providerDisplayName(info.provider) }}</span>
          </span>
        </div>

        <div class="detail-item">
          <span class="detail-label">API 地址</span>
          <span class="detail-value mono">{{ info.apiUrl }}</span>
        </div>

        <div class="detail-item">
          <span class="detail-label">API Key</span>
          <span class="detail-value mono">{{ info.apiKey }}</span>
        </div>

        <div class="detail-item">
          <span class="detail-label">模型名</span>
          <span class="detail-value">{{ info.modelName }}</span>
        </div>

        <div class="detail-item">
          <span class="detail-label">状态</span>
          <span class="detail-value">
            <a-tag v-if="info.status === 0" color="default">已停用</a-tag>
            <a-tag v-else color="green">启用中</a-tag>
          </span>
        </div>

        <div class="detail-item">
          <span class="detail-label">限流</span>
          <span class="detail-value">{{ rateLimitText }}</span>
        </div>

        <div class="detail-item">
          <span class="detail-label">备用模型</span>
          <span class="detail-value">{{ fallbackName }}</span>
        </div>

        <div class="detail-item">
          <span class="detail-label">创建者</span>
          <span class="detail-value">{{ info.createdByUsername }}</span>
        </div>

        <div class="detail-item">
          <span class="detail-label">创建时间</span>
          <span class="detail-value">{{ formatDateTime(info.createTime) }}</span>
        </div>
      </template>

      <a-empty v-else-if="!loading" description="暂无详情" />
    </a-spin>

    <template #footer>
      <a-button type="primary" @click="handleClose">关闭</a-button>
    </template>
  </a-drawer>
</template>

<style lang="scss" scoped>
.detail-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 20px;

  .detail-label {
    min-width: 72px;
    font-size: 13px;
    color: $color-text-secondary;
    padding-top: 2px;
    flex-shrink: 0;
  }

  .detail-value {
    font-size: 14px;
    color: $color-text-primary;
    word-break: break-all;
    line-height: 1.6;
  }
}

.provider-cell {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.name-value {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.mono {
  font-family: 'Courier New', monospace;
  font-size: 13px;
}
</style>
