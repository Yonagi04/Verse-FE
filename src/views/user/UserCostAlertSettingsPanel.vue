<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import { InfoCircleOutlined } from '@ant-design/icons-vue'
import { useUserStore } from '@/stores/user'
import { getUserCostAlertSettings, replaceUserCostAlertSettings } from '@/api/userCostAlertSettings'
import { apiErrorDetails } from '@/utils/apiError'
import { isUserCostAlertDraftDirty, toUserCostAlertDraft, buildUserCostAlertReplacement, isSameUserCostAlertSettings, formatUserCostAlertPeriod, userCostAlertAmountError, type UserCostAlertDraft } from '@/utils/userCostAlertSettings'
import { formatBudgetYuan, getBudgetUsage } from '@/utils/costBudget'
import type { UserCostAlertSettingsView, UserCostAlertChannel, ReplaceUserCostAlertSettings } from '@/types/userCostAlertSettings'
const user = useUserStore()
const server = ref<UserCostAlertSettingsView | null>(null), draft = ref<UserCostAlertDraft | null>(null)
const loading = ref(false), saving = ref(false), error = ref(''), saved = ref(''), conflict = ref(false), uncertain = ref(false)
const dirty = computed(() => !!server.value && !!draft.value && isUserCostAlertDraftDirty(draft.value, server.value.config))
const amountErrors = computed(() => ({ daily: draft.value ? userCostAlertAmountError(draft.value.daily) : '', weekly: draft.value ? userCostAlertAmountError(draft.value.weekly) : '' }))
let sequence = 0, controller: AbortController | undefined, lastRefresh = 0
function accept(data: UserCostAlertSettingsView) { server.value = data; draft.value = toUserCostAlertDraft(data.config); conflict.value = false; uncertain.value = false }
async function load(discard = false) {
  if (saving.value) return
  if (discard && dirty.value && !window.confirm('加载最新配置会丢弃未保存的输入，是否继续？')) return
  const current = ++sequence, identity = user.token
  controller?.abort(); controller = new AbortController(); loading.value = true; error.value = ''; lastRefresh = Date.now()
  try {
    const data = await getUserCostAlertSettings(controller.signal)
    if (current !== sequence || identity !== user.token) return
    if (!server.value || !dirty.value || discard) accept(data)
    else { conflict.value = data.config.version !== server.value.config.version; server.value = { ...data, config: server.value.config } }
  } catch (failure) { if (current === sequence && identity === user.token && !apiErrorDetails(failure).cancelled) error.value = apiErrorDetails(failure).message }
  finally { if (current === sequence && identity === user.token) loading.value = false }
}
async function save() {
  if (!server.value || !draft.value || saving.value || uncertain.value || conflict.value) return
  if (amountErrors.value.daily || amountErrors.value.weekly) return
  let body: ReplaceUserCostAlertSettings
  try { body = buildUserCostAlertReplacement(draft.value, server.value.config.version) } catch (failure) { error.value = (failure as Error).message; return }
  const invalid = body.channels.some(channel => !server.value!.readiness.some(row => row.channel === channel && row.available))
  if ((body.daily.enabled || body.weekly.enabled) && invalid) { error.value = '所选渠道不可用，请维护联系方式或调整渠道'; return }
  const identity = user.token, current = ++sequence
  controller?.abort(); controller = new AbortController(); saving.value = true; error.value = ''; saved.value = ''
  try {
    const data = await replaceUserCostAlertSettings(body, controller.signal)
    if (current === sequence && identity === user.token) { accept(data); saved.value = '预警设置已保存'; message.success(saved.value) }
  } catch (failure) {
    if (current !== sequence || identity !== user.token) return
    const detail = apiErrorDetails(failure)
    if (detail.cancelled) return
    error.value = detail.message
    if (detail.code === 'A001602') conflict.value = true
    if (detail.code === 'A001603') {
      try { const latest = await getUserCostAlertSettings(controller.signal); if (current === sequence && identity === user.token) server.value = { ...latest, config: server.value!.config } } catch { /* 保留正式基线与输入，页面允许重试读取。 */ }
    }
    if (detail.uncertain) {
      uncertain.value = true; error.value = '保存结果待确认，正在读取正式配置，请勿重复提交'
      try {
        const latest = await getUserCostAlertSettings(controller.signal)
        if (current !== sequence || identity !== user.token) return
        if (isSameUserCostAlertSettings(body, latest.config)) { accept(latest); saved.value = '已确认预警设置保存成功'; error.value = '' }
        else { uncertain.value = false; conflict.value = true; error.value = '正式配置与本次输入不同，请加载最新配置后重新编辑' }
      } catch { if (current === sequence && identity === user.token) error.value = '保存结果仍待确认，请读取最新配置后再编辑' }
    }
  } finally { if (current === sequence && identity === user.token) saving.value = false }
}
function confirmLeave() { return !saving.value && (!dirty.value || window.confirm('有尚未保存的预警设置，确定离开吗？')) }
defineExpose({ confirmLeave })
function unload(event: BeforeUnloadEvent) { event.preventDefault(); event.returnValue = '' }
watch(dirty, value => { if (value) window.addEventListener('beforeunload', unload); else window.removeEventListener('beforeunload', unload) })
watch(() => user.token, () => { ++sequence; controller?.abort(); server.value = null; draft.value = null; error.value = ''; saved.value = ''; saving.value = false; uncertain.value = false; conflict.value = false; if (user.token) void load() })
function visible() { if (document.visibilityState === 'visible' && Date.now() - lastRefresh > 60000 && !saving.value && !uncertain.value) void load() }
document.addEventListener('visibilitychange', visible)
onBeforeUnmount(() => { ++sequence; controller?.abort(); server.value = null; draft.value = null; window.removeEventListener('beforeunload', unload); document.removeEventListener('visibilitychange', visible) })
const periodKeys = ['daily', 'weekly'] as const
const labels: Record<UserCostAlertChannel, string> = { IN_APP: '系统站内信', SMS: '短信', EMAIL: '邮件' }
const reasons: Record<string, string> = { CHANNEL_DISABLED: '平台尚未启用', TEMPLATE_MISSING: '平台模板或发信配置未就绪', CONTACT_MISSING: '请先维护联系方式', CONTACT_INVALID: '联系方式格式不可用', STATE_UNAVAILABLE: '状态暂不可用' }
const states = { DISABLED: '未开启', NOT_REACHED: '未达预警金额', TRIGGERED: '已生成提醒', UNKNOWN: '等待费用更新' }
void load()
</script>

