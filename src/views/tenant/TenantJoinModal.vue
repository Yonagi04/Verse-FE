<script setup lang="ts">
import { ref, watch } from 'vue'
import { joinTenant } from '@/api/tenant'
import type { TenantJoinRespDTO } from '@/types/tenant'

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'done'): void
}>()

const inviteCode = ref('')
const loading = ref(false)
const joinResult = ref<TenantJoinRespDTO | null>(null)
const hasError = ref(false)

watch(() => props.visible, (v) => {
  if (v) {
    inviteCode.value = ''
    joinResult.value = null
    hasError.value = false
  }
})

function handleInput(e: Event) {
  const target = e.target as HTMLInputElement
  target.value = target.value.toUpperCase()
  inviteCode.value = target.value
}

async function handleJoin() {
  if (!inviteCode.value || inviteCode.value.length !== 8) return
  loading.value = true
  try {
    joinResult.value = await joinTenant({ inviteCode: inviteCode.value })
    emit('done')
  } catch {
    handleClose()
  } finally {
    loading.value = false
  }
}

function handleClose() {
  emit('update:visible', false)
}
</script>

<template>
  <a-modal
    :open="visible"
    :title="joinResult || hasError ? '加入结果' : '加入租户'"
    :confirm-loading="loading"
    :mask-closable="false"
    width="420px"
    :footer="null"
    @cancel="handleClose"
  >
    <!-- Input stage -->
    <template v-if="!joinResult && !hasError">
      <a-form layout="vertical" style="margin-top: 8px;">
        <a-form-item label="邀请码">
          <a-input
            :value="inviteCode"
            placeholder="请输入 8 位邀请码"
            :maxlength="8"
            class="invite-code-input"
            @input="handleInput"
          />
        </a-form-item>
      </a-form>
      <div style="color: #98a2b3; font-size: 12px;">
        输入管理员分享的邀请码即可加入团队空间
      </div>
      <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 24px;">
        <a-button @click="handleClose">取消</a-button>
        <a-button type="primary" :disabled="inviteCode.length !== 8" :loading="loading" @click="handleJoin">
          加入
        </a-button>
      </div>
    </template>

    <!-- Result stage -->
    <template v-else>
      <div class="join-result">
        <!-- Error -->
        <template v-if="hasError">
          <div class="join-result-icon error">
            <span style="font-size: 28px;">&#10005;</span>
          </div>
          <div class="join-result-title">提交失败</div>
          <div class="join-result-desc">加入申请提交失败，请稍后重试</div>
        </template>
        <!-- Success: directly joined -->
        <template v-else-if="!joinResult.pendingApproval">
          <div class="join-result-icon success">
            <span style="font-size: 28px;">&#10003;</span>
          </div>
          <div class="join-result-title">成功加入租户</div>
          <div class="join-result-desc">你已成为该租户的成员</div>
        </template>
        <!-- Success: pending approval -->
        <template v-else>
          <div class="join-result-icon success">
            <span style="font-size: 28px;">&#10003;</span>
          </div>
          <div class="join-result-title">申请已提交</div>
          <div class="join-result-desc">你的加入申请已提交，请等待管理员审批</div>
        </template>
        <a-button type="primary" style="margin-top: 20px;" @click="handleClose">知道了</a-button>
      </div>
    </template>
  </a-modal>
</template>

<style lang="scss" scoped>
.invite-code-input :deep(input) {
  text-transform: uppercase;
  letter-spacing: 4px;
  font-family: 'Courier New', monospace;
  font-size: 16px;
}

.join-result {
  text-align: center;
  padding: 16px 0;
}

.join-result-icon {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
}

.join-result-icon.success {
  background: #f6ffed;
  color: $color-success;
}

.join-result-icon.error {
  background: #fff2f0;
  color: $color-danger;
}

.join-result-title {
  font-size: $font-size-h3;
  font-weight: 600;
  margin-bottom: 8px;
  color: $color-text-primary;
}

.join-result-desc {
  color: $color-text-secondary;
  font-size: 13px;
}
</style>
