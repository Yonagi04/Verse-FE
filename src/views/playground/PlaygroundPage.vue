<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { message, Modal } from 'ant-design-vue'
import { BulbOutlined } from '@ant-design/icons-vue'
import { useTenantStore } from '@/stores/tenant'
import { usePlaygroundStore } from '@/stores/playground'
import { getPlaygroundModels, getPlaygroundPrompts, createPlaygroundSession, listPlaygroundSessions, getPlaygroundSession,
  updatePlaygroundSessionModel, deletePlaygroundSession, streamPlaygroundTurn } from '@/api/playground'
import type { PlaygroundDetail, PlaygroundEvent, PlaygroundModel, PlaygroundPrompt, PlaygroundSession } from '@/types/playground'

const tenantStore = useTenantStore()
const playgroundStore = usePlaygroundStore()
const tenantId = computed(() => tenantStore.currentTenantId)
const models = ref<PlaygroundModel[]>([])
const starterPrompts = ref<PlaygroundPrompt[]>([])
const sessions = ref<PlaygroundSession[]>([])
const selectedModel = ref<string>()
const active = ref<PlaygroundDetail | null>(null)
const keyword = ref('')
const page = ref(1)
const total = ref(0)
const prompt = ref('')
const sending = ref(false)
const creating = ref(false)
const updatingModel = ref(false)
const pendingPrompt = ref('')
const pendingReply = ref('')
const streamError = ref('')
const scroller = ref<HTMLElement | null>(null)
const composer = ref<HTMLElement | null>(null)
const promptTrack = ref<HTMLElement | null>(null)
const canScrollLeft = ref(false)
const canScrollRight = ref(false)
let generation = 0
let viewRevision = 0
let promptResizeObserver: ResizeObserver | null = null
let requestController: AbortController | null = null
let accepted = false
let terminal = false

const busy = computed(() => sending.value || creating.value || updatingModel.value)
const showStarter = computed(() => !!models.value.length && !busy.value
  && (!active.value || (active.value.turnCount === 0 && !active.value.turns.length)))
const canSend = computed(() => !!selectedModel.value && (!active.value || active.value.modelAvailable)
  && !!prompt.value.trim() && !busy.value)

function reset() {
  generation++
  viewRevision++
  requestController?.abort()
  requestController = null
  models.value = []
  starterPrompts.value = []
  sessions.value = []
  active.value = null
  selectedModel.value = undefined
  page.value = 1
  total.value = 0
  prompt.value = ''
  pendingPrompt.value = ''
  pendingReply.value = ''
  streamError.value = ''
  sending.value = false
  creating.value = false
  updatingModel.value = false
}

async function load(tenant: string, ticket: number) {
  const [modelResult, listResult, promptResult] = await Promise.allSettled([
    getPlaygroundModels(tenant), listPlaygroundSessions(tenant), getPlaygroundPrompts(tenant),
  ])
  if (ticket !== generation) return
  if (modelResult.status === 'fulfilled') {
    models.value = modelResult.value.items
    selectedModel.value = modelResult.value.items[0]?.serviceId
  }
  if (listResult.status === 'fulfilled') {
    sessions.value = listResult.value.sessions
    total.value = listResult.value.total
  }
  if (promptResult.status === 'fulfilled') starterPrompts.value = promptResult.value.items
}

async function refreshList() {
  const tenant = tenantId.value
  const ticket = generation
  if (!tenant) return
  try {
    const result = await listPlaygroundSessions(tenant, page.value, 20, keyword.value)
    if (ticket !== generation) return
    sessions.value = result.sessions
    total.value = result.total
  } catch { /* 统一请求拦截器已提示。 */ }
}

async function openSession(sessionId: string, preserveInput = false) {
  const tenant = tenantId.value
  const ticket = generation
  const view = ++viewRevision
  if (!tenant) return
  try {
    const result = await getPlaygroundSession(tenant, sessionId)
    if (ticket !== generation || view !== viewRevision) return
    active.value = result
    selectedModel.value = result.serviceId
    if (!preserveInput) {
      prompt.value = ''
      streamError.value = ''
    }
    pendingPrompt.value = ''
    pendingReply.value = ''
    await scrollBottom()
  } catch { /* 统一请求拦截器已提示。 */ }
}

