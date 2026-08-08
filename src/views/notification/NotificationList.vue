<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import {
  ArrowLeftOutlined,
  InfoCircleOutlined,
  WarningOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons-vue'
import { listNotifications, getNotificationDetail, getUnreadCount, markAllRead } from '@/api/notification'
import type { NotificationItem, NotificationDetail, NotificationSeverity, NotificationType } from '@/types/notification'
import { formatDateTime } from '@/utils/date'
import { newNotification, unreadCount } from '@/composables/useWebSocketNotification'

const router = useRouter()

// 本地未读数
const count = ref(0)

// 列表状态
const loading = ref(false)
const notifications = ref<NotificationItem[]>([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = 10

// 筛选
type FilterValue = 'ALL' | NotificationType | NotificationSeverity | 'UNREAD' | 'READ'
const typeFilter = ref<FilterValue>('ALL')
const severityFilter = ref<FilterValue>('ALL')
const readFilter = ref<FilterValue>('ALL')

// 详情 Modal
const detailVisible = ref(false)
const detail = ref<NotificationDetail | null>(null)
const detailLoading = ref(false)

// 筛选选项
const typeOptions = [
  { value: 'ALL', label: '全部类型' },
  { value: 'SYSTEM', label: '系统通知' },
  { value: 'ANNOUNCEMENT', label: '管理员公告' },
] as const
const severityOptions = [
  { value: 'ALL', label: '全部级别' },
  { value: 'INFO', label: '一般' },
  { value: 'WARNING', label: '需关注' },
  { value: 'CRITICAL', label: '严重' },
] as const
const readOptions = [
  { value: 'ALL', label: '全部状态' },
  { value: 'UNREAD', label: '未读' },
  { value: 'READ', label: '已读' },
] as const

// Severity 图标映射
const severityIconMap: Record<NotificationSeverity, typeof InfoCircleOutlined> = {
  INFO: InfoCircleOutlined,
  WARNING: WarningOutlined,
  CRITICAL: CloseCircleOutlined,
}

// 类型标签
const typeLabel: Record<NotificationType, string> = {
  SYSTEM: '系统通知',
  ANNOUNCEMENT: '管理员公告',
}

// 严重程度文字
const severityLabel: Record<string, string> = {
  INFO: '一般',
  WARNING: '需关注',
  CRITICAL: '严重',
}

// 表格列定义
const columns = [
  { title: '级别', dataIndex: 'severity', key: 'severity', width: 120 },
  { title: '标题', dataIndex: 'title', key: 'title' },
  { title: '类型', dataIndex: 'type', key: 'type', width: 100 },
  { title: '内容摘要', dataIndex: 'content', key: 'content', ellipsis: true },
  { title: '时间', dataIndex: 'createTime', key: 'createTime', width: 180 },
]

// 获取数据
async function fetchData() {
  loading.value = true
  try {
    const res = await listNotifications(currentPage.value, pageSize)
    // 前端筛选（API 不支持筛选参数）
    let records = res.records
    if (typeFilter.value !== 'ALL') {
      records = records.filter(n => n.type === typeFilter.value)
    }
    if (severityFilter.value !== 'ALL') {
      records = records.filter(n => n.severity === severityFilter.value)
    }
    if (readFilter.value === 'UNREAD') {
      records = records.filter(n => !n.isRead)
    } else if (readFilter.value === 'READ') {
      records = records.filter(n => n.isRead)
    }
    notifications.value = records
    total.value = res.total
    // 获取未读数量
    const uc = await getUnreadCount()
    count.value = uc.count
  } catch {
    // handled by interceptor
  } finally {
    loading.value = false
  }
}

// 翻页
function handlePageChange(page: number) {
  currentPage.value = page
  fetchData()
}

// 筛选变更
function handleFilterChange() {
  currentPage.value = 1
  fetchData()
}

// 全部已读
async function handleMarkAllRead() {
  if (count.value === 0) {
    message.info('没有未读通知')
    return
  }
  try {
    const count = await markAllRead()
    if (count >= 0) {
      message.success(`已标记 ${count} 条通知为已读`)
      fetchData()
    }
  } catch {
    // handled by interceptor
  }
}

// 点击行 — 打开详情
async function handleRowClick(record: NotificationItem) {
  detailLoading.value = true
  detailVisible.value = true
  try {
    const res = await getNotificationDetail(record.notificationId)
    detail.value = res
    record.isRead = true
    if (count.value > 0) {
      count.value--
    }
  } catch {
    detailVisible.value = false
  } finally {
    detailLoading.value = false
  }
}

// 返回仪表盘
function goBack() {
  router.push('/dashboard')
}

onMounted(() => {
  fetchData()
})

// 检查新通知是否匹配当前筛选条件
function matchesFilter(notif: NotificationItem): boolean {
  if (typeFilter.value !== 'ALL' && notif.type !== typeFilter.value) return false
  if (severityFilter.value !== 'ALL' && notif.severity !== severityFilter.value) return false
  if (readFilter.value === 'UNREAD' && notif.isRead) return false
  if (readFilter.value === 'READ' && !notif.isRead) return false
  return true
}

// 监听 WebSocket 推送的 unreadCount，同步到本地 count
watch(unreadCount, (val) => {
  count.value = val
})

// WebSocket 新通知插入列表顶部（筛选感知）
watch(newNotification, (notif) => {
  if (notif && matchesFilter(notif)) {
    notifications.value.unshift(notif)
  }
})
</script>

<template>
  <div class="notif-list-page">
    <!-- Page Header -->
    <div class="page-header">
      <div class="page-header-left">
        <a-button type="text" size="small" @click="goBack">
          <ArrowLeftOutlined />
        </a-button>
        <h2 class="page-title">通知</h2>
        <span v-if="unreadCount > 0" class="page-unread-count">({{ count }}条未读)</span>
      </div>
      <a class="page-read-all" @click="handleMarkAllRead">全部已读</a>
    </div>

    <!-- Filters -->
    <div class="filter-bar">
      <a-radio-group
        v-model:value="typeFilter"
        option-type="button"
        size="small"
        @change="handleFilterChange"
      >
        <a-radio-button
          v-for="opt in typeOptions"
          :key="opt.value"
          :value="opt.value"
        >
          {{ opt.label }}
        </a-radio-button>
      </a-radio-group>
      <a-divider type="vertical" style="height: 24px;" />
      <a-radio-group
        v-model:value="severityFilter"
        option-type="button"
        size="small"
        @change="handleFilterChange"
      >
        <a-radio-button
          v-for="opt in severityOptions"
          :key="opt.value"
          :value="opt.value"
        >
          {{ opt.label }}
        </a-radio-button>
      </a-radio-group>
      <a-divider type="vertical" style="height: 24px;" />
      <a-radio-group
        v-model:value="readFilter"
        option-type="button"
        size="small"
        @change="handleFilterChange"
      >
        <a-radio-button
          v-for="opt in readOptions"
          :key="opt.value"
          :value="opt.value"
        >
          {{ opt.label }}
        </a-radio-button>
      </a-radio-group>
    </div>

    <!-- Table -->
    <a-card :bordered="false">
      <a-table
        :columns="columns"
        :data-source="notifications"
        :loading="loading"
        :pagination="{
          current: currentPage,
          pageSize: pageSize,
          total: total,
          showSizeChanger: false,
          showTotal: (t: number) => `共 ${t} 条通知`,
          onChange: handlePageChange,
        }"
        row-key="notificationId"
        @row-click="handleRowClick"
      >
        <template #bodyCell="{ column, record }">
          <!-- 级别：蓝点 + 图标 + 文字 -->
          <template v-if="column.key === 'severity'">
            <span class="severity-cell">
              <span v-if="!record.isRead" class="table-dot" />
              <span class="table-severity-icon" :class="'severity-' + record.severity">
                <component :is="severityIconMap[record.severity as NotificationSeverity]" />
              </span>
              <span class="table-severity-label">{{ severityLabel[record.severity] || record.severity }}</span>
            </span>
          </template>
          <!-- 标题 -->
          <template v-if="column.key === 'title'">
            <span class="table-title-text">{{ record.title }}</span>
          </template>
          <!-- 类型标签 -->
          <template v-if="column.key === 'type'">
            <a-tag :color="record.type === 'SYSTEM' ? 'blue' : 'green'">
              {{ typeLabel[record.type as NotificationType] || record.type }}
            </a-tag>
          </template>
          <!-- 内容摘要（悬停展示完整内容） -->
          <template v-if="column.key === 'content'">
            <a-tooltip :title="record.content" placement="topLeft">
              <span class="table-content">{{ record.content }}</span>
            </a-tooltip>
          </template>
          <!-- 时间 -->
          <template v-if="column.key === 'createTime'">
            {{ formatDateTime(record.createTime) }}
          </template>
        </template>

        <!-- Empty -->
        <template #emptyText>
          <a-empty description="没有符合条件的通知" />
        </template>
      </a-table>
    </a-card>

    <!-- Detail Modal -->
    <a-modal
      v-model:open="detailVisible"
      :title="detail?.title || '通知详情'"
      :footer="null"
      width="560px"
      destroyOnClose
      :confirm-loading="detailLoading"
    >
      <template v-if="detail">
        <div class="detail-meta">
          <a-tag v-if="detail.type === 'SYSTEM'" color="blue">系统通知</a-tag>
          <a-tag v-else color="green">管理员公告</a-tag>
          <a-tag v-if="detail.severity === 'INFO'" color="blue">一般</a-tag>
          <a-tag v-else-if="detail.severity === 'WARNING'" color="orange">需关注</a-tag>
          <a-tag v-else color="red">严重</a-tag>
          <span class="detail-time">{{ formatDateTime(detail.createTime) }}</span>
        </div>
        <div class="detail-content">{{ detail.content }}</div>
      </template>
      <div v-else class="detail-loading">
        <a-spin />
      </div>
    </a-modal>
  </div>
</template>

<style lang="scss" scoped>
.notif-list-page {
  max-width: 1200px;
}

// ========== Page Header ==========
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.page-header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.page-title {
  font-size: $font-size-title;
  font-weight: 600;
  color: $color-text-primary;
  margin: 0;
}

.page-unread-count {
  font-size: 14px;
  color: $color-text-secondary;
  font-weight: 400;
}

.page-read-all {
  font-size: 14px;
  color: $color-primary;
  cursor: pointer;
  padding: 4px 12px;
  border-radius: $radius-button;
  transition: background 0.15s;

  &:hover {
    background: #e6f4ff;
  }
}

// ========== Filter Bar ==========
.filter-bar {
  display: flex;
  align-items: center;
  gap: 0;
  margin-bottom: 16px;
}

// ========== Table ==========
:deep(.ant-table-row) {
  cursor: pointer;
}

.table-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: $color-primary;
  flex-shrink: 0;
}

.severity-cell {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.table-severity-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  font-size: 13px;
  flex-shrink: 0;

  &.severity-INFO {
    background: #e6f4ff;
    color: $color-primary;
  }

  &.severity-WARNING {
    background: #fff7e6;
    color: #fa8c16;
  }

  &.severity-CRITICAL {
    background: #fff1f0;
    color: $color-danger;
  }
}

.table-severity-label {
  font-size: 13px;
  color: $color-text-secondary;
  white-space: nowrap;
}

.table-title-text {
  font-weight: 500;
}

.table-content {
  color: $color-text-secondary;
  font-size: 13px;
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}

// ========== Detail Modal ==========
.detail-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.detail-time {
  font-size: $font-size-caption;
  color: $color-text-secondary;
  margin-left: auto;
}

.detail-content {
  font-size: $font-size-body;
  color: $color-text-primary;
  line-height: 1.8;
  white-space: pre-wrap;
}

.detail-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48px 0;
}
</style>
