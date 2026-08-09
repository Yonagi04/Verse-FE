<script setup lang="ts">
import { ref, computed, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { CameraOutlined, EyeOutlined, EyeInvisibleOutlined } from '@ant-design/icons-vue'
import { useUserStore } from '@/stores/user'
import { getCurrentUser, updateProfile, updatePassword, uploadAvatar } from '@/api/user'
import CancelAccountModal from './CancelAccountModal.vue'
import type { UserRespDTO } from '@/types/user'

const router = useRouter()
const userStore = useUserStore()

// ========== Constants ==========
const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp']
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const TIMEZONE_OPTIONS = [
  'Asia/Shanghai', 'Asia/Tokyo', 'Asia/Seoul', 'Asia/Singapore',
  'Asia/Hong_Kong', 'Asia/Dubai', 'Asia/Kolkata',
  'Europe/London', 'Europe/Berlin', 'Europe/Paris', 'Europe/Moscow',
  'America/New_York', 'America/Los_Angeles', 'America/Chicago', 'America/Toronto',
  'Pacific/Auckland', 'Australia/Sydney',
]

// ========== Data State ==========
const loading = ref(false)
const pwdLoading = ref(false)
const isEditing = ref(false)
const maskState = ref<'masked' | 'unmasked'>('masked')
const maskedData = ref<UserRespDTO | null>(null)
const unmaskedData = ref<UserRespDTO | null>(null)
const maskLoading = ref(false)
const avatarUploading = ref(false)

const profile = computed(() =>
  maskState.value === 'masked' ? maskedData.value : unmaskedData.value
)

// ========== Avatar ==========
const avatarUrl = ref<string | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)

const avatarLetter = computed(() => {
  const name = profile.value?.nickname || profile.value?.username || ''
  return name.charAt(0).toUpperCase()
})

const hasAvatar = computed(() => !!avatarUrl.value)

function triggerFilePicker() {
  fileInputRef.value?.click()
}

async function handleAvatarChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  // Type validation
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    message.error('头像格式不支持，仅允许 PNG、JPG、WebP')
    input.value = ''
    return
  }

  // Size validation
  if (file.size > MAX_FILE_SIZE) {
    message.error('头像文件大小不能超过 5MB')
    input.value = ''
    return
  }

  avatarUploading.value = true
  try {
    const url = await uploadAvatar(file)
    avatarUrl.value = url
    message.success('头像上传成功')
  } catch {
    // handled by interceptor
  } finally {
    avatarUploading.value = false
    input.value = ''
  }
}

// ========== Edit Form ==========
const form = reactive({
  nickname: '',
  email: '',
  phone: '',
  bio: '',
  region: '',
  timezone: '',
  showBio: true,
  showRegion: false,
  showTimezone: true,
})

// ========== Password Form ==========
const passwordVisible = ref(false)
const passwordForm = reactive({
  oldPassword: '',
  password: '',
  confirmPassword: '',
})

// ========== Cancel Account ==========
const cancelVisible = ref(false)

const cancelPhone = computed(() => {
  return unmaskedData.value?.phone || maskedData.value?.phone || ''
})

// ========== Load Data ==========
async function loadProfile(mask: boolean) {
  try {
    if (mask) {
      maskedData.value = await getCurrentUser(true)
      // Sync avatar from loaded data
      if (maskedData.value?.avatar) {
        avatarUrl.value = maskedData.value.avatar
      }
    } else {
      maskLoading.value = true
      unmaskedData.value = await getCurrentUser(false)
      if (unmaskedData.value?.avatar) {
        avatarUrl.value = unmaskedData.value.avatar
      }
    }
  } catch {
    // handled by interceptor
  } finally {
    maskLoading.value = false
  }
}

// Initial load
loadProfile(true)

// ========== Mask Toggle ==========
async function toggleMask() {
  if (maskState.value === 'masked') {
    if (!unmaskedData.value) {
      await loadProfile(false)
    }
    maskState.value = 'unmasked'
  } else {
    maskState.value = 'masked'
  }
}

