<script setup lang="ts">
import { computed } from 'vue'
import { Marked } from 'marked'
import DOMPurify from 'dompurify'
import hljs from 'highlight.js/lib/core'
import javascript from 'highlight.js/lib/languages/javascript'
import python from 'highlight.js/lib/languages/python'
import java from 'highlight.js/lib/languages/java'
import json from 'highlight.js/lib/languages/json'
import bash from 'highlight.js/lib/languages/bash'
import sql from 'highlight.js/lib/languages/sql'
import 'highlight.js/styles/github.css'
import { copyWorkbenchText } from '@/utils/playgroundExport'
const props = defineProps<{ text: string }>()
for (const [name, language] of Object.entries({ javascript, python, java, json, bash, sql })) hljs.registerLanguage(name, language)
const escape = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const parser = new Marked({ gfm: true, breaks: true, renderer: {
  html: ({ text }) => escape(text),
  image: ({ text }) => escape(text),
  code: ({ text, lang }) => {
    const language = lang?.split(/\s/)[0] || ''
    const highlighted = hljs.getLanguage(language) ? hljs.highlight(text, { language, ignoreIllegals: true }).value : escape(text)
    return `<pre><button type="button" class="copy-code">复制代码</button><code class="hljs">${highlighted}</code></pre>`
  },
} })
const html = computed(() => {
  try { return DOMPurify.sanitize(parser.parse(props.text, { async: false }), {
    ALLOWED_TAGS: ['p', 'br', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'blockquote', 'pre', 'code', 'strong', 'em', 'del', 'a', 'hr', 'span', 'button'],
    ALLOWED_ATTR: ['href', 'title', 'class', 'type'], ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|#)/i,
  }) } catch { return `<p>${escape(props.text)}</p>` }
})
function clicked(event: MouseEvent) {
  const target = event.target as HTMLElement
  if (target.closest('.copy-code')) void copyWorkbenchText(target.closest('pre')?.querySelector('code')?.textContent || '')
}
</script>
<template>
  <!-- eslint-disable-next-line vue/no-v-html -- html is sanitized with the explicit DOMPurify allowlist above. -->
  <div class="markdown" @click="clicked" v-html="html" />
</template>
<style lang="scss" scoped>
.markdown { line-height: 1.8; overflow-wrap: anywhere; :deep(p) { margin: 0 0 12px; } :deep(h1), :deep(h2), :deep(h3) { font-size: $font-size-h3; margin: 18px 0 10px; }
  :deep(pre) { position: relative; padding: 36px 14px 14px; border: 1px solid $color-border; border-radius: $radius-input; background: $color-bg-secondary; overflow-x: auto; }
  :deep(code) { font-size: $font-size-caption; } :deep(.copy-code) { position: absolute; top: 5px; right: 8px; border: 0; color: $color-text-secondary; background: transparent; cursor: pointer; }
  :deep(table) { display: block; max-width: 100%; overflow-x: auto; border-collapse: collapse; margin-bottom: 14px; }
  :deep(th), :deep(td) { border: 1px solid $color-border; padding: 6px 10px; } :deep(blockquote) { border-left: 3px solid $color-primary; color: $color-text-secondary; padding-left: 12px; }
  :deep(a) { color: $color-primary; } }
</style>
