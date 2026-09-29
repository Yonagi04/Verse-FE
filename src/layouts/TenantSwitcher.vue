<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { CheckOutlined, DownOutlined, PushpinFilled, StarFilled, SwapOutlined } from '@ant-design/icons-vue'
import { useTenantStore } from '@/stores/tenant'
import { useThemeStore } from '@/stores/theme'

const router = useRouter()
const tenantStore = useTenantStore()
const themeStore = useThemeStore()
const open = ref(false)
const search = ref('')
const root = ref<HTMLElement | null>(null)

const visibleTenants = computed(() => {
  const query = search.value.trim().toLowerCase()
  return tenantStore.tenants.filter((tenant) =>
    tenant.name.toLowerCase().includes(query) || tenant.tenantId.includes(query),
  ).sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
    if (a.favorite !== b.favorite) return a.favorite ? -1 : 1
    return (b.lastAccessedAt ? Date.parse(b.lastAccessedAt) : 0)
      - (a.lastAccessedAt ? Date.parse(a.lastAccessedAt) : 0)
  })
})

function roleLabel(role?: string) {
  if (role === 'SUPER_ADMIN') return '超级管理员'
  if (role === 'ADMIN') return '管理员'
  return '成员'
}

function close() {
  open.value = false
  search.value = ''
}

async function toggle() {
  open.value = !open.value
  if (open.value) {
    // 每次展开从服务端对账，另一台设备上的偏好变更可在此看到。
    void tenantStore.fetchTenants().catch(() => { /* 列表请求拦截器已提示。 */ })
    await nextTick()
    root.value?.querySelector<HTMLInputElement>('.switch-search input')?.focus()
  } else {
    search.value = ''
  }
}

function onDocumentClick(event: MouseEvent) {
  if (open.value && !root.value?.contains(event.target as Node)) close()
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && open.value) {
    close()
    root.value?.querySelector<HTMLButtonElement>('.switch-trigger')?.focus()
  }
}

async function selectTenant(tenantId: string, tenantName: string) {
  if (tenantStore.isSwitching) return
  if (tenantStore.currentTenantId === tenantId) {
    close()
    return
  }
  try {
    const switched = await tenantStore.switchToTenant(tenantId)
    if (!switched) return
    close()
    message.success(`已切换到「${tenantName}」`)
    await router.push('/dashboard')
  } catch {
    // 请求拦截器提示失败，弹层保持打开以便重试。
  }
}

