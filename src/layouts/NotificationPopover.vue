<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { unreadCount, newNotification } from '@/composables/useWebSocketNotification'
import {
  BellOutlined,
  InfoCircleOutlined,
  WarningOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons-vue'
import { listNotifications, getNotificationDetail, getUnreadCount, markAllRead } from '@/api/notification'
import type { NotificationItem, NotificationDetail, NotificationSeverity } from '@/types/notification'
import { relativeTime } from '@/utils/time'
import { formatDateTime } from '@/utils/date'

const router = useRouter()

// 本地未读数（由共享 unreadCount + API 协同驱动）
const count = ref(0)

// 通知列表
const notifications = ref<NotificationItem[]>([])
const loading = ref(false)

// 详情 Modal
const detailVisible = ref(false)
const detail = ref<NotificationDetail | null>(null)
const detailLoading = ref(false)

// Severity 图标映射
const severityIconMap: Record<NotificationSeverity, typeof InfoCircleOutlined> = {
  INFO: InfoCircleOutlined,
  WARNING: WarningOutlined,
  CRITICAL: CloseCircleOutlined,
}

// 类型标签
const typeLabel: Record<string, string> = {
  SYSTEM: '系统通知',
  ANNOUNCEMENT: '管理员公告',
}

// 是否有未读（用本地 count，由 watch(unreadCount) 驱动更新）
const hasUnread = computed(() => count.value > 0)

// 获取未读数量
async function fetchUnreadCount() {
  try {
    const res = await getUnreadCount()
    count.value = res.count
  } catch {
    // handled by interceptor
  }
}

// 获取通知列表（Popover 展示最近 5 条）
async function fetchNotifications() {
  loading.value = true
  try {
    const res = await listNotifications(1, 5)
    notifications.value = res.records
  } catch {
    // handled by interceptor
  } finally {
    loading.value = false
  }
}

// 打开 Popover 时加载数据
function handlePopoverOpen() {
  fetchNotifications()
  fetchUnreadCount()
}

// 全部已读
async function handleMarkAllRead() {
  if (count.value === 0) {
    message.info('没有未读通知')
    return
  }
  try {
    const marked = await markAllRead()
    if (marked >= 0) {
      message.success(`已标记 ${marked} 条通知为已读`)
      count.value = 0
      notifications.value.forEach(n => { n.isRead = true })
    }
  } catch {
    // handled by interceptor
  }
}

// 点击通知项 — 打开详情
async function handleItemClick(item: NotificationItem) {
  detailLoading.value = true
  detailVisible.value = true
  try {
    const res = await getNotificationDetail(item.notificationId)
    detail.value = res
    // 标记本地为已读
    item.isRead = true
    if (count.value > 0) {
      count.value--
    }
  } catch {
    detailVisible.value = false
  } finally {
    detailLoading.value = false
  }
}

// 查看全部通知
function handleViewAll() {
  router.push('/notifications')
}

// AppLayout 挂载时初始化未读数量
onMounted(() => {
  fetchUnreadCount()
})

// 监听 WebSocket 推送的 unreadCount，同步到本地 count
watch(unreadCount, (val) => {
  count.value = val
})

// WebSocket 新通知到达时更新 popover 列表（红点由 hasUnread computed 驱动）
watch(newNotification, (notif) => {
  if (notif) {
    notifications.value.unshift(notif)
  }
})

</script>

<template>
  <!-- 红点在 a-popover 外面，避免 popover 内部 trigger slot 缓存阻止 v-if 更新 -->
  <span class="notif-bell-wrap">
    <a-popover
      trigger="click"
      placement="bottomRight"
      :overlay-style="{ padding: 0 }"
      overlay-class-name="notif-popover-overlay"
      @openChange="(open: boolean) => open && handlePopoverOpen()"
    >
      <template #content>
        <div class="notif-panel">
          <!-- Header -->
          <div class="notif-header">
            <div class="notif-header-left">
              <span class="notif-title">通知</span>
              <span v-if="count > 0" class="notif-title-count">({{ count }}条未读)</span>
            </div>
            <a class="notif-read-all" @click="handleMarkAllRead">全部已读</a>
          </div>

        <!-- Loading -->
        <div v-if="loading" class="notif-loading">
          <a-spin size="small" />
          <span>加载中...</span>
        </div>

        <!-- List -->
        <div v-else-if="notifications.length > 0" class="notif-body">
          <div
            v-for="item in notifications"
            :key="item.notificationId"
            class="notif-item"
            :class="{ unread: !item.isRead }"
            @click="handleItemClick(item)"
          >
            <span v-if="!item.isRead" class="notif-dot" />
            <span class="notif-icon" :class="'severity-' + item.severity">
              <component :is="severityIconMap[item.severity]" />
            </span>
            <div class="notif-content">
              <div class="notif-item-title-row">
                <span class="notif-item-title">{{ item.title }}</span>
                <span class="notif-type-tag" :class="'type-' + item.type">{{ typeLabel[item.type] || item.type }}</span>
              </div>
              <div class="notif-item-desc">{{ item.content }}</div>
              <div class="notif-item-time">{{ relativeTime(item.createTime) }}</div>
            </div>
          </div>
        </div>

        <!-- Empty -->
        <div v-else class="notif-empty">
          <span class="notif-empty-icon">
            <BellOutlined />
          </span>
          <span class="notif-empty-text">没有通知</span>
        </div>

        <!-- Footer -->
        <div v-if="notifications.length > 0" class="notif-footer">
          <a class="notif-footer-link" @click="handleViewAll">查看全部通知</a>
        </div>
      </div>
    </template>

    <BellOutlined class="notif-bell" />
  </a-popover>

  <span v-if="hasUnread" class="notif-red-dot" />
</span>

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
</template>

<style lang="scss" scoped>
// ========== Bell Button ==========
.notif-bell-wrap {
  position: relative;
  display: inline-flex;
}

.notif-bell {
  font-size: 18px;
  color: $color-text-secondary;
  cursor: pointer;
  padding: 6px;
  border-radius: $radius-button;
  transition: all 0.15s;

  &:hover {
    color: $color-primary;
    background: #f5f5f5;
  }
}

.notif-red-dot {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: $color-danger;
  border: 1.5px solid $color-bg;
  pointer-events: none;
}

// ========== Panel ==========
.notif-panel {
  width: 380px;
}

// ========== Header ==========
.notif-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px 12px;
  border-bottom: 1px solid $color-border;
}

