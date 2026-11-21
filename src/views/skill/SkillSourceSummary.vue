<script setup lang="ts">
import { computed } from 'vue'
import { GithubOutlined, FileZipOutlined } from '@ant-design/icons-vue'
import type { SkillSource } from '@/types/skill'
import { skillGithubSourceUrl } from '@/utils/skill'
const props = defineProps<{ source: SkillSource }>()
const link = computed(() => skillGithubSourceUrl(props.source))
</script>
<template>
  <div class="source-summary">
    <template v-if="source.type === 'GITHUB'">
      <div class="source-heading"><GithubOutlined /><strong>GitHub 固定来源</strong></div>
      <a v-if="link" class="repository" :href="link" target="_blank" rel="noopener noreferrer">{{ source.repositoryUrl }}</a>
      <span v-else class="repository">{{ source.repositoryUrl }}</span>
      <div class="source-facts"><span><span class="fact-label">目录</span><code>{{ source.directory || '仓库根目录' }}</code></span><span><span class="fact-label">{{ source.resolvedRefType }}</span><code>{{ source.requestedRef }}</code></span></div>
      <div class="commit"><span class="fact-label">Commit</span><code>{{ source.commitSha }}</code></div>
      <span v-if="source.fetchedAt" class="fetched-at">获取时间：{{ new Date(source.fetchedAt).toLocaleString('zh-CN', { hour12: false }) }}</span><small>平台从此提交获取文件；仓库归属不代表原作者或分发权已验证。</small>
    </template>
    <div v-else class="source-heading"><FileZipOutlined /><strong>ZIP 上传 · 来源地址由作者提供</strong></div>
  </div>
</template>
<style scoped lang="scss">
.source-summary { display: grid; gap: 8px; margin-top: 16px; padding: 16px; border: 1px solid $color-border; border-radius: $radius-input; background: $color-bg-secondary; font-size: $font-size-caption; line-height: 1.7; }
.source-summary > * { min-width: 0; overflow-wrap: anywhere; }.source-heading { display: flex; align-items: baseline; gap: 8px; color: $color-text-secondary; }.source-heading strong { color: $color-text-primary; font-size: $font-size-caption; font-weight: 500; }.source-heading .anticon { font-size: $font-size-body; }.repository { color: $color-text-secondary; }a.repository:hover { color: $color-primary; }
.source-facts { display: flex; flex-wrap: wrap; gap: 6px 20px; }.source-facts > span, .commit { display: flex; align-items: baseline; gap: 8px; }.fact-label { flex: none; color: $color-text-tertiary; }.source-summary code { min-width: 0; color: $color-text-secondary; font: 12px/1.7 Consolas, 'SFMono-Regular', monospace; user-select: all; overflow-wrap: anywhere; }.source-summary small, .fetched-at { font-size: $font-size-caption; color: $color-text-tertiary; }.source-summary small { padding-top: 8px; border-top: 1px solid $color-border; }
</style>
