<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import { sendTenantNotification } from '@/api/tenant'
import type { TenantSendNotificationReq } from '@/types/tenant'

const props = defineProps<{
  visible: boolean
  tenantId: string
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'done'): void
}>()

const loading = ref(false)

const form = reactive<TenantSendNotificationReq>({
  severity: '',
  title: '',
  content: '',
  receiverType: 1,
})

watch(
  () => props.visible,
  (v) => {
    if (v) {
      form.severity = ''
      form.title = ''
      form.content = ''
      form.receiverType = 1
    }
  },
)

const severityOptions = [
  { value: 'INFO', label: '一般' },
  { value: 'WARNING', label: '需关注' },
  { value: 'CRITICAL', label: '严重' },
]

const rules = {
  severity: [
    { required: true, message: '请选择严重程度', trigger: 'change' },
  ],
  title: [
    { required: true, message: '请输入通知标题', trigger: 'blur' },
    { max: 50, message: '不超过 50 个字符', trigger: 'blur' },
  ],
  content: [
    { required: true, message: '请输入通知内容', trigger: 'blur' },
    { max: 500, message: '不超过 500 个字符', trigger: 'blur' },
  ],
}

async function handleSubmit() {
  loading.value = true
  try {
    await sendTenantNotification(props.tenantId, { ...form })
    message.success('通知已发送')
    emit('done')
    emit('update:visible', false)
  } catch {
    // handled by interceptor
  } finally {
    loading.value = false
  }
}

function handleCancel() {
  emit('update:visible', false)
}
</script>

<template>
  <a-modal
    :open="visible"
    title="发送租户通知"
    :confirm-loading="loading"
    :mask-closable="false"
    width="520px"
    ok-text="确认发送"
    cancel-text="取消"
    @ok="handleSubmit"
    @cancel="handleCancel"
  >
    <a-form :model="form" :rules="rules" layout="vertical" style="margin-top: 8px;">
      <a-form-item name="severity" label="严重程度">
        <a-select
          v-model:value="form.severity"
          :options="severityOptions"
          placeholder="请选择严重程度"
        />
      </a-form-item>

      <a-form-item name="title" label="通知标题">
        <a-input
          v-model:value="form.title"
          placeholder="请输入通知标题"
          :maxlength="50"
          show-count
        />
      </a-form-item>

      <a-form-item name="content" label="通知内容">
        <a-textarea
          v-model:value="form.content"
          placeholder="请输入通知内容"
          :rows="4"
          :maxlength="500"
          show-count
        />
      </a-form-item>

      <a-form-item name="receiverType" label="接收范围">
        <a-radio-group v-model:value="form.receiverType">
          <a-radio :value="1">全员</a-radio>
          <a-radio :value="2">仅成员</a-radio>
          <a-radio :value="3">仅管理员</a-radio>
        </a-radio-group>
      </a-form-item>
    </a-form>
  </a-modal>
</template>
