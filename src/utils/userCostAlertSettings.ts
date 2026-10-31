import type { UserCostAlertSettings, UserCostAlertChannel, ReplaceUserCostAlertSettings } from '@/types/userCostAlertSettings'
import { budgetFenToYuanInput, budgetYuanToFenString } from './costBudget'

export interface UserCostAlertDraft { daily: { enabled: boolean; yuan: string }; weekly: { enabled: boolean; yuan: string }; channels: UserCostAlertChannel[] }
/** 费用周期结束不含；展示北京时间实际包含的日期。 */
export function formatUserCostAlertPeriod(start: string, end: string): string {
  const from = Date.parse(start), until = Date.parse(end)
  if (!Number.isFinite(from) || !Number.isFinite(until) || until <= from) return '--'
  const format = new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', month: 'long', day: 'numeric' })
  const first = format.format(from), last = format.format(until - 1)
  return first === last ? first : `${first} — ${last}`
}
export function toUserCostAlertDraft(config: UserCostAlertSettings): UserCostAlertDraft {
  return { daily: { enabled: config.daily.enabled, yuan: budgetFenToYuanInput(config.daily.thresholdFen) },
    weekly: { enabled: config.weekly.enabled, yuan: budgetFenToYuanInput(config.weekly.thresholdFen) }, channels: [...config.channels] }
}
function parseUserCostAlertAmount(period: UserCostAlertDraft['daily']) {
  let thresholdFen: string | null
  try { thresholdFen = budgetYuanToFenString(period.yuan) } catch { throw new Error('预警金额须大于0、最多两位小数，且不超过999999999999999999.99元；关闭时请清空或修正非法金额') }
  if (period.enabled && thresholdFen === null) throw new Error('开启预警时请填写金额')
  return thresholdFen
}
export function userCostAlertAmountError(period: UserCostAlertDraft['daily']): string {
  try { parseUserCostAlertAmount(period); return '' } catch (error) { return (error as Error).message }
}
export function buildUserCostAlertReplacement(draft: UserCostAlertDraft, version: string): ReplaceUserCostAlertSettings {
  const convert = (period: UserCostAlertDraft['daily']) => {
    return { enabled: period.enabled, thresholdFen: parseUserCostAlertAmount(period) }
  }
  if ((draft.daily.enabled || draft.weekly.enabled) && !draft.channels.length) throw new Error('请至少选择一个有效通知渠道')
  return { expectedVersion: version, daily: convert(draft.daily), weekly: convert(draft.weekly), channels: [...new Set(draft.channels)].sort() }
}
export function isSameUserCostAlertSettings(a: ReplaceUserCostAlertSettings, b: UserCostAlertSettings) {
  return a.daily.enabled === b.daily.enabled && a.daily.thresholdFen === b.daily.thresholdFen
    && a.weekly.enabled === b.weekly.enabled && a.weekly.thresholdFen === b.weekly.thresholdFen
    && [...a.channels].sort().join(',') === [...b.channels].sort().join(',')
}
export function isUserCostAlertDraftDirty(draft: UserCostAlertDraft, baseline: UserCostAlertSettings) {
  try { return !isSameUserCostAlertSettings(buildUserCostAlertReplacement(draft, baseline.version), baseline) } catch { return true }
}

