<script setup lang="ts">
import { ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import { CopyOutlined } from '@ant-design/icons-vue'
import QRCode from 'qrcode'
import zhCN from 'ant-design-vue/es/date-picker/locale/zh_CN'
import { generateInvite } from '@/api/tenant'
import { formatDateTime } from '@/utils/date'
import type { TenantInviteRespDTO } from '@/types/tenant'

const props = defineProps<{
  visible: boolean
  tenantId: string
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'done'): void
}>()

const setExpiry = ref(false)
const expireAt = ref<string | null>(null)
const loading = ref(false)
const result = ref<TenantInviteRespDTO | null>(null)
const expireError = ref(false)
const qrDataUrl = ref('')
const qrLoading = ref(false)

// 监听结果变化，生成 QR 码
watch(
  () => result.value?.inviteUrl,
  async (url) => {
    if (url) {
      qrLoading.value = true
      try {
        qrDataUrl.value = await QRCode.toDataURL(url, {
          width: 240,
          margin: 1,
          color: { dark: '#000000', light: '#ffffff' },
        })
      } catch {
        qrDataUrl.value = ''
      } finally {
        qrLoading.value = false
      }
    } else {
      qrDataUrl.value = ''
    }
  },
)

function close() {
  emit('update:visible', false)
  setTimeout(() => {
    setExpiry.value = false
    expireAt.value = null
    result.value = null
    expireError.value = false
    qrDataUrl.value = ''
  }, 200)
}

async function handleGenerate() {
  if (setExpiry.value && !expireAt.value) {
    expireError.value = true
    return
  }
  expireError.value = false

  loading.value = true
  try {
    const payload = setExpiry.value && expireAt.value
      ? { expireAt: new Date(expireAt.value).toISOString() }
      : undefined
    result.value = await generateInvite(props.tenantId, payload)
    emit('done')
  } catch {
    // handled by interceptor
  } finally {
    loading.value = false
  }
}

function handleCopy(text: string, label: string) {
  navigator.clipboard.writeText(text).then(() => {
    message.success(`${label}已复制到剪贴板`)
  }).catch(() => {
    message.error('复制失败，请手动复制')
  })
}

function handleCopyCode() {
  if (!result.value) return
  handleCopy(result.value.inviteCode, '邀请码')
}

function handleCopyUrl() {
  if (!result.value) return
  handleCopy(result.value.inviteUrl, '邀请链接')
}
</script>

<template>
  <a-modal
    :open="visible"
    :title="result ? '邀请码已生成' : '生成邀请码'"
    :mask-closable="false"
    width="440px"
    :footer="null"
    @cancel="close"
  >
    <!-- Input stage -->
    <template v-if="!result">
      <a-form layout="vertical" style="margin-top: 8px;">
        <a-form-item>
          <a-checkbox v-model:checked="setExpiry">设置过期时间</a-checkbox>
        </a-form-item>
        <a-form-item v-if="setExpiry" label="过期时间" :validate-status="expireError ? 'error' : ''" :help="expireError ? '请设置过期时间' : ''">
          <a-date-picker
            v-model:value="expireAt"
            show-time
            format="YYYY-MM-DD HH:mm:ss"
            placeholder="选择过期时间"
            style="width: 100%"
            :locale="zhCN"
            :disabled-date="(current: number) => current < Date.now() - 86400000"
          />
          <div style="color: #98a2b3; font-size: 12px; margin-top: 4px;">过期后邀请码将自动失效</div>
        </a-form-item>
        <div v-else style="color: #98a2b3; font-size: 12px; margin-bottom: 16px;">邀请码将永不过期</div>
      </a-form>

      <div style="display: flex; justify-content: flex-end; gap: 8px;">
        <a-button @click="close">取消</a-button>
        <a-button type="primary" :loading="loading" @click="handleGenerate">生成</a-button>
      </div>
    </template>

    <!-- Result stage -->
    <template v-else>
      <div class="invite-result">
        <!-- Invite Code -->
        <div class="result-row">
          <span class="result-label">邀请码</span>
          <div class="result-value">
            <span class="invite-code-text">{{ result.inviteCode }}</span>
            <a-button size="small" @click="handleCopyCode">
              <template #icon><CopyOutlined /></template>
              复制
            </a-button>
          </div>
        </div>

        <!-- Invite URL -->
        <div class="result-row">
          <span class="result-label">邀请链接</span>
          <div class="result-value url-value">
            <span class="url-text">{{ result.inviteUrl }}</span>
            <a-button size="small" @click="handleCopyUrl">
              <template #icon><CopyOutlined /></template>
              复制链接
            </a-button>
          </div>
        </div>

        <!-- QR Code -->
        <div class="result-row qr-row-item">
          <span class="result-label">二维码</span>
          <div class="result-value">
            <div v-if="qrLoading" class="qr-loading">生成中...</div>
            <img v-else-if="qrDataUrl" :src="qrDataUrl" alt="QR Code" class="qr-image" />
            <span v-else class="qr-error">无法生成</span>
          </div>
        </div>

        <div class="invite-expiry">
          {{ result.expiresAt ? `过期时间：${formatDateTime(result.expiresAt)}` : '永不过期' }}
        </div>
      </div>

      <div style="display: flex; justify-content: flex-end; margin-top: 16px;">
        <a-button type="primary" @click="close">关闭</a-button>
      </div>
    </template>
  </a-modal>
</template>

<style lang="scss" scoped>
.invite-result {
  padding: 16px;
  background: #f6ffed;
  border: 1px solid #b7eb8f;
  border-radius: 8px;
  margin-top: -8px;
}

.result-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 12px;

  &:last-of-type {
    margin-bottom: 8px;
  }
}

.result-label {
  font-size: 13px;
  color: $color-text-secondary;
  min-width: 56px;
  padding-top: 4px;
  flex-shrink: 0;
}

.result-value {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;

  &.url-value {
    flex-direction: column;
    align-items: flex-end;
    gap: 6px;
  }
}

.invite-code-text {
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 4px;
  font-family: 'Courier New', monospace;
  color: $color-text-primary;
}

.url-text {
  font-size: 12px;
  color: $color-text-secondary;
  word-break: break-all;
  line-height: 1.4;
}

.qr-row-item {
  align-items: center;
}

.qr-image {
  width: 100px;
  height: 100px;
  border: 1px solid $color-border;
  border-radius: 4px;
}

.qr-loading {
  width: 100px;
  height: 100px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: $color-text-secondary;
  border: 1px dashed $color-border;
  border-radius: 4px;
}

.qr-error {
  font-size: 12px;
  color: #ff4d4f;
}

.invite-expiry {
  font-size: 12px;
  color: $color-text-secondary;
  margin-top: 2px;
}
</style>
