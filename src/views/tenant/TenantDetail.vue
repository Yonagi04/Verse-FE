<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { CameraOutlined, CheckCircleFilled, TeamOutlined } from '@ant-design/icons-vue'
import { selectTenantBannerPreset, uploadTenantBanner, uploadTenantLogo } from '@/api/tenant'
import { usePermissionStore } from '@/stores/permission'
import { useTenantStore } from '@/stores/tenant'
import { formatDate, formatDateTime } from '@/utils/date'
import ImageCropModal from '@/components/ImageCropModal.vue'
import TenantCloseModal from './TenantCloseModal.vue'
import TenantInviteTab from './TenantInviteTab.vue'
import TenantLeaveModal from './TenantLeaveModal.vue'
import TenantMemberTab from './TenantMemberTab.vue'
import TenantNotificationModal from './TenantNotificationModal.vue'
import TenantSettingsTab from './TenantSettingsTab.vue'
import type { TenantInfoRespDTO } from '@/types/tenant'
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
const permissionStore = usePermissionStore()

const tenantId = String(route.params.tenantId)
const tenant = ref<TenantInfoRespDTO | null>(null)
const loading = ref(true)
const switching = ref(false)
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
const closeModalVisible = ref(false)
const leaveModalVisible = ref(false)

const initialTab = route.query.tab as string
const activeTab = ref(['members', 'invites', 'settings'].includes(initialTab) ? initialTab : 'home')

const currentTenantEntry = computed(() =>
  tenantStore.tenants.find((item) => item.tenantId === tenantId),
)
const currentRole = computed<Role | undefined>(() => tenant.value?.role ?? currentTenantEntry.value?.role)
const isCurrentTenant = computed(() => tenantStore.currentTenant?.tenantId === tenantId)
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

function switchTab(key: string) {
  activeTab.value = key
  router.replace({ query: { tab: key === 'home' ? undefined : key } })
}

async function fetchDetail() {
  loading.value = true
  try {
    tenant.value = await tenantStore.fetchTenantInfo(tenantId)
  } catch {
    tenant.value = null
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await fetchDetail()
  if (tenantStore.tenants.length === 0) {
    await tenantStore.fetchTenants()
  }
})

async function handleEnterTenant() {
  if (!tenant.value) return
  if (isCurrentTenant.value) {
    router.push('/dashboard')
    return
  }

  switching.value = true
  try {
    await tenantStore.switchToTenant(tenantId)
    permissionStore.setRole(currentRole.value ?? 'MEMBER')
    message.success(`已切换到「${tenant.value.name}」`)
    router.push('/dashboard')
  } catch {
    // handled by interceptor
  } finally {
    switching.value = false
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
      await uploadTenantLogo(tenantId, file)
    } else {
      await uploadTenantBanner(tenantId, file)
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
    await selectTenantBannerPreset(tenantId, presetId)
    await fetchDetail()
    bannerPickerVisible.value = false
    message.success(`已使用头图 ${presetId}`)
  } catch {
    // handled by interceptor
  } finally {
    selectingBannerPreset.value = null
  }
}

function handleCloseDone() {
  tenantStore.fetchTenants()
  router.push('/tenants')
}
function handleLeaveDone() {
  tenantStore.fetchTenants()
  router.push('/tenants')
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
              v-if="canEdit"
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
              :class="{ editable: canEdit, uploading: logoUploading }"
              @click="canEdit && logoInputRef?.click()"
            >
              <img v-if="tenant.logoUrl" :src="tenant.logoUrl" :alt="`${tenant.name} Logo`" />
              <span v-else>{{ tenantInitial }}</span>
              <div v-if="canEdit" class="logo-edit-mask">
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
                  {{ tenant.type === 'TEAM' ? '团队空间' : '个人空间' }}
                </a-tag>
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
              <a-button type="primary" :loading="switching" @click="handleEnterTenant">
                {{ isCurrentTenant ? '返回工作台' : '进入租户' }}
              </a-button>
              <a-button v-if="canNotify" @click="notificationModalVisible = true">
                发送通知
              </a-button>
            </div>
          </div>
        </a-card>

        <a-card :bordered="false" class="tenant-content-card">
          <a-tabs :active-key="activeTab" @change="switchTab">
            <a-tab-pane key="home" tab="首页" />
            <a-tab-pane v-if="tenant.type === 'TEAM'" key="members" tab="成员" />
            <a-tab-pane
              v-if="tenant.type === 'TEAM' && canEdit"
              key="invites"
              tab="邀请与申请"
            />
            <a-tab-pane key="settings" tab="租户设置" />
          </a-tabs>

          <div v-if="activeTab === 'home'" class="home-tab">
            <section class="about-section">
              <div class="about-copy">
                <h2>租户简介</h2>
                <p>{{ tenant.description || '管理员暂未添加租户简介。' }}</p>
              </div>
              <div class="tenant-facts">
                <div class="fact-row">
                  <span>租户类型</span>
                  <strong>{{ tenant.type === 'TEAM' ? '团队空间' : '个人空间' }}</strong>
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
            </section>

          </div>

          <TenantMemberTab
            v-if="activeTab === 'members' && tenant.type === 'TEAM'"
            :tenant-id="tenantId"
          />
          <TenantInviteTab
            v-if="activeTab === 'invites' && tenant.type === 'TEAM' && canEdit"
            :tenant-id="tenantId"
          />
          <TenantSettingsTab
            v-if="activeTab === 'settings'"
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
        title="租户不存在"
        sub-title="该租户可能已被删除或你无权访问"
      >
        <template #extra>
          <a-button type="primary" @click="router.push('/tenants')">返回租户列表</a-button>
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

.about-section {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 360px;
  gap: 48px;
}

.about-copy {
  h2 {
    margin: 0 0 12px;
    color: $color-text-primary;
    font-size: $font-size-h2;
    font-weight: 600;
  }

  p {
    margin: 0;
    color: $color-text-secondary;
    line-height: 1.7;
    white-space: pre-wrap;
  }
}

.tenant-facts {
  border-left: 1px solid $color-border;
  padding-left: 24px;
}

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

@media (max-width: 960px) {
  .tenant-summary {
    flex-wrap: wrap;
  }

  .tenant-actions {
    width: 100%;
    align-self: auto;
  }

  .about-section {
    grid-template-columns: 1fr;
    gap: 24px;
  }

  .tenant-facts {
    border-left: 0;
    padding-left: 0;
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
}
</style>
