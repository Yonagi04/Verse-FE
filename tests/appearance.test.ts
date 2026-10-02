import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, disposePinia, setActivePinia, type Pinia } from 'pinia'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { useThemeStore } from '../src/stores/theme'
import { parseThemeMode, resolveTheme, THEME_STORAGE_KEY } from '../src/utils/appearance'
import { clearAuth } from '../src/utils/auth'

let pinia: Pinia
let storage: Storage
let browser: EventTarget & { localStorage: Storage; matchMedia?: () => unknown }
let media: EventTarget & { matches: boolean }
let root: { dataset: { theme?: string }; style: { colorScheme?: string } }

beforeEach(() => {
  const data = new Map<string, string>()
  storage = {
    getItem: vi.fn(key => data.get(key) ?? null),
    setItem: vi.fn((key, value) => { data.set(key, value) }),
    removeItem: vi.fn(key => { data.delete(key) }),
    clear: vi.fn(() => data.clear()),
    key: vi.fn(() => null), length: 0,
  }
  media = Object.assign(new EventTarget(), { matches: false })
  browser = Object.assign(new EventTarget(), { localStorage: storage, matchMedia: () => media })
  root = { dataset: {}, style: {} }
  vi.stubGlobal('window', browser)
  vi.stubGlobal('localStorage', storage)
  vi.stubGlobal('document', { documentElement: root })
  pinia = createPinia()
  setActivePinia(pinia)
})

afterEach(() => { disposePinia(pinia); vi.unstubAllGlobals() })

function systemChanged(matches: boolean) {
  media.matches = matches
  media.dispatchEvent(Object.assign(new Event('change'), { matches }))
}

function storageChanged(key: string | null, newValue: string | null, area: Storage = storage) {
  browser.dispatchEvent(Object.assign(new Event('storage'), { key, newValue, storageArea: area }))
}

describe('appearance selection and lifecycle', () => {
  it.each(['light', 'dark', 'auto'] as const)('resolves %s for both system preferences', mode => {
    for (const systemDark of [false, true]) {
      expect(resolveTheme(mode, systemDark)).toBe(mode === 'auto' ? (systemDark ? 'dark' : 'light') : mode)
    }
  })

  it.each([null, undefined, '', 'DARK', 'system', {}, 1])('invalid preference %s defaults to auto', value => {
    expect(parseThemeMode(value)).toBe('auto')
  })

  it('auto follows live system changes without overwriting the preference', () => {
    const store = useThemeStore()
    store.initialize()
    expect(store.mode).toBe('auto')
    expect(root.dataset.theme).toBe('light')
    systemChanged(true)
    expect(store.resolvedMode).toBe('dark')
    expect(root.style.colorScheme).toBe('dark')
    systemChanged(false)
    expect(store.mode).toBe('auto')
    expect(root.dataset.theme).toBe('light')
    expect(storage.setItem).not.toHaveBeenCalled()
  })

  it('explicit modes persist, ignore system changes and preserve sidebar state', () => {
    const store = useThemeStore()
    store.initialize()
    store.setSidebarCollapsed(true)
    store.setMode('dark')
    expect(storage.getItem(THEME_STORAGE_KEY)).toBe('dark')
    systemChanged(false)
    expect(root.dataset.theme).toBe('dark')
    store.setMode('light')
    systemChanged(true)
    expect(root.dataset.theme).toBe('light')
    expect(store.sidebarCollapsed).toBe(true)
    store.setMode('auto')
    expect(storage.getItem(THEME_STORAGE_KEY)).toBe('auto')
    expect(root.dataset.theme).toBe('dark')
  })

  it('restores a manual preference on a new application instance', () => {
    const first = useThemeStore()
    first.initialize()
    first.setMode('dark')
    disposePinia(pinia)
    pinia = createPinia()
    setActivePinia(pinia)
    const reopened = useThemeStore()
    reopened.initialize()
    expect(reopened.mode).toBe('dark')
    expect(root.dataset.theme).toBe('dark')
  })

  it('restores auto against the current system and survives auth key removal', () => {
    storage.setItem(THEME_STORAGE_KEY, 'auto')
    storage.setItem('verse_token', 'test-token')
    storage.setItem('verse_user', '{}')
    media.matches = true
    const store = useThemeStore()
    store.initialize()
    clearAuth()
    storageChanged('verse_token', null)
    expect(storage.getItem('verse_token')).toBeNull()
    expect(storage.getItem('verse_user')).toBeNull()
    expect(store.mode).toBe('auto')
    expect(store.resolvedMode).toBe('dark')
    expect(storage.getItem(THEME_STORAGE_KEY)).toBe('auto')
  })

  it('synchronizes same-origin tabs without writing back, including removal and clear', () => {
    const store = useThemeStore()
    store.initialize()
    storageChanged(THEME_STORAGE_KEY, 'dark')
    expect(root.dataset.theme).toBe('dark')
    storageChanged(THEME_STORAGE_KEY, null)
    expect(store.mode).toBe('auto')
    storageChanged(THEME_STORAGE_KEY, 'invalid')
    expect(store.mode).toBe('auto')
    storageChanged(THEME_STORAGE_KEY, 'dark')
    storageChanged(null, null)
    expect(store.mode).toBe('auto')
    expect(storage.setItem).not.toHaveBeenCalled()
  })

  it('ignores unrelated and sessionStorage events', () => {
    const store = useThemeStore()
    store.initialize()
    storageChanged('verse_user', 'dark')
    storageChanged(THEME_STORAGE_KEY, 'dark', {} as Storage)
    expect(store.mode).toBe('auto')
  })

  it('handles inaccessible storage and retains the in-session selection', () => {
    Object.defineProperty(browser, 'localStorage', { get() { throw new Error('blocked') } })
    const store = useThemeStore()
    expect(() => store.initialize()).not.toThrow()
    expect(() => store.setMode('dark')).not.toThrow()
    expect(root.dataset.theme).toBe('dark')
  })

  it('handles unavailable system detection', () => {
    delete browser.matchMedia
    const store = useThemeStore()
    store.initialize()
    expect(store.resolvedMode).toBe('light')
    store.setMode('dark')
    expect(root.dataset.theme).toBe('dark')
  })

  it('initializes only once and cleans up on disposal', () => {
    const listener = vi.spyOn(media, 'addEventListener')
    const store = useThemeStore()
    store.initialize()
    store.initialize()
    expect(listener).toHaveBeenCalledTimes(1)
    store.dispose()
    systemChanged(true)
    storageChanged(THEME_STORAGE_KEY, 'dark')
    expect(root.dataset.theme).toBe('light')
    expect(store.mode).toBe('auto')
    store.initialize()
    expect(store.resolvedMode).toBe('dark')
  })
})

