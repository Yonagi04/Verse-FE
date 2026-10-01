<script setup lang="ts">
import { computed } from 'vue'
import { EnvironmentOutlined, GlobalOutlined } from '@ant-design/icons-vue'
import UserAvatar from '@/components/UserAvatar.vue'
import type { UserInfoRespDTO } from '@/types/user'

const props = withDefaults(defineProps<{ profile: UserInfoRespDTO; mini?: boolean }>(), { mini: false })
const name = computed(() => props.profile.nickname || props.profile.username)
const fields = computed(() => [
  { key: 'bio', label: '个人简介', value: props.profile.bio, visible: props.profile.privacy?.showBio !== false },
  { key: 'region', label: '地区', value: props.profile.region, visible: props.profile.privacy?.showRegion !== false },
  { key: 'timezone', label: '时区', value: props.profile.timezone, visible: props.profile.privacy?.showTimezone !== false },
].filter(field => field.value?.trim() && field.visible))
</script>

<template>
  <div class="public-preview" :class="{ mini }">
    <div class="preview-identity">
      <UserAvatar :src="profile.avatar" :name="name" :size="mini ? 32 : 48" />
      <div class="preview-name"><h3>{{ name }}</h3><p v-if="!mini">@{{ profile.username }}</p></div>
    </div>
    <dl v-if="!mini" class="preview-fields">
      <div v-for="field in fields" :key="field.key"><dt>{{ field.label }}</dt><dd>{{ field.value }}</dd></div>
    </dl>
    <template v-else>
      <p v-if="fields.some(field => field.key === 'bio')" class="mini-bio">{{ profile.bio }}</p>
      <div class="mini-meta">
        <span v-for="field in fields.filter(field => field.key !== 'bio')" :key="field.key">
          <EnvironmentOutlined v-if="field.key === 'region'" /><GlobalOutlined v-else />{{ field.value }}
        </span>
      </div>
    </template>
    <p v-if="!fields.length" class="empty-copy">{{ mini ? '暂未公开更多个人资料' : '该用户暂未公开更多个人资料' }}</p>
  </div>
</template>

<style lang="scss" scoped>
.public-preview { padding: 24px; margin-top: 16px; border: 1px solid $color-border; background: $color-bg-secondary; border-radius: $radius-input; }
.preview-identity { display: flex; gap: 12px; align-items: center; margin-bottom: 20px; }
.preview-name {
  min-width: 0;
  h3 { margin: 0; font-size: $font-size-h3; font-weight: 600; overflow-wrap: anywhere; }
  p { margin: 5px 0 0; font-size: $font-size-caption; color: $color-text-secondary; overflow-wrap: anywhere; }
}
.preview-fields {
  margin: 0; display: flex; flex-direction: column; gap: 16px;
  dt { font-size: $font-size-caption; color: $color-text-secondary; margin-bottom: 5px; }
  dd { margin: 0; line-height: 1.8; white-space: pre-wrap; overflow-wrap: anywhere; }
}
.empty-copy { margin: 0; font-size: $font-size-caption; color: $color-text-secondary; line-height: 1.6; }
.mini {
  padding: 16px;
  .preview-identity { gap: 10px; margin-bottom: 12px; }
  .preview-name h3 { font-size: 13px; font-weight: 500; }
}
.mini-bio { margin: 0; font-size: $font-size-caption; color: $color-text-secondary; line-height: 1.8; white-space: pre-wrap; overflow-wrap: anywhere; }
.mini-meta {
  display: flex; flex-direction: column; gap: 8px; margin-top: 12px; font-size: $font-size-caption; color: $color-text-secondary;
  span { display: flex; align-items: center; gap: 7px; overflow-wrap: anywhere; }
  .anticon { flex-shrink: 0; font-size: 13px; }
}
</style>
