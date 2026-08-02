/** 通知类型 */
export type NotificationType = 'SYSTEM' | 'ANNOUNCEMENT'

/** 通知严重程度 */
export type NotificationSeverity = 'INFO' | 'WARNING' | 'CRITICAL'

/** 通知列表项（GET /notifications records[]） */
export interface NotificationItem {
  notificationId: string
  title: string
  content: string
  type: NotificationType
  severity: NotificationSeverity
  isRead: boolean
  createTime: string
}

/** 通知列表分页响应 */
export interface NotificationListResp {
  total: number
  records: NotificationItem[]
}

/** 通知详情（GET /notifications/{id}） */
export interface NotificationDetail {
  notificationId: string
  title: string
  content: string
  type: NotificationType
  severity: NotificationSeverity
  senderId: string | null
  createTime: string
}

/** 未读数量响应 */
export interface UnreadCountResp {
  count: number
}
