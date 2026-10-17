import type { CostLimitConfig, CostLimitDraft, CostWarningConfig, CostWarningPatch } from '@/types/costBudget'
import { budgetYuanToFenString } from './costBudget'
export const defaultWarning = (): CostWarningConfig => ({ enabled: false, effective: false, thresholdPercent: 80, channels: [] })
export function tenantLimitTarget(draft: CostLimitDraft) {
  const target = { enabled: draft.enabled, dailyLimitFen: budgetYuanToFenString(draft.daily), weeklyLimitFen: budgetYuanToFenString(draft.weekly), monthlyLimitFen: budgetYuanToFenString(draft.monthly) }
  if (target.enabled && ![target.dailyLimitFen, target.weeklyLimitFen, target.monthlyLimitFen].some(v => v !== null)) throw new Error('开启成本限额时，日、周、月至少填写一项')
  return target
}
export function tenantWarningTarget(warning: CostWarningConfig, enabled: boolean): CostWarningPatch {
  if (!Number.isInteger(warning.thresholdPercent) || warning.thresholdPercent < 50 || warning.thresholdPercent > 99) throw new Error('预警阈值须为 50～99 的整数')
  const channels = (['IN_APP', 'SMS', 'EMAIL'] as const).filter(c => warning.channels.includes(c))
  if (warning.channels.some(c => !['IN_APP', 'SMS', 'EMAIL'].includes(c))) throw new Error('预警渠道无效')
  if (enabled && warning.enabled && !channels.length) throw new Error('开启预警时至少选择一个渠道')
  return { enabled: warning.enabled, thresholdPercent: warning.thresholdPercent, channels }
}
export function limitBusiness(config: CostLimitConfig) { return { enabled: config.enabled, dailyLimitFen: config.dailyLimitFen, weeklyLimitFen: config.weeklyLimitFen, monthlyLimitFen: config.monthlyLimitFen } }
export function warningBusiness(config: CostWarningConfig) { return tenantWarningTarget(config, false) }
