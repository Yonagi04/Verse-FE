<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

onMounted(() => {
  router.replace({ path: '/tenants', query: { action: 'create' } })
})
</script>

<template>
  <div class="tenant-create-redirect">
    <p>正在跳转...</p>
  </div>
</template>