<template>
  <section class="alert-panel" aria-labelledby="cost-alert-heading">
    <header class="panel-heading"><h2 id="cost-alert-heading">费用预警</h2>
      <p>为每天和每周的模型调用设置提醒金额，及时了解你的费用使用情况。</p>
    </header>
    <a-alert v-if="error" type="error" show-icon :message="error" class="feedback" />
    <a-button v-if="(!server && !loading) || conflict || uncertain" :loading="loading" :disabled="saving" @click="load(true)">{{ conflict || uncertain ? '加载最新配置' : '重试读取' }}</a-button>
    <a-skeleton v-if="loading && !server" active />
    <template v-if="server && draft">
      <a-alert v-if="server.availability === 'UNAVAILABLE'" type="warning" show-icon class="feedback" message="费用暂时无法更新，你仍可编辑并保存预警设置。" />
      <form @submit.prevent="save">
        <fieldset :disabled="saving || loading || uncertain" class="settings-fields">
          <div class="periods">
            <section v-for="(key, index) in periodKeys" :key="key" class="period-card" :class="{ 'is-enabled': draft[key].enabled }">
              <div class="period-title"><div><h3>{{ key === 'daily' ? '每日预警' : '每周预警' }}</h3>
                <p class="help">{{ key === 'daily' ? '关注每天的费用使用' : '掌握整周的费用趋势' }}</p></div>
                <a-switch v-model:checked="draft[key].enabled" :aria-label="key === 'daily' ? '开启每日预警' : '开启每周预警'" />
              </div>
              <div class="amount-field"><label :for="`${key}-amount`">预警金额</label>
                <a-form-item :validate-status="amountErrors[key] ? 'error' : undefined" :help="amountErrors[key] || undefined">
                  <a-input :id="`${key}-amount`" v-model:value="draft[key].yuan" size="large" prefix="¥" suffix="元" inputmode="decimal" placeholder="例如 10.00" :maxlength="24"
                    :status="amountErrors[key] ? 'error' : undefined" :aria-invalid="!!amountErrors[key]" :aria-required="draft[key].enabled" />
                </a-form-item>
                <p class="help">累计预估费用达到此金额时提醒你</p>
              </div>
              <div v-if="server.periods[index]" class="period-overview">
                <div class="usage-label">{{ key === 'daily' ? '今日' : '本周' }}{{ server.periods[index]!.costComplete ? '累计费用' : '已记录费用' }}
                  <a-tooltip v-if="!server.periods[index]!.costComplete" title="部分调用费用尚未计入，这里显示目前已统计的金额。"><InfoCircleOutlined aria-label="费用统计说明" tabindex="0" /></a-tooltip>
                </div>
                <strong class="usage-amount">{{ formatBudgetYuan(server.periods[index]!.knownCostFen) }}</strong>
                <a-progress v-if="getBudgetUsage(server.periods[index]!.knownCostFen, server.periods[index]!.thresholdFen)" :percent="getBudgetUsage(server.periods[index]!.knownCostFen, server.periods[index]!.thresholdFen)!.percent" :show-info="false" />
                <div class="period-meta"><span class="period-state" :class="{ triggered: server.periods[index]!.alertState === 'TRIGGERED' }">{{ states[server.periods[index]!.alertState] }}</span>
                  <span>{{ formatUserCostAlertPeriod(server.periods[index]!.periodStart, server.periods[index]!.periodEnd) }}</span>
                </div>
              </div>
            </section>
          </div>
          <section class="channels"><div class="section-heading"><div><h3>通知渠道</h3><p class="help">每日和每周预警共用，仅发送给你本人。</p></div>
              <router-link to="/profile?panel=profile&edit=contacts">管理联系方式</router-link>
            </div>
            <a-checkbox-group v-model:value="draft.channels" class="channel-options">
              <div v-for="channel in server.readiness" :key="channel.channel" class="channel-option" :class="{ selected: draft.channels.includes(channel.channel), unavailable: !channel.available }">
                <a-checkbox :value="channel.channel" :disabled="!channel.available && !draft.channels.includes(channel.channel)">{{ labels[channel.channel] }}</a-checkbox>
                <p class="help">{{ channel.available ? channel.contactMasked || '在通知中心接收提醒' : reasons[channel.reasonCode || ''] || '暂不可用' }}</p>
              </div>
            </a-checkbox-group>
          </section>
        </fieldset>
        <details class="reminder-notes"><summary>关于费用与提醒</summary>
          <p>按北京时间统计所有租户中的个人预估费用。API Key 调用归属 Key 所有者，共享 Key 无法识别实际操作人。</p>
          <p>每天、每周分别最多提醒一次；修改设置不会重新获得本周期提醒。未选中的站内信不会自动追加。</p>
          <p>关闭预警、移除渠道或修改联系方式会取消待发送的旧任务。已获许可的在途通知可能无法撤回，取消后不补发。</p>
        </details>
        <footer class="actions"><a-button type="primary" size="large" html-type="submit" :loading="saving" :disabled="!dirty || loading || uncertain || conflict || !!amountErrors.daily || !!amountErrors.weekly">保存预警设置</a-button>
          <span class="save-status" role="status">{{ dirty ? '有未保存的修改' : saved || '所有设置已保存' }}</span>
        </footer>
      </form>
    </template>
  </section>
