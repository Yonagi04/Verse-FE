import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { favoriteFolders, favoriteStatuses, favoriteCommand } from '@/api/skillFavorite'
import { apiErrorDetails } from '@/utils/apiError'
import { getToken } from '@/utils/auth'
import type { FavoriteAction, FavoriteFolders, FavoriteFolder, FavoriteStatus, FavoriteReceipt, FolderReceipt, FavoriteItem } from '@/types/skillFavorite'

type Dialog = { type: 'create' | 'move'; skillId: string; name: string; favoriteId?: string; folderId: string }
  | { type: 'createFolder' } | { type: 'renameFolder' | 'deleteFolder'; folder: FavoriteFolder }
interface Pending { action: FavoriteAction; key: string }
interface Undo { favoriteId: string; key: string }

// 只保存本次会话。所有命令在回执到达后再更新状态，结果未知时保留原载荷和 UUID。
export const useSkillFavoriteStore = defineStore('skillFavorite', () => {
  const folders = ref<FavoriteFolders>()
  const statuses = ref<Record<string, FavoriteStatus>>({})
  const dialog = ref<Dialog>()
  const selectedFolder = ref('0')
  const pending = ref<Pending>()
  const busy = ref(false)
  const uncertain = ref(false)
  const actionError = ref('')
  const folderError = ref(''), statusError = ref('')
  const readError = computed(() => folderError.value || statusError.value)
  const notice = ref('')
  const noticeType = ref<'success' | 'warning' | 'info'>('success')
  const revision = ref(0)
  const deletedFolder = ref<string>()
  const undo = ref<Undo>()
  const locked = computed(() => busy.value || uncertain.value)
  let lifetime = new AbortController()
  let epoch = 0, folderTurn = 0, statusTurn = 0
  let undoTimer: ReturnType<typeof setTimeout> | undefined
  let activeIds: string[] = []
  const alive = (generation: number, token: string | null) => generation === epoch && !!token && token === getToken() && !lifetime.signal.aborted

  function reset() {
    epoch++; folderTurn++; statusTurn++; lifetime.abort(); lifetime = new AbortController()
    clearTimeout(undoTimer); undo.value = undefined; folders.value = undefined; statuses.value = {}; activeIds = []
    dialog.value = undefined; pending.value = undefined; busy.value = false; uncertain.value = false
    actionError.value = ''; folderError.value = ''; statusError.value = ''; notice.value = ''; noticeType.value = 'success'; deletedFolder.value = undefined; revision.value++
  }
  async function loadFolders() {
    const generation = epoch, token = getToken(), turn = ++folderTurn
    const current = () => alive(generation, token) && turn === folderTurn
    try {
      const value = await favoriteFolders(lifetime.signal)
      if (!current()) return
      folders.value = value; folderError.value = ''
      return true
    } catch (failure) {
      if (!current() || apiErrorDetails(failure).cancelled) return
      folderError.value = '收藏夹暂时无法加载，请重试'
      return false
    }
  }
  async function loadStatuses(ids: string[]) {
    activeIds = [...new Set(ids)].slice(0, 24)
    const requested = [...activeIds], generation = epoch, token = getToken(), turn = ++statusTurn
    const current = () => alive(generation, token) && turn === statusTurn
    if (!requested.length) { statuses.value = {}; statusError.value = ''; return true }
    try {
      const value = await favoriteStatuses(requested, lifetime.signal)
      if (!current()) return
      statuses.value = Object.fromEntries(value.map(item => [item.skillId, item])); statusError.value = ''
      return true
    } catch (failure) {
      if (!current() || apiErrorDetails(failure).cancelled) return
      statusError.value = '收藏状态暂时无法加载，请重试'
      return false
    }
  }
  function openSelection(skillId: string, name: string, move = false) {
    if (locked.value) return
    const status = statuses.value[skillId]
    if (move && !status?.favoriteId) return
    selectedFolder.value = move ? status!.folderId! : '0'
    dialog.value = { type: move ? 'move' : 'create', skillId, name, favoriteId: status?.favoriteId || undefined, folderId: status?.folderId || '0' }
    actionError.value = ''; notice.value = ''; void loadFolders()
  }
  function manage(type: 'createFolder' | 'renameFolder' | 'deleteFolder', folder?: FavoriteFolder) {
    if (locked.value || (type !== 'createFolder' && (!folder || folder.defaultFolder))) return
    dialog.value = type === 'createFolder' ? { type } : { type, folder: folder! }
    actionError.value = ''; notice.value = ''
  }
  function close() { if (!locked.value) { dialog.value = undefined; actionError.value = '' } }
  function observeItems(items: FavoriteItem[]) {
    statusTurn++
    statusError.value = ''
    activeIds = items.map(item => item.skillId)
    statuses.value = Object.fromEntries(items.map(item => [item.skillId, { skillId: item.skillId,
      favoriteId: item.favoriteId, folderId: item.folderId, folderName: item.folderName, savedAt: item.savedAt }]))
  }

  async function submit(action: FavoriteAction, key: string = crypto.randomUUID()) {
    if (locked.value || !getToken()) return
    pending.value = { action: structuredClone(action), key }
    await execute()
  }
  async function retry() { if (!busy.value && pending.value) await execute() }
  async function execute() {
    if (!pending.value || busy.value) return
    const command = pending.value, generation = epoch, token = getToken()
    busy.value = true; actionError.value = ''; uncertain.value = false; notice.value = ''; noticeType.value = 'success'
    try {
      const receipt = await favoriteCommand(command.action, command.key, lifetime.signal)
      if (!alive(generation, token)) return
      clearTimeout(undoTimer); undo.value = undefined
      pending.value = undefined; folderTurn++; statusTurn++; revision.value++
      const action = command.action
      if ('outcome' in receipt) applyFavorite(receipt, command)
      else applyFolder(receipt, action)
      const results = await Promise.all([loadFolders(), loadStatuses(activeIds)])
      // 被新请求或列表快照替代的读取不代表失败，只提示仍有效请求的真实错误。
      if (alive(generation, token) && results.some(result => result === false) && readError.value) {
        noticeType.value = 'warning'
        notice.value = '操作已保存，但收藏信息刷新失败，请刷新页面'
      }
    } catch (failure) {
      if (!alive(generation, token)) return
      const parsed = apiErrorDetails(failure)
      // 5xx 可能来自提交后的响应链路，保守保留原命令；不能换 key 猜测重做。
      const httpStatus = (failure as { response?: { status?: number }; httpStatus?: number }).response?.status
        ?? (failure as { httpStatus?: number }).httpStatus
      uncertain.value = parsed.uncertain || (httpStatus != null && httpStatus >= 500)
      if (uncertain.value) actionError.value = '结果待确认。请重新读取，或使用原请求重试确认。'
      else {
        pending.value = undefined
        actionError.value = parsed.message
        if (parsed.code === 'A001702') {
          await loadFolders()
          if (command.action.type === 'move') selectedFolder.value = ''
          await loadStatuses(activeIds)
          if (command.action.type === 'create') { revision.value++; actionError.value = '此 Skill 或目标收藏夹已不可用，请刷新后重试' }
        }
      }
    } finally { if (alive(generation, token)) busy.value = false }
  }
  function applyFavorite(receipt: FavoriteReceipt, command: Pending) {
    dialog.value = undefined
    if (receipt.skillId) {
      if (!activeIds.includes(receipt.skillId)) activeIds = [receipt.skillId, ...activeIds].slice(0, 24)
      statuses.value[receipt.skillId] = { skillId: receipt.skillId, favoriteId: receipt.removed ? null : receipt.favoriteId,
        folderId: receipt.removed ? null : receipt.folderId, folderName: folders.value?.folders.find(item => item.folderId === receipt.folderId)?.name || null,
        savedAt: receipt.removed ? null : receipt.savedAt }
    }
    if (command.action.type === 'cancel' && receipt.removed) {
      clearTimeout(undoTimer)
      undo.value = { favoriteId: receipt.favoriteId, key: command.key }
      undoTimer = setTimeout(() => { undo.value = undefined }, 5000)
      notice.value = '已取消收藏'
    } else if (command.action.type === 'restore') {
      undo.value = undefined
      notice.value = receipt.outcome === 'EXISTING' ? '已保留当前的新收藏' : receipt.fallbackToDefault ? '已恢复至默认收藏夹' : '已恢复收藏'
    } else notice.value = receipt.outcome === 'EXISTING' ? '已收藏，保留原收藏夹' : command.action.type === 'move' ? '已移动收藏' : receipt.outcome === 'ABSENT' ? '此收藏已取消' : '已收藏 Skill'
  }
  function applyFolder(receipt: FolderReceipt, action: FavoriteAction) {
    if (action.type === 'createFolder' && dialog.value && ['create', 'move'].includes(dialog.value.type)) {
      selectedFolder.value = receipt.folderId
    } else dialog.value = undefined
    if (action.type === 'deleteFolder') deletedFolder.value = receipt.folderId
    notice.value = action.type === 'deleteFolder' ? (receipt.migrated > 0 ? `收藏夹已删除，${receipt.migrated} 项收藏已移入默认收藏夹` : '收藏夹已删除')
      : action.type === 'renameFolder' ? '收藏夹已重命名' : '收藏夹已创建'
  }
  async function restore() {
    const value = undo.value
    if (value && !locked.value) await submit({ type: 'restore', favoriteId: value.favoriteId }, value.key)
  }
  return { folders, statuses, dialog, selectedFolder, busy, uncertain, pending, locked, actionError, readError, notice, noticeType,
    revision, deletedFolder, undo, reset, loadFolders, loadStatuses, observeItems, openSelection, manage, close, submit, retry, restore }
})
