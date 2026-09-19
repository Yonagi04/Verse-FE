<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { useUserStore } from '@/stores/user'
import { useTenantStore } from '@/stores/tenant'
import { useThemeStore } from '@/stores/theme'
import UserAvatar from '@/components/UserAvatar.vue'
import {
  CheckOutlined,
  DownOutlined,
  LogoutOutlined,
  RightOutlined,
  SwapOutlined,
  UserOutlined,
} from '@ant-design/icons-vue'

const router = useRouter()
const userStore = useUserStore()
const tenantStore = useTenantStore()
const themeStore = useThemeStore()

const popoverVisible = ref(false)
const tenantListVisible = ref(false)

const avatarName = computed(() => userStore.user?.nickname || userStore.user?.username || '')

const displayName = computed(() => {
  return userStore.user?.nickname || userStore.user?.username || '用户'
})

const currentTenantName = computed(() => {
  return tenantStore.currentTenant?.name || ''
})

const tenantList = computed(() => tenantStore.tenants)

function isCurrentTenant(tenantId: string) {
  return tenantStore.currentTenant?.tenantId === tenantId
}

function togglePopover() {
  popoverVisible.value = !popoverVisible.value
  if (!popoverVisible.value) {
    tenantListVisible.value = false
  }
}

function closePopover() {
  popoverVisible.value = false
  tenantListVisible.value = false
}

function toggleTenantList() {
  tenantListVisible.value = !tenantListVisible.value
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

async function handleSwitchTenant(tenantId: string, tenantName: string) {
  closePopover()
  try {
    await tenantStore.switchToTenant(tenantId)
    message.success(`已切换到「${tenantName}」`)
    router.push('/dashboard')
  } catch {
    // handled by interceptor
  }
}
</script>

<template>
  <div class="sidebar-user-area" :class="{ collapsed: themeStore.sidebarCollapsed }">
    <div v-show="popoverVisible" class="user-popover" role="menu" @click.stop>
      <div class="popover-account">
        <UserAvatar :src="userStore.user?.avatar" :name="avatarName" :size="32" />
        <div class="popover-account-copy">
          <strong>{{ displayName }}</strong>
          <span>{{ currentTenantName || '暂无当前租户' }}</span>
        </div>
      </div>

      <div class="popover-divider"></div>

      <button type="button" class="popover-item" role="menuitem" @click="handleProfile">
        <UserOutlined class="item-icon" />
        <span>个人信息</span>
      </button>

      <button
        type="button"
        class="popover-item"
        role="menuitem"
        :class="{ 'sub-open': tenantListVisible }"
        :aria-expanded="tenantListVisible"
        @click="toggleTenantList"
      >
        <SwapOutlined class="item-icon" />
        <span>切换租户</span>
        <RightOutlined
          class="item-arrow"
          :class="{ rotated: tenantListVisible }"
        />
      </button>
      
      <Transition name="tenant-expand">
        <div v-show="tenantListVisible" class="tenant-list">
          <button
            v-for="tenant in tenantList"
            :key="tenant.tenantId"
            type="button"
            class="tenant-item"
            role="menuitemradio"
            :aria-checked="isCurrentTenant(tenant.tenantId)"
            :class="{ current: isCurrentTenant(tenant.tenantId) }"
            @click="handleSwitchTenant(tenant.tenantId, tenant.name)"
          >
            <span class="tenant-symbol">{{ tenant.name.charAt(0).toUpperCase() || '?' }}</span>
            <span class="tenant-copy">
              <span class="tenant-name">{{ tenant.name }}</span>
              <span class="tenant-role">{{ tenant.role }}</span>
            </span>
            <CheckOutlined v-if="isCurrentTenant(tenant.tenantId)" class="check-icon" />
          </button>
          <div v-if="tenantList.length === 0" class="tenant-list-empty">
            暂未加入任何租户
          </div>
        </div>
      </Transition>

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
        <span v-if="currentTenantName" class="user-tenant">
          <span class="tenant-status" aria-hidden="true"></span>
          <span class="user-tenant-name">{{ currentTenantName }}</span>
        </span>
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

.user-tenant {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  color: $color-text-secondary;
  font-size: $font-size-caption;
  line-height: 1.35;
}

.tenant-status {
  width: 6px;
  height: 6px;
  flex: 0 0 6px;
  border-radius: 50%;
  background: $color-success;
}

.user-tenant-name {
  min-width: 0;
  overflow: hidden;
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

  &:hover,
  &.sub-open {
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

.item-arrow {
  margin-left: auto;
  color: #98a2b3;
  font-size: 12px;
}

.popover-divider {
  height: 1px;
  margin: 4px 6px;
  background: $color-border;
}

.tenant-list {
  max-height: 220px;
  margin: 2px 0 4px 24px;
  padding: 2px 0;
  overflow-y: auto;
}

.tenant-item {
  width: 100%;
  min-height: 46px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 7px;
  border: 0;
  border-radius: $radius-button;
  background: transparent;
  color: $color-text-primary;
  font-family: $font-family;
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

  &.current {
    color: $color-primary;
  }
}

.tenant-symbol {
  width: 26px;
  height: 26px;
  display: grid;
  place-items: center;
  flex: 0 0 26px;
  border-radius: 6px;
  background: rgba($color-primary, 0.09);
  color: $color-primary;
  font-size: $font-size-caption;
  font-weight: 500;
}

.tenant-copy {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
}

.tenant-name {
  overflow: hidden;
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.tenant-role {
  color: $color-text-secondary;
  font-size: 11px;
  line-height: 1.4;
}

.check-icon {
  flex: 0 0 auto;
  color: $color-primary;
  font-size: 13px;
}

.tenant-list-empty {
  padding: 16px 8px;
  color: $color-text-secondary;
  font-size: 13px;
  text-align: center;
}

.tenant-expand-enter-active,
.tenant-expand-leave-active {
  overflow: hidden;
  transition:
    max-height 0.2s ease,
    opacity 0.15s ease,
    transform 0.2s ease;
}

.tenant-expand-enter-from,
.tenant-expand-leave-to {
  max-height: 0;
  opacity: 0;
  transform: translateY(-4px);
}

.tenant-expand-enter-to,
.tenant-expand-leave-from {
  max-height: 220px;
  opacity: 1;
  transform: translateY(0);
}

.item-arrow {
  margin-left: auto;
  color: #98a2b3;
  font-size: 12px;
  transition: transform 0.2s ease;

  &.rotated {
    transform: rotate(90deg);
  }
}
</style>
