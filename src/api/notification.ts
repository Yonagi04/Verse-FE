import request from './request'
import type { NotificationListFilters, NotificationListResp, NotificationDetail, UnreadCountResp } from '@/types/notification'

// 获取通知列表（服务端筛选与分页）
export function listNotifications(pageNum: number, pageSize = 10, filters: NotificationListFilters = {}): Promise<NotificationListResp> {
  return request.get('/notifications', { params: { pageNum, pageSize, ...filters } })
}

// 获取通知详情（自动标记已读）
export function getNotificationDetail(notificationId: string): Promise<NotificationDetail> {
  return request.get(`/notifications/${notificationId}`)
}

// 获取未读通知数量
export function getUnreadCount(): Promise<UnreadCountResp> {
  return request.get('/notifications/unread-count')
}

// 全部标记为已读
export function markAllRead(): Promise<number> {
  return request.post('/notifications/read-all')
}
