import { describe, expect, it } from 'vitest'
import { budgetYuanToFenString, budgetFenToYuanInput, formatBudgetYuan, getBudgetUsage, buildCostLimitPatch, costConfigToDraft } from '../src/utils/costBudget'
import { formatBudgetDateTime } from '../src/utils/date'
import type { CostLimitConfig } from '../src/types/costBudget'

const config: CostLimitConfig = { enabled: true, dailyLimitFen: '1000', weeklyLimitFen: '3000', monthlyLimitFen: null, version: '9007199254740993' }
describe('预算金额协议', () => {
  it('元精确换算为整数分，保留超出 Number 安全范围的限额', () => {
    expect(budgetYuanToFenString('10.01')).toBe('1001')
    expect(budgetFenToYuanInput('1001')).toBe('10.01')
    expect(budgetYuanToFenString('0.01')).toBe('1')
    expect(budgetYuanToFenString('999999999999999999.99')).toBe('99999999999999999999')
    expect(budgetFenToYuanInput('99999999999999999999')).toBe('999999999999999999.99')
  })
  it.each(['0', '-1', '0.001', '10.001', 'NaN', 'Infinity', '1e3', '1000000000000000000', '10.'])('拒绝 %s 而非先舍入', value => {
    expect(() => budgetYuanToFenString(value)).toThrow()
  })
  it('展示区分未知、免费零和真实不足一分钱，超大累计不丢精度', () => {
    expect(formatBudgetYuan(null)).toBe('--')
    expect(formatBudgetYuan('0')).toBe('¥0.00')
    expect(formatBudgetYuan('0.125')).toBe('< ¥0.01')
    expect(formatBudgetYuan('0.999999999999999999')).toBe('< ¥0.01')
    expect(formatBudgetYuan('1')).toBe('¥0.01')
    expect(formatBudgetYuan('1.5')).toBe('¥0.02')
    expect(formatBudgetYuan('12345678901234567890123456789012345678901234567.89'))
      .toBe('¥123456789012345678901234567890123456789012345.68')
  })
})
describe('成本展示进度', () => {
  it('未知金额和不限额没有进度，真实零费用为 0%', () => {
    expect(getBudgetUsage(null, '100')).toBeNull()
    expect(getBudgetUsage('10', null)).toBeNull()
    expect(getBudgetUsage('10', '0')).toBeNull()
    expect(getBudgetUsage('0', '100')).toEqual({ percent: 0, label: '0%' })
  })
  it('小额和临界金额不因舍入误显示为零或已用 100%', () => {
    expect(getBudgetUsage('0.00001', '100')?.label).toBe('< 0.1%')
    expect(getBudgetUsage('99.999999999999999999', '100')?.label).toBe('99.9%')
    expect(getBudgetUsage('100', '100')).toEqual({ percent: 100, label: '100%' })
  })
  it('超额进度封顶并保留超额提示，大金额用原始分精确计算', () => {
    expect(getBudgetUsage('101', '100')).toEqual({ percent: 100, label: '> 100%' })
    expect(getBudgetUsage('50000000000000000000', '99999999999999999999')?.label).toBe('50%')
  })
})
describe('成本 PATCH', () => {
  it('仅表达变化不提交配置，版本保留字符串', () => {
    const draft = costConfigToDraft(config)
    draft.daily = '10'
    expect(buildCostLimitPatch(draft, config)).toBeUndefined()
    draft.daily = '10.01'
    expect(buildCostLimitPatch(draft, config)).toEqual({ enabled: true, dailyLimitFen: '1001', weeklyLimitFen: '3000', monthlyLimitFen: null, expectedVersion: '9007199254740993' })
  })
  it('显式清空、关闭保留、重新开启不清空合法草稿', () => {
    const draft = costConfigToDraft(config)
    draft.daily = ''
    expect(buildCostLimitPatch(draft, config)?.dailyLimitFen).toBeNull()
    draft.enabled = false
    draft.weekly = 'bad'
    expect(buildCostLimitPatch(draft, config)?.weeklyLimitFen).toBe('3000')
    draft.enabled = true
    expect(() => buildCostLimitPatch(draft, config)).toThrow()
  })
  it('开启至少一项，不限制日周月的金额大小关系', () => {
    expect(() => buildCostLimitPatch({ enabled: true, daily: '', weekly: '', monthly: '' })).toThrow()
    expect(buildCostLimitPatch({ enabled: true, daily: '30', weekly: '10', monthly: '' })?.weeklyLimitFen).toBe('1000')
  })
})
it('预算日期固定北京时间，即使输入为其他时区', () => {
  expect(formatBudgetDateTime('2026-10-04T09:00:00-07:00')).toBe('2026-10-05 00:00:00（GMT+8）')
  expect(formatBudgetDateTime('bad')).toBe('--')
})
