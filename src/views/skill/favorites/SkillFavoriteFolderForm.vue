<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { FavoriteFolder } from '@/types/skillFavorite'
import { cleanFolderName, folderNameError } from '@/utils/skillFavorite'
import { useSkillFavoriteStore } from '@/stores/skillFavorite'
const props = defineProps<{ folder?: FavoriteFolder }>()
const emit = defineEmits<{ cancel: [] }>()
const store = useSkillFavoriteStore()
const name = ref(props.folder?.name || '')
const field = ref<{ focus: () => void }>()
onMounted(() => field.value?.focus())
const touched = ref(false)
const error = computed(() => folderNameError(name.value, store.folders?.folders || [], props.folder?.folderId))
const full = computed(() => !props.folder && !!store.folders && store.folders.folders.filter(item => !item.defaultFolder).length >= store.folders.folderLimit)
const valid = computed(() => !!store.folders && !error.value && !full.value && cleanFolderName(name.value) !== props.folder?.name)
function submit() {
  touched.value = true
  if (!valid.value || store.locked) return
  void store.submit(props.folder ? { type: 'renameFolder', folderId: props.folder.folderId, name: cleanFolderName(name.value) }
    : { type: 'createFolder', name: cleanFolderName(name.value) })
}
</script>
<template>
  <form class="folder-form" @submit.prevent="submit">
    <label for="favorite-folder-name">收藏夹名称</label>
    <a-input id="favorite-folder-name" ref="field" v-model:value="name" autofocus :disabled="store.locked" :maxlength="160" placeholder="如：开发工具" aria-describedby="favorite-folder-help" @blur="touched = true" />
    <div id="favorite-folder-help" class="help" aria-live="polite"><span v-if="touched && error" class="invalid">{{ error }}</span><span class="name-count">{{ Array.from(cleanFolderName(name)).length }}/20</span></div>
    <a-alert v-if="full" type="warning" message="最多可创建 20 个自定义收藏夹，请先整理已有收藏夹" show-icon />
    <div class="form-actions">
      <a-button html-type="button" :disabled="store.locked" @click="emit('cancel')">取消</a-button>
      <a-button type="primary" html-type="submit" :loading="store.busy" :disabled="!valid || store.locked">{{ store.busy ? (folder ? '保存中…' : '创建中…') : folder ? '保存名称' : '创建' }}</a-button>
    </div>
  </form>
</template>
<style lang="scss" scoped>
.folder-form { display: grid; gap: 12px; }.help { display: flex; justify-content: space-between; gap: 12px; color: $color-text-secondary; font-size: $skill-font-size-secondary; }.name-count { margin-left: auto; flex: none; }.invalid { color: $color-danger; }.form-actions { display: flex; justify-content: flex-end; gap: 10px; padding-top: 18px; border-top: 1px solid $color-border; }.form-actions :deep(.ant-btn) { min-height: 40px; }
</style>
