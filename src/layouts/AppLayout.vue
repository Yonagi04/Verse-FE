<script setup lang="ts">
import { useThemeStore } from '@/stores/theme'
import SideMenu from './SideMenu.vue'
import UserDropdown from './UserDropdown.vue'
import {
  MenuUnfoldOutlined,
  MenuFoldOutlined,
} from '@ant-design/icons-vue'

const themeStore = useThemeStore()
</script>

<template>
  <a-layout style="height: 100vh">
    <a-layout-sider
      v-model:collapsed="themeStore.sidebarCollapsed"
      :trigger="null"
      collapsible
      :width="240"
      :collapsed-width="80"
      theme="light"
    >
      <div class="logo">
        <span v-if="!themeStore.sidebarCollapsed" class="logo-text">Verse</span>
        <span v-else class="logo-text-short">V</span>
      </div>
      <SideMenu />
    </a-layout-sider>
    <a-layout>
      <a-layout-header class="header">
        <div class="header-left">
          <menu-unfold-outlined
            v-if="themeStore.sidebarCollapsed"
            class="trigger"
            @click="themeStore.toggleSidebar()"
          />
          <menu-fold-outlined
            v-else
            class="trigger"
            @click="themeStore.toggleSidebar()"
          />
        </div>
        <div class="header-right">
          <UserDropdown />
        </div>
      </a-layout-header>
      <a-layout-content class="content">
        <slot />
      </a-layout-content>
    </a-layout>
  </a-layout>
</template>

<style lang="scss" scoped>
.logo {
  height: $header-height;
  display: flex;
  align-items: center;
  justify-content: center;
  border-bottom: 1px solid $color-border;

  &-text {
    font-size: 20px;
    font-weight: 700;
    color: $color-primary;
    letter-spacing: 2px;
  }

  &-text-short {
    font-size: 20px;
    font-weight: 700;
    color: $color-primary;
  }
}

.header {
  background: $color-bg;
  padding: 0 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid $color-border;
  height: $header-height;
  line-height: $header-height;

  &-left, &-right {
    display: flex;
    align-items: center;
  }
}

.trigger {
  font-size: 18px;
  cursor: pointer;
  color: $color-text-secondary;
  transition: color 0.2s;

  &:hover {
    color: $color-primary;
  }
}

.content {
  padding: $content-padding;
  background: $color-bg-secondary;
  overflow-y: auto;
}
</style>
