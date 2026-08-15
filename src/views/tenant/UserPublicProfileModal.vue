<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { getUserInfo } from '@/api/user'
import UserAvatar from '@/components/UserAvatar.vue'
import type { UserInfoRespDTO } from '@/types/user'

const props = defineProps<{
  visible: boolean
  userId: number
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const loading = ref(false)
const profile = ref<UserInfoRespDTO | null>(null)

const showBio = computed(() => !!profile.value?.bio && profile.value.privacy?.showBio !== false)
const showRegion = computed(() => !!profile.value?.region && profile.value.privacy?.showRegion !== false)
const showTimezone = computed(() => !!profile.value?.timezone && profile.value.privacy?.showTimezone !== false)
const hasAnyVisible = computed(() => showBio.value || showRegion.value || showTimezone.value)

watch(
  () => props.visible,
  async (val) => {
    if (!val) return
    profile.value = null
    loading.value = true
    try {
      profile.value = await getUserInfo(props.userId)
    } catch {
      // handled by interceptor
    } finally {
      loading.value = false
    }
  },
)

function handleClose() {
  emit('close')
}
</script>

<template>
  <a-modal
    :open="visible"
    :footer="null"
    :width="420"
    :closable="false"
    :destroy-on-close="true"
    @cancel="handleClose"
  >
    <div class="modal-header">
      <span class="modal-title">公开资料</span>
      <button class="close-btn" @click="handleClose" title="关闭">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
        </svg>
      </button>
    </div>

    <a-spin :spinning="loading">
      <div v-if="profile" class="profile-body">
        <div class="profile-head">
          <UserAvatar
            :src="profile.avatar"
            :name="profile.nickname || profile.username || ''"
            :size="56"
          />
          <div class="profile-id">
            <span class="profile-nickname">{{ profile.nickname || profile.username }}</span>
            <span class="profile-username">@{{ profile.username }}</span>
          </div>
        </div>

        <div class="profile-fields">
          <div v-if="showBio" class="profile-field">
            <span class="field-label">个人简介</span>
            <span class="field-value">{{ profile.bio }}</span>
          </div>
          <div v-if="showRegion" class="profile-field">
            <span class="field-label">地区</span>
            <span class="field-value">{{ profile.region }}</span>
          </div>
          <div v-if="showTimezone" class="profile-field">
            <span class="field-label">时区</span>
            <span class="field-value">{{ profile.timezone }}</span>
          </div>
          <div v-if="!hasAnyVisible" class="profile-empty">
            该用户暂未公开个人资料
          </div>
        </div>
      </div>
    </a-spin>
  </a-modal>
</template>

<style lang="scss" scoped>
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

.profile-body {
  padding: 8px 0 4px;
}

.profile-head {
  display: flex;
  align-items: center;
  gap: 16px;
  padding-bottom: 20px;
  border-bottom: 1px solid $color-border;
  margin-bottom: 20px;
}

.profile-id {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.profile-nickname {
  font-size: $font-size-h3;
  font-weight: 600;
  color: $color-text-primary;
}

.profile-username {
  font-size: $font-size-caption;
  color: $color-text-secondary;
}

.profile-fields {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.profile-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.field-label {
  font-size: $font-size-caption;
  color: $color-text-secondary;
  font-weight: 500;
}

.field-value {
  font-size: $font-size-body;
  color: $color-text-primary;
  line-height: 1.6;
}

.profile-empty {
  text-align: center;
  padding: 24px 0;
  font-size: $font-size-body;
  color: #bfbfbf;
}
</style>
