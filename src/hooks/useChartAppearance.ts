import { computed } from 'vue'
import { useThemeStore } from '@/stores/theme'
import { readThemeColor } from '@/utils/appearance'

export function useChartAppearance() {
  const themeStore = useThemeStore()
  return computed(() => {
    // Depend on the resolved appearance; its sync watcher updates CSS before this read.
    const dark = themeStore.resolvedMode === 'dark'
    const color = readThemeColor
    return {
      dark,
      text: color('chart-text'),
      axis: color('chart-axis'),
      grid: color('chart-grid'),
      line1: color('chart-line-1'),
      line2: color('chart-line-2'),
      primary: color('link'),
      pointer: color('chart-pointer'),
      tooltip: {
        backgroundColor: color('elevated'),
        borderColor: color('chart-tooltip-border'),
        textStyle: { color: color('chart-tooltip-text') },
      },
    }
  })
}
