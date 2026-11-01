<script setup lang="ts">
import { ref, watch } from 'vue'
import type { SkillGithubCandidates } from '@/types/skill'
import { skillBytes } from '@/utils/skill'
const props = defineProps<{ result: SkillGithubCandidates; busy: boolean; loading: boolean }>()
const emit = defineEmits<{ select: [id: string]; page: [page: number] }>()
const selected = ref('')
watch(() => props.result.scanDigest, () => { selected.value = '' })
</script>
<template>
  <section aria-label="选择一个 Skill 目录">
    <h3>选择一个 Skill</h3><p>本次找到 {{ result.total }} 个匹配。初检可选的目录还会经过完整检查，每次只发布一个。</p>
    <a-spin :spinning="loading"><a-radio-group v-model:value="selected" :disabled="busy || loading" class="candidate-list">
      <article v-for="candidate in result.items" :key="candidate.candidateId" class="candidate">
        <a-radio :value="candidate.candidateId" :disabled="!candidate.selectable || busy">{{ candidate.packageName || '元信息待修正' }}</a-radio>
        <code>{{ candidate.directory || '仓库根目录' }}</code><span>{{ candidate.packageDescription }}</span>
        <small>{{ candidate.fileCount }} 个文件 · {{ skillBytes(candidate.unpackedBytes) }}</small>
        <a-alert v-for="issue in candidate.issues" :key="`${issue.code}:${issue.path}`" type="error" show-icon
          :message="`${issue.path}：${issue.message}`" />
      </article>
    </a-radio-group></a-spin>
    <a-pagination v-if="result.total > result.size" :current="result.page" :total="result.total" :page-size="result.size"
      :disabled="busy || loading" :show-size-changer="false" @change="(page: number) => emit('page', page)" />
    <a-button type="primary" :disabled="!selected || busy || loading" :loading="busy" @click="emit('select', selected)">检查所选目录</a-button>
  </section>
</template>
<style scoped lang="scss">
h3 { color: $color-text-primary; }p { color: $color-text-secondary; line-height: 1.8; }.candidate-list { display: grid; gap: 12px; margin-bottom: 18px; }.candidate { display: grid; gap: 8px; padding: 16px; border: 1px solid $color-border; border-radius: $radius-input; min-width: 0; }.candidate code, .candidate span { overflow-wrap: anywhere; color: $color-text-secondary; font-size: 12px; }.candidate small { color: $color-text-tertiary; }.ant-pagination { margin-bottom: 18px; }section > .ant-btn { margin-top: 12px; }
</style>
