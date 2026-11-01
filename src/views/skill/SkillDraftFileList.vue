<script setup lang="ts">
import type { SkillDraftFiles } from '@/types/skill'
import { skillBytes } from '@/utils/skill'
defineProps<{ result: SkillDraftFiles; loading: boolean }>()
const emit = defineEmits<{ page: [page: number] }>()
</script>
<template>
  <section class="file-preview" aria-label="当前 Skill 文件清单">
    <h3>即将公开的文件（{{ result.total }}）</h3>
    <a-spin :spinning="loading"><ul><li v-for="file in result.items" :key="file.relativePath"><code>{{ file.relativePath }}</code><span>{{ skillBytes(file.sizeBytes) }}</span></li></ul></a-spin>
    <a-pagination v-if="result.total > result.size" :current="result.page" :total="result.total" :page-size="result.size"
      :show-size-changer="false" :disabled="loading" @change="(page: number) => emit('page', page)" />
  </section>
</template>
<style scoped lang="scss">
.file-preview { margin-top: 18px; }.file-preview h3 { color: $color-text-primary; font-size: 14px; }.file-preview ul { padding: 0; list-style: none; max-height: 320px; overflow: auto; }.file-preview li { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 8px 0; border-bottom: 1px solid $color-border; font-size: 12px; }.file-preview code { overflow-wrap: anywhere; color: $color-text-primary; }.file-preview li span { flex: none; color: $color-text-tertiary; }
</style>
