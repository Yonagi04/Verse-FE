<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import type { FormInstance } from 'ant-design-vue'
import { addLlmService, listLlmServiceTags } from '@/api/llmService'
import { PROVIDER_GROUPS, getProviderBySlug, prefixProviderName } from '@/constants/providers'
import ProviderLogo from '@/components/ProviderLogo.vue'
import ModelMetadataFields from './components/ModelMetadataFields.vue'
import PricingFormSection from './components/PricingFormSection.vue'
import { validatePeakPeriods, validateTokenLimits } from '@/utils/peakPeriod'
import type { LlmServiceAddReqDTO, PricingRequest, TagInfo } from '@/types/llmService'

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

const form = reactive({
  name: '',
  provider: '',
  apiUrl: '',
  apiKey: '',
  modelName: '',
})
const rpmEnabled = ref(false)
const rpm = ref<number | null>(null)
const tpmEnabled = ref(false)
const tpm = ref<number | null>(null)
const tags = ref<TagInfo[]>([])
const tagCodes = ref<string[]>([])
const contextWindow = ref<number | null>(null)
const maxOutputTokens = ref<number | null>(null)
const pricing = ref<PricingRequest>({ enabled: false })

const rules = {
  name: [
    { required: true, message: '请输入模型注册名称', trigger: 'blur' },
    { max: 20, message: '不超过 20 个字符', trigger: 'blur' },
  ],
  provider: [{ required: true, message: '请选择供应商', trigger: 'change' }],
  apiUrl: [{ required: true, message: '请输入 API 地址', trigger: 'blur' }],
  apiKey: [{ required: true, message: '请输入 API Key', trigger: 'blur' }],
  modelName: [{ required: true, message: '请输入模型名', trigger: 'blur' }],
}

watch(
  () => props.visible,
  (v) => {
    if (v) {
      form.name = ''
      form.provider = ''
      form.apiUrl = ''
      form.apiKey = ''
      form.modelName = ''
      rpmEnabled.value = false
      rpm.value = null
      tpmEnabled.value = false
      tpm.value = null
      tagCodes.value = []
      contextWindow.value = null
      maxOutputTokens.value = null
      pricing.value = { enabled: false }
      listLlmServiceTags().then((value) => { tags.value = value }).catch(() => { /* interceptor handled */ })
    }
  },
)

watch(
  () => form.provider,
  (slug) => {
    const p = getProviderBySlug(slug)
    if (!p) return
    form.apiUrl = p.apiUrl
    form.name = prefixProviderName(form.name, slug)
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

  if (rpmEnabled.value && (rpm.value == null || rpm.value < 1)) {
    message.error('请输入有效的 RPM 上限')
    return
  }
  if (tpmEnabled.value && (tpm.value == null || tpm.value < 1)) {
    message.error('请输入有效的 TPM 上限')
    return
  }
  const limits = validateTokenLimits(contextWindow.value, maxOutputTokens.value)
  if (!limits.valid) { message.error(limits.message!); return }
  if (pricing.value.enabled) {
    const peaks = validatePeakPeriods(pricing.value.peakPeriods)
    if (!peaks.valid) { message.error(peaks.message!); return }
  }

  loading.value = true
  try {
    const payload: LlmServiceAddReqDTO = {
      name: form.name.trim(),
      provider: form.provider,
      apiUrl: form.apiUrl.trim(),
      apiKey: form.apiKey.trim(),
      modelName: form.modelName.trim(),
      rpm: rpmEnabled.value ? rpm.value : null,
      tpm: tpmEnabled.value ? tpm.value : null,
      ...(tagCodes.value.length ? { tagCodes: tagCodes.value } : {}),
      ...(contextWindow.value != null ? { contextWindow: contextWindow.value } : {}),
      ...(maxOutputTokens.value != null ? { maxOutputTokens: maxOutputTokens.value } : {}),
      pricing: pricing.value,
    }
    await addLlmService(props.tenantId, payload)
    message.success('已添加')
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
    title="添加模型服务"
    :width="720"
    :mask-closable="false"
    @close="handleCancel"
  >
    <a-form
      ref="formRef"
      :model="form"
      :rules="rules"
      layout="vertical"
    >
      <a-form-item name="name" label="名称">
        <a-input
          v-model:value="form.name"
          placeholder="例如：gpt-4o"
          :maxlength="20"
          show-count
        />
        <div class="form-hint">租户内唯一，选择供应商后会自动添加前缀</div>
      </a-form-item>

      <a-form-item name="provider" label="供应商">
        <a-select
          v-model:value="form.provider"
          placeholder="选择供应商"
          style="width: 100%"
        >
          <a-select-opt-group
            v-for="g in PROVIDER_GROUPS"
            :key="g.label"
            :label="g.label"
          >
            <a-select-option
              v-for="p in g.providers"
              :key="p.slug"
              :value="p.slug"
            >
              <div class="provider-option">
                <ProviderLogo :slug="p.slug" :size="20" />
                <span>{{ p.displayName }}</span>
              </div>
            </a-select-option>
          </a-select-opt-group>
        </a-select>
      </a-form-item>

      <a-form-item name="apiUrl" label="API 地址">
        <a-input v-model:value="form.apiUrl" placeholder="https://api.example.com/v1" />
      </a-form-item>

      <a-form-item name="apiKey" label="API Key">
        <a-input-password v-model:value="form.apiKey" placeholder="sk-..." />
        <div class="form-hint">API Key 将加密存储，不会再次回显明文</div>
      </a-form-item>

      <a-form-item name="modelName" label="模型名">
        <a-input v-model:value="form.modelName" placeholder="供应商侧记录的模型名称" />
      </a-form-item>

      <ModelMetadataFields v-model:tag-codes="tagCodes" v-model:context-window="contextWindow" v-model:max-output-tokens="maxOutputTokens" :tags="tags" />

      <a-form-item label="RPM 上限">
        <a-switch
          v-model:checked="rpmEnabled"
        />
        <a-input-number
          v-if="rpmEnabled"
          v-model:value="rpm"
          :min="1"
          :precision="0"
          placeholder="请输入 RPM 上限"
          style="width: 100%; margin-top: 8px"
        />
      </a-form-item>

      <a-form-item label="TPM 上限">
        <a-switch
          v-model:checked="tpmEnabled"
        />
        <a-input-number
          v-if="tpmEnabled"
          v-model:value="tpm"
          :min="1"
          :precision="0"
          placeholder="请输入 TPM 上限"
          style="width: 100%; margin-top: 8px"
        />
      </a-form-item>

      <PricingFormSection v-model="pricing" />
    </a-form>

    <template #footer>
      <a-button style="margin-right: 8px" @click="handleCancel">取消</a-button>
      <a-button type="primary" :loading="loading" @click="handleCreate">添加</a-button>
    </template>
  </a-drawer>
</template>

<style lang="scss" scoped>
.form-hint {
  color: $color-text-secondary;
  font-size: 12px;
  margin-top: 4px;
}

.provider-option {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
