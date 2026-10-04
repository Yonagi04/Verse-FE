/** 配置补丁；省略保持，null 清空。 */
export interface CostLimitPatch {
  /** 成本开关。 */
  enabled?: boolean
  /** 日限额，整数分。 */
  dailyLimitFen?: string | null
  /** 周限额，整数分。 */
  weeklyLimitFen?: string | null
  /** 月限额，整数分。 */
  monthlyLimitFen?: string | null
  /** 预期版本。 */
  expectedVersion?: string
}
export interface CostLimitConfig {
  /** 正式开关。 */
  enabled: boolean
  /** 日限额，分。 */
  dailyLimitFen: string | null
  /** 周限额，分。 */
  weeklyLimitFen: string | null
  /** 月限额，分。 */
  monthlyLimitFen: string | null
  /** 正式配置版本。 */
  version: string
}
export type BudgetPeriod = 'DAY' | 'WEEK' | 'MONTH'
export interface CostBudgetPeriodStatus {
  /** 周期。 */
  period: BudgetPeriod
  /** 左边界，含。 */
  periodStart: string
  /** 右边界，不含。 */
  periodEnd: string
  /** 限额，分。 */
  limitFen: string | null
  /** 已用，分；null 未知。 */
  usedCostFen: string | null
  /** 剩余，分。 */
  remainingCostFen: string | null
  /** 是否达到所填金额。 */
  exceeded: boolean | null
  /** 是否实际生效限制。 */
  effective: boolean
  /** 已计算数量。 */
  calculatedCount: string | null
  /** 未计价数量。 */
  unpricedCount: string | null
  /** 不可计算数量。 */
  uncalculableCount: string | null
  /** 不计费数量。 */
  notChargeableCount: string | null
}
export interface CostBudgetHit {
  /** 预算作用域。 */
  scope: 'API_KEY' | 'LLM' | 'TENANT'
  /** 周期。 */
  period: BudgetPeriod
  /** 自然恢复时间。 */
  periodEnd: string
}
export interface ApiKeyCostStatusRespDTO {
  /** Key 标识。 */
  apiKeyId: string
  /** 正式配置。 */
  costLimit: CostLimitConfig
  /** 币种。 */
  currency: 'CNY'
  /** 固定周期时区。 */
  timezone: 'Asia/Shanghai'
  /** 查询时刻。 */
  asOf: string
  /** 数据完整性。 */
  availability: 'READY' | 'INITIALIZING' | 'UNAVAILABLE'
  /** 成本状态。 */
  budgetState: 'DISABLED' | 'AVAILABLE' | 'LIMITED' | 'UNKNOWN'
  /** 最晚预计恢复时间。 */
  retryAt: string | null
  /** 三周期明细。 */
  periods: CostBudgetPeriodStatus[]
  /** 所有命中。 */
  limits: CostBudgetHit[]
}
export interface CostLimitDraft {
  /** 草稿开关。 */
  enabled: boolean
  /** 日限额，元输入。 */
  daily: string
  /** 周限额，元输入。 */
  weekly: string
  /** 月限额，元输入。 */
  monthly: string
}
