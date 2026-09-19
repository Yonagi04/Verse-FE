<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import { useRoute, useRouter } from 'vue-router'
import { listTenantActivities } from '@/api/tenant'
import { isTenantActivityDisabledError } from '@/utils/tenantActivity'
import TenantActivityEntry from './TenantActivityEntry.vue'
import type { TenantActivityItemRespDTO } from '@/types/tenant'

const route = useRoute()
const router = useRouter()
const tenantId = String(route.params.tenantId)
const items = ref<TenantActivityItemRespDTO[]>([])
const loading = ref(false)
const initialLoaded = ref(false)
const hasMore = ref(true)
const nextCursor = ref<string | null>(null)
const sentinel = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null

const groups = computed(() => {
  const ordered = new Map<string, TenantActivityItemRespDTO[]>()
  for (const item of items.value) {
    const date = new Date(item.occurredAt)
    const key = new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(date)
    const group = ordered.get(key)
    if (group) group.push(item)
    else ordered.set(key, [item])
  }
  return Array.from(ordered, ([label, groupItems]) => ({ label, items: groupItems }))
})

async function loadNextBatch() {
  if (loading.value || !hasMore.value) return
  loading.value = true
  try {
    const response = await listTenantActivities(
      tenantId,
      { limit: 30, cursor: nextCursor.value ?? undefined },
      { silentError: true },
    )
    const knownIds = new Set(items.value.map((item) => item.eventId))
    items.value.push(...response.items.filter((item) => !knownIds.has(item.eventId)))
    nextCursor.value = response.nextCursor
    hasMore.value = response.hasMore
    initialLoaded.value = true
    if (!hasMore.value) observer?.disconnect()
    await nextTick()
  } catch (error) {
    if (isTenantActivityDisabledError(error)) {
      hasMore.value = false
      observer?.disconnect()
      await router.replace({ name: 'TenantDetail', params: { tenantId } })
      return
    }
    const text = error instanceof Error ? error.message : '动态加载失败'
    message.error(text)
  } finally {
    loading.value = false
  }
}

function observeSentinel(element: HTMLElement | null) {
  observer?.disconnect()
  if (!element || !hasMore.value) return
  observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) void loadNextBatch()
    },
    { rootMargin: '240px 0px' },
  )
  observer.observe(element)
}

watch(sentinel, observeSentinel)
watch(hasMore, () => observeSentinel(sentinel.value))

onMounted(loadNextBatch)
onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <div class="activity-page">
    <a-breadcrumb class="activity-breadcrumb">
      <a-breadcrumb-item><router-link to="/tenants">我的租户</router-link></a-breadcrumb-item>
      <a-breadcrumb-item>
        <router-link :to="`/tenants/${tenantId}`">租户首页</router-link>
      </a-breadcrumb-item>
      <a-breadcrumb-item>租户动态</a-breadcrumb-item>
    </a-breadcrumb>

    <header class="activity-heading">
      <div>
        <h1>租户动态</h1>
        <p>查看租户设置、成员和模型服务等关键变更。</p>
      </div>
      <router-link :to="`/tenants/${tenantId}`">返回租户首页</router-link>
    </header>

    <a-spin :spinning="loading && !initialLoaded">
      <a-empty
        v-if="initialLoaded && items.length === 0"
        description="租户暂时没有动态哦"
      />
      <div v-else class="timeline">
        <section v-for="group in groups" :key="group.label" class="date-group">
          <h2>{{ group.label }}</h2>
          <div class="group-items">
            <TenantActivityEntry
              v-for="item in group.items"
              :key="item.eventId"
              :item="item"
            />
          </div>
        </section>
        <div v-if="hasMore" ref="sentinel" class="load-sentinel">
          <a-spin v-if="loading && initialLoaded" size="small" />
        </div>
      </div>
    </a-spin>
  </div>
</template>

<style lang="scss" scoped>
.activity-page {
  width: min(820px, 100%);
  margin: 0 auto;
}

.activity-breadcrumb {
  margin-bottom: 16px;
}

.activity-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 20px;

  h1 {
    margin: 0;
    color: $color-text-primary;
    font-size: $font-size-title;
  }

  p {
    margin: 6px 0 0;
    color: $color-text-secondary;
  }
}

.timeline {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.date-group {
  h2 {
    margin: 0 0 8px;
    color: $color-text-secondary;
    font-size: $font-size-body;
    font-weight: 600;
  }
}

.group-items {
  padding: 2px 18px;
  border: 1px solid $color-border;
  border-radius: $radius-card;
  background: $color-bg;
  box-shadow: $shadow-light;

  > :deep(.activity-entry:not(:last-child)) {
    border-bottom: 1px solid $color-border;
  }
}

.load-sentinel {
  display: flex;
  justify-content: center;
  min-height: 48px;
  padding: 12px;
}

@media (max-width: 640px) {
  .activity-heading {
    flex-direction: column;
    gap: 8px;
  }

  .group-items {
    padding: 2px 12px;
  }
}
</style>
