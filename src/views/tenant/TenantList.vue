<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { message } from 'ant-design-vue'
import { PlusOutlined, PushpinFilled, PushpinOutlined, SearchOutlined, StarFilled, StarOutlined } from '@ant-design/icons-vue'
import { getTenantOverviewBatch } from '@/api/tenant'
import { useTenantStore } from '@/stores/tenant'
import TenantFormModal from './TenantFormModal.vue'
import TenantJoinModal from './TenantJoinModal.vue'
import { formatDate } from '@/utils/date'
import type { TenantInfoListRespDTO, TenantOverviewBatch, TenantOverviewItem } from '@/types/tenant'

const router = useRouter()
const route = useRoute()
const tenantStore = useTenantStore()

const loading = ref(false)
const searchQuery = ref('')
const loadError = ref(false)
const switchingId = ref<string | null>(null)
const overview = ref<TenantOverviewBatch | null>(null)
const overviewLoading = ref(false)
const overviewError = ref(false)
const filterMode = ref<'all' | 'favorite' | 'admin' | 'member' | 'personal'>('all')
const sortMode = ref<'recent' | 'name' | 'pending'>('recent')
let overviewSequence = 0

// Modal state
const createModalVisible = ref(false)
const joinModalVisible = ref(false)

const overviewById = computed(() => new Map<string, TenantOverviewItem>(
  overview.value?.items.map((item) => [item.tenantId, item]) ?? [],
))
const managedCount = computed(() => tenantStore.tenants.filter((tenant) => tenant.role !== 'MEMBER').length)
const favoriteCount = computed(() => tenantStore.tenants.filter((tenant) => tenant.favorite).length)
const memberCount = computed(() => tenantStore.tenants.filter((tenant) => tenant.role === 'MEMBER').length)
const personalCount = computed(() => tenantStore.tenants.filter((tenant) => tenant.type === 'PERSONAL').length)
const pendingTotal = computed(() => {
  if (!overview.value) return null
  // 管理员待办聚合失败时保留未知状态，避免把不可用误显示为 0。
  return tenantStore.tenants
    .filter((tenant) => tenant.type === 'TEAM' && tenant.role !== 'MEMBER')
    .reduce<number | null>((sum, tenant) => {
      const count = overviewById.value.get(tenant.tenantId)?.pendingJoinRequestCount
      return sum == null || count == null ? null : sum + count
    }, 0)
})
const todoTenants = computed(() => tenantStore.tenants.filter((tenant) =>
  (overviewById.value.get(tenant.tenantId)?.pendingJoinRequestCount ?? 0) > 0,
))

function formatCount(value: string | number | null | undefined) {
  if (value == null) return '—'
  try { return BigInt(value).toLocaleString('zh-CN') } catch { return '—' }
}

function recentTime(tenant: TenantInfoListRespDTO) {
  return tenant.lastAccessedAt ? (Date.parse(tenant.lastAccessedAt) || 0) : 0
}

// 置顶始终优先，其余按用户选择的顺序排列。
const filteredTenants = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  return tenantStore.tenants.filter((tenant) => {
    if (q && !tenant.name.toLowerCase().includes(q) && !tenant.tenantId.includes(q)) return false
    if (filterMode.value === 'favorite') return tenant.favorite
    if (filterMode.value === 'admin') return tenant.role !== 'MEMBER'
    if (filterMode.value === 'member') return tenant.role === 'MEMBER'
    if (filterMode.value === 'personal') return tenant.type === 'PERSONAL'
    return true
  }).sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
    if (sortMode.value === 'name') return a.name.localeCompare(b.name, 'zh-CN')
    if (sortMode.value === 'pending' && overview.value) {
      const difference = (overviewById.value.get(b.tenantId)?.pendingJoinRequestCount ?? 0)
        - (overviewById.value.get(a.tenantId)?.pendingJoinRequestCount ?? 0)
      if (difference) return difference
    }
    return recentTime(b) - recentTime(a) || a.name.localeCompare(b.name, 'zh-CN')
  })
})

const columns = [
  { title: '租户名称', dataIndex: 'name', key: 'name', width: 280 },
  { title: '类型', dataIndex: 'type', key: 'type' },
  { title: '我的角色', dataIndex: 'role', key: 'role' },
  { title: '成员 / 服务', key: 'counts', width: 125 },
  { title: '近 30 天用量', key: 'usage', width: 175 },
  { title: '待审批', key: 'pending', width: 95 },
  { title: '加入时间', dataIndex: 'joinedAt', key: 'joinedAt' },
  { title: '最近访问', dataIndex: 'lastAccessedAt', key: 'lastAccessedAt' },
  { title: '操作', key: 'action', width: 270 },
]

