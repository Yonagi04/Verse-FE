<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import { createTenant, updateTenant } from '@/api/tenant'
import type { TenantUpdateReqDTO } from '@/types/tenant'

const props = defineProps<{
  visible: boolean
  mode: 'create' | 'edit'
  tenantId?: string
  initialName?: string
  initialDescription?: string
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'done'): void
}>()

const loading = ref(false)

const form = reactive<TenantUpdateReqDTO>({
  name: '',
  description: '',
})

watch(
  () => props.visible,
  (v) => {
    if (v) {
      form.name = props.initialName || ''
      form.description = props.initialDescription || ''
    }
  },
)

const rules = {
  name: [
    { required: true, message: '请输入租户名称', trigger: 'blur' },
    { max: 25, message: '不超过 25 个字符', trigger: 'blur' },
  ],
  description: [
    { max: 200, message: '不超过 200 个字符', trigger: 'blur' },
  ],
}

async function handleSubmit() {
  loading.value = true
  try {
    if (props.mode === 'create') {
      await createTenant({ name: form.name, description: form.description || undefined })
      message.success('租户创建成功')
    } else {
      await updateTenant(props.tenantId!, { name: form.name, description: form.description || undefined })
      message.success('租户信息已更新')
    }
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
    :title="mode === 'create' ? '创建租户' : '编辑租户'"
    :confirm-loading="loading"
    :mask-closable="false"
    width="480px"
    @ok="handleSubmit"
    @cancel="handleCancel"
  >
    <a-form :model="form" :rules="rules" layout="vertical" style="margin-top: 8px;">
      <a-form-item name="name" label="租户名称">
        <a-input
          v-model:value="form.name"
          placeholder="请输入租户名称"
          :maxlength="25"
          show-count
        />
      </a-form-item>
      <a-form-item name="description" label="描述">
        <a-textarea
          v-model:value="form.description"
          placeholder="请输入租户描述（选填）"
          :rows="3"
          :maxlength="200"
          show-count
        />
      </a-form-item>
    </a-form>
    <div
      v-if="mode === 'create'"
      style="color: #98a2b3; font-size: 12px; margin-top: -8px;"
    >
      创建后将自动成为该租户的超级管理员
    </div>
  </a-modal>
</template>
