import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { defineComponent, reactive, type App } from 'vue'
import { useSkillVersionPublication, legacySkillRevision } from '../src/composables/useSkillVersionPublication'
import { hostNode, hostRenderer, settleHost } from './helpers/vueHost'
import type { SkillWorkspace, VersionPreview, VersionReceipt } from '../src/types/skillVersion'
const mocks = vi.hoisted(() => ({ get: vi.fn(), open: vi.fn(), save: vi.fn(), preview: vi.fn(), publish: vi.fn(), result: vi.fn(),
  github: vi.fn(), create: vi.fn(), upload: vi.fn(), status: vi.fn(), cancel: vi.fn(), abandon: vi.fn(),
  route: { params: { skillId: '20' } }, identity: { token: 'session-a', userId: '1' } }))
vi.mock('vue-router', () => ({ useRoute: () => reactive(mocks.route) }))
vi.mock('@/stores/user', () => ({ useUserStore: () => reactive(mocks.identity) }))
vi.mock('@/utils/auth', () => ({ getStoredUser: () => ({ userId: mocks.identity.userId }) }))
vi.mock('@/api/skillVersion', () => ({ getWorkspace: mocks.get, openWorkspace: mocks.open, saveWorkspace: mocks.save,
  publicationPreview: mocks.preview, publishVersion: mocks.publish, publicationResult: mocks.result, importWorkspaceGithub: mocks.github }))
vi.mock('@/api/skill', () => ({ abandonSkillDraft: mocks.abandon, createSkillImport: mocks.create, uploadSkillArchive: mocks.upload,
  skillImportStatus: mocks.status, cancelSkillImport: mocks.cancel }))
let app: App | undefined, state: ReturnType<typeof useSkillVersionPublication>
const workspace = (): SkillWorkspace => ({ skillId: '20', draftId: '30', slug: 'sample', skillStatus: 'ACTIVE', skillRevision: '1',
  baseSkillRevision: '1', revision: '3', status: 'READY', jobId: null, artifactId: '40', contentSha256: 'a', sourceVersionId: null,
  releaseNotes: '新版说明', metadata: null, creationSource: { schemaVersion: 1, type: 'ZIP', repositoryUrl: null, repositoryId: null,
    requestedRef: null, resolvedRefType: null, commitSha: null, directory: null }, source: null, currentVersion: 'v1' })
const preview: VersionPreview = { type: 'DRAFT', version: 'v2-draft.1', workspaceRevision: '4', expectedSkillRevision: '1',
  confirmationDigest: 'a'.repeat(64), baseVersionId: '70', baseVersion: 'v1', addedCount: 1, modifiedCount: 0, deletedCount: 0,
  fileCount: 2, contentSha256: 'hash', source: workspace().creationSource!, sourceDraftVersion: null, currentVersion: 'v1', releaseNotes: '新版说明' }
const receipt: VersionReceipt = { skillId: '20', versionId: '71', type: 'DRAFT', version: 'v2-draft.1', sequence: '2',
  publishedAt: '', sourceDraftVersionId: null, submissionId: null, approvalId: null }
