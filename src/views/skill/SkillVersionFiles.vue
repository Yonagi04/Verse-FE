<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { FileTextOutlined } from '@ant-design/icons-vue'
import { versionChanges, versionComparison, versionFiles, versionContent, type VersionFileTarget } from '@/api/skillVersion'
import type { VersionChanges, FileComparison } from '@/types/skillVersion'
import type { SkillFiles, SkillFileContent } from '@/types/skill'
import { apiErrorDetails } from '@/utils/apiError'
import { skillBytes } from '@/utils/skill'
import { useUserStore } from '@/stores/user'
import SkillFilePreview from './SkillFilePreview.vue'
import SkillTextDiff from './SkillTextDiff.vue'
const props = defineProps<{ skillId: string; target: VersionFileTarget }>()
const user = useUserStore()
const changes = ref<VersionChanges>(), files = ref<SkillFiles>(), comparison = ref<FileComparison>(), content = ref<SkillFileContent>()
const loading = ref(false), reading = ref(false), listError = ref(''), changeError = ref(''), error = ref(''), selected = ref('')
const mode = ref<'changes' | 'new'>('changes')
const initialVersion = computed(() => changes.value?.baseVersionId === null)
let controller = new AbortController(), fileController = new AbortController(), generation = 0, fileGeneration = 0
const labels = { ADDED: '新增', MODIFIED: '修改', DELETED: '删除', UNCHANGED: '未变' }
const items = computed(() => mode.value === 'new' ? (files.value?.items || []).map(file => ({ ...file, changeType: '' }))
  : (changes.value?.items || []).filter(file => file.changeType !== 'UNCHANGED')
    .map(file => ({ ...(file.newFile || file.oldFile!), changeType: labels[file.changeType] })))
async function load() {
  controller.abort(); fileController.abort(); controller = new AbortController(); const turn = ++generation; fileGeneration++
  changes.value = undefined; files.value = undefined; comparison.value = undefined; content.value = undefined; selected.value = ''
  loading.value = true; listError.value = ''; changeError.value = ''; error.value = ''; mode.value = 'changes'
  const values = await Promise.allSettled([versionChanges(props.skillId, props.target, controller.signal), versionFiles(props.skillId, props.target, controller.signal)])
  if (turn !== generation) return
  if (values[0].status === 'fulfilled') changes.value = values[0].value
  else { const parsed = apiErrorDetails(values[0].reason); if (!parsed.cancelled) changeError.value = parsed.message }
  if (values[1].status === 'fulfilled') files.value = values[1].value
  else { const parsed = apiErrorDetails(values[1].reason); if (!parsed.cancelled) listError.value = parsed.message }
  if (initialVersion.value) mode.value = 'new'
  loading.value = false
  selectDefaultFile()
}
async function select(path: string) {
  fileController.abort(); fileController = new AbortController(); const turn = ++fileGeneration
  selected.value = path; comparison.value = undefined; content.value = undefined; error.value = ''; reading.value = true
  try {
    if (mode.value === 'changes') {
      const value = await versionComparison(props.skillId, props.target, path, fileController.signal)
      if (turn === fileGeneration) comparison.value = value
    } else {
      const value = await versionContent(props.skillId, props.target, path, fileController.signal)
      if (turn === fileGeneration) content.value = value
    }
  } catch (failure) { const parsed = apiErrorDetails(failure); if (turn === fileGeneration && !parsed.cancelled) error.value = parsed.message }
  finally { if (turn === fileGeneration) reading.value = false }
}
function changeMode(value: typeof mode.value) {
  mode.value = value; selected.value = ''; comparison.value = undefined; content.value = undefined; fileController.abort(); fileGeneration++
  selectDefaultFile()
}
function selectDefaultFile() {
  const file = items.value.find(value => value.relativePath === 'SKILL.md') || items.value[0]
  if (file) void select(file.relativePath)
}
const diffReady = computed(() => !!comparison.value && [comparison.value.oldFile, comparison.value.newFile]
  .every(file => file === null || (file.status === 'READY' && file.content !== null)))
const unavailable = computed(() => [comparison.value?.oldFile, comparison.value?.newFile]
  .filter(file => file && file.status !== 'READY').map(file => `${file!.relativePath}：${file!.status === 'TOO_LARGE' ? '超过 1 MiB 预览上限' : '格式、二进制或编码不支持'}`))
