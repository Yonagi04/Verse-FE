<script setup lang="ts">
import { ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import { joinTenant } from '@/api/tenant'

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'done'): void
}>()

const inviteCode = ref('')
const loading = ref(false)

watch(() => props.visible, (v) => {
  if (v) {
    inviteCode.value = ''
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
    await joinTenant({ inviteCode: inviteCode.value })
    message.success('成功加入租户')
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
  <a-modal
    :open="visible"
    title="加入租户"
    :confirm-loading="loading"
    :mask-closable="false"
    width="400px"
    ok-text="加入"
    cancel-text="取消"
    :ok-button-props="{ disabled: inviteCode.length !== 8 }"
    @cancel="emit('update:visible', false)"
    @ok="handleJoin"
  >
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
  </a-modal>
</template>

<style lang="scss" scoped>
.invite-code-input :deep(input) {
  text-transform: uppercase;
  letter-spacing: 4px;
  font-family: 'Courier New', monospace;
  font-size: 16px;
}
</style>
