<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Modal, message } from 'ant-design-vue'
import { PlusOutlined } from '@ant-design/icons-vue'
import { useTenantStore } from '@/stores/tenant'
import { listApiKeys, revokeApiKey } from '@/api/apikey'
import { formatDateTime } from '@/utils/date'
import ApiKeyCreateDrawer from './ApiKeyCreateDrawer.vue'
import ApiKeyEditDrawer from './ApiKeyEditDrawer.vue'
import ApiKeyCostDrawer from './ApiKeyCostDrawer.vue'
import { formatBudgetYuan } from '@/utils/costBudget'
import PaginationBar from '@/components/PaginationBar.vue'
import type { ApiKeyListRespDTO, ApiKeyPageRespDTO } from '@/types/apikey'

const tenantStore = useTenantStore()

const tenantId = computed(() => tenantStore.currentTenantId)
const data = ref<ApiKeyPageRespDTO | null>(null)
const loading = ref(false)
const createVisible = ref(false)
const editVisible = ref(false)
const editingRecord = ref<ApiKeyListRespDTO | null>(null)
const costVisible = ref(false)
const costRecord = ref<ApiKeyListRespDTO | null>(null)
const costRefreshVersion = ref(0)
let requestSequence = 0
function handleDone() { costRefreshVersion.value++; void fetchKeys() }
function handleCost(record: ApiKeyListRespDTO) { costRecord.value = record; costVisible.value = true }
const pageNum = ref(1)
const pageSize = ref(10)

const columns = [
  { title: '名称', dataIndex: 'name', key: 'name', width: 190, ellipsis: { showTitle: false } },
  { title: 'Key', key: 'key', width: 160 },
  { title: '状态', key: 'status', width: 80 },
  { title: '限流', key: 'rateLimit', width: 120 },
  { title: '成本限额', key: 'costLimit', width: 180 },
  { title: '最近使用', key: 'lastUsedAt', width: 160 },
  { title: '过期时间', key: 'expiresAt', width: 160 },
  { title: '创建时间', key: 'createTime', width: 160 },
  { title: '操作', key: 'action', width: 210, fixed: 'right' as const },
]

function formatRateLimit(rpm: number | null, tpm: number | null): string {
  const parts: string[] = []
  if (rpm != null) parts.push(`RPM ${rpm}`)
  if (tpm != null) parts.push(`TPM ${tpm}`)
  return parts.length > 0 ? parts.join(' / ') : '不限'
}

async function fetchKeys() {
  if (!tenantId.value) return
  const current = ++requestSequence
  const tenant = tenantId.value
  loading.value = true
  try {
    const response = await listApiKeys(tenant, pageNum.value, pageSize.value)
    if (current !== requestSequence || tenant !== tenantId.value) return
    data.value = response
    if (costRecord.value) costRecord.value = response.records.find(item => item.apiKeyId === costRecord.value?.apiKeyId) ?? costRecord.value
    if (data.value.records.length === 0 && pageNum.value > 1) {
      pageNum.value--
    }
  } catch {
    // handled by interceptor
  } finally {
    if (current === requestSequence) loading.value = false
  }
}

watch(tenantId, (val) => {
  requestSequence++
  data.value = null
  loading.value = false
  costVisible.value = false
  costRecord.value = null
  createVisible.value = false
  editVisible.value = false
  editingRecord.value = null
  if (!val) {
    data.value = null
    return
  }
  pageNum.value = 1
  fetchKeys()
}, { immediate: true })

watch([pageNum, pageSize], () => {
  if (tenantId.value) fetchKeys()
})

function handleEdit(record: ApiKeyListRespDTO) {
  editingRecord.value = record
  editVisible.value = true
}

