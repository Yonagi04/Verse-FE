<script setup lang="ts">
import { reactive, ref, watch, computed } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { useUserStore } from '@/stores/user'
import { useProfileModal } from '@/hooks/useProfileModal'
import { getCurrentUser, updateProfile, updatePassword } from '@/api/user'
import CancelAccountModal from './CancelAccountModal.vue'
import type { UserUpdateReqDTO, UserRespDTO } from '@/types/user'

const router = useRouter()
const userStore = useUserStore()
const { visible, close } = useProfileModal()

// ========== 数据状态 ==========
const loading = ref(false)
const pwdLoading = ref(false)
const isEditing = ref(false)
const maskState = ref<'masked' | 'unmasked'>('masked')
const maskedData = ref<UserRespDTO | null>(null)
const unmaskedData = ref<UserRespDTO | null>(null)
const maskLoading = ref(false)

// 当前展示数据
const profile = computed(() =>
  maskState.value === 'masked' ? maskedData.value : unmaskedData.value
)

// ========== 编辑表单 ==========
const form = reactive<UserUpdateReqDTO>({
  nickname: '',
  email: '',
  phone: '',
})

// ========== 密码表单 ==========
const passwordVisible = ref(false)
const passwordForm = reactive({
  oldPassword: '',
  password: '',
  confirmPassword: '',
})

// ========== 头像文字 ==========
const avatarLetter = computed(() => {
  const name = profile.value?.nickname || profile.value?.username || ''
  return name.charAt(0).toUpperCase()
})

// ========== 加载数据 ==========
async function loadProfile(mask: boolean) {
  try {
    if (mask) {
      maskedData.value = await getCurrentUser(true)
    } else {
      maskLoading.value = true
      unmaskedData.value = await getCurrentUser(false)
    }
  } catch {
    // handled by interceptor
  } finally {
    maskLoading.value = false
  }
}

// 弹窗打开时仅加载 mask=true
watch(visible, async (val) => {
  if (val) {
    maskState.value = 'masked'
    isEditing.value = false
    await loadProfile(true)
  }
})

// ========== 遮罩切换 ==========
async function toggleMask() {
  if (maskState.value === 'masked') {
    // 用户主动展示敏感字段 — 若未缓存则先请求 mask=false
    if (!unmaskedData.value) {
      await loadProfile(false)
    }
    maskState.value = 'unmasked'
  } else {
    maskState.value = 'masked'
  }
}

// ========== 编辑模式 ==========
async function enterEditMode() {
  // 编辑资料需要完整数据，若未缓存则先请求
  if (!unmaskedData.value) {
    maskLoading.value = true
    try {
      unmaskedData.value = await getCurrentUser(false)
    } catch {
      // handled by interceptor
    } finally {
      maskLoading.value = false
    }
  }
  if (!unmaskedData.value) return
  form.nickname = unmaskedData.value.nickname || ''
  form.email = unmaskedData.value.email || ''
  form.phone = unmaskedData.value.phone || ''
  isEditing.value = true
}

function cancelEdit() {
  isEditing.value = false
}

async function handleUpdateProfile() {
  loading.value = true
  try {
    await updateProfile({ ...form })
    message.success('个人信息更新成功')
    isEditing.value = false
    // 刷新缓存数据
    await Promise.all([loadProfile(true), loadProfile(false)])
    await userStore.fetchProfile()
  } catch {
    // handled by interceptor
  } finally {
    loading.value = false
  }
}

// ========== 修改密码 ==========
function openPasswordDialog() {
  passwordForm.oldPassword = ''
  passwordForm.password = ''
  passwordForm.confirmPassword = ''
  passwordVisible.value = true
}

function closePasswordDialog() {
  passwordVisible.value = false
}

async function handleUpdatePassword() {
  if (!passwordForm.oldPassword) {
    message.error('请输入当前密码')
    return
  }
  if (passwordForm.password.length < 8 || passwordForm.password.length > 32) {
    message.error('密码长度为 8-32 个字符')
    return
  }
  if (passwordForm.password !== passwordForm.confirmPassword) {
    message.error('两次输入的新密码不一致')
    return
  }

  pwdLoading.value = true
  try {
    await updatePassword({
      oldPassword: passwordForm.oldPassword,
      password: passwordForm.password,
    })
    message.success('密码修改成功')
    passwordVisible.value = false
  } catch {
    // handled by interceptor
  } finally {
    pwdLoading.value = false
  }
}

// ========== 注销用户 ==========
const cancelVisible = ref(false)

// 传给 CancelAccountModal 的手机号（完整），优先取 unmasked 数据，否则取 masked 数据
const cancelPhone = computed(() => {
  return unmaskedData.value?.phone || maskedData.value?.phone || ''
})

async function handleCancelSuccess() {
  cancelVisible.value = false
  close() // 关闭个人信息弹窗
  await userStore.signOut()
  message.success('账号已注销')
  router.push('/login')
}
</script>

