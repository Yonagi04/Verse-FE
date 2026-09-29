<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRoute, useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { CameraOutlined, CheckCircleFilled, KeyOutlined, PlusOutlined, TeamOutlined, UserAddOutlined } from '@ant-design/icons-vue'
import { getTenantOverview, selectTenantBannerPreset, uploadTenantBanner, uploadTenantLogo } from '@/api/tenant'
import { listLlmServices } from '@/api/llmService'
import { getUsageOverview } from '@/api/usage'
import { useTenantStore } from '@/stores/tenant'
import { formatDate, formatDateTime } from '@/utils/date'
import ImageCropModal from '@/components/ImageCropModal.vue'
import TenantCloseModal from './TenantCloseModal.vue'
import TenantInviteTab from './TenantInviteTab.vue'
import TenantLeaveModal from './TenantLeaveModal.vue'
import TenantMemberTab from './TenantMemberTab.vue'
import TenantNotificationModal from './TenantNotificationModal.vue'
import TenantSettingsTab from './TenantSettingsTab.vue'
import TenantRecentActivity from './TenantRecentActivity.vue'
import TenantAnnouncementBanner from './TenantAnnouncementBanner.vue'
import type { TenantInfoRespDTO, TenantOverviewDetail } from '@/types/tenant'
import type { Role } from '@/types/user'

const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp']
const MAX_FILE_SIZE = 5 * 1024 * 1024
const BANNER_PRESETS = ['01', '02', '03', '04'].map((id) => ({
  id,
  url: `/images/tenant-cover-${id}.png`,
}))

const route = useRoute()
const router = useRouter()
const tenantStore = useTenantStore()

const tenantId = computed(() => String(route.params.tenantId))
const tenant = ref<TenantInfoRespDTO | null>(null)
const loading = ref(true)
const detailError = ref(false)
const overview = ref<TenantOverviewDetail | null>(null)
const overviewError = ref(false)
const overviewLoading = ref(false)
const logoUploading = ref(false)
const bannerUploading = ref(false)
const selectingBannerPreset = ref<string | null>(null)
const logoInputRef = ref<HTMLInputElement | null>(null)
const bannerInputRef = ref<HTMLInputElement | null>(null)
const cropOpen = ref(false)
const cropFile = ref<File | null>(null)
const cropKind = ref<'logo' | 'banner'>('banner')

const bannerPickerVisible = ref(false)
const notificationModalVisible = ref(false)
const announcementRefreshKey = ref(0)
const closeModalVisible = ref(false)
const leaveModalVisible = ref(false)

const activeTab = ref('home')
const switching = computed(() => tenantStore.isSwitching)

const currentTenantEntry = computed(() =>
  tenantStore.tenants.find((item) => item.tenantId === tenantId.value),
)
const currentRole = computed<Role | undefined>(() => tenant.value?.role ?? currentTenantEntry.value?.role)
const isCurrentTenant = computed(() => tenantStore.currentTenant?.tenantId === tenantId.value)
const canEdit = computed(() => currentRole.value === 'SUPER_ADMIN' || currentRole.value === 'ADMIN')
const canNotify = computed(() => canEdit.value && tenant.value?.type === 'TEAM')
const tenantInitial = computed(() => tenant.value?.name.trim().charAt(0).toUpperCase() || 'V')
const bannerStyle = computed(() => tenant.value?.bannerUrl
  ? { backgroundImage: `url(${tenant.value.bannerUrl})` }
  : undefined)
const currentBannerPreset = computed(() => {
  if (!tenant.value?.bannerUrl) return '01'
  return BANNER_PRESETS.find(({ url }) => tenant.value?.bannerUrl?.endsWith(url))?.id
})

const roleLabel = computed(() => {
  if (currentRole.value === 'SUPER_ADMIN') return '超级管理员'
  if (currentRole.value === 'ADMIN') return '管理员'
  return '成员'
})

function requestedTab() {
  const tab = route.query.tab
  return typeof tab === 'string' && ['members', 'invites', 'settings'].includes(tab) ? tab : 'home'
}

function permittedTab(tab: string) {
  if (tab === 'members') return tenant.value?.type === 'TEAM'
  if (tab === 'invites') return tenant.value?.type === 'TEAM' && canEdit.value
  return true
}

