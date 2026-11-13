<script setup lang="ts">
import Decimal from 'decimal.js'
import { computed, nextTick, onMounted, onUnmounted, reactive, ref } from 'vue'
import { ArrowLeftOutlined, AuditOutlined } from '@ant-design/icons-vue'
import { ConfigProvider } from 'ant-design-vue'
import { caseDetail, listCases, resolveCase } from '@/api/costReconciliation'
import type { CaseState, Decision, ReconciliationBatch, ReconciliationCase, ResolveCase } from '@/api/costReconciliation'
import { exchangeReconciliationHandoff, ReconciliationRequestError } from '@/api/reconciliationTransport'
import {
  createReconciliationContinuation, mainSiteOrigin, reconciliationBatch, takeReconciliationProof,
} from '@/utils/reconciliationContinuation'
import { useThemeStore } from '@/stores/theme'
import { createAntTheme } from '@/utils/antTheme'

const themeStore = useThemeStore()
const appearance = computed(() => createAntTheme(themeStore.resolvedMode))
const MoneyDecimal = Decimal.clone({ precision: 45 })
const code = reconciliationBatch(window.location.pathname)
const authenticated = ref(false)
const connecting = ref(false)
const sessionError = ref('')
const mainSite = ref('')
const state = ref<CaseState>('PENDING')
const batch = ref<ReconciliationBatch>()
const selected = ref<ReconciliationCase>()
const loading = ref(false)
const detailLoading = ref(false)
const submitting = ref(false)
const error = ref('')
const formError = ref('')
const feedback = ref('')
const dialog = ref<HTMLDialogElement>()
const detailPanel = ref<HTMLElement>()
const detailMinHeight = ref(0)
const preview = ref<{ id: string; command: ResolveCase; amount: string }>()
const draft = reactive({ decision: 'CHARGE' as Decision, input: '', cached: '', output: '', evidence: false })
let batchVersion = 0
let detailVersion = 0
let sessionVersion = 0
let credential: string | null = null
let sessionValidated = false

const usesTokens = computed(() => selected.value?.price?.mode === 'TOKEN' && draft.decision === 'CHARGE')
const money = (amount: string | null | undefined) => amount == null ? '—' : `¥${new MoneyDecimal(amount).div(100).toFixed()}`
const formatTime = (value: string) => new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
}).format(new Date(value))
const reasons: Record<string, string> = {
  USAGE_INCOMPLETE: '缺少算价所需的上游分类用量，请对照这次调用的上游记录。',
  CHARGEABILITY_UNKNOWN: '已锁定本次调用的历史单价，请核对上游是否实际计费。',
  UNAPPLIED_SETTLEMENT: '这笔调用的终态费用曾等待入账。',
}
const reason = (value: string) => reasons[value] ?? '请核对这笔调用的上游证据。'

function message(failure: unknown, fallback: string): string {
  if (failure instanceof Error) return failure.message
  return fallback
}

async function connect() {
  if (connecting.value || !code) return
  connecting.value = true
  sessionError.value = ''
  const version = ++sessionVersion
  try {
    if (window.parent !== window) throw new Error('请在新标签页中打开补账链接')
    mainSite.value = mainSiteOrigin()
    const fragment = window.location.hash
    if (!fragment) {
      const target = await createReconciliationContinuation(code)
      if (version === sessionVersion) window.location.replace(target)
      return
    }
    window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search)
    const proof = takeReconciliationProof(code, fragment)
    const session = await exchangeReconciliationHandoff(code, proof.code, proof.verifier)
    if (version !== sessionVersion) return
    if (!/^crs_[A-Za-z0-9_-]{43}$/.test(session.token)) throw new Error('补账服务返回的凭证无效')
    credential = session.token
    authenticated.value = true
    await refresh()
  } catch (failure) {
    if (version === sessionVersion) sessionError.value = message(failure, '无法连接 Verse，请重试。')
  } finally {
    if (version === sessionVersion) connecting.value = false
  }
}

