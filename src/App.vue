<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import AppLayout from '@/layouts/AppLayout.vue'
import { useThemeStore } from '@/stores/theme'
import { createAntTheme } from '@/utils/antTheme'
import { getPopupContainer } from '@/utils/popupContainer'
import SkillFavoriteHost from '@/views/skill/favorites/SkillFavoriteHost.vue'

const route = useRoute()
const themeStore = useThemeStore()
const appearance = computed(() => createAntTheme(themeStore.resolvedMode))

// 公开页面路径列表
const isPublic = computed(() => route.meta.layout === 'auth')

</script>

<template>
  <a-config-provider :theme="appearance" :get-popup-container="getPopupContainer">
    <router-view v-slot="{ Component: RouteComponent }">
      <AppLayout v-if="!isPublic">
        <component :is="RouteComponent" />
      </AppLayout>
      <component v-else :is="RouteComponent" />
    </router-view>
    <SkillFavoriteHost />
  </a-config-provider>
</template>
