<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { message } from 'ant-design-vue'
import { useTenantStore } from '@/stores/tenant'
import { usePermissionStore } from '@/stores/permission'
import TenantFormModal from './TenantFormModal.vue'
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
  // 确保租户列表已加载（用于角色判断和导航回列表）
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

// Check if current user can edit this tenant
// Fetch role from the tenants list or use stored role if same tenant
const currentTenantEntry = computed(() =>
  tenantStore.tenants.find((t) => t.tenantId === tenantId)
)
const canEdit = computed(() => {
  const role = currentTenantEntry.value?.role
  return role === 'SUPER_ADMIN' || role === 'ADMIN'
})
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
          </a-space>
        </div>

        <!-- Info card -->
        <a-card :bordered="false" class="info-card">
          <div class="section-title">基本信息</div>
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
                    ? new Date(currentTenantEntry.joinedAt).toLocaleDateString()
                    : '-'
                }}
              </span>
            </div>
            <div class="info-item">
              <span class="info-label">最近访问</span>
              <span class="info-value">
                {{
                  currentTenantEntry?.lastAccessedAt
                    ? new Date(currentTenantEntry.lastAccessedAt).toLocaleDateString()
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
  </div>
</template>

<style lang="scss" scoped>
.tenant-detail {
  max-width: 960px;
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
  .section-title {
    font-size: 16px;
    font-weight: 600;
    color: $color-text-primary;
    margin-bottom: 20px;
    padding-bottom: 12px;
    border-bottom: 1px solid $color-border;
  }
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
</style>