async function loadOverview() {
  const sequence = ++overviewSequence
  overview.value = null
  overviewError.value = false
  overviewLoading.value = false
  if (tenantStore.tenants.length === 0) return
  overviewLoading.value = true
  try {
    const result = await getTenantOverviewBatch()
    if (sequence === overviewSequence) overview.value = result
  } catch {
    if (sequence === overviewSequence) overviewError.value = true
  } finally {
    if (sequence === overviewSequence) overviewLoading.value = false
  }
}

async function loadTenants() {
  loading.value = true
  loadError.value = false
  try {
    await tenantStore.fetchTenants()
    void loadOverview()
  } catch {
    loadError.value = true
    overview.value = null
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await loadTenants()
})

// 侧栏快捷入口可直接打开创建或加入弹窗，包括已在列表页时的跳转。
watch(() => route.query.action, (action) => {
  if (action === 'create') createModalVisible.value = true
  else if (action === 'join') joinModalVisible.value = true
  else return
  void router.replace({ query: {} })
}, { immediate: true })

async function handleSwitchTenant(record: TenantInfoListRespDTO) {
  if (record.current) {
    await router.push('/dashboard')
    return
  }
  switchingId.value = record.tenantId
  try {
    const switched = await tenantStore.switchToTenant(record.tenantId)
    if (!switched) return
    message.success(`已切换到「${record.name}」`)
    await router.push('/dashboard')
  } catch {
    // handled by interceptor
  } finally {
    switchingId.value = null
  }
}

async function handleCreateDone() {
  await loadTenants()
}

async function toggleFavorite(record: TenantInfoListRespDTO) {
  try {
    await tenantStore.setPreference(record.tenantId, !record.favorite, record.pinned)
  } catch {
    // 请求拦截器已提示；保持服务端确认前的显示状态。
  }
}

async function togglePin(record: TenantInfoListRespDTO) {
  try {
    await tenantStore.setPreference(record.tenantId, record.favorite, !record.pinned)
  } catch {
    // 请求拦截器已提示；保持服务端确认前的显示状态。
  }
}
</script>