function mount() { app = hostRenderer.createApp(defineComponent({ setup() { state = useSkillVersionPublication(); return () => null } })); app.mount(hostNode('root')) }
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(accept => { resolve = accept }); return { resolve, promise } }
beforeEach(() => {
  vi.resetAllMocks(); Object.assign(reactive(mocks.identity), { token: 'session-a', userId: '1' }); reactive(mocks.route).params.skillId = '20'
  const storage = new Map<string, string>()
  vi.stubGlobal('sessionStorage', { getItem: (key: string) => storage.get(key) || null, setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key) })
  mocks.get.mockImplementation(() => Promise.resolve(workspace())); mocks.save.mockResolvedValue({ ...workspace(), revision: '4' }); mocks.preview.mockResolvedValue(preview)
})
afterEach(() => { app?.unmount(); app = undefined; vi.unstubAllGlobals(); vi.useRealTimers() })
it('保存说明后使用服务端预览，未最终确认前不产生发布请求', async () => {
  mount(); await settleHost(); await state.confirm('DRAFT')
  expect(mocks.save.mock.calls[0]!.slice(0, 3)).toEqual(['20', '3', '新版说明'])
  expect(state.preview.value?.version).toBe('v2-draft.1'); expect(mocks.publish).not.toHaveBeenCalled()
  mocks.publish.mockResolvedValue(receipt); await state.publish()
  expect(mocks.publish.mock.calls[0]![1]).toEqual({ workspaceRevision: '4', expectedSkillRevision: '1', type: 'DRAFT', confirmationDigest: 'a'.repeat(64) })
  expect(state.receipt.value?.versionId).toBe('71'); expect(state.intent.value).toBeUndefined()
})
it('响应丢失后冻结意图，查不到回执也只重试原键原载荷', async () => {
  mocks.publish.mockRejectedValueOnce(new Error('response lost')).mockResolvedValueOnce(receipt)
  mocks.result.mockResolvedValue({ status: 'UNCONFIRMED', receipt: null })
  mount(); await settleHost(); await state.confirm('DRAFT'); await state.publish()
  const original = mocks.publish.mock.calls[0]!.slice(0, 3)
  expect(state.intent.value).toBeDefined(); await state.confirm('RELEASE'); expect(mocks.preview).toHaveBeenCalledTimes(1)
  await state.recover(); expect(mocks.publish.mock.calls[1]!.slice(0, 3)).toEqual(original)
  expect(state.receipt.value).toEqual(receipt)
})
it('页面重建后恢复长期回执，不根据已消费工作区重新发布', async () => {
  mocks.publish.mockRejectedValueOnce(new Error('lost')); mount(); await settleHost(); await state.confirm('DRAFT'); await state.publish()
  app!.unmount(); app = undefined; mocks.get.mockResolvedValue({ ...workspace(), status: 'SUBMITTED', revision: '5' })
  mocks.result.mockResolvedValue({ status: 'COMMITTED', receipt }); mount(); await settleHost(); expect(state.intent.value).toBeDefined()
  await state.recover(); expect(state.receipt.value).toEqual(receipt); expect(mocks.publish).toHaveBeenCalledTimes(1)
})
it('明确并发冲突要求重新核对，清除旧预览并刷新修订', async () => {
  mocks.publish.mockRejectedValue(Object.assign(new Error('refresh'), { code: 'A001703' }))
  mount(); await settleHost(); await state.confirm('DRAFT'); await state.publish()
  expect(state.intent.value).toBeUndefined(); expect(state.preview.value).toBeUndefined(); expect(state.error.value).toBe('refresh')
})
it('账号切换清除私人正文/预览，迟到的旧账号响应不更新新状态', async () => {
  const old = deferred<SkillWorkspace>(); mocks.get.mockReturnValueOnce(old.promise)
  mount(); await settleHost(); Object.assign(reactive(mocks.identity), { token: 'session-b', userId: '2' }); await settleHost()
  expect(state.workspace.value?.draftId).toBe('30')
  old.resolve({ ...workspace(), draftId: 'secret' }); await settleHost(); expect(state.workspace.value?.draftId).toBe('30')
  expect(state.preview.value).toBeUndefined(); expect(state.intent.value).toBeUndefined()
})
it('基于最新草稿只能正式发布，旧数字接口拒绝不安全修订转换', async () => {
  mocks.get.mockResolvedValue({ ...workspace(), sourceVersionId: '71' }); mount(); await settleHost(); await state.confirm('DRAFT')
  expect(mocks.preview).not.toHaveBeenCalled(); expect(mocks.save).not.toHaveBeenCalled()
  expect(legacySkillRevision('12')).toBe(12)
  expect(() => legacySkillRevision('9007199254740993')).toThrow(); expect(() => legacySkillRevision('-1')).toThrow()
})
