<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Component } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useThemeStore } from '@/stores/theme'
import { useTenantStore } from '@/stores/tenant'
import { usePlaygroundStore } from '@/stores/playground'
import {
  ApiOutlined,
  BarChartOutlined,
  DashboardOutlined,
  FileTextOutlined,
  KeyOutlined,
  RightOutlined,
  TeamOutlined,
  ExperimentOutlined,
} from '@ant-design/icons-vue'

interface NavigationItem {
  key: string
  label: string
  icon: Component
}

interface NavigationGroup {
  key: 'llm' | 'usage' | 'explore'
  label: string
  icon: Component
  children: NavigationItem[]
}

const router = useRouter()
const route = useRoute()
const themeStore = useThemeStore()
const tenantStore = useTenantStore()
const playgroundStore = usePlaygroundStore()

const overviewItems: NavigationItem[] = [
  { key: '/dashboard', label: '仪表盘', icon: DashboardOutlined },
]

const managementItems: NavigationItem[] = [
  { key: '/tenants', label: '租户管理', icon: TeamOutlined },
]

const navigationGroups = computed<NavigationGroup[]>(() => [
  {
    key: 'llm',
    label: 'LLM 服务',
    icon: ApiOutlined,
    children: [
      { key: '/llm-services', label: '服务管理', icon: ApiOutlined },
      { key: '/api-keys', label: 'API Key', icon: KeyOutlined },
    ],
  },
  {
    key: 'usage',
    label: '用量',
    icon: BarChartOutlined,
    children: [
      { key: '/usage', label: '用量统计', icon: BarChartOutlined },
      { key: '/logs', label: '调用日志', icon: FileTextOutlined },
    ],
  },
  ...(playgroundStore.status?.enabled ? [{
    key: 'explore' as const,
    label: '探索',
    icon: ExperimentOutlined,
    children: [{ key: '/playground', label: 'PlayGround', icon: ExperimentOutlined }],
  }] : []),
])

const expandedGroups = ref<Record<NavigationGroup['key'], boolean>>({
  llm: true,
  usage: true,
  explore: true,
})

const activeKey = computed(() => {
  if (route.path.startsWith('/tenants')) return '/tenants'
  return route.path
})

function isActive(key: string) {
  return activeKey.value === key
}

function navigateTo(key: string) {
  if (activeKey.value !== key) {
    router.push(key)
  }
}

function toggleGroup(group: NavigationGroup) {
  if (themeStore.sidebarCollapsed) {
    themeStore.setSidebarCollapsed(false)
    expandedGroups.value[group.key] = true
    return
  }
  expandedGroups.value[group.key] = !expandedGroups.value[group.key]
}

watch(
  activeKey,
  (key) => {
    const activeGroup = navigationGroups.value.find((group) =>
      group.children.some((item) => item.key === key),
    )
    if (activeGroup) {
      expandedGroups.value[activeGroup.key] = true
    }
  },
  { immediate: true },
)

watch(() => tenantStore.currentTenantId, (tenantId) => {
  playgroundStore.reset(tenantId)
  if (tenantId) void playgroundStore.refresh(tenantId)
}, { immediate: true })
</script>

