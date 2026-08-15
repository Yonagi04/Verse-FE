<script setup lang="ts">
import { ref, computed, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    src?: string | null
    name?: string
    size?: number
  }>(),
  {
    src: null,
    name: '',
    size: 36,
  },
)

const imgFailed = ref(false)

watch(
  () => props.src,
  () => {
    imgFailed.value = false
  },
)

const showImage = computed(() => !!props.src && !imgFailed.value)

const letter = computed(() => {
  const n = props.name || ''
  return n.charAt(0).toUpperCase() || '?'
})

const fontSize = computed(() => Math.round(props.size * 0.4))
</script>

<template>
  <div class="user-avatar" :style="{ width: `${size}px`, height: `${size}px` }">
    <img
      v-if="showImage"
      :src="src!"
      class="avatar-img"
      alt="avatar"
      @error="imgFailed = true"
    />
    <span v-else class="avatar-letter" :style="{ fontSize: `${fontSize}px` }">{{ letter }}</span>
  </div>
</template>

<style lang="scss" scoped>
.user-avatar {
  border-radius: 50%;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: $color-primary;
  flex-shrink: 0;
  user-select: none;
}

.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.avatar-letter {
  color: #fff;
  font-weight: 600;
  line-height: 1;
}
</style>
