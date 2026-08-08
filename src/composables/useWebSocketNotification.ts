import { ref } from 'vue'
import { Client, type IFrame, type IMessage } from '@stomp/stompjs'
import SockJS from 'sockjs-client'
import { getToken, clearAuth } from '@/utils/auth'
import { getUnreadCount } from '@/api/notification'
import type { NotificationItem } from '@/types/notification'

// ---------- 全局共享的响应式状态 ----------
export const newNotification = ref<NotificationItem | null>(null)
export const unreadCount = ref(0)

let stompClient: Client | null = null

export function useWebSocketNotification() {
  function connect() {
    const token = getToken()
    if (!token) {
      console.warn('[WS] connect called but no token available, skipping')
      return
    }

    // 避免重复连接：如果已有活跃 client 则直接复用
    if (stompClient?.active) {
      console.log('[WS] Client already active, skipping duplicate connect')
      return
    }

    // 如果存在旧的（已断开但未清理的）client，先清理掉
    if (stompClient) {
      stompClient.deactivate()
      stompClient = null
    }

    stompClient = new Client({
      webSocketFactory: () => new SockJS('/ws'),
      connectHeaders: {
        Authorization: `Bearer ${token}`,
      },
      reconnectDelay: 5000,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,

      // 开发环境启用 STOMP 调试日志
      debug: (str: string) => {
        if (import.meta.env.DEV) {
          console.log('[STOMP]', str)
        }
      },

      onConnect: () => {
        console.log('[WS] Connected to STOMP broker')

        try {
          // 订阅新通知推送
          stompClient!.subscribe('/user/queue/notifications', (msg: IMessage) => {
            try {
              const notification = JSON.parse(msg.body) as NotificationItem
              newNotification.value = notification
              // 本地递增未读数，确保红点实时响应
              unreadCount.value++
            } catch (e) {
              console.error('[WS] Failed to parse notification message:', e)
            }
          })

          // 订阅未读数推送（服务端权威值，用于修正本地递增）
          stompClient!.subscribe('/user/queue/notifications/unread-count', (msg: IMessage) => {
            try {
              const data = JSON.parse(msg.body) as { count: number }
              if (typeof data.count === 'number') {
                unreadCount.value = data.count
              }
            } catch (e) {
              console.error('[WS] Failed to parse unread-count message:', e)
            }
          })
        } catch (e) {
          console.error('[WS] Failed to set up subscriptions:', e)
        }

        // 订阅建立后主动拉取当前未读数，填补连接建立前错过的推送
        getUnreadCount().then(res => {
          unreadCount.value = res.count
        }).catch(() => {
          // handled by interceptor
        })
      },

      onStompError: (frame: IFrame) => {
        console.error('[WS] STOMP error:', frame.headers['message'])
        // 认证失败时停止重连，清除 auth 并跳转登录页
        stompClient?.deactivate()
        stompClient = null
        clearAuth()
        const path = window.location.pathname
        if (path !== '/login' && !path.startsWith('/join')) {
          window.location.href = '/login'
        }
      },

      onWebSocketClose: (evt: CloseEvent) => {
        console.log('[WS] WebSocket closed:', evt.code, evt.reason)
      },

      onWebSocketError: (evt: Event) => {
        console.error('[WS] WebSocket error:', evt)
      },
    })

    stompClient.activate()
  }

  function disconnect() {
    stompClient?.deactivate()
    stompClient = null
  }

  return { connect, disconnect }
}
