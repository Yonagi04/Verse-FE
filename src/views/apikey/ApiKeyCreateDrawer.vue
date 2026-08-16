<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import type { FormInstance } from 'ant-design-vue'
import { CopyOutlined } from '@ant-design/icons-vue'
import zhCN from 'ant-design-vue/es/date-picker/locale/zh_CN'
import { createApiKey } from '@/api/apikey'
import { formatDateTime } from '@/utils/date'
import type { ApiKeyCreateReqDTO, ApiKeyRespDTO } from '@/types/apikey'

const props = defineProps<{
  visible: boolean
  tenantId: string
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'done'): void
}>()

const formRef = ref<FormInstance>()
const loading = ref(false)
const result = ref<ApiKeyRespDTO | null>(null)

const form = reactive({
  name: '',
})
const setExpiry = ref(false)
const expireAt = ref<string | null>(null)

const rules = {
  name: [
    { required: true, message: '请输入 API Key 名称', trigger: 'blur' },
    { max: 32, message: '不超过 32 个字符', trigger: 'blur' },
  ],
}

watch(
  () => props.visible,
  (v) => {
    if (v) {
      form.name = ''
      setExpiry.value = false
      expireAt.value = null
      result.value = null
    }
  },
)

function handleCancel() {
  emit('update:visible', false)
}

async function handleCreate() {
  try {
    await formRef.value?.validate()
  } catch {
    return
  }
  if (setExpiry.value && !expireAt.value) {
    message.error('请设置过期时间')
    return
  }

  loading.value = true
  try {
    const payload: ApiKeyCreateReqDTO = { name: form.name }
    if (setExpiry.value && expireAt.value) {
      payload.expiresAt = new Date(expireAt.value).toISOString()
    }
    result.value = await createApiKey(props.tenantId, payload)
    emit('done')
  } catch {
    // handled by interceptor
  } finally {
    loading.value = false
  }
}

function handleCopy() {
  if (!result.value) return
  navigator.clipboard.writeText(result.value.apiKey).then(() => {
    message.success('API Key 已复制到剪贴板')
  }).catch(() => {
    message.error('复制失败，请手动复制')
  })
}
</script>

<template>
  <a-drawer
    :open="visible"
    :title="result ? 'API Key 已创建' : '创建 API Key'"
    :width="520"
    :mask-closable="false"
    @close="handleCancel"
  >
    <!-- Form stage -->
    <a-form
      v-if="!result"
      ref="formRef"
      :model="form"
      :rules="rules"
      layout="vertical"
    >
      <a-form-item name="name" label="名称">
        <a-input
          v-model:value="form.name"
          placeholder="例如：生产环境密钥"
          :maxlength="32"
          show-count
        />
      </a-form-item>

      <a-form-item>
        <a-checkbox v-model:checked="setExpiry">设置过期时间</a-checkbox>
      </a-form-item>

      <a-form-item v-if="setExpiry" label="过期时间">
        <a-date-picker
          v-model:value="expireAt"
          show-time
          format="YYYY-MM-DD HH:mm:ss"
          placeholder="选择过期时间"
          style="width: 100%"
          :locale="zhCN"
          :disabled-date="(current: number) => current < Date.now() - 86400000"
        />
        <div class="form-hint">过期后 API Key 将自动失效</div>
      </a-form-item>

      <div v-else class="form-hint">API Key 将永不过期</div>
    </a-form>

    <!-- Reveal stage -->
    <div v-else class="reveal">
      <a-alert
        type="warning"
        show-icon
        message="请立即保存此 API Key"
        description="此密钥仅在本次显示一次，关闭后无法再次查看。若丢失需重新创建。"
        style="margin-bottom: 16px"
      />

      <div class="reveal-row">
        <span class="reveal-label">完整 Key</span>
        <div class="reveal-key">
          <span class="key-text">{{ result.apiKey }}</span>
          <a-button size="small" @click="handleCopy">
            <template #icon><CopyOutlined /></template>
            复制
          </a-button>
        </div>
      </div>

      <div class="reveal-row">
        <span class="reveal-label">名称</span>
        <span class="reveal-value">{{ result.name }}</span>
      </div>

      <div class="reveal-row">
        <span class="reveal-label">过期时间</span>
        <span class="reveal-value">
          {{ result.expiresAt ? formatDateTime(result.expiresAt) : '永久有效' }}
        </span>
      </div>
    </div>

    <template #footer>
      <template v-if="!result">
        <a-button style="margin-right: 8px" @click="handleCancel">取消</a-button>
        <a-button type="primary" :loading="loading" @click="handleCreate">创建</a-button>
      </template>
      <a-button v-else type="primary" @click="handleCancel">关闭</a-button>
    </template>
  </a-drawer>
</template>

<style lang="scss" scoped>
.form-hint {
  color: $color-text-secondary;
  font-size: 12px;
  margin-top: 4px;
}

.reveal {
  .reveal-row {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    margin-bottom: 16px;
  }

  .reveal-label {
    font-size: 13px;
    color: $color-text-secondary;
    min-width: 56px;
    padding-top: 4px;
    flex-shrink: 0;
  }

  .reveal-value {
    font-size: 14px;
    color: $color-text-primary;
    padding-top: 4px;
  }

  .reveal-key {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;

    .key-text {
      flex: 1;
      font-family: 'Courier New', monospace;
      font-size: 13px;
      color: $color-text-primary;
      background: $color-bg-secondary;
      border: 1px solid $color-border;
      border-radius: $radius-button;
      padding: 8px 12px;
      word-break: break-all;
      line-height: 1.5;
    }
  }
}
</style>
