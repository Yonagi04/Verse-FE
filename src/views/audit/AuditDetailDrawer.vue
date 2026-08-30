<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { message } from 'ant-design-vue'
import { CopyOutlined } from '@ant-design/icons-vue'
import { getAuditDetail } from '@/api/audit'
import { formatDateTime } from '@/utils/date'
import type { LlmAuditInfo, LlmAuditDetailRespDTO } from '@/types/audit'

const props = defineProps<{
  visible: boolean
  tenantId: string
  record: LlmAuditInfo | null
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
}>()

const loading = ref(false)
const detail = ref<LlmAuditDetailRespDTO | null>(null)
const promptExpanded = ref(false)
const responseExpanded = ref(false)

const tokenText = computed(() => {
  const d = detail.value
  if (!d) return ''
  return `${d.promptTokens} 入 / ${d.completionTokens} 出 / ${d.totalTokens} 总`
})

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// 将 JSON 原文解析并格式化为带语法高亮的 HTML
function highlightJson(raw: string): string {
  let text: string
  try {
    text = JSON.stringify(JSON.parse(raw), null, 2)
  } catch {
    text = raw
  }
  const escaped = escapeHtml(text)
  return escaped.replace(
    /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g,
    (match) => {
      let cls = 'json-number'
      if (/^"/.test(match)) {
        cls = /:$/.test(match) ? 'json-key' : 'json-string'
      } else if (/true|false/.test(match)) {
        cls = 'json-boolean'
      } else if (/null/.test(match)) {
        cls = 'json-null'
      }
      return `<span class="${cls}">${match}</span>`
    },
  )
}

const promptHtml = computed(() => (detail.value?.prompt != null ? highlightJson(detail.value.prompt) : ''))
const responseHtml = computed(() => (detail.value?.response != null ? highlightJson(detail.value.response) : ''))

// 复制时按格式化后的 JSON 复制
function prettyRaw(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2)
  } catch {
    return raw
  }
}

function handleCopy(raw: string | null) {
  if (raw == null) return
  navigator.clipboard.writeText(prettyRaw(raw)).then(() => {
    message.success('已复制到剪贴板')
  }).catch(() => {
    message.error('复制失败，请手动复制')
  })
}

watch(
  () => props.visible,
  async (v) => {
    if (!v || !props.record) return
    loading.value = true
    detail.value = null
    promptExpanded.value = false
    responseExpanded.value = false
    try {
      detail.value = await getAuditDetail(props.tenantId, props.record.id)
    } catch {
      // handled by interceptor
    } finally {
      loading.value = false
    }
  },
)

function handleClose() {
  emit('update:visible', false)
}
</script>

