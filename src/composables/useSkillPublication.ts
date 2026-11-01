import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { createSkillDraft, createSkillImport, getSkillDraft, saveSkillDraft, skillImportStatus,
  skillOptions, submitSkillDraft, uploadSkillArchive, cancelSkillImport, createSkillGithubImport,
  confirmSkillGithubSource, skillGithubCandidates, selectSkillGithubCandidate, skillDraftFiles } from '@/api/skill'
import type { SkillDraft, SkillImportTask, SkillMetadata, SkillOptions, SkillPublication } from '@/types/skill'
import type { SkillGithubInput, SkillGithubCandidates, SkillDraftFiles } from '@/types/skill'
import { apiErrorDetails } from '@/utils/apiError'
import { getStoredUser } from '@/utils/auth'
import { useUserStore } from '@/stores/user'

function emptyMetadata(): SkillMetadata {
  return { name: '', summary: '', categoryId: '', tags: [], version: '1.0.0', releaseNotes: '', license: '',
    originalAuthor: '', sourceUrl: '', compatibility: '', dependencies: '', distributionAuthorized: false, declarationsConfirmed: false }
}
const volatileKeys = new Map<string, { payload: string; key: string }>()
function storedCommand(scope: string) {
  const storageKey = `verse:skill-command:${getStoredUser()?.userId || 'me'}:${scope}`
  try { return JSON.parse(sessionStorage.getItem(storageKey) || 'null') as { payload: string; key: string } | null }
  catch { return volatileKeys.get(storageKey) }
}
function commandKey(scope: string, payload: unknown) {
  const storageKey = `verse:skill-command:${getStoredUser()?.userId || 'me'}:${scope}`
  const serialized = JSON.stringify(payload)
  const previous = storedCommand(scope)
  if (previous?.payload === serialized) return previous.key
  const command = { payload: serialized, key: crypto.randomUUID() }
  volatileKeys.set(storageKey, command)
  try { sessionStorage.setItem(storageKey, JSON.stringify(command)) } catch { /* 内存回退不影响当前页重试。 */ }
  return command.key
}

interface GithubIntent {
  operation: 'create' | 'confirm' | 'select'; draftId: string; revision: number; jobId?: string
  input?: SkillGithubInput; sourceOptionId?: string; scanDigest?: string; candidateId?: string
}

