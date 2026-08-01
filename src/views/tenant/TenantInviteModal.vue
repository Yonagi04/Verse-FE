<script setup lang="ts">
import { ref } from 'vue'
import { message } from 'ant-design-vue'
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
}>()

const setExpiry = ref(false)
const expireAt = ref<string | null>(null)
const loading = ref(false)
const result = ref<TenantInviteRespDTO | null>(null)
const expireError = ref(false)

function close() {
  emit('update:visible', false)
  setTimeout(() => {
    setExpiry.value = false
    expireAt.value = null
    result.value = null
    expireError.value = false
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
  } catch {
    // handled by interceptor
  } finally {
    loading.value = false
  }
}

function handleCopy() {
  if (!result.value) return
  navigator.clipboard.writeText(result.value.inviteCode).then(() => {
    message.success('邀请码已复制到剪贴板')
  }).catch(() => {
    message.error('复制失败，请手动复制')
  })
}
</script>

<template>
  <a-modal
    :open="visible"
    title="生成邀请码"
    :confirm-loading="loading"
    :mask-closable="false"
    width="440px"
    ok-text="生成"
    cancel-text="取消"
    @cancel="close"
    @ok="handleGenerate"
  >
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

    <!-- Result -->
    <div
      v-if="result"
      class="invite-result"
    >
      <div class="invite-code">{{ result.inviteCode }}</div>
      <div class="invite-expiry">
        {{ result.expiresAt ? `过期时间：${formatDateTime(result.expiresAt)}` : '永不过期' }}
      </div>
      <a-button size="small" @click="handleCopy">复制</a-button>
    </div>
  </a-modal>
</template>

<style lang="scss" scoped>
.invite-result {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 16px;
  background: #f6ffed;
  border: 1px solid #b7eb8f;
  border-radius: 8px;
  margin-top: -8px;
}

.invite-code {
  font-size: 22px;
  font-weight: 700;
  letter-spacing: 4px;
  font-family: 'Courier New', monospace;
  color: $color-text-primary;
}

.invite-expiry {
  font-size: 12px;
  color: $color-text-secondary;
  flex: 1;
}
</style>
