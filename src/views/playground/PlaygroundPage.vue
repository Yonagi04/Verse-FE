<script setup lang="ts">
import { computed, ref, watch, onBeforeUnmount } from 'vue'
import { Modal } from 'ant-design-vue'
import { PlusOutlined, SettingOutlined, DownloadOutlined, SaveOutlined, CloseOutlined, ExperimentOutlined, SendOutlined, StopOutlined, SearchOutlined, MoreOutlined, DownOutlined, HistoryOutlined, ArrowRightOutlined, CopyOutlined, CodeOutlined, BranchesOutlined, ReloadOutlined } from '@ant-design/icons-vue'
import { onBeforeRouteLeave } from 'vue-router'
import { useWorkbench } from '@/hooks/usePlaygroundWorkbench'
import { useUserStore } from '@/stores/user'
import * as api from '@/api/playgroundWorkbench'
import type { Attempt, WorkbenchConfig, WorkbenchResource } from '@/types/playgroundWorkbench'
import { copyWorkbenchText } from '@/utils/playgroundExport'
import ProviderLogo from '@/components/ProviderLogo.vue'
import { getProviderBySlug } from '@/constants/providers'
import MarkdownReply from './MarkdownReply.vue'
import ExportDialog from './ExportDialog.vue'
import PresetDialog from './PresetDialog.vue'
import LegacyPlaygroundPage from './LegacyPlaygroundPage.vue'

const { tenant, models, groups, presets, legacy, examples, active, config, prompt, loading, streamError, selectedAttempts,
  enabled, attempts, busy, roundNumbers, source, validation, canSend,
  modelFor, lane, picked, draft, open, guarded, send, stop, stopAll, retry, fork, topology, patch, synchronize, draftRequest, refreshLists } = useWorkbench()
