import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createRenderer, defineComponent, nextTick, reactive, type App } from 'vue'
import { useSkillPublication } from '../src/composables/useSkillPublication'
import type { SkillDraft, SkillMetadata, SkillPublication } from '../src/types/skill'
const mocks = vi.hoisted(() => ({ options: vi.fn(), createDraft: vi.fn(),
  getDraft: vi.fn(), save: vi.fn(), createImport: vi.fn(), upload: vi.fn(), status: vi.fn(), submit: vi.fn(), cancel: vi.fn(),
  replace: vi.fn(), route: { params: { draftId: '30' } }, identity: { token: 'account-a', isLoggedIn: true, userId: '1', user: { nickname: '现有账号昵称', username: 'account-a' } } }))
vi.mock('@/api/skill', () => ({ skillOptions: mocks.options,
  createSkillDraft: mocks.createDraft, getSkillDraft: mocks.getDraft, saveSkillDraft: mocks.save, createSkillImport: mocks.createImport,
  uploadSkillArchive: mocks.upload, skillImportStatus: mocks.status, submitSkillDraft: mocks.submit, cancelSkillImport: mocks.cancel }))
vi.mock('vue-router', () => ({ useRoute: () => reactive(mocks.route), useRouter: () => ({ replace: mocks.replace }) }))
vi.mock('@/stores/user', () => ({ useUserStore: () => reactive(mocks.identity) }))
vi.mock('@/utils/auth', () => ({ getStoredUser: () => ({ userId: mocks.identity.userId }) }))
vi.mock('@/utils/apiError', () => ({ apiErrorDetails: (error: Error & { code?: string }) => ({ message: error.message, code: error.code, cancelled: false }) }))
const renderer = createRenderer<object, object>({ createElement: () => ({}), createText: () => ({}), createComment: () => ({}),
  setText() {}, setElementText() {}, parentNode: () => null, nextSibling: () => null, patchProp() {}, insert() {}, remove() {} })
let app: App | undefined
let state: ReturnType<typeof useSkillPublication>
const metadata: SkillMetadata = { name: '测试 Skill', summary: '说明', categoryId: 'development', tags: ['coding'], version: '1.0.0',
  releaseNotes: '首版', license: 'MIT', originalAuthor: '本人', sourceUrl: '', compatibility: 'Agent Skills', dependencies: '无', distributionAuthorized: true, declarationsConfirmed: true }
const receipt: SkillPublication = { skillId: '20', submissionId: '60', approvalId: '80', versionId: '70', approvalStatus: 'APPROVED', decisionSource: 'LOCAL_AUTO', publicationStatus: 'PUBLISHED', publisher: 'author', slug: 'test-skill' }
function draft(id = '30', revision = 2, status = 'READY'): SkillDraft {
  return { draftId: id, skillId: '20', slug: 'test-skill', status, revision, jobId: null, metadata: { ...metadata, tags: ['coding'], name: `Skill ${id}` }, packageName: 'test-skill', packageDescription: '说明', skillMarkdown: '# 测试', archiveBytes: 3, fileCount: 1, updatedAt: '' }
}
function mount() {
  app = renderer.createApp(defineComponent({ setup() { state = useSkillPublication(); return () => null } }))
  app.mount({})
}
async function settle() { for (let index = 0; index < 5; index++) { await Promise.resolve(); await nextTick() } }
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(accept => { resolve = accept })
  return { promise, resolve }
}
beforeEach(() => {
  vi.resetAllMocks()
  reactive(mocks.route).params.draftId = '30'
  Object.assign(reactive(mocks.identity), { token: 'account-a', isLoggedIn: true, userId: '1' })
  const storage = new Map<string, string>()
  vi.stubGlobal('sessionStorage', { getItem: (key: string) => storage.get(key) || null, setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key) })
  mocks.options.mockResolvedValue({ categories: [], tags: [], maxArchiveBytes: 20 * 1024 * 1024, maxUnpackedBytes: 50 * 1024 * 1024, maxFiles: 500 })
  mocks.getDraft.mockImplementation((id: string) => Promise.resolve(draft(id)))
})
afterEach(() => { app?.unmount(); app = undefined; vi.unstubAllGlobals() })

