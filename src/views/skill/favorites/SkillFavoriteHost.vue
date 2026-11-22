<script setup lang="ts">
import { computed, h, onBeforeUnmount, ref, watch } from 'vue'
import { Button, message } from 'ant-design-vue'
import { useSkillFavoriteStore } from '@/stores/skillFavorite'
import SkillFavoriteFolderForm from './SkillFavoriteFolderForm.vue'
import { getToken } from '@/utils/auth'
const store = useSkillFavoriteStore()
const newFolder = ref(false)
const feedbackKey = 'skill-favorite-feedback'
const feedback = computed(() => {
  if (!store.dialog && store.actionError) return {
    text: store.actionError, type: store.uncertain ? 'warning' as const : 'error' as const,
    action: store.pending ? 'retry' as const : undefined,
  }
  if (store.notice) return {
    text: store.notice, type: store.noticeType, action: store.undo ? 'undo' as const : undefined,
  }
  return undefined
})
watch([feedback, () => store.locked, () => store.busy], ([value], [previous]) => {
  if (!value || (previous?.action === 'undo' && !value.action && previous.text === value.text)) {
    message.destroy(feedbackKey)
    return
  }
  if (value === previous && !value.action) return
  const retry = value.action === 'retry'
  const action = value.action ? h(Button, {
    type: 'link', size: 'small', disabled: retry ? store.busy : store.locked, loading: retry && store.busy,
    onClick: () => { if (retry) void store.retry(); else void store.restore() },
  }, () => retry ? '使用原请求重试确认' : '撤销') : undefined
  message.open({
    key: feedbackKey, type: value.type, duration: retry ? 0 : action ? 5 : 3,
    content: action ? h('span', [value.text, ' ', action]) : value.text,
  })
}, { immediate: true })
onBeforeUnmount(() => message.destroy(feedbackKey))
let focusTarget = '', focusToken: string | null = null
watch(() => store.dialog, value => {
  if (!value) return
  focusToken = getToken()
  focusTarget = 'skillId' in value ? `[data-favorite-skill="${CSS.escape(value.skillId)}"]`
    : 'folder' in value ? `[data-favorite-folder="${CSS.escape(value.folder.folderId)}"]` : '[data-favorite-new]'
})
function restoreFocus() {
  if (!focusTarget || focusToken !== getToken() || store.dialog) return
  const target = document.querySelector<HTMLElement>(`${focusTarget}:not(:disabled)`)
    || document.querySelector<HTMLElement>('[data-favorite-new]:not(:disabled)')
    || document.querySelector<HTMLElement>('.module-nav a[aria-current], .back')
  target?.focus()
}
const selection = computed(() => store.dialog?.type === 'create' || store.dialog?.type === 'move' ? store.dialog : undefined)
const title = computed(() => {
  const dialog = store.dialog
  if (dialog?.type === 'create') return `收藏 Skill ${dialog.name}`
  return { create: '收藏 Skill', move: '移动到收藏夹', createFolder: '创建新收藏夹', renameFolder: '重命名收藏夹', deleteFolder: '删除收藏夹' }[dialog?.type || 'create']
})
watch(() => store.dialog, () => { newFolder.value = false })
watch(() => store.selectedFolder, () => { if (!store.busy) return; newFolder.value = false })
function openNewFolder() {
  if (store.locked) return
  store.actionError = ''; newFolder.value = true
}
function closeNewFolder() {
  if (store.locked) return
  newFolder.value = false; store.actionError = ''
}
function confirmSelection() {
  const value = selection.value
  if (!value || !store.selectedFolder || store.locked) return
  void store.submit(value.type === 'move' ? { type: 'move', favoriteId: value.favoriteId!, folderId: store.selectedFolder }
    : { type: 'create', skillId: value.skillId, folderId: store.selectedFolder })
}
</script>
<template>
  <a-modal :open="!!store.dialog && !newFolder" :title="title" :footer="null" :closable="!store.locked" :mask-closable="!store.locked" :keyboard="!store.locked" :width="500" :destroy-on-close="true" :focus-trigger-after-close="false" :after-close="restoreFocus" @cancel="store.close">
    <div class="favorite-dialog">
      <a-alert v-if="store.actionError" :type="store.uncertain ? 'warning' : 'error'" :message="store.actionError" show-icon role="status" />
      <div v-if="store.uncertain" class="recovery"><a-button :loading="store.busy" @click="store.retry">使用原请求重试确认</a-button><a-button :disabled="store.busy" @click="store.loadFolders">重新读取收藏夹</a-button></div>
      <template v-if="selection">
        <p v-if="selection.type === 'move'" class="skill-name">{{ selection.name }}</p>
        <a-alert v-if="store.readError" type="error" :message="store.readError"><template #action><a-button @click="store.loadFolders">重试</a-button></template></a-alert>
        <div v-if="store.folders" class="folder-options" role="radiogroup" aria-label="目标收藏夹">
          <label v-for="folder in store.folders.folders" :key="folder.folderId" :class="{ selected: store.selectedFolder === folder.folderId }">
            <input v-model="store.selectedFolder" type="radio" name="favorite-destination" :value="folder.folderId" :disabled="store.locked" />
            <span>{{ folder.name }}</span><small>{{ folder.count }}</small>
          </label>
        </div><p v-else role="status">正在加载收藏夹…</p>
        <a-button type="link" :disabled="store.locked || !store.folders" @click="openNewFolder">+ 新建收藏夹</a-button>
        <div class="modal-actions"><a-button :disabled="store.locked" @click="store.close">取消</a-button>
          <a-button type="primary" :loading="store.busy" :disabled="store.locked || !store.selectedFolder || !store.folders?.folders.some(folder => folder.folderId === store.selectedFolder) || (selection.type === 'move' && store.selectedFolder === selection.folderId)" @click="confirmSelection">{{ store.busy ? '保存中…' : selection.type === 'move' ? '确认移动' : '确认收藏' }}</a-button>
        </div>
      </template>
      <SkillFavoriteFolderForm v-else-if="store.dialog?.type === 'createFolder'" @cancel="store.close" />
      <SkillFavoriteFolderForm v-else-if="store.dialog?.type === 'renameFolder'" :folder="store.dialog.folder" @cancel="store.close" />
      <template v-else-if="store.dialog?.type === 'deleteFolder'">
        <p class="skill-name">{{ store.dialog.folder.name }}</p>
        <p>当前包含 {{ store.dialog.folder.count }} 项收藏。删除后，其中所有收藏将移入默认收藏夹，收藏时间保持不变。</p>
        <div class="modal-actions"><a-button :disabled="store.locked" @click="store.close">取消</a-button><a-button danger type="primary" :loading="store.busy" :disabled="store.locked" @click="store.submit({ type: 'deleteFolder', folderId: store.dialog.folder.folderId })">{{ store.dialog.folder.count ? '删除并移入默认收藏夹' : '删除收藏夹' }}</a-button></div>
      </template>
    </div>
  </a-modal>
  <a-modal :open="newFolder && !!selection" title="创建新收藏夹" :footer="null" :closable="!store.locked" :mask-closable="!store.locked" :keyboard="!store.locked" :width="500" :destroy-on-close="true" :focus-trigger-after-close="true" @cancel="closeNewFolder">
    <div class="favorite-dialog">
      <a-alert v-if="store.actionError" :type="store.uncertain ? 'warning' : 'error'" :message="store.actionError" show-icon role="status" />
      <div v-if="store.uncertain" class="recovery"><a-button :loading="store.busy" @click="store.retry">使用原请求重试确认</a-button><a-button :disabled="store.busy" @click="store.loadFolders">重新读取收藏夹</a-button></div>
      <SkillFavoriteFolderForm @cancel="closeNewFolder" />
    </div>
  </a-modal>
</template>
<style lang="scss" scoped>
.favorite-dialog { display: grid; gap: 16px; padding-top: 12px; font-size: $skill-font-size-body; }.favorite-dialog p { margin: 0; color: $color-text-secondary; }.favorite-dialog .skill-name { color: $color-text-primary; font-weight: 600; overflow-wrap: anywhere; }.folder-options { display: grid; gap: 8px; max-height: 280px; overflow: auto; }.folder-options label { display: flex; gap: 10px; align-items: center; min-height: 44px; padding: 10px 12px; border: 1px solid $color-border; border-radius: $radius-input; cursor: pointer; }.folder-options label.selected { border-color: $color-primary; background: $color-primary-bg; }.folder-options span { flex: 1; overflow-wrap: anywhere; }.folder-options small { color: $color-text-secondary; }.modal-actions, .recovery { display: flex; justify-content: flex-end; flex-wrap: wrap; gap: 10px; }.modal-actions { border-top: 1px solid $color-border; padding-top: 18px; }.modal-actions :deep(.ant-btn) { min-height: 40px; }@media(max-width: 520px) { .modal-actions :deep(.ant-btn) { font-size: $skill-font-size-secondary; } }
</style>
