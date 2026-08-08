<script setup lang="ts">
import { ref, watch, h } from 'vue'
import { message, Modal } from 'ant-design-vue'
import { ExclamationCircleOutlined } from '@ant-design/icons-vue'
import { listJoinRequests, approveJoinRequest, rejectJoinRequest, getUnreviewedJoinRequestCount } from '@/api/tenant'
import { formatDateTime } from '@/utils/date'
import PaginationBar from '@/components/PaginationBar.vue'
import type { TenantJoinReqInfo, TenantJoinReqListRespDTO } from '@/types/tenant'

const props = defineProps<{
  tenantId: string
}>()

const emit = defineEmits<{
  (e: 'changed'): void
}>()

const data = ref<TenantJoinReqListRespDTO | null>(null)
const loading = ref(false)
const pageNum = ref(1)
const pageSize = ref(10)
const statusFilter = ref<'PENDING' | 'PROCESSED'>('PENDING')

// 拒绝 Modal
const rejectModalVisible = ref(false)
const rejectTarget = ref<TenantJoinReqInfo | null>(null)
const rejectComment = ref('')
const rejectLoading = ref(false)

const pendingCount = ref(0)

async function fetchData() {
  loading.value = true
  try {
    data.value = await listJoinRequests(props.tenantId, pageNum.value, pageSize.value)
    if (data.value.requestList.length === 0 && pageNum.value > 1) {
      pageNum.value--
    }
  } catch {
    // handled by interceptor
  } finally {
    loading.value = false
  }
}

async function fetchPendingCount() {
  try {
    const resp = await getUnreviewedJoinRequestCount(props.tenantId)
    pendingCount.value = resp
  } catch {
    // handled by interceptor
  }
}

function refresh() {
  fetchData()
  fetchPendingCount()
  emit('changed')
}

watch(() => props.tenantId, () => { pageNum.value = 1; fetchData(); fetchPendingCount() }, { immediate: true })
watch([pageNum, pageSize], () => { fetchData() })

const filteredList = () => {
  if (!data.value) return []
  if (statusFilter.value === 'PENDING') {
    return data.value.requestList.filter(r => r.status === 'PENDING')
  }
  return data.value.requestList.filter(r => r.status !== 'PENDING')
}

function handleApprove(record: TenantJoinReqInfo) {
  Modal.confirm({
    title: '通过加入申请',
    icon: h(ExclamationCircleOutlined, { style: 'color: #1677ff' }),
    content: `确认通过 ${record.username} 的加入申请？`,
    okText: '确认通过',
    cancelText: '取消',
    onOk: async () => {
      try {
        await approveJoinRequest(props.tenantId, record.requestId)
        message.success(`已通过 ${record.username} 的加入申请`)
        refresh()
      } catch {
        // handled by interceptor
      }
    },
  })
}

function handleRejectClick(record: TenantJoinReqInfo) {
  rejectTarget.value = record
  rejectComment.value = ''
  rejectModalVisible.value = true
}

async function handleRejectConfirm() {
  if (!rejectTarget.value) return
  rejectLoading.value = true
  try {
    await rejectJoinRequest(props.tenantId, rejectTarget.value.requestId, {
      reviewComment: rejectComment.value || undefined,
    })
    message.success(`已拒绝 ${rejectTarget.value.username} 的加入申请`)
    rejectModalVisible.value = false
    refresh()
  } catch {
    // handled by interceptor
  } finally {
    rejectLoading.value = false
  }
}

const pendingColumns = [
  { title: '申请人', key: 'applicant', width: 200 },
  { title: '邀请码', key: 'inviteCode', width: 160 },
  { title: '申请时间', key: 'requestedAt', width: 160 },
  { title: '操作', key: 'action', width: 180 },
]

const processedColumns = [
  { title: '申请人', key: 'applicant', width: 180 },
  { title: '邀请码', key: 'inviteCode', width: 140 },
  { title: '状态', key: 'status', width: 100 },
  { title: '审核人', key: 'reviewer', width: 120 },
  { title: '审核意见', key: 'reviewComment' },
  { title: '审核时间', key: 'reviewedAt', width: 160 },
]
</script>