function syncTab() {
  const tab = requestedTab()
  activeTab.value = permittedTab(tab) ? tab : 'home'
  if (isCurrentTenant.value && tab !== 'home' && activeTab.value === 'home') {
    message.warning('当前角色无法访问该页签，已返回租户首页')
  }
}

const monthUsage = ref<{ totalTokens: string; requestCount: string } | null>(null)
const availableServiceCount = ref<number | null>(null)
let detailSequence = 0
let metricsSequence = 0
let overviewSequence = 0

function formatCount(value: string | number | null | undefined) {
  if (value == null) return '—'
  try { return BigInt(value).toLocaleString('zh-CN') } catch { return '—' }
}

async function fetchHomeMetrics() {
  const id = tenantId.value
  const sequence = ++metricsSequence
  monthUsage.value = null
  availableServiceCount.value = null
  const month = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' }).slice(0, 7)
  const from = `${month}-01T00:00:00`
  const [usageResult, servicesResult] = await Promise.allSettled([
    getUsageOverview(id, { from }),
    fetchAvailableServiceCount(id),
  ])
  if (sequence !== metricsSequence) return
  monthUsage.value = usageResult.status === 'fulfilled' ? usageResult.value : null
  availableServiceCount.value = servicesResult.status === 'fulfilled' ? servicesResult.value : null
}

async function fetchAvailableServiceCount(id: string) {
  const pageSize = 100
  const first = await listLlmServices(id, 1, pageSize)
  let count = first.serviceInfoList.filter((service) => service.status === 1).length
  for (let page = 2; page <= first.totalPages; page++) {
    const result = await listLlmServices(id, page, pageSize)
    count += result.serviceInfoList.filter((service) => service.status === 1).length
  }
  return count
}

function switchTab(key: string) {
  if (tenantStore.settingsDirty && key !== 'settings'
      && !window.confirm('租户设置有未保存的更改，确定离开吗？')) return
  activeTab.value = key
  router.replace({ query: { tab: key === 'home' ? undefined : key } })
}

onBeforeRouteLeave(() => {
  if (tenantStore.settingsDirty) return window.confirm('租户设置有未保存的更改，确定离开吗？')
})
onBeforeRouteUpdate((to) => {
  if (tenantStore.settingsDirty && (to.params.tenantId !== route.params.tenantId || to.query.tab !== 'settings')) {
    return window.confirm('租户设置有未保存的更改，确定离开吗？')
  }
})

async function fetchDetail() {
  const id = tenantId.value
  const sequence = ++detailSequence
  ++overviewSequence
  tenant.value = null
  overview.value = null
  overviewError.value = false
  overviewLoading.value = false
  detailError.value = false
  loading.value = true
  try {
    const result = await tenantStore.fetchTenantInfo(id)
    if (sequence === detailSequence) {
      tenant.value = result
      syncTab()
      if (!isCurrentTenant.value) void fetchOverview(id)
    }
  } catch {
    if (sequence === detailSequence) detailError.value = true
  } finally {
    if (sequence === detailSequence) loading.value = false
  }
}

async function fetchOverview(id = tenantId.value) {
  const sequence = ++overviewSequence
  overviewLoading.value = true
  overviewError.value = false
  try {
    const result = await getTenantOverview(id)
    if (sequence === overviewSequence && id === tenantId.value) overview.value = result
  } catch {
    if (sequence === overviewSequence) overviewError.value = true
  } finally {
    if (sequence === overviewSequence) overviewLoading.value = false
  }
}

onMounted(async () => {
  await fetchDetail()
  if (tenant.value && isCurrentTenant.value) void fetchHomeMetrics()
  if (tenantStore.tenants.length === 0) {
    try { await tenantStore.fetchTenants() } catch { /* 基础详情仍可独立显示。 */ }
  }
})
watch(tenantId, () => {
  void fetchDetail()
  if (isCurrentTenant.value) void fetchHomeMetrics()
})
watch(() => route.query.tab, syncTab)
watch(isCurrentTenant, (current) => {
  if (current) {
    // 当前租户已有首页统计和管理页签，停止跨租户授权摘要请求并清空旧结果。
    overviewSequence++
    overview.value = null
    overviewError.value = false
    overviewLoading.value = false
    syncTab()
    void fetchHomeMetrics()
  } else {
    metricsSequence++
    monthUsage.value = null
    availableServiceCount.value = null
    if (tenant.value) void fetchOverview(tenantId.value)
  }
})