<template>
  <!-- ========== 个人信息弹窗 ========== -->
  <a-modal
    :open="visible"
    :footer="null"
    :width="480"
    :closable="false"
    :destroy-on-close="true"
    wrap-class-name="profile-modal-wrap"
    @cancel="close()"
  >
    <!-- 标题栏 -->
    <div class="modal-header">
      <span class="modal-title">个人信息</span>
      <button class="close-btn" @click="close()" title="关闭">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </button>
    </div>

    <!-- 头像 -->
    <div class="avatar-section">
      <div class="avatar">{{ avatarLetter }}</div>
    </div>

    <!-- 查看模式 — 字段列表 -->
    <div v-if="!isEditing" class="fields-section">
      <div class="field-row">
        <span class="field-label">用户 ID</span>
        <span class="field-value">{{ profile?.userId ?? '-' }}</span>
      </div>
      <div class="field-row">
        <span class="field-label">用户名</span>
        <span class="field-value">{{ profile?.username ?? '-' }}</span>
      </div>
      <div class="field-row">
        <span class="field-label">昵&emsp;称</span>
        <span class="field-value">{{ profile?.nickname || '-' }}</span>
      </div>
      <div class="field-row" :class="{ masked: maskState === 'masked' }">
        <span class="field-label">邮&emsp;箱</span>
        <span class="field-value">{{ profile?.email || '-' }}</span>
      </div>
      <div class="field-row" :class="{ masked: maskState === 'masked' }">
        <span class="field-label">手机号</span>
        <span class="field-value">{{ profile?.phone || '-' }}</span>
      </div>
    </div>

    <!-- 编辑模式 — 字段列表 -->
    <div v-else class="fields-section">
      <div class="field-row">
        <span class="field-label">用户 ID</span>
        <span class="field-value disabled">{{ profile?.userId ?? '-' }}（不可修改）</span>
      </div>
      <div class="field-row">
        <span class="field-label">用户名</span>
        <span class="field-value disabled">{{ profile?.username ?? '-' }}（不可修改）</span>
      </div>
      <div class="field-row">
        <span class="field-label">昵&emsp;称</span>
        <a-input
          v-model:value="form.nickname"
          class="field-input"
          placeholder="请输入昵称"
          :bordered="false"
        />
      </div>
      <div class="field-row">
        <span class="field-label">邮&emsp;箱</span>
        <a-input
          v-model:value="form.email"
          class="field-input"
          placeholder="请输入邮箱"
          :bordered="false"
        />
      </div>
      <div class="field-row">
        <span class="field-label">手机号</span>
        <a-input
          v-model:value="form.phone"
          class="field-input"
          placeholder="请输入手机号"
          :bordered="false"
        />
      </div>
    </div>

    <!-- 遮罩切换（仅查看模式） -->
    <div v-if="!isEditing" class="mask-toggle-row">
      <button class="mask-toggle" :disabled="maskLoading" @click="toggleMask">
        <!-- 睁眼 SVG — 展示字段 -->
        <svg v-if="maskState === 'masked'" class="eye-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" stroke="currentColor" stroke-width="1.3"/>
          <circle cx="8" cy="8" r="2.5" stroke="currentColor" stroke-width="1.3"/>
        </svg>
        <!-- 闭眼 SVG — 隐藏字段 -->
        <svg v-else class="eye-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" stroke="currentColor" stroke-width="1.3"/>
          <circle cx="8" cy="8" r="2.5" stroke="currentColor" stroke-width="1.3"/>
          <line x1="2" y1="2" x2="14" y2="14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        <span>{{ maskState === 'masked' ? '展示全部字段' : '隐藏敏感字段' }}</span>
      </button>
    </div>

    <div class="divider"></div>

    <!-- 查看模式 — 底部按钮 -->
    <div v-if="!isEditing" class="modal-footer">
      <a-button type="primary" class="footer-btn" @click="enterEditMode">编辑资料</a-button>
      <a-button class="footer-btn footer-btn-secondary" @click="openPasswordDialog">修改密码</a-button>
    </div>

    <!-- 注销用户入口 — 放在偏下位置，避免误触 -->
    <div v-if="!isEditing" class="cancel-entry-row">
      <a-button type="link" danger class="cancel-entry-btn" @click="cancelVisible = true">
        注销用户
      </a-button>
    </div>

    <!-- 编辑模式 — 底部按钮 -->
    <div v-else class="modal-footer">
      <a-button class="footer-btn footer-btn-secondary" @click="cancelEdit">取 消</a-button>
      <a-button type="primary" class="footer-btn" :loading="loading" @click="handleUpdateProfile">保存修改</a-button>
    </div>
  </a-modal>

  <!-- ========== 修改密码子弹窗 ========== -->
  <a-modal
    :open="passwordVisible"
    :footer="null"
    :width="400"
    :closable="false"
    wrap-class-name="password-modal-wrap"
    @cancel="closePasswordDialog"
  >
    <h3 class="pwd-title">修改密码</h3>

    <div class="pwd-field">
      <label class="pwd-label">当前密码</label>
      <a-input-password
        v-model:value="passwordForm.oldPassword"
        placeholder="请输入当前密码"
        class="pwd-input"
      />
    </div>
    <div class="pwd-field">
      <label class="pwd-label">新密码</label>
      <a-input-password
        v-model:value="passwordForm.password"
        placeholder="8-32 位字符"
        class="pwd-input"
      />
    </div>
    <div class="pwd-field">
      <label class="pwd-label">确认新密码</label>
      <a-input-password
        v-model:value="passwordForm.confirmPassword"
        placeholder="再次输入新密码"
        class="pwd-input"
      />
    </div>

    <div class="pwd-btns">
      <a-button class="footer-btn footer-btn-secondary" @click="closePasswordDialog">取消</a-button>
      <a-button type="primary" class="footer-btn" :loading="pwdLoading" @click="handleUpdatePassword">确认修改</a-button>
    </div>
  </a-modal>

  <!-- ========== 注销用户弹窗 ========== -->
  <CancelAccountModal
    :visible="cancelVisible"
    :phone="cancelPhone"
    @close="cancelVisible = false"
    @success="handleCancelSuccess"
  />
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

