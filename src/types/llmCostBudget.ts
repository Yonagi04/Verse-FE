import type { CostBudgetHit, CostBudgetPeriodStatus, CostLimitConfig } from './costBudget'
export type LlmCostWarningChannel = 'IN_APP' | 'SMS' | 'EMAIL'
export interface LlmCostWarningPatch {
  /** 预警开关。 */ enabled?: boolean
  /** 共用整数阈值。 */ thresholdPercent?: number
  /** 选定渠道。 */ channels?: LlmCostWarningChannel[]
}
export interface LlmCostWarningConfig {
  /** 草稿开关。 */ enabled: boolean
  /** 当前是否执行预警。 */ effective: boolean
  /** 共用整数阈值。 */ thresholdPercent: number
  /** 阈值渠道。 */ channels: LlmCostWarningChannel[]
}
export interface LlmCostStatusBase {
  /** 模型服务标识。 */ serviceId: string
  /** 固定时区。 */ timezone: 'Asia/Shanghai'
  /** 查询时间。 */ asOf: string
  /** 正式预算状态。 */ budgetState: 'DISABLED' | 'AVAILABLE' | 'LIMITED' | 'UNKNOWN'
  /** 最晚预计恢复。 */ retryAt: string | null
  /** 全部模型命中。 */ limits: CostBudgetHit[]
}
export interface LlmCostStatusFull extends LlmCostStatusBase {
  /** 管理员视图。 */ visibility: 'FULL'
  /** 正式预算。 */ costLimit: CostLimitConfig
  /** 正式预警。 */ costWarning: LlmCostWarningConfig
  /** 有效价格资格。 */ pricingEligible: boolean
  /** 币种。 */ currency: 'CNY'
  /** 费用来源。 */ consumptionSources: ['API_KEY', 'PLAYGROUND']
  /** 费用完整性。 */ availability: 'READY' | 'INITIALIZING' | 'UNAVAILABLE'
  /** 三个周期。 */ periods: CostBudgetPeriodStatus[]
}
export interface LlmCostStatusSummary extends LlmCostStatusBase {
  /** 成员视图。 */ visibility: 'SUMMARY'
  /** 脱敏原因。 */ message: string | null
}
export type LlmCostStatus = LlmCostStatusFull | LlmCostStatusSummary
export interface CostNotificationReadiness {
  /** 平台配置状态。 */ channels: Array<{ channel: 'SMS' | 'EMAIL'; configured: boolean; reasonCode: string | null }>
  /** 管理员缺口，不含地址。 */ administrators: { total: number; missingPhoneCount: number; missingEmailCount: number }
  /** 查询时间。 */ asOf: string
}
