<script setup lang="ts">
import { useThemeStore } from '@/stores/theme'
import SideMenu from './SideMenu.vue'
import SidebarUserArea from './SidebarUserArea.vue'
import {
  MenuUnfoldOutlined,
  MenuFoldOutlined,
  QuestionCircleOutlined,
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
      class="app-sider"
    >
      <div class="logo">
        <span v-if="!themeStore.sidebarCollapsed" class="logo-text">Verse</span>
        <span v-else class="logo-text-short">V</span>
      </div>
      <div class="sider-menu-wrap">
        <SideMenu />
      </div>
      <SidebarUserArea />
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
          <a class="help-link" href="javascript:void(0)">
            <QuestionCircleOutlined />
            <span>帮助</span>
          </a>
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

  :deep(.ant-layout-sider-children) {
    display: flex;
    flex-direction: column;
    height: 100%;
  }
}

// ========== Logo ==========
.logo {
  height: $header-height;
  display: flex;
  align-items: center;
  justify-content: center;
  border-bottom: 1px solid $color-border;
  flex-shrink: 0;

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

// ========== Menu wrapper ==========
.sider-menu-wrap {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
}

// ========== Header ==========
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

.help-link {
  display: flex;
  align-items: center;
  gap: 6px;
  color: $color-text-secondary;
  font-size: $font-size-body;
  padding: 6px 12px;
  border-radius: $radius-button;
  transition: all 0.15s;

  &:hover {
    color: $color-primary;
    background: #f5f5f5;
  }
}

// ========== Content ==========
.content {
  padding: $content-padding;
  background: $color-bg-secondary;
  overflow-y: auto;
}
</style>