.notif-header-left {
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.notif-title {
  font-size: $font-size-h3;
  font-weight: 600;
  color: $color-text-primary;
}

.notif-title-count {
  font-size: 13px;
  color: $color-text-secondary;
  font-weight: 400;
}

.notif-read-all {
  font-size: 13px;
  color: $color-primary;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: background 0.15s;

  &:hover {
    background: #e6f4ff;
  }
}

// ========== Loading ==========
.notif-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 48px 20px;
  color: $color-text-secondary;
  font-size: 13px;
}

// ========== Body ==========
.notif-body {
  max-height: 360px;
  overflow-y: auto;
}

// ========== Notification Item ==========
.notif-item {
  display: flex;
  gap: 12px;
  padding: 14px 20px;
  cursor: pointer;
  transition: background 0.12s;
  border-bottom: 1px solid #fafafa;
  position: relative;

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background: #fafafa;
  }

  &.unread {
    background: #f0f7ff;

    &:hover {
      background: #e6f4ff;
    }
  }
}

.notif-dot {
  position: absolute;
  top: 18px;
  left: 8px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: $color-primary;
  flex-shrink: 0;
}

.notif-icon {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 16px;

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

.notif-content {
  flex: 1;
  min-width: 0;
}

.notif-item-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.notif-item-title {
  font-size: $font-size-body;
  font-weight: 500;
  color: $color-text-primary;
  line-height: 1.4;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}

.notif-type-tag {
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 10px;
  font-weight: 500;
  flex-shrink: 0;
  white-space: nowrap;

  &.type-SYSTEM {
    background: #e6f4ff;
    color: $color-primary;
  }

  &.type-ANNOUNCEMENT {
    background: #f6ffed;
    color: $color-success;
  }
}

.notif-item-desc {
  font-size: 13px;
  color: $color-text-secondary;
  line-height: 1.4;
  margin-top: 2px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.notif-item-time {
  font-size: $font-size-caption;
  color: #bfbfbf;
  margin-top: 4px;
  white-space: nowrap;
}

// ========== Empty State ==========
.notif-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 20px;
  color: #bfbfbf;
}

.notif-empty-icon {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: #fafafa;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
  font-size: 36px;
  color: #d9d9d9;
}

.notif-empty-text {
  font-size: $font-size-body;
  color: #bfbfbf;
}

// ========== Footer ==========
.notif-footer {
  border-top: 1px solid $color-border;
}

.notif-footer-link {
  display: block;
  width: 100%;
  padding: 12px 20px;
  text-align: center;
  font-size: 13px;
  color: $color-text-secondary;
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    color: $color-primary;
    background: #fafafa;
  }
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

<style lang="scss">
// Non-scoped: override ant-popover inner padding
.notif-popover-overlay .ant-popover-inner {
  padding: 0 !important;
}
</style>
