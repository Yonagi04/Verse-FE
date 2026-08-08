<script setup lang="ts">
import { ref, watch, h } from 'vue'
import { message, Modal } from 'ant-design-vue'
import { ExclamationCircleOutlined, CopyOutlined } from '@ant-design/icons-vue'
import { listInviteCodes, deactivateInviteCode, activateInviteCode } from '@/api/tenant'
import { formatDateTime } from '@/utils/date'
import TenantInviteModal from './TenantInviteModal.vue'
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

function canOperate(record: TenantInviteInfo): boolean {
  return record.isActive === 1 && record.expiresAt !== null
    ? new Date(record.expiresAt).getTime() > Date.now()
    : record.isActive === 1
}

function isExpired(record: TenantInviteInfo): boolean {
  return record.expiresAt !== null && new Date(record.expiresAt).getTime() <= Date.now()
}

function handleDeactivate(record: TenantInviteInfo) {
  Modal.confirm({
    title: '停用邀请码',
    icon: h(ExclamationCircleOutlined, { style: 'color: #faad14' }),
    content: `确认停用邀请码 ${record.code}？停用后该邀请码将无法使用。`,
    okText: '确认停用',
    cancelText: '取消',
    onOk: async () => {
      try {
        await deactivateInviteCode(props.tenantId, record.id)
        message.success('邀请码已停用')
        fetchData()
      } catch {
        // handled by interceptor
      }
    },
  })
}

async function handleActivate(record: TenantInviteInfo) {
  try {
    await activateInviteCode(props.tenantId, record.id)
    message.success('邀请码已启用')
    fetchData()
  } catch {
    // handled by interceptor
  }
}

async function handleCopy(record: TenantInviteInfo) {
  try {
    await navigator.clipboard.writeText(record.code)
    message.success('邀请码已复制')
  } catch {
    message.error('复制失败')
  }
}

function onInviteDone() {
  fetchData()
}

const columns = [
  {
    title: '邀请码',
    key: 'code',
    width: 220,
  },
  {
    title: '创建者',
    key: 'creator',
    width: 120,
  },
  {
    title: '使用次数',
    key: 'usage',
    width: 100,
  },
  {
    title: '状态',
    key: 'status',
    width: 100,
  },
  {
    title: '过期时间',
    key: 'expires',
    width: 160,
  },
  {
    title: '创建时间',
    key: 'createTime',
    width: 160,
  },
  {
    title: '操作',
    key: 'action',
    width: 120,
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
          <div class="invite-code-cell">
            <span class="invite-code-badge">{{ record.code }}</span>
            <a-button type="link" size="small" @click="handleCopy(record)">
              <template #icon><CopyOutlined /></template>
              复制
            </a-button>
          </div>
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
          <template v-if="isExpired(record)">
            <span class="action-placeholder">—</span>
          </template>
          <template v-else-if="record.isActive === 1">
            <a-button type="link" @click="handleDeactivate(record)">停用</a-button>
          </template>
          <template v-else>
            <a-button type="link" @click="handleActivate(record)">启用</a-button>
          </template>
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
  </div>
</template>

<style lang="scss" scoped>
.invite-toolbar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 16px;
}

.invite-code-cell {
  display: flex;
  align-items: center;
  gap: 4px;
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

.action-placeholder {
  font-size: 12px;
  color: #98a2b3;
}

</style>
