<script setup lang="ts">
import { computed } from 'vue'
import type { SkillSource } from '@/types/skill'
import { skillGithubSourceUrl } from '@/utils/skill'
const props = defineProps<{ source: SkillSource }>()
const link = computed(() => skillGithubSourceUrl(props.source))
</script>
<template>
  <div class="source-summary">
    <template v-if="source.type === 'GITHUB'">
      <strong>GitHub 固定来源</strong>
      <a v-if="link" :href="link" target="_blank" rel="noopener noreferrer">{{ source.repositoryUrl }}</a>
      <span v-else>{{ source.repositoryUrl }}</span><span>目录：{{ source.directory || '仓库根目录' }}</span>
      <span>{{ source.resolvedRefType }} · {{ source.requestedRef }}</span><code>{{ source.commitSha }}</code>
      <small>平台从此提交获取文件；仓库归属不代表原作者或分发权已验证。</small>
    </template>
    <strong v-else>ZIP 上传 · 来源地址由作者提供</strong>
  </div>
</template>
<style scoped lang="scss">
.source-summary { display: grid; gap: 8px; margin-top: 16px; padding: 16px; background: $color-bg-secondary; border-radius: $radius-input; font-size: 12px; }.source-summary > * { overflow-wrap: anywhere; }.source-summary strong { color: $color-text-primary; }.source-summary span, .source-summary small { color: $color-text-secondary; line-height: 1.8; }.source-summary code { user-select: all; color: $color-text-secondary; }
</style>