<template>
  <div class="join-request-panel">
    <!-- Sub-tabs: PENDING / PROCESSED -->
    <div class="jr-subtabs">
      <button
        class="jr-subtab"
        :class="{ active: statusFilter === 'PENDING' }"
        @click="statusFilter = 'PENDING'; pageNum = 1"
      >
        待审批
        <span v-if="pendingCount > 0" class="jr-badge">{{ pendingCount }}</span>
      </button>
      <button
        class="jr-subtab"
        :class="{ active: statusFilter === 'PROCESSED' }"
        @click="statusFilter = 'PROCESSED'; pageNum = 1"
      >
        已处理
      </button>
    </div>

    <!-- PENDING Table -->
    <template v-if="statusFilter === 'PENDING'">
      <a-table
        :columns="pendingColumns"
        :data-source="filteredList()"
        :loading="loading"
        :pagination="false"
        row-key="requestId"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'applicant'">
            <div class="member-cell">
              <span class="member-name">{{ record.username }}</span>
            </div>
          </template>

          <template v-if="column.key === 'inviteCode'">
            <span class="invite-code-badge">{{ record.inviteCode }}</span>
          </template>

          <template v-if="column.key === 'requestedAt'">
            {{ formatDateTime(record.requestedAt) }}
          </template>

          <template v-if="column.key === 'action'">
            <a-space>
              <a-button type="primary" size="small" @click="handleApprove(record)">通过</a-button>
              <a-button size="small" danger @click="handleRejectClick(record)">拒绝</a-button>
            </a-space>
          </template>
        </template>
      </a-table>
    </template>

    <!-- PROCESSED Table -->
    <template v-else>
      <a-table
        :columns="processedColumns"
        :data-source="filteredList()"
        :loading="loading"
        :pagination="false"
        row-key="requestId"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'applicant'">
            <div class="member-cell">
              <span class="member-name">{{ record.username }}</span>
            </div>
          </template>

          <template v-if="column.key === 'inviteCode'">
            <span class="invite-code-badge">{{ record.inviteCode }}</span>
          </template>

          <template v-if="column.key === 'status'">
            <a-tag :color="record.status === 'APPROVED' ? 'green' : 'red'">
              {{ record.status === 'APPROVED' ? '已通过' : '已拒绝' }}
            </a-tag>
          </template>

          <template v-if="column.key === 'reviewer'">
            {{ record.reviewedBy || '—' }}
          </template>

          <template v-if="column.key === 'reviewComment'">
            <span :style="{ color: record.reviewComment ? undefined : '#98a2b3' }">
              {{ record.reviewComment || '—' }}
            </span>
          </template>

          <template v-if="column.key === 'reviewedAt'">
            {{ record.reviewedAt ? formatDateTime(record.reviewedAt) : '—' }}
          </template>
        </template>
      </a-table>
    </template>

    <!-- Pagination -->
    <PaginationBar
      v-if="data"
      v-model:current-page="pageNum"
      v-model:page-size="pageSize"
      :total-pages="data.totalPages"
      :total="data.total"
      :page-size="pageSize"
      page-jump-id="jrPageJump"
    />

    <!-- Reject Modal -->
    <a-modal
      v-model:open="rejectModalVisible"
      title="拒绝加入申请"
      :confirm-loading="rejectLoading"
      ok-text="确认拒绝"
      :ok-button-props="{ danger: true }"
      cancel-text="取消"
      @ok="handleRejectConfirm"
    >
      <div style="margin-bottom: 16px; color: #667085; font-size: 13px;">
        确认拒绝 <strong style="color: #1f2328;">{{ rejectTarget?.username }}</strong> 的加入申请？
      </div>
      <a-form layout="vertical">
        <a-form-item label="审核意见（选填）">
          <a-textarea
            v-model:value="rejectComment"
            placeholder="请输入拒绝原因（最多 255 字）"
            :maxlength="255"
            :rows="3"
          />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<style lang="scss" scoped>
.join-request-panel {
  min-height: 200px;
}

.jr-subtabs {
  display: flex;
  border-bottom: 1px solid $color-border;
  margin-bottom: 16px;
}

.jr-subtab {
  position: relative;
  padding: 8px 12px;
  font-size: 13px;
  color: $color-text-secondary;
  cursor: pointer;
  border: none;
  background: none;
  font-family: inherit;
  transition: color 0.2s;

  &:hover {
    color: $color-primary;
  }

  &.active {
    color: $color-primary;
    font-weight: 500;

    &::after {
      content: '';
      position: absolute;
      bottom: -1px;
      left: 0;
      right: 0;
      height: 2px;
      background: $color-primary;
    }
  }
}

.jr-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 14px;
  height: 14px;
  padding: 0 3px;
  margin-left: 4px;
  border-radius: 7px;
  background: $color-danger;
  color: #fff;
  font-size: 10px;
  font-weight: 600;
  line-height: 1;
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

.member-cell {
  display: flex;
  align-items: center;
  gap: 6px;
}

.member-name {
  font-weight: 500;
}

</style>
