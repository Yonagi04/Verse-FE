export type ModelActivityDayState = 'COMPLETE' | 'PARTIAL' | 'MISSING' | 'FUTURE'
export interface UserModelActivityDay {
  /** 北京日期。 */ date: string
  /** 已知成功次数；未知/未来为空。 */ successCount: string | null
  /** 事实质量。 */ state: ModelActivityDayState
}
export interface UserModelActivityCalendar {
  /** 范围模式。 */ view: 'ROLLING_365' | 'YEAR'
  /** 自然年年份。 */ year: number | null
  /** 固定北京时间。 */ timezone: 'Asia/Shanghai'
  /** 北京今天。 */ today: string
  /** 起点日期，含。 */ rangeStart: string
  /** 终点日期，含。 */ rangeEnd: string
  /** 已知成功总次数。 */ totalSuccessCount: string
  /** 读模型状态。 */ availability: 'READY' | 'INITIALIZING' | 'UNAVAILABLE'
  /** 查询生成时间。 */ asOf: string
  /** 最近投影时间。 */ updatedAt: string | null
  /** 待办年龄。 */ lagSeconds: number | null
  /** 过去历史是否完整。 */ historyComplete: boolean
  /** 质量区间。 */ coverage: {
    /** 开始，含。 */ from: string
    /** 结束，含。 */ to: string
    /** 区间状态。 */ state: ModelActivityDayState
    /** 原因。 */ reasonCode: string | null
  }[]
  /** 连续逐日事实。 */ days: UserModelActivityDay[]
}
