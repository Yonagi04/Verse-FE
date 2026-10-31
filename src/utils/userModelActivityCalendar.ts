import type { UserModelActivityDay, UserModelActivityCalendar } from '@/types/userModelActivityCalendar'

/** UTC仅作为纯日期运算载体，不读取浏览器本地时区。 */
export function parseModelActivityDate(date: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('活动日期格式无效')
  const [year, month, day] = date.split('-').map(Number) as [number, number, number]
  const value = Date.UTC(year, month - 1, day)
  if (new Date(value).toISOString().slice(0, 10) !== date) throw new Error('活动日期无效')
  return value
}
export function modelActivityLevel(count: string | null): number {
  if (count === null) return -1
  if (!/^\d+$/.test(count)) throw new Error('活动次数无效')
  const value = BigInt(count)
  return value === 0n ? 0 : value < 5n ? 1 : value < 10n ? 2 : value < 20n ? 3 : 4
}
export function buildModelActivityCells(calendar: UserModelActivityCalendar): (UserModelActivityDay | null)[] {
  const first = parseModelActivityDate(calendar.rangeStart), last = parseModelActivityDate(calendar.rangeEnd), today = parseModelActivityDate(calendar.today)
  const length = Math.round((last - first) / 86400000) + 1
  if (length < 365 || length > 366 || calendar.days.length !== length || calendar.timezone !== 'Asia/Shanghai') throw new Error('活动范围数据无效')
  const pad = (new Date(first).getUTCDay() + 6) % 7
  const result: (UserModelActivityDay | null)[] = Array.from({ length: pad }, () => null)
  calendar.days.forEach((day, index) => {
    const date = first + index * 86400000
    if (parseModelActivityDate(day.date) !== date || !['COMPLETE', 'PARTIAL', 'MISSING', 'FUTURE'].includes(day.state)
      || (day.state === 'FUTURE') !== (date > today)
      || (['MISSING', 'FUTURE'].includes(day.state) ? day.successCount !== null : day.successCount === null)) throw new Error('活动逐日数据无效')
    modelActivityLevel(day.successCount); result.push(day)
  })
  while (result.length % 7) result.push(null)
  return result
}
export function describeModelActivityDay(day: UserModelActivityDay) {
  return `${day.date}：${day.state === 'FUTURE' ? '未来日期' : day.state === 'MISSING' ? '暂无可用记录' : `${day.state === 'PARTIAL' ? '已记录' : ''}调用 ${day.successCount} 次`}`
}
