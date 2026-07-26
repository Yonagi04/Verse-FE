<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import { useCancelAccount } from '@/hooks/useCancelAccount'

const props = defineProps<{
  visible: boolean
  phone: string // 用户手机号（完整），如 "13812341234"
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'success'): void
}>()

const {
  step,
  loading,
  prepareData,
  countdown,
  fetchPrepare,
  sendCode,
  confirm,
  reset,
  cleanup,
} = useCancelAccount()

// 6 位验证码分格输入
const codeCells = ref<string[]>(['', '', '', '', '', ''])

function getCodeValue(): string {
  return codeCells.value.join('')
}

function resetCodeInputs() {
  codeCells.value = ['', '', '', '', '', '']
}

function focusCell(idx: number) {
  const cells = document.querySelectorAll<HTMLInputElement>('.code-cell')
  if (cells[idx]) {
    cells[idx].focus()
  }
}

function handleCodeInput(e: Event, idx: number) {
  const target = e.target as HTMLInputElement
  const val = target.value.replace(/[^0-9]/g, '')
  target.value = val.slice(0, 1)
  codeCells.value[idx] = target.value

  if (val) {
    target.classList.remove('error')
    if (idx < 5) focusCell(idx + 1)
  }
}

function handleCodeKeydown(e: KeyboardEvent, idx: number) {
  if (e.key === 'Backspace') {
    const target = e.target as HTMLInputElement
    if (!target.value) {
      if (idx > 0) {
        const cells = document.querySelectorAll<HTMLInputElement>('.code-cell')
        if (cells[idx - 1]) {
          cells[idx - 1].focus()
          cells[idx - 1].value = ''
          codeCells.value[idx - 1] = ''
        }
      }
    }
  }
  if (e.key === 'ArrowLeft' && idx > 0) focusCell(idx - 1)
  if (e.key === 'ArrowRight' && idx < 5) focusCell(idx + 1)
}

function handleCodePaste(e: ClipboardEvent) {
  e.preventDefault()
  const paste = (e.clipboardData || (window as any).clipboardData).getData('text')
  const digits = paste.replace(/[^0-9]/g, '').slice(0, 6)
  const cells = document.querySelectorAll<HTMLInputElement>('.code-cell')
  codeCells.value.fill('')
  digits.split('').forEach((d, i) => {
    if (cells[i]) {
      cells[i].value = d
      codeCells.value[i] = d
    }
  })
  if (digits.length === 6 && cells[5]) {
    cells[5].focus()
  }
}

function showCodeError() {
  const cells = document.querySelectorAll<HTMLInputElement>('.code-cell')
  cells.forEach(c => c.classList.add('error'))
  setTimeout(() => {
    cells.forEach(c => c.classList.remove('error'))
  }, 500)
  resetCodeInputs()
  focusCell(0)
}

// ========== 步骤切换 ==========

// 弹窗打开 → 加载 prepare
watch(() => props.visible, async (val) => {
  if (val) {
    reset()
    resetCodeInputs()
    await fetchPrepare()
  }
})

// 步骤 1 → 2：发送验证码并滑到验证码页
async function goToVerifyCode() {
  const ok = await sendCode()
  if (ok) {
    step.value = 2
    resetCodeInputs()
    // 等滑动动画结束后聚焦第一个输入格
    setTimeout(() => focusCell(0), 400)
  }
  // 即使 sendCode 失败（如限流 B000211），若 step 已改变或倒计时已启动，也滑动到验证码页
  if (!ok && countdown.value > 0) {
    step.value = 2
    resetCodeInputs()
    setTimeout(() => focusCell(0), 400)
  }
}

// 步骤 2：确认注销
async function handleConfirmCancel() {
  const codeVal = getCodeValue()
  if (codeVal.length !== 6) return

  const ok = await confirm(codeVal)
  if (ok) {
    // 注销成功 — 关闭弹窗，通知父组件
    cleanup()
    emit('success')
  } else {
    // 验证码错误等 — 抖动 + 清空
    showCodeError()
  }
}

// 重新发送验证码
async function handleResendCode() {
  if (countdown.value > 0) return
  await sendCode()
  resetCodeInputs()
  setTimeout(() => focusCell(0), 200)
}

// 关闭弹窗
function handleClose() {
  cleanup()
  emit('close')
}

const canConfirm = computed(() => getCodeValue().length === 6)

onUnmounted(() => {
  cleanup()
})
</script>