// ========== 头像 ==========
.avatar-section {
  display: flex;
  justify-content: center;
  padding: 20px 0 12px;
}

.avatar {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background: linear-gradient(135deg, $color-primary 0%, #69b1ff 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 28px;
  font-weight: 600;
  box-shadow: 0 4px 12px rgba(22, 119, 255, 0.35);
  user-select: none;
}

// ========== 字段行 ==========
.fields-section {
  padding: 8px 0 0;
}

.field-row {
  display: flex;
  align-items: center;
  padding: 14px 16px;
  border-radius: 10px;
  transition: background 0.15s;
  margin-bottom: 2px;

  &:hover {
    background: $color-bg-secondary;
  }

  // 遮罩态
  &.masked .field-value {
    filter: blur(4px);
    user-select: none;
  }
}

.field-label {
  width: 72px;
  flex-shrink: 0;
  font-size: $font-size-body;
  color: $color-text-secondary;
  font-weight: 500;
}

.field-value {
  flex: 1;
  font-size: $font-size-body;
  color: $color-text-primary;

  &.disabled {
    color: #bfbfbf;
  }
}

// 编辑态输入框 — 内联样式覆盖
.field-input {
  flex: 1;

  :deep(.ant-input) {
    padding: 0;
    height: auto;
    line-height: 1.5;
    font-size: $font-size-body;
    color: $color-text-primary;
    background: transparent;
    border: none;
    border-radius: 0;
    border-bottom: 1px solid #d9d9d9;

    &:focus {
      border-bottom-color: $color-primary;
      box-shadow: none;
    }

    &::placeholder {
      color: #bfbfbf;
    }
  }
}

// ========== 遮罩切换按钮 ==========
.mask-toggle-row {
  display: flex;
  justify-content: center;
  padding: 4px 0;
}

.mask-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 16px;
  border: 1px solid #e8e8e8;
  border-radius: 20px;
  background: #fff;
  cursor: pointer;
  font-size: 13px;
  color: $color-text-secondary;
  font-family: inherit;
  transition: all 0.15s;

  &:hover {
    border-color: $color-primary;
    color: $color-primary;
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}

.eye-icon {
  flex-shrink: 0;
  color: currentColor;
}

// ========== 分割线 ==========
.divider {
  height: 1px;
  background: $color-border;
  margin: 12px 0;
}

// ========== 底部按钮 ==========
.modal-footer {
  display: flex;
  gap: 12px;
  padding: 4px 0 8px;
}

.footer-btn {
  flex: 1;
  height: 42px;
  border-radius: $radius-button;
  font-size: $font-size-body;
  font-weight: 500;
}

.footer-btn-secondary {
  border-color: #d9d9d9;
  color: $color-text-primary;

  &:hover {
    border-color: $color-primary !important;
    color: $color-primary !important;
  }
}

// ========== 密码子弹窗 ==========
.pwd-title {
  font-size: $font-size-h3;
  font-weight: 600;
  color: $color-text-primary;
  margin: 0 0 20px;
}

.pwd-field {
  margin-bottom: 16px;
}

.pwd-label {
  display: block;
  font-size: 13px;
  color: $color-text-secondary;
  margin-bottom: 6px;
}

.pwd-input {
  width: 100%;
}

.pwd-btns {
  display: flex;
  gap: 12px;
  margin-top: 20px;
}

// ========== 注销用户入口 ==========
.cancel-entry-row {
  display: flex;
  justify-content: center;
  padding: 6px 0;
}

.cancel-entry-btn {
  font-size: 13px;
  padding: 6px 12px;
  border-radius: $radius-button;

  &:hover {
    background: #fff1f0 !important;
  }
}
</style>