function clearSession() {
  sessionVersion++
  batchVersion++
  detailVersion++
  credential = null
  sessionValidated = false
  authenticated.value = false
  connecting.value = false
  submitting.value = false
  batch.value = undefined
  selected.value = undefined
  dialog.value?.close()
  preview.value = undefined
  feedback.value = ''
  error.value = ''
  formError.value = ''
  loading.value = false
  detailLoading.value = false
  detailMinHeight.value = 0
}

function reserveDetailHeight() {
  // 切换时保留已展开的详情高度，避免加载占位或较短账单让页面滚动位置回缩。
  detailMinHeight.value = detailPanel.value?.offsetHeight ?? 0
}

function resetDetailHeight() {
  detailMinHeight.value = 0
}

function reconnectIfExpired(failure: unknown): boolean {
  if (!(failure instanceof ReconciliationRequestError) || failure.status !== 401) return false
  const wasValidated = sessionValidated
  clearSession()
  // 新凭证尚未通过读取时先停住，避免代理配置错误或立即撤销导致循环跳转。
  if (wasValidated) void connect()
  else sessionError.value = '无法验证补账会话，请重新连接 Verse。'
  return true
}

function pageHidden(event: PageTransitionEvent) {
  if (event.persisted) clearSession()
}

function pageRestored(event: PageTransitionEvent) {
  if (event.persisted) void connect()
}

onMounted(() => {
  window.addEventListener('pagehide', pageHidden)
  window.addEventListener('pageshow', pageRestored)
  window.addEventListener('resize', resetDetailHeight)
  void connect()
})
onUnmounted(() => {
  window.removeEventListener('pagehide', pageHidden)
  window.removeEventListener('pageshow', pageRestored)
  window.removeEventListener('resize', resetDetailHeight)
  clearSession()
})

async function refresh(append = false) {
  if (!code || !credential) return
  const version = ++batchVersion
  loading.value = true
  error.value = ''
  const previous = batch.value
  try {
    const result = await listCases(credential, code, state.value, append ? previous?.nextCursor ?? undefined : undefined)
    if (version !== batchVersion) return
    sessionValidated = true
    batch.value = { ...result, items: append ? [...(previous?.items ?? []), ...result.items] : result.items }
  } catch (failure) {
    if (version === batchVersion && !reconnectIfExpired(failure)) error.value = message(failure, '暂时无法读取本批次。')
  } finally {
    if (version === batchVersion) loading.value = false
  }
}

function switchState(next: CaseState) {
  if (state.value === next || submitting.value) return
  reserveDetailHeight()
  state.value = next
  detailVersion++
  selected.value = undefined
  batch.value = undefined
  preview.value = undefined
  detailLoading.value = false
  void refresh()
}

async function selectCase(id: string) {
  if (!code || !credential || submitting.value) return
  reserveDetailHeight()
  const version = ++detailVersion
  detailLoading.value = true
  selected.value = undefined
  formError.value = ''
  feedback.value = ''
  preview.value = undefined
  Object.assign(draft, { decision: 'CHARGE', input: '', cached: '', output: '', evidence: false })
  try {
    const result = await caseDetail(credential, code, id)
    if (version !== detailVersion) return
    selected.value = result
    await nextTick()
    document.getElementById('reconciliation-detail-heading')?.focus({ preventScroll: true })
  } catch (failure) {
    if (version === detailVersion && !reconnectIfExpired(failure)) formError.value = message(failure, '暂时无法读取账单。')
  } finally {
    if (version === detailVersion) detailLoading.value = false
  }
}

