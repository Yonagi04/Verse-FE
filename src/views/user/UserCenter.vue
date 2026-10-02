<script setup lang="ts">
import { computed, nextTick, ref, type Component } from 'vue'
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRoute, useRouter } from 'vue-router'
import zhCN from 'ant-design-vue/es/locale/zh_CN'
import { UserOutlined, SafetyCertificateOutlined, TabletOutlined, HistoryOutlined } from '@ant-design/icons-vue'
import UserProfilePanel from './UserProfilePanel.vue'
import UserPrivacyPanel from './UserPrivacyPanel.vue'
import UserDevicePanel from './UserDevicePanel.vue'
import UserLoginHistoryPanel from './UserLoginHistoryPanel.vue'

const panels: { key: string; label: string; description: string; icon: Component; component: Component }[] = [
  { key: 'profile', label: '个人资料', description: '让团队更了解你', icon: UserOutlined, component: UserProfilePanel },
  { key: 'privacy', label: '隐私设置', description: '管理资料可见性', icon: SafetyCertificateOutlined, component: UserPrivacyPanel },
  { key: 'devices', label: '登录设备', description: '管理设备与会话', icon: TabletOutlined, component: UserDevicePanel },
  { key: 'history', label: '登录历史', description: '查看账户登录活动', icon: HistoryOutlined, component: UserLoginHistoryPanel },
]
const route = useRoute(); const router = useRouter()
function panel(value: unknown) { return typeof value === 'string' && panels.some(p => p.key === value) ? value : 'profile' }
const activePanel = ref(panel(route.query.panel))
const currentPanel = computed(() => panels.find(panel => panel.key === activePanel.value) || panels[0]!)
const profileRef = ref<InstanceType<typeof UserProfilePanel> | null>(null)
const centerRef = ref<HTMLDivElement | null>(null)

function canLeave() {
  return activePanel.value !== 'profile' || !profileRef.value || profileRef.value.confirmLeave()
}
function switchPanel(key: string) {
  if (key === activePanel.value || !panels.some(panel => panel.key === key) || !canLeave()) return
  void router.replace({ path:'/profile', query:{ panel:key } })
  void nextTick(() => centerRef.value?.closest<HTMLElement>('.content')?.scrollTo({ top: 0 }))
}
onBeforeRouteLeave(() => canLeave())
onBeforeRouteUpdate(to => {
  const nextPanel = panel(to.query.panel)
  if (nextPanel !== activePanel.value && !canLeave()) return false
  activePanel.value = nextPanel
})
</script>

<template>
  <a-config-provider :locale="zhCN" :auto-insert-space-in-button="false">
  <div ref="centerRef" class="user-center">
    <header class="page-heading">
      <h1>个人中心</h1>
      <p>管理你的个人资料、隐私与账户安全。</p>
    </header>
    <div class="center-layout">
      <nav class="settings-nav" aria-label="个人中心设置">
        <div class="nav-label">账户设置</div>
        <button v-for="item in panels" :key="item.key" type="button" class="settings-item"
          :class="{ active: activePanel === item.key }" :aria-current="activePanel === item.key ? 'page' : undefined"
          aria-controls="user-center-content" @click="switchPanel(item.key)">
          <component :is="item.icon" class="nav-icon" />
          <span>{{ item.label }}<small>{{ item.description }}</small></span>
        </button>
        <p class="nav-note">个人资料在所有租户中共享。<br>你可以选择向其他成员公开哪些信息。</p>
      </nav>
      <div id="user-center-content" class="center-content">
        <UserProfilePanel v-if="activePanel === 'profile'" ref="profileRef" @navigate="switchPanel" />
        <component :is="currentPanel.component" v-else />
      </div>
    </div>
  </div>
  </a-config-provider>
</template>

<style lang="scss" scoped>
.user-center { padding-top: 4px; color: $color-text-primary; }
.page-heading {
  margin-bottom: 24px;
  h1 { margin: 0; font-size: $font-size-title; font-weight: 600; line-height: 1.4; }
  p { margin: 6px 0 0; color: $color-text-secondary; font-size: $font-size-body; line-height: 1.6; }
}
.center-layout { display: flex; align-items: flex-start; gap: 24px; }
.settings-nav {
  width: 180px; flex-shrink: 0; position: sticky; top: 0;
  background: $color-bg; border: 1px solid $color-border; border-radius: $radius-card; padding: 8px;
}
.nav-label { padding: 12px 12px 10px; font-size: $font-size-caption; color: $color-text-secondary; }
.settings-item {
  width: 100%; display: flex; align-items: flex-start; gap: 10px; padding: 12px;
  border: 0; border-radius: $radius-button; background: transparent; text-align: left;
  font: inherit; color: $color-text-secondary; cursor: pointer; margin: 2px 0;
  transition: color 0.15s, background 0.15s;
  &:hover { background: $color-bg-secondary; color: $color-text-primary; }
  &:focus-visible { outline: 2px solid $color-primary; outline-offset: 3px; }
  &.active { color: $color-primary; background: $color-primary-bg; box-shadow: inset 3px 0 0 $color-primary; }
  > span { display: flex; flex-direction: column; gap: 5px; }
  small { font-size: 11px; color: $color-text-secondary; white-space: nowrap; }
}
.nav-icon { font-size: 18px; flex-shrink: 0; margin-top: 1px; }
.nav-note { margin: 16px 12px 8px; padding-top: 16px; border-top: 1px solid $color-border; font-size: $font-size-caption; color: $color-text-secondary; line-height: 1.8; }
.center-content { flex: 1; min-width: 0; container: profile / inline-size; }
@media (max-width: 1100px) {
  .center-layout { gap: 20px; }
  .settings-nav { width: 168px; }
}
@media (max-width: 900px) {
  .center-layout { flex-direction: column; gap: 16px; }
  .settings-nav { width: 100%; position: static; display: flex; overflow-x: auto; }
  .nav-label, .nav-note, .settings-item small { display: none; }
  .settings-item { width: auto; flex: 1 0 auto; align-items: center; justify-content: center; margin: 0; padding: 10px 12px; }
  .nav-icon { margin: 0; }
  .center-content { width: 100%; }
}
@media (max-width: 760px) {
  .page-heading { margin-bottom: 20px; }
}
@media (max-width: 400px) {
  .settings-item { gap: 5px; padding: 10px 8px; font-size: 13px; }
  .nav-icon { font-size: 15px; }
}
</style>
