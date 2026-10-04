import Decimal from 'decimal.js'
import type { CostLimitConfig, CostLimitDraft, CostLimitPatch } from '@/types/costBudget'
const Money = Decimal.clone({ precision: 90, rounding: Decimal.ROUND_HALF_UP })
export const MAX_BUDGET_FEN = '99999999999999999999'
export const BUDGET_PERIOD_LABELS = { DAY: '日', WEEK: '周', MONTH: '月' } as const
export function emptyCostDraft(): CostLimitDraft { return { enabled: false, daily: '', weekly: '', monthly: '' } }

/** 输入最多两位小数；先验证再换算，不能先舍入。 */
export function budgetYuanToFenString(input: string): string | null {
  const value = input.trim()
  if (!value) return null
  if (!/^\d+(?:\.\d{1,2})?$/.test(value) || value.length > 24) throw new Error('限额请输入大于 0、最多两位小数的元金额')
  const fen = new Money(value).times(100)
  if (!fen.isInteger() || !fen.greaterThan(0) || fen.greaterThan(MAX_BUDGET_FEN)) throw new Error('成本限额需要大于0')
  return fen.toFixed(0)
}
export function budgetFenToYuanInput(fen: string | null): string {
  return fen == null ? '' : new Money(fen).dividedBy(100).toFixed(2)
}
export function formatBudgetYuan(fen: string | null): string {
  if (fen == null) return '--'
  const yuan = new Money(fen).dividedBy(100)
  if (yuan.greaterThan(0) && yuan.lessThan('0.01')) return '< ¥0.01'
  return `¥${yuan.toFixed(2)}`
}
export function costConfigToDraft(config: CostLimitConfig): CostLimitDraft {
  return { enabled: config.enabled, daily: budgetFenToYuanInput(config.dailyLimitFen),
    weekly: budgetFenToYuanInput(config.weeklyLimitFen), monthly: budgetFenToYuanInput(config.monthlyLimitFen) }
}
/** 使用原始分金额计算展示进度；进度不参与成本受限判定。 */
export function getBudgetUsage(usedFen: string | null, limitFen: string | null): { percent: number; label: string } | null {
  if (usedFen == null || limitFen == null) return null
  const limit = new Money(limitFen)
  if (!limit.greaterThan(0)) return null
  const ratio = new Money(usedFen).dividedBy(limit).times(100)
  const percent = ratio.clampedTo(0, 100).toNumber()
  if (ratio.greaterThan(100)) return { percent, label: '> 100%' }
  if (ratio.greaterThan(0) && ratio.lessThan('0.1')) return { percent, label: '< 0.1%' }
  // 向下取展示精度，避免将尚未达到限额的费用显示成 100%。
  return { percent, label: `${ratio.toDecimalPlaces(1, Decimal.ROUND_DOWN).toString()}%` }
}
/** 关闭时非法隐藏草稿恢复正式金额；合法草稿仍可保存。 */
export function buildCostLimitPatch(draft: CostLimitDraft, server?: CostLimitConfig | null): CostLimitPatch | undefined {
  const convert = (value: string, previous: string | null) => {
    try { return budgetYuanToFenString(value) } catch (error) { if (draft.enabled) throw error; return previous }
  }
  const patch = { enabled: draft.enabled, dailyLimitFen: convert(draft.daily, server?.dailyLimitFen ?? null),
    weeklyLimitFen: convert(draft.weekly, server?.weeklyLimitFen ?? null),
    monthlyLimitFen: convert(draft.monthly, server?.monthlyLimitFen ?? null) }
  if (patch.enabled && ![patch.dailyLimitFen, patch.weeklyLimitFen, patch.monthlyLimitFen].some(value => value !== null)) {
    throw new Error('开启成本限额时，日、周、月至少填写一项')
  }
  if (server && patch.enabled === server.enabled && patch.dailyLimitFen === server.dailyLimitFen
      && patch.weeklyLimitFen === server.weeklyLimitFen && patch.monthlyLimitFen === server.monthlyLimitFen) return undefined
  return server ? { ...patch, expectedVersion: server.version } : patch
}
