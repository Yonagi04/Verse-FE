<script setup lang="ts">
import { ref, computed, watch, onMounted, h } from 'vue'
import { Modal, message } from 'ant-design-vue'
import { PlusOutlined, CopyOutlined } from '@ant-design/icons-vue'
import { useTenantStore } from '@/stores/tenant'
import { ROLE_PERMISSIONS, PERMISSIONS, type Permission } from '@/utils/constants'
import {
  listLlmServices,
  disableLlmService,
  enableLlmService,
  prepareRemoveLlmService,
  removeLlmService,
} from '@/api/llmService'
import { getProviderBySlug } from '@/constants/providers'
import ProviderLogo from '@/components/ProviderLogo.vue'
import PaginationBar from '@/components/PaginationBar.vue'
import LlmServiceCreateDrawer from './LlmServiceCreateDrawer.vue'
import LlmServiceEditDrawer from './LlmServiceEditDrawer.vue'
import LlmServiceDetailDrawer from './LlmServiceDetailDrawer.vue'
import type { LlmServiceInfo, LlmServiceListRespDTO, LlmServiceRemovePreRespDTO } from '@/types/llmService'

const tenantStore = useTenantStore()

const selectedTenantId = ref<string | null>(null)
const data = ref<LlmServiceListRespDTO | null>(null)
const loading = ref(false)
const pageNum = ref(1)
const pageSize = ref(10)

const createVisible = ref(false)
const editVisible = ref(false)
const detailVisible = ref(false)
const editingRecord = ref<LlmServiceInfo | null>(null)
const detailRecord = ref<LlmServiceInfo | null>(null)

// 权限以「下拉选中的租户」角色为准（而非全局 currentTenant）
const selectedRole = computed(() => {
  const t = tenantStore.tenants.find((x) => x.tenantId === selectedTenantId.value)
  return t?.role ?? null
})

const authorities = computed<Permission[]>(() => {
  if (!selectedRole.value) return []
  return ROLE_PERMISSIONS[selectedRole.value] ?? []
})

const canRegister = computed(() => authorities.value.includes(PERMISSIONS.TENANT_LLM_REGISTER))
const canUpdate = computed(() => authorities.value.includes(PERMISSIONS.TENANT_LLM_UPDATE))
const canDelete = computed(() => authorities.value.includes(PERMISSIONS.TENANT_LLM_DELETE))

const tenantOptions = computed(() =>
  tenantStore.tenants.map((t) => ({ value: t.tenantId, label: t.name })),
)

const columns = [
  { title: '名称', dataIndex: 'name', key: 'name' },
  { title: '供应商', key: 'provider', width: 200 },
  { title: '状态', key: 'status', width: 100 },
  { title: '创建者', dataIndex: 'createdByUsername', key: 'createdByUsername', width: 140 },
  { title: '操作', key: 'action', width: 220 },
]

function providerDisplayName(slug: string): string {
  return getProviderBySlug(slug)?.displayName ?? slug
}

function handleCopyName(name: string) {
  navigator.clipboard.writeText(name).then(() => {
    message.success('名称已复制')
  }).catch(() => {
    message.error('复制失败，请手动复制')
  })
}

async function fetchServices() {
  if (!selectedTenantId.value) return
  loading.value = true
  try {
    data.value = await listLlmServices(selectedTenantId.value, pageNum.value, pageSize.value)
    if (data.value.serviceInfoList.length === 0 && pageNum.value > 1) {
      pageNum.value--
    }
  } catch {
    // handled by interceptor
  } finally {
    loading.value = false
  }
}

watch(selectedTenantId, (val) => {
  if (!val) {
    data.value = null
    return
  }
  pageNum.value = 1
  fetchServices()
})

watch([pageNum, pageSize], () => {
  if (selectedTenantId.value) fetchServices()
})

onMounted(async () => {
  try {
    if (tenantStore.tenants.length === 0) {
      await tenantStore.fetchTenants()
    }
  } catch {
    // handled by interceptor
  }
  selectedTenantId.value =
    tenantStore.currentTenant?.tenantId ?? tenantStore.tenants[0]?.tenantId ?? null
})

function openDetail(record: LlmServiceInfo) {
  detailRecord.value = record
  detailVisible.value = true
}

function openEdit(record: LlmServiceInfo) {
  editingRecord.value = record
  editVisible.value = true
}

function handleToggle(record: LlmServiceInfo) {
  if (!selectedTenantId.value) return
  const disabled = record.status === 0
  const action = disabled ? '启用' : '停用'
  Modal.confirm({
    title: `${action}模型`,
    content: `确定${action}「${record.name}」吗？`,
    okText: action,
    okType: disabled ? 'primary' : 'danger',
    cancelText: '取消',
    onOk: async () => {
      if (disabled) {
        await enableLlmService(selectedTenantId.value!, record.serviceId)
      } else {
        await disableLlmService(selectedTenantId.value!, record.serviceId)
      }
      message.success(`已${action}`)
      fetchServices()
    },
  })
}

