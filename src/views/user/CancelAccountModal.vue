<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch, onUnmounted } from 'vue'
import { CloseOutlined, ReloadOutlined } from '@ant-design/icons-vue'
import { useCancelAccount } from '@/hooks/useCancelAccount'

const props = defineProps<{ visible: boolean; phone: string }>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'success'): void }>()
const { loading, prepareData, countdown, fetchPrepare, sendCode, confirm, reset, cleanup } = useCancelAccount()
const prepared = ref(false)
const prepareFailed = ref(false)
const form = reactive({ code: '', acknowledged: false })
const codeInputRef = ref<{ focus: () => void } | null>(null)
const maskedPhone = computed(() => props.phone.replace(/^(\d{3})\d+(\d{4})$/, '$1****$2'))
async function prepare() {
  prepared.value = false
  prepareFailed.value = false
  prepared.value = await fetchPrepare()
  prepareFailed.value = !prepared.value
}
watch(() => props.visible, async (visible) => {
  if (visible) {
    reset()
    Object.assign(form, { code: '', acknowledged: false })
    await prepare()
  } else cleanup()
})
async function handleSendCode() {
  if (!prepared.value || loading.value || countdown.value > 0) return
  await sendCode()
  await nextTick()
  codeInputRef.value?.focus()
}
async function handleConfirm() {
  if (!prepared.value || loading.value || !form.acknowledged || !/^\d{6}$/.test(form.code)) return
  if (await confirm(form.code)) {
    cleanup()
    emit('success')
  }
}
function close() { if (!loading.value) { cleanup(); emit('close') } }
onUnmounted(cleanup)
</script>

<template>
  <a-modal :open="visible" :footer="null" :width="440" :closable="false" :mask-closable="!loading" :keyboard="!loading" :destroy-on-close="true" @cancel="close">
    <div class="cancel-dialog">
      <div class="dialog-heading"><h3>注销用户</h3><button type="button" class="dialog-close" :disabled="loading" aria-label="关闭" @click="close"><CloseOutlined /></button></div>
      <a-skeleton v-if="loading && !prepared" :paragraph="{ rows: 3 }" aria-label="正在检查账户注销条件" />
      <div v-else-if="prepareFailed" class="prepare-error"><p>暂时无法继续注销，请处理账户检查提示后重试。</p><a-button @click="prepare"><ReloadOutlined />重新检查</a-button></div>
      <template v-else-if="prepared">
        <div class="cancel-alert">{{ prepareData?.warningDescription || '注销后将无法登录该账户。请先检查租户归属，并确认已处理相关数据。' }}</div>
        <ul v-if="prepareData?.warningTips?.length" class="warning-tips"><li v-for="(tip, index) in prepareData.warningTips" :key="index">{{ tip }}</li></ul>
        <a-form class="cancel-form" layout="vertical" :model="form" :disabled="loading" @finish="handleConfirm">
          <a-form-item label="手机验证码" name="code" :rules="[{ required: true, message: '请输入手机验证码' }, { pattern: /^\d{6}$/, message: '请输入 6 位验证码' }]">
            <p class="phone-hint">验证码将发送至 {{ maskedPhone }}</p>
            <div class="code-row"><a-input ref="codeInputRef" v-model:value="form.code" inputmode="numeric" autocomplete="one-time-code" :maxlength="6" placeholder="6 位验证码" /><a-button :disabled="countdown > 0 || loading" @click="handleSendCode">{{ countdown > 0 ? `${countdown}s 后重试` : '获取验证码' }}</a-button></div>
          </a-form-item>
          <a-form-item name="acknowledged" class="acknowledgement"><a-checkbox v-model:checked="form.acknowledged">我已了解注销影响并确认继续</a-checkbox></a-form-item>
          <div class="dialog-actions"><a-button :disabled="loading" @click="close">取消</a-button><a-button type="primary" danger html-type="submit" :disabled="!form.acknowledged" :loading="loading">确认注销</a-button></div>
        </a-form>
      </template>
    </div>
  </a-modal>
</template>

<style lang="scss" scoped>
@use './user-center';
.dialog-heading { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; gap: 16px; h3 { margin: 0; font-size: $font-size-h3; font-weight: 600; } }
.dialog-close { width: 32px; height: 32px; padding: 0; display: grid; place-items: center; background: transparent; color: $color-text-secondary; border: 0; border-radius: $radius-button; font-size: 18px; cursor: pointer; &:focus-visible { outline: 2px solid $color-primary; } }
.cancel-alert { padding: 14px 16px; background: rgba($color-danger, 0.08); border: 1px solid rgba($color-danger, 0.45); border-radius: $radius-input; font-size: 13px; line-height: 1.8; margin-bottom: 16px; white-space: pre-wrap; }
.warning-tips { padding-left: 20px; color: $color-text-secondary; font-size: 13px; line-height: 1.8; li { margin: 6px 0; } }
.cancel-form { margin-top: 20px; }
.phone-hint { margin: 0 0 8px; font-size: $font-size-caption; color: $color-text-secondary; }
.code-row { display: flex; gap: 10px; :deep(.ant-input) { height: 40px; border-radius: $radius-input; } :deep(.ant-btn) { height: 40px; } }
.acknowledgement { margin-bottom: 0; :deep(.ant-checkbox-wrapper) { font-size: $font-size-caption; color: $color-text-secondary; } }
.dialog-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 22px; }
.prepare-error { color: $color-text-secondary; line-height: 1.8; p { margin: 0 0 16px; } }
</style>