function newSession(serviceId = selectedModel.value) {
  if (busy.value) return
  viewRevision++
  active.value = null
  selectedModel.value = models.value.some(model => model.serviceId === serviceId)
    ? serviceId : models.value[0]?.serviceId
  prompt.value = ''
  pendingPrompt.value = ''
  pendingReply.value = ''
  streamError.value = ''
  void nextTick(() => composer.value?.querySelector('textarea')?.focus())
}

async function changeModel(serviceId: string) {
  selectedModel.value = serviceId
  const tenant = tenantId.value
  if (!tenant || busy.value || !active.value || active.value.serviceId === serviceId) return
  if (active.value.turnCount > 0) { newSession(serviceId); return }
  const ticket = generation
  updatingModel.value = true
  try {
    await updatePlaygroundSessionModel(tenant, active.value.sessionId, serviceId)
    if (ticket !== generation) return
    await openSession(active.value.sessionId)
    await refreshList()
  } catch {
    if (ticket === generation && active.value) selectedModel.value = active.value.serviceId
    // 统一请求拦截器已提示。
  }
  finally { if (ticket === generation) updatingModel.value = false }
}

function fillPrompt(value: string) {
  if (busy.value) return
  prompt.value = value
  void nextTick(() => {
    const input = composer.value?.querySelector('textarea')
    input?.focus()
    input?.setSelectionRange(value.length, value.length)
  })
}

function updatePromptOverflow() {
  const track = promptTrack.value
  canScrollLeft.value = !!track && track.scrollLeft > 1
  canScrollRight.value = !!track && track.scrollLeft + track.clientWidth < track.scrollWidth - 1
}

function confirmDelete(session: PlaygroundSession) {
  if (busy.value) return
  Modal.confirm({
    title: '删除这段会话？', content: `“${session.title}”将从你的历史列表移除。`,
    okText: '删除', okType: 'danger', cancelText: '取消',
    async onOk() {
      const tenant = tenantId.value
      if (!tenant) return
      await deletePlaygroundSession(tenant, session.sessionId)
      if (active.value?.sessionId === session.sessionId) active.value = null
      await refreshList()
    },
  })
}

async function scrollBottom() {
  await nextTick()
  scroller.value?.scrollTo({ top: scroller.value.scrollHeight, behavior: 'smooth' })
}

function handleEvent(event: PlaygroundEvent) {
  if (event.type === 'accepted') { accepted = true; prompt.value = ''; streamError.value = '' }
  else if (event.type === 'delta') pendingReply.value += event.text
  else if (event.type === 'completed' || event.type === 'stopped') { terminal = true; pendingReply.value = event.reply }
  else if (event.type === 'error') { terminal = true; streamError.value = event.message; prompt.value = pendingPrompt.value }
  void scrollBottom()
}

async function send() {
  const tenant = tenantId.value
  const text = prompt.value.trim()
  const serviceId = selectedModel.value
  if (!tenant || !serviceId || !text || busy.value || (active.value && !active.value.modelAvailable)) return
  const ticket = generation
  viewRevision++
  let sessionId = active.value?.sessionId
  accepted = false
  terminal = false
  streamError.value = ''
  creating.value = !sessionId
  try {
    if (!sessionId) {
      const session = await createPlaygroundSession(tenant, serviceId)
      if (ticket !== generation) return
      sessionId = session.sessionId
      active.value = { ...session, modelAvailable: true, turns: [] }
    }
    if (ticket !== generation) return
    creating.value = false
    sending.value = true
    pendingPrompt.value = text
    pendingReply.value = ''
    requestController = new AbortController()
    await streamPlaygroundTurn(tenant, sessionId, text, crypto.randomUUID(),
      requestController.signal, event => { if (ticket === generation) handleEvent(event) })
    if (!accepted || !terminal) throw new Error('连接已结束，发送状态未确认')
  } catch (error) {
    if (ticket === generation && (error as Error).name !== 'AbortError') {
      prompt.value = text
      if (sessionId) {
        streamError.value = (error as Error).message || '发送失败'
        message.error(streamError.value)
      }
    }
  } finally {
    if (ticket === generation) {
      creating.value = false
      sending.value = false
      requestController = null
      pendingPrompt.value = ''
      pendingReply.value = ''
      if (sessionId) {
        await openSession(sessionId, true)
        await refreshList()
        if (active.value?.turns.at(-1)?.status === 'STREAMING') {
          const currentSessionId = sessionId
          window.setTimeout(() => { if (ticket === generation) void openSession(currentSessionId, true) }, 500)
        }
      }
    }
  }
}

