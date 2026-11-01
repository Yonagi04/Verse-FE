<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { FileOutlined, FolderOutlined, FolderOpenOutlined, RightOutlined, DownOutlined } from '@ant-design/icons-vue'
import { skillFiles, skillFileContent } from '@/api/skill'
import type { SkillFileContent, SkillFiles } from '@/types/skill'
import { skillFileTree, visibleSkillFiles, type SkillFileNode } from '@/utils/skillFiles'
import { apiErrorDetails } from '@/utils/apiError'
import SkillFilePreview from './SkillFilePreview.vue'

const props = defineProps<{ skillId: string; versionId: string }>()
const result = ref<SkillFiles>()
const loading = ref(false)
const error = ref('')
const selected = ref('')
const preview = ref<SkillFileContent>()
const previewLoading = ref(false)
const previewError = ref('')
const rootExpanded = ref(true)
const expanded = ref(new Set<string>())
const tree = computed(() => skillFileTree(result.value?.items ?? []))
const visible = computed(() => visibleSkillFiles(tree.value, expanded.value))
let listController: AbortController | undefined
let previewController: AbortController | undefined
let listTurn = 0
let previewTurn = 0

async function load() {
  listController?.abort(); previewController?.abort(); previewTurn++
  listController = new AbortController()
  const turn = ++listTurn
  loading.value = true; error.value = ''; result.value = undefined; selected.value = ''; preview.value = undefined
  previewError.value = ''; previewLoading.value = false; rootExpanded.value = true; expanded.value = new Set()
  try {
    const value = await skillFiles(props.skillId, props.versionId, listController.signal)
    if (turn !== listTurn) return
    if (value.versionId !== props.versionId) throw new Error('文件版本已变化，请刷新详情后重试')
    result.value = value
  } catch (failure) {
    const parsed = apiErrorDetails(failure)
    if (turn === listTurn && !parsed.cancelled) error.value = parsed.message
  } finally { if (turn === listTurn) loading.value = false }
}
function toggle(node: SkillFileNode) {
  if (expanded.value.has(node.path)) expanded.value.delete(node.path)
  else expanded.value.add(node.path)
}
async function select(path: string) {
  previewController?.abort(); previewController = new AbortController()
  const turn = ++previewTurn
  selected.value = path; preview.value = undefined; previewError.value = ''; previewLoading.value = true
  try {
    const value = await skillFileContent(props.skillId, props.versionId, path, previewController.signal)
    if (turn !== previewTurn) return
    if (value.versionId !== props.versionId || value.relativePath !== path) throw new Error('文件版本已变化，请刷新详情后重试')
    preview.value = value
  } catch (failure) {
    const parsed = apiErrorDetails(failure)
    if (turn === previewTurn && !parsed.cancelled) previewError.value = parsed.message
  } finally { if (turn === previewTurn) previewLoading.value = false }
}
watch([() => props.skillId, () => props.versionId], load, { immediate: true })
onBeforeUnmount(() => { listTurn++; previewTurn++; listController?.abort(); previewController?.abort() })
</script>
<template>
  <section class="file-browser" aria-label="Skill 包文件">
    <div class="files-heading"><h2>文件</h2><span v-if="result">共 {{ result.items.length }} 个文件</span></div>
    <a-alert v-if="error" type="error" show-icon :message="error"><template #action><a-button @click="load">重试</a-button></template></a-alert>
    <a-spin :spinning="loading">
      <div v-if="result" class="files-layout">
        <nav class="file-tree" aria-label="文件目录">
          <button type="button" class="tree-root" :aria-expanded="rootExpanded" aria-label="展开或收起根目录" @click="rootExpanded = !rootExpanded">
            <FolderOpenOutlined v-if="rootExpanded" /><FolderOutlined v-else />
            <strong>{{ result.rootName }}</strong>
            <DownOutlined v-if="rootExpanded" /><RightOutlined v-else />
          </button>
          <ul v-if="rootExpanded" class="tree-list">
            <li v-for="node in visible" :key="node.path" :style="{ paddingLeft: `${12 + node.depth * 16}px` }" :class="{ selected: selected === node.path }">
              <button v-if="node.directory" type="button" class="folder-button" :aria-label="(expanded.has(node.path) ? '收起 ' : '展开 ') + node.path" :aria-expanded="expanded.has(node.path)" @click="toggle(node)">
                <FolderOpenOutlined v-if="expanded.has(node.path)" /><FolderOutlined v-else />
                <span class="node-name" :title="node.path">{{ node.name }}</span>
                <DownOutlined v-if="expanded.has(node.path)" /><RightOutlined v-else />
              </button>
              <button v-else type="button" class="file-button" :aria-pressed="selected === node.path" :title="node.path" @click="select(node.path)"><FileOutlined /><span class="node-name">{{ node.name }}</span></button>
            </li>
          </ul>
          <p v-if="result.items.length === 0" class="tree-empty">包内暂无文件</p>
        </nav>
        <div class="preview-panel">
          <a-spin :spinning="previewLoading">
            <a-alert v-if="previewError" type="error" show-icon :message="previewError"><template #action><a-button @click="select(selected)">重试</a-button></template></a-alert>
            <SkillFilePreview v-else-if="preview" :file="preview" />
            <div v-else class="preview-placeholder" role="status">{{ previewLoading ? '正在读取文件…' : '选择左侧文件查看内容' }}</div>
          </a-spin>
        </div>
      </div>
    </a-spin>
  </section>
</template>
<style scoped lang="scss">
.file-browser { min-width: 0; }
.files-heading { display: flex; align-items: baseline; flex-wrap: wrap; gap: 12px; margin-bottom: 20px; }
.files-heading h2 { margin: 0; font-size: 20px; color: $color-text-primary; }
.files-heading > span { font-size: 12px; color: $color-text-tertiary; }
.files-layout { display: grid; grid-template-columns: 210px minmax(0, 1fr); min-height: 380px; }
.file-tree { min-width: 0; padding-right: 12px; border-right: 1px solid $color-border; }
.file-tree button { border: 0; padding: 8px 6px; background: transparent; color: inherit; cursor: pointer; border-radius: 4px; }
.file-tree button:hover { background: $color-bg-hover; }
.tree-root, .folder-button, .file-button { display: flex; align-items: center; gap: 10px; width: 100%; min-height: 40px; text-align: left; font-size: 14px; line-height: 24px; }
.file-tree button > .anticon { flex: none; font-size: 16px; }
.tree-root strong { flex: 1; min-width: 0; overflow-wrap: anywhere; }
.tree-list { list-style: none; margin: 0; padding: 0; max-height: 510px; overflow: auto; }
.tree-list li { padding: 0 4px; min-height: 40px; border-radius: 4px; }
.tree-list li.selected { background: $color-primary-bg; color: $color-primary; }
.node-name { flex: 1; min-width: 0; text-overflow: ellipsis; white-space: nowrap; overflow: hidden; }
.preview-panel { min-width: 0; padding-left: 16px; }
.preview-placeholder { min-height: 330px; display: grid; place-items: center; padding: 24px; font-size: 13px; color: $color-text-tertiary; }
.tree-empty { padding: 10px 12px; color: $color-text-tertiary; font-size: 11px; }
@media(max-width: 650px) { .files-layout { grid-template-columns: 1fr; }.file-tree { padding-right: 0; padding-bottom: 16px; border-right: 0; border-bottom: 1px solid $color-border; }.preview-panel { padding-left: 0; padding-top: 16px; }.tree-list { max-height: 220px; } }
</style>
