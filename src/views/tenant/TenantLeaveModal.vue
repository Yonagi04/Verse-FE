<script setup lang="ts">
import { ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import { leaveTenantPrepare, leaveTenantConfirm } from '@/api/tenant'
import type { TenantLeavePrepareRespDTO } from '@/types/tenant'

const props = defineProps<{
  visible: boolean
  tenantId: string
  tenantName: string
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'done'): void
}>()

const step = ref(1)
const preparing = ref(false)
const loading = ref(false)
const confirmed = ref(false)
const confirmName = ref('')
const prepareData = ref<TenantLeavePrepareRespDTO | null>(null)

watch(() => props.visible, async (v) => {
  if (v) {
    step.value = 1
    confirmed.value = false
    confirmName.value = ''
    prepareData.value = null
    preparing.value = true
    try {
      prepareData.value = await leaveTenantPrepare(props.tenantId)
    } catch {
      emit('update:visible', false)
    } finally {
      preparing.value = false
    }
  }
})

function close() {
  emit('update:visible', false)
}

function handleStep1() {
  if (!confirmed.value) return
  step.value = 2
}

async function handleStep2() {
  if (confirmName.value !== props.tenantName) return
  loading.value = true
  try {
    await leaveTenantConfirm(props.tenantId)
    message.success(`已退出「${props.tenantName}」`)
    emit('done')
    close()
  } catch {
    // handled by interceptor
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <a-modal
    :open="visible"
    :title="step === 1 ? '退出租户 — 风险确认' : '退出租户 — 确认操作'"
    :confirm-loading="loading"
    :mask-closable="false"
    width="520px"
    @cancel="close"
    @ok="step === 1 ? handleStep1() : handleStep2()"
    :ok-button-props="{
      danger: true,
      disabled: step === 1 ? (preparing || !confirmed) : confirmName !== tenantName,
    }"
    :ok-text="step === 1 ? '下一步' : '确认退出'"
    cancel-text="取消"
  >
    <!-- Step indicator -->
    <div class="leave-steps">
      <span class="leave-step-label">第 1 步</span>
      <div class="leave-step-bar" :class="{ active: step >= 2 }"></div>
      <span class="leave-step-label">第 2 步</span>
    </div>

    <!-- Step 1: Warning -->
    <div v-if="step === 1">
      <div v-if="preparing" style="text-align: center; padding: 20px;">
        <a-spin tip="正在获取退出信息..." />
      </div>
      <template v-else-if="prepareData">
        <a-alert
          type="warning"
          :show-icon="false"
          style="margin-bottom: 16px;"
        >
          <template #message>
            <div style="font-weight: 600; margin-bottom: 8px;">{{ prepareData.warningDescription }}</div>
            <ul style="margin: 0; padding-left: 20px;">
              <li v-for="(tip, i) in prepareData.warningTips" :key="i">{{ tip }}</li>
            </ul>
          </template>
        </a-alert>

        <div style="margin-bottom: 8px; color: #667085; font-size: 13px;">
          即将退出的租户：<strong style="color: #1f2328;">{{ tenantName }}</strong>
        </div>

        <a-checkbox v-model:checked="confirmed">
          我已阅读并理解以上影响，确认要退出此租户
        </a-checkbox>
      </template>
    </div>

    <!-- Step 2: Name confirmation -->
    <div v-else>
      <a-alert
        type="error"
        :show-icon="false"
        style="margin-bottom: 16px;"
      >
        <template #message>
          请输入租户名称 <code style="background:#fff1f0;padding:2px 6px;border-radius:4px;">{{ tenantName }}</code> 以确认退出
        </template>
      </a-alert>

      <a-form layout="vertical">
        <a-form-item label="租户名称">
          <a-input
            v-model:value="confirmName"
            placeholder="请输入租户名称以确认"
          />
        </a-form-item>
      </a-form>
    </div>
  </a-modal>
</template>

<style lang="scss" scoped>
.leave-steps {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-bottom: 20px;
}

.leave-step-label {
  font-size: 13px;
  color: $color-text-secondary;
}

.leave-step-bar {
  width: 60px;
  height: 4px;
  background: #e5e7eb;
  border-radius: 2px;
  transition: background 0.3s;

  &.active {
    background: $color-danger;
  }
}
</style>
