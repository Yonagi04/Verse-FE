<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { Modal, message } from 'ant-design-vue'
import { PlusOutlined } from '@ant-design/icons-vue'
import { useTenantStore } from '@/stores/tenant'
import { listApiKeys, revokeApiKey } from '@/api/apikey'
import { formatDateTime } from '@/utils/date'
import ApiKeyCreateDrawer from './ApiKeyCreateDrawer.vue'
import PaginationBar from '@/components/PaginationBar.vue'
import type { ApiKeyListRespDTO, ApiKeyPageRespDTO } from '@/types/apikey'

const tenantStore = useTenantStore()

const selectedTenantId = ref<string | null>(null)
const data = ref<ApiKeyPageRespDTO | null>(null)
const loading = ref(false)
const createVisible = ref(false)
const pageNum = ref(1)
const pageSize = ref(10)

const tenantOptions = computed(() =>
  tenantStore.tenants.map((t) => ({ value: t.tenantId, label: t.name })),
)

const columns = [
  { title: '名称', dataIndex: 'name', key: 'name' },
  { title: 'Key', key: 'key', width: 180 },
  { title: '状态', key: 'status', width: 100 },
  { title: '最近使用', key: 'lastUsedAt', width: 180 },
  { title: '过期时间', key: 'expiresAt', width: 180 },
  { title: '创建时间', key: 'createTime', width: 180 },
  { title: '操作', key: 'action', width: 80 },
]

function isExpired(record: ApiKeyListRespDTO): boolean {
  return record.status === 2
}

async function fetchKeys() {
  if (!selectedTenantId.value) return
  loading.value = true
  try {
    data.value = await listApiKeys(selectedTenantId.value, pageNum.value, pageSize.value)
    if (data.value.records.length === 0 && pageNum.value > 1) {
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
  fetchKeys()
})

watch([pageNum, pageSize], () => {
  if (selectedTenantId.value) fetchKeys()
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

function handleRevoke(record: ApiKeyListRespDTO) {
  if (!selectedTenantId.value) return
  Modal.confirm({
    title: '吊销 API Key',
    content: `确定吊销「${record.name}」吗？吊销后该密钥立即失效，且无法恢复。`,
    okText: '吊销',
    okType: 'danger',
    cancelText: '取消',
    onOk: async () => {
      await revokeApiKey(selectedTenantId.value!, { apiKeyId: record.apiKeyId })
      message.success('已吊销')
      fetchKeys()
    },
  })
}
</script>

<template>
  <div class="api-key-list">
    <div class="page-header">
      <div>
        <h2 class="page-title">API Key</h2>
        <p class="page-desc">管理你在各租户下的 API Key，用于调用 LLM 服务</p>
      </div>
      <div class="page-actions">
        <a-select
          v-model:value="selectedTenantId"
          :options="tenantOptions"
          placeholder="选择租户"
          style="width: 200px"
        />
        <a-button
          type="primary"
          :disabled="!selectedTenantId"
          @click="createVisible = true"
        >
          <PlusOutlined />
          创建 API Key
        </a-button>
      </div>
    </div>

    <!-- Has tenant -->
    <a-card v-if="selectedTenantId" :bordered="false">
      <a-table
        :columns="columns"
        :data-source="data?.records ?? []"
        :loading="loading"
        :pagination="false"
        row-key="apiKeyId"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'key'">
            <span class="key-prefix">{{ record.keyPrefix }}…</span>
          </template>

          <template v-else-if="column.key === 'status'">
            <a-tag v-if="isExpired(record)" color="default">已过期</a-tag>
            <a-tag v-else color="green">正常</a-tag>
          </template>

          <template v-else-if="column.key === 'lastUsedAt'">
            {{ record.lastUsedAt ? formatDateTime(record.lastUsedAt) : '从未使用' }}
          </template>

          <template v-else-if="column.key === 'expiresAt'">
            {{ record.expiresAt ? formatDateTime(record.expiresAt) : '永久有效' }}
          </template>

          <template v-else-if="column.key === 'createTime'">
            {{ formatDateTime(record.createTime) }}
          </template>

          <template v-else-if="column.key === 'action'">
            <a-button type="link" size="small" danger @click="handleRevoke(record)">
              吊销
            </a-button>
          </template>
        </template>

        <template #emptyText>
          <a-empty description="暂无 API Key，点击右上角创建" />
        </template>
      </a-table>

      <PaginationBar
        v-if="data && data.total > 0"
        v-model:current-page="pageNum"
        v-model:page-size="pageSize"
        :total-pages="data.totalPages"
        :total="data.total"
        page-jump-id="apiKeyPageJump"
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

    <ApiKeyCreateDrawer
      v-if="selectedTenantId"
      v-model:visible="createVisible"
      :tenant-id="selectedTenantId"
      @done="fetchKeys"
    />
  </div>
</template>

<style lang="scss" scoped>
.api-key-list {
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

.key-prefix {
  display: inline-block;
  padding: 2px 10px;
  background: #f0f5ff;
  border: 1px solid #d6e4ff;
  border-radius: 4px;
  font-family: 'Courier New', monospace;
  font-size: 13px;
  color: #1677ff;
}
</style>
