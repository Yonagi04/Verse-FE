<script setup lang="ts">
import { ref, computed, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import {
  CameraOutlined, EyeOutlined, EyeInvisibleOutlined, EditOutlined, EnvironmentOutlined,
  GlobalOutlined, UserOutlined, MailOutlined, MobileOutlined, LockOutlined,
  SafetyCertificateOutlined, InfoCircleOutlined, ReloadOutlined, LoadingOutlined,
} from '@ant-design/icons-vue'
import { useUserStore } from '@/stores/user'
import { getCurrentUser, getUserInfo, updateProfile, updatePassword, uploadAvatar } from '@/api/user'
import CancelAccountModal from './CancelAccountModal.vue'
import UserAvatar from '@/components/UserAvatar.vue'
import UserPublicPreview from './UserPublicPreview.vue'
import UserProfileSummary from './UserProfileSummary.vue'
import ExternalAccountsSection from './ExternalAccountsSection.vue'
import type { UserInfoRespDTO, UserRespDTO } from '@/types/user'

const emit = defineEmits<{ (e: 'navigate', panel: string): void }>()
const router = useRouter()
const userStore = useUserStore()
const TIMEZONES = [
  'Asia/Shanghai', 'Asia/Tokyo', 'Asia/Seoul', 'Asia/Singapore', 'Asia/Hong_Kong', 'Asia/Dubai', 'Asia/Kolkata',
  'Europe/London', 'Europe/Berlin', 'Europe/Paris', 'Europe/Moscow',
  'America/New_York', 'America/Los_Angeles', 'America/Chicago', 'America/Toronto', 'Pacific/Auckland', 'Australia/Sydney',
]
const initialLoading = ref(true)
const loadFailed = ref(false)
const loading = ref(false)
const maskLoading = ref(false)
const avatarUploading = ref(false)
const isEditing = ref(false)
const unmasked = ref(false)
const profile = ref<UserRespDTO | null>(null)
const unmaskedData = ref<UserRespDTO | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)
const editNameRef = ref<{ focus: () => void } | null>(null)
const avatarName = computed(() => profile.value?.nickname || profile.value?.username || '')
const contacts = computed(() => unmasked.value ? unmaskedData.value : profile.value)
const externalBusy = ref(false)
const busy = computed(() => loading.value || avatarUploading.value || maskLoading.value || externalBusy.value)

const form = reactive({ nickname: '', email: '', phone: '', bio: '', region: '', timezone: undefined as string | undefined })
const timezoneOptions = computed(() => [...new Set([...TIMEZONES, ...(form.timezone ? [form.timezone] : [])])].map(value => ({ value, label: value })))

async function loadProfile() {
  if (!initialLoading.value) initialLoading.value = true
  loadFailed.value = false
  try {
    profile.value = await getCurrentUser(true)
  } catch {
    loadFailed.value = true
    // handled by interceptor
  } finally {
    initialLoading.value = false
  }
}
void loadProfile()

async function ensureUnmasked() {
  if (unmaskedData.value) return true
  if (maskLoading.value) return false
  maskLoading.value = true
  try {
    unmaskedData.value = await getCurrentUser(false)
    return true
  } catch {
    // handled by interceptor
    return false
  } finally {
    maskLoading.value = false
  }
}
async function toggleMask() {
  if (busy.value) return
  if (unmasked.value) unmasked.value = false
  else if (await ensureUnmasked()) unmasked.value = true
}
async function enterEditMode() {
  if (isEditing.value) { editNameRef.value?.focus(); return }
  if (busy.value || !(await ensureUnmasked()) || !unmaskedData.value) return
  const data = unmaskedData.value
  Object.assign(form, { nickname: data.nickname || '', email: data.email || '', phone: data.phone || '', bio: data.bio || '', region: data.region || '', timezone: data.timezone || undefined })
  unmasked.value = false
  isEditing.value = true
}
function cancelEdit() { if (!loading.value) isEditing.value = false }
function confirmLeave() {
  if (loading.value || avatarUploading.value || externalBusy.value) return false
  return !isEditing.value || window.confirm('有尚未保存的资料，确定离开编辑吗？')
}
defineExpose({ confirmLeave })

