import { afterEach, expect, it, vi } from 'vitest'
import { getPopupContainer } from '../src/utils/popupContainer'

// 只替代 DOM 边界；真实定位和裁剪在浏览器中验证。
function element(parent?: HTMLElement, boundary?: string): HTMLElement {
  return {
    closest(selector: string): HTMLElement | null {
      return boundary && selector.split(', ').includes(boundary) ? this as HTMLElement : parent?.closest(selector) ?? null
    },
  } as HTMLElement
}

afterEach(() => vi.unstubAllGlobals())

it('页面选择器跳过普通卡片，挂载到页面滚动边界', () => {
  const page = element(undefined, '[data-popup-container]')
  const card = element(page)
  expect(getPopupContainer(element(card))).toBe(page)
})

it.each(['.ant-modal-content', '.ant-drawer-body'])('弹层优先留在最近的%s内', boundary => {
  const page = element(undefined, '[data-popup-container]')
  const overlay = element(page, boundary)
  expect(getPopupContainer(element(overlay))).toBe(overlay)
})

it('嵌套滚动区优先于外层抽屉，避免对话滚动时菜单分离', () => {
  const drawer = element(undefined, '.ant-drawer-body')
  const conversation = element(drawer, '[data-popup-container]')
  expect(getPopupContainer(element(conversation))).toBe(conversation)
})

it('没有触发元素或已知边界时安全回退到body', () => {
  const body = element()
  vi.stubGlobal('document', { body })
  expect(getPopupContainer()).toBe(body)
  expect(getPopupContainer(element())).toBe(body)
})
