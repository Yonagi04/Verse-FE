<script setup lang="ts">
import { computed } from 'vue'
import { StarOutlined, StarFilled, DownOutlined } from '@ant-design/icons-vue'
import { useSkillFavoriteStore } from '@/stores/skillFavorite'
const props = withDefaults(defineProps<{ skillId: string; name?: string; available?: boolean; compact?: boolean }>(), { available: true })
const store = useSkillFavoriteStore()
const status = computed(() => store.statuses[props.skillId])
const saved = computed(() => !!status.value?.favoriteId)
function cancelFavorite() {
  if (status.value?.favoriteId) void store.submit({ type: 'cancel', favoriteId: status.value.favoriteId })
}
</script>
<template>
  <div class="favorite-control" :class="{ compact }">
    <a-dropdown v-if="saved" :trigger="['click']" :disabled="store.locked">
      <a-button :type="compact ? 'text' : 'default'" :data-favorite-skill="skillId" :disabled="store.locked" :aria-label="`${name || 'Skill'} 已收藏，打开整理菜单`" :title="status?.folderName || '已收藏'" class="saved">
        <StarFilled /><template v-if="!compact">已收藏 <DownOutlined /></template>
      </a-button>
      <template #overlay><a-menu>
        <a-menu-item key="move" @click="store.openSelection(skillId, name || 'Skill 暂不可用', true)">移动到收藏夹</a-menu-item>
        <a-menu-item key="cancel" danger @click="cancelFavorite">取消收藏</a-menu-item>
      </a-menu></template>
    </a-dropdown>
    <a-button v-else :type="compact ? 'text' : 'default'" :data-favorite-skill="skillId" :disabled="store.locked || !status || available === false" :aria-label="`收藏 ${name || 'Skill'}`" :title="!status ? '收藏状态加载中' : '收藏 Skill'" @click="store.openSelection(skillId, name || 'Skill')">
      <StarOutlined /><template v-if="!compact">收藏 Skill</template>
    </a-button>
    <small v-if="!compact && saved" class="folder-name">{{ status?.folderName }}</small>
  </div>
</template>
<style lang="scss" scoped>
.favorite-control { display: grid; gap: 8px; min-width: 0; }.favorite-control.compact { display: inline-flex; flex: none; }.favorite-control :deep(.ant-btn) { min-width: 40px; min-height: 40px; }.saved { color: $color-primary; }.folder-name { color: $color-text-secondary; text-align: center; overflow-wrap: anywhere; }
</style>
