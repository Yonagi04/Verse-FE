/** 评论时间遵循详情区规则，不改变其他页面的相对时间格式。 */
export function commentTime(iso: string, now = Date.now(), timezone = 'Asia/Shanghai'): string {
  const date = new Date(iso)
  if (!Number.isFinite(date.getTime())) return '--'
  const minutes = Math.max(1, Math.floor((now - date.getTime()) / 60000))
  if (minutes < 60) return `${minutes}分钟前`
  if (minutes < 1440) return `${Math.floor(minutes / 60)}小时前`
  const parts = new Intl.DateTimeFormat('zh-CN', { timeZone: timezone, year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(date)
  const part = (type: string) => parts.find(item => item.type === type)?.value ?? ''
  return `${part('year')}年${part('month')}月${part('day')}日`
}
export const commentLength = (text: string) => Array.from(text).length
