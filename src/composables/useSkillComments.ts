import { onBeforeUnmount, reactive, ref, watch, type Ref } from 'vue'
import { Modal, message } from 'ant-design-vue'
import { useUserStore } from '@/stores/user'
import { getToken } from '@/utils/auth'
import { apiErrorDetails } from '@/utils/apiError'
import { listSkillComments, listSkillReplies, createSkillComment, reactToSkillComment, deleteSkillComment } from '@/api/skillComment'
import type { CommentPage, CommentReaction, SkillComment } from '@/types/skillComment'

interface Replies { page: number; size: number; result?: CommentPage; loading: boolean; error: string; turn: number }
interface DraftKey { fingerprint: string; key: string }
const REPLY_PAGE_SIZE = 10
export function useSkillComments(skillId: Ref<string>) {
  const user = useUserStore()
  const sort = ref<'hot' | 'new'>('hot')
  const page = ref(1)
  const size = ref(10)
  const result = ref<CommentPage>()
  const loading = ref(false)
  const error = ref('')
  const actionError = ref('')
  const rootDraft = ref('')
  const replyDraft = ref('')
  const target = ref<SkillComment>()
  const posting = ref(false)
  const replies = reactive<Record<string, Replies>>({})
  const busy = reactive(new Set<string>())
  let lifetime = new AbortController()
  let epoch = 0
  let listTurn = 0
  let rootKey: DraftKey | undefined
  let replyKey: DraftKey | undefined
  const alive = (turn: number, token: string | null) => turn === epoch && token === getToken() && !lifetime.signal.aborted
  const showFailure = (failure: unknown) => {
    const parsed = apiErrorDetails(failure)
    if (!parsed.cancelled) actionError.value = parsed.message
  }
  async function load() {
    const turn = ++listTurn, generation = epoch, token = getToken()
    loading.value = true; error.value = ''
    try {
      const value = await listSkillComments(skillId.value, sort.value, page.value, size.value, lifetime.signal)
      if (alive(generation, token) && turn === listTurn) {
        result.value = value
        for (const id of Object.keys(replies)) if (!value.items.some(item => item.commentId === id)) delete replies[id]
        if (value.total > 0 && page.value > Math.ceil(value.total / size.value)) {
          page.value = Math.ceil(value.total / size.value)
          await load()
        }
      }
    } catch (failure) {
      const parsed = apiErrorDetails(failure)
      if (alive(generation, token) && turn === listTurn && !parsed.cancelled) error.value = parsed.message
    } finally { if (alive(generation, token) && turn === listTurn) loading.value = false }
  }
  async function loadReplies(rootId: string, last = false) {
    if (!replies[rootId]) {
      replies[rootId] = { page: 1, size: REPLY_PAGE_SIZE, loading: false, error: '', turn: 0 }
    }
    // 写入后从容器取回Vue代理，确保身份检查及异步状态更新都使用同一响应式对象。
    const state = replies[rootId]!
    const generation = epoch, token = getToken(), turn = ++state.turn
    state.loading = true; state.error = ''
    if (last) {
      const root = result.value?.items.find(item => item.commentId === rootId)
      state.page = Math.max(1, Math.ceil((root?.replyCount ?? 0) / state.size))
    }
    try {
      const value = await listSkillReplies(skillId.value, rootId, state.page, state.size, lifetime.signal)
      if (alive(generation, token) && state === replies[rootId] && turn === state.turn) {
        state.result = value
        const max = Math.max(1, Math.ceil(value.total / state.size))
        if (state.page > max) { state.page = max; await loadReplies(rootId) }
      }
    } catch (failure) {
      const parsed = apiErrorDetails(failure)
      if (alive(generation, token) && state === replies[rootId] && turn === state.turn && !parsed.cancelled) state.error = parsed.message
    } finally { if (alive(generation, token) && state === replies[rootId] && turn === state.turn) state.loading = false }
  }
  function confirmDiscard(): Promise<boolean> {
    return new Promise(resolve => Modal.confirm({ title: '切换回复对象？', content: '当前回复尚未发送，切换后将清空这份回复草稿。',
      okText: '切换', cancelText: '保留草稿', onOk: () => resolve(true), onCancel: () => resolve(false) }))
  }
  async function reply(comment: SkillComment) {
    if (posting.value) return
    const generation = epoch, token = getToken()
    if (target.value?.commentId !== comment.commentId && replyDraft.value.trim()) {
      if (!(await confirmDiscard()) || !alive(generation, token)) return
      replyDraft.value = ''; replyKey = undefined
    }
    target.value = comment
  }
  function cancelReply() { if (!posting.value) { target.value = undefined; replyDraft.value = ''; replyKey = undefined } }
  function keyFor(content: string, replyTo?: string) {
    const fingerprint = JSON.stringify([skillId.value, replyTo, content])
    let current = replyTo ? replyKey : rootKey
    if (!current || current.fingerprint !== fingerprint) current = { fingerprint, key: crypto.randomUUID() }
    if (replyTo) replyKey = current
    else rootKey = current
    return current.key
  }
  async function send(isReply = false) {
    if (posting.value) return
    const content = isReply ? replyDraft.value : rootDraft.value
    const selected = isReply ? target.value : undefined
    if (!content.trim() || Array.from(content).length > 1000 || (isReply && !selected)) return
    const generation = epoch, token = getToken(), id = skillId.value
    const key = keyFor(content, selected?.commentId)
    posting.value = true; actionError.value = ''
    try {
      const receipt = await createSkillComment(id, content, selected?.commentId, key, lifetime.signal)
      if (!alive(generation, token)) return
      if (isReply) { replyDraft.value = ''; replyKey = undefined; target.value = undefined }
      else { rootDraft.value = ''; rootKey = undefined; sort.value = 'new'; page.value = 1 }
      message.success(isReply ? '回复已发送' : '评论已发送')
      await load()
      if (isReply && alive(generation, token)) await loadReplies(receipt.rootId, true)
    } catch (failure) { if (alive(generation, token)) showFailure(failure) }
    finally { if (alive(generation, token)) posting.value = false }
  }
  async function react(comment: SkillComment, reaction: CommentReaction) {
    if (busy.has(comment.commentId)) return
    const generation = epoch, token = getToken()
    busy.add(comment.commentId); actionError.value = ''
    try {
      const value = await reactToSkillComment(skillId.value, comment.commentId, reaction, lifetime.signal)
      if (!alive(generation, token)) return
      comment.myReaction = value.reaction; comment.likeCount = value.likeCount
      // 列表可能已被其他刷新替换，不能只修改请求开始时捕获的旧对象。
      const visible = [result.value?.items ?? [], ...Object.values(replies).map(state => state.result?.items ?? [])]
      for (const items of visible) for (const item of items) if (item.commentId === value.commentId) {
        item.myReaction = value.reaction; item.likeCount = value.likeCount
      }
      if (comment.commentId === comment.rootId) await load()
      else if (replies[comment.rootId]) await loadReplies(comment.rootId)
    } catch (failure) { if (alive(generation, token)) showFailure(failure) }
    finally { if (alive(generation, token)) busy.delete(comment.commentId) }
  }
  function remove(comment: SkillComment) {
    const generation = epoch, token = getToken(), id = skillId.value
    Modal.confirm({ title: '确定删除这条评论吗？',
      content: comment.commentId === comment.rootId && comment.replyCount > 0
        ? '删除后不可恢复，已有回复将保留。' : '删除后不可恢复。',
      okText: '删除', okType: 'danger', cancelText: '取消',
      async onOk() {
        if (!alive(generation, token) || busy.has(comment.commentId)) return
        busy.add(comment.commentId); actionError.value = ''
        try {
          await deleteSkillComment(id, comment.commentId, lifetime.signal)
          if (!alive(generation, token)) return
          if (target.value?.commentId === comment.commentId) cancelReply()
          await load()
          if (alive(generation, token) && replies[comment.rootId]) await loadReplies(comment.rootId)
        } catch (failure) {
          if (alive(generation, token)) showFailure(failure)
          throw failure
        } finally { if (alive(generation, token)) busy.delete(comment.commentId) }
      },
    })
  }
  function changePage(value: number) { if (!posting.value) { page.value = value; void load() } }
  function changeSize(value: number) { if (!posting.value) { size.value = value; page.value = 1; void load() } }
  function changeSort(value: 'hot' | 'new') { if (!posting.value) { sort.value = value; page.value = 1; void load() } }
  function replyPage(rootId: string, value: number) {
    const state = replies[rootId]
    if (!state || posting.value || state.loading || value === state.page || value < 1
      || value > Math.max(1, Math.ceil((state.result?.total ?? 0) / state.size))) return
    state.page = value; void loadReplies(rootId)
  }
  function collapseReplies(rootId: string) {
    if (!posting.value) delete replies[rootId]
  }
  watch([skillId, () => user.token], () => {
    lifetime.abort(); lifetime = new AbortController(); epoch++; listTurn++
    page.value = 1; sort.value = 'hot'; size.value = 10; result.value = undefined
    rootDraft.value = ''; replyDraft.value = ''; target.value = undefined
    rootKey = undefined; replyKey = undefined; posting.value = false; busy.clear(); actionError.value = ''
    for (const id of Object.keys(replies)) delete replies[id]
    void load()
  }, { immediate: true })
  onBeforeUnmount(() => { epoch++; lifetime.abort() })
  return { sort, page, size, result, loading, error, actionError, rootDraft, replyDraft, target, posting, replies, busy,
    load, loadReplies, reply, cancelReply, send, react, remove, changePage, changeSize, changeSort, replyPage, collapseReplies }
}