export function useSkillPublication() {
  const route = useRoute()
  const router = useRouter()
  const userStore = useUserStore()
  const options = ref<SkillOptions>()
  const draft = ref<SkillDraft>()
  const task = ref<SkillImportTask>()
  const publication = ref<SkillPublication>()
  const submitIntent = ref<{ draftId: string; revision: number; key: string }>()
  const githubIntent = ref<{ intent: GithubIntent; key: string }>()
  const sourceType = ref<'ZIP' | 'GITHUB'>('ZIP')
  const githubInput = ref<SkillGithubInput>({ repositoryUrl: '', refType: 'AUTO', ref: '', directory: '' })
  const candidates = ref<SkillGithubCandidates>()
  const candidatesLoading = ref(false)
  const files = ref<SkillDraftFiles>()
  const filesLoading = ref(false)
  const form = reactive<SkillMetadata>(emptyMetadata())
  const slug = ref('')
  const loading = ref(false)
  const busy = ref(false)
  const error = ref('')
  const notice = ref('')
  let controller = new AbortController()
  let generation = 0
  let polling = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  let candidateSequence = 0
  let fileSequence = 0
  const authorName = computed(() => userStore.user?.nickname?.trim() || userStore.user?.username || '')
  const editable = computed(() => !!draft.value && ['EDITING', 'READY'].includes(draft.value.status))
  const checking = computed(() => !!task.value && ['QUEUED', 'RUNNING', 'RETRY_WAIT', 'UPLOADING'].includes(task.value.status))
  const waiting = computed(() => !!task.value && ['WAITING_CONFIRMATION', 'WAITING_SELECTION'].includes(task.value.status))
  const sourceChanged = computed(() => !!task.value && sourceType.value !== (task.value.sourceType || 'ZIP'))
  const ready = computed(() => draft.value?.status === 'READY' && !sourceChanged.value)
  const hasUnsavedChanges = computed(() => {
    if (!editable.value || publication.value) return false
    const saved = { ...emptyMetadata(), ...draft.value?.metadata }
    return (Object.keys(form) as (keyof SkillMetadata)[])
      .some(key => JSON.stringify(form[key]) !== JSON.stringify(saved[key]))
  })

  async function loadCandidates(page = 1) {
    if (!task.value || task.value.status !== 'WAITING_SELECTION') return
    const sequence = ++candidateSequence; const turn = generation
    const jobId = task.value.jobId; const digest = task.value.scanDigest
    candidatesLoading.value = true
    try {
      const value = await skillGithubCandidates(jobId, page, controller.signal)
      if (turn === generation && sequence === candidateSequence && task.value?.jobId === jobId
        && task.value.scanDigest === digest && value.scanDigest === digest) candidates.value = value
    } catch (failure) {
      if (sequence === candidateSequence && task.value?.jobId === jobId) report(failure, turn)
    }
    finally { if (turn === generation && sequence === candidateSequence) candidatesLoading.value = false }
  }
  async function loadFiles(page = 1) {
    if (!draft.value || !ready.value || !draft.value.artifactId || !draft.value.contentSha256) return
    const sequence = ++fileSequence; const turn = generation
    const value = draft.value; filesLoading.value = true
    try {
      const result = await skillDraftFiles(value.draftId, page, controller.signal)
      if (turn === generation && sequence === fileSequence && draft.value?.draftId === value.draftId
        && result.artifactId === draft.value.artifactId && result.contentSha256 === draft.value.contentSha256
        && ready.value) files.value = result
    } catch (failure) {
      if (sequence === fileSequence && draft.value?.artifactId === value.artifactId) report(failure, turn)
    }
    finally { if (turn === generation && sequence === fileSequence) filesLoading.value = false }
  }
  function restoreSource(value: SkillImportTask) {
    sourceType.value = value.sourceType || 'ZIP'
    if (value.requestedSource) githubInput.value = { ...value.requestedSource }
  }

  function report(failure: unknown, turn: number) {
    const parsed = apiErrorDetails(failure)
    if (!parsed.cancelled && turn === generation) error.value = parsed.message
  }
  async function refreshDraft(preserveForm = true, expectedPoll?: number) {
    if (!draft.value) return
    const turn = generation
    const id = draft.value.draftId
    const value = await getSkillDraft(id, controller.signal)
    if (turn !== generation || (expectedPoll !== undefined && expectedPoll !== polling)
      || draft.value?.draftId !== id || value.revision < draft.value.revision) return
    const contentChanged = draft.value.artifactId !== value.artifactId || draft.value.jobId !== value.jobId
      || (draft.value.status === 'READY' && value.status !== 'READY')
    draft.value = value
    if (!preserveForm && value.metadata) Object.assign(form, value.metadata)
    if (contentChanged) { form.distributionAuthorized = false; form.declarationsConfirmed = false }
    if (!form.name && value.packageName) form.name = value.packageName
    if (!form.summary && value.packageDescription) form.summary = value.packageDescription.slice(0, 300)
  }
  function poll(jobId: string) {
    const turn = generation
    const pollId = ++polling
    if (timer) clearTimeout(timer)
    const tick = async () => {
      try {
        const value = await skillImportStatus(jobId, controller.signal)
        if (turn !== generation || pollId !== polling) return
        task.value = value
        restoreSource(value)
        if (['SUCCEEDED', 'FAILED', 'CANCELLED', 'WAITING_CONFIRMATION', 'WAITING_SELECTION'].includes(value.status)) {
          await refreshDraft(true, pollId)
          if (turn !== generation || pollId !== polling) return
          if (value.status === 'SUCCEEDED') notice.value = '包检查通过。请核对公开信息和声明后提交。'
          if (value.status === 'WAITING_SELECTION') await loadCandidates()
          return
        }
        timer = setTimeout(tick, 2000)
      } catch (failure) { report(failure, turn) }
    }
    void tick()
  }
  async function load() {
    controller.abort(); controller = new AbortController()
    const turn = ++generation
    polling++; if (timer) clearTimeout(timer)
    loading.value = true; busy.value = false; error.value = ''; notice.value = ''; task.value = undefined
    publication.value = undefined; draft.value = undefined; submitIntent.value = undefined; Object.assign(form, emptyMetadata())
    githubIntent.value = undefined; sourceType.value = 'ZIP'; candidates.value = undefined; files.value = undefined
    candidateSequence++; fileSequence++; candidatesLoading.value = false; filesLoading.value = false
    githubInput.value = { repositoryUrl: '', refType: 'AUTO', ref: '', directory: '' }
    slug.value = ''
    options.value = undefined
    if (!userStore.isLoggedIn) { loading.value = false; return }
    try {
      const vocabulary = await skillOptions(controller.signal)
      if (turn !== generation) return
      options.value = vocabulary
      const id = String(route.params.draftId || '')
      if (id) {
        if (!/^\d+$/.test(id)) throw new Error('草稿地址无效')
        const value = await getSkillDraft(id, controller.signal)
        if (turn !== generation) return
        draft.value = value
        sourceType.value = value.source?.type || 'ZIP'
        const githubPending = storedCommand(`github-pending:${value.draftId}`)
        if (githubPending) {
          try {
            const intent = JSON.parse(githubPending.payload) as GithubIntent
            if (intent.draftId === value.draftId && ['create', 'confirm', 'select'].includes(intent.operation)) {
              githubIntent.value = { intent, key: githubPending.key }
            }
          } catch { /* 无法解析的本地草稿不作为有效命令意图。 */ }
        }
        const pending = storedCommand(`submit:${value.draftId}`)
        if (pending && /^\d+$/.test(pending.payload)) {
          submitIntent.value = { draftId: value.draftId, revision: Number(pending.payload), key: pending.key }
        }
        if (value.metadata) Object.assign(form, value.metadata)
        else { form.name = value.packageName || ''; form.summary = value.packageDescription?.slice(0, 300) || '' }
        if (value.jobId) poll(value.jobId)
      }
    } catch (failure) { report(failure, turn) }
    finally { if (turn === generation) loading.value = false }
  }
  const current = (turn: number, signal: AbortSignal) => turn === generation && !signal.aborted
  async function action(work: (turn: number, signal: AbortSignal) => Promise<void>) {
    if (busy.value) return
    const turn = generation
    busy.value = true; error.value = ''; notice.value = ''
    try { await work(turn, controller.signal) } catch (failure) { report(failure, turn) }
    finally { if (turn === generation) busy.value = false }
  }
  async function create() {
    await action(async (turn, signal) => {
      const value = await createSkillDraft(slug.value, commandKey('create', slug.value), signal)
      if (current(turn, signal)) await router.replace(`/skills/publish/${value.draftId}`)
    })
  }
  async function upload(file: File) {
    if (!draft.value || !options.value) return
    if (!file.name.toLowerCase().endsWith('.zip') || file.size === 0 || file.size > options.value.maxArchiveBytes) {
      error.value = '请选择符合大小限制的非空 ZIP 文件'; return
    }
    await action(async (turn, signal) => {
      const value = draft.value!
      polling++; if (timer) clearTimeout(timer)
      const created = await createSkillImport(value.draftId, value.revision,
        commandKey(`import:${value.draftId}`, value.revision), signal)
      if (!current(turn, signal)) return
      task.value = created
      draft.value = { ...value, revision: created.draftRevision, status: 'EDITING', jobId: created.jobId,
        skillMarkdown: null, packageName: null, packageDescription: null, archiveBytes: null, fileCount: null }
      form.distributionAuthorized = false; form.declarationsConfirmed = false
      try {
        const result = await uploadSkillArchive(created.jobId, file, signal)
        if (current(turn, signal)) task.value = result
      } finally { if (current(turn, signal)) poll(created.jobId) }
    })
  }
  async function retryUpload(file: File) {
    if (!task.value || !['WAITING_UPLOAD', 'UPLOADING'].includes(task.value.status)) { await upload(file); return }
    await action(async (turn, signal) => {
      const jobId = task.value!.jobId
      try {
        const result = await uploadSkillArchive(jobId, file, signal)
        if (current(turn, signal)) task.value = result
      } finally { if (current(turn, signal)) poll(jobId) }
    })
  }
  async function save() {
    if (!draft.value) return
    await action(async (turn, signal) => {
      const result = await saveSkillDraft(draft.value!.draftId, draft.value!.revision, { ...form, tags: [...form.tags] }, signal)
      if (current(turn, signal)) { draft.value = result; notice.value = '草稿已保存，可以从「我的发布」继续。' }
    })
  }
  async function completeSubmission(intent: { draftId: string; revision: number; key: string }, turn: number, signal: AbortSignal) {
    try {
      const result = await submitSkillDraft(intent.draftId, intent.revision, intent.key, signal)
      if (current(turn, signal)) { publication.value = result; await refreshDraft() }
    } catch (failure) {
      // 明确的字段/许可拒绝没有发布副作用；网络中断或冲突保留原始意图，不能换键重发。
      const code = apiErrorDetails(failure).code
      if (current(turn, signal) && code && ['A001701', 'A001705', 'A001707'].includes(code)) {
        clearSubmitIntent(intent.draftId)
      } else if (current(turn, signal) && code === 'A001703') {
        // 原key已成功时后端会优先重放回执。确定的冲突需重读权威修订，不能永久锁住旧意图。
        try {
          const latest = await getSkillDraft(intent.draftId, signal)
          if (current(turn, signal)) {
            draft.value = latest
            Object.assign(form, emptyMetadata(), latest.metadata || {})
            if (['EDITING', 'READY'].includes(latest.status)) {
              form.distributionAuthorized = false; form.declarationsConfirmed = false
              notice.value = '草稿修订已刷新，请核对最新内容并重新确认声明。'
            } else if (latest.status === 'SUBMITTED') notice.value = '此草稿已完成其他提交，可查看公开页面。'
            clearSubmitIntent(intent.draftId)
          }
        } catch { /* 读取失败仍保留原意图，待恢复时重新对账，不换键盲目发布。 */ }
      }
      throw failure
    }
  }
  function clearSubmitIntent(draftId: string) {
    submitIntent.value = undefined
    const storageKey = `verse:skill-command:${getStoredUser()?.userId || 'me'}:submit:${draftId}`
    volatileKeys.delete(storageKey)
    try { sessionStorage.removeItem(storageKey) } catch { /* 内存意图已经清除。 */ }
  }
  async function submit() {
    if (!draft.value || !ready.value || githubIntent.value) return
    if (!form.license.trim() || !form.distributionAuthorized || !form.declarationsConfirmed) {
      error.value = '请填写许可证并主动确认两项授权声明'; return
    }
    await action(async (turn, signal) => {
      const value = draft.value!
      // 先保存当前完整表单，提交时冻结服务端返回的修订，不提交页面推算的修订。
      const saved = await saveSkillDraft(value.draftId, value.revision, { ...form, tags: [...form.tags] }, signal)
      if (!current(turn, signal)) return
      draft.value = saved
      const key = commandKey(`submit:${saved.draftId}`, saved.revision)
      submitIntent.value = { draftId: saved.draftId, revision: saved.revision, key }
      await completeSubmission(submitIntent.value, turn, signal)
    })
  }
  async function retrySubmission() {
    if (!draft.value) return
    await action(async (turn, signal) => {
      const intent = submitIntent.value
      if (!intent) return
      await completeSubmission(intent, turn, signal)
    })
  }
  async function cancel() {
    if (!task.value) return
    await action(async (turn, signal) => {
      const jobId = task.value!.jobId
      await cancelSkillImport(jobId, signal)
      if (current(turn, signal)) poll(jobId)
    })
  }
  function clearGithubIntent(draftId: string) {
    githubIntent.value = undefined
    const storageKey = `verse:skill-command:${getStoredUser()?.userId || 'me'}:github-pending:${draftId}`
    volatileKeys.delete(storageKey)
    try { sessionStorage.removeItem(storageKey) } catch { /* 当前内存意图已清除。 */ }
  }
  async function runGithub(intent: GithubIntent, key: string, turn: number, signal: AbortSignal) {
    try {
      let result: SkillImportTask
      if (intent.operation === 'create') result = await createSkillGithubImport(intent.draftId, intent.revision, intent.input!, key, signal)
      else if (intent.operation === 'confirm') result = await confirmSkillGithubSource(intent.jobId!, intent.revision, intent.sourceOptionId!, key, signal)
      else result = await selectSkillGithubCandidate(intent.jobId!, intent.revision, intent.scanDigest!, intent.candidateId!, key, signal)
      if (!current(turn, signal)) return
      clearGithubIntent(intent.draftId)
      polling++; if (timer) clearTimeout(timer)
      task.value = result; sourceType.value = 'GITHUB'; candidates.value = undefined; files.value = undefined
      candidateSequence++; fileSequence++
      if (draft.value?.draftId === intent.draftId) {
        draft.value = { ...draft.value, revision: result.draftRevision, jobId: result.jobId, status: 'EDITING',
          artifactId: null, contentSha256: null, source: null, skillMarkdown: null, packageName: null,
          packageDescription: null, archiveBytes: null, fileCount: null }
      }
      form.distributionAuthorized = false; form.declarationsConfirmed = false
      await refreshDraft(true)
      if (current(turn, signal)) poll(result.jobId)
    } catch (failure) {
      const code = apiErrorDetails(failure).code
      if (current(turn, signal) && code && ['A001701', 'A001702', 'A001703', 'A001704', 'A001706', 'A001709'].includes(code)) {
        clearGithubIntent(intent.draftId)
        try {
          await refreshDraft(true)
          if (current(turn, signal) && draft.value?.jobId) poll(draft.value.jobId)
        } catch { /* 保留原可见状态，用户可再次读取。 */ }
      }
      throw failure
    }
  }
  async function githubCommand(intent: GithubIntent) {
    if (githubIntent.value || submitIntent.value) return
    await action(async (turn, signal) => {
      const key = commandKey(`github-pending:${intent.draftId}`, intent)
      githubIntent.value = { intent, key }
      await runGithub(intent, key, turn, signal)
    })
  }
  async function startGithub(fixed = false) {
    if (!draft.value || checking.value || waiting.value) return
    const source = task.value?.source
    const ref = fixed && source?.commitSha ? source.commitSha : githubInput.value.ref?.trim() || null
    const input: SkillGithubInput = fixed && source?.commitSha
      ? { repositoryUrl: source.repositoryUrl!, refType: 'COMMIT', ref, directory: source.directory || '' }
      : { repositoryUrl: githubInput.value.repositoryUrl.trim(), ref,
        refType: ref ? githubInput.value.refType === 'DEFAULT' ? 'AUTO' : githubInput.value.refType : 'DEFAULT',
        directory: githubInput.value.directory?.trim() || '' }
    if (!input.repositoryUrl.startsWith('https://github.com/')) { error.value = '请输入公开 GitHub HTTPS 地址'; return }
    await githubCommand({ operation: 'create', draftId: draft.value.draftId, revision: draft.value.revision, input })
  }
  async function confirmSource(sourceOptionId: string) {
    if (!draft.value || !task.value || task.value.status !== 'WAITING_CONFIRMATION') return
    await githubCommand({ operation: 'confirm', draftId: draft.value.draftId, revision: draft.value.revision,
      jobId: task.value.jobId, sourceOptionId })
  }
  async function selectCandidate(candidateId: string) {
    if (!draft.value || !task.value?.scanDigest || task.value.status !== 'WAITING_SELECTION') return
    await githubCommand({ operation: 'select', draftId: draft.value.draftId, revision: draft.value.revision,
      jobId: task.value.jobId, scanDigest: task.value.scanDigest, candidateId })
  }
  async function retryGithubIntent() {
    const pending = githubIntent.value
    if (!pending) return
    await action((turn, signal) => runGithub(pending.intent, pending.key, turn, signal))
  }
  async function switchSource(value: 'ZIP' | 'GITHUB') {
    if (busy.value || githubIntent.value || submitIntent.value) return
    if (checking.value || waiting.value) await cancel()
    if (error.value) return
    polling++; if (timer) clearTimeout(timer)
    candidateSequence++; fileSequence++; candidates.value = undefined; files.value = undefined
    sourceType.value = value; form.distributionAuthorized = false; form.declarationsConfirmed = false
  }
  async function refresh() {
    await action(async (turn, signal) => {
      await refreshDraft(true)
      if (current(turn, signal) && draft.value?.jobId) poll(draft.value.jobId)
    })
  }
  watch(() => [draft.value?.artifactId, draft.value?.contentSha256, ready.value], () => {
    fileSequence++; files.value = undefined
    if (ready.value) void loadFiles()
  })
  watch(() => [route.params.draftId, userStore.token], load, { immediate: true })
  onBeforeUnmount(() => { generation++; polling++; controller.abort(); if (timer) clearTimeout(timer) })
  return { authorName, options, draft, task, publication, submitIntent, form, slug, loading, busy, error, notice,
    editable, checking, waiting, ready, hasUnsavedChanges, sourceChanged, sourceType, githubInput, githubIntent, candidates, candidatesLoading,
    files, filesLoading, load, create, retryUpload, save, submit, retrySubmission, cancel, switchSource,
    startGithub: () => startGithub(), retryFixedGithub: () => startGithub(true), confirmSource, selectCandidate,
    loadCandidates, loadFiles, retryGithubIntent, refreshDraft: refresh }
}
