import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { AxiosError } from 'axios'
import { useSkillFavoriteStore } from '../src/stores/skillFavorite'
import { cleanFolderName, folderNameError, favoriteQueryFromUrl, favoriteQueryToUrl, skillReleaseDate, skillReturnPath } from '../src/utils/skillFavorite'
import type { FavoriteFolders, FavoriteReceipt, FavoriteStatus } from '../src/types/skillFavorite'
const mocks = vi.hoisted(() => ({ folders: vi.fn(), statuses: vi.fn(), command: vi.fn(), token: 'session-a' as string | null }))
vi.mock('@/utils/auth', () => ({ getToken: () => mocks.token }))
vi.mock('@/api/skillFavorite', () => ({ favoriteFolders: mocks.folders, favoriteStatuses: mocks.statuses, favoriteCommand: mocks.command }))
const folders = (): FavoriteFolders => ({ folders: [{ folderId: '0', name: '默认收藏夹', defaultFolder: true, count: 1 },
  { folderId: '10', name: 'Dev', defaultFolder: false, count: 2 }], total: 3, folderLimit: 20, favoriteLimit: 1000 })
const status = (id = '20'): FavoriteStatus => ({ skillId: id, favoriteId: '100', folderId: '10', folderName: 'Dev', savedAt: '2026-11-01T00:00:00Z' })
const receipt = (values: Partial<FavoriteReceipt> = {}): FavoriteReceipt => ({ outcome: 'CREATED', favoriteId: '100', skillId: '20', folderId: '0',
  savedAt: '2026-11-01T00:00:00Z', removed: false, undoExpiresAt: null, fallbackToDefault: false, ...values })
function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (reason: unknown) => void
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail })
  return { resolve, reject, promise }
}
let store: ReturnType<typeof useSkillFavoriteStore>
beforeEach(() => {
  vi.resetAllMocks(); vi.useFakeTimers(); mocks.token = 'session-a'; setActivePinia(createPinia()); store = useSkillFavoriteStore()
  mocks.folders.mockResolvedValue(folders()); mocks.statuses.mockImplementation((ids: string[]) => Promise.resolve(ids.map(id => status(id))))
  mocks.command.mockResolvedValue(receipt())
})
afterEach(() => { store.reset(); vi.useRealTimers() })