async function handleSwitchTenant() {
  if (!tenant.value || switching.value) return
  try {
    const switched = await tenantStore.switchToTenant(tenantId.value)
    if (!switched) return
    message.success(`已切换到「${tenant.value.name}」`)
    await fetchDetail()
    const tab = requestedTab()
    if (tab !== 'home') {
      if (!permittedTab(tab)) await router.replace({ path: route.path })
      return
    }
    if (canEdit.value) await router.replace({ path: route.path, query: { tab: 'settings' } })
    else await router.push('/dashboard')
  } catch {
    // 请求错误由统一拦截器提示，保留原当前租户。
  }
}

function validateImage(file: File) {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    message.error('图片格式不支持，仅允许 PNG、JPG、WebP')
    return false
  }
  if (file.size > MAX_FILE_SIZE) {
    message.error('图片大小不能超过 5MB')
    return false
  }
  return true
}

function handleMediaChange(event: Event, kind: 'logo' | 'banner') {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file || !validateImage(file)) {
    input.value = ''
    return
  }

  cropKind.value = kind
  cropFile.value = file
  cropOpen.value = true
  input.value = ''
  if (kind === 'banner') bannerPickerVisible.value = false
}

async function handleCropConfirm(file: File) {
  const kind = cropKind.value
  const uploading = kind === 'logo' ? logoUploading : bannerUploading
  uploading.value = true
  try {
    if (kind === 'logo') {
      await uploadTenantLogo(tenantId.value, file)
    } else {
      await uploadTenantBanner(tenantId.value, file)
    }
    await fetchDetail()
    cropOpen.value = false
    cropFile.value = null
    message.success(kind === 'logo' ? '租户头像已更新' : '租户头图已更新')
  } catch {
    // handled by interceptor
  } finally {
    uploading.value = false
  }
}

async function handleSelectBannerPreset(presetId: string) {
  if (selectingBannerPreset.value) return

  selectingBannerPreset.value = presetId
  try {
    await selectTenantBannerPreset(tenantId.value, presetId)
    await fetchDetail()
    bannerPickerVisible.value = false
    message.success(`已使用头图 ${presetId}`)
  } catch {
    // handled by interceptor
  } finally {
    selectingBannerPreset.value = null
  }
}

async function handleCloseDone() {
  await tenantStore.fetchTenants()
  await router.push(tenantStore.currentTenantId ? '/dashboard' : '/tenants')
}
async function handleLeaveDone() {
  await tenantStore.fetchTenants()
  await router.push(tenantStore.currentTenantId ? '/dashboard' : '/tenants')
}
</script>