function handleRevoke(record: ApiKeyListRespDTO) {
  if (!tenantId.value) return
  const tenant = tenantId.value
  Modal.confirm({
    title: '吊销 API Key',
    content: `确定吊销「${record.name}」吗？吊销后该 API Key 将立即失效，且无法恢复。`,
    okText: '吊销',
    okType: 'danger',
    cancelText: '取消',
    onOk: async () => {
      await revokeApiKey(tenant, { apiKeyId: record.apiKeyId })
      if (tenant !== tenantId.value) return
      if (costRecord.value?.apiKeyId === record.apiKeyId) costRecord.value = { ...costRecord.value, status: 0 }
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
        <a-button
          type="primary"
          :disabled="!tenantId"
          @click="createVisible = true"
        >
          <PlusOutlined />
          创建 API Key
        </a-button>
      </div>
    </div>

    <!-- Has tenant -->
    <a-card v-if="tenantId" :bordered="false">
      <a-table
        :columns="columns"
        :data-source="data?.records ?? []"
        :loading="loading"
        :pagination="false"
        :scroll="{ x: 1420 }"
        table-layout="fixed"
        row-key="apiKeyId"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'name'">
            <a-tooltip :title="record.name" placement="topLeft" :trigger="['hover', 'focus']">
              <span class="key-name" tabindex="0">{{ record.name }}</span>
            </a-tooltip>
          </template>

          <template v-else-if="column.key === 'key'">
            <span class="key-prefix">{{ record.keyPrefix }}…</span>
          </template>

          <template v-else-if="column.key === 'status'">
            <a-tag v-if="record.status === 0" color="red">已吊销</a-tag>
            <a-tag v-else-if="record.status === 2" color="default">已过期</a-tag>
            <a-tag v-else color="green">正常</a-tag>
          </template>

          <template v-else-if="column.key === 'rateLimit'">
            {{ formatRateLimit(record.rateLimitRpm, record.rateLimitTpm) }}
          </template>

          <template v-else-if="column.key === 'costLimit'">
            <template v-if="record.costLimit">
              <a-tag>{{ record.costLimit.enabled ? '已开启' : '关闭' }}</a-tag>
              <div v-if="record.costLimit.enabled" class="cost-summary">
                日 {{ record.costLimit.dailyLimitFen === null ? '不限' : formatBudgetYuan(record.costLimit.dailyLimitFen) }} ·
                周 {{ record.costLimit.weeklyLimitFen === null ? '不限' : formatBudgetYuan(record.costLimit.weeklyLimitFen) }} ·
                月 {{ record.costLimit.monthlyLimitFen === null ? '不限' : formatBudgetYuan(record.costLimit.monthlyLimitFen) }}
              </div>
            </template>
            <span v-else>--</span>
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
            <template v-if="record.status !== 0">
              <a-button v-if="record.costLimit" type="link" size="small" @click="handleCost(record)">成本详情</a-button>
              <a-button type="link" size="small" @click="handleEdit(record)">
                编辑
              </a-button>
              <a-button type="link" size="small" danger @click="handleRevoke(record)">
                吊销
              </a-button>
            </template>
            <span v-else class="action-placeholder">—</span>
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
      v-if="tenantId"
      v-model:visible="createVisible"
      :tenant-id="tenantId"
      @done="handleDone"
    />

    <ApiKeyCostDrawer v-if="tenantId" v-model:visible="costVisible" :tenant-id="tenantId"
      :record="costRecord" :refresh-version="costRefreshVersion" @edit="handleEdit" />

    <ApiKeyEditDrawer
      v-if="tenantId"
      v-model:visible="editVisible"
      :tenant-id="tenantId"
      :record="editingRecord"
      @done="handleDone"
    />
  </div>
</template>

<style lang="scss" scoped>
.cost-summary { font-size: 12px; color: $color-text-secondary; line-height: 1.7; }
.api-key-list {
  width: 100%;
  max-width: 1480px;
  margin: 0 auto;
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
  background: var(--verse-adaptive-selected, #f0f5ff);
  border: 1px solid var(--verse-adaptive-border-primary, #d6e4ff);
  border-radius: 4px;
  font-family: 'Courier New', monospace;
  font-size: 13px;
  color: var(--verse-adaptive-link, #1677ff);
}

.key-name {
  display: block;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;

  &:focus-visible {
    outline: 2px solid $color-focus;
    outline-offset: 2px;
    border-radius: 2px;
  }
}

.action-placeholder {
  color: $color-text-secondary;
}
</style>