<template>
  <nav
    class="side-navigation"
    :class="{ collapsed: themeStore.sidebarCollapsed }"
    aria-label="主导航"
  >
    <section class="navigation-section">
      <div v-show="!themeStore.sidebarCollapsed" class="section-label">概览</div>
      <a-tooltip
        v-for="item in overviewItems"
        :key="item.key"
        :title="themeStore.sidebarCollapsed ? item.label : ''"
        placement="right"
      >
        <button
          type="button"
          class="menu-button"
          :class="{ active: isActive(item.key) }"
          :aria-current="isActive(item.key) ? 'page' : undefined"
          @click="navigateTo(item.key)"
        >
          <component :is="item.icon" class="menu-icon" />
          <span v-show="!themeStore.sidebarCollapsed" class="menu-label">{{ item.label }}</span>
        </button>
      </a-tooltip>
    </section>

    <section class="navigation-section management-section">
      <div v-show="!themeStore.sidebarCollapsed" class="section-label">管理</div>
      <a-tooltip
        v-for="item in managementItems"
        :key="item.key"
        :title="themeStore.sidebarCollapsed ? item.label : ''"
        placement="right"
      >
        <button
          type="button"
          class="menu-button"
          :class="{ active: isActive(item.key) }"
          :aria-current="isActive(item.key) ? 'page' : undefined"
          @click="navigateTo(item.key)"
        >
          <component :is="item.icon" class="menu-icon" />
          <span v-show="!themeStore.sidebarCollapsed" class="menu-label">{{ item.label }}</span>
        </button>
      </a-tooltip>

      <div v-for="group in navigationGroups" :key="group.key" class="menu-group">
        <a-tooltip :title="themeStore.sidebarCollapsed ? group.label : ''" placement="right">
          <button
            type="button"
            class="menu-button group-button"
            :class="{ 'has-active-child': group.children.some((item) => isActive(item.key)) }"
            :aria-expanded="expandedGroups[group.key]"
            @click="toggleGroup(group)"
          >
            <component :is="group.icon" class="menu-icon" />
            <span v-show="!themeStore.sidebarCollapsed" class="menu-label">{{ group.label }}</span>
            <RightOutlined
              v-show="!themeStore.sidebarCollapsed"
              class="group-arrow"
              :class="{ expanded: expandedGroups[group.key] }"
            />
          </button>
        </a-tooltip>

        <Transition name="submenu-expand">
          <div
            v-show="!themeStore.sidebarCollapsed && expandedGroups[group.key]"
            class="submenu"
          >
            <button
              v-for="item in group.children"
              :key="item.key"
              type="button"
              class="submenu-button"
              :class="{ active: isActive(item.key) }"
              :aria-current="isActive(item.key) ? 'page' : undefined"
              @click="navigateTo(item.key)"
            >
              <span class="submenu-rail" aria-hidden="true"></span>
              <span class="submenu-label">{{ item.label }}</span>
            </button>
          </div>
        </Transition>
      </div> 
    </section>
  </nav>
</template>

<style lang="scss" scoped>
.side-navigation {
  padding: 10px;
}

.navigation-section + .navigation-section {
  margin-top: 20px;
}

.section-label {
  padding: 0 10px 8px;
  color: #98a2b3;
  font-size: $font-size-caption;
  font-weight: 500;
  line-height: 20px;
  letter-spacing: 0.04em;
}

.menu-button,
.submenu-button {
  width: 100%;
  border: 0;
  background: transparent;
  color: $color-text-secondary;
  font-family: $font-family;
  font-size: $font-size-body;
  text-align: left;
  cursor: pointer;
  transition: color 0.15s, background 0.15s;

  &:hover {
    color: $color-text-primary;
    background: $color-bg-secondary;
  }

  &:focus-visible {
    outline: 2px solid rgba($color-primary, 0.35);
    outline-offset: 1px;
  }
}

.menu-button {
  min-height: 40px;
  display: flex;
  align-items: center;
  gap: 11px;
  margin: 2px 0;
  padding: 0 10px;
  border-radius: $radius-button;

  &.active {
    color: $color-primary;
    background: rgba($color-primary, 0.09);
    font-weight: 500;
  }
}

.menu-icon {
  flex: 0 0 auto;
  font-size: 17px;
}

.menu-label {
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.group-button.has-active-child {
  color: $color-text-primary;
  font-weight: 500;
}

.group-arrow {
  margin-left: auto;
  color: #98a2b3;
  font-size: 12px;

  transition: transform 0.2s ease;

  &.expanded {
    transform: rotate(90deg);
  }
}

.submenu {
  padding: 2px 0 4px;
}

.submenu-button {
  min-height: 38px;
  display: flex;
  align-items: center;
  position: relative;
  padding: 0 10px 0 39px;
  border-radius: $radius-button;

  &.active {
    color: $color-primary;
    background: rgba($color-primary, 0.09);
    font-weight: 500;

    .submenu-rail {
      width: 2px;
      background: $color-primary;
    }
  }
}

.submenu-rail {
  width: 1px;
  position: absolute;
  top: 0;
  bottom: 0;
  left: 18px;
  background: $color-border;
}

.submenu-label {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.side-navigation.collapsed {
  .navigation-section + .navigation-section {
    margin-top: 10px;
  }

  .menu-button {
    justify-content: center;
    padding: 0;
  }
}

.submenu-expand-enter-active,
.submenu-expand-leave-active {
  overflow: hidden;
  transition:
    max-height 0.2s ease,
    opacity 0.15s ease,
    transform 0.2s ease;
}

.submenu-expand-enter-from,
.submenu-expand-leave-to {
  max-height: 0;
  opacity: 0;
  transform: translateY(-4px);
}

.submenu-expand-enter-to,
.submenu-expand-leave-from {
  max-height: 120px;
  opacity: 1;
  transform: translateY(0);
}
</style>