</template>
<style lang="scss" scoped>
.alert-panel { border: 1px solid $color-border; border-radius: $radius-card; background: $color-bg; padding: 32px; color: $color-text-primary;
  h2 { margin: 0; font-size: $font-size-h2; font-weight: 600; } h3 { margin: 0; font-size: $font-size-h3; font-weight: 600; } }
.panel-heading { margin-bottom: 32px; p { margin: 10px 0 0; color: $color-text-secondary; line-height: 1.8; font-size: 13px; } }
.help { margin: 0; color: $color-text-secondary; font-size: 12px; line-height: 1.8; }
.feedback { margin: 0 0 24px; }
.settings-fields { padding: 0; margin: 0; border: 0; min-width: 0; }
.settings-fields:disabled { opacity: .75; pointer-events: none; }
.periods { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 24px; }
.period-card { padding: 24px; border: 1px solid $color-border; border-radius: $radius-card; transition: border-color .2s;
  &.is-enabled { border-color: theme-alpha('link', .45); } }
.period-title { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 28px;
  .help { margin-top: 6px; } :deep(.ant-switch) { flex-shrink: 0; margin-top: 2px; } }
.amount-field { margin-bottom: 28px;
  label { display: block; font-size: 13px; margin-bottom: 10px; } .help { margin-top: 8px; }
  :deep(.ant-input-affix-wrapper) { padding: 9px 12px; } :deep(.ant-input-prefix) { color: $color-text-secondary; margin-right: 8px; }
  :deep(.ant-input-suffix) { color: $color-text-tertiary; font-size: 13px; } }
