<script setup lang="ts">
import { computed } from 'vue'
import { CheckOutlined, LockOutlined, RightOutlined } from '@ant-design/icons-vue'
import { useTenantStore } from '@/stores/tenant'
import UserPublicPreview from './UserPublicPreview.vue'
import type { UserRespDTO } from '@/types/user'

const props = defineProps<{ profile: UserRespDTO; busy: boolean }>()
const emit = defineEmits<{ (e: 'edit'): void; (e: 'avatar'): void; (e: 'navigate', panel: string): void }>()
const tenantStore = useTenantStore()
const items = computed(() => [
  { key: 'avatar', label: '头像', done: !!props.profile.avatar },
  { key: 'nickname', label: '昵称', done: !!props.profile.nickname?.trim() },
  { key: 'bio', label: '个人简介', done: !!props.profile.bio?.trim() },
  { key: 'region', label: '地区', done: !!props.profile.region?.trim() },
  { key: 'timezone', label: '时区', done: !!props.profile.timezone?.trim() },
])
const count = computed(() => items.value.filter(item => item.done).length)
const tenant = computed(() => tenantStore.currentTenant)
const roleLabel = computed(() => ({ SUPER_ADMIN: '超级管理员', ADMIN: '管理员', MEMBER: '成员' })[tenant.value?.role || 'MEMBER'])
</script>

<template>
  <aside class="side-cards" aria-label="个人资料摘要">
    <section class="profile-card">
      <div class="card-body">
        <div class="completion-heading"><h3>资料完善度</h3><strong>{{ count * 20 }}<span>%</span></strong></div>
        <div class="progress" role="progressbar" aria-label="资料完善度" :aria-valuenow="count * 20" aria-valuemin="0" aria-valuemax="100">
          <span :style="{ width: `${count * 20}%` }"></span>
        </div>
        <p class="completion-desc">已完善 {{ count }} / 5 项资料。{{ count === 5 ? '你的个人名片已准备就绪。' : '补充个人名片，让团队更容易认识你。' }}</p>
        <ul class="checklist">
          <li v-for="item in items" :key="item.key" :class="{ done: item.done }">
            <span class="check-icon"><CheckOutlined v-if="item.done" /></span>{{ item.label }}
            <span v-if="item.done" class="hint">已完善</span>
            <a-button v-else type="link" class="text-button hint" :disabled="busy" @click="item.key === 'avatar' ? emit('avatar') : emit('edit')">去完善</a-button>
          </li>
        </ul>
      </div>
    </section>
    <section class="profile-card">
      <div class="card-body">
        <h3>当前租户</h3>
        <div v-if="tenant" class="workspace-card-line">
          <span class="workspace-mark">{{ tenant.name.charAt(0).toUpperCase() }}</span>
          <div class="workspace-copy"><strong>{{ tenant.name }}</strong><span class="caption">{{ tenant.type === 'TEAM' ? '团队租户' : '个人租户' }}</span></div>
        </div>
        <p v-else class="completion-desc">尚未选择租户</p>
        <div v-if="tenant" class="workspace-facts"><span>我的角色</span><a-tag>{{ roleLabel }}</a-tag></div>
        <router-link to="/tenants" custom v-slot="{ href, navigate }">
          <a-button type="link" class="text-button" :href="href" @click="navigate">管理我的租户 <RightOutlined /></a-button>
        </router-link>
      </div>
    </section>
    <section class="profile-card">
      <div class="card-body">
        <h3>我的公开名片</h3>
        <p class="completion-desc">其他成员看到的资料由你决定。</p>
        <UserPublicPreview :profile="profile" mini />
        <p class="notice"><LockOutlined />邮箱与手机号不会在公开名片中展示。</p>
        <a-button type="link" class="text-button full-button" :disabled="busy" @click="emit('navigate', 'privacy')">管理资料可见性 <RightOutlined /></a-button>
      </div>
    </section>
  </aside>
</template>

<style lang="scss" scoped>
@use './user-center';
.side-cards { display: flex; flex-direction: column; gap: 20px; min-width: 0; }
.card-body { padding: 20px; }
h3 { margin: 0; font-size: $font-size-h3; font-weight: 600; }
.completion-heading {
  display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;
  strong { font-size: $font-size-h2; color: $color-primary; font-weight: 600; span { font-size: 13px; } }
}
.progress {
  height: 5px; border-radius: 4px; background: $color-border; overflow: hidden;
  span { display: block; height: 100%; background: $color-primary-solid; border-radius: 4px; }
}
.completion-desc { margin: 10px 0 0; font-size: $font-size-caption; color: $color-text-secondary; line-height: 1.7; }
.checklist {
  padding: 0; margin: 16px 0 0; list-style: none; display: flex; flex-direction: column; gap: 12px;
  li { display: flex; align-items: center; gap: 8px; font-size: $font-size-caption; color: $color-text-secondary; }
  .check-icon { width: 16px; height: 16px; border: 1px solid $color-border-input; border-radius: 50%; display: grid; place-items: center; }
  .done .check-icon { border-color: $color-primary; background: $color-primary-solid; color: $color-on-primary; }
  .anticon { font-size: 10px; }
  .hint { margin-left: auto; font-size: 11px; }
  :deep(.ant-btn.hint) { font-size: 11px; min-height: 18px; padding: 0; }
}
.full-button { width: 100%; margin-top: 18px; }
.workspace-card-line { display: flex; align-items: center; gap: 12px; margin: 16px 0; }
.workspace-mark { width: 38px; height: 38px; border: 1px solid $color-border; border-radius: $radius-button; background: $color-bg-secondary; display: grid; place-items: center; font-weight: 600; flex-shrink: 0; }
.workspace-copy {
  flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px;
  strong { font-size: 13px; font-weight: 500; overflow-wrap: anywhere; }
}
.workspace-facts {
  display: flex; align-items: center; justify-content: space-between; font-size: $font-size-caption; color: $color-text-secondary; padding: 12px 0; border-top: 1px solid $color-border;
  :deep(.ant-tag) { margin: 0; }
}
@container profile (max-width: 820px) {
  .side-cards { display: grid; grid-template-columns: 1fr 1fr; align-items: start; }
  .side-cards > :last-child { grid-column: 1 / -1; }
}
@container profile (max-width: 540px) { .side-cards { display: flex; } }
</style>
