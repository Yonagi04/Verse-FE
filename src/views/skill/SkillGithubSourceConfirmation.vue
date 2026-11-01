<script setup lang="ts">
import { ref, watch } from 'vue'
import type { SkillGithubSourceOption } from '@/types/skill'
const props = defineProps<{ options: SkillGithubSourceOption[]; busy: boolean }>()
const emit = defineEmits<{ confirm: [id: string] }>()
const selected = ref('')
watch(() => props.options, values => { selected.value = values.length === 1 ? values[0]!.sourceOptionId : '' }, { immediate: true })
</script>
<template>
  <section class="source-confirmation" aria-label="确认固定 GitHub 来源">
    <h3>确认导入来源</h3><p>请核对引用与目录。分支或 Tag 此后变化不会修改本次快照。</p>
    <a-radio-group v-model:value="selected" :disabled="busy" class="source-options">
      <label v-for="option in options" :key="option.sourceOptionId" class="source-option">
        <a-radio :value="option.sourceOptionId">{{ option.source.resolvedRefType }} · {{ option.source.requestedRef }}</a-radio>
        <span>{{ option.source.repositoryUrl }}</span><span>目录：{{ option.source.directory || '仓库根目录' }}</span>
        <code>{{ option.source.commitSha }}</code>
      </label>
    </a-radio-group>
    <a-button type="primary" :disabled="!selected || busy" :loading="busy" @click="emit('confirm', selected)">确认并获取固定提交</a-button>
  </section>
</template>
<style scoped lang="scss">
.source-confirmation h3 { color: $color-text-primary; }.source-confirmation p { color: $color-text-secondary; line-height: 1.8; }.source-options { display: grid; gap: 12px; margin-bottom: 18px; }.source-option { display: grid; gap: 8px; padding: 16px; border: 1px solid $color-border; border-radius: $radius-input; min-width: 0; }.source-option span, .source-option code { overflow-wrap: anywhere; font-size: 12px; color: $color-text-secondary; }.source-option .ant-radio-wrapper { color: $color-text-primary; }
</style>
