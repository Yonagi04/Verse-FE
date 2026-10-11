<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import { useTenantStore } from '@/stores/tenant'
import { getLlmCostStatus, updateLlmCostBudget } from '@/api/llmCostBudget'
import { emptyCostDraft, costConfigToDraft, buildCostLimitPatch } from '@/utils/costBudget'
import { emptyWarning, buildWarningPatch } from '@/utils/llmCostBudget'
import { formatBudgetDateTime } from '@/utils/date'
import type { LlmCostStatusFull } from '@/types/llmCostBudget'
import LlmCostBudgetFormSection from './LlmCostBudgetFormSection.vue'
import CostBudgetNotes from '@/components/cost-budget/CostBudgetNotes.vue'
const props = defineProps<{ visible: boolean; tenantId: string; serviceId: string; serviceName?: string }>()
const emit = defineEmits<{ (e: 'update:visible', value: boolean): void; (e: 'done'): void }>()
const store = useTenantStore()
const server = ref<LlmCostStatusFull | null>(null)
const draft = ref(emptyCostDraft())
const warning = ref(emptyWarning())
const loading = ref(false)
const saving = ref(false)
const error = ref('')
let revision = 0
async function reload() {
  if (saving.value) return
  const ticket = ++revision
  server.value = null; error.value = ''; loading.value = false
  draft.value = emptyCostDraft(); warning.value = emptyWarning()
  if (!props.visible || store.currentTenantId !== props.tenantId) return
  loading.value = true
  try {
    const result = await getLlmCostStatus(props.tenantId, props.serviceId)
    if (ticket !== revision) return
    if (result.visibility !== 'FULL') { error.value = '仅管理员可维护成本配置'; return }
    server.value = result
    draft.value = costConfigToDraft(result.costLimit)
    warning.value = structuredClone(result.costWarning)
  } catch {
    if (ticket === revision) error.value = '成本配置暂不可获取，请重新加载'
  } finally {
    if (ticket === revision) loading.value = false
  }
}
watch(() => [props.visible, props.tenantId, props.serviceId, store.currentRole, store.currentTenantId], () => {
  revision++; saving.value = false
  void reload()
}, { immediate: true, flush: 'sync' })
onBeforeUnmount(() => { revision++ })
async function save() {
  if (!server.value || loading.value || saving.value || !props.visible || store.currentTenantId !== props.tenantId) return
  error.value = ''
  let costLimit, costWarning
  try {
    if (draft.value.enabled && !server.value.pricingEligible) throw new Error('请先配置模型价格')
    if (draft.value.enabled && !server.value.costLimit.enabled && server.value.availability !== 'READY') throw new Error('费用数据尚未就绪，请稍后重新加载再开启成本限额')
    costLimit = buildCostLimitPatch(draft.value, server.value.costLimit)
    costWarning = buildWarningPatch(warning.value, draft.value, server.value.pricingEligible, server.value.costWarning)
  } catch (failure) { error.value = (failure as Error).message; return }
  if (!costLimit && !costWarning) { message.info('没有修改'); return }
  const ticket = revision
  saving.value = true
  try {
    await updateLlmCostBudget(props.tenantId, props.serviceId, { costLimit: costLimit || { expectedVersion: server.value.costLimit.version }, costWarning })
    if (ticket !== revision) return
    message.success('已保存成本配置'); emit('done'); emit('update:visible', false)
  } catch {
    if (ticket === revision) error.value = '保存失败，草稿已保留；如配置版本冲突，请重新加载后确认修改。'
  } finally {
    if (ticket === revision) saving.value = false
  }
}
</script>
<template>
  <a-drawer :open="visible" title="成本限额设置" width="min(680px, 100vw)" :mask-closable="false" @close="emit('update:visible', false)">
    <div class="budget-editor" :aria-busy="loading">
      <div class="model-context"><h3>{{ serviceName || '模型服务' }}</h3><p>调整成本限额后按本周期历史费用重新判断，模型的手工启停状态保持独立。</p></div>
      <a-alert v-if="error" type="warning" :message="error" show-icon role="alert">
        <template #action><a-button size="small" :disabled="saving" :loading="loading" @click="reload">重新加载</a-button></template>
      </a-alert>
      <a-skeleton v-if="loading" active :paragraph="{ rows: 8 }" />
      <a-form v-else-if="server" layout="vertical">
        <LlmCostBudgetFormSection v-model="draft" v-model:warning="warning" :pricing-eligible="server.pricingEligible" :availability="server.availability" :tenant-id="tenantId" :disabled="saving" />
      </a-form>
      <CostBudgetNotes />
    </div>
    <template #footer>
      <div class="drawer-footer">
        <span class="snapshot-time"><template v-if="server">查询时间 {{ formatBudgetDateTime(server.asOf) }}</template><template v-else>{{ loading ? '正在查询正式配置…' : '尚未取得成本配置' }}</template></span>
        <div class="footer-actions"><a-button @click="emit('update:visible', false)">取消</a-button><a-button type="primary" :disabled="!server || loading" :loading="saving" @click="save">保存</a-button></div>
      </div>
    </template>
  </a-drawer>
</template>
<style lang="scss" scoped>
.budget-editor { display: flex; flex-direction: column; gap: 16px; }
.model-context { h3 { margin: 0 0 6px; font-size: $font-size-h3; color: $color-text-primary; overflow-wrap: anywhere; } p { margin: 0; color: $color-text-secondary; font-size: $font-size-caption; line-height: 1.7; } }
.drawer-footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.snapshot-time { color: $color-text-tertiary; font-size: $font-size-caption; }
.footer-actions { display: flex; gap: 8px; margin-left: auto; }
</style>