// 宽屏停靠会话列表，窄屏通过同一入口展开，避免挤压模型对比区。
const libraryTab = ref('sessions'), keyword = ref(''), libraryOpen = ref(false), libraryCollapsed = ref(false)
const providerName = (slug: string) => getProviderBySlug(slug)?.displayName || slug
const configOpen = ref(false), configIndex = ref(0), modelOpen = ref(false), modelIndex = ref(0)
const modelSearch = ref(''), provider = ref<string>(), capabilityFilter = ref(false)
const exportOpen = ref(false), exportInitial = ref<Attempt>(), presetOpen = ref(false), presetResource = ref<WorkbenchResource>()
const legacyOpen = ref(false), legacyId = ref(''), renameOpen = ref(false), renameValue = ref(''), renameResource = ref<WorkbenchResource>()
let identity = 0
const userStore = useUserStore()
let searchTimer: ReturnType<typeof setTimeout> | undefined
watch([tenant, () => userStore.user?.userId], () => { identity++; modelOpen.value = exportOpen.value = presetOpen.value = legacyOpen.value = renameOpen.value = configOpen.value = libraryOpen.value = false; keyword.value = ''; configIndex.value = 0; clearTimeout(searchTimer) })
watch(keyword, value => { clearTimeout(searchTimer); searchTimer = setTimeout(() => { void refreshLists(value) }, 250) })
watch(() => config.value.lanes.length, n => { if (configIndex.value >= n) configIndex.value = 0 })
const filteredGroups = computed(() => groups.value.filter(g => g.title.toLowerCase().includes(keyword.value.toLowerCase())))
const filteredPresets = computed(() => presets.value.filter(p => `${p.title} ${p.description || ''}`.toLowerCase().includes(keyword.value.toLowerCase())))
const filteredLegacy = computed(() => legacy.value.filter(s => s.title.toLowerCase().includes(keyword.value.toLowerCase())))
const filteredModels = computed(() => models.value.filter(m => `${m.name} ${m.provider} ${m.description || ''}`.toLowerCase().includes(modelSearch.value.toLowerCase()) && (!provider.value || m.provider === provider.value) && (!capabilityFilter.value || m.capabilities.temperature && m.capabilities.topP)))
const laneNames = computed(() => config.value.lanes.map((l, i) => `配置 ${String.fromCharCode(65 + i)} · ${modelFor(l.serviceId)?.name || '模型已失效'}`))
const focusedLane = computed(() => config.value.lanes[configIndex.value])
const statusLabel = (status: string) => ({ PENDING: '等待', STREAMING: '生成中', STOPPING: '停止中', COMPLETED: '完成', STOPPED: '已停止', FAILED: '失败' }[status] || status)
function bounds(name: 'temperature' | 'topP') {
  const targets = config.value.synced ? config.value.lanes : [focusedLane.value]
  const ranges = targets.map(l => l && modelFor(l.serviceId)?.capabilities[name])
  if (!ranges.length || ranges.some(r => !r)) return null
  const min = Math.max(...ranges.map(r => r!.min)), max = Math.min(...ranges.map(r => r!.max))
  return min <= max ? { min, max } : null
}
const maxTokens = computed(() => {
  const targets = config.value.synced ? config.value.lanes : [focusedLane.value]
  const values = targets.map(l => l && modelFor(l.serviceId)?.capabilities.maxTokens)
  return values.length && values.every(v => v != null) ? Math.min(...values as number[]) : undefined
})
const systemSupported = computed(() => (config.value.synced ? config.value.lanes : [focusedLane.value]).every(l => l && modelFor(l.serviceId)?.capabilities.system))
function selectModel(index: number) { modelIndex.value = index; modelSearch.value = ''; provider.value = undefined; capabilityFilter.value = false; modelOpen.value = true }
async function chooseModel(serviceId: string) {
  if (busy.value) return
  const next = JSON.parse(JSON.stringify(config.value)) as WorkbenchConfig
  const sourceLaneId = next.lanes[modelIndex.value]?.laneId
  // 添加和替换共享选择窗口；选定模型后再修改栏位，取消不会产生空栏。
  if (modelIndex.value === next.lanes.length) {
    if (next.lanes.length >= 3) return
    const added = lane(serviceId)
    if (next.synced) added.config = { ...next.lanes[0]?.config }
    next.lanes.push(added)
  } else if (next.lanes[modelIndex.value]) next.lanes[modelIndex.value]!.serviceId = serviceId
  else return
  modelOpen.value = false
  await topology(next, sourceLaneId)
}
function addLane() { if (!busy.value && config.value.lanes.length < 3) selectModel(config.value.lanes.length) }
function toggleLibrary() {
  if (window.matchMedia('(max-width: 1200px)').matches) libraryOpen.value = !libraryOpen.value
  else libraryCollapsed.value = !libraryCollapsed.value
}
async function removeLane(index: number) { const next = JSON.parse(JSON.stringify(config.value)) as WorkbenchConfig; next.lanes.splice(index, 1); await topology(next) }
function details(a?: Attempt) { exportInitial.value = a; exportOpen.value = true }
function savePreset(resource?: WorkbenchResource) { presetResource.value = resource; presetOpen.value = true }
function newDraft(next?: WorkbenchConfig) { void guarded(() => { draft(next); libraryOpen.value = false }) }
function loadGroup(id: string) { void guarded(async () => { await open(id); libraryOpen.value = false }) }
function exportGroup(id: string) { void guarded(async () => { await open(id); if (active.value?.id === id) details() }) }
function oldSession(id: string) { void guarded(() => { legacyId.value = id; legacyOpen.value = true; libraryOpen.value = false }) }
function resetConfig() { if (config.value.synced) config.value.lanes.forEach(l => l.config = { system: '' }); else if (focusedLane.value) focusedLane.value.config = { system: '' } }
function rename(r: WorkbenchResource) { renameResource.value = r; renameValue.value = r.title; renameOpen.value = true }
async function saveName() {
  const t = tenant.value, r = renameResource.value, ticket = identity
  if (!t || !r || !renameValue.value.trim()) return
  try { const saved = await api.workbenchUpdate(t, r, { title: renameValue.value.trim() }); if (ticket !== identity) return; if (active.value?.id === r.id) active.value = { ...saved, attempts: attempts.value }; renameOpen.value = false; await refreshLists() }
  catch { /* 统一拦截器已提示。 */ }
}
function remove(r: WorkbenchResource) {
  const t = tenant.value, ticket = identity
  if (!t) return
  Modal.confirm({ title: '删除这段会话？', content: '已创建分叉的上下文快照仍然保留。', okText: '删除', okType: 'danger', cancelText: '取消', async onOk() {
    await api.workbenchDelete(t, r); if (ticket !== identity) return; if (active.value?.id === r.id) draft(); else if (active.value?.payload.source?.groupId === r.id) active.value.sourceAvailable = false; await refreshLists()
  } })
}
const price = (id: string) => {
  const p = modelFor(id)?.pricing
  if (!p) return '暂无价格'
  if (p.billingMode === 'REQUEST') return `${p.currency} ${Number(p.requestPriceFen || 0) / 100} / 次`
  return `${p.currency} 输入 ${Number(p.inputPriceFen || 0) / 100} / 输出 ${Number(p.outputPriceFen || 0) / 100} 每百万 Token${p.periodType === 'PEAK' ? '（高峰价）' : ''}`
}
function enter(e: KeyboardEvent) { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); if (canSend.value) void send() } }
function keydown(e: KeyboardEvent) { if (e.key === 'Escape') libraryOpen.value = false; if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); newDraft() } }
window.addEventListener('keydown', keydown)
onBeforeUnmount(() => { window.removeEventListener('keydown', keydown); clearTimeout(searchTimer) })
onBeforeRouteLeave(async () => {
  if (!busy.value) return true
  return new Promise<boolean>(resolve => Modal.confirm({ title: '离开将停止当前生成', okText: '停止并离开', cancelText: '继续生成', onOk: async () => { await stopAll(); resolve(true) }, onCancel: () => resolve(false) }))
})
</script>