onMounted(() => {
  document.addEventListener('click', onDocumentClick)
  document.addEventListener('keydown', onKeydown)
})
onUnmounted(() => {
  document.removeEventListener('click', onDocumentClick)
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div ref="root" class="tenant-switcher" :class="{ collapsed: themeStore.sidebarCollapsed }">
    <a-tooltip :title="themeStore.sidebarCollapsed ? `当前租户：${tenantStore.currentTenant?.name || '暂无'}` : ''" placement="right">
      <button type="button" class="switch-trigger" aria-haspopup="menu" :aria-expanded="open"
        :aria-label="`当前租户：${tenantStore.currentTenant?.name || '暂无'}，选择租户`" @click.stop="toggle">
        <span class="tenant-mark">{{ tenantStore.currentTenant?.name?.charAt(0).toUpperCase() || '?' }}</span>
        <span v-if="!themeStore.sidebarCollapsed" class="trigger-copy">
          <strong>{{ tenantStore.currentTenant?.name || '暂无当前租户' }}</strong>
          <small>{{ tenantStore.currentTenant ? roleLabel(tenantStore.currentTenant.role) : '选择租户' }}</small>
        </span>
        <DownOutlined v-if="!themeStore.sidebarCollapsed" class="trigger-arrow" :class="{ expanded: open }" />
      </button>
    </a-tooltip>

    <Transition name="switch-menu">
      <div v-if="open" class="switch-menu" role="menu" aria-label="切换租户">
        <div class="switch-heading"><SwapOutlined /> 已加入的租户</div>
        <a-input v-model:value="search" class="switch-search" placeholder="搜索名称或 ID" allow-clear />
        <div class="switch-options">
          <button v-for="tenant in visibleTenants" :key="tenant.tenantId" type="button"
            class="switch-option" role="menuitemradio"
            :aria-checked="tenantStore.currentTenantId === tenant.tenantId"
            :disabled="tenantStore.isSwitching"
            @click="selectTenant(tenant.tenantId, tenant.name)">
            <span class="option-mark">{{ tenant.name.charAt(0).toUpperCase() || '?' }}</span>
            <span class="option-copy"><strong>{{ tenant.name }}</strong><small>{{ roleLabel(tenant.role) }}</small></span>
            <PushpinFilled v-if="tenant.pinned" class="preference-icon" aria-label="已置顶" />
            <StarFilled v-if="tenant.favorite" class="preference-icon" aria-label="已收藏" />
            <CheckOutlined v-if="tenantStore.currentTenantId === tenant.tenantId" class="current-icon" />
          </button>
          <div v-if="visibleTenants.length === 0" class="switch-empty">
            {{ tenantStore.tenants.length ? '没有匹配的租户' : '暂未加入租户' }}
          </div>
        </div>
        <router-link class="all-tenants" to="/tenants" @click="close">查看全部租户</router-link>
        <template v-if="tenantStore.tenants.length === 0">
          <router-link class="all-tenants" to="/tenants?action=create" @click="close">创建租户</router-link>
          <router-link class="all-tenants" to="/tenants?action=join" @click="close">加入租户</router-link>
        </template>
      </div>
    </Transition>
  </div>
</template>

<style lang="scss" scoped>
.tenant-switcher { position: relative; flex: 0 0 auto; padding: 4px 10px 10px; z-index: 20; }
.switch-trigger { display: flex; align-items: center; gap: 9px; width: 100%; min-height: 54px; padding: 6px 8px; border: 1px solid $color-border; border-radius: $radius-button; background: $color-bg; color: $color-text-primary; text-align: left; cursor: pointer; transition: background .15s ease, border-color .15s ease, box-shadow .15s ease; }
.switch-trigger:hover, .switch-trigger[aria-expanded='true'] { background: $color-bg-secondary; }
.switch-trigger[aria-expanded='true'] { border-color: rgba($color-primary, .35); box-shadow: 0 0 0 2px rgba($color-primary, .06); }
.switch-trigger:focus-visible, .switch-option:focus-visible, .all-tenants:focus-visible { outline: 2px solid $color-primary; outline-offset: 2px; }
.tenant-mark, .option-mark { display: grid; place-items: center; flex: 0 0 30px; width: 30px; height: 30px; border-radius: 7px; background: rgba($color-primary, .1); color: $color-primary; font-weight: 600; }
.trigger-copy, .option-copy { display: flex; flex: 1; flex-direction: column; min-width: 0; }
.trigger-copy strong, .option-copy strong { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; font-size: 13px; }
.trigger-copy small, .option-copy small { color: $color-text-secondary; font-size: 11px; }
.trigger-arrow { flex: none; color: $color-text-secondary; font-size: 11px; transition: transform .2s ease; }
.trigger-arrow.expanded { transform: rotate(180deg); }
.switch-menu { position: absolute; top: calc(100% - 5px); left: 10px; width: 260px; padding: 10px; border: 1px solid $color-border; border-radius: $radius-card; background: $color-bg; box-shadow: $shadow-light; }
.switch-menu-enter-active, .switch-menu-leave-active { transition: opacity .16s ease, transform .16s ease; }
.switch-menu-enter-from, .switch-menu-leave-to { opacity: 0; transform: translateY(-4px); }
.switch-heading { display: flex; gap: 7px; align-items: center; padding: 4px 2px 10px; color: $color-text-secondary; font-size: 12px; }
.switch-options { max-height: 270px; overflow-y: auto; margin: 7px 0; }
.switch-option { display: flex; align-items: center; gap: 8px; width: 100%; padding: 7px 5px; border: 0; border-radius: $radius-button; background: transparent; color: $color-text-primary; text-align: left; cursor: pointer; }
.switch-option:hover { background: $color-bg-secondary; }
.switch-option:disabled { cursor: wait; opacity: .6; }
.option-mark { flex-basis: 27px; width: 27px; height: 27px; font-size: 12px; }
.current-icon { color: $color-primary; }
.preference-icon { color: $color-primary; font-size: 12px; }
.switch-empty { padding: 16px 6px; color: $color-text-secondary; text-align: center; font-size: 12px; }
.all-tenants { display: block; padding: 9px 5px; border-top: 1px solid $color-border; color: $color-primary; font-size: 13px; }
.tenant-switcher.collapsed .switch-trigger { justify-content: center; padding: 6px 0; }
.tenant-switcher.collapsed .switch-menu { top: 0; left: calc(100% + 6px); }
.tenant-switcher.collapsed .switch-menu-enter-from, .tenant-switcher.collapsed .switch-menu-leave-to { transform: translateX(-4px); }
@media (max-width: 760px) { .switch-menu { width: calc(100% - 20px); } }
@media (prefers-reduced-motion: reduce) {
  .switch-trigger, .trigger-arrow, .switch-menu-enter-active, .switch-menu-leave-active { transition: none; }
}
</style>