function openPreview() {
  const row = selected.value
  if (!row || row.state !== 'PENDING' || !row.price) return
  formError.value = ''
  if (!draft.evidence) {
    formError.value = '请先确认已核对该请求的上游证据。'
    return
  }
  const command: ResolveCase = {
    decision: draft.decision, version: row.version, evidenceConfirmed: true, submissionKey: crypto.randomUUID(),
  }
  let amount = '¥0'
  if (usesTokens.value) {
    if (![draft.input, draft.cached, draft.output].every(value => /^[0-9]{1,12}$/.test(value))
      || Number(draft.cached) > Number(draft.input)) {
      formError.value = '请输入完整的非负整数 Token 用量，缓存命中量不能大于输入量。'
      return
    }
    Object.assign(command, { inputTokens: Number(draft.input), cachedTokens: Number(draft.cached), outputTokens: Number(draft.output) })
    const { inputFen, cachedFen, outputFen } = row.price
    if (inputFen == null || cachedFen == null || outputFen == null) {
      formError.value = '这笔账单缺少历史定价，请保留待补账。'
      return
    }
    const fen = new MoneyDecimal(draft.input).minus(draft.cached).times(inputFen)
      .plus(new MoneyDecimal(draft.cached).times(cachedFen)).plus(new MoneyDecimal(draft.output).times(outputFen)).div(1_000_000)
    amount = money(fen.toFixed())
  } else if (draft.decision === 'CHARGE') {
    amount = money(row.price.requestFen)
  }
  preview.value = { id: row.id, command, amount }
  dialog.value?.showModal()
}

async function confirm() {
  const value = preview.value
  if (!value || !code || !credential || submitting.value) return
  const version = sessionVersion
  submitting.value = true
  formError.value = ''
  try {
    const resolved = await resolveCase(credential, code, value.id, value.command)
    if (version !== sessionVersion) return
    dialog.value?.close()
    preview.value = undefined
    state.value = 'RESOLVED'
    selected.value = resolved
    feedback.value = '处理结果已保存。'
    await refresh()
  } catch (failure) {
    if (version === sessionVersion && !reconnectIfExpired(failure)) {
      formError.value = message(failure, '提交失败，请重试或刷新账单。')
    }
  } finally {
    if (version === sessionVersion) submitting.value = false
  }
}
</script>