<template>
  <div class="workbench-page" :class="{ 'library-collapsed': libraryCollapsed }">
    <header class="page-heading">
      <div><div class="page-eyebrow">EXPERIMENTS</div><h1 class="page-title">Playground</h1></div>
      <div class="page-actions">
        <a-button aria-controls="playground-library" @click="toggleLibrary"><HistoryOutlined /><span>会话与预设</span></a-button>
        <a-button type="primary" class="new-session" @click="newDraft()"><PlusOutlined />新建对话</a-button>
        <a-dropdown :trigger="['click']"><a-button type="text" aria-label="更多会话操作"><MoreOutlined /></a-button><template #overlay><a-menu>
          <a-menu-item :disabled="busy || !config.lanes.length" @click="savePreset()"><SaveOutlined /> 保存为个人预设</a-menu-item>
          <a-menu-item :disabled="!config.lanes.length" @click="details()"><DownloadOutlined /> 请求详情与导出</a-menu-item>
        </a-menu></template></a-dropdown>
      </div>
    </header>
    <a-spin :spinning="loading" wrapper-class-name="workbench-spin">
      <div v-if="!enabled && !loading" class="gate"><ExperimentOutlined /><h2>当前租户未开启 PlayGround</h2><p>请在租户设置中开启。已有会话与预设会保留。</p></div>
      <div v-else class="workbench-layout">
        <button v-if="libraryOpen" class="library-backdrop" aria-label="关闭会话列表" @click="libraryOpen = false" />
        <aside id="playground-library" class="library" :class="{ 'mobile-open': libraryOpen }" aria-label="会话与预设">
          <div class="library-title"><span class="section-label">工作区</span></div>
          <a-segmented v-model:value="libraryTab" :options="[{label:'我的会话',value:'sessions'},{label:'个人预设',value:'presets'}]" block />
          <a-input v-model:value="keyword" placeholder="搜索会话与预设" allow-clear><template #prefix><SearchOutlined /></template></a-input>
          <div class="library-items">
            <template v-if="libraryTab === 'sessions'">
              <div v-for="g in filteredGroups" :key="g.id" class="library-item" :class="{ active: active?.id === g.id }">
                <button class="resource-button" @click="loadGroup(g.id)"><strong>{{ g.title }}</strong><small>{{ g.payload.lanes.length === 1 ? '单模型' : `${g.payload.lanes.length} 模型对比` }}{{ g.payload.source ? ' · 分叉' : '' }}</small></button>
                <a-dropdown :trigger="['click']"><a-button type="text" size="small" :disabled="busy" aria-label="会话操作">···</a-button><template #overlay><a-menu><a-menu-item @click="rename(g)">重命名</a-menu-item><a-menu-item @click="exportGroup(g.id)">导出</a-menu-item><a-menu-item danger @click="remove(g)">删除</a-menu-item></a-menu></template></a-dropdown>
              </div>
              <template v-if="filteredLegacy.length"><div class="legacy-title">历史会话</div><button v-for="s in filteredLegacy" :key="s.sessionId" class="resource-button legacy-item" @click="oldSession(s.sessionId)"><strong>{{ s.title }}</strong><small>{{ s.modelName }} · {{ s.turnCount }} 轮</small></button></template>
              <a-empty v-if="!filteredGroups.length && !filteredLegacy.length" :description="keyword ? '没有找到会话' : '发送后会自动保存会话'" :image="undefined" />
            </template>
            <template v-else><div v-for="p in filteredPresets" :key="p.id" class="library-item"><button class="resource-button" :disabled="busy" @click="savePreset(p)"><strong>{{ p.title }}</strong><small>v{{ p.payload.versions?.at(-1)?.number }} · {{ p.payload.versions?.at(-1)?.config.lanes.length }} 栏配置</small><small>{{ p.description }}</small></button></div><a-empty v-if="!filteredPresets.length" :description="keyword ? '没有找到预设' : '保存配置，方便下次复用'" /></template>
          </div>
        </aside>
        <main class="workspace" :class="{ 'single-workspace': config.lanes.length === 1 }">
          <div v-if="models.length" class="model-toolbar" aria-label="已选模型">
            <div class="selected-models">
              <a-tooltip title="添加模型"><a-button class="add-lane" aria-label="添加模型" :disabled="busy || config.lanes.length >= 3" @click="addLane"><PlusOutlined /></a-button></a-tooltip>
              <div v-for="(l, i) in config.lanes" :key="l.laneId" class="model-chip">
                <button class="model-select" :disabled="busy" :aria-label="`选择模型 ${String.fromCharCode(65 + i)}`" @click="selectModel(i)"><ProviderLogo v-if="modelFor(l.serviceId)" :slug="modelFor(l.serviceId)!.provider" :size="22" /><span v-if="config.lanes.length > 1" class="lane-badge">{{ String.fromCharCode(65 + i) }}</span><strong>{{ modelFor(l.serviceId)?.name || '模型已失效，请替换' }}</strong><DownOutlined /></button>
                <a-button v-if="config.lanes.length > 1" type="text" size="small" :disabled="busy" :aria-label="`移除模型 ${String.fromCharCode(65 + i)}`" @click="removeLane(i)"><CloseOutlined /></a-button>
              </div>
            </div>
            <a-button class="parameter-control" type="text" aria-label="模型参数" @click="configOpen = true"><SettingOutlined /><span>参数</span></a-button>
          </div>
          <div v-if="source" class="source-note">分叉自 {{ source.title }} · {{ source.laneLabel || '配置 A' }}{{ source.roundNo ? ` · 第 ${source.roundNo} 轮` : '' }} <a-button v-if="active?.sourceAvailable !== false" type="link" size="small" @click="loadGroup(source.groupId)">返回源会话</a-button><span v-else> · 来源会话已删除</span></div>
          <div class="conversation" :class="{ 'is-empty': !roundNumbers.length, 'is-single': config.lanes.length === 1 }" :style="{ '--lane-count': config.lanes.length || 1 }">
            <div v-if="!models.length" class="empty-workspace"><ExperimentOutlined /><h2>没有可用的文本聊天模型</h2><p>请先在当前租户配置并启用文本聊天服务。</p></div>
            <div v-else-if="!roundNumbers.length" class="empty-workspace welcome">
              <div class="welcome-symbol"><ExperimentOutlined /></div>
              <h2>{{ config.lanes.length === 1 ? '从一个好问题开始' : '一个问题，多种可能' }}</h2>
              <p>{{ config.lanes.length === 1 ? '探索模型能力，找到适合你的回答。' : '并排探索不同模型，比较回答、速度与费用。' }}</p>
              <small v-if="active?.payload.prefix?.length">已继承 {{ active.payload.prefix.length }} 条有效历史消息</small>
              <div v-if="examples.length" class="examples"><button v-for="p in examples" :key="p.id" @click="prompt = p.prompt"><span class="example-copy"><strong>{{ p.title }}</strong><span>{{ p.description }}</span></span><ArrowRightOutlined /></button></div>
            </div>
            <section v-for="n in roundNumbers" :key="n" class="round"><div class="user-prompt"><p>{{ attempts.find(a => a.roundNo === n)?.prompt }}</p></div>
              <div class="lane-grid result-grid">
                <div v-for="(l, i) in config.lanes" :key="l.laneId" class="result-cell">
                  <template v-for="a in [picked(n, l.laneId)]" :key="a?.attemptId"><template v-if="a">
                    <div v-if="config.lanes.length > 1" class="reply-model"><span class="lane-badge">{{ String.fromCharCode(65 + i) }}</span><strong>{{ a.snapshot.modelName }}</strong></div>
                    <div v-if="a.status !== 'COMPLETED' || attempts.filter(x => x.roundNo === n && x.laneId === l.laneId).length > 1" class="result-status"><a-tag v-if="a.status !== 'COMPLETED'" :color="a.status === 'FAILED' ? 'error' : undefined">{{ statusLabel(a.status) }}</a-tag><a-select v-if="attempts.filter(x => x.roundNo === n && x.laneId === l.laneId).length > 1" :value="a.attemptId" size="small" :options="attempts.filter(x => x.roundNo === n && x.laneId === l.laneId).map(x => ({ value: x.attemptId, label: `尝试 ${x.attemptNo} · ${statusLabel(x.status)}` }))" @update:value="selectedAttempts[`${n}:${l.laneId}`] = $event" /></div>
                    <MarkdownReply v-if="a.reply" :text="a.reply" /><div v-else class="waiting">{{ ['PENDING','STREAMING'].includes(a.status) ? '等待模型内容…' : '没有生成内容' }}</div>
                    <a-alert v-if="a.error" :message="a.error.message" :description="a.error.retryAfterSeconds ? `可在 ${a.error.retryAfterSeconds} 秒后重试` : undefined" type="error" show-icon />
                    <small v-if="a.status === 'STOPPED'" class="muted">部分输出已保留，不计入后续上下文</small>
                    <div class="result-actions" aria-label="回答操作">
                      <a-tooltip title="复制回答"><a-button type="text" size="small" aria-label="复制回答" :disabled="!a.reply" @click="copyWorkbenchText(a.reply)"><CopyOutlined /></a-button></a-tooltip>
                      <a-tooltip title="请求详情"><a-button type="text" size="small" aria-label="请求详情" @click="details(a)"><CodeOutlined /></a-button></a-tooltip>
                      <a-tooltip v-if="['PENDING','STREAMING','STOPPING'].includes(a.status)" title="停止生成"><a-button type="text" size="small" danger aria-label="停止生成" @click="stop(a)"><StopOutlined /></a-button></a-tooltip>
                      <a-tooltip v-else-if="['FAILED','STOPPED'].includes(a.status)" title="重试本模型"><a-button type="text" size="small" aria-label="重试本模型" :disabled="busy" @click="retry(a)"><ReloadOutlined /></a-button></a-tooltip>
                      <a-tooltip title="从此回答分叉"><a-button type="text" size="small" aria-label="从此回答分叉" :disabled="busy || a.status !== 'COMPLETED'" @click="fork(a)"><BranchesOutlined /></a-button></a-tooltip>
                      <a-tooltip title="重新生成"><a-button type="text" size="small" aria-label="重新生成" :disabled="busy" @click="fork(a, true)"><ReloadOutlined /></a-button></a-tooltip>
                    </div>
                  </template></template>
                </div>
              </div>
            </section>
          </div>
          <div class="composer">
            <a-alert v-if="streamError" :message="streamError" type="error" show-icon closable @close="streamError = ''" />
            <a-alert v-if="validation && models.length" :message="validation" type="warning" show-icon />
            <div class="composer-box">
              <a-textarea v-model:value="prompt" aria-label="输入问题" :auto-size="{ minRows: 2, maxRows: 6 }" :maxlength="100000" :disabled="!models.length" :placeholder="config.lanes.length > 1 ? '输入问题，同时发送给所选模型…' : '输入问题，开始探索…'" @keydown="enter" />
              <div class="composer-footer"><span class="keyboard-hint">Enter 发送 · Shift + Enter 换行</span><a-button v-if="busy" danger @click="stopAll"><StopOutlined />停止全部</a-button><a-button v-else type="primary" :disabled="!canSend" @click="send()"><SendOutlined />发送</a-button></div>
            </div>
          </div>
        </main>
      </div>
    </a-spin>
    <a-drawer v-model:open="configOpen" title="模型配置" width="min(420px, 100vw)" class="config-drawer">
      <template v-if="focusedLane"><a-alert message="配置变更将应用于下一轮，历史快照保持不变" type="info" show-icon /><div class="sync-row"><strong>同步到各栏</strong><a-switch :checked="config.synced" :disabled="busy" @change="synchronize(configIndex, Boolean($event))" /></div>
        <a-radio-group v-model:value="configIndex" :disabled="busy" size="small"><a-radio-button v-for="(_, i) in config.lanes" :key="i" :value="i">配置 {{ String.fromCharCode(65 + i) }}</a-radio-button></a-radio-group>
        <a-form layout="vertical" class="config-form"><a-form-item label="系统提示词"><a-textarea :value="focusedLane.config.system || ''" :rows="6" :disabled="busy || !systemSupported" placeholder="例如：你是一位严谨的技术顾问，请用中文回答。" @update:value="patch(configIndex, 'system', $event)" /><small v-if="!systemSupported" class="muted">当前模型不支持系统提示词</small></a-form-item>
          <a-form-item v-for="[key, label] in [['temperature','Temperature'],['topP','Top P']] as const" :key="key" :label="label"><div class="parameter-row"><a-slider :value="focusedLane.config[key] ?? undefined" :min="bounds(key)?.min ?? 0" :max="bounds(key)?.max ?? 1" :step="0.01" :disabled="busy || !bounds(key)" @change="patch(configIndex, key, Number($event))" /><a-input-number :value="focusedLane.config[key]" :min="bounds(key)?.min" :max="bounds(key)?.max" :step="0.01" :disabled="busy || !bounds(key)" placeholder="默认" @update:value="patch(configIndex, key, $event == null ? null : Number($event))" /></div><small class="muted">{{ bounds(key) ? '留空使用模型默认值' : '模型未配置支持信息或共享范围冲突，参数未应用；可切换独立配置' }}</small><a-button v-if="focusedLane.config[key] != null" type="link" size="small" :disabled="busy" @click="patch(configIndex, key, null)">清空</a-button></a-form-item>
          <a-form-item label="输出 Token 数"><a-input-number :value="focusedLane.config.maxTokens" :min="1" :max="maxTokens" :precision="0" :disabled="busy || !maxTokens" placeholder="留空使用 PlayGround 上限" style="width: 100%" @update:value="patch(configIndex, 'maxTokens', $event == null ? null : Number($event))" /><small class="muted">{{ maxTokens ? `PlayGround 上限 ${maxTokens}；留空使用该上限` : '模型未配置支持信息，参数未应用' }}</small></a-form-item>
        </a-form><a-space><a-button :disabled="busy" @click="resetConfig">恢复默认</a-button><a-button type="primary" :disabled="busy" @click="savePreset()">保存预设</a-button></a-space>
      </template>
    </a-drawer>
    <a-modal v-model:open="modelOpen" :title="modelIndex === config.lanes.length ? '添加模型' : '选择模型'" :width="800" :footer="null">
      <div class="model-picker-controls"><a-input v-model:value="modelSearch" placeholder="搜索模型、供应商或介绍" allow-clear><template #prefix><SearchOutlined /></template></a-input><a-select v-model:value="provider" allow-clear placeholder="全部供应商" :options="[...new Set(models.map(m => m.provider))].map(p => ({label:providerName(p),value:p}))" /><a-checkbox v-model:checked="capabilityFilter">支持数值参数</a-checkbox></div>
      <div class="model-list"><button v-for="m in filteredModels" :key="m.serviceId" class="model-card" @click="chooseModel(m.serviceId)"><div class="model-card-heading"><ProviderLogo :slug="m.provider" :size="28" /><strong>{{ m.name }}</strong><span class="model-provider">{{ providerName(m.provider) }}</span><a-tag v-if="config.lanes[modelIndex]?.serviceId === m.serviceId" color="blue">当前模型</a-tag></div><p>{{ m.description || '暂无模型介绍' }}</p><small>上下文 {{ m.contextWindow ? `${m.contextWindow.toLocaleString()} Token` : '未知' }} · {{ price(m.serviceId) }}</small><small>参数：{{ [m.capabilities.system ? 'System' : '', m.capabilities.temperature ? 'Temperature' : '', m.capabilities.topP ? 'Top P' : '', m.capabilities.maxTokens ? 'Max Token' : ''].filter(Boolean).join(' / ') || '暂无已确认能力' }}</small></button><a-empty v-if="!filteredModels.length" description="没有符合条件的模型" /></div></a-modal>
    <ExportDialog v-model:open="exportOpen" :group="active" :draft-request="draftRequest" :lane-names="laneNames" :initial="exportInitial" />
    <PresetDialog v-if="tenant" v-model:open="presetOpen" :tenant="tenant" :config="config" :resource="presetResource" :presets="presets" :models="models" @changed="refreshLists" @load="newDraft" />
    <a-modal v-model:open="renameOpen" title="会话名称" :width="420" @ok="saveName"><a-input v-model:value="renameValue" :maxlength="60" @press-enter="saveName" /></a-modal>
    <a-drawer v-model:open="legacyOpen" title="一期会话 · 可继续聊天" width="100%" :destroy-on-close="true"><LegacyPlaygroundPage v-if="legacyOpen" :initial-session-id="legacyId" /></a-drawer>
  </div>
