import { describe, it, expect } from 'vitest'
import { emptyWarning, buildWarningPatch, pricingEligible } from '../src/utils/llmCostBudget'
import { costFailureDescription, playgroundFailure } from '../src/utils/playgroundCostError'
const on = { enabled: true, daily: '10', weekly: '', monthly: '' }
describe('模型价格与预警契约', () => {
  it('零价格是有效定价，缺价和负价不可开启', () => {
    expect(pricingEligible({ enabled: true, billingMode: 'REQUEST', baseRequestPriceFen: 0 })).toBe(true)
    expect(pricingEligible({ enabled: false })).toBe(false)
    expect(pricingEligible({ enabled: true, billingMode: 'TOKEN', baseTokenPrices: { cacheMissInputPriceFen: 0, outputPriceFen: 0 } })).toBe(true)
    expect(pricingEligible({ enabled: true, billingMode: 'REQUEST', baseRequestPriceFen: -1 })).toBe(false)
  })
  it('共用阈值拒绝小数和 100%，开启时需要渠道', () => {
    for (const thresholdPercent of [49, 100, 80.5]) expect(() => buildWarningPatch({ ...emptyWarning(), thresholdPercent }, on, true)).toThrow()
    expect(() => buildWarningPatch({ ...emptyWarning(), enabled: true }, on, true)).toThrow()
    expect(buildWarningPatch({ ...emptyWarning(), enabled: true, channels: ['EMAIL','IN_APP','EMAIL'] }, on, true)?.channels).toEqual(['IN_APP','EMAIL'])
  })
  it('关闭预算保留预警草稿；不得把保留草稿当作显式重新开启', () => {
    const server = { ...emptyWarning(), enabled: true, channels: ['SMS'] as const }
    const saved = { ...server, channels: [...server.channels] }
    expect(buildWarningPatch(saved, { ...on, enabled: false }, false, saved)).toBeUndefined()
    expect(buildWarningPatch({ ...saved, thresholdPercent: 90 }, { ...on, enabled: false }, false, saved)).toEqual({ thresholdPercent: 90, channels: ['SMS'] })
    expect(() => buildWarningPatch({ ...saved }, { ...on, enabled: false }, false, emptyWarning())).toThrow()
  })
})
describe('Playground 成本拒绝', () => {
  it('fetch 错误保留业务码、HTTP 状态和脱敏详情', () => {
    const data = { scope: 'LLM', period: 'WEEK', retryAt: '2026-10-11T16:00:00Z', timezone: 'Asia/Shanghai', limits: [] }
    const error = playgroundFailure({ code: 'A000809', message: '达到限额', data }, 429)
    expect(error).toMatchObject({ code: 'A000809', httpStatus: 429, data })
    expect(costFailureDescription(error.code,error.data)).toContain('2026-10-12 00:00:00（GMT+8）')
    expect(costFailureDescription(error.code,error.data)).toContain('周')
  })
  it('未知详情不产生 NaN 恢复时刻，503 不假装是超限', () => {
    expect(costFailureDescription('A000809', { retryAt: 'bad' })).not.toContain('bad')
    expect(costFailureDescription('B000802')).toContain('暂不可用')
    expect(costFailureDescription('A001007')).toBeUndefined()
    expect(playgroundFailure(null,503).httpStatus).toBe(503)
  })
})
