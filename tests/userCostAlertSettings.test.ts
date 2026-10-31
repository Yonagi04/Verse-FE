import { describe, expect, it } from 'vitest'
import { isUserCostAlertDraftDirty, toUserCostAlertDraft, buildUserCostAlertReplacement, formatUserCostAlertPeriod, userCostAlertAmountError } from '../src/utils/userCostAlertSettings'
import type { UserCostAlertSettings } from '../src/types/userCostAlertSettings'

const config: UserCostAlertSettings = { version: '9007199254740993', daily: { enabled: true, thresholdFen: '1000' }, weekly: { enabled: false, thresholdFen: null }, channels: ['EMAIL'] }

describe('费用周期展示', () => {
  it('日周期与结束不含的跨年周周期使用北京时间包含的日期', () => {
    expect(formatUserCostAlertPeriod('2026-10-18T00:00:00+08:00', '2026-10-19T00:00:00+08:00')).toBe('10月18日')
    expect(formatUserCostAlertPeriod('2026-12-28T00:00:00+08:00', '2027-01-04T00:00:00+08:00')).toBe('12月28日 — 1月3日')
    expect(formatUserCostAlertPeriod('2024-02-28T16:00:00Z', '2024-02-29T16:00:00Z')).toBe('2月29日')
  })
  it('非法或倒置日期不显示伪造周期', () => {
    expect(formatUserCostAlertPeriod('invalid', '2026-10-19T00:00:00+08:00')).toBe('--')
    expect(formatUserCostAlertPeriod('2026-10-19T00:00:00+08:00', '2026-10-18T00:00:00+08:00')).toBe('--')
  })
})
describe('个人费用预警草稿', () => {
  it('开启但空白时立即提示，填写有效金额或关闭后清除必填错误', () => {
    const period = { enabled: false, yuan: '' }
    expect(userCostAlertAmountError(period)).toBe('')
    period.enabled = true
    expect(userCostAlertAmountError(period)).toBe('开启预警时请填写金额')
    period.yuan = '  '
    expect(userCostAlertAmountError(period)).toBe('开启预警时请填写金额')
    period.yuan = '0.01'
    expect(userCostAlertAmountError(period)).toBe('')
    period.yuan = ''; period.enabled = false
    expect(userCostAlertAmountError(period)).toBe('')
  })
  it('就地校验与提交使用相同精确金额规则，不因关闭而掩盖非法草稿', () => {
    const draft = toUserCostAlertDraft(config)
    draft.daily.yuan = '0.001'
    expect(userCostAlertAmountError(draft.daily)).toContain('最多两位小数')
    expect(() => buildUserCostAlertReplacement(draft, config.version)).toThrow(userCostAlertAmountError(draft.daily))
    draft.daily.enabled = false
    expect(userCostAlertAmountError(draft.daily)).not.toBe('')
    draft.daily.yuan = '999999999999999999.99'
    expect(userCostAlertAmountError(draft.daily)).toBe('')
    expect(buildUserCostAlertReplacement(draft, config.version).daily.thresholdFen).toBe('99999999999999999999')
  })
  it('金额和版本超出安全整数仍精确，等价输入不制造未保存状态', () => {
    const draft = toUserCostAlertDraft(config); draft.daily.yuan = '10'
    expect(isUserCostAlertDraftDirty(draft, config)).toBe(false)
    expect(buildUserCostAlertReplacement(draft, config.version).expectedVersion).toBe(config.version)
    draft.weekly.yuan = '999999999999999999.99'
    expect(buildUserCostAlertReplacement(draft, config.version).weekly.thresholdFen).toBe('99999999999999999999')
    expect(isUserCostAlertDraftDirty(draft, config)).toBe(true)
    expect(config.weekly.thresholdFen).toBeNull()
  })
  it.each(['0', '-1', '0.001', '1e3', '10.', '1000000000000000000'])('拒绝非法金额 %s，关闭时也不丢弃隐藏输入', value => {
    const draft = toUserCostAlertDraft(config); draft.weekly.yuan = value
    expect(() => buildUserCostAlertReplacement(draft, '1')).toThrow('预警金额')
    expect(draft.weekly.yuan).toBe(value)
  })
  it('日周独立、任一开启需渠道，全部关闭可为空且不追加站内信', () => {
    const draft = toUserCostAlertDraft(config); draft.daily.enabled = false; draft.weekly.enabled = true; draft.weekly.yuan = '0.01'; draft.channels = []
    expect(() => buildUserCostAlertReplacement(draft, '1')).toThrow('通知渠道')
    draft.weekly.enabled = false
    expect(buildUserCostAlertReplacement(draft, '1').channels).toEqual([])
    draft.channels = ['EMAIL']; expect(buildUserCostAlertReplacement(draft, '1').channels).toEqual(['EMAIL'])
  })
})