async function handleUpdateProfile() {
  if (busy.value) return
  loading.value = true
  try {
    await updateProfile({ nickname: form.nickname, email: form.email, phone: form.phone, bio: form.bio, region: form.region, timezone: form.timezone || '' })
    isEditing.value = false
    unmasked.value = false
    unmaskedData.value = null
    message.success('个人信息更新成功')
    await Promise.all([loadProfile(), userStore.fetchProfile()])
  } catch {
    // handled by interceptor
  } finally {
    loading.value = false
  }
}
function triggerFilePicker() { if (!busy.value) fileInputRef.value?.click() }
async function handleAvatarChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file || busy.value) { input.value = ''; return }
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
    message.error('头像格式不支持，仅允许 PNG、JPG、WebP'); input.value = ''; return
  }
  if (file.size > 5 * 1024 * 1024) {
    message.error('头像文件大小不能超过 5MB'); input.value = ''; return
  }
  avatarUploading.value = true
  try {
    const url = await uploadAvatar(file)
    if (profile.value) profile.value.avatar = url
    if (unmaskedData.value) unmaskedData.value.avatar = url
    await userStore.fetchProfile()
    message.success('头像上传成功')
  } catch {
    // handled by interceptor
  } finally {
    avatarUploading.value = false
    input.value = ''
  }
}

const previewVisible = ref(false)
const previewLoading = ref(false)
const previewFailed = ref(false)
const previewProfile = ref<UserInfoRespDTO | null>(null)
let previewRequest = 0
async function loadPreview() {
  if (!profile.value) return
  const request = ++previewRequest
  previewLoading.value = true
  previewFailed.value = false
  previewProfile.value = null
  try {
    const data = await getUserInfo(profile.value.userId)
    if (request === previewRequest) previewProfile.value = data
  } catch {
    if (request === previewRequest) previewFailed.value = true
    // handled by interceptor
  } finally {
    if (request === previewRequest) previewLoading.value = false
  }
}
function openPreview() { previewVisible.value = true; void loadPreview() }
function closePreview() { previewVisible.value = false; previewRequest++; previewLoading.value = false }
function manageVisibility() { closePreview(); emit('navigate', 'privacy') }

const passwordVisible = ref(false)
const pwdLoading = ref(false)
const passwordForm = reactive({ oldPassword: '', password: '', confirmPassword: '' })
function openPasswordDialog() {
  Object.assign(passwordForm, { oldPassword: '', password: '', confirmPassword: '' })
  passwordVisible.value = true
}
function closePasswordDialog() { if (!pwdLoading.value) passwordVisible.value = false }
async function handleUpdatePassword() {
  if (pwdLoading.value) return
  if (!passwordForm.oldPassword) { message.error('请输入当前密码'); return }
  if (passwordForm.password.length < 8 || passwordForm.password.length > 32) { message.error('密码长度为 8-32 个字符'); return }
  if (passwordForm.password !== passwordForm.confirmPassword) { message.error('两次输入的新密码不一致'); return }
  pwdLoading.value = true
  try {
    await updatePassword({ oldPassword: passwordForm.oldPassword, password: passwordForm.password })
    message.success('密码修改成功')
    passwordVisible.value = false
    Object.assign(passwordForm, { oldPassword: '', password: '', confirmPassword: '' })
  } catch {
    // handled by interceptor
  } finally {
    pwdLoading.value = false
  }
}
const cancelVisible = ref(false)
const cancelPhone = computed(() => unmaskedData.value?.phone || '')
async function openCancelAccount() {
  if (busy.value) return
  if (await ensureUnmasked()) cancelVisible.value = true
}
async function handleCancelSuccess() {
  cancelVisible.value = false
  isEditing.value = false
  await userStore.signOut()
  message.success('账号已注销')
  await router.push('/login')
}
</script>