<template>
  <div class="tenant-list">
    <div class="page-eyebrow">WORKSPACES</div>
    <div class="page-header">
      <div>
        <h2 class="page-title">我的租户</h2>
        <p class="page-desc">一处了解你加入的租户、待办事项和近期使用情况。查看其他租户不会改变当前租户。</p>
      </div>
      <div class="page-actions">
        <a-button @click="joinModalVisible = true">
          加入租户
        </a-button>
        <a-button type="primary" @click="createModalVisible = true">
          <PlusOutlined />
          创建租户
        </a-button>
      </div>
    </div>

    <section v-if="!loadError" class="overview-summary" aria-label="租户汇总">
      <div class="summary-tile">
        <span class="summary-label">已加入租户</span>
        <strong>{{ tenantStore.tenants.length }}</strong>
        <small>团队与个人租户</small>
      </div>
      <div class="summary-tile">
        <span class="summary-label">我管理的</span>
        <strong>{{ managedCount }}</strong>
        <small>可处理成员与配置</small>
      </div>
      <div class="summary-tile summary-pending">
        <span class="summary-label">待处理申请</span>
        <strong>{{ overviewLoading ? '…' : formatCount(pendingTotal) }}</strong>
        <small>来自我管理的租户</small>
      </div>
      <div class="summary-tile">
        <span class="summary-label">已收藏</span>
        <strong>{{ favoriteCount }}</strong>
        <small>常用租户快速定位</small>
      </div>
    </section>
    <div v-if="overview && !loadError" class="summary-window">
      近 30 天：{{ overview.from.slice(0, 10) }} 至 {{ overview.to.slice(0, 10) }}（不含）。
      <span v-if="overview.updatedAt">数据更新于 {{ overview.updatedAt.replace('T', ' ').slice(0, 16) }}</span>
    </div>

    <a-alert v-if="overviewError && !loadError" class="summary-alert" type="warning" show-icon
      message="摘要暂时不可用，租户列表仍可查看和切换。">
      <template #action><a-button size="small" @click="loadOverview">重试摘要</a-button></template>
    </a-alert>

    <a-alert v-if="todoTenants.length && !loadError" class="summary-alert" type="info" show-icon
      :message="`有 ${formatCount(pendingTotal)} 条加入申请等待处理`">
      <template #description>
        <router-link v-for="tenant in todoTenants" :key="tenant.tenantId" class="todo-link"
          :to="{ path: `/tenants/${tenant.tenantId}`, query: { tab: 'invites' } }">
          {{ tenant.name }}（{{ overviewById.get(tenant.tenantId)?.pendingJoinRequestCount }}）
        </router-link>
      </template>
    </a-alert>

    <a-card v-if="loadError" :bordered="false">
      <a-result status="error" title="租户列表加载失败" sub-title="请重试读取你已加入的租户。">
        <template #extra><a-button type="primary" @click="loadTenants">重试</a-button></template>
      </a-result>
    </a-card>
    <section v-else class="list-card" aria-labelledby="tenant-list-heading">
      <div class="list-toolbar">
        <div>
          <h3 id="tenant-list-heading">租户列表</h3>
          <p>点击名称查看只读概览；“切换并进入”会更新当前租户。</p>
        </div>
        <div class="list-controls">
          <a-input v-model:value="searchQuery" class="list-search" placeholder="搜索名称或租户 ID" allow-clear aria-label="搜索租户名称或 ID">
            <template #prefix><SearchOutlined /></template>
          </a-input>
          <a-select v-model:value="sortMode" class="list-sort" aria-label="租户排序">
            <a-select-option value="recent">最近访问</a-select-option>
            <a-select-option value="name">名称排序</a-select-option>
            <a-select-option value="pending" :disabled="!overview">待办优先</a-select-option>
          </a-select>
        </div>
      </div>
      <div class="list-filters" role="group" aria-label="租户筛选">
        <button type="button" :class="['filter-button', { active: filterMode === 'all' }]" :aria-pressed="filterMode === 'all'" @click="filterMode = 'all'">全部 <span>{{ tenantStore.tenants.length }}</span></button>
        <button type="button" :class="['filter-button', { active: filterMode === 'favorite' }]" :aria-pressed="filterMode === 'favorite'" @click="filterMode = 'favorite'">已收藏 <span>{{ favoriteCount }}</span></button>
        <button type="button" :class="['filter-button', { active: filterMode === 'admin' }]" :aria-pressed="filterMode === 'admin'" @click="filterMode = 'admin'">我管理的 <span>{{ managedCount }}</span></button>
        <button type="button" :class="['filter-button', { active: filterMode === 'member' }]" :aria-pressed="filterMode === 'member'" @click="filterMode = 'member'">我参与的 <span>{{ memberCount }}</span></button>
        <button type="button" :class="['filter-button', { active: filterMode === 'personal' }]" :aria-pressed="filterMode === 'personal'" @click="filterMode = 'personal'">个人租户 <span>{{ personalCount }}</span></button>
      </div>
      <a-table
        :columns="columns"
        :data-source="filteredTenants"
        :loading="loading"
        row-key="tenantId"
        :pagination="false"
        :scroll="{ x: 1320 }"
      >
        <template #bodyCell="{ column, record }">
          <!-- 租户名称 - 可点击链接 -->
          <template v-if="column.key === 'name'">
            <div class="tenant-name-cell">
              <div class="tenant-name-main">
                <router-link class="tenant-name-link" :to="`/tenants/${record.tenantId}`" :title="record.name">{{ record.name }}</router-link>
                <div class="tenant-preferences">
                  <button type="button" :class="['preference-button', { active: record.favorite }]"
                    :aria-label="record.favorite ? `取消收藏 ${record.name}` : `收藏 ${record.name}`"
                    :aria-pressed="record.favorite"
                    :title="record.favorite ? '取消收藏' : '收藏'"
                    :disabled="tenantStore.preferenceSavingIds.includes(record.tenantId)"
                    @click="toggleFavorite(record)">
                    <StarFilled v-if="record.favorite" /><StarOutlined v-else />
                  </button>
                  <button type="button" :class="['preference-button', { active: record.pinned }]"
                    :aria-label="record.pinned ? `取消置顶 ${record.name}` : `置顶 ${record.name}`"
                    :aria-pressed="record.pinned"
                    :title="record.pinned ? '取消置顶' : '置顶'"
                    :disabled="tenantStore.preferenceSavingIds.includes(record.tenantId)"
                    @click="togglePin(record)">
                    <PushpinFilled v-if="record.pinned" /><PushpinOutlined v-else />
                  </button>
                </div>
                <a-tag v-if="record.current" color="green" class="current-tag">当前</a-tag>
              </div>
            </div>
          </template>
          <template v-if="column.key === 'counts'">
            {{ formatCount(overviewById.get(record.tenantId)?.memberCount) }} 人 /
            {{ formatCount(overviewById.get(record.tenantId)?.availableServiceCount) }} 服务
          </template>
          <template v-if="column.key === 'usage'">
            <template v-if="overviewById.get(record.tenantId)?.usage">
              <a-tooltip :title="overviewById.get(record.tenantId)?.usage?.tokenQuality === 'PARTIAL' ? 'Token 用量不完整' : ''">
                <span>{{ formatCount(overviewById.get(record.tenantId)?.usage?.totalTokens) }} Token</span>
              </a-tooltip>
              <small class="usage-note">
                {{ overviewById.get(record.tenantId)?.usage?.scope === 'SELF' ? '本人' : '租户' }} ·
                {{ formatCount(overviewById.get(record.tenantId)?.usage?.requestCount) }} 次请求
                <span v-if="overviewById.get(record.tenantId)?.usage?.tokenQuality === 'PARTIAL'"> · 部分估算</span>
              </small>
            </template>
            <span v-else>—</span>
          </template>
          <template v-if="column.key === 'pending'">
            <router-link v-if="(overviewById.get(record.tenantId)?.pendingJoinRequestCount ?? 0) > 0"
              :to="{ path: `/tenants/${record.tenantId}`, query: { tab: 'invites' } }">
              <a-badge :count="overviewById.get(record.tenantId)?.pendingJoinRequestCount" />
            </router-link>
            <span v-else>{{ overviewById.get(record.tenantId)?.pendingJoinRequestCount === 0 ? '无待办' : '—' }}</span>
          </template>
          <!-- 类型 -->
          <template v-if="column.key === 'type'">
            <a-tag :color="record.type === 'PERSONAL' ? 'default' : 'blue'">
              {{ record.type === 'PERSONAL' ? '个人租户' : '团队租户' }}
            </a-tag>
          </template>
          <!-- 角色 -->
          <template v-if="column.key === 'role'">
            <a-tag
              :color="
                record.role === 'SUPER_ADMIN'
                  ? 'red'
                  : record.role === 'ADMIN'
                    ? 'orange'
                    : 'default'
              "
            >
              {{
                record.role === 'SUPER_ADMIN'
                  ? '超级管理员'
                  : record.role === 'ADMIN'
                    ? '管理员'
                    : '成员'
              }}
            </a-tag>
          </template>
          <!-- 加入时间 -->
          <template v-if="column.key === 'joinedAt'">
            {{ formatDate(record.joinedAt) }}
          </template>
          <!-- 最近访问 -->
          <template v-if="column.key === 'lastAccessedAt'">
            {{
              record.lastAccessedAt
                ? formatDate(record.lastAccessedAt)
                : '从未访问'
            }}
          </template>
          <!-- 操作 -->
          <template v-if="column.key === 'action'">
            <a-space :size="4">
              <router-link :to="`/tenants/${record.tenantId}`">查看概览</router-link>
              <a-button type="link" size="small"
                :loading="switchingId === record.tenantId"
                :disabled="tenantStore.isSwitching"
                @click="handleSwitchTenant(record)">
                {{ record.current ? '进入工作台' : '切换并进入' }}
              </a-button>
            </a-space>
          </template>
        </template>

        <!-- Empty state -->
        <template #emptyText>
          <a-empty
            :description="searchQuery || filterMode !== 'all' ? '没有匹配的租户' : '还没有加入任何租户'"
          >
            <a-space v-if="searchQuery || filterMode !== 'all'">
              <a-button @click="searchQuery = ''; filterMode = 'all'">清除筛选</a-button>
            </a-space>
            <a-space v-else>
              <a-button type="primary" @click="createModalVisible = true">创建租户</a-button>
              <a-button @click="joinModalVisible = true">加入租户</a-button>
            </a-space>
          </a-empty>
        </template>
      </a-table>
    </section>

    <!-- Create Modal -->
    <TenantFormModal
      v-model:visible="createModalVisible"
      mode="create"
      @done="handleCreateDone"
    />

    <!-- Join Modal -->
    <TenantJoinModal
      v-model:visible="joinModalVisible"
      @done="loadTenants"
    />
  </div>
