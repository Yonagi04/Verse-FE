import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createRenderer, defineComponent, nextTick, reactive, type App } from 'vue'
import { useSkillPublication } from '../src/composables/useSkillPublication'
import type { SkillDraft, SkillImportTask, SkillGithubCandidates, SkillMetadata } from '../src/types/skill'

const mocks = vi.hoisted(() => ({ options: vi.fn(), get: vi.fn(), save: vi.fn(), status: vi.fn(), cancel: vi.fn(),
  createGithub: vi.fn(), confirm: vi.fn(), candidates: vi.fn(), select: vi.fn(), files: vi.fn(), submit: vi.fn(),
  route: { params: { draftId: '30' } }, identity: { token: 'account-a', userId: '1', isLoggedIn: true, user: { username: 'author' } } }))
vi.mock('@/api/skill', () => ({ skillOptions: mocks.options, getSkillDraft: mocks.get, saveSkillDraft: mocks.save,
  skillImportStatus: mocks.status, cancelSkillImport: mocks.cancel, createSkillGithubImport: mocks.createGithub,
  confirmSkillGithubSource: mocks.confirm, skillGithubCandidates: mocks.candidates, selectSkillGithubCandidate: mocks.select,
  skillDraftFiles: mocks.files, submitSkillDraft: mocks.submit, createSkillDraft: vi.fn(), createSkillImport: vi.fn(), uploadSkillArchive: vi.fn() }))
vi.mock('vue-router', () => ({ useRoute: () => reactive(mocks.route), useRouter: () => ({ replace: vi.fn() }) }))
vi.mock('@/stores/user', () => ({ useUserStore: () => reactive(mocks.identity) }))
vi.mock('@/utils/auth', () => ({ getStoredUser: () => ({ userId: mocks.identity.userId }) }))
vi.mock('@/utils/apiError', () => ({ apiErrorDetails: (error: Error & { code?: string }) => ({ message: error.message, code: error.code, cancelled: false }) }))
const renderer = createRenderer<object, object>({ createElement: () => ({}), createText: () => ({}), createComment: () => ({}),
  setText() {}, setElementText() {}, parentNode: () => null, nextSibling: () => null, patchProp() {}, insert() {}, remove() {} })
let app: App | undefined
let state: ReturnType<typeof useSkillPublication>
const source = { schemaVersion: 1, type: 'GITHUB' as const, repositoryUrl: 'https://github.com/owner/repo', repositoryId: '99',
  requestedRef: 'main', resolvedRefType: 'BRANCH', commitSha: 'a'.repeat(40), directory: 'skills' }
const metadata: SkillMetadata = { name: '测试', summary: '说明', categoryId: 'development', tags: [], version: '1.0.0',
  releaseNotes: '首版', license: 'MIT', originalAuthor: '本人', sourceUrl: '', compatibility: 'Agent Skills', dependencies: '无',
  distributionAuthorized: false, declarationsConfirmed: false }
