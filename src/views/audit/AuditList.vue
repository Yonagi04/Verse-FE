<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useTenantStore } from '@/stores/tenant'
import { listAuditLogs } from '@/api/audit'
import { getTenantMembers } from '@/api/tenant'
import { formatDateTime } from '@/utils/date'
import PaginationBar from '@/components/PaginationBar.vue'
import AuditDetailDrawer from './AuditDetailDrawer.vue'
import type { LlmAuditInfo, LlmAuditListRespDTO } from '@/types/audit'
import type { TenantMemberInfo } from '@/types/tenant'

const tenantStore = useTenantStore()

const tenantId = computed(() => tenantStore.currentTenantId)
const data = ref<LlmAuditListRespDTO | null>(null)
const loading = ref(false)
const pageNum = ref(1)
const pageSize = ref(10)

const userIdFilter = ref<string | null>(null)
const members = ref<TenantMemberInfo[]>([])

const detailVisible = ref(false)
const detailRecord = ref<LlmAuditInfo | null>(null)

// 权限只来源于当前租户统一状态。
const selectedRole = computed(() => tenantStore.currentRole)

const canFilterByUser = computed(() => selectedRole.value === 'ADMIN' || selectedRole.value === 'SUPER_ADMIN')

const memberOptions = computed(() =>
  members.value.map((m) => ({ value: m.userId, label: m.nickname || m.username })),
)

const columns = [
  { title: '调用时间', key: 'createTime', width: 170 },
  { title: '用户', dataIndex: 'username', key: 'username', width: 120 },
  { title: '模型', dataIndex: 'model', key: 'model', width: 140 },
  { title: '输入概略', dataIndex: 'promptPreview', key: 'promptPreview', ellipsis: true },
  { title: 'Token', dataIndex: 'totalTokens', key: 'totalTokens', width: 90 },
  { title: '耗时', key: 'latencyMs', width: 100 },
  { title: '状态', key: 'status', width: 90 },
  { title: '操作', key: 'action', width: 80 },
]

function formatLatency(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)} s` : `${ms} ms`
}

async function fetchLogs() {
  if (!tenantId.value) return
  loading.value = true
  try {
    data.value = await listAuditLogs(
      tenantId.value,
      pageNum.value,
      pageSize.value,
      canFilterByUser.value ? userIdFilter.value ?? undefined : undefined,
    )
    if (data.value.auditList.length === 0 && pageNum.value > 1) {
      pageNum.value--
    }
  } catch {
    // handled by interceptor
  } finally {
    loading.value = false
  }
}

async function fetchMembers() {
  if (!tenantId.value || !canFilterByUser.value) return
  try {
    const resp = await getTenantMembers(tenantId.value, 1, 100)
    members.value = resp.tenantMembers ?? []
  } catch {
    // handled by interceptor
  }
}

watch(tenantId, (val) => {
  detailVisible.value = false
  detailRecord.value = null
  if (!val) {
    data.value = null
    members.value = []
    return
  }
  pageNum.value = 1
  userIdFilter.value = null
  fetchMembers()
  fetchLogs()
}, { immediate: true })

watch([pageNum, pageSize], () => {
  if (tenantId.value) fetchLogs()
})

watch(userIdFilter, () => {
  pageNum.value = 1
  if (tenantId.value) fetchLogs()
})

function openDetail(record: LlmAuditInfo) {
  detailRecord.value = record
  detailVisible.value = true
}

function handleRowClick(record: LlmAuditInfo) {
  return { onClick: () => openDetail(record) }
}
</script>

<template>
  <div class="audit-list">
    <div class="page-header">
      <div>
        <h2 class="page-title">调用日志</h2>
        <p class="page-desc">查看租户内 LLM 模型调用审计记录，排查失败原因与用量明细</p>
      </div>
    </div>

    <!-- Has tenant -->
    <a-card v-if="tenantId" :bordered="false">
      <div class="list-toolbar">
        <a-select
          v-if="canFilterByUser"
          v-model:value="userIdFilter"
          :options="memberOptions"
          allow-clear
          placeholder="全部用户"
          style="width: 200px"
        />
      </div>

      <a-table
        :columns="columns"
        :data-source="data?.auditList ?? []"
        :loading="loading"
        :pagination="false"
        row-key="id"
        :custom-row="handleRowClick"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'createTime'">
            {{ formatDateTime(record.createTime) }}
          </template>

          <template v-else-if="column.key === 'latencyMs'">
            {{ formatLatency(record.latencyMs) }}
          </template>

          <template v-else-if="column.key === 'status'">
            <a-tag v-if="record.status === 'SUCCESS'" color="green">成功</a-tag>
            <a-tag v-else color="red">失败</a-tag>
          </template>

          <template v-else-if="column.key === 'action'">
            <a-button type="link" size="small" @click.stop="openDetail(record)">
              详情
            </a-button>
          </template>
        </template>

        <template #emptyText>
          <a-empty description="暂无审计记录，租户需开启「模型调用审计」后才会产生记录" />
        </template>
      </a-table>

      <PaginationBar
        v-if="data && data.total > 0"
        v-model:current-page="pageNum"
        v-model:page-size="pageSize"
        :total-pages="data.totalPages"
        :total="data.total"
        page-jump-id="auditPageJump"
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

    <AuditDetailDrawer
      v-if="tenantId"
      v-model:visible="detailVisible"
      :tenant-id="tenantId"
      :record="detailRecord"
    />
  </div>
</template>

<style lang="scss" scoped>
.audit-list {
  max-width: 1400px;
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

.list-toolbar {
  margin-bottom: 16px;
}
</style>
