import { beforeEach, expect, it, vi } from 'vitest'
import { useTenantSettingsSave } from '../src/composables/useTenantSettingsSave'
import type { TenantSettingsSaveRequest, TenantSettingsSnapshot } from '../src/types/tenantCostBudget'
const mocks = vi.hoisted(() => ({ save: vi.fn() }))
vi.mock('@/api/tenant', () => ({ saveTenantSettings: mocks.save }))
const initial = { settingsVersion: '3', name: 'team', description: null, joinApprovalMode: 0, auditEnabled: false, activityRecordingEnabled: false, playgroundEnabled: true, rateLimitRpm: null, rateLimitTpm: null, costLimit: { enabled: true, dailyLimitFen: '100', expectedVersion: '4' } } satisfies TenantSettingsSaveRequest
const target = { ...initial, costLimit: { ...initial.costLimit, weeklyLimitFen: null, monthlyLimitFen: null }, costWarning: { enabled: false, thresholdPercent: 80, channels: [] } } satisfies TenantSettingsSaveRequest
const preview = { status: 'CONFIRMATION_REQUIRED', requiresConfirmation: true, warningMessage: '确认整份设置', confirmationToken: 'proof', confirmationExpiresAt: '2026-10-17T15:05:00+08:00', expectedSettingsVersion: '3', expectedCostConfigVersion: '4', immediateLimits: [] }
const snapshot = { settings: { settingsVersion: '4' }, costLimit: { version: '5' }, costWarning: { enabled: false } } as TenantSettingsSnapshot
beforeEach(() => vi.resetAllMocks())
it('待确认无成功副作用，第一次确认就提交冻结完整目标；新预览不自动提交', async () => {
  mocks.save.mockResolvedValueOnce(preview).mockResolvedValueOnce({ ...preview, confirmationToken: 'new', expectedCostConfigVersion: '6' }).mockResolvedValueOnce({ status: 'SAVED', requiresConfirmation: false, savedSnapshot: snapshot })
  const saved = vi.fn(), save = useTenantSettingsSave(saved, vi.fn())
  await save.start('2', initial, target); expect(saved).not.toHaveBeenCalled(); expect(mocks.save).toHaveBeenCalledTimes(1)
  await save.confirm(); expect(mocks.save.mock.calls[1]?.[1]).toMatchObject({ costWarning: { enabled: false, channels: [] }, costLimit: { weeklyLimitFen: null, monthlyLimitFen: null }, confirmationToken: 'proof' })
  expect(mocks.save).toHaveBeenCalledTimes(2); expect(saved).not.toHaveBeenCalled()
  await save.confirm(); expect(mocks.save.mock.calls[2]?.[1].costLimit.expectedVersion).toBe('6'); expect(saved).toHaveBeenCalledExactlyOnceWith(snapshot)
})
it('取消销毁确认，旧回调无法提交', async () => {
  mocks.save.mockResolvedValue(preview); const save = useTenantSettingsSave(vi.fn(),vi.fn())
  await save.start('2',initial,target); save.cancel(); await save.confirm(); expect(mocks.save).toHaveBeenCalledTimes(1); expect(save.pending.value).toBeNull()
})
it('单次飞行，身份世代改变丢弃迟到保存回执', async () => {
  let resolve!: (value: unknown) => void
  mocks.save.mockReturnValue(new Promise(r => { resolve = r }))
  const saved = vi.fn(), save = useTenantSettingsSave(saved,vi.fn())
  const first = save.start('2',initial,target); await save.start('2',initial,target); expect(mocks.save).toHaveBeenCalledTimes(1)
  save.invalidate(); resolve({ status: 'SAVED', requiresConfirmation: false, savedSnapshot: snapshot }); await first; expect(saved).not.toHaveBeenCalled()
})
it.each([{ response: { status: 500, data: { code: 'B000001' } } }, new Error('timeout'), { code: 'B000802', httpStatus: 503 }])('5xx/断网保持未知结果和原请求，必须人工核对', async error => {
  mocks.save.mockRejectedValueOnce(error).mockResolvedValueOnce({ status: 'SAVED', requiresConfirmation: false, savedSnapshot: snapshot })
  const saved = vi.fn(), save = useTenantSettingsSave(saved,vi.fn())
  await save.start('2',initial,target); expect(save.unknown.value).toBe(true); await save.start('2',{ ...initial, name: 'new' },target); expect(mocks.save).toHaveBeenCalledTimes(1)
  await save.reconcile(); expect(mocks.save.mock.calls[1]?.[1]).toEqual(initial); expect(saved).toHaveBeenCalledOnce(); expect(save.unknown.value).toBe(false)
})
it('明确版本拒绝保留页面草稿但不误报成功；损坏响应进入未知', async () => {
  mocks.save.mockRejectedValueOnce({ code: 'A000610' }).mockResolvedValueOnce({ status: 'SAVED' })
  const saved = vi.fn(), save = useTenantSettingsSave(saved,vi.fn())
  await save.start('2',initial,target); expect(save.unknown.value).toBe(false); expect(saved).not.toHaveBeenCalled()
  await save.start('2',initial,target); expect(save.unknown.value).toBe(true); expect(saved).not.toHaveBeenCalled()
})
