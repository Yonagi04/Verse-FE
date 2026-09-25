<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { message, Modal } from 'ant-design-vue'
import { useTenantStore } from '@/stores/tenant'
import { usePlaygroundStore } from '@/stores/playground'
import { getPlaygroundModels, createPlaygroundSession, listPlaygroundSessions, getPlaygroundSession,
  updatePlaygroundSessionModel, deletePlaygroundSession, streamPlaygroundTurn } from '@/api/playground'
import type { PlaygroundDetail, PlaygroundEvent, PlaygroundModel, PlaygroundSession } from '@/types/playground'

const tenantStore = useTenantStore()
const playgroundStore = usePlaygroundStore()
const tenantId = computed(() => tenantStore.currentTenantId)
const models = ref<PlaygroundModel[]>([])
const sessions = ref<PlaygroundSession[]>([])
const selectedModel = ref<string>()
const active = ref<PlaygroundDetail | null>(null)
const keyword = ref('')
const page = ref(1)
const total = ref(0)
const prompt = ref('')
const sending = ref(false)
const pendingPrompt = ref('')
const pendingReply = ref('')
const streamError = ref('')
const scroller = ref<HTMLElement | null>(null)
let generation = 0
let requestController: AbortController | null = null
let accepted = false
let terminal = false

const canSend = computed(() => !!selectedModel.value && (!active.value || active.value.modelAvailable)
  && !!prompt.value.trim())

function reset() {
  generation++
  requestController?.abort()
  requestController = null
  models.value = []
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
}

