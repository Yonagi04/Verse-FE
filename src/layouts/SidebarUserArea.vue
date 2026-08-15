<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { useTenantStore } from '@/stores/tenant'
import { useThemeStore } from '@/stores/theme'
import { usePermissionStore } from '@/stores/permission'
import { message } from 'ant-design-vue'
import {
  UserOutlined,
  SwapOutlined,
  LogoutOutlined,
  CheckOutlined,
} from '@ant-design/icons-vue'
import UserAvatar from '@/components/UserAvatar.vue'

const router = useRouter()
const userStore = useUserStore()
const tenantStore = useTenantStore()
const themeStore = useThemeStore()
const permissionStore = usePermissionStore()

// ========== State ==========
const popoverVisible = ref(false)
const tenantSubVisible = ref(false)
const hideSubTimer = ref<ReturnType<typeof setTimeout> | null>(null)

// ========== Computed ==========
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

// ========== Popover ==========
function togglePopover() {
  popoverVisible.value = !popoverVisible.value
  if (!popoverVisible.value) {
    tenantSubVisible.value = false
  }
}

function closePopover() {
  popoverVisible.value = false
  tenantSubVisible.value = false
}

function onDocumentClick(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (popoverVisible.value && !target.closest('.sidebar-user-area')) {
    closePopover()
  }
}

onMounted(() => document.addEventListener('click', onDocumentClick))
onUnmounted(() => document.removeEventListener('click', onDocumentClick))

// ========== Tenant Sub-panel ==========
function showTenantSub() {
  if (hideSubTimer.value) {
    clearTimeout(hideSubTimer.value)
    hideSubTimer.value = null
  }
  tenantSubVisible.value = true
}

function hideTenantSub() {
  hideSubTimer.value = setTimeout(() => {
    tenantSubVisible.value = false
  }, 150)
}

function cancelHideSub() {
  if (hideSubTimer.value) {
    clearTimeout(hideSubTimer.value)
    hideSubTimer.value = null
  }
}

// ========== Actions ==========
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
  tenantSubVisible.value = false
  try {
    await tenantStore.switchToTenant(tenantId)
    const t = tenantStore.tenants.find((t) => t.tenantId === tenantId)
    if (t) { permissionStore.setRole(t.role) } else { permissionStore.clearPermissions() }
    message.success(`已切换到「${tenantName}」`)
    router.push('/dashboard')
  } catch {
    // handled by interceptor
  }
}
</script>

<template>
  <div class="sidebar-user-area" :class="{ collapsed: themeStore.sidebarCollapsed }">
    <!-- 触发区域 -->
    <div class="user-trigger" @click.stop="togglePopover">
      <UserAvatar :src="userStore.user?.avatar" :name="avatarName" :size="36" />
      <div v-show="!themeStore.sidebarCollapsed" class="user-info">
        <div class="user-nickname">{{ displayName }}</div>
        <div v-if="currentTenantName" class="user-tenant">{{ currentTenantName }}</div>
      </div>
    </div>

    <!-- 弹出菜单 -->
    <div v-show="popoverVisible" class="user-popover" @click.stop>
      <div class="popover-item" @click="handleProfile">
        <UserOutlined class="item-icon" />
        <span>个人信息</span>
      </div>

      <div
        class="popover-item"
        :class="{ 'sub-open': tenantSubVisible }"
        @mouseenter="showTenantSub"
        @mouseleave="hideTenantSub"
      >
        <SwapOutlined class="item-icon" />
        <span>切换租户</span>
        <span class="item-arrow">&rsaquo;</span>

        <!-- 租户子面板 -->
        <div
          v-show="tenantSubVisible"
          class="tenant-subpanel"
          @mouseenter="cancelHideSub"
          @mouseleave="hideTenantSub"
        >
          <div class="subpanel-label">当前租户</div>
          <div
            v-for="t in tenantList"
            :key="t.tenantId"
            class="subpanel-item"
            :class="{ current: isCurrentTenant(t.tenantId) }"
            @click="handleSwitchTenant(t.tenantId, t.name)"
          >
            <CheckOutlined v-if="isCurrentTenant(t.tenantId)" class="check-icon" />
            <span v-else class="check-placeholder"></span>
            <span class="tenant-name">{{ t.name }}</span>
            <span class="tenant-role-tag" :class="t.role.toLowerCase()">{{ t.role }}</span>
          </div>
          <div v-if="tenantList.length === 0" class="subpanel-empty">
            暂未加入任何租户
          </div>
        </div>
      </div>

      <div class="popover-divider"></div>

      <div class="popover-item danger" @click="handleLogout">
        <LogoutOutlined class="item-icon" />
        <span>退出登录</span>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.sidebar-user-area {
  border-top: 1px solid $color-border;
  flex-shrink: 0;
  position: relative;
  z-index: 10;
}