<template>
  <ConfigProvider :theme="appearance">
    <header class="masthead">
      <div class="masthead-inner">
        <div class="brand" aria-label="Verse"><span class="brand-mark" aria-hidden="true">V</span>Verse</div>
        <a-button v-if="mainSite && !submitting" type="text" :href="mainSite" referrerpolicy="no-referrer">
          <template #icon><ArrowLeftOutlined /></template>返回 Verse
        </a-button>
      </div>
    </header>
    <main class="surface">

    <div v-if="!code" class="panel session-panel">
      <h1>自助补账</h1>
      <p>请使用告警邮件或短信中的补账链接进入。</p>
    </div>

    <section v-else-if="!authenticated" class="panel session-panel" aria-labelledby="session-title">
      <h1 id="session-title">连接 Verse</h1>
      <a-alert v-if="sessionError" type="error" :message="sessionError" show-icon />
      <a-button v-if="sessionError" type="primary" @click="connect">重新连接</a-button>
      <p v-else role="status" class="loading"><a-spin size="small" /> 正在确认 Verse 登录状态…</p>
    </section>

    <template v-else>
      <section class="intro">
        <div class="intro-title"><span class="page-icon"><AuditOutlined aria-hidden="true" /></span><h1>自助补账</h1></div>
        <p class="muted">核对本次扫描发现的账单。Verse 按请求发生时的定价计算费用。</p>
        <div class="batch">
          <template v-if="batch">
          <span>扫描批次 <strong class="mono">#{{ batch.scanId }}</strong></span>
          <span>{{ formatTime(batch.scannedAt) }}（北京时间）</span>
          </template>
        </div>
      </section>
      <a-alert class="page-alert" type="info" message="待补账期间，模型调用继续按已确认费用判断限额。" show-icon />
      <a-alert v-if="error" class="page-alert" type="error" :message="error" show-icon>
        <template #action><a-button size="small" @click="refresh()">重试</a-button></template>
      </a-alert>
      <div class="columns">
        <section class="panel" aria-labelledby="queue-title">
          <h2 id="queue-title">本批次账单</h2>
          <p class="muted">仅展示本次扫描发现的对账差异</p>
          <div class="tabs" aria-label="账单状态">
            <a-button :type="state === 'PENDING' ? 'primary' : 'default'" :aria-pressed="state === 'PENDING'" :disabled="submitting" @click="switchState('PENDING')">
              待补账<span class="count">{{ batch?.pendingCount ?? '—' }}</span>
            </a-button>
            <a-button :type="state === 'RESOLVED' ? 'primary' : 'default'" :aria-pressed="state === 'RESOLVED'" :disabled="submitting" @click="switchState('RESOLVED')">
              已处理<span class="count">{{ batch?.resolvedCount ?? '—' }}</span>
            </a-button>
          </div>
          <p v-if="loading && !batch" role="status" class="loading"><a-spin size="small" /> 正在加载账单…</p>
          <a-empty v-else-if="batch && batch.items.length === 0" :description="`本批次暂无${state === 'PENDING' ? '待补账' : '已处理'}记录`" />
          <ul v-else class="queue">
            <li v-for="row in batch?.items" :key="row.id">
              <button type="button" :aria-current="selected?.id === row.id ? 'true' : undefined" :disabled="submitting"
                @click="selectCase(row.id)">
                <strong>{{ row.model || row.serviceId || '模型调用' }}</strong>
                <span class="mono">{{ row.requestId }}</span>
                <span>{{ formatTime(row.requestedAt) }} · {{ row.source === 'PLAYGROUND' ? 'Playground' : 'API' }}</span>
              </button>
            </li>
          </ul>
          <a-button v-if="batch?.nextCursor" :loading="loading" block @click="refresh(true)">加载更多</a-button>
        </section>

        <section ref="detailPanel" class="panel detail-panel" :style="{ minHeight: detailMinHeight ? `${detailMinHeight}px` : undefined }"
          :aria-busy="detailLoading" aria-labelledby="reconciliation-detail-heading">
          <div class="line">
            <h2 id="reconciliation-detail-heading" tabindex="-1">核对请求</h2>
            <a-tag v-if="selected" :color="selected.state === 'RESOLVED' ? 'success' : 'warning'">
              {{ selected.state === 'RESOLVED' ? '已处理' : '待补账' }}
            </a-tag>
          </div>
          <p v-if="feedback" role="status" class="feedback">{{ feedback }}</p>
          <p v-if="detailLoading" role="status" class="loading"><a-spin size="small" /> 正在加载账单详情…</p>
          <a-empty v-else-if="!selected" description="从账单清单选择一条请求" />
          <template v-else>
            <dl class="facts">
              <div class="request-id"><dt>请求标识</dt><dd class="mono">{{ selected.requestId }}</dd></div>
              <div><dt>模型</dt><dd>{{ selected.model || selected.serviceId || '—' }}</dd></div>
              <div><dt>请求时间</dt><dd>{{ formatTime(selected.requestedAt) }}</dd></div>
              <div><dt>计费类型</dt><dd>{{ selected.price?.mode === 'TOKEN' ? '按 Token' : selected.price?.mode === 'REQUEST' ? '按次' : '—' }}</dd></div>
            </dl>
            <p class="note request-note">{{ reason(selected.reason) }}</p>
            <p v-if="selected.reviewRequired" class="note">有新的上游证据待运维复核，当前入账结果以此页显示为准。</p>
            <dl v-if="selected.resolution" class="facts result">
              <div><dt>结论</dt><dd>{{ selected.resolution.status === 'NOT_CHARGEABLE' ? '确认不计费' : '费用已确认' }}</dd></div>
              <div><dt>入账金额</dt><dd>{{ selected.resolution.status === 'NOT_CHARGEABLE' ? '¥0' : money(selected.resolution.costFen) }}</dd></div>
              <div><dt>处理方式</dt><dd>{{ selected.resolution.method === 'AUTO' ? '自动结案' : '管理员补账' }}</dd></div>
              <div><dt>处理时间</dt><dd>{{ formatTime(selected.resolution.resolvedAt) }}</dd></div>
              <div v-if="selected.resolution.inputTokens != null">
                <dt>分类用量（输入 / 缓存命中 / 输出）</dt>
                <dd>{{ selected.resolution.inputTokens }} / {{ selected.resolution.cachedTokens }} / {{ selected.resolution.outputTokens }}</dd>
              </div>
            </dl>
            <form v-else-if="selected.state === 'PENDING' && selected.price" class="review-form" @submit.prevent="openPreview">
              <fieldset>
                <legend>核对结论</legend>
                <a-radio-group v-model:value="draft.decision" class="choices">
                  <a-radio value="CHARGE">{{ selected.price.mode === 'TOKEN' ? '按上游用量补账' : '确认按次计费' }}</a-radio>
                  <a-radio value="NO_CHARGE">确认不计费</a-radio>
                </a-radio-group>
              </fieldset>
              <div class="usage-section">
                <fieldset v-if="usesTokens">
                  <legend>上游返回的分类 Token</legend>
                  <div class="token-fields">
                    <label>输入 Token<a-input v-model:value="draft.input" inputmode="numeric" :maxlength="12" placeholder="含缓存命中" /></label>
                    <label>缓存命中 Token<a-input v-model:value="draft.cached" inputmode="numeric" :maxlength="12" placeholder="确认无命中填 0" /></label>
                    <label>输出 Token<a-input v-model:value="draft.output" inputmode="numeric" :maxlength="12" /></label>
                  </div>
                </fieldset>
                <p class="note pricing-note">
                  <strong>Verse 历史定价</strong>
                  <span v-if="selected.price.mode === 'REQUEST'">{{ money(selected.price.requestFen) }} / 次</span>
                  <span v-else>每百万 Token {{ money(selected.price.inputFen) }} 未命中 · {{ money(selected.price.cachedFen) }} 命中 · {{ money(selected.price.outputFen) }} 输出</span>
                </p>
              </div>
              <div class="form-footer">
                <a-checkbox v-model:checked="draft.evidence">我已核对该请求的上游证据</a-checkbox>
                <div class="actions">
                  <a-button @click="feedback = '已保留待补账。'">保留待补账</a-button>
                  <a-button type="primary" html-type="submit">预览入账</a-button>
                </div>
              </div>
            </form>
          </template>
          <p v-if="formError" class="error" role="alert">{{ formError }}</p>
        </section>
      </div>
    </template>

    <dialog ref="dialog" aria-labelledby="confirm-title" @cancel.prevent="!submitting && dialog?.close()">
      <h2 id="confirm-title">确认补账</h2>
      <p>确认核对结论及本次入账金额。</p>
      <div class="line note"><strong>本次入账</strong><strong>{{ preview?.amount }}</strong></div>
      <p v-if="formError" class="error" role="alert">{{ formError }}</p>
      <div class="actions">
        <a-button :disabled="submitting" autofocus @click="dialog?.close()">返回修改</a-button>
        <a-button type="primary" :loading="submitting" @click="confirm">确认提交</a-button>
      </div>
    </dialog>
    </main>
  </ConfigProvider>
