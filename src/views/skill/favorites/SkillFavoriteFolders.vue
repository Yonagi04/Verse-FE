<script setup lang="ts">
import { FolderOutlined, AppstoreOutlined, MoreOutlined, PlusOutlined } from '@ant-design/icons-vue'
import { useSkillFavoriteStore } from '@/stores/skillFavorite'
import { favoriteQueryToUrl } from '@/utils/skillFavorite'
import type { FavoriteQuery } from '@/types/skillFavorite'
defineProps<{ query: FavoriteQuery }>()
const store = useSkillFavoriteStore()
const destination = (query: FavoriteQuery, folderId?: string) => ({ path: '/skills/favorites', query: favoriteQueryToUrl({ ...query, folderId, keyword: undefined, page: 1 }) })
</script>
<template>
  <nav class="folder-panel" aria-label="私人收藏夹">
    <div class="caption">收藏夹 <small>仅自己可见</small></div>
    <div class="folder-row" :class="{ selected: query.folderId === undefined }"><router-link :to="destination(query)" :aria-current="query.folderId === undefined ? 'page' : undefined"><AppstoreOutlined /><span>全部收藏</span><small>{{ store.folders?.total ?? '—' }}</small></router-link></div>
    <div v-for="folder in store.folders?.folders" :key="folder.folderId" class="folder-row" :class="{ selected: query.folderId === folder.folderId }">
      <router-link :to="destination(query, folder.folderId)" :aria-current="query.folderId === folder.folderId ? 'page' : undefined" :title="folder.name"><FolderOutlined /><span>{{ folder.name }}</span><small>{{ folder.count }}</small></router-link>
      <a-dropdown v-if="!folder.defaultFolder" :trigger="['click']" :disabled="store.locked"><a-button type="text" class="more" :data-favorite-folder="folder.folderId" :disabled="store.locked" :aria-label="`管理收藏夹 ${folder.name}`"><MoreOutlined /></a-button><template #overlay><a-menu><a-menu-item key="rename" @click="store.manage('renameFolder', folder)">重命名</a-menu-item><a-menu-item key="delete" danger @click="store.manage('deleteFolder', folder)">删除</a-menu-item></a-menu></template></a-dropdown>
    </div>
    <a-button type="text" class="new-folder" data-favorite-new :disabled="store.locked || !store.folders" @click="store.manage('createFolder')"><PlusOutlined /> 新建收藏夹</a-button>
  </nav>
</template>
<style lang="scss" scoped>
.folder-panel { position: sticky; top: 88px; padding: 16px 10px; border: 1px solid $color-border; border-radius: $radius-card; background: $color-bg; min-width: 0; }.caption { display: flex; justify-content: space-between; padding: 0 10px 12px; color: $color-text-secondary; font-size: $skill-font-size-secondary; }.caption small { font-size: 12px; }.folder-row { display: flex; min-width: 0; border-radius: $radius-input; margin-bottom: 4px; }.folder-row.selected { background: $color-primary-bg; color: $color-primary; }.folder-row a { display: flex; align-items: center; gap: 8px; padding: 11px 8px; min-height: 44px; min-width: 0; flex: 1; color: inherit; font-size: $skill-font-size-secondary; }.folder-row a span:not(.anticon) { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; }.folder-row small { color: $color-text-secondary; }.more { padding: 0 6px; min-width: 40px; height: 44px; }.new-folder { color: $color-primary; margin-top: 8px; min-height: 40px; }@media(max-width: 1050px) { .folder-panel { position: static; display: flex; flex-wrap: wrap; gap: 6px; padding: 12px; }.caption { display: none; }.folder-row { max-width: 100%; border: 1px solid $color-border; margin: 0; }.folder-row a { padding: 8px; }.folder-row a span:not(.anticon) { max-width: 140px; }.new-folder { margin: 0; }.more { height: 44px; } }
</style>
