import { expect, it } from 'vitest'
import { commentTime, commentLength } from '../src/utils/skillComment'
const now = Date.parse('2026-10-31T08:00:00Z')
it('严格按分钟、小时和中文年月日处理边界', () => {
  expect(commentTime('2026-10-31T07:59:01Z', now)).toBe('1分钟前')
  expect(commentTime('2026-10-31T07:01:00Z', now)).toBe('59分钟前')
  expect(commentTime('2026-10-31T07:00:00Z', now)).toBe('1小时前')
  expect(commentTime('2026-10-30T08:01:00Z', now)).toBe('23小时前')
  expect(commentTime('2026-10-30T08:00:00Z', now)).toBe('2026年10月30日')
  expect(commentTime('2026-10-31T09:00:00Z', now)).toBe('1分钟前')
  expect(commentTime('invalid', now)).toBe('--')
})
it('日期按配置时区，表情按Unicode码点计数', () => {
  expect(commentTime('2026-10-29T23:30:00Z', now, 'Asia/Shanghai')).toBe('2026年10月30日')
  expect(commentTime('2026-10-29T23:30:00Z', now, 'UTC')).toBe('2026年10月29日')
  expect(commentLength('😀中文')).toBe(3)
})