describe('first visible frame', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
  const bootstrap = html.match(/<script>([\s\S]*?)<\/script>/)![1]
  it('uses the same resolution rules before Vue, even with unavailable storage or media', () => {
    for (const value of ['light', 'dark', 'auto', 'invalid', null]) {
      for (const systemDark of [false, true]) {
        const document = { documentElement: { dataset: { theme: '' }, style: { colorScheme: '' } } }
        runInNewContext(bootstrap, { document, localStorage: { getItem: () => value }, window: { matchMedia: () => ({ matches: systemDark }) } })
        const expected = resolveTheme(parseThemeMode(value), systemDark)
        expect(document.documentElement.dataset.theme).toBe(expected)
        expect(document.documentElement.style.colorScheme).toBe(expected)
      }
    }
    const document = { documentElement: { dataset: { theme: '' }, style: { colorScheme: '' } } }
    runInNewContext(bootstrap, { document, localStorage: { getItem() { throw new Error('blocked') } }, window: {} })
    expect(document.documentElement.dataset.theme).toBe('light')
  })
})

it('the dark palette meets contrast targets for text, solid buttons and necessary boundaries', () => {
  const scss = readFileSync(new URL('../src/assets/styles/theme.scss', import.meta.url), 'utf8')
  const dark = scss.split("html[data-theme='dark'] {")[1].split('}')[0]
  const values = Object.fromEntries([...dark.matchAll(/--verse-([\w-]+):\s*(#[\da-f]{6});/g)].map(match => [match[1], match[2]]))
  const luminance = (hex: string) => hex.slice(1).match(/../g)!.map(value => parseInt(value, 16) / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4).reduce((sum, value, i) => sum + value * [.2126, .7152, .0722][i], 0)
  const contrast = (fg: string, bg: string) => { const a = luminance(fg), b = luminance(bg); return (Math.max(a, b) + .05) / (Math.min(a, b) + .05) }
  for (const text of ['text-primary', 'text-secondary', 'text-tertiary']) expect(contrast(values[text], values.elevated)).toBeGreaterThanOrEqual(4.5)
  for (const fill of ['primary-solid', 'primary-hover', 'primary-active', 'danger-solid', 'danger-hover', 'danger-active']) expect(contrast('#ffffff', values[fill])).toBeGreaterThanOrEqual(4.5)
  expect(contrast(values.link, values.selected)).toBeGreaterThanOrEqual(4.5)
  expect(contrast(values['border-input'], values.surface)).toBeGreaterThanOrEqual(3)
  expect(contrast(values.focus, values.elevated)).toBeGreaterThanOrEqual(3)
})