// ========== Edit Mode ==========
async function enterEditMode() {
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

  const u = unmaskedData.value
  form.nickname = u.nickname || ''
  form.email = u.email || ''
  form.phone = u.phone || ''
  form.bio = u.bio || ''
  form.region = u.region || ''
  form.timezone = u.timezone || ''
  form.showBio = u.privacy?.showBio ?? true
  form.showRegion = u.privacy?.showRegion ?? false
  form.showTimezone = u.privacy?.showTimezone ?? true

  isEditing.value = true
}

function cancelEdit() {
  isEditing.value = false
}

async function handleUpdateProfile() {
  loading.value = true
  try {
    await updateProfile({
      nickname: form.nickname,
      email: form.email,
      phone: form.phone,
      bio: form.bio,
      region: form.region,
      timezone: form.timezone,
    })
    message.success('个人信息更新成功')
    isEditing.value = false
    await Promise.all([loadProfile(true), loadProfile(false)])
    await userStore.fetchProfile()
  } catch {
    // handled by interceptor
  } finally {
    loading.value = false
  }
}

// ========== Password ==========
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

// ========== Cancel Account ==========
async function handleCancelSuccess() {
  cancelVisible.value = false
  await userStore.signOut()
  message.success('账号已注销')
  router.push('/login')
}
</script>

