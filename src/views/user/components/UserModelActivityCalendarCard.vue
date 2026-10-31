<script setup lang="ts">
import { computed } from 'vue'
import UserModelActivityCalendarGrid from '@/components/activity/UserModelActivityCalendarGrid.vue'
import { useUserModelActivityCalendar } from '@/composables/useUserModelActivityCalendar'
const { data, today, loading, error, selection, refresh } = useUserModelActivityCalendar()
const rangeOptions = computed(() => {
  const current = Number(today.value.slice(0, 4))
  return [{ value: 'ROLLING_365', label: '最近一年' },
    ...(current ? [current, current - 1, current - 2].map(year => ({ value: String(year), label: `${year} 年` })) : [])]
})
</script>
<template>
  <section class="activity-card" aria-labelledby="activity-heading" :aria-busy="loading">
    <header class="activity-heading">
      <h2 id="activity-heading">活动</h2>
      <div class="range-control"><span id="activity-range-label">查看范围</span>
        <a-select v-model:value="selection" class="range-select" aria-labelledby="activity-range-label"
          :options="rangeOptions" :loading="loading" :disabled="loading && rangeOptions.length === 1" />
      </div>
    </header>
    <a-skeleton v-if="loading && !data" active :paragraph="{ rows: 4 }" />
    <a-alert v-if="error" class="activity-feedback" type="error" show-icon :message="error"
      :description="data ? '当前仍显示上次成功加载的范围。' : undefined"><template #action><a-button size="small" @click="refresh">重试</a-button></template></a-alert>
    <template v-if="data">
      <p class="activity-summary">{{ data.view === 'YEAR' ? `${data.year} 年` : '最近一年' }}记录了 <strong>{{ data.totalSuccessCount }}</strong> 次调用</p>
      <UserModelActivityCalendarGrid :calendar="data" />
    </template>
  </section>
</template>
<style lang="scss" scoped>
.activity-card { margin: 24px 0; padding: 28px; border: 1px solid $color-border; border-radius: $radius-card; background: $color-bg; color: $color-text-primary; }
.activity-heading { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px; margin-bottom: 24px;
  h2 { margin: 0; font-size: $font-size-h3; font-weight: 600; } }
.range-control { display: flex; align-items: center; gap: 12px; color: $color-text-secondary; font-size: 13px; }
.range-select { width: 140px; }
.activity-feedback { margin-bottom: 16px; }
.activity-summary { margin: 0 0 16px; font-size: 14px; line-height: 1.6; color: $color-text-secondary;
  strong { color: $color-text-primary; font-weight: 600; font-variant-numeric: tabular-nums; } }
@container profile (max-width: 540px) { .activity-card { padding: 20px 16px; } .activity-heading { margin-bottom: 20px; } .range-control { gap: 10px; } .range-select { width: 124px; } }
</style>