</template>

<style scoped lang="scss">
:global(html) { scrollbar-gutter: stable; }
.surface, .masthead-inner { width: min(1184px, calc(100% - 32px)); margin-inline: auto; }
.surface { padding-block: clamp(20px, 4vw, 36px) 48px; }
.masthead { background: $color-bg; border-bottom: 1px solid $color-border; }
.masthead-inner { display: flex; justify-content: space-between; align-items: center; gap: 8px; min-height: $header-height; }
.brand { display: flex; align-items: center; gap: 10px; font-size: $font-size-h3; font-weight: 700; }
.brand-mark, .page-icon { display: inline-grid; flex: none; place-items: center; }
.brand-mark { width: 32px; height: 32px; background: $color-primary-solid; color: $color-on-primary; border-radius: $radius-input; font-size: 22px; font-weight: 800; }
.intro { display: grid; gap: 10px; margin-bottom: 18px; }
.intro-title { display: flex; align-items: center; gap: 12px; }
.page-icon { width: 40px; height: 40px; background: $color-primary-bg; color: $color-primary; border-radius: $radius-card; font-size: 20px; }
h1 { font-size: $font-size-title; line-height: 1.25; }
h2 { font-size: $font-size-h3; }
.muted, dt { color: $color-text-secondary; }
.batch { display: flex; flex-wrap: wrap; gap: 4px 16px; min-height: 18px; color: $color-text-secondary; font-size: $font-size-caption; }
.batch strong { color: $color-text-primary; }
.note, .feedback { margin-block: 12px; padding: 12px 14px; border-radius: $radius-input; background: $color-bg-secondary; line-height: 1.6; }
.feedback { color: $color-success; }
.page-alert { margin-bottom: 16px; }
.mono { font-family: ui-monospace, Consolas, monospace; overflow-wrap: anywhere; }
.columns { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.7fr); gap: 16px; align-items: start; }
.panel, dialog { color: $color-text-primary; background: $color-bg; border: 1px solid $color-border; border-radius: $radius-card; padding: clamp(16px, 3vw, 24px); box-shadow: $shadow-light; }
.detail-panel { min-height: 360px; padding: clamp(20px, 3vw, 32px); }
.detail-panel > .line { min-height: 28px; }
.panel > h2 + p { margin-top: 6px; }
.session-panel { display: grid; gap: 12px; max-width: 440px; margin: 36px auto; }
.tabs, .line, .actions { display: flex; gap: 10px; align-items: center; }
.line { justify-content: space-between; }
.actions { justify-content: flex-end; margin-top: 16px; flex-wrap: wrap; }
.tabs { margin: 14px 0; flex-wrap: wrap; }
.count { margin-inline-start: 5px; font-variant-numeric: tabular-nums; }
.loading { display: flex; align-items: center; gap: 8px; color: $color-text-secondary; padding-block: 16px; }
.queue { list-style: none; display: grid; gap: 8px; }
.queue:not(:empty) { margin-bottom: 12px; }
.queue button { width: 100%; display: grid; gap: 5px; text-align: left; padding: 12px; color: $color-text-primary; background: $color-bg; border: 1px solid $color-border; border-radius: $radius-input; font: inherit; cursor: pointer; overflow-wrap: anywhere; }
.queue button:hover:not(:disabled) { background: $color-bg-hover; }
.queue button:focus-visible { outline: 2px solid $color-primary; outline-offset: 2px; }
.queue button:disabled { cursor: default; }
.queue [aria-current='true'] { border-color: $color-primary; background: $color-primary-bg; }
.queue span, dt { color: $color-text-secondary; font-size: $font-size-caption; }
.facts { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 20px 24px; margin-top: 24px; }
.request-id { grid-column: 1 / -1; }
dt { margin-bottom: 6px; }
dd { overflow-wrap: anywhere; }
.request-note { margin-block: 24px 0; padding: 14px 16px; }
.result { grid-template-columns: repeat(2, minmax(0, 1fr)); border-top: 1px solid $color-border; padding-top: 24px; }
.review-form { display: grid; gap: 28px; margin-top: 28px; padding-top: 24px; border-top: 1px solid $color-border; }
fieldset { min-width: 0; border: 0; }
legend { margin-bottom: 14px; font-weight: 600; }
.choices { display: flex; flex-wrap: wrap; gap: 12px 24px; }
.choices :deep(.ant-radio-wrapper) { margin-inline-end: 0; }
.usage-section { display: grid; gap: 20px; }
.token-fields label { display: grid; gap: 10px; }
.token-fields { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
.token-fields :deep(.ant-input) { min-height: 40px; }
.pricing-note { display: grid; gap: 6px; margin: 0; padding: 16px; font-size: $font-size-caption; color: $color-text-secondary; }
.pricing-note strong { color: $color-text-primary; font-size: $font-size-body; }
.form-footer { display: grid; gap: 24px; padding-top: 24px; border-top: 1px solid $color-border; }
.form-footer .actions { margin-top: 0; }
.form-footer .actions :deep(.ant-btn) { min-height: 40px; }
.error { color: $color-danger; margin-top: 10px; }
dialog { width: min(440px, calc(100% - 32px)); margin: auto; }
dialog h2 { margin-bottom: 8px; }
dialog::backdrop { background: var(--verse-overlay); }
@media (max-width: 740px) {
  .columns, .token-fields { grid-template-columns: minmax(0, 1fr); }
  .facts { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .review-form { gap: 24px; }
}
@media (max-width: 420px) {
  .facts { grid-template-columns: minmax(0, 1fr); }
  .form-footer .actions :deep(.ant-btn) { flex: 1; }
}
</style>
