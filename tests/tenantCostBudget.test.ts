import { expect, it } from 'vitest'
import { tenantLimitTarget, tenantWarningTarget } from '../src/utils/tenantCostBudget'
import { costFailureDescription, normalizePlaygroundFailure } from '../src/utils/playgroundCostError'
it('租户不需要模型价格，金额精确且周期独立；非法输入不能静默转零', () => {
  expect(tenantLimitTarget({ enabled: true, daily: '10.00', weekly: '1', monthly: '' })).toEqual({ enabled: true, dailyLimitFen: '1000', weeklyLimitFen: '100', monthlyLimitFen: null })
  for (const daily of ['0','-1','1.001','1e3','1000000000000000000']) expect(() => tenantLimitTarget({ enabled: true, daily, weekly: '', monthly: '' })).toThrow()
  expect(() => tenantLimitTarget({ enabled: true, daily: '', weekly: '', monthly: '' })).toThrow()
})
it('预警阈值和渠道集合规范，关闭保留草稿', () => {
  for (const thresholdPercent of [50,80,99]) expect(tenantWarningTarget({ enabled: true, effective: false, thresholdPercent, channels: ['EMAIL','IN_APP'] },true).channels).toEqual(['IN_APP','EMAIL'])
  for (const thresholdPercent of [49,100,80.5]) expect(() => tenantWarningTarget({ enabled: true,effective:false,thresholdPercent,channels:['EMAIL'] },true)).toThrow()
  expect(() => tenantWarningTarget({ enabled:true,effective:false,thresholdPercent:80,channels:[] },true)).toThrow()
  expect(tenantWarningTarget({ enabled:true,effective:false,thresholdPercent:80,channels:[] },false).enabled).toBe(true)
})
it('HTTP/SSE/Axios 的租户作用域不会误写为模型；503没有自然恢复承诺', () => {
  const e = normalizePlaygroundFailure({ response: { status:429, data: { code:'A000809',message:'租户限制',requestId:'r',data:{scope:'TENANT',period:'WEEK',retryAt:'2026-10-05T00:00:00+08:00'} } } })
  expect(e.requestId).toBe('r'); expect(e.httpStatus).toBe(429); expect(costFailureDescription(e.code,e.data)).toContain('此租户本周')
  expect(costFailureDescription('B000802',{retryAt:'2026-10-05'})).not.toContain('预计'); expect(costFailureDescription('other')).toBeUndefined()
})
