import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { Modal } from 'ant-design-vue'
import Decimal from 'decimal.js'
import { useTenantStore } from '@/stores/tenant'
import { useUserStore } from '@/stores/user'
import { usePlaygroundStore } from '@/stores/playground'
import { getPlaygroundPrompts, listPlaygroundSessions } from '@/api/playground'
import * as api from '@/api/playgroundWorkbench'
import type { PlaygroundPrompt, PlaygroundSession } from '@/types/playground'
import type { Attempt, RunConfig, Lane, WorkbenchConfig, WorkbenchResource, WorkbenchModel, ChatRequest } from '@/types/playgroundWorkbench'

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value))
const isActive = (a: Attempt) => ['PENDING', 'STREAMING', 'STOPPING'].includes(a.status)
const editable = (p: WorkbenchConfig): WorkbenchConfig => ({ lanes: clone(p.lanes), synced: p.synced, presetId: p.presetId, presetVersion: p.presetVersion })

/** 页面状态和独立流生命周期；身份与视图版本阻止旧响应写入新租户。 */
export function useWorkbench() {
  const tenantStore = useTenantStore(), userStore = useUserStore(), gate = usePlaygroundStore()
  const tenant = computed(() => tenantStore.currentTenantId)
  const models = ref<WorkbenchModel[]>([]), groups = ref<WorkbenchResource[]>([]), presets = ref<WorkbenchResource[]>([])
  const legacy = ref<PlaygroundSession[]>([]), examples = ref<PlaygroundPrompt[]>([])
  const active = ref<WorkbenchResource | null>(null), config = ref<WorkbenchConfig>({ lanes: [], synced: true })
  const prompt = ref(''), loading = ref(false), working = ref(false), streamError = ref('')
  const selectedAttempts = ref<Record<string, string>>({})
  let revision = 0, view = 0, pollTimer: ReturnType<typeof setTimeout> | undefined
  let listRevision = 0, listKeyword = ''
  const controllers = new Map<string, AbortController>()
  let pendingRound: { groupId: string; prompt: string; key: string } | null = null
  const retryKeys = new Map<string, string>()
  const enabled = computed(() => !!gate.status?.enabled)
  const attempts = computed(() => active.value?.attempts || [])
  const busy = computed(() => working.value || !!active.value?.generating || attempts.value.some(isActive))
  const modelFor = (id: string) => models.value.find(m => m.serviceId === id)
  const lane = (model?: string): Lane => ({ laneId: crypto.randomUUID(), serviceId: model || models.value[0]?.serviceId || '', config: { system: '' } })
  const roundNumbers = computed(() => [...new Set(attempts.value.map(a => a.roundNo))].sort((a, b) => a - b))
  const source = computed(() => active.value?.payload.source)
  const validation = computed(() => {
    if (!enabled.value) return '当前租户未开启 PlayGround'
    if (!models.value.length) return '当前租户没有可用的文本聊天模型'
    for (const l of config.value.lanes) {
      const m = modelFor(l.serviceId)
      if (!m) return '模型已停用或预设模型失效，请替换后发送'
      const c = l.config, caps = m.capabilities
      if (c.system && !caps.system) return `${m.name} 不支持系统提示词`
      for (const key of ['temperature', 'topP'] as const) {
        const value = c[key], range = caps[key]
        if (value != null && (!range || value < range.min || value > range.max || !Number.isFinite(value))) return `${m.name} 的 ${key} 不支持或超出范围，请调整或改为独立配置`
      }
      if (c.maxTokens != null && (!Number.isInteger(c.maxTokens) || c.maxTokens < 1 || !caps.maxTokens || c.maxTokens > caps.maxTokens)) return `${m.name} 的最大输出 Token 不合法`
    }
    return ''
  })
  const canSend = computed(() => !!prompt.value.trim() && !busy.value && !loading.value && !validation.value)
  const costSummary = computed(() => {
    const currencies: Record<string, string> = {}; let unresolved = 0
    for (const a of attempts.value) {
      if (a.metrics.costFen == null || !a.metrics.currency) unresolved++
      else currencies[a.metrics.currency] = new Decimal(currencies[a.metrics.currency] || 0).plus(a.metrics.costFen).toString()
    }
    return { currencies, unresolved }
  })
  function picked(round: number, laneId: string) {
    const list = attempts.value.filter(a => a.roundNo === round && a.laneId === laneId)
    return list.find(a => a.attemptId === selectedAttempts.value[`${round}:${laneId}`]) || list.at(-1)
  }
  function draft(next?: WorkbenchConfig) {
    view++; active.value = null; selectedAttempts.value = {}; streamError.value = ''; prompt.value = ''; pendingRound = null
    // 新草稿默认单模型；添加模型后自然进入并排对比。
    config.value = next ? editable(next) : { lanes: [lane()], synced: true }
  }
  async function refreshLists(keyword?: string) {
    const t = tenant.value, ticket = revision
    if (!t || !enabled.value) return
    if (keyword !== undefined) listKeyword = keyword
    const query = ++listRevision
    const results = await Promise.allSettled([api.workbenchList(t, 'groups', listKeyword), api.workbenchList(t, 'presets', listKeyword), listPlaygroundSessions(t, 1, 20, listKeyword)])
    if (ticket !== revision || query !== listRevision) return
    if (results[0].status === 'fulfilled') groups.value = results[0].value
    if (results[1].status === 'fulfilled') presets.value = results[1].value
    if (results[2].status === 'fulfilled') legacy.value = results[2].value.sessions
  }
  async function open(id: string) {
    const t = tenant.value, ticket = revision, screen = ++view
    if (!t) return
    loading.value = true
    try {
      const result = await api.workbenchDetail(t, id)
      if (ticket !== revision || screen !== view) return
      active.value = result; config.value = editable(result.payload); prompt.value = ''; streamError.value = ''; selectedAttempts.value = {}
      schedulePoll()
    } catch { /* 统一拦截器已提示。 */ }
    finally { if (ticket === revision && screen === view) loading.value = false }
  }
  async function stop(a: Attempt) {
    const t = tenant.value
    if (!t) return
    try { await api.workbenchStop(t, a.attemptId) } catch { /* 统一拦截器已提示。 */ }
    controllers.get(a.attemptId)?.abort()
    schedulePoll()
  }
  async function stopAll() {
    await Promise.allSettled(attempts.value.filter(isActive).map(stop))
  }
  async function guarded(action: () => void | Promise<void>) {
    if (!busy.value) { await action(); return }
    const ticket = revision, screen = view
    Modal.confirm({ title: '切换将停止当前生成', content: '已经产生的输出与费用会保留。', okText: '停止并切换', cancelText: '继续生成', async onOk() {
      await stopAll(); if (ticket === revision && screen === view) await action()
    } })
  }
  function schedulePoll() {
    clearTimeout(pollTimer)
    const t = tenant.value, id = active.value?.id, ticket = revision, screen = view
    if (!t || !id || !enabled.value) return
    pollTimer = setTimeout(async () => {
      try {
        const result = await api.workbenchDetail(t, id)
        if (ticket !== revision || screen !== view || active.value?.id !== id) return
        // 流式文本由 SSE 更新，轮询只更新终态和计量，避免旧投影覆盖新 delta。
        result.attempts = result.attempts?.map(a => isActive(a) ? attempts.value.find(old => old.attemptId === a.attemptId && old.reply.length > a.reply.length) || a : a)
        active.value = { ...result, payload: active.value.payload }
        const recent = (result.attempts || []).some(a => Date.now() - new Date(a.finishedAt || a.createdAt).getTime() < 120_000 && a.metrics.costFen == null)
        if (result.generating || recent) schedulePoll()
      } catch { /* 统一拦截器已提示，停止轮询等待用户刷新。 */ }
    }, 1500)
  }
  async function run(a: Attempt, t: string, ticket: number, screen: number) {
    if (a.status !== 'PENDING') return
    const controller = new AbortController(); controllers.set(a.attemptId, controller)
    try {
      await api.streamWorkbenchAttempt(t, a.attemptId, controller.signal, e => {
        if (ticket !== revision || screen !== view) return
        const item = attempts.value.find(x => x.attemptId === a.attemptId)
        if (!item) return
        if (e.type === 'accepted') item.status = 'STREAMING'
        else if (e.type === 'delta') { item.reply += e.text || ''; item.status = 'STREAMING' }
        else Object.assign(item, e)
      })
    } catch (error) {
      if (ticket === revision && screen === view && !controller.signal.aborted) streamError.value = error instanceof Error ? error.message : '流式连接中断'
    } finally { if (controllers.get(a.attemptId) === controller) controllers.delete(a.attemptId) }
  }
  async function send(override?: string) {
    const t = tenant.value, ticket = revision, screen = view, question = override || prompt.value.trim()
    if (!t || busy.value || validation.value || !question) return
    working.value = true; streamError.value = ''
    try {
      let group = active.value
      if (!group) {
        group = await api.workbenchCreate(t, 'groups', '新会话', editable(config.value))
        if (ticket !== revision || screen !== view) return
        group.attempts = []; active.value = group
      } else {
        const saved = await api.workbenchUpdate(t, group, { config: editable(config.value) })
        if (ticket !== revision || screen !== view) return
        active.value = group = { ...saved, attempts: group.attempts }
      }
      if (!pendingRound || pendingRound.groupId !== group.id || pendingRound.prompt !== question) pendingRound = { groupId: group.id, prompt: question, key: crypto.randomUUID() }
      const result = await api.workbenchRound(t, group.id, question, pendingRound.key)
      if (ticket !== revision || screen !== view) return
      pendingRound = null; prompt.value = ''; active.value.generating = result.attempts.some(isActive)
      const existing = new Set(attempts.value.map(a => a.attemptId)); active.value.attempts = [...attempts.value, ...result.attempts.filter(a => !existing.has(a.attemptId))]
      schedulePoll(); await Promise.allSettled(result.attempts.map(a => run(a, t, ticket, screen)))
      if (ticket === revision && screen === view) { active.value.generating = false; await refreshLists(); schedulePoll() }
    } catch { /* 统一拦截器已提示，保留问题和幂等键。 */ }
    finally { if (ticket === revision && screen === view) working.value = false }
  }
  async function retry(a: Attempt) {
    const t = tenant.value, ticket = revision, screen = view
    if (!t || busy.value) return
    working.value = true
    try {
      if (!retryKeys.has(a.attemptId)) retryKeys.set(a.attemptId, crypto.randomUUID())
      const next = await api.workbenchRetry(t, a.attemptId, retryKeys.get(a.attemptId)!)
      if (ticket !== revision || screen !== view || !active.value) return
      if (!attempts.value.some(x => x.attemptId === next.attemptId)) active.value.attempts = [...attempts.value, next]
      selectedAttempts.value[`${a.roundNo}:${a.laneId}`] = next.attemptId
      active.value.generating = isActive(next); schedulePoll(); await run(next, t, ticket, screen)
      if (ticket === revision && screen === view) { retryKeys.delete(a.attemptId); active.value.generating = false; schedulePoll() }
    } catch { /* 统一拦截器已提示。 */ }
    finally { if (ticket === revision && screen === view) working.value = false }
  }
  async function fork(a?: Attempt, before = false, next?: WorkbenchConfig, sourceLaneId?: string) {
    const t = tenant.value, ticket = revision, screen = view, current = active.value
    if (!t || !current || busy.value) return
    working.value = true
    try {
      const branch = await api.workbenchFork(t, current.id, { attemptId: a?.attemptId, laneId: a?.laneId || sourceLaneId || current.payload.lanes[0]?.laneId, before, config: next })
      if (ticket !== revision || screen !== view) return
      active.value = { ...branch, attempts: [] }; config.value = editable(branch.payload); selectedAttempts.value = {}; prompt.value = before ? a?.prompt || '' : ''
      await refreshLists()
      working.value = false
      if (before && a) await send(a.prompt)
    } catch { /* 统一拦截器已提示。 */ }
    finally { if (ticket === revision && screen === view) working.value = false }
  }
  async function topology(next: WorkbenchConfig, sourceLaneId?: string) {
    if (busy.value) return
    if (attempts.value.length) await fork(undefined, false, next, sourceLaneId)
    else config.value = editable(next)
  }
  function patch(index: number, name: keyof RunConfig, value: string | number | null) {
    if (busy.value) return
    const targets = config.value.synced ? config.value.lanes : [config.value.lanes[index]!]
    for (const l of targets) Object.assign(l.config, { [name]: value })
  }
  function synchronize(index: number, value: boolean) {
    if (busy.value) return
    config.value.synced = value
    if (value) { const c = clone(config.value.lanes[index]?.config || {}); for (const l of config.value.lanes) l.config = clone(c) }
  }
  function draftRequest(index: number): ChatRequest | null {
    const l = config.value.lanes[index], m = l && modelFor(l.serviceId)
    if (!l || !m) return null
    const messages = clone(active.value?.payload.prefix || [])
    if (l.config.system) messages.unshift({ role: 'system', content: l.config.system })
    for (const number of roundNumbers.value) {
      const completed = attempts.value.filter(a => a.roundNo === number && a.laneId === l.laneId && a.status === 'COMPLETED').at(-1)
      if (completed) messages.push({ role: 'user', content: completed.prompt }, { role: 'assistant', content: completed.reply })
    }
    messages.push({ role: 'user', content: prompt.value.trim() || '在这里输入你的问题' })
    const r: ChatRequest = { model: m.name, messages, stream: true }
    if (l.config.temperature != null) r.temperature = l.config.temperature
    if (l.config.topP != null) r.top_p = l.config.topP
    if (l.config.maxTokens != null) r.max_tokens = l.config.maxTokens
    return r
  }
  function clear() {
    revision++; view++; for (const controller of controllers.values()) controller.abort(); controllers.clear(); clearTimeout(pollTimer)
    active.value = null; groups.value = []; presets.value = []; legacy.value = []; models.value = []; examples.value = []; listKeyword = ''; listRevision++
    config.value = { lanes: [], synced: true }; prompt.value = ''; selectedAttempts.value = {}; pendingRound = null; retryKeys.clear(); working.value = false; loading.value = false; streamError.value = ''
  }
  watch([tenant, () => userStore.user?.userId], async ([t]) => {
    clear(); const ticket = revision
    if (!t) return
    loading.value = true
    await gate.refresh(t)
    if (ticket !== revision || !enabled.value) { if (ticket === revision) loading.value = false; return }
    try {
      const [m, p] = await Promise.all([api.workbenchModels(t), getPlaygroundPrompts(t)])
      if (ticket !== revision) return
      models.value = m; examples.value = p.items; draft(); await refreshLists()
    } catch { /* 统一拦截器已提示。 */ }
    finally { if (ticket === revision) loading.value = false }
  }, { immediate: true })
  watch(enabled, value => { if (!value && !loading.value) clear() })
  const unregisterSwitchGuard = tenantStore.registerSwitchGuard(() => {
    if (!busy.value) return true
    return new Promise<boolean>(resolve => Modal.confirm({ title: '切换将停止当前生成', content: '已经产生的输出与费用会保留。', okText: '停止并切换', cancelText: '继续生成',
      onOk: async () => { await stopAll(); resolve(true) }, onCancel: () => resolve(false) }))
  })
  onBeforeUnmount(() => { unregisterSwitchGuard(); clear() })
  return { tenant, models, groups, presets, legacy, examples, active, config, prompt, loading, working, streamError,
    selectedAttempts, enabled, attempts, busy, roundNumbers, source, validation, canSend, costSummary,
    modelFor, lane, picked, draft, open, guarded, send, stop, stopAll, retry, fork, topology, patch, synchronize, draftRequest, refreshLists }
}