async function handleRemove(record: LlmServiceInfo) {
  if (!selectedTenantId.value) return
  let prep: LlmServiceRemovePreRespDTO
  try {
    prep = await prepareRemoveLlmService(selectedTenantId.value, record.serviceId)
  } catch {
    return
  }
  const token = prep.token
  Modal.confirm({
    title: '删除模型',
    content: h('div', { style: 'white-space: pre-line; line-height: 1.6;' }, prep.info),
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    onOk: async () => {
      await removeLlmService(selectedTenantId.value!, record.serviceId, { token })
      message.success('已删除')
      fetchServices()
    },
  })
}
</script>

<template>
  <div class="llm-service-list">
    <div class="page-header">
      <div>
        <h2 class="page-title">服务管理</h2>
        <p class="page-desc">管理租户内的模型服务，配置供应商接入与启停</p>
      </div>
      <div class="page-actions">
        <a-select
          v-model:value="selectedTenantId"
          :options="tenantOptions"
          placeholder="选择租户"
          style="width: 200px"
        />
        <a-button
          v-if="canRegister"
          type="primary"
          :disabled="!selectedTenantId"
          @click="createVisible = true"
        >
          <PlusOutlined />
          添加服务
        </a-button>
      </div>
    </div>

    <!-- Has tenant -->
    <a-card v-if="selectedTenantId" :bordered="false">
      <a-table
        :columns="columns"
        :data-source="data?.serviceInfoList ?? []"
        :loading="loading"
        :pagination="false"
        row-key="serviceId"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'name'">
            <div class="name-cell">
              <span>{{ record.name }}</span>
              <a-button
                type="text"
                size="small"
                class="copy-btn"
                aria-label="复制名称"
                @click.stop="handleCopyName(record.name)"
              >
                <template #icon><CopyOutlined /></template>
              </a-button>
            </div>
          </template>

          <template v-else-if="column.key === 'provider'">
            <div class="provider-cell">
              <ProviderLogo :slug="record.provider" :size="22" />
              <span>{{ providerDisplayName(record.provider) }}</span>
            </div>
          </template>

          <template v-else-if="column.key === 'status'">
            <a-tag v-if="record.status === 0" color="default">已停用</a-tag>
            <a-tag v-else color="green">启用中</a-tag>
          </template>

          <template v-else-if="column.key === 'action'">
            <a-button type="link" size="small" @click="openDetail(record)">
              详情
            </a-button>
            <a-button v-if="canUpdate" type="link" size="small" @click="openEdit(record)">
              编辑
            </a-button>
            <a-button
              v-if="canUpdate"
              type="link"
              size="small"
              :danger="record.status !== 0"
              @click="handleToggle(record)"
            >
              {{ record.status === 0 ? '启用' : '停用' }}
            </a-button>
            <a-button v-if="canDelete" type="link" size="small" danger @click="handleRemove(record)">
              删除
            </a-button>
          </template>
        </template>

        <template #emptyText>
          <a-empty description="暂无模型服务，点击右上角添加" />
        </template>
      </a-table>

      <PaginationBar
        v-if="data && data.total > 0"
        v-model:current-page="pageNum"
        v-model:page-size="pageSize"
        :total-pages="data.totalPages"
        :total="data.total"
        page-jump-id="llmServicePageJump"
      />
    </a-card>

    <!-- No tenant -->
    <a-card v-else :bordered="false">
      <a-empty description="你还没有加入任何租户">
        <router-link to="/tenants" custom v-slot="{ href, navigate }">
          <a-button type="primary" :href="href" @click="navigate">前往租户管理</a-button>
        </router-link>
      </a-empty>
    </a-card>

    <LlmServiceCreateDrawer
      v-if="selectedTenantId"
      v-model:visible="createVisible"
      :tenant-id="selectedTenantId"
      @done="fetchServices"
    />

    <LlmServiceEditDrawer
      v-if="selectedTenantId"
      v-model:visible="editVisible"
      :tenant-id="selectedTenantId"
      :record="editingRecord"
      @done="fetchServices"
    />

    <LlmServiceDetailDrawer
      v-if="selectedTenantId"
      v-model:visible="detailVisible"
      :tenant-id="selectedTenantId"
      :record="detailRecord"
    />
  </div>
</template>

<style lang="scss" scoped>
.llm-service-list {
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

.provider-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.name-cell {
  display: flex;
  align-items: center;
  gap: 4px;

  .copy-btn {
    opacity: 0;
    transition: opacity 0.15s;
  }

  &:hover .copy-btn {
    opacity: 1;
  }
}
</style>