.amount-field :deep(.ant-form-item) { margin-bottom: 0; }
.amount-field :deep(.ant-form-item-explain-error) { font-size: 12px; padding-top: 6px; line-height: 1.7; }
.period-overview { padding-top: 22px; border-top: 1px solid $color-border; }
.usage-label { display: flex; align-items: center; gap: 7px; color: $color-text-secondary; font-size: 12px; }
.usage-amount { display: block; margin: 10px 0 16px; font-size: 28px; line-height: 1.3; font-weight: 600; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.period-meta { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; color: $color-text-tertiary; font-size: 12px; line-height: 1.7; }
.period-state { color: $color-text-secondary; &.triggered { color: $color-primary; } }
.channels { margin-top: 36px; :deep(.ant-checkbox-group) { width: 100%; display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 16px; } }
.section-heading { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 18px; .help { margin-top: 7px; } a { flex-shrink: 0; font-size: 13px; } }
.channel-option { padding: 18px; min-width: 0; border: 1px solid $color-border; border-radius: $radius-input; transition: background .2s, border-color .2s;
  &.selected { border-color: theme-alpha('link', .45); background: $color-primary-bg; }
  &.unavailable:not(.selected) { background: $color-bg-secondary; }
  .help { margin: 8px 0 0 24px; overflow-wrap: anywhere; } }
.reminder-notes { margin-top: 26px; color: $color-text-secondary; font-size: 12px; line-height: 1.9;
  summary { cursor: pointer; width: fit-content; } p { margin: 10px 0 0; max-width: 780px; } }
.actions { display: flex; align-items: center; flex-wrap: wrap; gap: 16px; margin-top: 28px; padding-top: 24px; border-top: 1px solid $color-border; }
.save-status { color: $color-text-tertiary; font-size: 12px; }
@container profile (max-width: 700px) { .periods { grid-template-columns: 1fr; } .channels :deep(.ant-checkbox-group) { grid-template-columns: 1fr; } }
@container profile (max-width: 540px) { .alert-panel { padding: 24px 20px; } .period-card { padding: 22px 20px; } .section-heading { align-items: flex-start; flex-direction: column; gap: 10px; } }
</style>
