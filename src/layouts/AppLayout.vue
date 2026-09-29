<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useThemeStore } from '@/stores/theme'
import { useUserStore } from '@/stores/user'
import { useWebSocketNotification } from '@/composables/useWebSocketNotification'
import SideMenu from './SideMenu.vue'
import TenantSwitcher from './TenantSwitcher.vue'
import SidebarUserArea from './SidebarUserArea.vue'
import {
  MenuFoldOutlined,
  MenuOutlined,
} from '@ant-design/icons-vue'
import NotificationPopover from './NotificationPopover.vue'
import { useTenantStore } from '@/stores/tenant'
import { registerTenantContextRecovery } from '@/utils/tenantContextRecovery'
import { message } from 'ant-design-vue'

const themeStore = useThemeStore()
const userStore = useUserStore()
const tenantStore = useTenantStore()
const router = useRouter()
const isNarrow = ref(false)
const mobileDrawerOpen = ref(false)
const { connect, disconnect } = useWebSocketNotification()

// 登录后连接 WebSocket，登出时断开
watch(() => userStore.token, (token) => {
  if (token) {
    connect()
  } else {
    disconnect()
  }
}, { immediate: true })

let unregisterRecovery: (() => void) | null = null
let narrowViewport: MediaQueryList | null = null
function collapseOnNarrowViewport(event: MediaQueryListEvent | MediaQueryList) {
  isNarrow.value = event.matches
  mobileDrawerOpen.value = false
  themeStore.setSidebarCollapsed(event.matches)
}
watch(mobileDrawerOpen, (open) => {
  if (isNarrow.value) themeStore.setSidebarCollapsed(!open)
})
watch(() => router.currentRoute.value.fullPath, () => { mobileDrawerOpen.value = false })
onMounted(() => {
  narrowViewport = window.matchMedia('(max-width: 760px)')
  collapseOnNarrowViewport(narrowViewport)
  narrowViewport.addEventListener('change', collapseOnNarrowViewport)
  unregisterRecovery = registerTenantContextRecovery(async () => {
    await tenantStore.initialize(true)
    message.warning('租户上下文已变化，已为你恢复到当前工作空间')
    await router.replace('/dashboard')
  })
})
onUnmounted(() => {
  narrowViewport?.removeEventListener('change', collapseOnNarrowViewport)
  unregisterRecovery?.()
})
</script>

<template>
  <a-layout style="height: 100vh">
    <a-layout-sider
      v-if="!isNarrow"
      v-model:collapsed="themeStore.sidebarCollapsed"
      :trigger="null"
      collapsible
      :width="240"
      :collapsed-width="80"
      theme="light"
      class="app-sider"
    >
      <div class="brand-row">
        <a-tooltip v-if="themeStore.sidebarCollapsed" title="展开侧边栏" placement="right">
          <button
            type="button"
            class="brand-expand"
            aria-label="展开侧边栏"
            @click="themeStore.toggleSidebar()"
          >
            <span class="brand-mark">V</span>
          </button>
        </a-tooltip>
        <template v-else>
          <div class="brand-lockup" aria-label="Verse">
            <span class="brand-mark">V</span>
            <span class="brand-word">Verse</span>
          </div>
          <a-tooltip title="折叠侧边栏" placement="right">
            <button
              type="button"
              class="collapse-control"
              aria-label="折叠侧边栏"
              @click="themeStore.toggleSidebar()"
            >
              <MenuFoldOutlined />
            </button>
          </a-tooltip>
        </template>
      </div>
      <TenantSwitcher />
      <div class="sider-menu-wrap">
        <SideMenu />
      </div>
      <SidebarUserArea />
    </a-layout-sider>
    <a-drawer v-model:open="mobileDrawerOpen" placement="left" :width="260" :closable="false"
      :body-style="{ padding: '0', display: 'flex', flexDirection: 'column' }" title="Verse 导航">
      <div class="mobile-nav">
        <TenantSwitcher />
        <div class="sider-menu-wrap"><SideMenu /></div>
        <SidebarUserArea />
      </div>
    </a-drawer>
    <a-layout>
      <a-layout-header class="header">
        <button v-if="isNarrow" type="button" class="mobile-menu-button" aria-label="打开导航"
          @click="mobileDrawerOpen = true"><MenuOutlined /></button>
        <div class="header-right">
          <NotificationPopover />
        </div>
      </a-layout-header>
      <a-layout-content class="content">
        <slot />
      </a-layout-content>
    </a-layout>
  </a-layout>
</template>

<style lang="scss" scoped>
// ========== Sider ==========
.app-sider {
  position: relative;
  z-index: 1;
  background: $color-bg !important;
  border-right: 1px solid $color-border;

  :deep(.ant-layout-sider-children) {
    display: flex;
    flex-direction: column;
    height: 100%;
  }
}

// ========== Brand ==========
.brand-row {
  height: $header-height;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 14px 0 16px;
  flex-shrink: 0;
}

.brand-lockup {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 10px;
}

.brand-mark {
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  flex: 0 0 30px;
  border-radius: $radius-button;
  background: $color-primary;
  color: $color-bg;
  font-size: 16px;
  font-weight: 600;
  line-height: 1;
  box-shadow: 0 2px 8px rgba($color-primary, 0.2);
}

.brand-word {
  color: $color-text-primary;
  font-size: 18px;
  font-weight: 600;
  letter-spacing: 0.4px;
  white-space: nowrap;
}

.brand-expand,
.collapse-control {
  border: 0;
  background: transparent;
  cursor: pointer;

  &:focus-visible {
    outline: 2px solid rgba($color-primary, 0.35);
    outline-offset: 2px;
  }
}

.brand-expand {
  padding: 0;
  border-radius: $radius-button;
}

.collapse-control {
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  padding: 0;
  border-radius: $radius-button;
  color: $color-text-secondary;
  font-size: 16px;
  transition: color 0.15s, background 0.15s;

  &:hover {
    color: $color-text-primary;
    background: $color-bg-secondary;
  }
}

.app-sider.ant-layout-sider-collapsed .brand-row {
  justify-content: center;
  padding: 0;
}

// ========== Menu wrapper ==========
.sider-menu-wrap {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
}
.mobile-nav { display: flex; flex-direction: column; min-height: 100%; }
.mobile-menu-button { width: 36px; height: 36px; border: 0; border-radius: $radius-button; background: transparent; color: $color-text-primary; cursor: pointer; }
.mobile-menu-button:focus-visible { outline: 2px solid $color-primary; }

// ========== Header ==========
.header {
  background: $color-bg;
  padding: 0 24px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  border-bottom: 1px solid $color-border;
  height: $header-height;
  line-height: $header-height;

  &-right {
    display: flex;
    align-items: center;
  }
}
// ========== Content ==========
.content {
  padding: $content-padding;
  background: $color-bg-secondary;
  overflow-y: auto;
}

@media (max-width: 760px) {
  .header { justify-content: space-between; padding: 0 12px; }
  .content { padding: 16px 12px; }
}
</style>
