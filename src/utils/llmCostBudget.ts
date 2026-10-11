import Decimal from 'decimal.js'
import type { PricingRequest } from '@/types/llmService'
import type { CostLimitDraft } from '@/types/costBudget'
import type { LlmCostStatusBase, LlmCostWarningConfig, LlmCostWarningPatch, LlmCostWarningChannel } from '@/types/llmCostBudget'
export const COST_STATE_LABELS: Record<LlmCostStatusBase['budgetState'], string> = {
  DISABLED: '成本限额关闭', AVAILABLE: '限额生效中', LIMITED: '成本受限', UNKNOWN: '预算校验暂不可用',
}
export const COST_WARNING_CHANNEL_LABELS: Record<LlmCostWarningChannel, string> = {
  IN_APP: '站内系统公告', SMS: '短信', EMAIL: '邮件',
}
export const COST_STATE_DESCRIPTIONS: Record<LlmCostStatusBase['budgetState'], string> = {
  DISABLED: '当前不执行模型成本限制，仍统计本周期预估费用。模型调用仍受手工启停及其他调用约束影响。',
  AVAILABLE: '达到任一周期限额后，将停止此模型新的 API 和 PlayGround 调用。',
  LIMITED: '此模型新的 API 和 PlayGround 调用已受成本限制，已开始的调用可继续完成。',
  UNKNOWN: '当前无法可靠核对费用，暂不能确认已用费用和剩余额度，请刷新重试。',
}
const channels: LlmCostWarningChannel[] = ['IN_APP', 'SMS', 'EMAIL']
export function emptyWarning(): LlmCostWarningConfig { return { enabled: false, effective: false, thresholdPercent: 80, channels: [] } }
export function pricingEligible(price: PricingRequest): boolean {
  if (!price.enabled) return false
  const values = price.billingMode === 'REQUEST' ? [price.baseRequestPriceFen]
    : [price.baseTokenPrices?.cacheMissInputPriceFen, price.baseTokenPrices?.outputPriceFen]
  try { return values.every(value => value != null && new Decimal(value).isFinite() && new Decimal(value).gte(0)) } catch { return false }
}
export function buildWarningPatch(draft: LlmCostWarningConfig, limit: CostLimitDraft, priceValid: boolean, server?: LlmCostWarningConfig): LlmCostWarningPatch | undefined {
  if (!Number.isInteger(draft.thresholdPercent) || draft.thresholdPercent < 50 || draft.thresholdPercent > 99
    || draft.channels.some(value => !channels.includes(value))) throw new Error('预警阈值须为 50%～99% 的整数，渠道须有效')
  if (draft.enabled && (limit.enabled || !server?.enabled) && (!limit.enabled || !priceValid || !draft.channels.length)) {
    throw new Error('开启成本预警需要有效价格、成本限额和至少一个渠道')
  }
  const selected = channels.filter(value => draft.channels.includes(value))
  if (server && draft.enabled === server.enabled && draft.thresholdPercent === server.thresholdPercent
    && selected.join() === channels.filter(value => server.channels.includes(value)).join()) return undefined
  return { ...(draft.enabled && !limit.enabled && server?.enabled ? {} : { enabled: draft.enabled }), thresholdPercent: draft.thresholdPercent, channels: selected }
}
