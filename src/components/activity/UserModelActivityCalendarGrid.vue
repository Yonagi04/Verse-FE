<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import type { UserModelActivityDay, UserModelActivityCalendar } from '@/types/userModelActivityCalendar'
import { describeModelActivityDay, modelActivityLevel, buildModelActivityCells } from '@/utils/userModelActivityCalendar'
const props = defineProps<{ calendar: UserModelActivityCalendar }>()
const cells = computed(() => buildModelActivityCells(props.calendar))
const grid = ref<HTMLElement | null>(null), selected = ref<UserModelActivityDay | null>(null), focused = ref(-1)
watch(() => props.calendar, () => { selected.value = null; focused.value = -1 })
const first = computed(() => cells.value.findIndex(Boolean))
const months = computed(() => {
  const columns = new Map<number, string>()
  cells.value.forEach((day, index) => {
    if (day && (day.date.endsWith('-01') || index === first.value)) columns.set(Math.floor(index / 7) + 1, `${Number(day.date.slice(5, 7))}月`)
  })
  const labels = [...columns].map(([column, label]) => ({ column, label }))
  return labels.filter((month, index) => !labels[index + 1] || labels[index + 1]!.column - month.column >= 2)
})
async function move(event: KeyboardEvent, index: number) {
  const offsets: Record<string, number> = { ArrowUp: -1, ArrowDown: 1, ArrowLeft: -7, ArrowRight: 7 }
  let target = index + (offsets[event.key] ?? 0)
  if (event.key === 'Home') target = first.value
  else if (event.key === 'End') { target = cells.value.length - 1; while (target > 0 && !cells.value[target]) target-- }
  else if (!(event.key in offsets)) return
  event.preventDefault()
  if (!cells.value[target]) return
  focused.value = target; await nextTick(); grid.value?.querySelector<HTMLButtonElement>(`[data-index="${target}"]`)?.focus()
}
</script>

<template>
  <div class="calendar-frame" :style="{ '--activity-columns': cells.length / 7 }">
  <div class="calendar-scroll" tabindex="0" aria-label="活动日历，可横向滚动；格子使用方向键移动">
    <div class="calendar-layout">
      <div class="months" :style="{ gridTemplateColumns: `repeat(${cells.length / 7}, var(--activity-cell))` }">
        <span v-for="month in months" :key="month.column" :style="{ gridColumn: month.column }">{{ month.label }}</span>
      </div>
      <div class="calendar-body">
        <div class="weekdays" aria-hidden="true"><span>周一</span><span /><span>周三</span><span /><span>周五</span><span /><span /></div>
        <div ref="grid" class="cells" aria-label="每天的调用次数">
          <template v-for="(day, index) in cells" :key="day?.date ?? `pad-${index}`">
            <button v-if="day" type="button" :data-index="index" :tabindex="index === (focused < 0 ? first : focused) ? 0 : -1"
              :aria-label="describeModelActivityDay(day)" :title="describeModelActivityDay(day)"
              :class="`level-${modelActivityLevel(day.successCount)}`"
              @focus="selected = day; focused = index" @mouseenter="selected = day" @click="selected = day" @keydown="move($event, index)" />
            <span v-else class="outside" aria-hidden="true" />
          </template>
        </div>
      </div>
    </div>
  </div>
  <div class="calendar-footer">
  <span class="day-detail" aria-live="polite">{{ selected ? describeModelActivityDay(selected) : '' }}</span>
  <div class="legend" aria-label="色阶：0、1至4、5至9、10至19、20次及以上">
    <span>少</span><span v-for="level in [0, 1, 2, 3, 4]" :key="level" class="sample" :class="`level-${level}`" /><span>多</span>
  </div>
  </div>
  </div>
</template>

<style lang="scss" scoped>
.calendar-frame { container-type: inline-size; border: 1px solid $color-border; border-radius: $radius-input; padding: 20px 18px 16px; }
.calendar-scroll { --activity-cell: max(var(--activity-min-cell, 12px), calc((100cqi - 52px - (var(--activity-columns) - 1) * 4px) / var(--activity-columns))); overflow-x: auto; padding: 4px 2px 10px; }
.calendar-layout { width: max-content; margin-inline: auto; padding-right: 12px; }
.months { display: grid; column-gap: 4px; margin: 0 0 10px 36px; font-size: 11px; color: $color-text-secondary; span { white-space: nowrap; } }
.calendar-body { display: flex; gap: 8px; }
.weekdays { width: 28px; display: grid; grid-template-rows: repeat(7, var(--activity-cell)); align-items: center; gap: 4px; font-size: 11px; color: $color-text-secondary; }
.cells { display: grid; grid-auto-flow: column; grid-template-rows: repeat(7, var(--activity-cell)); grid-auto-columns: var(--activity-cell); gap: 4px; }
.cells button, .outside, .sample { box-sizing: border-box; border: 0; border-radius: 3px; width: var(--activity-cell, 12px); height: var(--activity-cell, 12px); }
.cells button { padding: 0; cursor: pointer; transition: box-shadow .15s; &:hover { box-shadow: 0 0 0 1px $color-text-tertiary; } &:focus-visible { outline: 2px solid $color-focus; outline-offset: 2px; } }
.level-0, .level--1 { background: $color-bg-secondary; box-shadow: inset 0 0 0 1px theme-alpha('text-primary', .035); }
.level-1 { background: var(--verse-activity-level-1); }.level-2 { background: var(--verse-activity-level-2); }
.level-3 { background: var(--verse-activity-level-3); }.level-4 { background: var(--verse-activity-level-4); }
.calendar-footer { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; margin-top: 10px; min-height: 20px; }
.day-detail { color: $color-text-secondary; font-size: 12px; line-height: 1.6; }
.legend { display: flex; align-items: center; justify-content: flex-end; flex-wrap: wrap; gap: 6px; color: $color-text-secondary; font-size: 12px; }
@media (pointer: coarse) { .calendar-scroll { --activity-min-cell: 16px; } }
@container profile (max-width: 540px) { .calendar-frame { padding: 16px 12px 12px; } .legend { margin-left: auto; } }
</style>
