import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createRenderer, defineComponent, nextTick, reactive, type App } from 'vue'
import { useUserModelActivityCalendar } from '../src/composables/useUserModelActivityCalendar'
import type { UserModelActivityCalendar } from '../src/types/userModelActivityCalendar'
const mocks = vi.hoisted(() => ({ get: vi.fn(), identity: { token: 'account-a' } }))
vi.mock('@/api/userModelActivityCalendar', () => ({ getUserModelActivityCalendar: mocks.get }))
vi.mock('@/utils/apiError', () => ({ apiErrorDetails: (error: Error) => ({ message: error.message, cancelled: false }) }))
vi.mock('@/stores/user', () => ({ useUserStore: () => reactive(mocks.identity) }))
const renderer = createRenderer<object, object>({ createElement: () => ({}), createText: () => ({}), createComment: () => ({}), setText() {}, setElementText() {},
  parentNode: () => null, nextSibling: () => null, patchProp() {}, insert() {}, remove() {} })
let app: App | undefined, activity: ReturnType<typeof useUserModelActivityCalendar>
async function settle() { await Promise.resolve(); await nextTick(); await Promise.resolve(); await nextTick() }
function data(year?: number): UserModelActivityCalendar {
  const start = year ? `${year}-01-01` : '2025-10-19', end = year ? `${year}-12-31` : '2026-10-18'
  const days: UserModelActivityCalendar['days'] = []
  for (let time = Date.parse(`${start}T00:00:00Z`); time <= Date.parse(`${end}T00:00:00Z`); time += 86400000) {
    const date = new Date(time).toISOString().slice(0, 10), future = date > '2026-10-18'
    days.push({ date, state: future ? 'FUTURE' : 'COMPLETE', successCount: future ? null : '1' })
  }
  return { view: year ? 'YEAR' : 'ROLLING_365', year: year ?? null, today: '2026-10-18', rangeStart: start, rangeEnd: end, days, totalSuccessCount: '365',
    timezone: 'Asia/Shanghai', availability: 'READY', asOf: '', updatedAt: null, lagSeconds: 0, historyComplete: true, coverage: [] }
}
function mount() { app = renderer.createApp(defineComponent({ setup() { activity = useUserModelActivityCalendar(); return () => null } })); app.mount({}) }
beforeEach(() => {
  vi.resetAllMocks(); reactive(mocks.identity).token = 'account-a'
  vi.stubGlobal('document', { addEventListener: vi.fn(), removeEventListener: vi.fn(), visibilityState: 'visible' })
})
afterEach(() => { app?.unmount(); app = undefined; vi.unstubAllGlobals() })
it('快速切年只接受最后一次结果，服务端返回的今天在加载期间保留供年份选项使用', async () => {
  let old!: (result: UserModelActivityCalendar) => void
  mocks.get.mockResolvedValueOnce(data()).mockImplementationOnce(() => new Promise(resolve => { old = resolve })).mockResolvedValueOnce(data(2024))
  mount(); await settle(); const previous = activity.data.value; activity.selection.value = '2025'; await settle()
  expect(activity.data.value).toBe(previous); expect(activity.loading.value).toBe(true); expect(activity.today.value).toBe('2026-10-18')
  activity.selection.value = '2024'; await settle(); old(data(2025)); await settle()
  expect(activity.data.value?.year).toBe(2024)
  expect(mocks.get.mock.calls[1]![2].aborted).toBe(true)
})
it('切账号立即清空本人数据，旧账号晚到响应不能进入新会话', async () => {
  let old!: (result: UserModelActivityCalendar) => void, current!: (result: UserModelActivityCalendar) => void
  mocks.get.mockResolvedValueOnce(data()).mockImplementationOnce(() => new Promise(resolve => { old = resolve })).mockImplementationOnce(() => new Promise(resolve => { current = resolve }))
  mount(); await settle(); activity.selection.value = '2024'; await settle()
  expect(activity.data.value?.view).toBe('ROLLING_365')
  reactive(mocks.identity).token = 'account-b'; await settle(); expect(activity.data.value).toBeNull()
  old(data(2024)); await settle(); expect(activity.data.value).toBeNull()
  current(data()); await settle()
  expect(activity.data.value?.view).toBe('ROLLING_365'); expect(activity.data.value?.year).toBeNull()
  expect(mocks.get).toHaveBeenCalledTimes(3)
})
it('范围更新失败保留上次成功数据，重试成功后才替换', async () => {
  mocks.get.mockResolvedValueOnce(data()).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(data(2025))
  mount(); await settle(); const previous = activity.data.value
  activity.selection.value = '2025'; await settle()
  expect(activity.data.value).toBe(previous); expect(activity.error.value).toBe('offline'); expect(activity.loading.value).toBe(false)
  await activity.refresh(); await settle()
  expect(activity.data.value?.year).toBe(2025); expect(activity.error.value).toBe('')
})
it('失败和卸载不伪造零值，销毁后的响应不写入状态', async () => {
  let late!: (result: UserModelActivityCalendar) => void
  mocks.get.mockRejectedValueOnce(new Error('offline')).mockImplementationOnce(() => new Promise(resolve => { late = resolve }))
  mount(); await settle(); expect(activity.error.value).toBe('offline'); expect(activity.data.value).toBeNull()
  void activity.refresh(); app!.unmount(); app = undefined; late(data()); await settle(); expect(activity.data.value).toBeNull()
})
