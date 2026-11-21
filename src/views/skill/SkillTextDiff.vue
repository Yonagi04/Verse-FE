<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { lineDisplay, lineToken, type SkillDiff } from '@/utils/skillDiff'
const props = defineProps<{ oldText: string; newText: string }>()
const result = ref<SkillDiff>(), error = ref(''), scroll = ref(0), expanded = ref(new Set<number>())
let worker: Worker | undefined
const rowHeight = 28
watch(() => [props.oldText, props.newText], () => {
  worker?.terminate(); result.value = undefined; error.value = ''; scroll.value = 0; expanded.value = new Set()
  const current = new Worker(new URL('../../workers/skillDiff.worker.ts', import.meta.url), { type: 'module' })
  worker = current
  current.onmessage = (event: MessageEvent<{ result?: SkillDiff; error?: string }>) => {
    if (worker !== current) return
    result.value = event.data.result; error.value = event.data.error || ''; current.terminate()
  }
  current.onerror = () => { if (worker === current) error.value = '文件差异计算失败，请重试' }
  current.postMessage({ oldText: props.oldText, newText: props.newText })
}, { immediate: true })
const segments = computed(() => {
  let offset = 0
  return (result.value?.operations || []).flatMap((operation, index) => {
    const parts = operation.kind === 'equal' && operation.count > 6 && !expanded.value.has(index)
      ? [{ start: 0, count: 3, collapsed: false }, { start: 3, count: 1, collapsed: true }, { start: operation.count - 3, count: 3, collapsed: false }]
      : [{ start: 0, count: operation.count, collapsed: false }]
    return parts.map(part => { const value = { operation, index, offset, ...part }; offset += part.count; return value })
  })
})
const total = computed(() => { const last = segments.value[segments.value.length - 1]; return last ? last.offset + last.count : 0 })
const first = computed(() => Math.max(0, Math.floor(scroll.value / rowHeight) - 15))
const rows = computed(() => {
  if (!result.value) return []
  const end = Math.min(total.value, first.value + 60)
  return segments.value.flatMap(segment => {
    const from = Math.max(segment.offset, first.value), to = Math.min(segment.offset + segment.count, end)
    return Array.from({ length: Math.max(0, to - from) }, (_, index) => {
      const position = from + index, shift = segment.start + position - segment.offset
      const { kind, oldStart, newStart, count } = segment.operation
      const oldLine = oldStart + shift, newLine = newStart + shift
      const token = kind === 'insert' ? lineToken(props.newText, result.value!.newOffsets, newLine) : lineToken(props.oldText, result.value!.oldOffsets, oldLine)
      return { position, kind, oldLine: kind === 'insert' ? '' : oldLine + 1, newLine: kind === 'delete' ? '' : newLine + 1,
        ...lineDisplay(token), collapsed: segment.collapsed, hidden: count - 6, operationIndex: segment.index }
    })
  })
})
function expand(index: number) { expanded.value = new Set([...expanded.value, index]) }
function onScroll(event: Event) { scroll.value = (event.target as HTMLElement).scrollTop }
onBeforeUnmount(() => { worker?.terminate(); worker = undefined })
</script>
<template>
  <a-alert v-if="error" type="error" :message="error" show-icon />
  <a-spin v-else-if="!result" class="diff-loading" />
  <div v-else class="text-diff" :style="{ '--skill-diff-row-height': `${rowHeight}px` }">
    <p v-if="result.coarse" class="diff-note">此段按整体替换展示，完整保留两侧内容。</p>
    <p class="diff-note">统一视图 · − 删除 / + 新增 · 行尾标记包含 LF、CRLF、CR、NONE（无末尾换行）</p>
    <div class="diff-scroll" tabindex="0" aria-label="只读文本差异" @scroll="onScroll">
      <div class="diff-space" :style="{ height: `${total * rowHeight}px` }">
        <div v-for="row in rows" :key="row.position" class="diff-line" :class="row.collapsed ? 'collapsed' : row.kind" :style="{ top: `${row.position * rowHeight}px` }">
          <button v-if="row.collapsed" @click="expand(row.operationIndex)">展开 {{ row.hidden }} 行未变化内容</button>
          <template v-else><span class="number">{{ row.oldLine }}</span><span class="number">{{ row.newLine }}</span><span class="sign">{{ row.kind === 'delete' ? '−' : row.kind === 'insert' ? '+' : ' ' }}</span><code>{{ row.text }}</code><small>{{ row.ending }}</small></template>
        </div>
      </div>
    </div>
    <p v-if="total === 0" class="diff-note">两侧均为空文件</p>
  </div>
</template>
<style scoped lang="scss">
.diff-note { padding: 9px 16px; margin: 0; color: $color-text-tertiary; font-size: $font-size-caption; line-height: 1.7; border-bottom: 1px solid $color-border; }.diff-loading { display: block; margin: 60px; }
.diff-scroll { height: 420px; overflow: auto; background: $color-bg; outline-offset: -2px; }.diff-scroll:focus-visible { outline: 2px solid $color-focus; }
.diff-space { position: relative; min-width: 100%; width: max-content; }.diff-line { position: absolute; left: 0; right: 0; height: var(--skill-diff-row-height); display: flex; align-items: center; font: #{$skill-font-size-code}/var(--skill-diff-row-height) Consolas, 'SFMono-Regular', monospace; white-space: pre; min-width: max-content; color: $color-text-primary; }
.diff-line code { font: inherit; min-width: 60px; padding-right: 22px; }.number { width: 44px; flex: none; padding-right: 10px; text-align: right; color: $color-text-tertiary; user-select: none; font-size: $font-size-caption; }.number + .number { border-right: 1px solid $color-border; }.sign { width: 28px; flex: none; text-align: center; user-select: none; }
.delete { background: theme-alpha('danger', .08); }.insert { background: theme-alpha('success', .08); }.delete .sign { color: $color-danger; }.insert .sign { color: $color-success; }.delete .number { background: theme-alpha('danger', .05); }.insert .number { background: theme-alpha('success', .05); }
.diff-line small { color: $color-text-tertiary; font-size: $font-size-caption; padding-right: 16px; }.collapsed { background: $color-primary-bg; justify-content: center; border-block: 1px solid $color-border; }.collapsed button { border: 0; background: transparent; color: $color-primary; cursor: pointer; font-size: $font-size-caption; }.collapsed button:focus-visible { outline: 2px solid $color-focus; outline-offset: 1px; }
</style>
