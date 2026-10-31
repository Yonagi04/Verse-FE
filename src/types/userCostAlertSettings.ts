export type UserCostAlertChannel = 'IN_APP' | 'SMS' | 'EMAIL'
export interface UserCostAlertPeriodSettings {
  /** 本周期是否开启。 */ enabled: boolean
  /** 阈值整数分。 */ thresholdFen: string | null
}
export interface UserCostAlertSettings {
  /** 正式版本。 */ version: string
  /** 日设置。 */ daily: UserCostAlertPeriodSettings
  /** 周设置。 */ weekly: UserCostAlertPeriodSettings
  /** 本人共用渠道。 */ channels: UserCostAlertChannel[]
}
export interface ReplaceUserCostAlertSettings {
  /** 读取时的正式版本。 */ expectedVersion: string
  /** 完整日设置。 */ daily: UserCostAlertPeriodSettings
  /** 完整周设置。 */ weekly: UserCostAlertPeriodSettings
  /** 完整渠道集合。 */ channels: UserCostAlertChannel[]
}
export interface UserCostAlertChannelReadiness {
  /** 渠道。 */ channel: UserCostAlertChannel
  /** 是否具备配置条件。 */ available: boolean
  /** 不可用原因。 */ reasonCode: string | null
  /** 脱敏联系方式。 */ contactMasked: string | null
}
export interface UserCostAlertPeriodUsage {
  /** 周期维度。 */ period: 'DAY' | 'WEEK'
  /** 起点，含。 */ periodStart: string
  /** 终点，不含。 */ periodEnd: string
  /** 正式启用状态。 */ enabled: boolean
  /** 正式阈值分。 */ thresholdFen: string | null
  /** 原精度已知费用分。 */ knownCostFen: string | null
  /** 未知费用数。 */ unknownCostCount: string
  /** 费用是否完整。 */ costComplete: boolean
  /** 仅表示业务提醒事实。 */ alertState: 'DISABLED' | 'NOT_REACHED' | 'TRIGGERED' | 'UNKNOWN'
  /** 生成提醒时间。 */ triggeredAt: string | null
}
export interface UserCostAlertSettingsView {
  /** 正式配置。 */ config: UserCostAlertSettings
  /** 人民币。 */ currency: 'CNY'
  /** 固定北京时间。 */ timezone: 'Asia/Shanghai'
  /** 北京今天。 */ today: string
  /** 查询生成时刻。 */ asOf: string
  /** 读模型状态。 */ availability: 'READY' | 'INITIALIZING' | 'UNAVAILABLE'
  /** 最近投影时间。 */ updatedAt: string | null
  /** 最老待办年龄。 */ lagSeconds: number | null
  /** 日周状态。 */ periods: UserCostAlertPeriodUsage[]
  /** 本人准备度。 */ readiness: UserCostAlertChannelReadiness[]
}
