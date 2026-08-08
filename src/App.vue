<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import AppLayout from '@/layouts/AppLayout.vue'
import ProfileModal from '@/views/user/UserProfile.vue'

const route = useRoute()

// 公开页面路径列表
const publicPaths = ['/login', '/register', '/reset-password/send-code', '/reset-password/verify-code', '/reset-password/reset']
const publicPrefixes = ['/join']

const isPublic = computed(() => {
  if (publicPaths.includes(route.path)) return true
  if (publicPrefixes.some(p => route.path.startsWith(p))) return true
  return false
})

</script>

<template>
  <router-view v-slot="{ Component: RouteComponent }">
    <AppLayout v-if="!isPublic">
      <component :is="RouteComponent" />
    </AppLayout>
    <component v-else :is="RouteComponent" />
  </router-view>
  <!-- 个人信息弹窗 — 全局挂载，不依赖路由 -->
  <ProfileModal />
</template>
