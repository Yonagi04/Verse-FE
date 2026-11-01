<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import DOMPurify from 'dompurify'
import type { SkillFileContent } from '@/types/skill'
import { skillBytes } from '@/utils/skill'
import SkillMarkdown from './SkillMarkdown.vue'

const props = defineProps<{ file: SkillFileContent }>()
const rendered = ref(false)
const highlighted = ref('')
const highlightError = ref('')
const highlighting = ref(false)
const lines = computed(() => (props.file.content ?? '').split('\n').length)
// 超长文档保留完整正文，省略行号，避免一百万行产生同量 DOM 节点。
const lineNumbers = computed(() => lines.value <= 10000 ? Array.from({ length: lines.value }, (_, index) => index + 1).join('\n') : '')
watch(() => props.file, async (file, _previous, onCleanup) => {
  let disposed = false
  onCleanup(() => { disposed = true })
  rendered.value = false; highlighted.value = ''; highlightError.value = ''; highlighting.value = false
  if (file.status !== 'READY' || file.kind === 'TEXT') return
  highlighting.value = true
  try {
    const { default: hljs } = await import('highlight.js/lib/common')
    if (disposed) return
    if (!file.language || !hljs.getLanguage(file.language)) throw new Error('此代码语言暂不支持高亮')
    const html = hljs.highlight(file.content ?? '', { language: file.language, ignoreIllegals: true }).value
    highlighted.value = DOMPurify.sanitize(html, { ALLOWED_TAGS: ['span'], ALLOWED_ATTR: ['class'] })
  } catch {
    if (!disposed) highlightError.value = '语法高亮加载失败，已显示只读原文'
  } finally { if (!disposed) highlighting.value = false }
}, { immediate: true })
</script>
<template>
  <section class="file-preview" aria-label="只读文件预览">
    <header class="preview-toolbar">
      <strong :title="file.relativePath">{{ file.relativePath }}</strong>
      <span>{{ skillBytes(file.sizeBytes) }} · 只读</span>
      <div v-if="file.kind === 'MARKDOWN' && file.status === 'READY'" class="markdown-modes" aria-label="Markdown 视图">
        <button type="button" :aria-pressed="!rendered" @click="rendered = false">源码</button>
        <button type="button" :aria-pressed="rendered" @click="rendered = true">预览</button>
      </div>
    </header>
    <div v-if="file.status !== 'READY'" class="preview-message" role="status">文件类型暂不支持预览</div>
    <template v-else>
      <p v-if="highlightError" class="highlight-note" role="status">{{ highlightError }}</p>
      <div v-if="rendered && file.kind === 'MARKDOWN'" class="markdown-preview"><SkillMarkdown :text="file.content || ''" /></div>
      <div v-else class="readonly-editor" tabindex="0" :aria-label="file.kind === 'TEXT' ? '只读文本编辑器' : '只读代码编辑器'" :aria-busy="highlighting">
        <pre v-if="lineNumbers" class="line-numbers" aria-hidden="true">{{ lineNumbers }}</pre>
        <!-- eslint-disable-next-line vue/no-v-html -- 高亮库转义原文后仅允许 span/class 的白名单净化。 -->
        <pre v-if="highlighted" class="editor-content"><code v-html="highlighted" /></pre>
        <pre v-else class="editor-content"><code>{{ file.content }}</code></pre>
      </div>
      <p v-if="file.content === ''" class="empty-note">此文件为空</p>
    </template>
  </section>
</template>
<style scoped lang="scss">
.file-preview { min-width: 0; }.preview-toolbar { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; padding: 13px 16px; border-bottom: 1px solid $color-border; background: $color-bg-secondary; }.preview-toolbar strong { flex: 1; min-width: 100px; font-size: 12px; overflow-wrap: anywhere; }.preview-toolbar > span { color: $color-text-tertiary; font-size: 12px; }.markdown-modes { display: flex; gap: 4px; }.markdown-modes button { border: 1px solid $color-border; border-radius: 4px; color: $color-text-secondary; background: $color-bg; padding: 3px 8px; cursor: pointer; }.markdown-modes button[aria-pressed="true"] { color: $color-primary; border-color: $color-primary; }
.readonly-editor { display: flex; max-height: 600px; min-height: 300px; overflow: auto; background: $color-bg; outline-offset: -2px; }.readonly-editor pre { margin: 0; padding: 16px; font: 12px/1.8 Consolas, 'SFMono-Regular', monospace; tab-size: 4; }.line-numbers { flex: none; text-align: right; user-select: none; color: $color-text-tertiary; background: $color-bg-secondary; border-right: 1px solid $color-border; }.line-numbers span { display: block; height: 1.8em; }.editor-content { flex: 1; color: $color-text-primary; }.editor-content code { white-space: pre; font: inherit; }.preview-message { padding: 70px 20px; text-align: center; color: $color-text-secondary; }.markdown-preview { padding: 20px; max-height: 600px; overflow: auto; }.highlight-note, .empty-note { padding: 8px 16px; margin: 0; color: $color-text-tertiary; font-size: 12px; }
.editor-content :deep(.hljs-keyword), .editor-content :deep(.hljs-selector-tag), .editor-content :deep(.hljs-literal) { color: $color-primary; }.editor-content :deep(.hljs-string), .editor-content :deep(.hljs-regexp), .editor-content :deep(.hljs-addition) { color: $color-success; }.editor-content :deep(.hljs-comment), .editor-content :deep(.hljs-quote) { color: $color-text-tertiary; }.editor-content :deep(.hljs-number), .editor-content :deep(.hljs-attr), .editor-content :deep(.hljs-meta) { color: $color-warning; }.editor-content :deep(.hljs-title), .editor-content :deep(.hljs-section), .editor-content :deep(.hljs-name), .editor-content :deep(.hljs-type) { color: $color-primary; }.editor-content :deep(.hljs-deletion) { color: $color-danger; }
</style>