<template>
  <a-drawer
    :open="visible"
    title="调用日志详情"
    :width="880"
    :mask-closable="false"
    @close="handleClose"
  >
    <a-spin :spinning="loading">
      <template v-if="detail">
        <div class="audit-head">
          <div class="audit-meta">
            <span class="request-id">{{ detail.requestId }}</span>
            <a-tag v-if="detail.status === 'SUCCESS'" color="green">成功</a-tag>
            <a-tag v-else color="red">失败</a-tag>
          </div>
          <span class="audit-time">{{ formatDateTime(detail.createTime) }}</span>
        </div>

        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">用户</span>
            <span class="info-value">{{ detail.username }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">模型</span>
            <span class="info-value">{{ detail.model }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Token</span>
            <span class="info-value">{{ tokenText }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">耗时</span>
            <span class="info-value">{{ detail.latencyMs >= 1000 ? `${(detail.latencyMs / 1000).toFixed(2)} s` : `${detail.latencyMs} ms` }}</span>
          </div>
          <div v-if="detail.errorCode" class="info-item">
            <span class="info-label">错误码</span>
            <span class="info-value error">{{ detail.errorCode }}</span>
          </div>
        </div>

        <div class="json-section">
          <div class="section-head">
            <span class="section-title">输入 Prompt</span>
            <div class="section-actions">
              <a-button
                v-if="detail.prompt != null"
                type="text"
                size="small"
                @click="handleCopy(detail.prompt)"
              >
                <template #icon><CopyOutlined /></template>
                复制
              </a-button>
              <a-button
                v-if="detail.prompt != null"
                type="link"
                size="small"
                @click="promptExpanded = !promptExpanded"
              >
                {{ promptExpanded ? '收起' : '展开' }}
              </a-button>
            </div>
          </div>
          <div v-if="detail.prompt != null" class="code-block">
            <pre
              class="code-pre"
              :class="promptExpanded ? 'expanded' : 'collapsed'"
              v-html="promptHtml"
            ></pre>
            <div v-if="!promptExpanded" class="code-fade"></div>
          </div>
          <div v-else class="code-empty">内容不可用（objectKey 缺失）</div>
        </div>

        <div class="json-section">
          <div class="section-head">
            <span class="section-title">输出 Response</span>
            <div class="section-actions">
              <a-button
                v-if="detail.response != null"
                type="text"
                size="small"
                @click="handleCopy(detail.response)"
              >
                <template #icon><CopyOutlined /></template>
                复制
              </a-button>
              <a-button
                v-if="detail.response != null"
                type="link"
                size="small"
                @click="responseExpanded = !responseExpanded"
              >
                {{ responseExpanded ? '收起' : '展开' }}
              </a-button>
            </div>
          </div>
          <div v-if="detail.response != null" class="code-block">
            <pre
              class="code-pre"
              :class="responseExpanded ? 'expanded' : 'collapsed'"
              v-html="responseHtml"
            ></pre>
            <div v-if="!responseExpanded" class="code-fade"></div>
          </div>
          <div v-else-if="detail.status === 'FAIL'" class="code-empty">
            <div class="code-empty-error">调用失败，无输出内容</div>
            <div v-if="detail.errorCode" class="code-empty-code">错误码：{{ detail.errorCode }}</div>
          </div>
          <div v-else class="code-empty">内容不可用（objectKey 缺失）</div>
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
.audit-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;

  .audit-meta {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .request-id {
    font-family: 'Courier New', monospace;
    font-size: 13px;
    color: $color-text-secondary;
  }

  .audit-time {
    font-size: 13px;
    color: $color-text-secondary;
  }
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 24px;
}

.info-item {
  background: $color-bg-secondary;
  border: 1px solid $color-border;
  border-radius: $radius-button;
  padding: 12px 14px;

  .info-label {
    display: block;
    font-size: $font-size-caption;
    color: #98a2b3;
    margin-bottom: 6px;
  }

  .info-value {
    font-size: $font-size-body;
    font-weight: 500;
    word-break: break-all;

    &.error {
      color: $color-danger;
    }
  }
}

.json-section {
  margin-bottom: 20px;
}

.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;

  .section-title {
    font-size: $font-size-body;
    font-weight: 600;
  }

  .section-actions {
    display: flex;
    gap: 4px;
  }
}

.code-block {
  position: relative;
  background: #0d1117;
  border-radius: $radius-button;
  overflow: hidden;
}

.code-pre {
  margin: 0;
  padding: 16px;
  font-family: 'SF Mono', 'JetBrains Mono', Consolas, 'Courier New', monospace;
  font-size: 12.5px;
  line-height: 1.6;
  color: #e6edf3;
  white-space: pre;

  &.collapsed {
    max-height: 180px;
    overflow: hidden;
  }

  &.expanded {
    max-height: 440px;
    overflow-y: auto;
  }
}

.code-fade {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 56px;
  background: linear-gradient(transparent, #0d1117);
  pointer-events: none;
}

.code-empty {
  padding: 28px;
  text-align: center;
  color: $color-text-secondary;
  background: $color-bg-secondary;
  border: 1px dashed #d9d9d9;
  border-radius: $radius-button;
  font-size: 13px;

  .code-empty-error {
    color: $color-danger;
    font-family: 'Courier New', monospace;
  }

  .code-empty-code {
    margin-top: 6px;
    color: $color-text-secondary;
    font-size: 12px;
  }
}

:deep(.json-key) { color: #79c0ff; }
:deep(.json-string) { color: #a5d6ff; }
:deep(.json-number) { color: #ffab70; }
:deep(.json-boolean) { color: #ff7b72; }
:deep(.json-null) { color: #8b949e; font-style: italic; }
</style>
