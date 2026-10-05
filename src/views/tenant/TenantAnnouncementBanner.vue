<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  BellOutlined,
  CloseOutlined,
  CloseCircleOutlined,
  InfoCircleOutlined,
  WarningOutlined,
} from '@ant-design/icons-vue'
import { listRecentTenantAnnouncements } from '@/api/tenant'
import { newNotification } from '@/composables/useWebSocketNotification'
import { useUserStore } from '@/stores/user'
import { getStoredUser } from '@/utils/auth'
import type { TenantAnnouncement } from '@/types/tenant'

const props = defineProps<{ tenantId: string; refreshKey?: number }>()
const userStore = useUserStore()
const items = ref<TenantAnnouncement[]>([])
const now = ref(Date.now())
const viewportElement = ref<HTMLElement | null>(null)
const groupElement = ref<HTMLElement | null>(null)
const viewportWidth = ref(0)
const groupWidth = ref(0)
let requestSequence = 0
let clock: number | undefined
let resizeObserver: ResizeObserver | undefined

const dismissalKey = computed(() =>
  `verse_tenant_announcement_dismissed_${userStore.user?.userId ?? getStoredUser()?.userId ?? 'unknown'}_${props.tenantId}`,
)
const dismissedUntil = ref(0)
const visibleItems = computed(() => items.value.filter((item) => {
  const timestamp = item.createTime
  const publishedAt = Date.parse(/(?:Z|[+-]\d{2}:\d{2})$/i.test(timestamp) ? timestamp : `${timestamp}+08:00`)
  return Number.isFinite(publishedAt) && publishedAt <= now.value && publishedAt > now.value - 24 * 60 * 60 * 1000
}))
const visible = computed(() => now.value >= dismissedUntil.value && visibleItems.value.length > 0)
const marqueeStyle = computed(() => {
  const entryX = Math.max(0, viewportWidth.value - 16)
  const distance = entryX + groupWidth.value
  return {
    '--entry-x': `${entryX}px`,
    '--group-width': `${groupWidth.value}px`,
    '--marquee-duration': `${Math.max(3, distance / 85)}s`,
  }
})
const severityIcon = {
  INFO: InfoCircleOutlined,
  WARNING: WarningOutlined,
  CRITICAL: CloseCircleOutlined,
}

async function load() {
  const sequence = ++requestSequence
  now.value = Date.now()
  const stored = Number(localStorage.getItem(dismissalKey.value))
  dismissedUntil.value = Number.isFinite(stored) ? stored : 0
  if (dismissedUntil.value > now.value) {
    items.value = []
    return
  }
  try {
    const result = await listRecentTenantAnnouncements(props.tenantId)
    if (sequence === requestSequence) items.value = Array.isArray(result.records) ? result.records : []
  } catch {
    // A failed announcement request must not block the rest of the home page.
    if (sequence === requestSequence) items.value = []
  }
}

function dismiss() {
  dismissedUntil.value = Date.now() + 24 * 60 * 60 * 1000
  localStorage.setItem(dismissalKey.value, String(dismissedUntil.value))
  items.value = []
}

function measureMarquee() {
  viewportWidth.value = viewportElement.value?.clientWidth ?? 0
  groupWidth.value = groupElement.value?.getBoundingClientRect().width ?? 0
}

onMounted(() => {
  resizeObserver = new ResizeObserver(measureMarquee)
  if (viewportElement.value) resizeObserver.observe(viewportElement.value)
  if (groupElement.value) resizeObserver.observe(groupElement.value)
  measureMarquee()
})
watch([viewportElement, groupElement], () => {
  resizeObserver?.disconnect()
  if (viewportElement.value) resizeObserver?.observe(viewportElement.value)
  if (groupElement.value) resizeObserver?.observe(groupElement.value)
  measureMarquee()
}, { flush: 'post' })

watch([() => props.tenantId, () => props.refreshKey, dismissalKey], load, { immediate: true })
watch(newNotification, (notification) => {
  if (notification?.type === 'ANNOUNCEMENT') void load()
})
clock = window.setInterval(() => {
  const wasDismissed = now.value < dismissedUntil.value
  now.value = Date.now()
  if (wasDismissed && now.value >= dismissedUntil.value) void load()
}, 60_000)
onBeforeUnmount(() => {
  requestSequence++
  window.clearInterval(clock)
  resizeObserver?.disconnect()
})
</script>

<template>
  <section v-if="visible" class="announcement-banner" aria-label="租户公告">
    <BellOutlined class="banner-bell" aria-hidden="true" />
    <div ref="viewportElement" class="announcement-viewport" :title="visibleItems.map(item => `${item.title}：${item.content}`).join('；')">
      <div
        class="announcement-track"
        :style="marqueeStyle"
      >
        <div ref="groupElement" class="announcement-group">
          <span v-for="item in visibleItems" :key="item.notificationId" class="announcement-item">
            <component :is="severityIcon[item.severity]" class="severity-icon" :class="item.severity.toLowerCase()" aria-hidden="true" />
            <strong>{{ item.title }}</strong>
            <span>{{ item.content }}</span>
          </span>
        </div>
      </div>
    </div>
    <button type="button" class="dismiss-button" aria-label="关闭租户公告，24 小时内不再显示" @click="dismiss">
      <CloseOutlined />
    </button>
  </section>
</template>

<style lang="scss" scoped>
.announcement-banner {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 42px;
  padding: 0 8px 0 14px;
  border: 1px solid var(--verse-adaptive-border-primary, #bae0ff);
  border-radius: $radius-button;
  background: var(--verse-adaptive-selected, #e6f4ff);
  color: $color-text-primary;
  overflow: hidden;
}

.banner-bell { flex: 0 0 auto; color: $color-primary; }
.announcement-viewport { min-width: 0; flex: 1; overflow: hidden; white-space: nowrap; }
.announcement-track {
  display: flex;
  width: max-content;
  animation: marquee var(--marquee-duration) linear infinite;
}
.announcement-banner:hover .announcement-track,
.announcement-banner:focus-within .announcement-track { animation-play-state: paused; }
.announcement-group {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 240px;
}
.announcement-item {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
}
.announcement-item strong { font-weight: 600; }
.severity-icon.info { color: $color-primary; }
.severity-icon.warning { color: $color-warning; }
.severity-icon.critical { color: $color-danger; }
.dismiss-button {
  display: grid;
  flex: 0 0 auto;
  place-items: center;
  width: 26px;
  height: 26px;
  padding: 0;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: $color-text-secondary;
  cursor: pointer;
  opacity: 0;
}
.announcement-banner:hover .dismiss-button,
.announcement-banner:focus-within .dismiss-button { opacity: 1; }
.dismiss-button:hover { background: var(--verse-adaptive-hover, #d6eaff); color: $color-text-primary; }
.dismiss-button:focus-visible { opacity: 1; outline: 2px solid $color-primary; }
@keyframes marquee {
  from { transform: translateX(var(--entry-x)); }
  to { transform: translateX(calc(-1 * var(--group-width))); }
}
@media (prefers-reduced-motion: reduce) {
  .announcement-track { animation: none; }
}
</style>