async function load(tenant: string, ticket: number) {
  try {
    const [modelResult, listResult] = await Promise.all([
      getPlaygroundModels(tenant), listPlaygroundSessions(tenant),
    ])
    if (ticket !== generation) return
    models.value = modelResult.items
    sessions.value = listResult.sessions
    total.value = listResult.total
    selectedModel.value = modelResult.items[0]?.serviceId
    if (listResult.sessions[0]) await openSession(listResult.sessions[0].sessionId)
  } catch { /* 统一请求拦截器已提示。 */ }
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

async function openSession(sessionId: string) {
  const tenant = tenantId.value
  const ticket = generation
  if (!tenant) return
  try {
    const result = await getPlaygroundSession(tenant, sessionId)
    if (ticket !== generation) return
    active.value = result
    selectedModel.value = result.serviceId
    pendingPrompt.value = ''
    pendingReply.value = ''
    await scrollBottom()
  } catch { /* 统一请求拦截器已提示。 */ }
}

async function newSession(serviceId = selectedModel.value) {
  const tenant = tenantId.value
  if (!tenant || !serviceId || sending.value) return
  try {
    const session = await createPlaygroundSession(tenant, serviceId)
    await refreshList()
    await openSession(session.sessionId)
  } catch { /* 统一请求拦截器已提示。 */ }
}

async function changeModel(serviceId: string) {
  selectedModel.value = serviceId
  const tenant = tenantId.value
  if (!tenant || sending.value || !active.value || active.value.serviceId === serviceId) return
  try {
    if (active.value.turnCount > 0) await newSession(serviceId)
    else {
      await updatePlaygroundSessionModel(tenant, active.value.sessionId, serviceId)
      await openSession(active.value.sessionId)
      await refreshList()
    }
  } catch { /* 统一请求拦截器已提示。 */ }
}

function confirmDelete(session: PlaygroundSession) {
  if (sending.value) return
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
  if (!tenant || !selectedModel.value || !text || sending.value) return
  if (!active.value) { await newSession(); if (!active.value) return }
  const sessionId = active.value.sessionId
  const ticket = generation
  accepted = false
  terminal = false
  sending.value = true
  pendingPrompt.value = text
  pendingReply.value = ''
  streamError.value = ''
  requestController = new AbortController()
  try {
    await streamPlaygroundTurn(tenant, sessionId, text, crypto.randomUUID(),
      requestController.signal, event => { if (ticket === generation) handleEvent(event) })
    if (!accepted || !terminal) throw new Error('连接已结束，发送状态未确认')
  } catch (error) {
    if (ticket === generation && (error as Error).name !== 'AbortError') {
      streamError.value = (error as Error).message || '发送失败'
      prompt.value = text
      message.error(streamError.value)
    }
  } finally {
    if (ticket === generation) {
      sending.value = false
      requestController = null
      await openSession(sessionId)
      await refreshList()
      if (active.value?.turns.at(-1)?.status === 'STREAMING') {
        window.setTimeout(() => { if (ticket === generation) void openSession(sessionId) }, 500)
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
onBeforeUnmount(reset)
</script>

<template>
  <div class="playground-page">
    <header class="page-header">
      <div><h1>PlayGround</h1><p>在当前租户中与已配置的模型进行私有对话</p></div>
      <!-- <div class="limit-hint">每模型 {{ playgroundStore.status?.limitRpm ?? 6 }} RPM / {{ playgroundStore.status?.limitRph ?? 120 }} RPH</div> -->
    </header>
    <div class="chat-layout">
      <aside class="session-panel">
        <a-button type="primary" block :disabled="!models.length || sending" @click="newSession()">新建会话</a-button>
        <a-input v-model:value="keyword" placeholder="搜索会话标题" allow-clear />
        <div class="session-list">
          <div v-if="!sessions.length" class="empty-list">{{ keyword ? '没有找到会话' : '暂无会话' }}</div>
          <button v-for="session in sessions" :key="session.sessionId" class="session-item"
            :class="{ active: active?.sessionId === session.sessionId }" @click="openSession(session.sessionId)">
            <span class="session-title">{{ session.title }}</span>
            <span class="session-meta">{{ session.modelName }} · {{ session.turnCount }} 轮</span>
            <a-button size="small" type="text" danger :disabled="sending" @click.stop="confirmDelete(session)">删除</a-button>
          </button>
        </div>
        <a-pagination v-if="total > 20" v-model:current="page" :total="total" :page-size="20" size="small" simple />
      </aside>
      <section class="chat-panel">
        <div class="chat-toolbar">
          <div><strong>{{ active?.title ?? '新会话' }}</strong><span>单模型多轮聊天</span></div>
          <a-select v-model:value="selectedModel" placeholder="选择模型" style="min-width: 190px"
            :disabled="sending || !models.length" @change="changeModel">
            <a-select-option v-for="model in models" :key="model.serviceId" :value="model.serviceId">{{ model.name }}</a-select-option>
          </a-select>
        </div>
        <div ref="scroller" class="messages">
          <div v-if="!models.length" class="empty-chat">当前租户没有可用的文本聊天模型。</div>
          <div v-else-if="!active?.turns.length && !sending" class="empty-chat">选择模型，开始一段新对话。</div>
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
        <div class="composer">
          <a-alert v-if="streamError" :message="streamError" type="error" show-icon class="stream-error" />
          <a-alert v-if="active && !active.modelAvailable" message="当前模型已停用，请选择其他模型创建新会话。" type="warning" show-icon class="stream-error" />
          <div class="prompt-box">
            <a-textarea v-model:value="prompt" :rows="4" :disabled="sending || !models.length"
              placeholder="随心输入。Enter 发送，Shift+Enter 换行" @keydown="onPromptKeydown" />
            <a-button v-if="sending" class="prompt-action" danger @click="stop">停止</a-button>
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
.chat-panel { display: flex; flex-direction: column; }
.chat-toolbar { min-height: 67px; padding: 12px 20px; border-bottom: 1px solid $color-border; display: flex; align-items: center; justify-content: space-between; gap: 16px; span { display: block; color: $color-text-secondary; font-size: 12px; } }
.messages { min-height: 0; flex: 1; overflow-y: auto; padding: 24px max(22px, 7%); }
.message { margin-bottom: 22px; max-width: 85%; small { display: block; margin-bottom: 5px; color: $color-text-secondary; } &.user { margin-left: auto; .bubble { background: #eaf3ff; } } }
.bubble { white-space: pre-wrap; overflow-wrap: anywhere; border-radius: 12px; background: #f6f7f9; padding: 12px 15px; line-height: 1.6; }
.reply-actions { color: $color-text-secondary; font-size: 12px; margin-top: 4px; }
.composer { border-top: 1px solid $color-border; padding: 14px 18px; }
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
@media (max-width: 760px) { .chat-layout { grid-template-columns: 1fr; } .session-panel { max-height: 180px; } .page-header { align-items: flex-start; flex-direction: column; } }
</style>
