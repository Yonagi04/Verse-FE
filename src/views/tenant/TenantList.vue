<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { message } from 'ant-design-vue'
import { PlusOutlined } from '@ant-design/icons-vue'
import { useTenantStore } from '@/stores/tenant'
import { usePermissionStore } from '@/stores/permission'
import TenantFormModal from './TenantFormModal.vue'
import type { TenantInfoListRespDTO } from '@/types/tenant'

const router = useRouter()
const route = useRoute()
const tenantStore = useTenantStore()
const permissionStore = usePermissionStore()

const loading = ref(false)
const searchQuery = ref('')
const switchingId = ref<string | null>(null)

// Modal state
const createModalVisible = ref(false)
const editModalVisible = ref(false)
interface EditingTenant { tenantId: string; name: string; description: string }

// Filtered tenants
const filteredTenants = computed(() => {
  if (!searchQuery.value) return tenantStore.tenants
  const q = searchQuery.value.toLowerCase()
  return tenantStore.tenants.filter((t) => t.name.toLowerCase().includes(q))
})

const columns = [
  { title: '租户名称', dataIndex: 'name', key: 'name' },
  { title: '类型', dataIndex: 'type', key: 'type' },
  { title: '我的角色', dataIndex: 'role', key: 'role' },
  { title: '加入时间', dataIndex: 'joinedAt', key: 'joinedAt' },
  { title: '最近访问', dataIndex: 'lastAccessedAt', key: 'lastAccessedAt' },
  { title: '操作', key: 'action', width: 160 },
]

function canEdit(role: string) {
  return role === 'SUPER_ADMIN' || role === 'ADMIN'
}

const editingTenant = ref<EditingTenant | null>(null)

async function openEditModal(record: TenantInfoListRespDTO) {
  try {
    const info = await tenantStore.fetchTenantInfo(record.tenantId)
    editingTenant.value = {
      tenantId: record.tenantId,
      name: record.name,
      description: info.description || '',
    }
    editModalVisible.value = true
  } catch {
    // 获取详情失败时仍然打开编辑，但 description 为空
    editingTenant.value = {
      tenantId: record.tenantId,
      name: record.name,
      description: '',
    }
    editModalVisible.value = true
  }
}

onMounted(async () => {
  loading.value = true
  try {
    await tenantStore.fetchTenants()
  } catch {
    message.error('获取租户列表失败')
  } finally {
    loading.value = false
  }

  // Auto-open create modal via ?action=create
  if (route.query.action === 'create') {
    createModalVisible.value = true
    router.replace({ query: {} })
  }
})

async function handleSwitchTenant(record: TenantInfoListRespDTO) {
  switchingId.value = record.tenantId
  try {
    await tenantStore.switchToTenant(record.tenantId)
    permissionStore.setRole(record.role)
    message.success(`已切换到「${record.name}」`)
    router.push('/dashboard')
  } catch {
    // handled by interceptor
  } finally {
    switchingId.value = null
  }
}

function handleCreateDone() {
  tenantStore.fetchTenants()
}
</script>

<template>
  <div class="tenant-list">
    <div class="page-header">
      <div>
        <h2 class="page-title">我的租户</h2>
        <p class="page-desc">查看你已加入的所有租户</p>
      </div>
      <div class="page-actions">
        <a-input-search
          v-model:value="searchQuery"
          placeholder="搜索租户名称..."
          style="width: 240px"
          allow-clear
        />
        <a-button type="primary" @click="createModalVisible = true">
          <PlusOutlined />
          创建租户
        </a-button>
      </div>
    </div>

    <a-card :bordered="false">
      <a-table
        :columns="columns"
        :data-source="filteredTenants"
        :loading="loading"
        row-key="tenantId"
        :pagination="false"
      >
        <template #bodyCell="{ column, record }">
          <!-- 租户名称 - 可点击链接 -->
          <template v-if="column.key === 'name'">
            <router-link
              :to="`/tenants/${record.tenantId}`"
              class="tenant-name-link"
            >
              {{ record.name }}
            </router-link>
          </template>
          <!-- 类型 -->
          <template v-if="column.key === 'type'">
            <a-tag :color="record.type === 'PERSONAL' ? 'default' : 'blue'">
              {{ record.type === 'PERSONAL' ? '个人' : '团队' }}
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
            {{ new Date(record.joinedAt).toLocaleDateString() }}
          </template>
          <!-- 最近访问 -->
          <template v-if="column.key === 'lastAccessedAt'">
            {{
              record.lastAccessedAt
                ? new Date(record.lastAccessedAt).toLocaleDateString()
                : '从未访问'
            }}
          </template>
          <!-- 操作 -->
          <template v-if="column.key === 'action'">
            <a-space :size="4">
              <a-button
                type="link"
                size="small"
                :loading="switchingId === record.tenantId"
                @click="handleSwitchTenant(record)"
              >
                进入
              </a-button>
              <a-button
                v-if="canEdit(record.role)"
                type="link"
                size="small"
                @click="openEditModal(record)"
              >
                编辑
              </a-button>
              <a-tooltip
                v-else
                title="仅管理员和超级管理员可编辑"
              >
                <a-button type="link" size="small" disabled>
                  编辑
                </a-button>
              </a-tooltip>
            </a-space>
          </template>
        </template>

        <!-- Empty state -->
        <template #emptyText>
          <a-empty
            :description="searchQuery ? '没有匹配的租户' : '还没有加入任何租户'"
          >
            <a-button
              v-if="!searchQuery"
              type="primary"
              @click="createModalVisible = true"
            >
              创建租户
            </a-button>
          </a-empty>
        </template>
      </a-table>
    </a-card>

    <!-- Create Modal -->
    <TenantFormModal
      v-model:visible="createModalVisible"
      mode="create"
      @done="handleCreateDone"
    />

    <!-- Edit Modal -->
    <TenantFormModal
      v-model:visible="editModalVisible"
      mode="edit"
      :tenant-id="editingTenant?.tenantId"
      :initial-name="editingTenant?.name"
      :initial-description="editingTenant?.description"
      @done="tenantStore.fetchTenants()"
    />
  </div>
</template>

<style lang="scss" scoped>
.tenant-list {
  max-width: 1200px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;

  .page-title {
    font-size: $font-size-title;
    font-weight: 600;
    color: $color-text-primary;
    margin: 0 0 8px 0;
  }

  .page-desc {
    color: $color-text-secondary;
    margin: 0;
  }
}

.page-actions {
  display: flex;
  gap: 12px;
  align-items: center;
}

.tenant-name-link {
  color: $color-primary;
  font-weight: 500;

  &:hover {
    color: #4096ff;
  }
}
</style>
