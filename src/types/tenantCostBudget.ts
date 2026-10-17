import type { TenantSettingsRespDTO, TenantSettingsUpdateReqDTO } from './tenant'
import type { CostLimitConfig, CostLimitPatch, CostWarningConfig, CostWarningPatch, CostBudgetHit, CostBudgetPeriodStatus } from './costBudget'
export interface TenantCostSummary {
  /** 租户标识。 */ tenantId: string
  /** 可见范围。 */ visibility: 'SUMMARY'
  /** 当前状态。 */ budgetState: 'DISABLED' | 'AVAILABLE' | 'LIMITED' | 'UNKNOWN'
  /** 最晚恢复。 */ retryAt: string | null
  /** 时区。 */ timezone: 'Asia/Shanghai'
  /** 查询时刻。 */ asOf: string
  /** 当前命中。 */ limits: CostBudgetHit[]
  /** 脱敏说明。 */ message: string | null
}
export interface TenantCostFull extends Omit<TenantCostSummary, 'visibility' | 'message'> {
  /** 可见范围。 */ visibility: 'FULL'
  /** 共同观察版本。 */ observedSettingsVersion: string
  /** 正式限额。 */ costLimit: CostLimitConfig
  /** 正式预警。 */ costWarning: CostWarningConfig
  /** 币种。 */ currency: 'CNY'
  /** 统计来源。 */ consumptionSources: string[]
  /** 费用完整性。 */ availability: 'READY' | 'INITIALIZING' | 'UNAVAILABLE'
  /** 三周期状态。 */ periods: CostBudgetPeriodStatus[]
}
export type TenantCostStatus = TenantCostFull | TenantCostSummary
export interface TenantSettingsSnapshot {
  /** 基础设置。 */ settings: TenantSettingsRespDTO
  /** 限额。 */ costLimit: CostLimitConfig
  /** 预警。 */ costWarning: CostWarningConfig
}
export interface TenantSettingsSaveRequest extends TenantSettingsUpdateReqDTO {
  /** 设置预期版本。 */ settingsVersion: string
  /** 成本补丁。 */ costLimit?: CostLimitPatch
  /** 预警补丁。 */ costWarning?: CostWarningPatch
  /** 仅内存保存的确认凭证。 */ confirmationToken?: string
}
export interface TenantSettingsConfirmation {
  /** 等待确认。 */ status: 'CONFIRMATION_REQUIRED'
  /** 确认标记。 */ requiresConfirmation: true
  /** 风险提示。 */ warningMessage: string
  /** 内容绑定凭证。 */ confirmationToken: string
  /** 到期时间。 */ confirmationExpiresAt: string
  /** 最新设置版本。 */ expectedSettingsVersion: string
  /** 最新成本版本。 */ expectedCostConfigVersion: string
  /** 立即命中。 */ immediateLimits: CostBudgetHit[]
  /** 并发对照。 */ currentSnapshot?: TenantSettingsSnapshot | null
}
export type TenantSettingsSaveOutcome = TenantSettingsConfirmation | {
  /** 已保存。 */ status: 'SAVED'
  /** 确认标记。 */ requiresConfirmation: false
  /** 同事务正式回执。 */ savedSnapshot: TenantSettingsSnapshot
}