// ========== 触发区域 ==========
.user-trigger {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px;
  cursor: pointer;
  transition: background 0.15s;
  overflow: hidden;

  &:hover {
    background: $color-bg-secondary;
  }
}

.sidebar-user-area.collapsed .user-trigger {
  justify-content: center;
  padding: 12px 8px;
}

// ========== 用户信息 ==========
.user-info {
  overflow: hidden;
  flex: 1;
  min-width: 0;
}

.user-nickname {
  font-size: $font-size-body;
  font-weight: 500;
  color: $color-text-primary;
  line-height: 1.35;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-tenant {
  font-size: $font-size-caption;
  color: #bfbfbf;
  line-height: 1.35;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

// ========== 弹出菜单 ==========
.user-popover {
  position: absolute;
  bottom: 100%;
  left: 12px;
  margin-bottom: 8px;
  background: $color-bg;
  border-radius: $radius-card;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.12);
  min-width: 180px;
  padding: 4px;
  animation: popoverIn 0.15s ease;
}

.sidebar-user-area.collapsed .user-popover {
  left: 8px;
}

@keyframes popoverIn {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}

.popover-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: $radius-button;
  cursor: pointer;
  font-size: $font-size-body;
  color: $color-text-primary;
  transition: background 0.12s;
  position: relative;
  white-space: nowrap;

  &:hover {
    background: #f5f5f5;
  }

  &.danger {
    color: $color-danger;

    &:hover {
      background: #fff1f0;
    }
  }
}

.item-icon {
  flex-shrink: 0;
  font-size: 16px;
  color: $color-text-secondary;
}

.popover-item.danger .item-icon {
  color: $color-danger;
}

.item-arrow {
  margin-left: auto;
  color: #bfbfbf;
  font-size: 16px;
}

.popover-divider {
  height: 1px;
  background: $color-border;
  margin: 4px 8px;
}

// ========== 租户子面板 ==========
.tenant-subpanel {
  position: absolute;
  left: calc(100% + 4px);
  top: 50%;
  transform: translateY(-50%);
  background: $color-bg;
  border-radius: $radius-card;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.12);
  min-width: 200px;
  padding: 4px;
  animation: subpanelIn 0.12s ease;
}

@keyframes subpanelIn {
  from { opacity: 0; transform: translateY(-50%) translateX(-4px); }
  to { opacity: 1; transform: translateY(-50%) translateX(0); }
}

.subpanel-label {
  font-size: $font-size-caption;
  color: #bfbfbf;
  padding: 6px 12px 2px;
}

.subpanel-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: $radius-button;
  cursor: pointer;
  font-size: $font-size-body;
  color: $color-text-primary;
  transition: background 0.12s;
  white-space: nowrap;

  &:hover {
    background: #f5f5f5;
  }

  &.current {
    color: $color-primary;
    font-weight: 500;
  }
}

.check-icon {
  flex-shrink: 0;
  color: $color-primary;
  font-size: 13px;
}

.check-placeholder {
  width: 13px;
  flex-shrink: 0;
}

.tenant-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tenant-role-tag {
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 4px;
  background: #f0f0f0;
  color: $color-text-secondary;
  flex-shrink: 0;

  &.super_admin,
  &.admin {
    background: #e6f4ff;
    color: $color-primary;
  }
}

.subpanel-empty {
  padding: 16px 12px;
  text-align: center;
  color: #bfbfbf;
  font-size: 13px;
}
</style>
