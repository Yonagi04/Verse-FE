<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { useUserStore } from '@/stores/user'
import { useThemeStore } from '@/stores/theme'
import UserAvatar from '@/components/UserAvatar.vue'
import {
  DownOutlined,
  LogoutOutlined,
  UserOutlined,
} from '@ant-design/icons-vue'

const router = useRouter()
const userStore = useUserStore()
const themeStore = useThemeStore()

const popoverVisible = ref(false)

const avatarName = computed(() => userStore.user?.nickname || userStore.user?.username || '')

const displayName = computed(() => {
  return userStore.user?.nickname || userStore.user?.username || '用户'
})

function togglePopover() {
  popoverVisible.value = !popoverVisible.value
}

function closePopover() {
  popoverVisible.value = false
}

function onDocumentClick(event: MouseEvent) {
  const target = event.target as HTMLElement
  if (popoverVisible.value && !target.closest('.sidebar-user-area')) {
    closePopover()
  }
}

onMounted(() => document.addEventListener('click', onDocumentClick))
onUnmounted(() => document.removeEventListener('click', onDocumentClick))

function handleProfile() {
  closePopover()
  router.push('/profile')
}

async function handleLogout() {
  closePopover()
  await userStore.signOut()
  message.success('已退出登录')
  router.push('/login')
}

</script>

<template>
  <div class="sidebar-user-area" :class="{ collapsed: themeStore.sidebarCollapsed }">
    <div v-show="popoverVisible" class="user-popover" role="menu" @click.stop>
      <div class="popover-account">
        <UserAvatar :src="userStore.user?.avatar" :name="avatarName" :size="32" />
        <div class="popover-account-copy">
          <strong>{{ displayName }}</strong>
          <span>个人账户</span>
        </div>
      </div>

      <div class="popover-divider"></div>

      <button type="button" class="popover-item" role="menuitem" @click="handleProfile">
        <UserOutlined class="item-icon" />
        <span>个人信息</span>
      </button>

      <div class="popover-divider"></div>

      <button type="button" class="popover-item danger" role="menuitem" @click="handleLogout">
        <LogoutOutlined class="item-icon" />
        <span>退出登录</span>
      </button>
    </div>

    <button
      type="button"
      class="user-trigger"
      aria-haspopup="menu"
      :aria-expanded="popoverVisible"
      :aria-label="themeStore.sidebarCollapsed ? `${displayName}，打开用户菜单` : '打开用户菜单'"
      @click.stop="togglePopover"
    >
      <UserAvatar :src="userStore.user?.avatar" :name="avatarName" :size="36" />
      <span v-show="!themeStore.sidebarCollapsed" class="user-info">
        <span class="user-nickname">{{ displayName }}</span>
      </span>
      <DownOutlined 
        v-show="!themeStore.sidebarCollapsed" 
        class="user-arrow"
        :class="{ expanded: popoverVisible }"
      />
    </button>
  </div>
</template>

<style lang="scss" scoped>
.sidebar-user-area {
  position: relative;
  z-index: 10;
  flex: 0 0 76px;
  // flex-shrink: 0;
  padding: 10px;
  border-top: 1px solid $color-border;
}

.user-trigger {
  width: 100%;
  height: 54px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 8px;
  border: 0;
  border-radius: $radius-button;
  background: transparent;
  color: $color-text-primary;
  font-family: $font-family;
  text-align: left;
  cursor: pointer;
  transition: background 0.15s;

  &:hover,
  &[aria-expanded='true'] {
    background: $color-bg-secondary;
  }

  &:focus-visible {
    outline: 2px solid rgba($color-primary, 0.35);
    outline-offset: 1px;
  }
}

.user-info {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  overflow: hidden;
}

.user-nickname {
  overflow: hidden;
  color: $color-text-primary;
  font-size: $font-size-body;
  font-weight: 500;
  line-height: 1.35;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.user-arrow {
  flex: 0 0 auto;
  color: #98a2b3;
  font-size: 12px;
  transition: transform 0.2s ease;

  &.expanded {
    transform: rotate(180deg);
  }
}

.sidebar-user-area.collapsed .user-trigger {
  justify-content: center;
  padding: 7px 0;
}

.user-popover {
  width: 224px;
  position: absolute;
  bottom: calc(100% + 8px);
  left: 10px;
  padding: 6px;
  border: 1px solid $color-border;
  border-radius: $radius-card;
  background: $color-bg;
  box-shadow: $shadow-light;
  animation: popover-in 0.15s ease;
}

.sidebar-user-area.collapsed .user-popover {
  bottom: 10px;
  left: calc(100% + 8px);
}

@keyframes popover-in {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.popover-account {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px;
}

.popover-account-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;

  strong,
  span {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  strong {
    color: $color-text-primary;
    font-size: $font-size-body;
    font-weight: 500;
  }

  span {
    color: $color-text-secondary;
    font-size: $font-size-caption;
  }
}

.popover-item {
  width: 100%;
  min-height: 38px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 9px;
  border: 0;
  border-radius: $radius-button;
  background: transparent;
  color: $color-text-primary;
  font-family: $font-family;
  font-size: $font-size-body;
  text-align: left;
  cursor: pointer;
  transition: background 0.12s;

  &:hover {
    background: $color-bg-secondary;
  }

  &:focus-visible {
    outline: 2px solid rgba($color-primary, 0.35);
    outline-offset: -2px;
  }

  &.danger {
    color: $color-danger;

    &:hover {
      background: rgba($color-danger, 0.06);
    }
  }
}

.item-icon {
  flex: 0 0 auto;
  color: $color-text-secondary;
  font-size: 16px;
}

.popover-item.danger .item-icon {
  color: $color-danger;
}

.popover-divider {
  height: 1px;
  margin: 4px 6px;
  background: $color-border;
}
</style>