<template>
  <div class="tenant-detail">
    <a-breadcrumb class="detail-breadcrumb">
      <a-breadcrumb-item><router-link to="/tenants">我的租户</router-link></a-breadcrumb-item>
      <a-breadcrumb-item>{{ tenant?.name || '租户空间' }}</a-breadcrumb-item>
    </a-breadcrumb>

    <a-spin :spinning="loading">
      <div v-if="tenant" class="tenant-page">
        <a-card :bordered="false" class="tenant-hero-card">
          <div
            class="tenant-cover"
            :class="{ 'default-cover': !tenant.bannerUrl, uploading: bannerUploading }"
            :style="bannerStyle"
          >
            <a-button
              v-if="isCurrentTenant && canEdit"
              class="cover-action"
              :loading="bannerUploading"
              @click="bannerPickerVisible = true"
            >
              <CameraOutlined />
              更换头图
            </a-button>
            <input
              ref="bannerInputRef"
              class="file-hidden"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              @change="handleMediaChange($event, 'banner')"
            />
          </div>

          <div class="tenant-summary">
            <div
              class="tenant-logo"
              :class="{ editable: isCurrentTenant && canEdit, uploading: logoUploading }"
              @click="isCurrentTenant && canEdit && logoInputRef?.click()"
            >
              <img v-if="tenant.logoUrl" :src="tenant.logoUrl" :alt="`${tenant.name} Logo`" />
              <span v-else>{{ tenantInitial }}</span>
              <div v-if="isCurrentTenant && canEdit" class="logo-edit-mask">
                <CameraOutlined />
              </div>
            </div>
            <input
              ref="logoInputRef"
              class="file-hidden"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              @change="handleMediaChange($event, 'logo')"
            />

            <div class="tenant-copy">
              <div class="tenant-title-row">
                <h1>{{ tenant.name }}</h1>
                <a-tag :color="tenant.type === 'TEAM' ? 'blue' : 'default'">
                  {{ tenant.type === 'TEAM' ? '团队租户' : '个人租户' }}
                </a-tag>
                <a-tag v-if="!isCurrentTenant" color="gold">只读查看</a-tag>
              </div>
              <div class="tenant-meta">
                <span>ID: {{ tenant.tenantId }}</span>
                <span class="meta-separator">·</span>
                <span>{{ roleLabel }}</span>
                <template v-if="tenant.type === 'TEAM'">
                  <span class="meta-separator">·</span>
                  <span><TeamOutlined /> {{ tenant.memberCount }} 位成员</span>
                </template>
              </div>
              <p class="tenant-description">
                {{ tenant.description || '这个租户还没有填写简介。' }}
              </p>
            </div>

            <div class="tenant-actions">
              <a-button v-if="isCurrentTenant" type="primary" @click="router.push('/dashboard')">
                进入工作台
              </a-button>
              <a-button v-else type="primary" :loading="switching" @click="handleSwitchTenant">
                {{ canEdit ? '切换到此租户并管理' : '切换到此租户并进入' }}
              </a-button>
              <a-button v-if="isCurrentTenant && canNotify" @click="notificationModalVisible = true">
                发送通知
              </a-button>
            </div>
          </div>
        </a-card>

        <a-card :bordered="false" class="tenant-content-card">
          <a-alert
            v-if="!isCurrentTenant"
            type="info"
            show-icon
            :message="`正在查看：${tenant.name}；当前租户：${tenantStore.currentTenant?.name || '暂无'}。此页为只读概览，切换后可继续管理。`"
            style="margin-bottom: 20px"
          />
          <a-card v-if="!isCurrentTenant" size="small" class="overview-card"
            title="近 30 天授权摘要">
            <div v-if="overviewLoading" class="overview-message"><a-spin size="small" /> 正在读取摘要…</div>
            <a-alert v-else-if="overviewError" type="warning" show-icon
              message="摘要暂时不可用，基础资料仍可查看。">
              <template #action><a-button size="small" @click="fetchOverview()">重试</a-button></template>
            </a-alert>
            <template v-else-if="overview">
              <div class="overview-grid">
                <div><span>有效成员</span><strong>{{ formatCount(overview.memberCount) }}</strong></div>
                <div><span>启用模型服务</span><strong>{{ formatCount(overview.availableServiceCount) }}</strong></div>
                <div>
                  <span>{{ overview.usage?.scope === 'SELF' ? '我的 Token 用量' : '租户 Token 用量' }}</span>
                  <strong>{{ formatCount(overview.usage?.totalTokens) }}</strong>
                  <small v-if="overview.usage?.tokenQuality === 'PARTIAL'">数据不完整，含估算或未知用量</small>
                </div>
                <div><span>成功请求</span><strong>{{ formatCount(overview.usage?.requestCount) }}</strong></div>
              </div>
              <div v-if="overview.pendingJoinRequestCount !== null" class="overview-todo">
                待审批加入申请：{{ overview.pendingJoinRequestCount }}
                <router-link v-if="overview.pendingJoinRequestCount > 0"
                  :to="{ path: route.path, query: { tab: 'invites' } }">查看待办</router-link>
              </div>
              <div v-if="overview.recentActivities !== null" class="overview-activities">
                <strong>近期动态</strong>
                <span v-if="overview.recentActivities.length === 0">暂无近期动态</span>
                <div v-for="activity in overview.recentActivities" :key="`${activity.type}-${activity.occurredAt}`">
                  {{ activity.title }} · {{ formatDateTime(activity.occurredAt) }}
                </div>
              </div>
              <div class="overview-window">
                统计窗口：{{ overview.from.slice(0, 10) }} 至 {{ overview.to.slice(0, 10) }}（不含）
                <span v-if="overview.updatedAt"> · 投影更新于 {{ overview.updatedAt.replace('T', ' ').slice(0, 16) }}</span>
                · 预计延迟 {{ overview.dataDelayMinutes }} 分钟
              </div>
            </template>
          </a-card>
          <a-tabs v-if="isCurrentTenant" :active-key="activeTab" @change="switchTab">
            <a-tab-pane key="home" tab="首页" />
            <a-tab-pane v-if="tenant.type === 'TEAM'" key="members" tab="成员" />
            <a-tab-pane
              v-if="tenant.type === 'TEAM' && canEdit"
              key="invites"
              tab="邀请与申请"
            />
            <a-tab-pane key="settings" tab="租户设置" />
          </a-tabs>

          <div v-if="activeTab === 'home' || !isCurrentTenant" class="home-tab">
            <TenantAnnouncementBanner v-if="isCurrentTenant" :tenant-id="tenantId" :refresh-key="announcementRefreshKey" />
            <div class="home-grid">
              <div v-if="isCurrentTenant" class="home-column">
                <a-card size="small" class="home-card" title="租户概览">
                  <template #extra><router-link to="/usage">查看用量详情</router-link></template>
                  <div class="metrics-grid">
                    <div class="metric">
                      <div class="metric-label">{{ canEdit ? '本月 Token 用量' : '我的本月 Token 用量' }}</div>
                      <div class="metric-value">{{ formatCount(monthUsage?.totalTokens) }}</div>
                    </div>
                    <div class="metric">
                      <div class="metric-label">可用模型服务</div>
                      <div class="metric-value">{{ formatCount(availableServiceCount) }}</div>
                    </div>
                    <div class="metric">
                      <div class="metric-label">{{ canEdit ? '本月请求次数' : '我的本月请求次数' }}</div>
                      <div class="metric-value">{{ formatCount(monthUsage?.requestCount) }}</div>
                    </div>
                  </div>
                </a-card>

                <a-card size="small" class="home-card" title="快捷开始">
                  <div class="quick-grid">
                    <router-link class="quick-item" to="/llm-services">
                      <span class="quick-icon"><PlusOutlined /></span>
                      <strong>添加模型服务</strong>
                      <span class="quick-desc">接入新的模型和供应商</span>
                    </router-link>
                    <router-link class="quick-item" to="/api-keys">
                      <span class="quick-icon"><KeyOutlined /></span>
                      <strong>创建 API Key</strong>
                      <span class="quick-desc">为应用配置调用凭证</span>
                    </router-link>
                    <button
                      type="button"
                      class="quick-item"
                      :disabled="tenant.type !== 'TEAM' || !canEdit"
                      :title="tenant.type !== 'TEAM' ? '个人空间无需邀请成员' : !canEdit ? '仅管理员可以邀请成员' : undefined"
                      @click="switchTab('invites')"
                    >
                      <span class="quick-icon"><UserAddOutlined /></span>
                      <strong>邀请成员</strong>
                      <span class="quick-desc">协作使用与管理租户资源</span>
                    </button>
                  </div>
                </a-card>
              </div>
              <div class="home-column">
                <a-card size="small" class="home-card" title="基本信息">
                  <div class="tenant-facts">
                    <div class="fact-row">
                      <span>租户类型</span>
                      <strong>{{ tenant.type === 'TEAM' ? '团队租户' : '个人租户' }}</strong>
                    </div>
                    <div class="fact-row">
                      <span>我的角色</span>
                      <strong>{{ roleLabel }}</strong>
                    </div>
                    <div v-if="tenant.type === 'TEAM'" class="fact-row">
                      <span>成员数量</span>
                      <strong>{{ tenant.memberCount }}</strong>
                    </div>
                    <div class="fact-row">
                      <span>加入时间</span>
                      <strong>{{ currentTenantEntry?.joinedAt ? formatDate(currentTenantEntry.joinedAt) : '-' }}</strong>
                    </div>
                    <div class="fact-row">
                      <span>最近访问</span>
                      <strong>{{ currentTenantEntry?.lastAccessedAt ? formatDateTime(currentTenantEntry.lastAccessedAt) : '从未访问' }}</strong>
                    </div>
                  </div>
                </a-card>
                <TenantRecentActivity v-if="isCurrentTenant" :key="tenantId" :tenant-id="tenantId" />
              </div>
            </div>
          </div>

          <TenantMemberTab
            v-if="isCurrentTenant && activeTab === 'members' && tenant.type === 'TEAM'"
            :tenant-id="tenantId"
          />
          <TenantInviteTab
            v-if="isCurrentTenant && activeTab === 'invites' && tenant.type === 'TEAM' && canEdit"
            :tenant-id="tenantId"
          />
          <TenantSettingsTab
            v-if="isCurrentTenant && activeTab === 'settings'"
            :tenant-id="tenantId"
            @saved="fetchDetail"
            @close="closeModalVisible = true"
            @leave="leaveModalVisible = true"
          />
        </a-card>
      </div>

      <a-result
        v-else-if="!loading"
        status="error"
        :title="detailError ? '无法查看此租户' : '租户信息不可用'"
        sub-title="该租户可能已停用、你已退出或无权访问；也可能是请求暂时失败。"
      >
        <template #extra>
          <a-space>
            <a-button @click="fetchDetail">重试</a-button>
            <a-button type="primary" @click="router.push('/tenants')">返回我的租户</a-button>
          </a-space>
        </template>
      </a-result>
    </a-spin>

    <a-modal
      v-model:open="bannerPickerVisible"
      title="选择租户头图"
      :width="760"
      :footer="null"
      :mask-closable="!selectingBannerPreset"
      :closable="!selectingBannerPreset"
    >
      <p class="cover-picker-help">从系统头图库中选择，或上传一张自己的图片。</p>
      <div class="cover-picker-grid">
        <button
          v-for="preset in BANNER_PRESETS"
          :key="preset.id"
          type="button"
          class="cover-preset"
          :class="{ selected: currentBannerPreset === preset.id }"
          :disabled="Boolean(selectingBannerPreset)"
          @click="handleSelectBannerPreset(preset.id)"
        >
          <img :src="preset.url" :alt="`租户头图 ${preset.id}`" />
          <span class="cover-preset-label">
            <span>头图 {{ preset.id }}</span>
            <CheckCircleFilled v-if="currentBannerPreset === preset.id" />
            <a-spin v-else-if="selectingBannerPreset === preset.id" size="small" />
          </span>
        </button>
      </div>
      <div class="custom-cover-row">
        <span>支持 PNG、JPG、WebP，大小不超过 5MB</span>
        <a-button :loading="bannerUploading" @click="bannerInputRef?.click()">
          <CameraOutlined /> 上传自定义头图
        </a-button>
      </div>
    </a-modal>

    <ImageCropModal
      v-model:open="cropOpen"
      :file="cropFile"
      :title="cropKind === 'banner' ? '裁剪租户头图' : '裁剪租户头像'"
      :aspect-ratio="cropKind === 'banner' ? 4 : 1"
      :output-width="cropKind === 'banner' ? 1600 : 256"
      :output-height="cropKind === 'banner' ? 400 : 256"
      :shape="cropKind === 'banner' ? 'rectangle' : 'circle'"
      :loading="cropKind === 'banner' ? bannerUploading : logoUploading"
      @confirm="handleCropConfirm"
      @error="message.error($event)"
    />

    <TenantCloseModal
      v-if="tenant"
      v-model:visible="closeModalVisible"
      :tenant-id="tenant.tenantId"
      :tenant-name="tenant.name"
      @done="handleCloseDone"
    />
    <TenantLeaveModal
      v-if="tenant"
      v-model:visible="leaveModalVisible"
      :tenant-id="tenant.tenantId"
      :tenant-name="tenant.name"
      @done="handleLeaveDone"
    />
    <TenantNotificationModal
      v-model:visible="notificationModalVisible"
      :tenant-id="tenantId"
      @done="announcementRefreshKey++"
    />
  </div>