<template>
  <div class="profile-panel">
    <section v-if="initialLoading" class="profile-card loading-card" aria-busy="true" aria-label="正在加载个人资料">
      <a-skeleton-avatar :size="80" shape="circle" />
      <a-skeleton :paragraph="{ rows: 3 }" />
      <p class="caption">正在加载个人资料…</p>
    </section>
    <section v-else-if="loadFailed || !profile" class="profile-card state-card">
      <InfoCircleOutlined /><h3>个人资料暂时无法加载</h3>
      <p>请检查网络后重试，你的资料不会因此丢失。</p>
      <a-button type="primary" @click="loadProfile"><ReloadOutlined />重新加载</a-button>
    </section>
    <template v-else>
      <section class="profile-card hero" aria-label="个人身份">
        <div class="hero-main">
          <button type="button" class="avatar-button" :disabled="busy" aria-label="更换头像，支持 PNG、JPG、WebP，不超过 5MB"
            title="更换头像 · PNG / JPG / WebP，最大 5MB" @click="triggerFilePicker">
            <UserAvatar :src="profile.avatar" :name="avatarName" :size="80" />
            <span class="camera-badge"><LoadingOutlined v-if="avatarUploading" /><CameraOutlined v-else /></span>
          </button>
          <div class="hero-identity">
            <div class="hero-name">{{ avatarName }}</div><div class="hero-handle">@{{ profile.username }}</div>
            <div class="hero-meta">
              <span v-if="profile.region"><EnvironmentOutlined />{{ profile.region }}</span>
              <span v-if="profile.timezone"><GlobalOutlined />{{ profile.timezone }}</span>
              <span v-if="!profile.region && !profile.timezone">完善个人资料，让协作更有温度。</span>
            </div>
          </div>
          <div class="hero-actions">
            <a-button @click="openPreview"><EyeOutlined />公开资料预览</a-button>
            <a-button v-if="!isEditing" type="primary" :loading="maskLoading" :disabled="busy" @click="enterEditMode"><EditOutlined />编辑资料</a-button>
          </div>
        </div>
        <div class="hero-footer">
          <span class="caption"><UserOutlined />个人账户 · 用户 ID <span class="mono">{{ profile.userId }}</span></span>
          <span class="caption">资料在所有租户中共享</span>
        </div>
      </section>
      <input ref="fileInputRef" type="file" accept="image/png,image/jpeg,image/webp" hidden @change="handleAvatarChange" />
      <div class="profile-columns">
        <div v-if="!isEditing" class="main-cards">
          <section class="profile-card"><div class="card-body">
            <div class="card-head"><div><h3>个人资料</h3><p>介绍自己，让每一次协作更顺畅。</p></div><a-button type="link" class="text-button" :disabled="busy" @click="enterEditMode">编辑 <EditOutlined /></a-button></div>
            <span class="bio-label">个人简介</span>
            <p class="bio-text" :class="{ muted: !profile.bio }">{{ profile.bio || '还没有个人简介。可以写下你的工作方向、兴趣，或正在探索的事情。' }}</p>
            <dl class="detail-grid about-details">
              <div><dt><EnvironmentOutlined />地区</dt><dd>{{ profile.region || '未设置' }}</dd></div>
              <div><dt><GlobalOutlined />时区</dt><dd>{{ profile.timezone || '未设置' }}</dd></div>
            </dl>
          </div></section>
          <section class="profile-card"><div class="card-body">
            <div class="card-head"><div><h3>联系方式</h3><p>用于账户联系与找回密码。</p></div>
              <a-button type="link" class="text-button" :loading="maskLoading" :disabled="busy" @click="toggleMask"><EyeInvisibleOutlined v-if="unmasked" /><EyeOutlined v-else />{{ unmasked ? '隐藏敏感字段' : '展示全部字段' }}</a-button>
            </div>
            <dl class="detail-grid contact-details">
              <div><dt><MailOutlined />邮箱</dt><dd>{{ contacts?.email || '未设置' }}</dd></div>
              <div><dt><MobileOutlined />手机号</dt><dd>{{ contacts?.phone || '未设置' }}</dd></div>
            </dl>
            <p class="notice"><LockOutlined />{{ unmasked ? '联系方式仅你自己可见，不影响公开资料的可见性。' : '敏感信息默认脱敏展示，点击上方按钮查看完整内容。' }}</p>
          </div></section>
          <section class="profile-card"><div class="card-body">
            <div class="card-head"><div><h3>账户安全</h3><p>管理密码与登录设备，掌握账户访问情况。</p></div><SafetyCertificateOutlined /></div>
            <div class="security-rows">
              <div class="security-row"><div><strong>登录密码</strong><p>使用独立密码，避免与其他平台共用。</p></div><a-button :disabled="busy" @click="openPasswordDialog">修改密码</a-button></div>
              <div class="security-row"><div><strong>设备与登录活动</strong><p>查看已登录的设备与最近的登录记录。</p></div><a-button @click="emit('navigate', 'devices')">管理设备</a-button></div>
            </div>
            <div class="account-danger"><div><strong>注销账户</strong><p>注销前请确认租户归属与数据处理情况。</p></div><a-button danger :disabled="busy" @click="openCancelAccount">注销用户</a-button></div>
          </div></section>
        </div>
        <a-form v-else class="profile-card form-card" :model="form" layout="vertical" :disabled="loading" @finish="handleUpdateProfile">
          <div class="edit-heading"><div><h2>编辑个人资料</h2><p>头像可点击更换。其他资料将在保存后更新。</p></div><a-tag>编辑中</a-tag></div>
          <section class="form-section"><h3>基本信息</h3><div class="form-grid">
            <a-form-item label="用户名"><a-input :value="profile.username" readonly /><span class="field-help">用户名不可修改</span></a-form-item>
            <a-form-item label="用户 ID"><a-input :value="profile.userId" readonly class="mono" /><span class="field-help">账户的唯一标识，不可修改</span></a-form-item>
            <a-form-item label="昵称" name="nickname"><a-input ref="editNameRef" v-model:value="form.nickname" placeholder="你希望大家如何称呼你" /></a-form-item>
            <a-form-item label="地区" name="region"><a-input v-model:value="form.region" placeholder="如：中国 · 上海" /></a-form-item>
            <a-form-item label="个人简介" name="bio" class="full" :rules="[{ max: 255, message: '简介长度不能超过255个字符' }]">
              <a-textarea v-model:value="form.bio" :maxlength="255" class="bio-input" placeholder="介绍一下你的工作、兴趣或正在探索的事情…" />
              <div class="field-extra"><span>简介可能对其他成员可见，可在隐私设置中调整。</span><span>{{ form.bio.length }} / 255</span></div>
            </a-form-item>
            <a-form-item label="时区" name="timezone" class="full"><a-select v-model:value="form.timezone" :options="timezoneOptions" allow-clear show-search option-filter-prop="label" placeholder="请选择时区" /></a-form-item>
          </div></section>
          <section class="form-section"><h3>联系方式</h3><div class="form-grid">
            <a-form-item label="邮箱" name="email" :rules="[{ required: true, message: '邮箱不能为空' }, { type: 'email', message: '邮箱格式不正确' }]">
              <a-input v-model:value="form.email" type="email" placeholder="请输入邮箱" />
            </a-form-item>
            <a-form-item label="手机号" name="phone" :rules="[{ required: true, message: '手机号不能为空' }, { pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号' }]">
              <a-input v-model:value="form.phone" type="tel" placeholder="请输入手机号" />
            </a-form-item>
          </div><p class="notice"><LockOutlined />联系方式仅你自己可见，不会展示在公开名片中。</p></section>
          <div class="form-footer"><a-button :disabled="loading" @click="cancelEdit">取消</a-button><a-button type="primary" html-type="submit" :loading="loading" :disabled="busy">保存修改</a-button></div>
        </a-form>
        <UserProfileSummary :profile="profile" :busy="busy" @edit="enterEditMode" @avatar="triggerFilePicker" @navigate="emit('navigate', $event)" />
      </div>
      <ExternalAccountsSection :disabled="busy || passwordVisible || cancelVisible" :before-leave="confirmLeave" @busy="externalBusy = $event" @navigate="emit('navigate', $event)" />
    </template>
    <a-modal :open="previewVisible" :footer="null" :width="440" :closable="false" @cancel="closePreview">
      <div class="profile-dialog">
        <div class="dialog-heading"><h3>公开资料预览</h3><button type="button" class="dialog-close" aria-label="关闭" @click="closePreview">×</button></div>
        <p class="caption">这是其他成员查看你的资料时看到的内容。</p>
        <div v-if="previewLoading" class="preview-loading"><a-spin /></div>
        <div v-else-if="previewFailed" class="state-card"><p>公开资料暂时无法加载</p><a-button @click="loadPreview">重新加载</a-button></div>
        <UserPublicPreview v-else-if="previewProfile" :profile="previewProfile" />
        <div class="dialog-actions"><a-button @click="closePreview">关闭</a-button><a-button type="primary" :disabled="busy" @click="manageVisibility">管理可见性</a-button></div>
      </div>
    </a-modal>
    <a-modal :open="passwordVisible" :footer="null" :width="440" :closable="false" :mask-closable="!pwdLoading" :keyboard="!pwdLoading" @cancel="closePasswordDialog">
      <div class="profile-dialog">
        <div class="dialog-heading"><h3>修改密码</h3><button type="button" class="dialog-close" :disabled="pwdLoading" aria-label="关闭" @click="closePasswordDialog">×</button></div>
        <a-form layout="vertical" :model="passwordForm" :disabled="pwdLoading" @finish="handleUpdatePassword">
          <a-form-item label="当前密码" name="oldPassword" :rules="[{ required: true, message: '请输入当前密码' }]"><a-input-password v-model:value="passwordForm.oldPassword" autocomplete="current-password" placeholder="请输入当前密码" /></a-form-item>
          <a-form-item label="新密码" name="password" :rules="[{ required: true, message: '请输入新密码' }, { min: 8, max: 32, message: '密码长度为 8-32 个字符' }]"><a-input-password v-model:value="passwordForm.password" autocomplete="new-password" placeholder="8–32 个字符" /></a-form-item>
          <a-form-item label="确认新密码" name="confirmPassword" :rules="[{ required: true, message: '请再次输入新密码' }]"><a-input-password v-model:value="passwordForm.confirmPassword" autocomplete="new-password" placeholder="再次输入新密码" /></a-form-item>
          <div class="dialog-actions"><a-button :disabled="pwdLoading" @click="closePasswordDialog">取消</a-button><a-button type="primary" html-type="submit" :loading="pwdLoading">确认修改</a-button></div>
        </a-form>
      </div>
    </a-modal>
    <CancelAccountModal :visible="cancelVisible" :phone="cancelPhone" @close="cancelVisible = false" @success="handleCancelSuccess" />
  </div>
