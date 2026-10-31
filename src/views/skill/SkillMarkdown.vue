<script setup lang="ts">
import { computed } from 'vue'
import { Marked } from 'marked'
import DOMPurify from 'dompurify'
const props = defineProps<{ text: string }>()
const parser = new Marked({ gfm: true, breaks: false })
// 原始HTML仅显示文本；图片保留替代说明，不自动加载包内或外部资源。
parser.use({ renderer: {
  html: ({ text }) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
  image: ({ text }) => `[图片：${text.replace(/[<>&]/g, '') || '资源'}]`,
  link: ({ text }) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
} })
const html = computed(() => DOMPurify.sanitize(parser.parse(props.text, { async: false }), {
  ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'del', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre',
    'code', 'ul', 'ol', 'li', 'hr', 'table', 'thead', 'tbody', 'tr', 'th', 'td'], ALLOWED_ATTR: [],
}))
</script>
<template>
  <!-- eslint-disable-next-line vue/no-v-html -- 固定无链接/图片/属性的白名单净化，原始HTML先转义。 -->
  <article class="skill-markdown" v-html="html" />
</template>
<style lang="scss" scoped>
.skill-markdown { overflow-wrap: anywhere; line-height: 1.8; color: $color-text-primary; }
.skill-markdown :deep(pre) { padding: 16px; border-radius: $radius-input; background: $color-bg-secondary; overflow-x: auto; }
.skill-markdown :deep(code) { white-space: pre-wrap; }
.skill-markdown :deep(table) { display: block; overflow-x: auto; border-collapse: collapse; }
.skill-markdown :deep(td), .skill-markdown :deep(th) { padding: 8px 12px; border: 1px solid $color-border; }
.skill-markdown :deep(blockquote) { padding-left: 16px; border-left: 3px solid $color-border; color: $color-text-secondary; }
</style>
