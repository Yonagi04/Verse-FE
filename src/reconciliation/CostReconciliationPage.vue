<script setup lang="ts">
import Decimal from 'decimal.js'
import { computed, nextTick, onMounted, onUnmounted, reactive, ref } from 'vue'
import { caseDetail, listCases, resolveCase } from '@/api/costReconciliation'
import type { CaseState, Decision, ReconciliationBatch, ReconciliationCase, ResolveCase } from '@/api/costReconciliation'
import { login, logout } from '@/api/user'
import { clearAuth, getToken, setToken } from '@/utils/auth'

const match = /^\/([A-Za-z][A-Za-z0-9]{7})\/?$/.exec(window.location.pathname)
const MoneyDecimal = Decimal.clone({ precision: 45 })
const code = match?.[1]
const authenticated = ref(Boolean(getToken()))
const credentials = reactive({ username: '', password: '' })
const state = ref<CaseState>('PENDING')
const batch = ref<ReconciliationBatch>()
const selected = ref<ReconciliationCase>()
const loading = ref(false)
const detailLoading = ref(false)
const signingIn = ref(false)
const submitting = ref(false)
const error = ref('')
const formError = ref('')
const feedback = ref('')
const dialog = ref<HTMLDialogElement>()
const preview = ref<{ id: string; command: ResolveCase; amount: string }>()
const draft = reactive({ decision: 'CHARGE' as Decision, input: '', cached: '', output: '', evidence: false })
let batchVersion = 0
let detailVersion = 0

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

async function signIn() {
  if (signingIn.value || !code) return
  signingIn.value = true
  error.value = ''
  try {
    const session = await login({ ...credentials })
    setToken(session.token)
    authenticated.value = true
    await refresh()
  } catch (failure) {
    error.value = message(failure, '登录失败，请重试。')
  } finally {
    credentials.password = ''
    signingIn.value = false
  }
}

function expired() {
  batchVersion++
  detailVersion++
  authenticated.value = false
  batch.value = undefined
  selected.value = undefined
  dialog.value?.close()
  preview.value = undefined
  feedback.value = ''
  formError.value = ''
  loading.value = false
  detailLoading.value = false
}

async function signOut() {
  try {
    await logout()
  } finally {
    clearAuth()
    expired()
  }
}

function syncSession(event: StorageEvent) {
  if (event.key === 'verse_token' && event.oldValue !== event.newValue) window.location.reload()
}

onMounted(() => {
  window.addEventListener('verse-session-changed', expired)
  window.addEventListener('storage', syncSession)
  if (authenticated.value) void refresh()
})
onUnmounted(() => {
  window.removeEventListener('verse-session-changed', expired)
  window.removeEventListener('storage', syncSession)
})

async function refresh(append = false) {
  if (!code || !authenticated.value) return
  const version = ++batchVersion
  loading.value = true
  error.value = ''
  const previous = batch.value
  try {
    const result = await listCases(code, state.value, append ? previous?.nextCursor ?? undefined : undefined)
    if (version !== batchVersion) return
    batch.value = { ...result, items: append ? [...(previous?.items ?? []), ...result.items] : result.items }
  } catch (failure) {
    if (version === batchVersion && authenticated.value) error.value = message(failure, '暂时无法读取本批次。')
  } finally {
    if (version === batchVersion) loading.value = false
  }
}

function switchState(next: CaseState) {
  if (state.value === next || submitting.value) return
  state.value = next
  detailVersion++
  selected.value = undefined
  batch.value = undefined
  preview.value = undefined
  detailLoading.value = false
  void refresh()
}