<template>
  <div class="profile-panel">
    <!-- Avatar Area -->
    <div class="avatar-section">
      <div
        class="avatar-wrapper"
        :class="{ uploading: avatarUploading }"
        @click="triggerFilePicker"
      >
        <img v-if="hasAvatar" :src="avatarUrl!" class="avatar-img" alt="avatar" />
        <span v-else class="avatar-letter">{{ avatarLetter }}</span>
        <div class="avatar-overlay">
          <CameraOutlined class="camera-icon" />
          <span class="overlay-text">更换头像</span>
        </div>
      </div>
      <input
        ref="fileInputRef"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        class="file-hidden"
        @change="handleAvatarChange"
    </div>

    <!-- View Mode -->
    <template v-if="!isEditing">
      <!-- User Summary Row -->
      <div class="summary-row">
        <div class="summary-name">{{ profile?.nickname || profile?.username || '-' }}</div>
        <div class="summary-meta">
          <span class="summary-username">@{{ profile?.username }}</span>
          <span class="summary-divider">·</span>
          <span class="summary-uid">ID: {{ profile?.userId }}</span>
        </div>
        <p v-if="profile?.bio" class="summary-bio">{{ profile.bio }}</p>
      </div>

      <!-- Fields Grid -->
      <div class="fields-grid">
        <div class="field-item">
          <span class="field-label">邮箱</span>
          <span class="field-value" :class="{ 'mask-blur': maskState === 'masked' }">
            {{ profile?.email || '暂无' }}
          </span>
        </div>
        <div class="field-item">
          <span class="field-label">手机号</span>
          <span class="field-value" :class="{ 'mask-blur': maskState === 'masked' }">
            {{ profile?.phone || '暂无' }}
          </span>
        </div>
        <div class="field-item">
          <span class="field-label">地区</span>
          <span class="field-value">{{ profile?.region || '未设置' }}</span>
        </div>
        <div class="field-item">
          <span class="field-label">时区</span>
          <span class="field-value">{{ profile?.timezone || '未设置' }}</span>
        </div>
      </div>

      <!-- Mask Toggle -->
      <div class="mask-toggle-row">
        <button class="mask-toggle-btn" :disabled="maskLoading" @click="toggleMask">
          <EyeInvisibleOutlined v-if="maskState === 'masked'" class="eye-icon" />
          <EyeOutlined v-else class="eye-icon" />
          <span>{{ maskState === 'masked' ? '展示全部字段' : '隐藏敏感字段' }}</span>
        </button>
      </div>

      <!-- Action Buttons -->
      <div class="divider-line"></div>
      <div class="action-row">
        <a-button type="primary" @click="enterEditMode">编辑资料</a-button>
        <a-button @click="openPasswordDialog">修改密码</a-button>
      </div>
      <div class="cancel-row">
        <a-button type="link" danger @click="cancelVisible = true">注销用户</a-button>
      </div>
    </template>

    <!-- Edit Mode -->
    <template v-else>
      <div class="fields-grid edit-mode">
        <div class="field-item">
          <span class="field-label">用户 ID</span>
          <span class="field-value readonly">{{ profile?.userId ?? '-' }}（不可修改）</span>
        </div>
        <div class="field-item">
          <span class="field-label">用户名</span>
          <span class="field-value readonly">{{ profile?.username ?? '-' }}（不可修改）</span>
        </div>
        <div class="field-item">
          <span class="field-label">昵称</span>
          <a-input v-model:value="form.nickname" class="field-input" placeholder="请输入昵称" />
        </div>
        <div class="field-item">
          <span class="field-label">邮箱</span>
          <a-input v-model:value="form.email" class="field-input" placeholder="请输入邮箱" />
        </div>
        <div class="field-item">
          <span class="field-label">手机号</span>
          <a-input v-model:value="form.phone" class="field-input" placeholder="请输入手机号" />
        </div>
        <div class="field-item">
          <span class="field-label">地区</span>
          <a-input v-model:value="form.region" class="field-input" placeholder="如：北京" />
        </div>
        <div class="field-item">
          <span class="field-label">时区</span>
          <a-select
            v-model:value="form.timezone"
            class="field-select"
            placeholder="请选择时区"
            show-search
            :filter-option="(input: string, option: any) => option.value.toLowerCase().includes(input.toLowerCase())"
            :options="TIMEZONE_OPTIONS.map(tz => ({ value: tz, label: tz }))"
          />
        </div>
        <div class="field-item field-bio">
          <span class="field-label">个人简介</span>
          <a-textarea
            v-model:value="form.bio"
            class="field-textarea"
            placeholder="介绍一下自己..."
            :maxlength="255"
            :rows="3"
            show-count
          />
        </div>
      </div>

      <!-- Privacy Switches (in edit mode) -->
      <div class="privacy-switches">
        <div class="privacy-row">
          <div class="privacy-info">
            <span class="privacy-label">公开展示个人简介</span>
            <span class="privacy-desc">允许其他用户在你的公开资料中查看个人简介</span>
          </div>
          <a-switch v-model:checked="form.showBio" />
        </div>
        <div class="privacy-row">
          <div class="privacy-info">
            <span class="privacy-label">公开展示地区</span>
            <span class="privacy-desc">允许其他用户在你的公开资料中查看地区</span>
          </div>
          <a-switch v-model:checked="form.showRegion" />
        </div>
        <div class="privacy-row">
          <div class="privacy-info">
            <span class="privacy-label">公开展示时区</span>
            <span class="privacy-desc">允许其他用户在你的公开资料中查看时区</span>
          </div>
          <a-switch v-model:checked="form.showTimezone" />
        </div>
      </div>

      <!-- Edit Action Buttons -->
      <div class="action-row">
        <a-button @click="cancelEdit">取消</a-button>
        <a-button type="primary" :loading="loading" @click="handleUpdateProfile">保存</a-button>
      </div>
    </template>

    <!-- Password Change Sub-modal -->
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
        <a-input-password v-model:value="passwordForm.oldPassword" placeholder="请输入当前密码" />
      </div>
      <div class="pwd-field">
        <label class="pwd-label">新密码</label>
        <a-input-password v-model:value="passwordForm.password" placeholder="8-32 位字符" />
      </div>
      <div class="pwd-field">
        <label class="pwd-label">确认新密码</label>
        <a-input-password v-model:value="passwordForm.confirmPassword" placeholder="再次输入新密码" />
      </div>
      <div class="pwd-btns">
        <a-button @click="closePasswordDialog">取消</a-button>
        <a-button type="primary" :loading="pwdLoading" @click="handleUpdatePassword">确认修改</a-button>
      </div>
    </a-modal>

    <!-- Cancel Account Modal -->
    <CancelAccountModal
      :visible="cancelVisible"
      :phone="cancelPhone"
      @close="cancelVisible = false"
      @success="handleCancelSuccess"
    />
  </div>