it('名称按 NFC、ECMAScript 空白、码点、保留名和排除自身校验', () => {
  expect(cleanFolderName('\uFEFF\u00A0e\u0301 ')).toBe('é')
  expect(folderNameError('😀'.repeat(20), [])).toBe('')
  for (const name of ['', '  ', '默认收藏夹', '全部收藏', 'a\u0000b', '😀'.repeat(21), 'DEV']) expect(folderNameError(name, folders().folders)).not.toBe('')
  expect(folderNameError('Dev', folders().folders, '10')).toBe('')
})
it('URL 筛选可恢复且严格限制资源标识与页码', () => {
  const query = favoriteQueryFromUrl({ folder: '9007199254740993', keyword: ' test ', sort: 'updated', page: '2' })
  expect(query).toEqual({ folderId: '9007199254740993', keyword: 'test', sort: 'updated', page: 2, size: 12 })
  expect(favoriteQueryToUrl(query)).toEqual({ folder: '9007199254740993', keyword: 'test', sort: 'updated', page: '2' })
  for (const folder of ['-1', '01', '9223372036854775808', '//evil', '1.5']) expect(favoriteQueryFromUrl({ folder }).folderId).toBeUndefined()
  for (const page of ['0', '10001', 'NaN', '1.5']) expect(favoriteQueryFromUrl({ page }).page).toBe(1)
  expect(Array.from(favoriteQueryFromUrl({ keyword: '😀'.repeat(81) }).keyword!).length).toBe(80)
  expect(favoriteQueryFromUrl({ folder: '0', sort: 'other' }).folderId).toBe('0')
})
it('正式版日期按北京时间，缺失与非法日期不编造', () => {
  expect(skillReleaseDate('2026-11-20T17:15:00Z')).toBe('2026-11-21')
  expect(skillReleaseDate('2026-11-20T15:59:59Z')).toBe('2026-11-20')
  for (const value of [null, undefined, '', 'bad']) expect(skillReleaseDate(value)).toBe('—')
})
it('详情返回路径只允许广场或我的收藏及查询条件', () => {
  expect(skillReturnPath('/skills/favorites?folder=10&page=2')).toBe('/skills/favorites?folder=10&page=2')
  expect(skillReturnPath('/skills?keyword=a')).toBe('/skills?keyword=a')
  for (const value of ['https://evil.test', '//evil', '/skills/20', '/skills/favorites/evil', '/skills\\evil', '/skills#x', undefined]) expect(skillReturnPath(value)).toBe('/skills')
})
it('数量未返回前不产生假零，读取失败可重试且不会伪装未收藏', async () => {
  expect(store.folders).toBeUndefined(); expect(store.statuses['20']).toBeUndefined()
  mocks.folders.mockRejectedValueOnce(new Error('offline')); mocks.statuses.mockRejectedValueOnce(new Error('offline'))
  expect(await store.loadFolders()).toBe(false); expect(await store.loadStatuses(['20'])).toBe(false)
  expect(store.folders).toBeUndefined(); expect(store.readError).toContain('无法加载')
  await store.loadFolders(); expect(store.readError).toContain('收藏状态')
  await store.loadStatuses(['20']); expect(store.readError).toBe(''); expect(store.statuses['20']?.favoriteId).toBe('100')
})
it('同一批状态最多24且去重，迟到查询不能覆盖新查询', async () => {
  const old = deferred<FavoriteStatus[]>()
  mocks.statuses.mockReturnValueOnce(old.promise)
  const pending = store.loadStatuses(['20'])
  await store.loadStatuses(['21']); old.resolve([status('20')]); await pending
  expect(store.statuses['21']).toBeDefined(); expect(store.statuses['20']).toBeUndefined()
  await store.loadStatuses(Array.from({ length: 30 }, (_, i) => String(i + 1)))
  expect(mocks.statuses.mock.calls.at(-1)?.[0]).toHaveLength(24)
})
it('切账号清除私人列表、弹窗、计时器与原请求，旧读写均不能污染新会话', async () => {
  const oldFolders = deferred<FavoriteFolders>(), oldCommand = deferred<FavoriteReceipt>()
  mocks.folders.mockReturnValueOnce(oldFolders.promise); mocks.command.mockReturnValueOnce(oldCommand.promise)
  const reading = store.loadFolders(); store.openSelection('20', 'Private')
  const writing = store.submit({ type: 'create', skillId: '20', folderId: '0' })
  const signal = mocks.command.mock.calls[0]?.[2] as AbortSignal
  mocks.token = 'session-b'; store.reset()
  oldFolders.resolve(folders()); oldCommand.resolve(receipt()); await reading; await writing
  expect(signal.aborted).toBe(true); expect(store.dialog).toBeUndefined(); expect(store.folders).toBeUndefined()
  expect(store.statuses).toEqual({}); expect(store.pending).toBeUndefined(); expect(store.notice).toBe('')
  expect(store.busy).toBe(false)
})
it('结果未知保留载荷和原UUID，关闭与新动作被阻止，同键重试才解除', async () => {
  store.openSelection('20', 'Private')
  mocks.command.mockRejectedValueOnce(new AxiosError('network', 'ERR_NETWORK'))
  await store.submit({ type: 'create', skillId: '20', folderId: '0' })
  const first = mocks.command.mock.calls[0]!
  expect(store.uncertain).toBe(true); expect(store.locked).toBe(true); expect(store.actionError).toContain('结果待确认')
  store.close(); store.manage('createFolder'); await store.submit({ type: 'create', skillId: '21', folderId: '10' })
  expect(store.dialog?.type).toBe('create'); expect(mocks.command).toHaveBeenCalledOnce()
  await store.retry()
  expect(mocks.command.mock.calls[1]?.slice(0, 2)).toEqual(first.slice(0, 2)); expect(store.pending).toBeUndefined()
  expect(store.locked).toBe(false); expect(store.dialog).toBeUndefined(); expect(store.notice).toBe('已收藏 Skill')
})
it('明确业务失败保留弹窗和目标输入，不显示成功', async () => {
  store.openSelection('20', 'Private'); store.selectedFolder = '10'
  mocks.command.mockRejectedValueOnce(Object.assign(new Error('收藏已达上限'), { code: 'A001706', httpStatus: 413 }))
  await store.submit({ type: 'create', skillId: '20', folderId: '10' })
  expect(store.dialog?.type).toBe('create'); expect(store.selectedFolder).toBe('10'); expect(store.pending).toBeUndefined()
  expect(store.actionError).toBe('收藏已达上限'); expect(store.notice).toBe(''); expect(store.uncertain).toBe(false)
})
it('移动目标404时保留原归属和弹窗，清空目标要求重新选择', async () => {
  await store.loadStatuses(['20']); store.openSelection('20', 'Private', true)
  mocks.command.mockRejectedValueOnce(Object.assign(new Error('目标不存在'), { code: 'A001702', httpStatus: 404 }))
  await store.submit({ type: 'move', favoriteId: '100', folderId: '30' })
  expect(store.dialog?.type).toBe('move'); expect(store.selectedFolder).toBe(''); expect(store.statuses['20']?.folderId).toBe('10')
  expect(store.actionError).toBe('目标不存在')
})
it('提交中阻止双击和关闭，成功回执之后才刷新', async () => {
  const waiting = deferred<FavoriteReceipt>(); mocks.command.mockReturnValueOnce(waiting.promise)
  store.openSelection('20', 'Private')
  const writing = store.submit({ type: 'create', skillId: '20', folderId: '0' })
  store.close(); await store.retry(); await store.submit({ type: 'cancel', favoriteId: '100' })
  expect(store.busy).toBe(true); expect(store.dialog).toBeDefined(); expect(mocks.command).toHaveBeenCalledOnce()
  waiting.resolve(receipt()); await writing
  expect(store.busy).toBe(false); expect(store.revision).toBeGreaterThan(0)
})
it('成功后刷新失败提示操作已完成，不再保留待提交命令', async () => {
  mocks.folders.mockRejectedValueOnce(new Error('offline'))
  await store.submit({ type: 'create', skillId: '20', folderId: '0' })
  expect(store.notice).toBe('操作已保存，但收藏信息刷新失败，请刷新页面'); expect(store.noticeType).toBe('warning'); expect(store.pending).toBeUndefined()
  expect(store.uncertain).toBe(false); expect(store.statuses['20']?.favoriteId).toBe('100')
})
it.each(['success', 'failure'])('状态刷新被新请求替代后，旧请求%s不误报操作刷新失败', async outcome => {
  const old = deferred<FavoriteStatus[]>()
  mocks.statuses.mockReturnValueOnce(old.promise)
  const writing = store.submit({ type: 'create', skillId: '20', folderId: '0' })
  await Promise.resolve()
  await store.loadStatuses(['21'])
  if (outcome === 'success') old.resolve([status('20')])
  else old.reject(new Error('旧请求失败'))
  await writing
  expect(store.notice).toBe('已收藏 Skill'); expect(store.readError).toBe('')
  expect(store.statuses['21']?.favoriteId).toBe('100'); expect(store.statuses['20']).toBeUndefined()
  expect(store.pending).toBeUndefined(); expect(store.uncertain).toBe(false)
})
it('列表快照替代状态刷新后保留新快照，不误报刷新失败', async () => {
  const old = deferred<FavoriteStatus[]>()
  mocks.statuses.mockReturnValueOnce(old.promise)
  const writing = store.submit({ type: 'create', skillId: '20', folderId: '0' })
  await Promise.resolve()
  store.observeItems([{ favoriteId: '101', skillId: '20', folderId: '10', folderName: 'Dev',
    savedAt: '2026-11-21T00:00:00Z', availability: 'UNAVAILABLE', skill: null }])
  old.resolve([status('20')]); await writing
  expect(store.statuses['20']?.favoriteId).toBe('101'); expect(store.notice).toBe('已收藏 Skill')
  expect(store.readError).toBe('')
})
it('收藏夹刷新被更新读取替代后，迟到失败不误报操作失败', async () => {
  const old = deferred<FavoriteFolders>()
  mocks.folders.mockReturnValueOnce(old.promise)
  const writing = store.submit({ type: 'create', skillId: '20', folderId: '0' })
  await Promise.resolve()
  await store.loadFolders()
  old.reject(new Error('旧请求失败')); await writing
  expect(store.folders).toEqual(folders()); expect(store.notice).toBe('已收藏 Skill'); expect(store.readError).toBe('')
})
it('空状态集和新的列表快照会清除已失效的状态读取错误', async () => {
  mocks.statuses.mockRejectedValueOnce(new Error('offline'))
  await store.loadStatuses(['20']); expect(store.readError).toContain('收藏状态')
  await store.loadStatuses([]); expect(store.readError).toBe('')
  mocks.statuses.mockRejectedValueOnce(new Error('offline'))
  await store.loadStatuses(['20']); expect(store.readError).toContain('收藏状态')
  store.observeItems([]); expect(store.readError).toBe('')
})
it('刷新错误已被后续成功查询消除时，不再弹出过期失败提示', async () => {
  const oldFolders = deferred<FavoriteFolders>()
  mocks.folders.mockReturnValueOnce(oldFolders.promise)
  mocks.statuses.mockRejectedValueOnce(new Error('offline'))
  const writing = store.submit({ type: 'create', skillId: '20', folderId: '0' })
  await Promise.resolve(); await Promise.resolve()
  expect(store.readError).toContain('收藏状态')
  await store.loadStatuses(['21'])
  oldFolders.resolve(folders()); await writing
  expect(store.readError).toBe(''); expect(store.notice).toBe('已收藏 Skill')
})
it('当前状态刷新真实失败时保留已提交回执，只提示读取失败', async () => {
  mocks.statuses.mockRejectedValueOnce(new Error('offline'))
  await store.submit({ type: 'create', skillId: '20', folderId: '0' })
  expect(store.noticeType).toBe('warning'); expect(store.notice).toContain('操作已保存')
  expect(store.readError).toContain('收藏状态'); expect(store.statuses['20']?.favoriteId).toBe('100')
  expect(store.pending).toBeUndefined(); expect(store.uncertain).toBe(false); expect(mocks.command).toHaveBeenCalledOnce()
  await store.submit({ type: 'create', skillId: '21', folderId: '0' })
  expect(store.noticeType).toBe('success'); expect(store.notice).toBe('已收藏 Skill'); expect(store.readError).toBe('')
})
it('删除空收藏夹只显示删除成功，不提示迁移零项', async () => {
  mocks.command.mockResolvedValueOnce({ folderId: '10', changed: true, migrated: 0 })
  await store.submit({ type: 'deleteFolder', folderId: '10' })
  expect(store.notice).toBe('收藏夹已删除'); expect(store.noticeType).toBe('success'); expect(store.deletedFolder).toBe('10')
})
it('取消成功给5秒撤销，恢复复用取消UUID，计时消失不取消已发出的请求', async () => {
  await store.loadStatuses(['20'])
  mocks.command.mockResolvedValueOnce(receipt({ outcome: 'CANCELLED', removed: true, undoExpiresAt: '2026-11-21T00:00:30Z' }))
  await store.submit({ type: 'cancel', favoriteId: '100' })
  const cancelKey = mocks.command.mock.calls[0]?.[1]
  expect(store.undo?.key).toBe(cancelKey); expect(store.notice).toBe('已取消收藏')
  const waiting = deferred<FavoriteReceipt>(); mocks.command.mockReturnValueOnce(waiting.promise)
  const restoring = store.restore(); await vi.advanceTimersByTimeAsync(5001)
  expect(store.undo).toBeUndefined(); expect(store.busy).toBe(true)
  expect(mocks.command.mock.calls[1]?.slice(0, 2)).toEqual([{ type: 'restore', favoriteId: '100' }, cancelKey])
  waiting.resolve(receipt({ outcome: 'RESTORED', fallbackToDefault: true })); await restoring
  expect(store.notice).toBe('已恢复至默认收藏夹'); expect(store.busy).toBe(false)
})
it('没有实际删除不给撤销，既有新收藏恢复不会误报覆盖', async () => {
  mocks.command.mockResolvedValueOnce(receipt({ outcome: 'ABSENT', removed: false, skillId: null }))
  await store.submit({ type: 'cancel', favoriteId: '100' }); expect(store.undo).toBeUndefined(); expect(store.notice).toBe('此收藏已取消')
  mocks.command.mockResolvedValueOnce(receipt({ outcome: 'EXISTING' }))
  await store.submit({ type: 'restore', favoriteId: '100' }); expect(store.notice).toBe('已保留当前的新收藏')
})
it('下一项成功操作替换提示时清除旧取消的撤销入口', async () => {
  mocks.command.mockResolvedValueOnce(receipt({ outcome: 'CANCELLED', removed: true }))
  await store.submit({ type: 'cancel', favoriteId: '100' }); expect(store.undo).toBeDefined()
  mocks.command.mockResolvedValueOnce(receipt({ outcome: 'CREATED', favoriteId: '101' }))
  await store.submit({ type: 'create', skillId: '20', folderId: '0' })
  expect(store.notice).toBe('已收藏 Skill'); expect(store.undo).toBeUndefined()
})
it('弹窗内独立创建夹后保持选择弹窗并自动选中新夹，关闭不会删除新夹', async () => {
  store.openSelection('20', 'Private'); mocks.command.mockResolvedValueOnce({ folderId: '30', changed: true, migrated: 0 })
  await store.submit({ type: 'createFolder', name: 'New' })
  expect(store.dialog?.type).toBe('create'); expect(store.selectedFolder).toBe('30')
  store.close(); expect(store.dialog).toBeUndefined(); expect(mocks.command).toHaveBeenCalledOnce()
})
it('夹管理只允许自定义夹，删除回执记录实际迁移和导航目标', async () => {
  store.manage('renameFolder', folders().folders[0]); expect(store.dialog).toBeUndefined()
  store.manage('renameFolder', folders().folders[1]); expect(store.dialog?.type).toBe('renameFolder')
  mocks.command.mockResolvedValueOnce({ folderId: '10', changed: true, migrated: 7 })
  await store.submit({ type: 'deleteFolder', folderId: '10' })
  expect(store.deletedFolder).toBe('10'); expect(store.notice).toContain('7 项收藏'); expect(store.dialog).toBeUndefined()
})
it('5xx保守保持原请求，登出后不自动重放', async () => {
  mocks.command.mockRejectedValueOnce({ response: { status: 503, data: { code: 'B001701', message: '服务忙' } }, isAxiosError: true })
  await store.submit({ type: 'move', favoriteId: '100', folderId: '0' }); expect(store.uncertain).toBe(true)
  store.reset(); mocks.token = null; await store.retry(); await store.submit({ type: 'cancel', favoriteId: '100' })
  expect(mocks.command).toHaveBeenCalledOnce(); expect(store.pending).toBeUndefined()
})
