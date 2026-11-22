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
      <dl class="source-facts">
        <dt>目录</dt><dd><code>{{ source.directory || '仓库根目录' }}</code></dd>
        <dt>引用</dt><dd><code>{{ source.requestedRef }}</code><span class="ref-type">{{ source.resolvedRefType }}</span></dd>
        <dt>Commit</dt><dd><code>{{ source.commitSha }}</code></dd>
      </dl>
      <span v-if="source.fetchedAt" class="fetched-at">获取时间：{{ new Date(source.fetchedAt).toLocaleString('zh-CN', { hour12: false }) }}</span><small>平台从此提交获取文件；仓库归属不代表原作者或分发权已验证。</small>
    </template>
    <div v-else class="source-heading"><FileZipOutlined /><strong>ZIP 上传 · 来源地址由作者提供</strong></div>
  </div>
</template>
<style scoped lang="scss">
.source-summary { display: grid; gap: 8px; margin-top: 16px; padding: 16px; border: 1px solid $color-border; border-radius: $radius-input; background: $color-bg-secondary; font-size: $skill-font-size-secondary; line-height: 1.7; }
.source-summary > * { min-width: 0; overflow-wrap: anywhere; }.source-heading { display: flex; align-items: baseline; gap: 8px; color: $color-text-secondary; }.source-heading strong { color: $color-text-primary; font-size: inherit; font-weight: 500; }.source-heading .anticon { font-size: $font-size-body; }.repository { color: $color-text-secondary; }a.repository:hover { color: $color-primary; }
.source-facts { display: grid; grid-template-columns: max-content minmax(0, 1fr); align-items: baseline; gap: 8px 12px; margin: 4px 0; }.source-facts dt, .ref-type { color: $color-text-tertiary; }.source-facts dd { min-width: 0; margin: 0; overflow-wrap: anywhere; }.ref-type { display: inline-block; margin-left: 8px; font-size: $font-size-caption; }.source-summary code { min-width: 0; color: $color-text-secondary; font: #{$skill-font-size-code}/1.7 Consolas, 'SFMono-Regular', monospace; user-select: all; overflow-wrap: anywhere; }.source-summary small, .fetched-at { font-size: $skill-font-size-secondary; color: $color-text-tertiary; }.source-summary small { padding-top: 8px; border-top: 1px solid $color-border; }
</style>