</template>

<style lang="scss" scoped>
.tenant-detail {
  width: 100%;
}

.detail-breadcrumb {
  margin-bottom: 16px;
}

.tenant-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.tenant-hero-card,
.tenant-content-card {
  border-radius: $radius-card;
  box-shadow: $shadow-light;
}

.tenant-hero-card :deep(.ant-card-body) {
  padding: 0;
}

.tenant-cover {
  position: relative;
  width: 100%;
  aspect-ratio: 4 / 1;
  min-height: 180px;
  max-height: 300px;
  background-position: center;
  background-size: cover;
  border-radius: $radius-card $radius-card 0 0;
  overflow: hidden;

  &.default-cover {
    background-image: url('/images/tenant-cover-01.png');
  }

  &.uploading {
    opacity: 0.72;
  }
}

.cover-action {
  position: absolute;
  right: 16px;
  bottom: 16px;
  background: rgba(255, 255, 255, 0.92);
  opacity: 0;
  pointer-events: none;
  transform: translateY(4px);
  transition: opacity 0.15s, transform 0.15s;
}

.tenant-cover:hover .cover-action,
.tenant-cover:focus-within .cover-action {
  opacity: 1;
  pointer-events: auto;
  transform: translateY(0);
}

.file-hidden {
  display: none;
}