watch([() => props.skillId, () => JSON.stringify(props.target), () => user.token], load, { immediate: true })
onBeforeUnmount(() => { generation++; fileGeneration++; controller.abort(); fileController.abort() })
</script>
<template>
  <section class="version-files">
    <header class="file-tabs">
      <strong v-if="initialVersion" class="files-heading">文件</strong>
      <template v-else>
        <div class="file-modes" aria-label="文件查看范围">
          <button type="button" :aria-pressed="mode === 'changes'" :class="{ active: mode === 'changes' }" @click="changeMode('changes')">文件差异</button>
          <button type="button" :aria-pressed="mode === 'new'" :class="{ active: mode === 'new' }" @click="changeMode('new')">完整文件 · 本版</button>
        </div>
        <span v-if="changes?.baseVersionId" class="base-version">相对 {{ changes.baseVersion || '基准信息不可用' }}</span>
      </template>
    </header>
    <a-alert v-if="(mode === 'new' ? listError : changeError)" type="error" show-icon :message="mode === 'new' ? listError : changeError"><template #action><a-button size="small" @click="load">重试</a-button></template></a-alert>
    <a-spin :spinning="loading"><div class="file-layout">
      <aside aria-label="版本文件列表">
        <p class="file-list-heading">{{ mode === 'changes' ? '变化文件' : '全部文件' }} <span>{{ items.length }}</span></p>
        <button v-for="file in items" :key="file.relativePath" type="button" :aria-pressed="selected === file.relativePath" :class="{ selected: selected === file.relativePath }" @click="select(file.relativePath)">
          <FileTextOutlined class="file-icon" /><span class="file-path" :title="file.relativePath">{{ file.relativePath }}</span><small :data-change="file.changeType">{{ file.changeType || skillBytes(file.sizeBytes) }}</small>
        </button>
        <p v-if="!loading && !items.length" class="empty">{{ mode === 'changes' ? '没有文件变化' : '没有文件' }}</p>
      </aside>
      <div class="file-body"><a-spin :spinning="reading"><a-alert v-if="error" type="error" show-icon :message="error"><template #action><a-button @click="select(selected)">重试读取</a-button></template></a-alert><template v-else-if="comparison"><header class="file-title"><strong>{{ selected }}</strong><small>只读 · {{ labels[comparison.changeType] }}</small></header><SkillTextDiff v-if="diffReady" :key="selected" :old-text="comparison.oldFile?.content ?? ''" :new-text="comparison.newFile?.content ?? ''" /><div v-else class="empty"><p v-for="reason in unavailable" :key="reason">{{ reason }}</p><p>文件变化已记录，无法展示此文件的文本差异。</p></div></template><SkillFilePreview v-else-if="content" :file="content" /><div v-else class="empty">{{ items.length ? '选择文件查看只读内容' : '当前范围没有文件变化' }}</div></a-spin></div>
    </div></a-spin>
  </section>
</template>
<style scoped lang="scss">
.version-files { @include skill-page-typography($font-size-body, $font-size-caption); border-top: 1px solid $color-border; }
.file-tabs { display: flex; align-items: center; flex-wrap: wrap; gap: 10px 16px; padding: 12px 20px; border-bottom: 1px solid $color-border; background: $color-bg-secondary; }
.file-modes { display: inline-flex; flex-wrap: wrap; gap: 2px; padding: 3px; background: $color-bg; border: 1px solid $color-border; border-radius: $radius-input; }
.file-tabs button { padding: 5px 10px; border: 0; border-radius: 5px; background: transparent; color: $color-text-secondary; font-size: $font-size-caption; cursor: pointer; line-height: 1.6; }.file-tabs button:hover { color: $color-primary; }.file-tabs button.active { background: $color-primary-bg; color: $color-primary; font-weight: 500; }
.files-heading { color: $color-text-primary; font-size: $font-size-body; }.base-version { margin-left: auto; color: $color-text-tertiary; font-size: $font-size-caption; overflow-wrap: anywhere; }
.file-layout { display: grid; grid-template-columns: 204px minmax(0, 1fr); min-height: 420px; }
aside { padding: 8px; border-right: 1px solid $color-border; max-height: 580px; overflow-y: auto; }
.file-list-heading { display: flex; justify-content: space-between; gap: 8px; padding: 8px; margin: 0 0 4px; color: $color-text-tertiary; font-size: $font-size-caption; }
aside button { display: flex; align-items: center; gap: 8px; width: 100%; padding: 9px 8px; margin-bottom: 2px; border: 0; border-radius: 6px; background: transparent; color: $color-text-secondary; text-align: left; cursor: pointer; }
aside button:hover { background: $color-bg-hover; }aside button.selected { background: $color-primary-bg; color: $color-primary; }
.file-icon { flex: none; font-size: $font-size-body; color: $color-text-tertiary; }.selected .file-icon { color: $color-primary; }.file-path { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: 12px/1.6 Consolas, 'SFMono-Regular', monospace; }
aside button small { flex: none; font-size: $font-size-caption; }[data-change='新增'] { color: $color-success; }[data-change='修改'] { color: $color-primary; }[data-change='删除'] { color: $color-danger; }
.file-tabs button:focus-visible, aside button:focus-visible { outline: 2px solid $color-focus; outline-offset: -2px; }
.file-body { min-width: 0; }.file-title { display: flex; align-items: baseline; justify-content: space-between; flex-wrap: wrap; gap: 6px 12px; padding: 12px 16px; border-bottom: 1px solid $color-border; background: $color-bg-secondary; font-size: $font-size-caption; overflow-wrap: anywhere; }.file-title strong { font: 500 12px/1.6 Consolas, 'SFMono-Regular', monospace; color: $color-text-primary; }.file-title small { color: $color-text-tertiary; }
.empty { padding: 60px 18px; color: $color-text-tertiary; text-align: center; font-size: $font-size-caption; }.file-body > .ant-spin-nested-loading { min-height: 300px; }
:deep(.preview-toolbar strong), :deep(.preview-toolbar > span), :deep(.markdown-modes button), :deep(.highlight-note), :deep(.empty-note) { font-size: $font-size-caption; }
@media (min-width: 901px) and (max-width: 1200px) { .file-layout { grid-template-columns: 168px minmax(0, 1fr); }.file-tabs { padding: 10px 12px; }.base-version { margin-left: 0; } }
@media (max-width: 600px) { .file-layout { grid-template-columns: 1fr; }aside { max-height: 180px; border-right: 0; border-bottom: 1px solid $color-border; }.file-tabs { padding: 12px; gap: 8px; }.file-tabs button { padding: 6px 8px; }.base-version { width: 100%; margin: 0; } }
</style>
