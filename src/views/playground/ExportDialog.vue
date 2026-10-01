<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Attempt, ChatRequest, WorkbenchResource } from '@/types/playgroundWorkbench'
import { copyWorkbenchText, downloadWorkbench, requestCode, sessionMarkdown, costLabel, evidenceLabel } from '@/utils/playgroundExport'
const props = defineProps<{ open: boolean; group: WorkbenchResource | null; draftRequest: (index: number) => ChatRequest | null; laneNames: string[]; initial?: Attempt }>()
const emit = defineEmits<{ 'update:open': [value: boolean] }>()
const format = ref('curl'), round = ref<number | 'draft'>('draft'), lane = ref(0), attempt = ref<string>()
watch(() => props.open, open => { if (!open) return; format.value = props.initial ? 'request' : 'curl'; round.value = props.initial?.roundNo || 'draft'; lane.value = props.initial ? props.group?.payload.lanes.findIndex(l => l.laneId === props.initial?.laneId) || 0 : 0; attempt.value = props.initial?.attemptId })
const roundOptions = computed(() => [{ value: 'draft', label: '当前草稿 / 下一轮' }, ...[...new Set(props.group?.attempts?.map(a => a.roundNo) || [])].map(n => ({ value: n, label: `第 ${n} 轮` }))])
const choices = computed(() => props.group?.attempts?.filter(a => a.roundNo === round.value && a.laneId === props.group?.payload.lanes[lane.value]?.laneId) || [])
const selected = computed(() => choices.value.find(a => a.attemptId === attempt.value) || choices.value.at(-1))
const request = computed(() => round.value === 'draft' ? props.draftRequest(lane.value) : selected.value?.snapshot.request)
const content = computed(() => {
  if (format.value === 'markdown') return props.group ? sessionMarkdown(props.group) : '# 尚未发送的草稿'
  if (format.value === 'json') return JSON.stringify(props.group || { draft: props.laneNames.map((_, i) => props.draftRequest(i)) }, null, 2)
  if (!request.value) return '此历史尝试未取得请求快照，无法导出调用代码。'
  return requestCode(request.value, format.value)
})
// 调用指标集中放在请求详情，聊天正文仅展示回答与操作。
const timeLabel = (time?: number) => time == null ? '未知' : `${(time / 1000).toFixed(2)}s`
const extensions: Record<string, string> = { request: 'json', curl: 'sh', python: 'py', javascript: 'js', markdown: 'md', json: 'json' }
</script>
<template>
  <a-modal :open="open" title="请求与代码导出" :width="960" @cancel="emit('update:open', false)" wrap-class-name="workbench-export">
    <p class="muted">使用具有该模型权限的 API Key。API 调用受 Key 自身限额约束。</p>
    <a-space wrap class="controls">
      <a-select v-model:value="round" :options="roundOptions" style="width: 200px" @change="attempt = undefined" />
      <a-select v-model:value="lane" :options="laneNames.map((label, value) => ({ label, value }))" style="width: 240px" @change="attempt = undefined" />
      <a-select v-if="choices.length" v-model:value="attempt" :placeholder="`尝试 ${selected?.attemptNo}`" :options="choices.map(a => ({ value: a.attemptId, label: `尝试 ${a.attemptNo} · ${a.status}` }))" style="width: 180px" />
    </a-space>
    <a-tabs v-model:active-key="format"><a-tab-pane v-for="[key, label] in [['request','请求详情'],['curl','cURL'],['python','Python'],['javascript','JavaScript'],['markdown','会话 Markdown'],['json','会话 JSON']]" :key="key" :tab="label" /></a-tabs>
    <template v-if="format === 'request' && selected">
      <dl class="request-metrics">
        <div><dt>输入 / 输出 Token</dt><dd>{{ selected.metrics.inputTokens ?? '未知' }} / {{ selected.metrics.outputTokens ?? '未知' }}</dd></div>
        <div><dt>首内容 / 总耗时</dt><dd>{{ timeLabel(selected.metrics.firstContentMs) }} / {{ timeLabel(selected.metrics.durationMs) }}</dd></div>
        <div><dt>费用</dt><dd>{{ costLabel(selected) }}</dd></div>
        <div><dt>计量依据</dt><dd>{{ evidenceLabel(selected.metrics.evidence) }}</dd></div>
      </dl>
      <div class="metadata">请求 ID：{{ selected.requestId }} · {{ selected.status }}<br>配置快照：{{ JSON.stringify(selected.snapshot.config) }}</div>
    </template>
    <pre class="export-content">{{ content }}</pre>
    <template #footer><a-button @click="copyWorkbenchText(content)">复制</a-button><a-button type="primary" @click="downloadWorkbench(`verse-playground.${extensions[format]}`, content)">下载</a-button></template>
  </a-modal>
</template>
<style lang="scss" scoped>
.muted, .metadata { color: $color-text-secondary; font-size: $font-size-caption; line-height: 1.8; }
.controls { margin: 8px 0; } .metadata { overflow-wrap: anywhere; margin-bottom: 10px; }
.export-content { max-height: 52vh; overflow: auto; border-radius: $radius-input; background: $color-bg-secondary; border: 1px solid $color-border; padding: 18px; font: 12px/1.7 Consolas, monospace; white-space: pre-wrap; overflow-wrap: anywhere; }
.request-metrics { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; padding: 16px; margin: 0 0 16px; border: 1px solid $color-border; border-radius: $radius-input; background: $color-bg-secondary; dt { font-size: $font-size-caption; color: $color-text-secondary; } dd { font-size: 13px; color: $color-text-primary; margin: 4px 0 0; } }
@media (max-width: 560px) { .request-metrics { grid-template-columns: minmax(0, 1fr); } }
</style>