.cover-picker-help {
  margin: 0 0 16px;
  color: $color-text-secondary;
}

.cover-picker-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.cover-preset {
  overflow: hidden;
  padding: 0;
  border: 1px solid $color-border;
  border-radius: $radius-button;
  background: $color-bg;
  color: $color-text-primary;
  cursor: pointer;
  text-align: left;
  transition: border-color 0.15s, box-shadow 0.15s;

  &:hover:not(:disabled),
  &.selected {
    border-color: $color-primary;
    box-shadow: 0 0 0 2px rgba(22, 119, 255, 0.12);
  }

  &:disabled {
    cursor: wait;
  }

  img {
    display: block;
    width: 100%;
    aspect-ratio: 4 / 1;
    object-fit: cover;
  }
}

.cover-preset-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 40px;
  padding: 0 12px;

  :deep(.anticon) {
    color: $color-primary;
  }
}

.custom-cover-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid $color-border;
  color: $color-text-secondary;
  font-size: $font-size-caption;
}

.tenant-summary {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 0 24px 24px;
}

.tenant-logo {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 104px;
  height: 104px;
  margin-top: -32px;
  flex: 0 0 auto;
  overflow: hidden;
  border: 4px solid $color-bg;
  border-radius: 50%;
  background: $color-primary;
  color: #fff;
  font-size: 40px;
  font-weight: 600;
  box-shadow: $shadow-light;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  &.editable {
    cursor: pointer;
  }

  &.uploading {
    pointer-events: none;
    opacity: 0.65;
  }
}

