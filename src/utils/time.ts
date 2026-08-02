/**
 * 将 ISO 8601 时间字符串转换为相对时间
 * 规则：<1分钟→"刚刚"、<60分钟→"N 分钟前"、<24小时→"N 小时前"、
 *       <48小时→"昨天"、<30天→"N 天前"、≥30天→显示完整日期
 */
export function relativeTime(iso: string): string {
  const now = Date.now()
  const dt = new Date(iso).getTime()
  const diffMs = now - dt
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHr = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHr / 24)
  const diffMonth = Math.floor(diffDay / 30)

  if (diffMin < 1) return '刚刚'
  if (diffMin < 60) return `${diffMin} 分钟前`
  if (diffHr < 24) return `${diffHr} 小时前`
  if (diffDay < 2) return '昨天'
  if (diffDay < 30) return `${diffDay} 天前`
  if (diffMonth < 3) return `${diffMonth} 个月前`

  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