async function selectCase(id: string) {
  if (!code || submitting.value) return
  const version = ++detailVersion
  detailLoading.value = true
  selected.value = undefined
  formError.value = ''
  feedback.value = ''
  preview.value = undefined
  Object.assign(draft, { decision: 'CHARGE', input: '', cached: '', output: '', evidence: false })
  try {
    const result = await caseDetail(code, id)
    if (version !== detailVersion) return
    selected.value = result
    await nextTick()
    document.getElementById('reconciliation-detail-heading')?.focus()
  } catch (failure) {
    if (version === detailVersion && authenticated.value) formError.value = message(failure, '暂时无法读取账单。')
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
  if (!value || !code || submitting.value) return
  submitting.value = true
  formError.value = ''
  try {
    const resolved = await resolveCase(code, value.id, value.command)
    dialog.value?.close()
    preview.value = undefined
    state.value = 'RESOLVED'
    selected.value = resolved
    feedback.value = '处理结果已保存。'
    await refresh()
  } catch (failure) {
    if (authenticated.value) formError.value = message(failure, '提交失败，请重试或刷新账单。')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <main class="surface">
    <header class="masthead">
      <a class="wordmark" :href="code ? '/' + code : '/reconciliation.html'" aria-label="Verse 自助补账">Verse</a>
      <button v-if="authenticated" class="quiet" type="button" :disabled="submitting" @click="signOut">退出登录</button>
    </header>

    <div v-if="!code" class="panel login">
      <h1>自助补账</h1>
      <p>请使用告警邮件或短信中的补账链接进入。</p>
    </div>

    <section v-else-if="!authenticated" class="panel login" aria-labelledby="login-title">
      <p class="kicker">VERSE 费用核对</p>
      <h1 id="login-title">登录后自助补账</h1>
      <p class="muted">登录后继续查看当前扫描批次。</p>
      <form @submit.prevent="signIn">
        <label>用户名或手机号<input v-model="credentials.username" autocomplete="username" maxlength="50" required /></label>
        <label>密码<input v-model="credentials.password" type="password" autocomplete="current-password" maxlength="72" required /></label>
        <p v-if="error" role="alert" class="error">{{ error }}</p>
        <button class="primary" type="submit" :disabled="signingIn">{{ signingIn ? '登录中…' : '登录并继续' }}</button>
      </form>
    </section>

    <template v-else>
      <section class="intro">
        <p class="kicker">VERSE 费用核对</p>
        <h1>自助补账</h1>
        <p class="muted">核对本次扫描发现的账单。Verse 按请求发生时的定价计算费用。</p>
        <div v-if="batch" class="batch">
          <strong>本次扫描</strong><span class="mono">{{ batch.scanId }}</span>
          <span>{{ formatTime(batch.scannedAt) }}（北京时间）</span>
        </div>
        <p class="note">待补账期间，模型调用继续按已确认费用判断限额。</p>
      </section>
      <p v-if="error" role="alert" class="error">{{ error }} <button class="quiet" type="button" @click="refresh()">重试</button></p>
      <div class="columns">
        <section class="panel" aria-labelledby="queue-title">
          <h2 id="queue-title">本批次账单</h2>
          <p class="muted">仅展示本次扫描发现的对账差异</p>
          <div class="tabs" aria-label="账单状态">
            <button type="button" :aria-pressed="state === 'PENDING'" @click="switchState('PENDING')">
              待补账 <span>{{ batch?.pendingCount ?? '—' }}</span>
            </button>
            <button type="button" :aria-pressed="state === 'RESOLVED'" @click="switchState('RESOLVED')">
              已处理 <span>{{ batch?.resolvedCount ?? '—' }}</span>
            </button>
          </div>
          <p v-if="loading && !batch" role="status" class="muted">正在加载账单…</p>
          <p v-else-if="batch && batch.items.length === 0" class="muted">本批次暂无{{ state === 'PENDING' ? '待补账' : '已处理' }}记录。</p>
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
          <button v-if="batch?.nextCursor" class="quiet" type="button" :disabled="loading" @click="refresh(true)">加载更多</button>
        </section>

        <section class="panel" aria-labelledby="reconciliation-detail-heading">
          <div class="line">
            <h2 id="reconciliation-detail-heading" tabindex="-1">核对请求</h2>
            <span v-if="selected" class="pill" :class="{ done: selected.state === 'RESOLVED' }">
              {{ selected.state === 'RESOLVED' ? '已处理' : '待补账' }}
            </span>
          </div>
          <p v-if="feedback" role="status" class="feedback">{{ feedback }}</p>
          <p v-if="detailLoading" role="status" class="muted">正在加载账单详情…</p>
          <p v-else-if="!selected" class="muted">从清单选择一条请求。</p>
          <template v-else>
            <dl class="facts">
              <div><dt>请求标识</dt><dd class="mono">{{ selected.requestId }}</dd></div>
              <div><dt>模型</dt><dd>{{ selected.model || selected.serviceId || '—' }}</dd></div>
              <div><dt>请求时间</dt><dd>{{ formatTime(selected.requestedAt) }}</dd></div>
              <div><dt>计费类型</dt><dd>{{ selected.price?.mode === 'TOKEN' ? '按 Token' : selected.price?.mode === 'REQUEST' ? '按次' : '—' }}</dd></div>
            </dl>
            <p class="note">{{ reason(selected.reason) }}</p>
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
            <form v-else-if="selected.state === 'PENDING' && selected.price" @submit.prevent="openPreview">
              <fieldset>
                <legend>核对结论</legend>
                <label class="choice"><input v-model="draft.decision" type="radio" value="CHARGE" />
                  {{ selected.price.mode === 'TOKEN' ? '按上游用量补账' : '确认按次计费' }}</label>
                <label class="choice"><input v-model="draft.decision" type="radio" value="NO_CHARGE" />确认不计费</label>
              </fieldset>
              <fieldset v-if="usesTokens" class="token-fields">
                <legend>上游返回的分类 Token</legend>
                <label>输入 Token<input v-model="draft.input" inputmode="numeric" maxlength="12" placeholder="含缓存命中" /></label>
                <label>缓存命中 Token<input v-model="draft.cached" inputmode="numeric" maxlength="12" placeholder="确认无命中填 0" /></label>
                <label>输出 Token<input v-model="draft.output" inputmode="numeric" maxlength="12" /></label>
              </fieldset>
              <p class="note">
                <strong>Verse 历史定价</strong><br />
                <template v-if="selected.price.mode === 'REQUEST'">{{ money(selected.price.requestFen) }} / 次</template>
                <template v-else>每百万 Token {{ money(selected.price.inputFen) }} 未命中 · {{ money(selected.price.cachedFen) }} 命中 · {{ money(selected.price.outputFen) }} 输出</template>
              </p>
              <label class="choice"><input v-model="draft.evidence" type="checkbox" />我已核对该请求的上游证据</label>
              <div class="actions">
                <button class="quiet" type="button" @click="feedback = '已保留待补账。'">保留待补账</button>
                <button class="primary" type="submit">预览入账</button>
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
        <button class="quiet" type="button" :disabled="submitting" autofocus @click="dialog?.close()">返回修改</button>
        <button class="primary" type="button" :disabled="submitting" @click="confirm">{{ submitting ? '提交中…' : '确认提交' }}</button>
      </div>
    </dialog>
  </main>
</template>

<style scoped lang="scss">
:global(*) { box-sizing: border-box; }
:global(body) { margin: 0; color: $color-text-primary; background: $color-bg-canvas; font-family: $font-family; }
.surface { width: min(1120px, calc(100% - 32px)); margin: 0 auto 64px; }
.masthead { display: flex; justify-content: space-between; align-items: center; min-height: 70px; border-bottom: 1px solid $color-border; }
.wordmark { color: $color-primary; font-size: 23px; font-weight: 800; text-decoration: none; }
.intro { margin: 30px 0 20px; }
.kicker { color: $color-primary; letter-spacing: .13em; font-size: 12px; font-weight: 700; }
h1 { margin: 8px 0 10px; font-size: clamp(28px, 5vw, 40px); }
h2 { margin: 0 0 10px; font-size: 19px; }
.muted, dt { color: $color-text-secondary; }
.batch, .note, .feedback { padding: 12px 14px; border-radius: $radius-input; background: $color-bg-secondary; line-height: 1.6; }
.batch { display: flex; flex-wrap: wrap; gap: 8px 16px; margin: 18px 0 10px; }
.mono { font-family: ui-monospace, Consolas, monospace; overflow-wrap: anywhere; }
.columns { display: grid; grid-template-columns: minmax(240px, 2fr) minmax(0, 3fr); gap: 18px; align-items: start; }
.panel, dialog { color: $color-text-primary; background: $color-bg; border: 1px solid $color-border; border-radius: $radius-card; padding: clamp(16px, 3vw, 24px); }
.login { max-width: 440px; margin: 50px auto; }
.tabs, .line, .actions { display: flex; gap: 10px; align-items: center; }
.line, .actions { justify-content: space-between; }
.actions { margin-top: 16px; flex-wrap: wrap; }
.tabs { margin: 16px 0; }
button { color: inherit; background: $color-bg; border: 1px solid $color-border-input; border-radius: $radius-button; padding: 9px 13px; font: inherit; cursor: pointer; }
button:disabled { opacity: .55; cursor: default; }
.primary { background: $color-primary-solid; color: $color-on-primary; border-color: $color-primary-solid; font-weight: 650; }
.quiet { color: $color-primary; }
.tabs [aria-pressed='true'], .queue [aria-current='true'] { border-color: $color-primary; background: $color-primary-bg; }
.queue { list-style: none; padding: 0; display: grid; gap: 8px; }
.queue button { width: 100%; display: grid; gap: 5px; text-align: left; }
.queue span { color: $color-text-secondary; font-size: 13px; }
.pill { border-radius: 12px; padding: 3px 9px; background: $color-bg-secondary; color: $color-warning; white-space: nowrap; }
.pill.done, .feedback { background: $color-bg-secondary; color: $color-success; }
.facts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
dt { margin-bottom: 4px; font-size: 13px; }
dd { margin: 0; overflow-wrap: anywhere; }
.result { border-top: 1px solid $color-border; padding-top: 16px; }
fieldset { border: 0; padding: 0; margin: 18px 0; }
legend { margin-bottom: 8px; font-weight: 650; }
label { display: block; margin: 8px 0; }
input:not([type='radio'], [type='checkbox']) { display: block; width: 100%; min-width: 0; font: inherit; color: inherit; background: $color-bg; border: 1px solid $color-border-input; border-radius: $radius-input; padding: 9px; margin-top: 5px; }
.choice { display: flex; align-items: center; gap: 7px; }
.token-fields { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
.error { color: $color-danger; }
dialog { width: min(440px, calc(100% - 32px)); }
dialog::backdrop { background: #112b3b66; }
@media (max-width: 740px) {
  .columns, .token-fields { grid-template-columns: minmax(0, 1fr); }
}
</style>