.logo-edit-mask {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.45);
  color: #fff;
  font-size: 22px;
  opacity: 0;
  transition: opacity 0.15s;
}

.tenant-logo.editable:hover .logo-edit-mask {
  opacity: 1;
}

.tenant-copy {
  min-width: 0;
  flex: 1;
  padding-top: 18px;
}

.tenant-title-row {
  display: flex;
  align-items: center;
  gap: 10px;

  h1 {
    margin: 0;
    color: $color-text-primary;
    font-size: $font-size-title;
    font-weight: 600;
    line-height: 1.3;
  }
}

.tenant-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
  color: $color-text-secondary;
  font-size: $font-size-caption;
}

.meta-separator {
  color: $color-border;
}

.tenant-description {
  max-width: 720px;
  margin: 8px 0 0;
  color: $color-text-secondary;
  font-size: $font-size-body;
  line-height: 1.6;
}

.tenant-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  align-self: flex-end;
}

.tenant-content-card :deep(.ant-tabs-nav) {
  margin-bottom: 24px;
}

.home-tab {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.home-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.5fr) minmax(320px, .8fr);
  gap: 20px;
}

.home-column {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 20px;
}

.home-card {
  border-radius: $radius-card;
  background: $color-bg-secondary;

  :deep(.ant-card-head-title) { font-weight: 600; }
  :deep(.ant-card-body) { padding: 18px 20px 20px; }
}

