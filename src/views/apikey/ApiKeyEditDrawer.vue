<script setup lang="ts">
import { reactive, ref, watch, onBeforeUnmount } from 'vue'
import { message } from 'ant-design-vue'
import type { FormInstance } from 'ant-design-vue'
import dayjs, { type Dayjs } from 'dayjs'
import zhCN from 'ant-design-vue/es/date-picker/locale/zh_CN'
import { updateApiKey, getApiKeyCostStatus } from '@/api/apikey'
import CostLimitFormSection from './components/CostLimitFormSection.vue'
import { emptyCostDraft, costConfigToDraft, buildCostLimitPatch } from '@/utils/costBudget'
import type { CostLimitConfig } from '@/types/costBudget'
import type { ApiKeyListRespDTO, ApiKeyUpdateReqDTO } from '@/types/apikey'

const props = defineProps<{
  visible: boolean
  tenantId: string
  record: ApiKeyListRespDTO | null
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'done'): void
}>()

const formRef = ref<FormInstance>()
const loading = ref(false)
const costLoading = ref(false)
const costError = ref('')
const costDraft = ref(emptyCostDraft())
const serverConfig = ref<CostLimitConfig | null>(null)
const costTouched = ref(false)
let sequence = 0
let controller: AbortController | undefined
let saveController: AbortController | undefined
function cancelRequests() { sequence++; controller?.abort(); saveController?.abort(); costLoading.value = false; loading.value = false }
onBeforeUnmount(cancelRequests)
function changeCost(value: typeof costDraft.value) { costDraft.value = value; costTouched.value = true }
async function loadCost() {
  controller?.abort()
  if (!props.visible || !props.record?.costLimit) return
  const current = ++sequence
  const tenant = props.tenantId
  const key = props.record.apiKeyId
  controller = new AbortController()
  costLoading.value = true
  costError.value = ''
  try {
    const status = await getApiKeyCostStatus(tenant, key, { signal: controller.signal, silentError: true })
    if (current !== sequence) return
    serverConfig.value = status.costLimit
    costDraft.value = costConfigToDraft(status.costLimit)
  } catch {
    if (current === sequence) costError.value = '成本配置加载失败，请关闭后重新打开重试；仅修改其他字段时不提交成本配置。'
  } finally { if (current === sequence) costLoading.value = false }
}

const form = reactive({
  name: '',
})
const setExpiry = ref(false)
const expireAt = ref<Dayjs | null>(null)
const rpmEnabled = ref(false)
const rpm = ref<number | null>(null)
const tpmEnabled = ref(false)
const tpm = ref<number | null>(null)

const rules = {
  name: [
    { required: true, message: '请输入 API Key 名称', trigger: 'blur' },
    { max: 32, message: '不超过 32 个字符', trigger: 'blur' },
  ],
}

watch(
  () => [props.visible, props.tenantId, props.record?.apiKeyId] as const,
  ([v]) => {
    cancelRequests()
    serverConfig.value = null
    costDraft.value = emptyCostDraft()
    costTouched.value = false
    costError.value = ''
    if (v && props.record) {
      form.name = props.record.name
      setExpiry.value = !!props.record.expiresAt
      expireAt.value = props.record.expiresAt ? dayjs(props.record.expiresAt) : null
      rpmEnabled.value = props.record.rateLimitRpm != null
      rpm.value = props.record.rateLimitRpm ?? null
      tpmEnabled.value = props.record.rateLimitTpm != null
      tpm.value = props.record.rateLimitTpm ?? null
      void loadCost()
    }
  },
)

function disabledDate(current: number): boolean {
  const oldTime = props.record?.expiresAt ? dayjs(props.record.expiresAt).valueOf() : 0
  return current < Math.max(Date.now() - 86400000, oldTime)
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
  if (setExpiry.value && !expireAt.value) {
    message.error('请设置过期时间')
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
  if (!props.record) return

  let costLimit
  if (costTouched.value) {
    if (!serverConfig.value || costLoading.value) { message.error('请先加载并确认当前成本配置'); return }
    try { costLimit = buildCostLimitPatch(costDraft.value, serverConfig.value) }
    catch (error) { message.error((error as Error).message); return }
  }
  const current = sequence
  const tenant = props.tenantId
  const key = props.record.apiKeyId
  saveController = new AbortController()
  loading.value = true
  try {
    const payload: ApiKeyUpdateReqDTO = {
      name: form.name,
      costLimit,
      rpm: rpmEnabled.value ? rpm.value : null,
      tpm: tpmEnabled.value ? tpm.value : null,
    }
    payload.expiresAt = setExpiry.value && expireAt.value
      ? expireAt.value.toDate().toISOString()
      : null
    await updateApiKey(tenant, key, payload, { signal: saveController.signal })
    if (current !== sequence) return
    message.success('已保存')
    emit('done')
    emit('update:visible', false)
  } catch {
    // handled by interceptor
  } finally {
    if (current === sequence) loading.value = false
  }
}
</script>

<template>
  <a-drawer
    :open="visible"
    title="编辑 API Key"
    :width="520"
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
          :disabled-date="disabledDate"
        />
        <div class="form-hint">过期后 API Key 将自动失效</div>
      </a-form-item>

      <div v-else class="form-hint">API Key 将永不过期</div>

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
      <template v-if="record?.costLimit">
        <a-spin v-if="costLoading" />
        <a-alert v-if="costError" type="warning" :message="costError" />
        <CostLimitFormSection :model-value="costDraft" :disabled="costLoading || !serverConfig || loading" @update:model-value="changeCost" />
      </template>
    </a-form>

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
</style>