</template>

<style lang="scss" scoped>
.profile-panel {
  // full width
}

// ========== Avatar ==========
.avatar-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-bottom: 24px;
}

.avatar-wrapper {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  overflow: hidden;
  cursor: pointer;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, $color-primary 0%, #69b1ff 100%);

  &.uploading {
    opacity: 0.6;
    pointer-events: none;
  }

  &:hover .avatar-overlay {
    opacity: 1;
  }
}

.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-letter {
  color: #fff;
  font-size: 28px;
  font-weight: 600;
  user-select: none;
}

.avatar-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.2s;
}

.camera-icon {
  font-size: 18px;
  color: #fff;
}

.overlay-text {
  font-size: $font-size-caption;
  color: #fff;
}

.file-hidden {
  display: none;
}

.avatar-hint {
  margin-top: 8px;
  font-size: $font-size-caption;
  color: #bfbfbf;
}

// ========== Summary Row ==========
.summary-row {
  text-align: center;
  padding-bottom: 24px;
  border-bottom: 1px solid $color-border;
  margin-bottom: 24px;
}

.summary-name {
  font-size: 20px;
  font-weight: 600;
  color: $color-text-primary;
  margin-bottom: 4px;
}

.summary-meta {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  font-size: 13px;
  color: $color-text-secondary;
}

.summary-divider {
  color: #d9d9d9;
}

.summary-uid {
  color: #bfbfbf;
}

.summary-bio {
  margin: 12px 0 0;
  font-size: $font-size-body;
  color: $color-text-secondary;
  line-height: 1.6;
}

// ========== Fields Grid ==========
.fields-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px 32px;

  &.edit-mode {
    grid-template-columns: 1fr 1fr;
  }
}

.field-item {
  display: flex;
  flex-direction: column;
  gap: 4px;

  &.field-bio {
    grid-column: 1 / -1;
  }
}

.field-label {
  font-size: $font-size-caption;
  color: $color-text-secondary;
  font-weight: 500;
}

.field-value {
  font-size: $font-size-body;
  color: $color-text-primary;

  &.mask-blur {
    filter: blur(4px);
    user-select: none;
  }

  &.readonly {
    color: #bfbfbf;
  }
}

.field-input {
  :deep(.ant-input) {
    font-size: $font-size-body;
  }
}

.field-select {
  width: 100%;
  font-size: $font-size-body;
}

.field-textarea {
  font-size: $font-size-body;
}

// ========== Mask Toggle ==========
.mask-toggle-row {
  display: flex;
  justify-content: center;
  padding: 12px 0;
}

.mask-toggle-btn {
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
  font-size: 16px;
}

// ========== Privacy Switches (edit mode) ==========
.privacy-switches {
  margin-top: 24px;
  padding: 16px;
  background: $color-bg-secondary;
  border-radius: $radius-button;
}

.privacy-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 0;

  & + & {
    border-top: 1px solid $color-border;
  }
}

.privacy-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.privacy-label {
  font-size: $font-size-body;
  color: $color-text-primary;
  font-weight: 500;
}

.privacy-desc {
  font-size: $font-size-caption;
  color: $color-text-secondary;
}

// ========== Divider & Actions ==========
.divider-line {
  height: 1px;
  background: $color-border;
  margin: 4px 0 16px;
}

.action-row {
  display: flex;
  gap: 12px;

  .ant-btn {
    flex: 1;
    height: 42px;
    border-radius: $radius-button;
    font-size: $font-size-body;
    font-weight: 500;
  }
}

.cancel-row {
  display: flex;
  justify-content: center;
  padding-top: 8px;
}

// ========== Password Modal ==========
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

.pwd-btns {
  display: flex;
  gap: 12px;
  margin-top: 20px;

  .ant-btn {
    flex: 1;
    height: 42px;
    border-radius: $radius-button;
    font-size: $font-size-body;
    font-weight: 500;
  }
}
</style>
