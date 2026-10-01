<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import { SafetyCertificateOutlined, InfoCircleOutlined, ReloadOutlined } from '@ant-design/icons-vue'
import { useUserStore } from '@/stores/user'
import { getCurrentUser, updatePrivacy } from '@/api/user'
import UserPublicPreview from './UserPublicPreview.vue'
import type { PrivacySettings, UserRespDTO } from '@/types/user'

const userStore = useUserStore()
const initialLoading = ref(true)
const loadFailed = ref(false)
const saving = ref(false)
const pendingKey = ref<keyof PrivacySettings | null>(null)
const profile = ref<UserRespDTO | null>(null)
const privacy = reactive<PrivacySettings>({ showBio: false, showRegion: false, showTimezone: false })
const settings: { key: keyof PrivacySettings; label: string; description: string }[] = [
  { key: 'showBio', label: '个人简介', description: '允许其他成员了解你的工作方向与兴趣' },
  { key: 'showRegion', label: '地区', description: '允许其他成员查看你所在的地区' },
  { key: 'showTimezone', label: '时区', description: '方便跨地区团队安排沟通时间' },
]
const preview = computed(() => profile.value ? { ...profile.value, privacy: { ...privacy } } : null)
async function loadProfile() {
  initialLoading.value = true
  loadFailed.value = false
  try {
    const data = await getCurrentUser(true)
    profile.value = data
    userStore.user = data
    Object.assign(privacy, { showBio: data.privacy?.showBio !== false, showRegion: data.privacy?.showRegion !== false, showTimezone: data.privacy?.showTimezone !== false })
  } catch {
    loadFailed.value = true
    // handled by interceptor
  } finally {
    initialLoading.value = false
  }
}
onMounted(loadProfile)
async function handleToggle(key: keyof PrivacySettings, checked: boolean) {
  if (saving.value || !profile.value) return
  const previous = privacy[key]
  privacy[key] = checked
  saving.value = true
  pendingKey.value = key
  try {
    await updatePrivacy({ ...privacy })
    profile.value.privacy = { ...privacy }
    if (userStore.user) userStore.user.privacy = { ...privacy }
    message.success('隐私设置已更新')
  } catch {
    privacy[key] = previous
    // handled by interceptor
  } finally {
    saving.value = false
    pendingKey.value = null
  }
}
</script>

<template>
  <section class="profile-card panel-card">
    <div class="panel-heading"><div><h2>隐私设置</h2><p>选择哪些个人资料对其他成员可见。联系方式始终保持私密。</p></div><SafetyCertificateOutlined /></div>
    <a-skeleton v-if="initialLoading" :paragraph="{ rows: 5 }" aria-label="正在加载隐私设置" />
    <div v-else-if="loadFailed" class="state-card"><InfoCircleOutlined /><h3>隐私设置暂时无法加载</h3><a-button type="primary" @click="loadProfile"><ReloadOutlined />重新加载</a-button></div>
    <template v-else>
      <div class="privacy-list">
        <div v-for="setting in settings" :key="setting.key" class="privacy-row">
          <div><strong>公开展示{{ setting.label }}</strong><p class="caption">{{ setting.description }}</p></div>
          <a-switch :checked="privacy[setting.key]" :disabled="saving" :loading="pendingKey === setting.key" :aria-label="`公开展示${setting.label}`" @change="(checked: boolean) => handleToggle(setting.key, checked)" />
        </div>
      </div>
      <section class="preview-section">
        <h3>公开资料预览</h3><p class="caption">设置会立即生效，下方同步展示其他成员看到的内容。</p>
        <UserPublicPreview v-if="preview" :profile="preview" />
        <p class="notice"><InfoCircleOutlined />关闭字段后，该内容将从公开资料中隐藏，你仍可在个人资料中查看和编辑。</p>
      </section>
    </template>
  </section>
</template>

<style lang="scss" scoped>
@use './user-center';
.privacy-list { border: 1px solid $color-border; border-radius: $radius-input; }
.privacy-row {
  padding: 20px; display: flex; justify-content: space-between; align-items: center; gap: 20px;
  & + & { border-top: 1px solid $color-border; }
  strong { font-size: $font-size-body; font-weight: 500; display: block; margin-bottom: 5px; }
  p { margin: 0; }
  :deep(.ant-switch) { flex-shrink: 0; min-width: 40px; }
}
.preview-section {
  margin-top: 28px;
  h3 { margin: 0; font-size: $font-size-h3; font-weight: 600; }
  > p { margin-top: 5px; }
  > .notice { margin-top: 20px; }
}
@container profile (max-width: 540px) { .privacy-row { padding: 16px; } }
</style>