</template>

<style lang="scss" scoped>
// 工作台以内容为中心：会话导航、模型选择、回答与输入分别建立视觉层级。
.workbench-page { height: 100%; min-height: 0; display: flex; flex-direction: column; color: $color-text-primary; background: $color-bg; }
.workbench-spin { flex: 1; min-height: 0; overflow: hidden; :deep(.ant-spin-container) { height: 100%; } }
.workbench-layout { display: grid; grid-template-columns: 216px minmax(0, 1fr); height: 100%; position: relative; }
.library { background: $color-bg-secondary; border-right: 1px solid $color-border; padding: 18px 12px 14px; display: flex; flex-direction: column; gap: 16px; min-height: 0; }
.library-title, .library-item { display: flex; align-items: center; justify-content: space-between; }
.section-label { font-size: $font-size-caption; font-weight: 600; color: $color-text-secondary; letter-spacing: .8px; padding-left: 8px; }
.library :deep(.ant-segmented) { font-size: $font-size-caption; background: rgba($color-text-secondary, .07); }
.library :deep(.ant-input-affix-wrapper) { background: transparent; border-color: transparent; padding-left: 8px; box-shadow: none; &:focus-within { background: $color-bg; border-color: $color-primary; } input { background: transparent; font-size: $font-size-caption; } }
.library-items { flex: 1; min-height: 0; overflow-y: auto; .ant-empty { margin: 32px 0; font-size: $font-size-caption; } }
.library-item { border-radius: $radius-input; margin-bottom: 5px; transition: background .15s; &:hover { background: rgba($color-text-secondary, .06); } &.active { background: rgba($color-primary, .07); .resource-button strong { color: $color-primary; } } }
.resource-button { flex: 1; min-width: 0; border: 0; background: transparent; text-align: left; cursor: pointer; padding: 11px 10px; color: $color-text-primary; strong, small { display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; } strong { font-size: 13px; font-weight: 500; } small { color: $color-text-secondary; font-size: 11px; margin-top: 5px; } }
.legacy-title { color: $color-text-secondary; font-size: 11px; padding: 16px 10px 6px; }
.legacy-item { width: 100%; border-radius: $radius-input; &:hover { background: rgba($color-text-secondary, .06); } }
.workspace { display: flex; flex-direction: column; overflow: hidden; min-width: 0; min-height: 0; background: $color-bg; }
.source-note { font-size: $font-size-caption; color: $color-text-secondary; background: $color-bg-secondary; padding: 8px 24px; }
.conversation { flex: 1; min-height: 0; overflow: auto; padding: 0 24px 24px; scroll-padding-top: 24px; }
.lane-grid { display: grid; grid-template-columns: repeat(var(--lane-count), minmax(0, 1fr)); gap: 16px; }
.lane-badge { width: 18px; height: 18px; display: grid; place-items: center; border-radius: 5px; color: $color-text-secondary; background: $color-bg-secondary; font-size: 10px; font-weight: 600; }
.empty-workspace, .gate { display: flex; align-items: center; justify-content: center; flex-direction: column; text-align: center; padding: 32px 12px; h2 { margin: 16px 0 10px; font-size: $font-size-h2; font-weight: 600; } p, small { color: $color-text-secondary; line-height: 1.8; } }
.gate { height: 100%; > .anticon { font-size: 36px; color: $color-primary; } }
.is-empty { display: flex; flex-direction: column; }
.welcome { flex: 1; width: 100%; max-width: 640px; margin: 0 auto; padding: 22px 12px 16px; h2 { font-size: 28px; letter-spacing: -1px; margin: 8px 0 10px; } > p { font-size: 13px; margin: 0; } }
.welcome-symbol { width: 44px; height: 44px; display: grid; place-items: center; font-size: 24px; color: $color-primary; background: rgba($color-primary, .06); border-radius: 14px; margin-bottom: 14px; }
.examples { width: 100%; max-width: 520px; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin-top: 24px; button { display: flex; gap: 10px; align-items: center; justify-content: space-between; min-width: 0; background: $color-bg; border: 1px solid rgba($color-text-secondary, .12); border-radius: $radius-card; padding: 13px 14px; text-align: left; cursor: pointer; transition: border-color .15s, background .15s; .example-copy { min-width: 0; strong, > span { display: block; } strong { font-size: $font-size-caption; color: $color-text-primary; font-weight: 500; } > span { color: $color-text-secondary; font-size: 11px; margin-top: 5px; line-height: 1.5; } } > .anticon { color: $color-text-secondary; font-size: 11px; flex-shrink: 0; } &:hover { border-color: rgba($color-primary, .4); background: rgba($color-primary, .025); > .anticon { color: $color-primary; } } } }
.round { margin: 8px auto 28px; }
.is-single .round { max-width: 800px; }
.user-prompt { width: fit-content; max-width: 85%; margin: 16px 0 24px auto; padding: 10px 16px; background: $color-bg-secondary; border-radius: 16px; p { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; font-size: $font-size-body; line-height: 1.8; } }
.result-cell { min-width: 0; padding: 0 14px 12px; border-right: 1px solid $color-border; &:last-child { border-right: 0; } }
.result-status { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-bottom: 14px; .ant-tag { font-size: 10px; border: 0; border-radius: 5px; } .ant-select { min-width: 140px; max-width: 100%; } }
.waiting, .muted { color: $color-text-secondary; font-size: $font-size-caption; }
.result-actions { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 10px; .ant-btn { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; padding: 0; color: $color-text-secondary; font-size: 14px; &:hover { color: $color-text-primary; } } }
.single-workspace .composer { max-width: 848px; margin: 0 auto; }
.composer { flex-shrink: 0; width: 100%; padding: 12px 24px 16px; background: $color-bg; .ant-alert { margin-bottom: 10px; } }
.composer-box { border: 1px solid rgba($color-text-secondary, .2); border-radius: 14px; padding: 12px 14px 10px; box-shadow: 0 3px 14px rgba($color-text-primary, .035); transition: border-color .15s, box-shadow .15s; &:focus-within { border-color: rgba($color-primary, .6); box-shadow: 0 0 0 3px rgba($color-primary, .05); } :deep(textarea.ant-input) { padding: 2px; border: 0; box-shadow: none; resize: none; font-size: 13px; line-height: 1.7; background: transparent; } }
.composer-footer { margin-top: 8px; display: flex; gap: 12px; align-items: center; justify-content: space-between; .ant-btn { height: 32px; font-size: $font-size-caption; border-radius: $radius-input; box-shadow: none; } }
.sync-row { display: flex; justify-content: space-between; margin: 24px 0 18px; } .config-form { margin-top: 22px; }
.parameter-row { display: flex; gap: 14px; align-items: center; .ant-slider { flex: 1; } .ant-input-number { width: 84px; } }
.model-list { max-height: 55vh; overflow: auto; display: grid; gap: 10px; }
.model-card { padding: 16px; background: $color-bg; border: 1px solid rgba($color-text-secondary, .16); border-radius: $radius-card; text-align: left; cursor: pointer; color: $color-text-primary; p { margin: 10px 0; color: $color-text-secondary; font-size: 13px; line-height: 1.7; } small { display: block; margin-top: 6px; color: $color-text-secondary; line-height: 1.6; } &:hover { border-color: rgba($color-primary, .5); background: rgba($color-primary, .02); } }
.model-card-heading { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; strong { font-size: $font-size-body; overflow-wrap: anywhere; } }
.model-provider { margin-left: auto; color: $color-text-secondary; font-size: 11px; }
.library-backdrop { display: none; }
.library-collapsed { .workbench-layout { grid-template-columns: minmax(0, 1fr); } .library { display: none; } }
button:focus-visible { outline: 2px solid rgba($color-primary, .7); outline-offset: 3px; }
button:disabled { cursor: not-allowed; }