.tenant-facts {
  min-width: 0;
}

.metrics-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); }
.metric { min-width: 0; padding: 4px 20px 8px; border-right: 1px solid $color-border; }
.metric:first-child { padding-left: 0; }
.metric:last-child { padding-right: 0; border-right: 0; }
.metric-label { color: $color-text-secondary; font-size: 13px; }
.metric-value {
  margin-top: 7px;
  color: $color-text-primary;
  font-size: 24px;
  font-weight: 600;
  line-height: 32px;
  overflow-wrap: anywhere;
}

.quick-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
.quick-item {
  display: flex;
  min-width: 0;
  min-height: 124px;
  flex-direction: column;
  align-items: flex-start;
  padding: 16px;
  border: 1px solid $color-border;
  border-radius: 10px;
  background: $color-bg;
  color: $color-text-primary;
  cursor: pointer;
  font: inherit;
  text-align: left;
  text-decoration: none;
  transition: border-color .15s, box-shadow .15s;
}
.quick-item:hover:not(:disabled),
.quick-item:focus-visible { border-color: #91caff; box-shadow: $shadow-light; }
.quick-item:focus-visible { outline: 2px solid $color-primary; outline-offset: 2px; }
.quick-item:disabled { cursor: not-allowed; opacity: .55; }
.quick-item strong { margin-top: 10px; font-weight: 600; }
.quick-icon {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border-radius: 8px;
  background: #e6f4ff;
  color: $color-primary;
}
.quick-desc { margin-top: 4px; color: $color-text-secondary; font-size: 12px; line-height: 1.4; }

.fact-row {
  display: flex;
  justify-content: space-between;
  gap: 24px;
  padding: 9px 0;
  border-bottom: 1px solid $color-border;
  font-size: 13px;

  span {
    color: $color-text-secondary;
  }

  strong {
    color: $color-text-primary;
    font-weight: 500;
    text-align: right;
  }
}

.overview-card { margin-bottom: 20px; border-radius: $radius-card; background: $color-bg-secondary; }
.overview-message { padding: 12px 0; color: $color-text-secondary; }
.overview-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
.overview-grid > div { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
.overview-grid span, .overview-grid small, .overview-window { color: $color-text-secondary; font-size: $font-size-caption; }
.overview-grid strong { color: $color-text-primary; font-size: 21px; overflow-wrap: anywhere; }
.overview-todo, .overview-activities { margin-top: 16px; padding-top: 13px; border-top: 1px solid $color-border; }
.overview-todo a { margin-left: 10px; }
.overview-activities { display: flex; flex-direction: column; gap: 6px; color: $color-text-secondary; font-size: 13px; }
.overview-activities strong { color: $color-text-primary; }
.overview-window { margin-top: 14px; }

@media (max-width: 760px) { .overview-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }

@media (max-width: 960px) {
  .tenant-summary {
    flex-wrap: wrap;
  }

  .tenant-actions {
    width: 100%;
    align-self: auto;
  }

  .home-grid {
    grid-template-columns: 1fr;
    gap: 20px;
  }
}

@media (max-width: 640px) {
  .cover-picker-grid {
    grid-template-columns: 1fr;
  }

  .custom-cover-row {
    align-items: flex-start;
    flex-direction: column;
  }

  .tenant-cover {
    min-height: 144px;
  }

  .tenant-summary {
    gap: 14px;
    padding: 0 16px 20px;
  }

  .tenant-logo {
    width: 80px;
    height: 80px;
    margin-top: -24px;
    font-size: 30px;
  }

  .tenant-copy {
    padding-top: 12px;
  }

  .tenant-actions {
    flex-wrap: wrap;
  }

  .metrics-grid,
  .quick-grid { grid-template-columns: 1fr; }

  .metric { padding: 10px 0; border-right: 0; border-bottom: 1px solid $color-border; }
  .metric:last-child { border-bottom: 0; }

  .quick-item { min-height: 0; }
}
</style>