</template>

<style lang="scss" scoped>
.tenant-list {
  width: 100%;
  min-width: 0;
}

.page-eyebrow {
  margin-bottom: 8px;
  color: $color-primary;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 1px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 20px;
  margin-bottom: 26px;

  .page-title {
    font-size: 27px;
    font-weight: 700;
    color: $color-text-primary;
    margin: 0 0 8px 0;
  }

  .page-desc {
    color: $color-text-secondary;
    margin: 0;
    line-height: 1.6;
  }
}

.page-actions {
  display: flex;
  gap: 12px;
  align-items: center;
}

.tenant-name-cell { min-width: 0; }
.tenant-name-main {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
}
.tenant-name-link {
  display: block;
  min-width: 0;
  overflow: hidden;
  color: $color-primary;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;

  &:hover {
    color: var(--verse-adaptive-link-hover, #4096ff);
  }
}

.current-tag { flex: none; margin: 0 0 0 2px; }

.overview-summary {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin-bottom: 22px;
  overflow: hidden;
  border: 1px solid $color-border;
  border-radius: $radius-card;
  background: $color-bg;
  box-shadow: 0 5px 24px rgba(24, 39, 68, .045);
}
.summary-tile {
  display: flex;
  min-width: 0;
  flex-direction: column;
  align-items: flex-start;
  padding: 22px 24px;
  border-right: 1px solid $color-border;

  &:last-child { border-right: 0; }
  .summary-label { color: $color-text-secondary; font-size: 12px; }
  strong { margin: 7px 0 4px; color: $color-text-primary; font-size: 26px; line-height: 1.2; }
  small { color: var(--verse-adaptive-text-tertiary, #98a2b3); font-size: 11px; }
}
.summary-pending strong { color: var(--verse-adaptive-warning, #b54708); }
.summary-window { margin: -12px 0 18px; color: $color-text-secondary; font-size: $font-size-caption; }
.summary-alert { margin-bottom: 16px; }
.todo-link { display: inline-block; margin: 5px 14px 0 0; }
.list-card {
  width: 100%;
  overflow: hidden;
  border: 1px solid $color-border;
  border-radius: $radius-card;
  background: $color-bg;
  box-shadow: 0 5px 24px rgba(24, 39, 68, .045);
}
.list-toolbar {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  padding: 20px 22px 16px;

  h3 { margin: 0 0 4px; color: $color-text-primary; font-size: 16px; font-weight: 650; }
  p { margin: 0; color: $color-text-secondary; font-size: 12px; }
}
.list-controls { display: flex; align-items: center; gap: 9px; flex-wrap: wrap; }
.list-search { width: 250px; }
.list-sort { width: 130px; }
.list-filters {
  display: flex;
  align-items: center;
  gap: 6px;
  overflow-x: auto;
  padding: 12px 22px;
  border-top: 1px solid $color-border;
}
.filter-button {
  flex: none;
  padding: 7px 12px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: $color-text-secondary;
  font-size: 12px;
  cursor: pointer;

  &:hover { background: var(--verse-adaptive-hover, #f4f7fb); }
  &.active { background: var(--verse-adaptive-selected, #e8f3ff); color: var(--verse-adaptive-link, #0958d9); font-weight: 650; }
  span { margin-left: 4px; opacity: .72; }
}
.tenant-preferences { display: inline-flex; flex: none; align-items: center; gap: 2px; }
.preference-button {
  display: inline-flex;
  flex: none;
  width: 26px;
  height: 26px;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--verse-adaptive-text-tertiary, #98a2b3);
  font-size: 16px;
  line-height: 1;
  cursor: pointer;

  &.active { color: $color-primary; }
  &:hover:not(:disabled) { background: var(--verse-adaptive-selected, #e8f3ff); color: $color-primary; }
  &:focus-visible { outline: 2px solid $color-primary; outline-offset: 1px; }
  &:disabled { cursor: wait; }
  :deep(svg) { display: block; width: 16px; height: 16px; }
}
.usage-note { display: block; margin-top: 3px; color: $color-text-secondary; font-size: $font-size-caption; }

@media (max-width: 1100px) {
  .overview-summary { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .summary-tile:nth-child(2) { border-right: 0; }
  .summary-tile:nth-child(-n+2) { border-bottom: 1px solid $color-border; }
  .list-toolbar { align-items: flex-start; flex-direction: column; }
}

@media (max-width: 900px) {
  .page-header { flex-direction: column; gap: 16px; }
  .page-actions { flex-wrap: wrap; }
  .list-controls { width: 100%; }
  .list-search { flex: 1; min-width: 220px; }
}

@media (max-width: 560px) {
  .page-header .page-title { font-size: 24px; }
  .summary-tile { padding: 16px; }
  .summary-tile strong { font-size: 23px; }
  .list-sort { width: 100%; }
}
</style>