it('使用保存回执的修订提交，网络失败后重试原始幂等键', async () => {
  mocks.save.mockResolvedValue(draft('30', 3))
  mocks.submit.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(receipt)
  mount(); await settle(); await state.submit()
  expect(state.error.value).toBe('offline')
  expect(state.submitIntent.value?.revision).toBe(3)
  const original = mocks.submit.mock.calls[0]!
  expect(original[0]).toBe('30'); expect(original[1]).toBe(3)
  await state.retrySubmission()
  expect(mocks.submit.mock.calls[1]!.slice(0, 3)).toEqual(original.slice(0, 3))
  expect(mocks.save).toHaveBeenCalledTimes(1)
  expect(state.publication.value?.versionId).toBe('70')
})

it('页面重建后仍恢复原修订，即使服务器草稿已经SUBMITTED并递增修订', async () => {
  mocks.save.mockResolvedValue(draft('30', 3)); mocks.submit.mockRejectedValueOnce(new Error('response lost'))
  mount(); await settle(); await state.submit()
  const original = mocks.submit.mock.calls[0]!.slice(0, 3)
  app!.unmount(); app = undefined
  mocks.getDraft.mockResolvedValue(draft('30', 4, 'SUBMITTED')); mocks.submit.mockResolvedValue(receipt)
  mount(); await settle()
  expect(state.editable.value).toBe(false); expect(state.submitIntent.value?.revision).toBe(3)
  await state.retrySubmission()
  expect(mocks.submit.mock.calls[1]!.slice(0, 3)).toEqual(original)
  expect(state.publication.value?.submissionId).toBe('60')
})

it('旧草稿保存响应晚到时不能覆盖新路由草稿', async () => {
  const old = deferred<SkillDraft>(); mocks.save.mockReturnValue(old.promise)
  mount(); await settle(); const saving = state.save()
  reactive(mocks.route).params.draftId = '31'; await settle()
  expect(state.draft.value?.draftId).toBe('31')
  old.resolve(draft('30', 3)); await saving; await settle()
  expect(state.draft.value?.draftId).toBe('31'); expect(state.form.name).toBe('Skill 31')
  expect(mocks.save.mock.calls[0]![3].aborted).toBe(true)
})

it('离开原草稿后迟到的保存结果不会继续发起发布', async () => {
  const old = deferred<SkillDraft>(); mocks.save.mockReturnValue(old.promise)
  mount(); await settle(); const submitting = state.submit()
  reactive(mocks.route).params.draftId = '31'; await settle()
  old.resolve(draft('30', 3)); await submitting
  expect(mocks.submit).not.toHaveBeenCalled(); expect(state.submitIntent.value).toBeUndefined()
})

it('账号改变立即清空旧私人数据，旧响应不能进入新会话', async () => {
  const old = deferred<SkillDraft>(); mocks.save.mockReturnValue(old.promise)
  mount(); await settle(); const saving = state.save()
  mocks.getDraft.mockRejectedValue(new Error('not accessible'))
  Object.assign(reactive(mocks.identity), { token: 'account-b', userId: '2' }); await settle()
  expect(state.draft.value).toBeUndefined(); expect(state.form.name).toBe('')
  old.resolve(draft('30', 3)); await saving
  expect(state.draft.value).toBeUndefined(); expect(state.error.value).toBe('not accessible')
})

it('明确许可拒绝允许修正表单，结果未知才保留提交恢复锁', async () => {
  mocks.save.mockResolvedValue(draft('30', 3))
  mocks.submit.mockRejectedValue(Object.assign(new Error('license required'), { code: 'A001707' }))
  mount(); await settle(); await state.submit()
  expect(state.submitIntent.value).toBeUndefined(); expect(state.editable.value).toBe(true)
  expect(state.error.value).toBe('license required')
})

