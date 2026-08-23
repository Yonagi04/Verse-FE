<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import type { FormInstance } from 'ant-design-vue'
import { getLlmServiceInfo, updateLlmService } from '@/api/llmService'
import { getProviderBySlug } from '@/constants/providers'
import ProviderLogo from '@/components/ProviderLogo.vue'
import type { LlmServiceInfo, LlmServiceUpdateReqDTO } from '@/types/llmService'

const props = defineProps<{
  visible: boolean
  tenantId: string
  record: LlmServiceInfo | null
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'done'): void
}>()

const formRef = ref<FormInstance>()
const loading = ref(false)
const fetching = ref(false)
const maskedKey = ref('')

const form = reactive({
  name: '',
  apiUrl: '',
  apiKey: '',
  modelName: '',
})

const rules = {
  name: [{ max: 20, message: '不超过 20 个字符', trigger: 'blur' }],
}

watch(
  () => props.visible,
  async (v) => {
    if (!v || !props.record) return
    form.name = ''
    form.apiUrl = ''
    form.apiKey = ''
    form.modelName = ''
    maskedKey.value = ''
    fetching.value = true
    try {
      const info = await getLlmServiceInfo(props.tenantId, props.record.serviceId)
      form.name = info.name
      form.apiUrl = info.apiUrl
      form.modelName = info.modelName
      maskedKey.value = info.apiKey
    } catch {
      // handled by interceptor
    } finally {
      fetching.value = false
    }
  },
)

function providerDisplayName(slug: string): string {
  return getProviderBySlug(slug)?.displayName ?? slug
}

function handleCancel() {
  emit('update:visible', false)
}

async function handleSave() {
  try {
    await formRef.value?.validate()
  } catch {
    return
  }

  const payload: LlmServiceUpdateReqDTO = {}
  if (form.name.trim()) payload.name = form.name.trim()
  if (form.apiUrl.trim()) payload.apiUrl = form.apiUrl.trim()
  if (form.apiKey.trim()) payload.apiKey = form.apiKey.trim()
  if (form.modelName.trim()) payload.modelName = form.modelName.trim()

  if (Object.keys(payload).length === 0) {
    message.error('请至少填写一个需要更新的字段')
    return
  }

  if (!props.record) return

  loading.value = true
  try {
    await updateLlmService(props.tenantId, props.record.serviceId, payload)
    message.success('已保存')
    emit('done')
    emit('update:visible', false)
  } catch {
    // handled by interceptor
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <a-drawer
    :open="visible"
    title="编辑模型服务"
    :width="520"
    :mask-closable="false"
    @close="handleCancel"
  >
    <a-spin :spinning="fetching">
      <a-form
        ref="formRef"
        :model="form"
        :rules="rules"
        layout="vertical"
      >
        <div class="form-hint form-hint-block">留空字段保持不变，修改后提交对应字段</div>

        <a-form-item label="供应商">
          <div class="provider-readonly">
            <ProviderLogo :slug="record?.provider ?? ''" :size="22" />
            <span>{{ providerDisplayName(record?.provider ?? '') }}</span>
            <span class="readonly-tip">供应商不可修改</span>
          </div>
        </a-form-item>

        <a-form-item name="name" label="名称">
          <a-input v-model:value="form.name" :maxlength="20" show-count />
        </a-form-item>

        <a-form-item name="apiUrl" label="API 地址">
          <a-input v-model:value="form.apiUrl" placeholder="https://api.example.com/v1" />
        </a-form-item>

        <a-form-item name="modelName" label="模型名">
          <a-input v-model:value="form.modelName" placeholder="供应商侧记录的模型名称" />
        </a-form-item>

        <a-form-item label="当前 API Key（脱敏）">
          <a-input :value="maskedKey" disabled />
        </a-form-item>

        <a-form-item name="apiKey" label="新 API Key">
          <a-input-password v-model:value="form.apiKey" placeholder="留空表示不修改" />
          <div class="form-hint">仅在需要更换时填写，留空保持原 Key 不变</div>
        </a-form-item>
      </a-form>
    </a-spin>

    <template #footer>
      <a-button style="margin-right: 8px" @click="handleCancel">取消</a-button>
      <a-button type="primary" :loading="loading" @click="handleSave">保存</a-button>
    </template>
  </a-drawer>
</template>

<style lang="scss" scoped>
.form-hint {
  color: $color-text-secondary;
  font-size: 12px;
  margin-top: 4px;
}

.form-hint-block {
  margin: 0 0 16px 0;
}

.provider-readonly {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border: 1px solid $color-border;
  border-radius: $radius-input;
  background: $color-bg-secondary;

  .readonly-tip {
    margin-left: auto;
    font-size: 12px;
    color: $color-text-secondary;
  }
}
</style>