function stop() { requestController?.abort() }
function onPromptKeydown(event: KeyboardEvent) {
  if (event.key !== 'Enter' || event.shiftKey || event.ctrlKey || event.altKey
    || event.metaKey || event.isComposing) return
  event.preventDefault()
  void send()
}

async function copy(text: string | null) {
  if (!text) return
  try { await navigator.clipboard.writeText(text); message.success('已复制回复') }
  catch { message.error('复制失败') }
}

watch(tenantId, next => {
  reset()
  if (next) {
    const ticket = generation
    void playgroundStore.refresh(next).then(status => {
      if (ticket === generation && status?.enabled) void load(next, ticket)
    })
  }
}, { immediate: true })
watch(keyword, () => { page.value = 1; void refreshList() })
watch(page, () => { void refreshList() })
watch(promptTrack, element => {
  promptResizeObserver?.disconnect()
  if (!element) { canScrollLeft.value = false; canScrollRight.value = false; return }
  promptResizeObserver = new ResizeObserver(updatePromptOverflow)
  promptResizeObserver.observe(element)
  void nextTick(updatePromptOverflow)
})
onBeforeUnmount(() => { promptResizeObserver?.disconnect(); reset() })
</script>

<template>
  <div class="playground-page">
    <header class="page-header">
      <div><h1>PlayGround</h1><p>在当前租户中与已配置的模型进行私有对话</p></div>
      <!-- <div class="limit-hint">每模型 {{ playgroundStore.status?.limitRpm ?? 6 }} RPM / {{ playgroundStore.status?.limitRph ?? 120 }} RPH</div> -->
    </header>
    <div class="chat-layout">
      <aside class="session-panel">
        <a-button type="primary" block :disabled="!models.length || busy" @click="newSession()">新建会话</a-button>
        <a-input v-model:value="keyword" placeholder="搜索会话标题" allow-clear />
        <div class="session-list">
          <div v-if="!sessions.length" class="empty-list">{{ keyword ? '没有找到会话' : '暂无会话' }}</div>
          <button v-for="session in sessions" :key="session.sessionId" class="session-item"
            :class="{ active: active?.sessionId === session.sessionId }" :disabled="busy" @click="openSession(session.sessionId)">
            <span class="session-title">{{ session.title }}</span>
            <span class="session-meta">{{ session.modelName }} · {{ session.turnCount }} 轮</span>
            <a-button size="small" type="text" danger :disabled="busy" @click.stop="confirmDelete(session)">删除</a-button>
          </button>
        </div>
        <a-pagination v-if="total > 20" v-model:current="page" :total="total" :page-size="20" size="small" simple />
      </aside>
      <section class="chat-panel">
        <div class="chat-toolbar">
          <div><strong>{{ active?.title ?? '新会话' }}</strong><span>单模型多轮聊天</span></div>
          <a-select v-model:value="selectedModel" placeholder="选择模型" style="min-width: 190px"
            :disabled="busy || !models.length" @change="changeModel">
            <a-select-option v-for="model in models" :key="model.serviceId" :value="model.serviceId">{{ model.name }}</a-select-option>
          </a-select>
        </div>
        <div ref="scroller" class="messages">
          <div v-if="!models.length" class="empty-chat">当前租户没有可用的文本聊天模型。</div>
          <div v-else-if="showStarter" class="empty-hero">
            <div class="empty-mark"><BulbOutlined /></div>
            <h2>从一个问题开始</h2>
            <p>选择租户内已配置的模型，输入提示词，并开始多轮会话。</p>
          </div>
          <template v-for="turn in active?.turns ?? []" :key="turn.turnId">
            <div class="message user"><small>我</small><div class="bubble">{{ turn.prompt }}</div></div>
            <div class="message assistant"><small>{{ active?.modelName }}</small>
              <div class="bubble">{{ turn.reply || (turn.status === 'FAILED' ? '回复失败' : '等待回复…') }}</div>
              <div class="reply-actions"><span v-if="turn.status !== 'COMPLETED'">{{ turn.status === 'STOPPED' ? '已停止' : turn.status === 'FAILED' ? '失败' : '生成中' }}</span>
                <a-button v-if="turn.reply" size="small" type="link" @click="copy(turn.reply)">复制</a-button></div>
            </div>
          </template>
          <template v-if="sending">
            <div class="message user"><small>我</small><div class="bubble">{{ pendingPrompt }}</div></div>
            <div class="message assistant"><small>{{ active?.modelName }}</small><div class="bubble">{{ pendingReply || '等待回复…' }}</div></div>
          </template>
        </div>
        <div ref="composer" class="composer" :class="{ 'composer-starter': showStarter }">
          <a-alert v-if="streamError" :message="streamError" type="error" show-icon class="stream-error" />
          <a-alert v-if="active && !active.modelAvailable" message="当前模型已停用，请选择其他模型创建新会话。" type="warning" show-icon class="stream-error" />
          <div v-if="showStarter && starterPrompts.length" class="prompt-collection">
            <div ref="promptTrack" class="prompt-track"
              :class="{ 'has-before': canScrollLeft, 'has-more': canScrollRight }"
              role="group" aria-label="示例提示词，可横向滚动" @scroll="updatePromptOverflow">
              <button v-for="item in starterPrompts" :key="item.id" type="button" class="prompt-card"
                :title="item.prompt" @click="fillPrompt(item.prompt)">
                <strong>{{ item.title }}</strong>
                <span>{{ item.description }}</span>
              </button>
            </div>
          </div>
          <div class="prompt-box">
            <a-textarea v-model:value="prompt" :rows="4" :disabled="busy || !models.length"
              placeholder="随心输入。Enter 发送，Shift+Enter 换行" @keydown="onPromptKeydown" />
            <a-button v-if="sending" class="prompt-action" danger @click="stop">停止</a-button>
            <a-button v-else-if="creating" class="prompt-action" disabled>创建中</a-button>
            <a-button v-else class="prompt-action" type="primary" :disabled="!canSend" @click="send">发送</a-button>
          </div>
          <div class="composer-note">模型回答可能不准确，请核对重要信息。</div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped lang="scss">
