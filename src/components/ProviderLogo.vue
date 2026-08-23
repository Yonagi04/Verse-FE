<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { getProviderBySlug } from '@/constants/providers'

const props = withDefaults(defineProps<{
  slug: string
  size?: number
}>(), {
  size: 22,
})

const provider = computed(() => getProviderBySlug(props.slug))
const failed = ref(false)

watch(
  () => props.slug,
  () => {
    failed.value = false
  },
)

function onError() {
  failed.value = true
}
</script>

<template>
  <span
    class="provider-logo"
    :style="{ width: `${size}px`, height: `${size}px` }"
  >
    <img
      v-if="provider && provider.logo && !failed"
      :src="provider.logo"
      :alt="provider.displayName"
      :width="size"
      :height="size"
      @error="onError"
    />
    <span
      v-else
      class="provider-mono"
      :style="{
        background: provider?.color ?? '#1677ff',
        fontSize: `${Math.max(Math.round(size / 2), 12)}px`,
      }"
    >
      {{ provider?.letter ?? '?' }}
    </span>
  </span>
</template>

<style lang="scss" scoped>
.provider-logo {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  img {
    display: block;
    object-fit: contain;
  }
}

.provider-mono {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  border-radius: 6px;
  color: #fff;
  font-weight: 600;
  line-height: 1;
}
</style>
