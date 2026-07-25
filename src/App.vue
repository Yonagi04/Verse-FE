<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import AppLayout from '@/layouts/AppLayout.vue'

const route = useRoute()

// 公开页面路径列表
const publicPaths = ['/login', '/register', '/reset-password/send-code', '/reset-password/verify-code', '/reset-password/reset']

const isPublic = computed(() => {
  return publicPaths.includes(route.path)
})

</script>

<template>
  <router-view v-slot="{ Component: RouteComponent }">
    <AppLayout v-if="!isPublic">
      <component :is="RouteComponent" />
    </AppLayout>
    <component v-else :is="RouteComponent" />
  </router-view>
</template>
