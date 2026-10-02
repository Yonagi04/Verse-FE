export type ThemeMode = 'light' | 'dark' | 'auto'
export type ResolvedTheme = Exclude<ThemeMode, 'auto'>

export const THEME_STORAGE_KEY = 'verse_theme_mode'
export const SYSTEM_THEME_QUERY = '(prefers-color-scheme: dark)'

export function parseThemeMode(value: unknown): ThemeMode {
  return value === 'light' || value === 'dark' ? value : 'auto'
}

export function resolveTheme(mode: ThemeMode, systemDark: boolean): ResolvedTheme {
  return mode === 'auto' ? (systemDark ? 'dark' : 'light') : mode
}

export function readThemeMode(): ThemeMode {
  try {
    return parseThemeMode(window.localStorage.getItem(THEME_STORAGE_KEY))
  } catch {
    return 'auto'
  }
}

export function saveThemeMode(mode: ThemeMode): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, mode)
  } catch {
    // Storage can be disabled; the selected appearance still works in this session.
  }
}

// Canvas and Ant Design tokens require resolved colors, not CSS var() strings.
export function readThemeColor(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(`--verse-${name}`).trim()
}