.playground-page { height: calc(100vh - 110px); min-height: 550px; display: flex; flex-direction: column; gap: 18px; }
.page-header { display: flex; align-items: flex-end; justify-content: space-between; h1 { margin: 0; font-size: 24px; } p { margin: 5px 0 0; color: $color-text-secondary; } }
.limit-hint { color: $color-text-secondary; font-size: 13px; }
.chat-layout { min-height: 0; flex: 1; display: grid; grid-template-columns: 260px minmax(0, 1fr); gap: 16px; }
.session-panel, .chat-panel { min-height: 0; border: 1px solid $color-border; border-radius: 12px; background: #fff; }
.session-panel { display: flex; flex-direction: column; padding: 14px; gap: 12px; }
.session-list { flex: 1; overflow-y: auto; }
.session-item { width: 100%; border: 0; border-radius: 8px; display: flex; align-items: flex-start; flex-direction: column; padding: 9px 10px; text-align: left; background: transparent; cursor: pointer; position: relative; &:hover, &.active { background: #f0f6ff; } .ant-btn { position: absolute; right: 3px; bottom: 4px; } }
.session-title { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; }
.session-meta { color: $color-text-secondary; font-size: 12px; margin-top: 4px; padding-right: 36px; }
.empty-list, .empty-chat { color: $color-text-secondary; text-align: center; padding: 50px 16px; }
.empty-hero { height: 100%; min-height: 210px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 24px 16px; }
.empty-mark { width: 56px; height: 56px; display: grid; place-items: center; border-radius: 16px; background: #eaf3ff; color: $color-primary; font-size: 27px; }
.empty-hero h2 { margin: 20px 0 7px; color: $color-text-primary; font-size: 22px; font-weight: 700; }
.empty-hero p { margin: 0; color: $color-text-secondary; font-size: 14px; line-height: 1.6; }
.chat-panel { display: flex; flex-direction: column; }
.chat-toolbar { min-height: 67px; padding: 12px 20px; border-bottom: 1px solid $color-border; display: flex; align-items: center; justify-content: space-between; gap: 16px; span { display: block; color: $color-text-secondary; font-size: 12px; } }
.messages { min-height: 0; flex: 1; overflow-y: auto; padding: 24px max(22px, 7%); }
.message { margin-bottom: 22px; max-width: 85%; small { display: block; margin-bottom: 5px; color: $color-text-secondary; } &.user { margin-left: auto; .bubble { background: #eaf3ff; } } }
.bubble { white-space: pre-wrap; overflow-wrap: anywhere; border-radius: 12px; background: #f6f7f9; padding: 12px 15px; line-height: 1.6; }
.reply-actions { color: $color-text-secondary; font-size: 12px; margin-top: 4px; }
.composer { border-top: 1px solid $color-border; padding: 14px 18px; }
.composer-starter { border-top: 0; }
.prompt-collection { width: min(100%, 780px); min-width: 0; margin: 0 auto 12px; }
.prompt-track { min-width: 0; display: flex; justify-content: safe center; gap: 14px; overflow-x: auto; overscroll-behavior-inline: contain; scroll-snap-type: x proximity; scrollbar-width: none; }
.prompt-track::-webkit-scrollbar { display: none; }
.prompt-track.has-before { -webkit-mask-image: linear-gradient(to right, transparent, #000 64px); mask-image: linear-gradient(to right, transparent, #000 64px); }
.prompt-track.has-more { -webkit-mask-image: linear-gradient(to right, #000 calc(100% - 64px), transparent); mask-image: linear-gradient(to right, #000 calc(100% - 64px), transparent); }
.prompt-track.has-before.has-more { -webkit-mask-image: linear-gradient(to right, transparent, #000 64px, #000 calc(100% - 64px), transparent); mask-image: linear-gradient(to right, transparent, #000 64px, #000 calc(100% - 64px), transparent); }
.prompt-card { flex: 0 0 204px; min-width: 0; scroll-snap-align: start; border: 1px solid $color-border; border-radius: 10px; padding: 12px 14px; background: $color-bg-secondary; color: $color-text-primary; text-align: left; cursor: pointer; transition: border-color .15s, background .15s; strong, span { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } strong { font-size: 14px; font-weight: 600; } span { margin-top: 5px; color: $color-text-secondary; font-size: 12px; } &:hover, &:focus-visible { border-color: $color-primary; background: #f0f6ff; } }
.stream-error { margin-bottom: 10px; }
.prompt-box { position: relative; }
.prompt-box :deep(textarea) {
  height: 112px !important;
  min-height: 112px !important;
  max-height: 112px !important;
  overflow-y: auto !important;
  resize: none !important;
  padding: 12px 96px 42px 14px;

  border-radius: 12px;
}
.prompt-action { position: absolute; right: 12px; bottom: 12px; }
.composer-note { margin-top: 9px; color: $color-text-secondary; font-size: 12px; text-align: center; }
@media (max-width: 760px) { .chat-layout { grid-template-columns: 1fr; } .session-panel { max-height: 180px; } .page-header { align-items: flex-start; flex-direction: column; } .prompt-card { flex-basis: 190px; } }
</style>