it('确定的修订冲突先读取权威草稿，再解除恢复锁并要求重新确认声明', async () => {
  mocks.getDraft.mockResolvedValueOnce(draft('30', 2)).mockResolvedValueOnce(draft('30', 4))
    .mockResolvedValue(draft('30', 6, 'SUBMITTED'))
  mocks.save.mockResolvedValueOnce(draft('30', 3)).mockResolvedValueOnce(draft('30', 5))
  mocks.submit.mockRejectedValueOnce(Object.assign(new Error('revision conflict'), { code: 'A001703' }))
    .mockResolvedValueOnce(receipt)
  mount(); await settle(); await state.submit()
  expect(state.submitIntent.value).toBeUndefined()
  expect(state.draft.value?.revision).toBe(4)
  expect(state.form.distributionAuthorized).toBe(false)
  expect(state.form.declarationsConfirmed).toBe(false)
  Object.assign(state.form, { distributionAuthorized: true, declarationsConfirmed: true })
  await state.submit()
  expect(mocks.submit.mock.calls[1]![1]).toBe(5)
  expect(mocks.submit.mock.calls[1]![2]).not.toBe(mocks.submit.mock.calls[0]![2])
  expect(state.publication.value?.submissionId).toBe('60')
})

it('修订冲突后发现其他提交已完成时只显示已提交状态，不伪造本次回执', async () => {
  mocks.getDraft.mockResolvedValueOnce(draft('30', 2)).mockResolvedValue(draft('30', 4, 'SUBMITTED'))
  mocks.save.mockResolvedValue(draft('30', 3))
  mocks.submit.mockRejectedValue(Object.assign(new Error('already submitted'), { code: 'A001703' }))
  mount(); await settle(); await state.submit()
  expect(state.submitIntent.value).toBeUndefined()
  expect(state.draft.value?.status).toBe('SUBMITTED')
  expect(state.editable.value).toBe(false)
  expect(state.publication.value).toBeUndefined()
})

it('同页新ZIP开始后旧任务的预览刷新不能覆盖新修订', async () => {
  const stalePreview = deferred<SkillDraft>()
  const upload = deferred<{ jobId: string; draftId: string; status: string; draftRevision: number; errorCode: null; reason: null; attempts: number; updatedAt: string }>()
  const initial = { ...draft('30', 2), jobId: '50' }
  mocks.getDraft.mockResolvedValueOnce(initial).mockReturnValueOnce(stalePreview.promise).mockResolvedValue(draft('30', 4))
  mocks.status.mockResolvedValueOnce({ jobId: '50', status: 'SUCCEEDED' }).mockResolvedValue({ jobId: '51', status: 'QUEUED' })
  mocks.createImport.mockResolvedValue({ jobId: '51', draftId: '30', status: 'WAITING_UPLOAD', draftRevision: 5 })
  mocks.upload.mockReturnValue(upload.promise)
  mount(); await settle()
  await state.refreshDraft()
  const uploading = state.retryUpload(new File([new Uint8Array([1, 2, 3])], 'fresh.zip'))
  await settle()
  expect(state.draft.value?.revision).toBe(5)
  stalePreview.resolve(draft('30', 4)); await settle()
  expect(state.draft.value?.revision).toBe(5); expect(state.draft.value?.status).toBe('EDITING')
  expect(state.draft.value?.skillMarkdown).toBeNull(); expect(state.form.distributionAuthorized).toBe(false)
  upload.resolve({ jobId: '51', draftId: '30', status: 'QUEUED', draftRevision: 5, errorCode: null, reason: null, attempts: 0, updatedAt: '' })
  await uploading
})

it('新账号可直接创建草稿，不调用独立身份设置', async () => {
  reactive(mocks.route).params.draftId = ''
  mocks.createDraft.mockResolvedValue(draft('30', 0, 'EDITING'))
  mount(); await settle()
  expect(state.authorName.value).toBe('现有账号昵称')
  state.slug.value = 'direct-skill'
  await state.create()
  expect(mocks.createDraft).toHaveBeenCalledOnce()
  expect(mocks.createDraft.mock.calls[0]?.[0]).toBe('direct-skill')
  expect(mocks.replace).toHaveBeenCalledWith('/skills/publish/30')
})
