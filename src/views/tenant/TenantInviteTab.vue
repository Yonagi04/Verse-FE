<script setup lang="ts">
import { ref, watch } from 'vue'
import { listInviteCodes } from '@/api/tenant'
import { formatDateTime } from '@/utils/date'
import TenantInviteModal from './TenantInviteModal.vue'
import InviteDetailModal from './InviteDetailModal.vue'
import PaginationBar from '@/components/PaginationBar.vue'
import type { TenantInviteInfo, TenantInviteListRespDTO } from '@/types/tenant'

const props = defineProps<{
  tenantId: string
}>()

const data = ref<TenantInviteListRespDTO | null>(null)
const loading = ref(false)
const pageNum = ref(1)
const pageSize = ref(10)
const inviteModalVisible = ref(false)
const detailVisible = ref(false)
const detailInvite = ref<TenantInviteInfo | null>(null)

async function fetchData() {
  loading.value = true
  try {
    data.value = await listInviteCodes(props.tenantId, pageNum.value, pageSize.value)
    if (data.value.inviteCodes.length === 0 && pageNum.value > 1) {
      pageNum.value--
    }
  } catch {
    // handled by interceptor
  } finally {
    loading.value = false
  }
}

watch(() => props.tenantId, () => { pageNum.value = 1; fetchData() }, { immediate: true })
watch([pageNum, pageSize], () => { fetchData() })

function isExpired(record: TenantInviteInfo): boolean {
  return record.expiresAt !== null && new Date(record.expiresAt).getTime() <= Date.now()
}

function handleDetail(record: TenantInviteInfo) {
  detailInvite.value = record
  detailVisible.value = true
}

function onInviteDone() {
  fetchData()
}

function onDetailDone() {
  fetchData()
}

const columns = [
  {
    title: '邀请码',
    key: 'code',
    width: 160,
  },
  {
    title: '邀请链接',
    key: 'url',
    width: 220,
  },
  {
    title: '创建者',
    key: 'creator',
    width: 100,
  },
  {
    title: '使用次数',
    key: 'usage',
    width: 90,
  },
  {
    title: '状态',
    key: 'status',
    width: 90,
  },
  {
    title: '过期时间',
    key: 'expires',
    width: 150,
  },
  {
    title: '创建时间',
    key: 'createTime',
    width: 150,
  },
  {
    title: '操作',
    key: 'action',
    width: 80,
  },
]
</script>

<template>
  <div class="invite-tab">
    <div class="invite-toolbar">
      <a-button type="primary" @click="inviteModalVisible = true">
        生成邀请码
      </a-button>
    </div>

    <a-table
      :columns="columns"
      :data-source="data?.inviteCodes ?? []"
      :loading="loading"
      :pagination="false"
      row-key="id"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'code'">
          <span class="invite-code-badge">{{ record.code }}</span>
        </template>

        <template v-if="column.key === 'url'">
          <span class="invite-url-cell">{{ record.inviteUrl }}</span>
        </template>

        <template v-if="column.key === 'creator'">
          {{ record.createdByUsername }}
        </template>

        <template v-if="column.key === 'usage'">
          <a-tag :color="record.usageCount > 0 ? 'blue' : undefined">
            {{ record.usageCount }} 次
          </a-tag>
        </template>

        <template v-if="column.key === 'status'">
          <template v-if="isExpired(record)">
            <a-tag color="default">已过期</a-tag>
          </template>
          <template v-else-if="record.isActive === 1">
            <a-tag color="green">启用</a-tag>
          </template>
          <template v-else>
            <a-tag color="default">已停用</a-tag>
          </template>
        </template>

        <template v-if="column.key === 'expires'">
          {{ record.expiresAt ? formatDateTime(record.expiresAt) : '永久有效' }}
        </template>

        <template v-if="column.key === 'createTime'">
          {{ formatDateTime(record.createTime) }}
        </template>

        <template v-if="column.key === 'action'">
          <a-button type="link" size="small" @click="handleDetail(record)">详情</a-button>
        </template>
      </template>
    </a-table>

    <PaginationBar
      v-if="data"
      v-model:current-page="pageNum"
      v-model:page-size="pageSize"
      :total-pages="data.totalPages"
      :total="data.total"
      :page-size="pageSize"
      page-jump-id="invitePageJump"
    />

    <TenantInviteModal
      v-model:visible="inviteModalVisible"
      :tenant-id="tenantId"
      @done="onInviteDone"
    />

    <InviteDetailModal
      v-model:visible="detailVisible"
      :tenant-id="tenantId"
      :invite="detailInvite"
      @done="onDetailDone"
    />
  </div>
</template>

<style lang="scss" scoped>
.invite-toolbar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 16px;
}

.invite-code-badge {
  display: inline-block;
  padding: 2px 10px;
  background: #f0f5ff;
  border: 1px solid #d6e4ff;
  border-radius: 4px;
  font-family: 'Courier New', monospace;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 2px;
  color: #1677ff;
}

.invite-url-cell {
  font-size: 12px;
  color: $color-text-secondary;
  display: block;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

</style>
