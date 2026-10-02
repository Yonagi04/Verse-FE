<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import AppLayout from '@/layouts/AppLayout.vue'

const route = useRoute()

// 公开页面路径列表
const isPublic = computed(() => route.meta.layout === 'auth')

</script>

<template>
  <router-view v-slot="{ Component: RouteComponent }">
    <AppLayout v-if="!isPublic">
      <component :is="RouteComponent" />
    </AppLayout>
    <component v-else :is="RouteComponent" />
  </router-view>
</template>