function draft(revision = 2, status = 'EDITING'): SkillDraft {
  return { draftId: '30', skillId: '20', slug: 'one', revision, status, jobId: '50', metadata: { ...metadata },
    packageName: null, packageDescription: null, skillMarkdown: null, archiveBytes: null, fileCount: null, updatedAt: '' }
}
function task(status: string, revision = 2): SkillImportTask {
  return { jobId: '50', draftId: '30', status, draftRevision: revision, errorCode: null, reason: null, attempts: 1, updatedAt: '',
    sourceType: 'GITHUB', phase: status === 'WAITING_SELECTION' ? 'SELECT' : 'RESOLVE', source,
    sourceOptions: [{ sourceOptionId: 'option', source, treeSha: 'b'.repeat(40) }], scanDigest: 'c'.repeat(64),
    requestedSource: { repositoryUrl: 'https://github.com/owner/repo', refType: 'BRANCH', ref: 'main', directory: 'skills' } }
}
const candidates: SkillGithubCandidates = { page: 1, size: 20, total: 2, scanDigest: 'c'.repeat(64), items: [
  { candidateId: 'one', directory: 'skills/one', packageName: 'one', packageDescription: '说明', fileCount: 1, unpackedBytes: 10, selectable: true, issues: [] },
  { candidateId: 'two', directory: 'skills/two', packageName: null, packageDescription: null, fileCount: 1, unpackedBytes: 10, selectable: false,
    issues: [{ code: 'INVALID_SKILL_MARKDOWN', path: 'skills/two/SKILL.md', line: null, message: '声明错误' }] },
] }
async function settle() { for (let index = 0; index < 20; index++) { await Promise.resolve(); await nextTick() } }
function mount() {
  app = renderer.createApp(defineComponent({ setup() { state = useSkillPublication(); return () => null } }))
  app.mount({})
}
it('retries a terminal source with its fixed full commit and selected directory', async () => {
  const failed = task('FAILED')
  failed.source = { ...source, directory: 'skills/one' }
  mocks.status.mockResolvedValue(failed)
  mocks.createGithub.mockResolvedValue(task('WAITING_CONFIRMATION', 3))
  mount(); await settle()
  await state.retryFixedGithub(); await settle()
  expect(mocks.createGithub).toHaveBeenCalledWith('30', 2, {
    repositoryUrl: source.repositoryUrl, refType: 'COMMIT', ref: source.commitSha, directory: 'skills/one',
  }, expect.any(String), expect.any(AbortSignal))
})
it('distinguishes saved import progress from unsaved publication edits and clears dirty state after save', async () => {
  mount(); await settle()
  expect(state.waiting.value).toBe(true)
  expect(state.hasUnsavedChanges.value).toBe(false)
  state.form.summary = '尚未保存的说明'
  expect(state.hasUnsavedChanges.value).toBe(true)
  mocks.save.mockImplementation((_id: string, _revision: number, value: SkillMetadata) =>
    Promise.resolve({ ...draft(3), metadata: { ...value } }))
  await state.save(); await settle()
  expect(state.hasUnsavedChanges.value).toBe(false)
})
beforeEach(() => {
  vi.resetAllMocks()
  Object.assign(reactive(mocks.identity), { token: 'account-a', userId: '1', isLoggedIn: true })
  reactive(mocks.route).params.draftId = '30'
  const values = new Map<string, string>()
  vi.stubGlobal('sessionStorage', { getItem: (key: string) => values.get(key) || null,
    setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) })
  mocks.options.mockResolvedValue({ categories: [], tags: [], maxArchiveBytes: 20 * 1024 * 1024, maxUnpackedBytes: 50 * 1024 * 1024, maxFiles: 500 })
  mocks.get.mockResolvedValue(draft())
  mocks.status.mockResolvedValue(task('WAITING_CONFIRMATION'))
  mocks.candidates.mockResolvedValue(candidates)
  mocks.files.mockResolvedValue({ page: 1, size: 50, total: 1, artifactId: '40', contentSha256: 'hash', items: [{ relativePath: 'SKILL.md', sizeBytes: 10, sha256: 'x' }] })
})
afterEach(() => { app?.unmount(); app = undefined; vi.unstubAllGlobals() })

it('刷新恢复来源确认，明确选目录后预览同一制品并重新勾选才能发布', async () => {
  let currentDraft = draft(); let currentTask = task('WAITING_CONFIRMATION')
  mocks.get.mockImplementation(() => Promise.resolve(currentDraft)); mocks.status.mockImplementation(() => Promise.resolve(currentTask))
  mocks.confirm.mockImplementation(() => {
    currentDraft = draft(4); currentTask = task('WAITING_SELECTION', 4)
    return Promise.resolve(task('QUEUED', 3))
  })
  mocks.select.mockImplementation(() => {
    currentDraft = { ...draft(6, 'READY'), artifactId: '40', contentSha256: 'hash', source: { ...source, directory: 'skills/one' },
      packageName: 'one', skillMarkdown: '# preview', archiveBytes: 100, fileCount: 1 }
    currentTask = task('SUCCEEDED', 6)
    return Promise.resolve(task('QUEUED', 5))
  })
  mocks.save.mockImplementation((_id: string, revision: number, value: SkillMetadata) => {
    currentDraft = { ...currentDraft, revision: revision + 1, metadata: { ...value } }; return Promise.resolve(currentDraft)
  })
  mocks.submit.mockImplementation(() => {
    currentDraft = { ...currentDraft, status: 'SUBMITTED', revision: 8 }
    return Promise.resolve({ skillId: '20', submissionId: '60', versionId: '70', approvalId: '80', publicationStatus: 'PUBLISHED' })
  })
  mount(); await settle()
  expect(state.sourceType.value).toBe('GITHUB'); expect(state.waiting.value).toBe(true)
  expect(state.task.value?.sourceOptions?.[0]?.source.commitSha).toBe('a'.repeat(40))
  await state.confirmSource('option'); await settle()
  expect(mocks.confirm.mock.calls[0]?.slice(0, 3)).toEqual(['50', 2, 'option'])
  expect(state.candidates.value?.items[1]?.selectable).toBe(false)
  await state.selectCandidate('one'); await settle()
  expect(mocks.select.mock.calls[0]?.slice(0, 4)).toEqual(['50', 4, 'c'.repeat(64), 'one'])
  expect(state.ready.value).toBe(true); expect(state.files.value?.artifactId).toBe('40')
  expect(state.form.distributionAuthorized).toBe(false)
  await state.submit(); expect(mocks.submit).not.toHaveBeenCalled()
  state.form.distributionAuthorized = true; state.form.declarationsConfirmed = true
  await state.submit()
  expect(mocks.submit.mock.calls[0]?.[1]).toBe(7); expect(state.publication.value?.versionId).toBe('70')
})

