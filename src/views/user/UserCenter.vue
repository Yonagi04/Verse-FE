<script setup lang="ts">
import { ref, shallowRef, type Component } from 'vue'
import {
  UserOutlined,
  SafetyCertificateOutlined,
  TabletOutlined,
  HistoryOutlined,
} from '@ant-design/icons-vue'
import UserProfilePanel from './UserProfilePanel.vue'
import UserPrivacyPanel from './UserPrivacyPanel.vue'
import UserDevicePanel from './UserDevicePanel.vue'
import UserLoginHistoryPanel from './UserLoginHistoryPanel.vue'

const panels: { key: string; label: string; icon: Component; component: Component }[] = [
  { key: 'profile', label: '个人资料', icon: UserOutlined, component: UserProfilePanel },
  { key: 'privacy', label: '隐私设置', icon: SafetyCertificateOutlined, component: UserPrivacyPanel },
  { key: 'devices', label: '登录设备', icon: TabletOutlined, component: UserDevicePanel },
  { key: 'history', label: '登录历史', icon: HistoryOutlined, component: UserLoginHistoryPanel },
]

const activePanel = ref('profile')

const currentComponent = shallowRef<Component>(UserProfilePanel)

function switchPanel(key: string) {
  activePanel.value = key
  const panel = panels.find(p => p.key === key)
  if (panel) {
    currentComponent.value = panel.component
  }
}
</script>

<template>
  <div class="user-center">
    <!-- 左侧子导航 -->
    <nav class="sub-nav">
      <div
        v-for="item in panels"
        :key="item.key"
        class="sub-nav-item"
        :class="{ active: activePanel === item.key }"
        @click="switchPanel(item.key)"
      >
        <component :is="item.icon" class="nav-icon" />
        <span>{{ item.label }}</span>
      </div>
    </nav>

    <!-- 右侧内容区 -->
    <div class="content-area">
      <component :is="currentComponent" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.user-center {
  display: flex;
  gap: 24px;
  height: 100%;
}

// ========== 左侧子导航 ==========
.sub-nav {
  width: 180px;
  flex-shrink: 0;
  background: $color-bg;
  border: 1px solid $color-border;
  border-radius: $radius-card;
  padding: 8px;
  height: fit-content;
  position: sticky;
  top: 0;
}

.sub-nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: $radius-button;
  cursor: pointer;
  font-size: $font-size-body;
  color: $color-text-secondary;
  transition: all 0.15s;
  margin-bottom: 2px;

  &:hover {
    background: #fafafa;
    color: $color-text-primary;
  }

  &.active {
    color: $color-primary;
    background: #f6f9ff;
    box-shadow: inset 3px 0 0 $color-primary;
  }
}

.nav-icon {
  font-size: 16px;
  flex-shrink: 0;
}

// ========== 右侧内容区 ==========
.content-area {
  flex: 1;
  min-width: 0;
  background: $color-bg;
  border: 1px solid $color-border;
  border-radius: $radius-card;
  padding: 24px;
  overflow-y: auto;
}
</style>
