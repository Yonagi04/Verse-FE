import type { PeakPeriod } from '@/types/llmService'

export interface ValidationResult { valid: boolean; message?: string; conflictingIndexes?: number[] }

export function validateTokenLimits(contextWindow?: number | null, maxOutputTokens?: number | null): ValidationResult {
  for (const [label, value] of [['上下文长度', contextWindow], ['最大输出 Token', maxOutputTokens]] as const) {
    if (value != null && (!Number.isInteger(value) || value <= 0)) return { valid: false, message: `${label}必须是正整数` }
  }
  if (contextWindow != null && maxOutputTokens != null && maxOutputTokens > contextWindow) {
    return { valid: false, message: '最大输出 Token 不能超过上下文长度' }
  }
  return { valid: true }
}

function minutes(time: string): number | null {
  const match = /^(?:[01]\d|2[0-3]):[0-5]\d$/.exec(time)
  if (!match) return null
  const [hours, mins] = time.split(':').map(Number)
  return hours * 60 + mins
}

export function validatePeakPeriods(periods: PeakPeriod[]): ValidationResult {
  const intervals: Array<{ index: number; weekday: number; start: number; end: number }> = []
  for (const [index, period] of periods.entries()) {
    const start = minutes(period.startTime); const end = minutes(period.endTime)
    if (start == null || end == null || end <= start) return { valid: false, message: `第 ${index + 1} 条高峰时段必须在同一天内且结束晚于开始`, conflictingIndexes: [index] }
    if (!period.weekdays.length || period.weekdays.some((day) => !Number.isInteger(day) || day < 1 || day > 7)) {
      return { valid: false, message: `第 ${index + 1} 条高峰时段的星期无效`, conflictingIndexes: [index] }
    }
    period.weekdays.forEach((weekday) => intervals.push({ index, weekday, start, end }))
  }
  for (let index = 0; index < intervals.length; index += 1) {
    for (let other = index + 1; other < intervals.length; other += 1) {
      const a = intervals[index]; const b = intervals[other]
      if (a.weekday === b.weekday && a.start < b.end && b.start < a.end) return { valid: false, message: '高峰时段不能重叠', conflictingIndexes: [a.index, b.index] }
    }
  }
  return { valid: true }
}