.page-heading { display: flex; justify-content: space-between; align-items: center; flex-shrink: 0; gap: 20px; padding: 24px 28px 22px; border-bottom: 1px solid $color-border; }
.page-eyebrow { margin-bottom: 8px; color: $color-primary; font-size: 12px; font-weight: 700; letter-spacing: 1px; }
.page-title { font-size: 27px; font-weight: 700; color: $color-text-primary; margin: 0; }
.page-actions { display: flex; gap: 12px; align-items: center; }
.new-session { display: inline-flex; align-items: center; gap: 6px; border-radius: $radius-button; box-shadow: none; }
.model-toolbar { display: flex; align-items: center; gap: 16px; flex-shrink: 0; padding: 16px 24px; border-bottom: 1px solid $color-border; }
.selected-models { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; min-width: 0; flex: 1; }
.add-lane { display: inline-flex; align-items: center; justify-content: center; padding: 0; width: 40px; height: 40px; flex-shrink: 0; border-radius: $radius-input; box-shadow: none; color: $color-text-secondary; border-color: rgba($color-text-secondary, .18); }
.model-chip { display: flex; align-items: center; min-width: 0; border: 1px solid rgba($color-text-secondary, .18); border-radius: $radius-input; background: $color-bg; padding: 0 5px 0 12px; height: 40px; > .ant-btn { width: 26px; height: 26px; color: $color-text-secondary; font-size: 11px; } }
.model-select { display: flex; align-items: center; gap: 8px; border: 0; background: transparent; padding: 0 8px 0 0; min-width: 0; height: 100%; cursor: pointer; color: $color-text-primary; strong { font-size: 13px; font-weight: 500; max-width: 200px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; } > .anticon { font-size: 9px; color: $color-text-secondary; } &:hover strong { color: $color-primary; } }
.parameter-control { flex-shrink: 0; color: $color-text-secondary; font-size: 12px; }
.reply-model { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; strong { min-width: 0; font-size: 12px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } }
.keyboard-hint { font-size: 10px; color: $color-text-secondary; }
.model-picker-controls { display: grid; grid-template-columns: minmax(0, 1fr) 160px auto; align-items: center; gap: 12px; padding: 8px 0 20px; margin-bottom: 20px; border-bottom: 1px solid $color-border; }
.model-list { padding: 2px; }

