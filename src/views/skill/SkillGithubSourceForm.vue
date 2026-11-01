<script setup lang="ts">
import type { SkillGithubInput } from '@/types/skill'
import { skillBytes } from '@/utils/skill'
const props = defineProps<{ modelValue: SkillGithubInput; busy: boolean; disabled: boolean; maxArchiveBytes?: number }>()
const emit = defineEmits<{ 'update:modelValue': [value: SkillGithubInput]; import: [] }>()
const update = (value: Partial<SkillGithubInput>) => emit('update:modelValue', { ...props.modelValue, ...value })
</script>
<template>
  <div class="github-form">
    <label for="skill-github-url">公开 GitHub 仓库地址</label>
    <a-input id="skill-github-url" :value="modelValue.repositoryUrl" :maxlength="2048" :disabled="disabled || busy"
      placeholder="https://github.com/owner/repository，也支持 tree 链接"
      @update:value="(value: string) => update({ repositoryUrl: value })" />
    <div class="ref-row">
      <div><label for="skill-github-ref-type">引用类型</label>
        <a-select id="skill-github-ref-type" :value="modelValue.refType === 'DEFAULT' ? 'AUTO' : modelValue.refType" :disabled="disabled || busy"
          :options="[{ value: 'AUTO', label: '自动识别' }, { value: 'BRANCH', label: '分支' }, { value: 'TAG', label: 'Tag' }, { value: 'COMMIT', label: '完整提交 SHA' }]"
          @update:value="(value: unknown) => update({ refType: value as SkillGithubInput['refType'] })" /></div>
      <div><label for="skill-github-ref">引用（可选）</label>
        <a-input id="skill-github-ref" :value="modelValue.ref || ''" :maxlength="255" :disabled="disabled || busy"
          placeholder="留空使用仓库默认分支" @update:value="(value: string) => update({ ref: value })" /></div>
    </div>
    <label for="skill-github-directory">扫描目录（可选）</label>
    <a-input id="skill-github-directory" :value="modelValue.directory || ''" :maxlength="512" :disabled="disabled || busy"
      placeholder="例如 skills；tree 链接由服务端解析目录"
      @update:value="(value: string) => update({ directory: value })" />
    <p>无需绑定 GitHub。解析后请确认分支、目录与固定提交；只读取公开内容，不执行仓库脚本。</p>
    <p v-if="maxArchiveBytes">当前需获取完整仓库快照，压缩包上限 {{ skillBytes(maxArchiveBytes) }}。大仓库可上传所选目录的 ZIP。</p>
    <a-button type="primary" :loading="busy" :disabled="disabled || busy || !modelValue.repositoryUrl.trim()" @click="emit('import')">解析 GitHub 来源</a-button>
  </div>
</template>
<style scoped lang="scss">
.github-form { display: grid; gap: 10px; }.github-form label { color: $color-text-primary; font-size: 13px; }.github-form p { margin: 2px 0; color: $color-text-secondary; font-size: 12px; line-height: 1.8; }.ref-row { display: grid; grid-template-columns: 150px 1fr; gap: 12px; }.ref-row > div { position: relative; display: grid; gap: 8px; }.github-form > .ant-btn { justify-self: start; margin-top: 8px; }@media(max-width: 600px) { .ref-row { grid-template-columns: 1fr; } }
</style>
