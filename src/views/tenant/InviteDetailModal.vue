<script setup lang="ts">
import { ref, watch, h } from 'vue'
import { message, Modal as AntModal } from 'ant-design-vue'
import { CopyOutlined, ExclamationCircleOutlined } from '@ant-design/icons-vue'
import QRCode from 'qrcode'
import { deactivateInviteCode, activateInviteCode } from '@/api/tenant'
import { formatDateTime } from '@/utils/date'
import type { TenantInviteInfo } from '@/types/tenant'

const props = defineProps<{
  visible: boolean
  tenantId: string
  invite: TenantInviteInfo | null
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'done'): void
}>()

const qrDataUrl = ref('')
const qrLoading = ref(false)

watch(
  () => [props.visible, props.invite] as const,
  async ([v, invite]) => {
    if (v && invite?.inviteUrl) {
      qrLoading.value = true
      try {
        qrDataUrl.value = await QRCode.toDataURL(invite.inviteUrl, {
          width: 240,
          margin: 1,
          color: { dark: '#000000', light: '#ffffff' },
        })
      } catch {
        qrDataUrl.value = ''
      } finally {
        qrLoading.value = false
      }
    }
  },
)

function close() {
  emit('update:visible', false)
  setTimeout(() => {
    qrDataUrl.value = ''
  }, 200)
}

async function copyText(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text)
    message.success(`${label}已复制`)
  } catch {
    message.error('复制失败')
  }
}

function isExpired(invite: TenantInviteInfo): boolean {
  return invite.expiresAt !== null && new Date(invite.expiresAt).getTime() <= Date.now()
}

function handleDeactivate() {
  if (!props.invite) return
  AntModal.confirm({
    title: '停用邀请码',
    icon: h(ExclamationCircleOutlined, { style: 'color: #faad14' }),
    content: `确认停用邀请码 ${props.invite.code}？停用后该邀请码和链接将无法使用。`,
    okText: '确认停用',
    cancelText: '取消',
    onOk: async () => {
      try {
        await deactivateInviteCode(props.tenantId, props.invite!.id)
        message.success('邀请码已停用')
        close()
        emit('done')
      } catch {
        // handled by interceptor
      }
    },
  })
}

async function handleActivate() {
  if (!props.invite) return
  try {
    await activateInviteCode(props.tenantId, props.invite.id)
    message.success('邀请码已启用')
    close()
    emit('done')
  } catch {
    // handled by interceptor
  }
}
</script>

<template>
  <a-modal
    :open="visible"
    title="邀请码详情"
    :mask-closable="false"
    width="460px"
    :footer="null"
    @cancel="close"
  >
    <template v-if="invite">
      <!-- Invite Code -->
      <div class="detail-row">
        <span class="detail-label">邀请码</span>
        <div class="detail-value">
          <span class="mono-code">{{ invite.code }}</span>
          <a-button size="small" @click="copyText(invite.code, '邀请码')">
            <template #icon><CopyOutlined /></template>
            复制
          </a-button>
        </div>
      </div>

      <!-- Invite URL -->
      <div class="detail-row">
        <span class="detail-label">邀请链接</span>
        <div class="detail-value url-value">
          <span class="url-text">{{ invite.inviteUrl }}</span>
          <a-button size="small" @click="copyText(invite.inviteUrl, '邀请链接')">
            <template #icon><CopyOutlined /></template>
            复制链接
          </a-button>
        </div>
      </div>

      <!-- QR Code -->
      <div class="detail-row qr-row">
        <span class="detail-label">二维码</span>
        <div class="detail-value">
          <div v-if="qrLoading" class="qr-loading">生成中...</div>
          <img v-else-if="qrDataUrl" :src="qrDataUrl" alt="QR Code" class="qr-image" />
          <span v-else class="qr-error">无法生成</span>
        </div>
      </div>

      <!-- Meta info -->
      <div class="detail-meta">
        <div class="meta-row">
          <span class="meta-item">创建者 <strong>{{ invite.createdByUsername }}</strong></span>
          <span class="meta-item">使用 <strong>{{ invite.usageCount }} 次</strong></span>
        </div>
        <div class="meta-row">
          <span class="meta-item">
            状态
            <template v-if="isExpired(invite)">
              <a-tag color="default">已过期</a-tag>
            </template>
            <template v-else-if="invite.isActive === 1">
              <a-tag color="green">启用</a-tag>
            </template>
            <template v-else>
              <a-tag color="default">已停用</a-tag>
            </template>
          </span>
          <span class="meta-item">
            过期 {{ invite.expiresAt ? formatDateTime(invite.expiresAt) : '永久有效' }}
          </span>
        </div>
        <div class="meta-row">
          <span class="meta-item">创建于 {{ formatDateTime(invite.createTime) }}</span>
        </div>
      </div>
    </template>

    <!-- Footer -->
    <div class="detail-footer">
      <template v-if="invite && !isExpired(invite)">
        <a-button v-if="invite.isActive === 1" danger @click="handleDeactivate">停用</a-button>
        <a-button v-else type="primary" ghost @click="handleActivate">启用</a-button>
      </template>
      <a-button type="primary" @click="close">关闭</a-button>
    </div>
  </a-modal>
</template>

<style lang="scss" scoped>
.detail-row {
  display: flex;
  align-items: flex-start;
  padding: 10px 0;

  & + & {
    border-top: 1px solid $color-border;
  }
}

.detail-label {
  font-size: 13px;
  color: $color-text-secondary;
  min-width: 60px;
  padding-top: 4px;
  flex-shrink: 0;
}

.detail-value {
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

.mono-code {
  font-family: 'Courier New', monospace;
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 3px;
  color: $color-text-primary;
}

.url-text {
  font-size: 12px;
  color: $color-text-secondary;
  word-break: break-all;
  line-height: 1.4;
}

.qr-row {
  align-items: center;
}

.qr-image {
  width: 120px;
  height: 120px;
  border: 1px solid $color-border;
  border-radius: 4px;
}

.qr-loading {
  width: 120px;
  height: 120px;
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

.detail-meta {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid $color-border;
}

.meta-row {
  display: flex;
  gap: 24px;
  margin-bottom: 6px;

  &:last-child {
    margin-bottom: 0;
  }
}

.meta-item {
  font-size: 12px;
  color: $color-text-secondary;

  strong {
    color: $color-text-primary;
    font-weight: 500;
  }
}

.detail-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid $color-border;
}
</style>