</template>

<style lang="scss" scoped>
@use './user-center';
.hero { margin-bottom: 20px; }
.hero-main { display: flex; gap: 20px; align-items: center; padding: 28px 24px; }
.avatar-button {
  border: 0; background: transparent; border-radius: 50%; padding: 0; position: relative; flex-shrink: 0; cursor: pointer;
  &:focus-visible { outline: 2px solid $color-primary; outline-offset: 3px; }
  &:disabled { cursor: not-allowed; opacity: 0.55; }
  &:hover .camera-badge { color: $color-primary; }
}
.camera-badge { width: 26px; height: 26px; position: absolute; right: -1px; bottom: 0; border: 2px solid $color-bg; background: $color-bg-secondary; border-radius: 50%; display: grid; place-items: center; color: $color-text-secondary; box-shadow: $shadow-light; font-size: 14px; }
.hero-identity { flex: 1; min-width: 0; }
.hero-name { font-size: $font-size-title; font-weight: 600; overflow-wrap: anywhere; line-height: 1.4; }
.hero-handle { margin-top: 5px; font-size: 13px; color: $color-text-secondary; overflow-wrap: anywhere; }
.hero-meta {
  display: flex; flex-wrap: wrap; gap: 8px 18px; margin-top: 12px; color: $color-text-secondary; font-size: $font-size-caption;
  span { display: flex; gap: 6px; align-items: center; }
  .anticon { font-size: 14px; flex-shrink: 0; }
}
.hero-actions { display: flex; gap: 8px; align-items: center; }
.hero-footer {
  display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 12px 24px; border-top: 1px solid $color-border; background: $color-bg-secondary;
  > span { display: flex; gap: 7px; align-items: center; flex-wrap: wrap; }
  .anticon { font-size: 14px; }
}
.profile-columns { display: grid; grid-template-columns: minmax(0, 1fr) 280px; gap: 20px; align-items: start; }
.main-cards { display: flex; flex-direction: column; gap: 20px; min-width: 0; }
.bio-label { display: block; font-size: $font-size-caption; color: $color-text-secondary; margin-bottom: 10px; }
.bio-text { margin: 0; font-size: $font-size-body; line-height: 1.9; white-space: pre-wrap; overflow-wrap: anywhere; }
.detail-grid {
  display: grid; grid-template-columns: 1fr 1fr; gap: 22px 24px;
  dt { display: flex; gap: 7px; align-items: center; font-size: $font-size-caption; color: $color-text-secondary; margin-bottom: 8px; }
  dt .anticon { font-size: 15px; }
  dd { margin: 0; line-height: 1.6; overflow-wrap: anywhere; }
}
.about-details { padding-top: 20px; margin: 22px 0 0; border-top: 1px solid $color-border; }
.contact-details { margin: 0; }
.security-row {
  display: flex; justify-content: space-between; align-items: center; gap: 16px; padding: 16px 0;
  & + & { border-top: 1px solid $color-border; }
  strong { display: block; font-weight: 500; }
  p { font-size: $font-size-caption; color: $color-text-secondary; margin: 5px 0 0; line-height: 1.7; }
}
.security-rows { margin: -8px 0; }
.account-danger {
  margin-top: 20px; padding-top: 20px; border-top: 1px solid $color-border; display: flex; justify-content: space-between; align-items: center; gap: 16px;
  strong { font-size: 13px; font-weight: 500; }
  p { font-size: $font-size-caption; margin: 5px 0 0; color: $color-text-secondary; line-height: 1.7; }
}
.form-card { padding: 24px; min-width: 0; }
.edit-heading {
  display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 24px;
  h2 { margin: 0; font-size: $font-size-h2; font-weight: 600; }
  p { margin: 6px 0 0; color: $color-text-secondary; font-size: $font-size-caption; line-height: 1.6; }
  :deep(.ant-tag) { margin: 0; }
}
.form-section {
  & + & { border-top: 1px solid $color-border; margin-top: 24px; padding-top: 24px; }
  h3 { margin: 0 0 20px; font-size: $font-size-h3; font-weight: 600; }
}
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 22px 24px; }
.form-grid :deep(.ant-form-item) { margin: 0; min-width: 0; }
.form-grid .full { grid-column: 1 / -1; }
.form-card, .profile-dialog {
  :deep(.ant-form-item-label > label) { font-size: 13px; font-weight: 500; }
  :deep(.ant-form-item-label) { padding-bottom: 8px; }
  :deep(.ant-input), :deep(.ant-input-affix-wrapper) { min-height: 40px; border-radius: $radius-input; }
  :deep(.ant-input-affix-wrapper .ant-input) { min-height: 0; }
}
.form-card {
  :deep(.ant-input[readonly]) { background: $color-bg-secondary; color: $color-text-secondary; border-color: $color-border; }
  :deep(.ant-select) { width: 100%; height: 40px; }
  :deep(.ant-select-selector) { border-radius: $radius-input; }
  :deep(.ant-select-single .ant-select-selector) { height: 40px; align-items: center; }
  :deep(.ant-select-single .ant-select-selection-item),
  :deep(.ant-select-single .ant-select-selection-placeholder),
  :deep(.ant-select-single .ant-select-selector::after) { line-height: 38px; }
  :deep(.ant-select-single .ant-select-selection-search-input) { height: 38px; }
  :deep(textarea.bio-input) { height: 104px; min-height: 104px; max-height: 104px; resize: none; overflow-y: auto; line-height: 1.7; }
}
.field-help { display: block; margin-top: 8px; font-size: $font-size-caption; color: $color-text-secondary; }
.field-extra { display: flex; justify-content: space-between; gap: 8px; margin-top: 8px; font-size: $font-size-caption; color: $color-text-secondary; > :last-child { white-space: nowrap; } }
.form-footer { display: flex; justify-content: flex-end; gap: 10px; margin: 24px -24px -24px; padding: 16px 24px; background: $color-bg-secondary; border-top: 1px solid $color-border; }
.loading-card { padding: 28px; :deep(.ant-skeleton-avatar) { margin-bottom: 24px; } }
.dialog-heading {
  display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; gap: 16px;
  h3 { margin: 0; font-size: $font-size-h3; font-weight: 600; }
}
.dialog-close { width: 32px; height: 32px; padding: 0; background: transparent; color: $color-text-secondary; border: 0; border-radius: $radius-button; font-size: 24px; cursor: pointer; &:focus-visible { outline: 2px solid $color-primary; } }
.dialog-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 22px; }
.preview-loading { display: grid; place-items: center; min-height: 160px; }
@container profile (max-width: 820px) {
  .profile-columns { grid-template-columns: minmax(0, 1fr); }
  .hero-actions { flex-direction: column; align-items: stretch; }
}
@container profile (max-width: 540px) {
  .hero-main { flex-wrap: wrap; padding: 24px 20px; gap: 16px; }
  .hero-actions { width: 100%; flex-direction: row; justify-content: flex-end; }
  .hero-footer { padding: 12px 20px; flex-wrap: wrap; }
  .form-card { padding: 20px; }
  .detail-grid, .form-grid { grid-template-columns: minmax(0, 1fr); }
  .hero-name { font-size: $font-size-h2; }
  .hero-identity { flex-basis: calc(100% - 96px); }
  .security-row, .account-danger { align-items: flex-start; flex-wrap: wrap; }
  .form-footer { margin: 24px -20px -20px; padding: 16px 20px; }
}
@media (max-width: 400px) {
  .hero-actions :deep(.ant-btn) { flex: 1; }
  .hero-footer .mono { font-size: 11px; }
}
</style>