it('创建结果未知并重建页面后复用原始修订、来源和幂等键', async () => {
  let currentDraft = { ...draft(), jobId: null as string | null }
  mocks.get.mockImplementation(() => Promise.resolve(currentDraft))
  mocks.createGithub.mockImplementationOnce(() => { currentDraft = draft(3); return Promise.reject(new Error('response lost')) })
    .mockResolvedValue(task('WAITING_CONFIRMATION', 3))
  mount(); await settle(); await state.switchSource('GITHUB')
  state.githubInput.value.repositoryUrl = 'https://github.com/owner/repo'
  await state.startGithub()
  const original = mocks.createGithub.mock.calls[0]!.slice(0, 4)
  expect(state.githubIntent.value?.intent.revision).toBe(2)
  app!.unmount(); app = undefined; mount(); await settle()
  expect(state.draft.value?.revision).toBe(3)
  await state.retryGithubIntent(); await settle()
  expect(mocks.createGithub.mock.calls[1]!.slice(0, 4)).toEqual(original)
  expect(state.githubIntent.value).toBeUndefined(); expect(state.task.value?.jobId).toBe('50')
})

it('旧账号候选晚到不会进入新会话，读取错误也不会覆盖新会话错误', async () => {
  let resolve!: (value: SkillGithubCandidates) => void
  mocks.status.mockResolvedValue(task('WAITING_SELECTION'))
  mocks.candidates.mockReturnValue(new Promise<SkillGithubCandidates>(accept => { resolve = accept }))
  mount(); await settle()
  mocks.get.mockRejectedValue(new Error('new account cannot access'))
  Object.assign(reactive(mocks.identity), { token: 'account-b', userId: '2' }); await settle()
  resolve(candidates); await settle()
  expect(state.candidates.value).toBeUndefined(); expect(state.draft.value).toBeUndefined()
  expect(state.error.value).toBe('new account cannot access')
})

it('状态读取失败后的重试真实读取任务并恢复等待选择，而不创建另一个导入', async () => {
  mocks.status.mockRejectedValueOnce(new Error('offline')).mockResolvedValue(task('WAITING_SELECTION'))
  mount(); await settle(); expect(state.error.value).toBe('offline')
  await state.refreshDraft(); await settle()
  expect(mocks.status).toHaveBeenCalledTimes(2); expect(state.candidates.value?.total).toBe(2)
  expect(mocks.createGithub).not.toHaveBeenCalled()
})

it('旧制品文件清单的迟到响应不能覆盖新的制品预览', async () => {
  let oldFiles!: (value: { artifactId: string; contentSha256: string; total: number; page: number; size: number; items: [] }) => void
  mocks.get.mockResolvedValueOnce({ ...draft(2, 'READY'), jobId: null, artifactId: '40', contentSha256: 'old' })
    .mockResolvedValue({ ...draft(5, 'READY'), jobId: null, artifactId: '41', contentSha256: 'new' })
  mocks.files.mockReturnValueOnce(new Promise(accept => { oldFiles = accept }))
    .mockResolvedValue({ artifactId: '41', contentSha256: 'new', total: 1, page: 1, size: 50, items: [] })
  mount(); await settle(); await state.refreshDraft(); await settle()
  expect(state.files.value?.artifactId).toBe('41')
  oldFiles({ artifactId: '40', contentSha256: 'old', total: 1, page: 1, size: 50, items: [] }); await settle()
  expect(state.files.value?.artifactId).toBe('41')
})
