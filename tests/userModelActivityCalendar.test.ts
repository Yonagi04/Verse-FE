import { describe, expect, it } from 'vitest'
import { describeModelActivityDay, modelActivityLevel, buildModelActivityCells, parseModelActivityDate } from '../src/utils/userModelActivityCalendar'
import type { UserModelActivityCalendar } from '../src/types/userModelActivityCalendar'

function calendar(year: number, today = '2026-10-18'): UserModelActivityCalendar {
  const from = `${year}-01-01`, end = `${year}-12-31`, days: UserModelActivityCalendar['days'] = []
  for (let day = parseModelActivityDate(from); day <= parseModelActivityDate(end); day += 86400000) {
    const date = new Date(day).toISOString().slice(0, 10), future = date > today
    days.push({ date, successCount: future ? null : '0', state: future ? 'FUTURE' : 'COMPLETE' })
  }
  return { view: 'YEAR', year, timezone: 'Asia/Shanghai', today, rangeStart: from, rangeEnd: end, days, totalSuccessCount: '0',
    availability: 'READY', asOf: '2026-10-18T12:00:00+08:00', updatedAt: null, lagSeconds: 0, historyComplete: true, coverage: [] }
}
describe('北京时间活动日历', () => {
  it('自然年闰日、周一起始布局和范围外补齐', () => {
    const leap = calendar(2024), normal = calendar(2025)
    const cells = buildModelActivityCells(leap)
    expect(cells.filter(Boolean)).toHaveLength(366)
    expect(cells.find(day => day?.date === '2024-02-29')).toMatchObject({ successCount: '0' })
    expect(cells[0]?.date).toBe('2024-01-01')
    expect(buildModelActivityCells(normal).slice(0, 2)).toEqual([null, null])
    expect(cells.length % 7).toBe(0)
  })
  it('最近365天包含今天且跨闰年不扩为366天', () => {
    const data = calendar(2026); data.view = 'ROLLING_365'; data.year = null; data.rangeStart = '2025-10-19'; data.rangeEnd = '2026-10-18'
    data.days = Array.from({ length: 365 }, (_, index) => ({ date: new Date(parseModelActivityDate(data.rangeStart) + index * 86400000).toISOString().slice(0, 10), state: 'COMPLETE', successCount: '0' }))
    expect(buildModelActivityCells(data).filter(Boolean)).toHaveLength(365)
    expect(data.days[364]?.date).toBe(data.today)
  })
  it('未来、缺失和已知零独立；异常范围和伪零未来被拒绝', () => {
    const data = calendar(2026); const future = data.days.find(day => day.date === '2026-10-19')!
    expect(describeModelActivityDay(future)).toContain('未来')
    expect(describeModelActivityDay({ date: '2026-01-01', successCount: null, state: 'MISSING' })).toBe('2026-01-01：暂无可用记录')
    expect(describeModelActivityDay(data.days[0]!)).toContain('0 次')
    future.successCount = '0'; expect(() => buildModelActivityCells(data)).toThrow()
    expect(() => parseModelActivityDate('2025-02-29')).toThrow()
    expect(() => parseModelActivityDate('2026-2-03')).toThrow()
  })
  it('部分日期直接展示已记录次数，不把未知伪装为零或显示内部质量术语', () => {
    const day = { date: '2026-10-18', successCount: '9007199254740993', state: 'PARTIAL' as const }
    expect(describeModelActivityDay(day)).toBe('2026-10-18：已记录调用 9007199254740993 次')
    expect(describeModelActivityDay({ ...day, state: 'MISSING', successCount: null })).not.toContain('0 次')
    expect(day.successCount).toBe('9007199254740993')
  })
  it.each([['0', 0], ['1', 1], ['4', 1], ['5', 2], ['9', 2], ['10', 3], ['19', 3], ['20', 4], ['999999999999999999999999', 4], [null, -1]])('固定色阶 %s', (count, level) => {
    expect(modelActivityLevel(count)).toBe(level)
  })
})
