<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue'
import { message } from 'ant-design-vue'
import { CheckCircleFilled, StopFilled } from '@ant-design/icons-vue'
import { useUserStore } from '@/stores/user'
import { updatePrivacy } from '@/api/user'
import type { PrivacyUpdateReqDTO } from '@/types/user'

const userStore = useUserStore()

// ========== State ==========
const loading = ref(false)
const privacy = reactive({
  showBio: true,
  showRegion: true,
  showTimezone: true,
})

// ========== User Data ==========
const userBio = computed(() => userStore.user?.bio || '暂无个人简介')
const userRegion = computed(() => userStore.user?.region || '未设置')
const userTimezone = computed(() => userStore.user?.timezone || '未设置')

// ========== Initialize ==========
onMounted(async () => {
  if (!userStore.user?.privacy) {
    await userStore.fetchProfile()
  }
  const p = userStore.user?.privacy
  if (p) {
    privacy.showBio = p.showBio
    privacy.showRegion = p.showRegion
    privacy.showTimezone = p.showTimezone
  }
})

// ========== Update Privacy ==========
async function handleToggle(key: keyof PrivacyUpdateReqDTO, checked: boolean) {
  const previous = privacy[key]
  privacy[key] = checked
  loading.value = true
  try {
    await updatePrivacy({
      showBio: privacy.showBio,
      showRegion: privacy.showRegion,
      showTimezone: privacy.showTimezone,
    })
    if (userStore.user) {
      userStore.user.privacy = {
        showBio: privacy.showBio,
        showRegion: privacy.showRegion,
        showTimezone: privacy.showTimezone,
      }
    }
    message.success('隐私设置已更新')
  } catch {
    privacy[key] = previous
    // handled by interceptor
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="privacy-panel">
    <h2 class="panel-title">隐私设置</h2>
    <p class="panel-desc">控制你的个人资料哪些字段对其他用户可见。</p>

    <!-- Toggle Switches -->
    <div class="toggle-list">
      <div class="toggle-row">
        <div class="toggle-info">
          <span class="toggle-label">公开展示个人简介</span>
          <span class="toggle-desc">允许其他用户在你的公开资料页查看个人简介</span>
        </div>
        <a-switch
          :checked="privacy.showBio"
          :loading="loading"
          @change="(checked: boolean) => handleToggle('showBio', checked)"
        />
      </div>
      <div class="toggle-row">
        <div class="toggle-info">
          <span class="toggle-label">公开展示地区</span>
          <span class="toggle-desc">允许其他用户在你的公开资料页查看地区信息</span>
        </div>
        <a-switch
          :checked="privacy.showRegion"
          :loading="loading"
          @change="(checked: boolean) => handleToggle('showRegion', checked)"
        />
      </div>
      <div class="toggle-row">
        <div class="toggle-info">
          <span class="toggle-label">公开展示时区</span>
          <span class="toggle-desc">允许其他用户在你的公开资料页查看时区信息</span>
        </div>
        <a-switch
          :checked="privacy.showTimezone"
          :loading="loading"
          @change="(checked: boolean) => handleToggle('showTimezone', checked)"
        />
      </div>
    </div>

    <!-- Public Profile Preview -->
    <div class="preview-section">
      <h3 class="preview-title">公开资料预览</h3>
      <p class="preview-desc">以下是其他用户访问你的公开资料时看到的内容</p>

      <div class="preview-card">
        <div class="preview-user">
          <span class="preview-nickname">{{ userStore.user?.nickname || userStore.user?.username }}</span>
          <span class="preview-username">@{{ userStore.user?.username }}</span>
        </div>

        <div class="preview-fields">
          <div class="preview-field">
            <CheckCircleFilled v-if="privacy.showBio" class="icon-visible" />
            <StopFilled v-else class="icon-hidden" />
            <span class="preview-field-label">个人简介</span>
            <span v-if="privacy.showBio" class="preview-field-value">{{ userBio }}</span>
            <span v-else class="preview-field-hidden">已隐藏</span>
          </div>
          <div class="preview-field">
            <CheckCircleFilled v-if="privacy.showRegion" class="icon-visible" />
            <StopFilled v-else class="icon-hidden" />
            <span class="preview-field-label">地区</span>
            <span v-if="privacy.showRegion" class="preview-field-value">{{ userRegion }}</span>
            <span v-else class="preview-field-hidden">已隐藏</span>
          </div>
          <div class="preview-field">
            <CheckCircleFilled v-if="privacy.showTimezone" class="icon-visible" />
            <StopFilled v-else class="icon-hidden" />
            <span class="preview-field-label">时区</span>
            <span v-if="privacy.showTimezone" class="preview-field-value">{{ userTimezone }}</span>
            <span v-else class="preview-field-hidden">已隐藏</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.privacy-panel {
  max-width: 560px;
}

.panel-title {
  font-size: $font-size-h2;
  font-weight: 600;
  color: $color-text-primary;
  margin: 0 0 4px;
}

.panel-desc {
  font-size: $font-size-body;
  color: $color-text-secondary;
  margin: 0 0 24px;
}

// ========== Toggle List ==========
.toggle-list {
  background: $color-bg;
  border: 1px solid $color-border;
  border-radius: $radius-card;
  overflow: hidden;
}

.toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;

  & + & {
    border-top: 1px solid $color-border;
  }
}

.toggle-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.toggle-label {
  font-size: $font-size-body;
  color: $color-text-primary;
  font-weight: 500;
}

.toggle-desc {
  font-size: $font-size-caption;
  color: $color-text-secondary;
}

// ========== Preview ==========
.preview-section {
  margin-top: 32px;
}

.preview-title {
  font-size: $font-size-h3;
  font-weight: 600;
  color: $color-text-primary;
  margin: 0 0 4px;
}

.preview-desc {
  font-size: $font-size-caption;
  color: $color-text-secondary;
  margin: 0 0 16px;
}

.preview-card {
  background: $color-bg-secondary;
  border: 1px solid $color-border;
  border-radius: $radius-card;
  padding: 20px;
}

.preview-user {
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid $color-border;
}

.preview-nickname {
  font-size: 16px;
  font-weight: 600;
  color: $color-text-primary;
  margin-right: 8px;
}

.preview-username {
  font-size: 13px;
  color: $color-text-secondary;
}

.preview-fields {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.preview-field {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: $font-size-body;
}

.icon-visible {
  color: $color-success;
  font-size: 14px;
  flex-shrink: 0;
}

.icon-hidden {
  color: #d9d9d9;
  font-size: 14px;
  flex-shrink: 0;
}

.preview-field-label {
  color: $color-text-secondary;
  min-width: 72px;
}

.preview-field-value {
  color: $color-text-primary;
}

.preview-field-hidden {
  color: #d9d9d9;
}
</style>