// 中等屏幕将会话列表改为覆盖式导航，为并排模型留出空间。
@media (max-width: 1200px) {
  .workbench-layout { grid-template-columns: minmax(0, 1fr); }
  .library, .library-collapsed .library { display: none; position: absolute; top: 0; bottom: 0; left: 0; width: 248px; z-index: 20; box-shadow: 8px 0 32px rgba($color-text-primary, .08); &.mobile-open { display: flex; } }
  .workbench-page { position: relative; }
  .library-backdrop { display: block; position: absolute; inset: 0; border: 0; background: rgba($color-text-primary, .16); z-index: 19; }
  .keyboard-hint { display: none; }
}
@media (max-width: 760px) {
  .page-heading { padding: 20px 16px 16px; gap: 16px; flex-wrap: wrap; }
  .page-title { font-size: 24px; }
  .page-actions { gap: 8px; }
  .page-actions .ant-btn { font-size: 12px; }
  .model-toolbar { padding: 12px 16px; gap: 6px; }
  .model-chip { flex-shrink: 0; }
  .model-select strong { max-width: 180px; }
  .selected-models { flex-wrap: nowrap; overflow-x: auto; padding: 2px; }
  .parameter-control { padding: 0 8px; span:not(.anticon) { display: none; } }
  .conversation { padding: 0 16px 12px; }
  .lane-grid { gap: 10px; grid-template-columns: repeat(var(--lane-count), minmax(220px, 1fr)); }
  .round { min-width: calc(var(--lane-count) * 220px + (var(--lane-count) - 1) * 10px); }
  .welcome { padding: 20px 6px; min-width: 0; h2 { font-size: 24px; } }
  .welcome-symbol { display: none; }
  .examples { margin-top: 20px; gap: 8px; button { padding: 12px; .example-copy > span { display: none; } } }
  .composer { padding: 10px 16px 16px; }
  .source-note { padding: 6px 16px; }
  .model-picker-controls { grid-template-columns: minmax(0, 1fr); }
}
@media (max-height: 820px) and (min-width: 761px) {
  .welcome { padding-top: 12px; padding-bottom: 12px; h2 { font-size: 24px; } }
  .welcome-symbol { display: none; }
  .examples { margin-top: 18px; button { padding: 10px 12px; } }
}
@media (prefers-reduced-motion: reduce) { button, .library-item, .composer-box { transition: none; } }
</style>
