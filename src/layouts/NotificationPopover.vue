<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  BellOutlined,
  InfoCircleOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons-vue'

interface NotificationItem {
  id: string
  title: string
  content: string
  time: string
  read: boolean
  type: 'info' | 'warning' | 'success' | 'error'
}

const notifications = ref<NotificationItem[]>([
  {
    id: '1',
    title: '系统通知',
    content: '欢迎使用 Verse LLM Gateway 管理平台，请完善您的个人信息和租户配置',
    time: '2 分钟前',
    read: false,
    type: 'info',
  },
  {
    id: '2',
    title: '租户变更',
    content: '您已被管理员添加到「研发小组」租户，角色为 MEMBER',
    time: '1 小时前',
    read: false,
    type: 'success',
  },
  {
    id: '3',
    title: 'API 密钥即将过期',
    content: '您的 API 密钥 sk-xxxxxxxxxxxxx 将在 3 天后过期，请及时更新',
    time: '3 小时前',
    read: true,
    type: 'warning',
  },
  {
    id: '4',
    title: '用量提醒',
    content: '本月 Token 用量已达配额 80%，建议升级套餐以获得更多配额',
    time: '昨天',
    read: true,
    type: 'error',
  },
])

const unreadCount = computed(() => notifications.value.filter(n => !n.read).length)

const iconMap = {
  info: InfoCircleOutlined,
  warning: WarningOutlined,
  success: CheckCircleOutlined,
  error: CloseCircleOutlined,
}

function markAllRead() {
  notifications.value.forEach(n => {
    n.read = true
  })
}
</script>

<template>
  <a-popover
    trigger="click"
    placement="bottomRight"
    :overlay-style="{ padding: 0 }"
    overlay-class-name="notif-popover-overlay"
  >
    <template #content>
      <div class="notif-panel">
        <!-- Header -->
        <div class="notif-header">
          <span class="notif-title">通知</span>
          <a class="notif-read-all" @click="markAllRead">全部已读</a>
        </div>

        <!-- Body: List or Empty -->
        <div v-if="notifications.length > 0" class="notif-body">
          <div
            v-for="item in notifications"
            :key="item.id"
            class="notif-item"
            :class="{ unread: !item.read }"
          >
            <span v-if="!item.read" class="notif-dot" />
            <span class="notif-icon" :class="item.type">
              <component :is="iconMap[item.type]" />
            </span>
            <div class="notif-content">
              <div class="notif-item-title">{{ item.title }}</div>
              <div class="notif-item-desc">{{ item.content }}</div>
              <div class="notif-item-time">{{ item.time }}</div>
            </div>
          </div>
        </div>

        <div v-else class="notif-empty">
          <span class="notif-empty-icon">
            <BellOutlined />
          </span>
          <span class="notif-empty-text">没有通知</span>
        </div>

        <!-- Footer -->
        <div v-if="notifications.length > 0" class="notif-footer">
          <a class="notif-footer-link">查看全部通知</a>
        </div>
      </div>
    </template>

    <a-badge :count="unreadCount" :overflow-count="99">
      <BellOutlined class="notif-bell" />
    </a-badge>
  </a-popover>
</template>

<style lang="scss" scoped>
// ========== Bell Button ==========
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

.notif-title {
  font-size: $font-size-h3;
  font-weight: 600;
  color: $color-text-primary;
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

  &.info {
    background: #e6f4ff;
    color: $color-primary;
  }

  &.warning {
    background: #fff7e6;
    color: #fa8c16;
  }

  &.success {
    background: #f6ffed;
    color: $color-success;
  }

  &.error {
    background: #fff1f0;
    color: $color-danger;
  }
}

.notif-content {
  flex: 1;
  min-width: 0;
}

.notif-item-title {
  font-size: $font-size-body;
  font-weight: 500;
  color: $color-text-primary;
  line-height: 1.4;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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
</style>

<style lang="scss">
// Non-scoped: override ant-popover inner padding
.notif-popover-overlay .ant-popover-inner {
  padding: 0 !important;
}
</style>
