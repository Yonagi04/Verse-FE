<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { message } from 'ant-design-vue'
import { useTenantStore } from '@/stores/tenant'
import { usePermissionStore } from '@/stores/permission'
import TenantFormModal from './TenantFormModal.vue'
import TenantCloseModal from './TenantCloseModal.vue'
import TenantLeaveModal from './TenantLeaveModal.vue'
import TenantMemberTab from './TenantMemberTab.vue'
import TenantInviteTab from './TenantInviteTab.vue'
import { formatDate, formatDateTime } from '@/utils/date'
import type { TenantInfoRespDTO } from '@/types/tenant'

const router = useRouter()
const route = useRoute()
const tenantStore = useTenantStore()
const permissionStore = usePermissionStore()

const tenantId = String(route.params.tenantId)
const tenant = ref<TenantInfoRespDTO | null>(null)
const loading = ref(true)
const switching = ref(false)

const editModalVisible = ref(false)
const closeModalVisible = ref(false)
const leaveModalVisible = ref(false)

// Tab state synced with URL query
const activeTab = ref((route.query.tab as string) === 'members' ? 'members' : 'info')

function switchTab(key: string) {
  activeTab.value = key
  router.replace({ query: { tab: key === 'members' ? 'members' : undefined } })
}

async function fetchDetail() {
  loading.value = true
  try {
    tenant.value = await tenantStore.fetchTenantInfo(tenantId)
  } catch {
    message.error('获取租户信息失败')
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
  switching.value = true
  try {
    await tenantStore.switchToTenant(tenantId)
    const role = currentTenantEntry.value?.role
    if (role) { permissionStore.setRole(role) } else { permissionStore.clearPermissions() }
    message.success(`已切换到「${tenant.value.name}」`)
    router.push('/dashboard')
  } catch {
    // handled by interceptor
  } finally {
    switching.value = false
  }
}

const currentTenantEntry = computed(() =>
  tenantStore.tenants.find((t) => t.tenantId === tenantId)
)

const canEdit = computed(() => {
  const role = currentTenantEntry.value?.role
  return role === 'SUPER_ADMIN' || role === 'ADMIN'
})

const canClose = computed(() => {
  const t = currentTenantEntry.value
  return t?.role === 'SUPER_ADMIN' && tenant.value?.type === 'TEAM'
})

const isSuperAdmin = computed(() => {
  return currentTenantEntry.value?.role === 'SUPER_ADMIN'
})

const canLeave = computed(() => {
  return tenant.value?.type === 'TEAM' && !isSuperAdmin.value
})

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
    <!-- Breadcrumb -->
    <a-breadcrumb class="detail-breadcrumb">
      <a-breadcrumb-item>
        <router-link to="/tenants">租户管理</router-link>
      </a-breadcrumb-item>
      <a-breadcrumb-item>
        <router-link to="/tenants">我的租户</router-link>
      </a-breadcrumb-item>
      <a-breadcrumb-item>{{ tenant?.name || '...' }}</a-breadcrumb-item>
    </a-breadcrumb>

    <a-spin :spinning="loading">
      <div v-if="tenant" class="detail-content">
        <!-- Page header -->
        <div class="page-header">
          <h2 class="page-title">租户详情</h2>
          <a-space>
            <a-button type="primary" :loading="switching" @click="handleEnterTenant">
              进入租户
            </a-button>
            <a-button v-if="canEdit" @click="editModalVisible = true">
              编辑
            </a-button>
            <a-button v-if="canClose" danger @click="closeModalVisible = true">
              关闭租户
            </a-button>
            <a-button v-if="canLeave" danger @click="leaveModalVisible = true">
              退出租户
            </a-button>
          </a-space>
        </div>

        <a-card :bordered="false" class="info-card">
          <!-- Tabs -->
          <a-tabs :active-key="activeTab" @change="switchTab">
            <a-tab-pane key="info" tab="基本信息" />

            <a-tab-pane
              v-if="tenant.type === 'TEAM'"
              key="members"
              tab="成员管理"
            />

            <a-tab-pane
              v-if="tenant.type === 'TEAM' && canEdit"
              key="invites"
              tab="邀请码"
            />
          </a-tabs>

          <!-- Info Tab Content -->
          <div v-if="activeTab === 'info'" class="info-tab">
            <div class="info-grid">
              <div class="info-item">
                <span class="info-label">租户名称</span>
                <span class="info-value">{{ tenant.name }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">租户类型</span>
                <span class="info-value">
                  <a-tag :color="tenant.type === 'PERSONAL' ? 'default' : 'blue'">
                    {{ tenant.type === 'TEAM' ? '团队空间' : '个人空间' }}
                  </a-tag>
                </span>
              </div>
              <div class="info-item">
                <span class="info-label">我的角色</span>
                <span class="info-value">
                  <a-tag
                    v-if="currentTenantEntry"
                    :color="
                      currentTenantEntry.role === 'SUPER_ADMIN'
                        ? 'red'
                        : currentTenantEntry.role === 'ADMIN'
                          ? 'orange'
                          : 'default'
                    "
                  >
                    {{
                      currentTenantEntry.role === 'SUPER_ADMIN'
                        ? '超级管理员'
                        : currentTenantEntry.role === 'ADMIN'
                          ? '管理员'
                          : '成员'
                    }}
                  </a-tag>
                </span>
              </div>
              <div class="info-item">
                <span class="info-label">加入时间</span>
                <span class="info-value">
                  {{
                    currentTenantEntry?.joinedAt
                      ? formatDate(currentTenantEntry.joinedAt)
                      : '-'
                  }}
                </span>
              </div>
              <div class="info-item">
                <span class="info-label">最近访问</span>
                <span class="info-value">
                  {{
                    currentTenantEntry?.lastAccessedAt
                      ? formatDateTime(currentTenantEntry.lastAccessedAt)
                      : '从未访问'
                  }}
                </span>
              </div>
              <div class="info-item info-full">
                <span class="info-label">描述</span>
                <span class="info-value">
                  {{ tenant.description || '暂无描述' }}
                </span>
              </div>
            </div>

            <!-- Danger Zone (Team only) -->
            <div v-if="tenant.type === 'TEAM'" class="danger-zone">
              <div class="danger-header">危险操作</div>
              <p v-if="canClose" class="danger-desc">
                关闭租户后，该租户下的所有数据将不可访问，相关LLM服务将停止工作。<strong>此操作不可撤销。</strong>
              </p>
              <p v-else class="danger-desc">
                仅超级管理员可关闭租户。如需关闭，请联系租户超级管理员。
              </p>
              <a-button v-if="canClose" danger @click="closeModalVisible = true">
                关闭租户
              </a-button>
              <a-button v-if="canLeave" danger @click="leaveModalVisible = true">
                退出租户
              </a-button>
            </div>
          </div>

          <!-- Members Tab Content -->
          <div v-if="activeTab === 'members' && tenant.type === 'TEAM'" class="member-tab">
            <TenantMemberTab :tenant-id="tenantId" />
          </div>

          <!-- Invites Tab Content -->
          <div v-if="activeTab === 'invites' && tenant.type === 'TEAM' && canEdit" class="invite-tab">
            <TenantInviteTab :tenant-id="tenantId" />
          </div>
        </a-card>
      </div>

      <!-- Not found -->
      <a-result
        v-else-if="!loading"
        status="error"
        title="租户不存在"
        sub-title="该租户可能已被删除或你无权访问"
      >
        <template #extra>
          <a-button type="primary" @click="router.push('/tenants')">
            返回租户列表
          </a-button>
        </template>
      </a-result>
    </a-spin>

    <!-- Edit Modal -->
    <TenantFormModal
      v-if="tenant"
      v-model:visible="editModalVisible"
      mode="edit"
      :tenant-id="tenant.tenantId"
      :initial-name="tenant.name"
      :initial-description="tenant.description || ''"
      @done="fetchDetail"
    />

    <!-- Close Modal -->
    <TenantCloseModal
      v-if="tenant"
      v-model:visible="closeModalVisible"
      :tenant-id="tenant.tenantId"
      :tenant-name="tenant.name"
      @done="handleCloseDone"
    />

    <!-- Leave Modal -->
    <TenantLeaveModal
      v-if="tenant"
      v-model:visible="leaveModalVisible"
      :tenant-id="tenant.tenantId"
      :tenant-name="tenant.name"
      @done="handleLeaveDone"
    />
  </div>
</template>

<style lang="scss" scoped>
.tenant-detail {
  max-width: 1200px;
}

.detail-breadcrumb {
  margin-bottom: 20px;
}

.detail-content {
  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;

    .page-title {
      font-size: $font-size-title;
      font-weight: 600;
      color: $color-text-primary;
      margin: 0;
    }
  }
}

.info-card {
  :deep(.ant-tabs-nav) {
    margin-bottom: 24px;
  }
}

.info-tab,
.member-tab,
.invite-tab {
  min-height: 200px;
}

.info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px 40px;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.info-full {
  grid-column: 1 / -1;
}

.info-label {
  font-size: 13px;
  color: $color-text-secondary;
}

.info-value {
  font-size: 14px;
  color: $color-text-primary;
}

.danger-zone {
  margin-top: 32px;
  padding: 20px;
  border: 1px solid #ffa39e;
  border-radius: $radius-card;
}

.danger-header {
  font-size: 15px;
  font-weight: 600;
  color: $color-danger;
  margin-bottom: 8px;
}

.danger-desc {
  color: $color-text-secondary;
  font-size: 13px;
  margin-bottom: 16px;
  line-height: 1.6;
}
</style>
