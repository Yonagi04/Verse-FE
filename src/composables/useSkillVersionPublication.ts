import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { getStoredUser } from '@/utils/auth'
import { apiErrorDetails } from '@/utils/apiError'
import { getWorkspace, openWorkspace, saveWorkspace, importWorkspaceGithub, publicationPreview, publishVersion, publicationResult } from '@/api/skillVersion'
import { abandonSkillDraft, cancelSkillImport, createSkillImport, uploadSkillArchive, skillImportStatus } from '@/api/skill'
import type { SkillImportTask } from '@/types/skill'
import type { SkillWorkspace, WorkspaceMode, VersionPreview, VersionType, VersionPublishInput, VersionReceipt } from '@/types/skillVersion'

interface PublishIntent { key: string; input: VersionPublishInput }
const volatile = new Map<string, PublishIntent>()
/** 老接口修订仍为number，跨边界前拒绝不安全转换。 */
export function legacySkillRevision(revision: string): number {
  const value = Number(revision)
  if (!/^\d+$/.test(revision) || !Number.isSafeInteger(value) || value < 0) throw new Error('修订号超出兼容接口范围，请联系管理员')
  return value
}

export function useSkillVersionPublication() {
  const route = useRoute(), user = useUserStore()
  const workspace = ref<SkillWorkspace>(), task = ref<SkillImportTask>(), preview = ref<VersionPreview>(), receipt = ref<VersionReceipt>()
  const notes = ref(''), error = ref(''), notice = ref(''), loading = ref(false), busy = ref(false), intent = ref<PublishIntent>()
  const type = ref<VersionType>('RELEASE')
  let controller = new AbortController(), generation = 0, timer: ReturnType<typeof setTimeout> | undefined
  const skillId = computed(() => String(route.params.skillId))
  const active = computed(() => !!workspace.value && ['EDITING', 'READY'].includes(workspace.value.status))
  const checking = computed(() => !!task.value && !['SUCCEEDED', 'FAILED', 'CANCELLED'].includes(task.value.status))
  const editable = computed(() => workspace.value?.skillStatus === 'ACTIVE' && active.value && !intent.value && !busy.value && !receipt.value)
  const ready = computed(() => editable.value && workspace.value?.status === 'READY' && !checking.value && !!workspace.value.artifactId)
  const hasUnsavedChanges = computed(() => active.value && notes.value !== (workspace.value?.releaseNotes || '') && !receipt.value)
  let scope = ''
  const current = (turn: number) => turn === generation && !controller.signal.aborted
  function saveIntent(value?: PublishIntent) {
    intent.value = value
    if (!scope) throw new Error('账号资料尚未恢复，请刷新')
    if (value) volatile.set(scope, value); else volatile.delete(scope)
    try { if (value) sessionStorage.setItem(scope, JSON.stringify(value)); else sessionStorage.removeItem(scope) }
    catch { /* 同页内存回执继续保护原始意图。 */ }
  }
  function restoreIntent(): PublishIntent | undefined {
    try {
      const value = JSON.parse(sessionStorage.getItem(scope) || 'null') as PublishIntent | null
      if (value?.key && value.input?.confirmationDigest && ['DRAFT', 'RELEASE'].includes(value.input.type)) return value
    } catch { /* 使用账号作用域内存回退。 */ }
    return volatile.get(scope)
  }
  async function refresh(turn: number, replaceNotes = false) {
    const value = await getWorkspace(skillId.value, controller.signal)
    if (current(turn)) { workspace.value = value; if (replaceNotes) notes.value = value.releaseNotes || '' }
    return value
  }
  async function action(work: (turn: number, signal: AbortSignal) => Promise<void>) {
    if (busy.value) return
    const turn = generation; busy.value = true; error.value = ''; notice.value = ''
    try { await work(turn, controller.signal) }
    catch (failure) { const parsed = apiErrorDetails(failure); if (current(turn) && !parsed.cancelled) error.value = parsed.message }
    finally { if (current(turn)) busy.value = false }
  }
  function poll(jobId: string, turn: number) {
    clearTimeout(timer)
    timer = setTimeout(async () => {
      if (!current(turn)) return
      try {
        const value = await skillImportStatus(jobId, controller.signal)
        if (!current(turn)) return
        task.value = value
        if (['SUCCEEDED', 'FAILED', 'CANCELLED'].includes(value.status)) {
          await refresh(turn)
          if (current(turn) && value.status === 'FAILED') error.value = value.reason || '文件准备失败，请重试'
        } else poll(jobId, turn)
      } catch (failure) { const parsed = apiErrorDetails(failure); if (current(turn) && !parsed.cancelled) error.value = parsed.message }
    }, 1500)
  }
  async function load() {
    generation++; controller.abort(); controller = new AbortController(); clearTimeout(timer)
    const turn = generation
    workspace.value = undefined; task.value = undefined; preview.value = undefined; receipt.value = undefined
    notes.value = ''; error.value = ''; notice.value = ''; intent.value = undefined; busy.value = false; loading.value = true
    const account = getStoredUser()?.userId
    scope = account ? `verse:skill-version:${account}:${skillId.value}` : ''
    if (!scope) { error.value = '账号资料尚未恢复，请刷新'; loading.value = false; return }
    intent.value = restoreIntent()
    try {
      const value = await refresh(turn, true)
      if (!current(turn)) return
      if (intent.value) notice.value = '正在确认发布结果，请恢复原操作后再继续。'
      else if (value.jobId && active.value) {
        const status = await skillImportStatus(value.jobId, controller.signal)
        if (!current(turn)) return
        task.value = status
        if (!['SUCCEEDED', 'FAILED', 'CANCELLED'].includes(status.status)) poll(value.jobId, turn)
      }
    } catch (failure) { const parsed = apiErrorDetails(failure); if (current(turn) && !parsed.cancelled) error.value = parsed.message }
    finally { if (current(turn)) loading.value = false }
  }
  async function open(mode: WorkspaceMode) {
    if (!workspace.value || intent.value || active.value) return
    await action(async (turn, signal) => {
      const value = await openWorkspace(skillId.value, mode, workspace.value!.skillRevision, crypto.randomUUID(), signal)
      if (current(turn)) { workspace.value = value; notes.value = value.releaseNotes || ''; task.value = undefined; preview.value = undefined }
    })
  }
  async function abandon() {
    if (!workspace.value || intent.value) return
    await action(async (turn, signal) => {
      await abandonSkillDraft(workspace.value!.draftId, legacySkillRevision(workspace.value!.revision), signal)
      if (current(turn)) { clearTimeout(timer); task.value = undefined; preview.value = undefined; await refresh(turn, true) }
    })
  }
  async function prepare(file?: File) {
    if (!editable.value || workspace.value?.sourceVersionId) return
    await action(async (turn, signal) => {
      const value = workspace.value!
      if (value.creationSource?.type === 'ZIP' && (!file || file.size > 20 * 1024 * 1024 || file.size === 0 || !file.name.toLowerCase().endsWith('.zip'))) throw new Error('请选择不超过 20 MiB 的完整 ZIP 包')
      preview.value = undefined
      if (checking.value && task.value) await cancelSkillImport(task.value.jobId, signal)
      if (!current(turn)) return
      const job = value.creationSource?.type === 'GITHUB'
        ? await importWorkspaceGithub(skillId.value, value.revision, crypto.randomUUID(), signal)
        : await createSkillImport(value.draftId, legacySkillRevision(value.revision), crypto.randomUUID(), signal)
      if (!current(turn)) return
      task.value = job; await refresh(turn)
      if (!current(turn)) return
      if (value.creationSource?.type === 'ZIP') {
        const uploaded = await uploadSkillArchive(job.jobId, file!, signal)
        if (!current(turn)) return
        task.value = uploaded
      }
      poll(job.jobId, turn)
    })
  }
  async function save() {
    if (!editable.value || !notes.value.trim()) return
    await action(async (turn, signal) => {
      const value = await saveWorkspace(skillId.value, workspace.value!.revision, notes.value, signal)
      if (current(turn)) { workspace.value = value; preview.value = undefined; notice.value = '待发布内容已保存，尚未产生版本节点。' }
    })
  }
  async function confirm(target: VersionType) {
    if (!ready.value || !notes.value.trim() || notes.value.length > 2000) { error.value = '请完成文件校验并填写本次更新说明（最多 2000 字符）'; return }
    if (target === 'DRAFT' && workspace.value?.sourceVersionId) return
    await action(async (turn, signal) => {
      const saved = await saveWorkspace(skillId.value, workspace.value!.revision, notes.value, signal)
      if (!current(turn)) return
      workspace.value = saved; type.value = target
      const value = await publicationPreview(skillId.value, target, signal)
      if (current(turn)) preview.value = value
    })
  }
  async function commit(turn: number, signal: AbortSignal, original: PublishIntent) {
    try {
      const result = await publishVersion(skillId.value, original.input, original.key, signal)
      if (current(turn)) { receipt.value = result; preview.value = undefined; saveIntent(); await refresh(turn, true) }
    } catch (failure) {
      const parsed = apiErrorDetails(failure)
      // 明确拒绝可重新核对；503/中断仍保持原始发布意图，不能换键。
      if (current(turn) && parsed.code && ['A001701', 'A001703', 'A001705', 'A001706', 'A001707'].includes(parsed.code)) {
        saveIntent(); preview.value = undefined; await refresh(turn, true)
      }
      throw failure
    }
  }
  async function publish() {
    if (!preview.value || intent.value || busy.value) return
    const value = preview.value
    const original = { key: crypto.randomUUID(), input: { workspaceRevision: value.workspaceRevision,
      expectedSkillRevision: value.expectedSkillRevision, type: value.type, confirmationDigest: value.confirmationDigest } }
    saveIntent(original)
    await action((turn, signal) => commit(turn, signal, original))
  }
  async function recover() {
    const original = intent.value
    if (!original) return
    await action(async (turn, signal) => {
      const result = await publicationResult(skillId.value, original.key, signal)
      if (!current(turn)) return
      if (result.status === 'COMMITTED' && result.receipt) { receipt.value = result.receipt; preview.value = undefined; saveIntent(); await refresh(turn, true) }
      else await commit(turn, signal, original)
    })
  }
  watch([() => route.params.skillId, () => user.token], load, { immediate: true })
  onBeforeUnmount(() => { generation++; controller.abort(); clearTimeout(timer) })
  return { workspace, task, preview, receipt, notes, error, notice, loading, busy, intent, type, skillId,
    active, checking, editable, ready, hasUnsavedChanges, load, open, abandon, prepare, save, confirm, publish, recover }
}