<template>
  <a-modal
    :open="visible"
    :footer="null"
    :width="480"
    :closable="false"
    :mask-closable="false"
    :destroy-on-close="true"
    wrap-class-name="cancel-modal-wrap"
    @cancel="handleClose"
  >
    <!-- 标题栏 -->
    <div class="modal-header">
      <span class="modal-title">
        {{ step === 1 ? '确认要继续注销吗？' : '验证验证码' }}
      </span>
      <button class="close-btn" @click="handleClose" title="关闭">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </button>
    </div>

    <!-- 滑动容器 -->
    <div class="slide-container">
      <div class="slide-track" :class="{ 'at-step2': step === 2 }">
        <!-- ========== 步骤 1：警告页 ========== -->
        <div class="slide-page">
          <div class="page-body">
            <p class="warning-desc">{{ prepareData?.warningDescription }}</p>
            <ul class="warning-tips" v-if="prepareData?.warningTips?.length">
              <li v-for="(tip, idx) in prepareData.warningTips" :key="idx">{{ tip }}</li>
            </ul>
          </div>
          <div class="modal-footer">
            <a-button
              type="primary"
              danger
              class="footer-btn"
              block
              :loading="loading"
              @click="goToVerifyCode"
            >
              确认
            </a-button>
          </div>
        </div>

        <!-- ========== 步骤 2：验证码页 ========== -->
        <div class="slide-page">
          <div class="page-body">
            <p class="verify-desc">
              输入发送至 <span class="verify-phone">{{ phone }}</span> 的验证码
            </p>
            <div class="code-input-row">
              <input
                v-for="(_, idx) in 6"
                :key="idx"
                class="code-cell"
                type="text"
                maxlength="1"
                inputmode="numeric"
                pattern="[0-9]"
                :data-idx="idx"
                :value="codeCells[idx]"
                @input="handleCodeInput($event, idx)"
                @keydown="handleCodeKeydown($event, idx)"
                @paste="handleCodePaste"
              />
            </div>
          </div>
          <div class="modal-footer">
            <a-button
              type="primary"
              danger
              class="footer-btn"
              block
              :loading="loading"
              :disabled="!canConfirm"
              @click="handleConfirmCancel"
            >
              验证并注销
            </a-button>
          </div>
          <div class="resend-row">
            <a
              class="resend-link"
              :class="{ disabled: countdown > 0 }"
              @click="handleResendCode"
            >
              重新获取验证码
            </a>
            <span class="countdown-text" v-if="countdown > 0">{{ countdown }} 秒后可重新获取</span>
          </div>
        </div>
      </div>
    </div>
  </a-modal>
</template>

<style lang="scss" scoped>
// ========== 弹窗头部 ==========
.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 0 8px;
}

.modal-title {
  font-size: 18px;
  font-weight: 600;
  color: $color-text-primary;
}

.close-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: none;
  border-radius: 8px;
  cursor: pointer;
  color: $color-text-secondary;
  transition: all 0.15s;

  &:hover {
    background: #f5f5f5;
    color: $color-text-primary;
  }
}

// ========== 滑动容器 ==========
.slide-container {
  overflow: hidden;
}

.slide-track {
  display: flex;
  width: 200%;
  transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1);

  &.at-step2 {
    transform: translateX(-50%);
  }
}

.slide-page {
  width: 50%;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
}

.page-body {
  padding: 16px 0;
}

// ========== 警告页（步骤 1） ==========
.warning-desc {
  color: $color-danger;
  font-size: 14px;
  font-weight: 500;
  line-height: 1.6;
  margin: 0 0 16px;
}

.warning-tips {
  list-style: none;
  padding: 0;
  margin: 0;

  li {
    position: relative;
    padding: 8px 0 8px 16px;
    color: $color-danger;
    font-size: 14px;
    line-height: 1.6;
    border-bottom: 1px solid #fff0f0;

    &::before {
      content: '·';
      position: absolute;
      left: 0;
      font-weight: bold;
      font-size: 18px;
      line-height: 1.4;
    }
  }
}

// ========== 验证码页（步骤 2） ==========
.verify-desc {
  color: $color-text-secondary;
  font-size: 14px;
  margin: 0 0 20px;
  text-align: center;
}

.verify-phone {
  font-weight: 500;
  color: $color-text-primary;
}

.code-input-row {
  display: flex;
  gap: 8px;
  justify-content: center;
  margin-bottom: 8px;
}

.code-cell {
  width: 44px;
  height: 52px;
  border: 1px solid #d9d9d9;
  border-radius: $radius-input;
  text-align: center;
  font-size: 22px;
  font-weight: 600;
  color: $color-text-primary;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
  font-family: $font-family;
  caret-color: $color-primary;
  background: transparent;

  &:focus {
    border-color: $color-primary;
    box-shadow: 0 0 0 2px rgba(22, 119, 255, 0.1);
  }

  &.error {
    border-color: $color-danger;
    animation: shake 0.4s ease;
  }
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-4px); }
  75% { transform: translateX(4px); }
}

// ========== 底部按钮 ==========
.modal-footer {
  padding: 8px 0 0;
}

.footer-btn {
  height: 42px;
  border-radius: $radius-button;
  font-size: $font-size-body;
  font-weight: 500;
}

// ========== 重新获取验证码 ==========
.resend-row {
  text-align: center;
  padding: 12px 0 4px;
}

.resend-link {
  color: $color-danger;
  font-size: 13px;
  cursor: pointer;
  text-decoration: none;
  transition: opacity 0.15s;

  &:hover {
    opacity: 0.8;
    text-decoration: underline;
  }

  &.disabled {
    color: $color-text-secondary;
    cursor: not-allowed;
    pointer-events: none;
  }
}

.countdown-text {
  font-size: 13px;
  color: $color-text-secondary;
  margin-left: 8px;
}
</style>
