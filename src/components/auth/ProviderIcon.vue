<script setup lang="ts">
import { GithubFilled, GitlabFilled } from '@ant-design/icons-vue'
import type { ExternalProvider } from '@/types/externalAuth'
defineProps<{ provider: ExternalProvider }>()
</script>
<template>
  <svg v-if="provider === 'google'" width="20" height="20" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6C44.4 38.03 46.98 31.86 46.98 24.55z"/><path fill="#FBBC05" d="M10.53 28.59A14.41 14.41 0 0 1 9.75 24c0-1.6.27-3.14.76-4.59l-7.98-6.19A23.87 23.87 0 0 0 0 24c0 3.87.93 7.53 2.56 10.78z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.91-5.8l-7.73-6c-2.15 1.45-4.92 2.3-8.18 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
  <GithubFilled v-else-if="provider === 'github'" style="font-size:21px;color:var(--verse-adaptive-text-primary, #24292f)" aria-hidden="true" /><GitlabFilled v-else-if="provider === 'gitlab'" style="font-size:22px;color:#fc6d26" aria-hidden="true" />
  <!-- 飞书彩色图标：采用用户提供的 SVG，保留原始路径及配色。 -->
  <svg v-else-if="provider === 'feishu'" width="22" height="22" viewBox="0 0 48 48" aria-hidden="true" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10 8c0 1 7 3.5 14.745 16.744 0 0 4.184-4.363 6.255-5.744 1.5-1 2.712-1.332 2.712-1.332C33.712 15.156 29.5 8 28 8z" fill="#00d6b9"/><path d="M43.5 18.5c-1-.667-3.65-1.771-6.5-1.5a15 15 0 0 0-3.288.668S32.5 18 31 19c-2.07 1.38-6.255 5.744-6.255 5.744-1.428 1.397-3.05 2.732-5.245 3.756 0 0 7 3 11.5 3 5.063 0 7-3.5 7-3.5 1.5-3.305 3.5-7 5.5-9.5" fill="#163c9a"/><path d="M4 17.5v17c0 1 6 5.5 15 5.5 10 0 17.05-7.705 19-12 0 0-1.937 3.5-7 3.5-4.5 0-11.5-3-11.5-3-5.117-2.239-10.03-6.577-12.906-9.117C4.974 17.953 4 17.093 4 17.5" fill="#3370ff"/></svg>
</template>
