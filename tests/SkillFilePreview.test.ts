import { afterEach, expect, it, vi } from 'vitest'
import { defineComponent, h, reactive, ssrContextKey, type App } from 'vue'
import Preview from '../src/views/skill/SkillFilePreview.vue'
import type { SkillFileContent } from '../src/types/skill'
import { attachClientRender, hostNode, hostNodes, hostRenderer, hostText, settleHost } from './helpers/vueHost'

// Node 无浏览器 DOM；此处验证高亮库自身转义与传给净化器的限制，真实净化另做浏览器检查。
const sanitize = vi.hoisted(() => vi.fn((html: string) => html))
vi.mock('dompurify', () => ({ default: { sanitize } }))
vi.mock('@/views/skill/SkillMarkdown.vue', () => ({ default: defineComponent({ props: ['text'],
  setup: props => () => h('markdown', props.text) }) }))
attachClientRender(Preview, new URL('../src/views/skill/SkillFilePreview.vue', import.meta.url))
let app: App | undefined
afterEach(() => { app?.unmount(); sanitize.mockClear() })
const file = (overrides: Partial<SkillFileContent> = {}): SkillFileContent => ({ versionId: '70', relativePath: 'a.txt',
  sizeBytes: 5, sha256: 'hash', kind: 'TEXT', language: null, status: 'READY', content: 'line1\nline2', ...overrides })
async function mount(value: SkillFileContent) {
  const state = reactive({ file: value }), root = hostNode('root')
  app = hostRenderer.createApp(defineComponent({ setup: () => () => h(Preview, state) }))
  app.provide(ssrContextKey, {}); app.mount(root); await settleHost()
  return { root, state }
}

it('txt 在只读编辑器中按原文保留换行与HTML，不提供编辑控件', async () => {
  const { root } = await mount(file({ content: '<script>alert(1)</script>\n  中文' }))
  expect(hostText(root)).toContain('<script>alert(1)</script>\n  中文')
  expect(hostNodes(root).some(node => node.props['aria-label'] === '只读文本编辑器')).toBe(true)
  expect(hostNodes(root).some(node => node.props.contenteditable || node.type === 'input' || node.type === 'textarea' || node.props.innerHTML)).toBe(false)
})

it('常用代码语言使用语法高亮且HTML源码保持转义', async () => {
  const { root } = await mount(file({ relativePath: 'a.html', kind: 'CODE', language: 'xml', content: '<script>alert(1)</script>' }))
  await vi.waitFor(() => expect(sanitize).toHaveBeenCalled())
  await settleHost()
  const html = String(hostNodes(root).find(node => node.props.innerHTML)?.props.innerHTML)
  expect(html).toContain('hljs-'); expect(html).toContain('&lt;'); expect(html).not.toContain('<script>')
  expect(sanitize.mock.calls[0]?.[1]).toEqual({ ALLOWED_TAGS: ['span'], ALLOWED_ATTR: ['class'] })
})

it('Markdown 默认只读源码，切换预览复用 Markdown 组件，切文件重置视图', async () => {
  const { root, state } = await mount(file({ relativePath: 'SKILL.md', kind: 'MARKDOWN', language: 'markdown', content: '# 标题' }))
  expect(hostNodes(root).some(node => node.type === 'markdown')).toBe(false)
  const preview = hostNodes(root).find(node => node.type === 'button' && hostText(node) === '预览')!
  ;(preview.props.onClick as () => void)(); await settleHost()
  expect(hostNodes(root).find(node => node.type === 'markdown')?.text).toBe('# 标题')
  state.file = file(); await settleHost()
  expect(hostNodes(root).some(node => node.type === 'markdown')).toBe(false)
})

it.each(['docx', 'xlsx', 'pptx', 'svg', 'png', 'mp3', 'bin'])('%s 精确提示文件类型暂不支持预览', async extension => {
  const { root } = await mount(file({ relativePath: 'a.' + extension, kind: 'UNSUPPORTED', status: 'UNSUPPORTED', content: null }))
  expect(hostText(root)).toContain('文件类型暂不支持预览')
  expect(hostNodes(root).some(node => node.props['aria-label'] === '只读代码编辑器')).toBe(false)
})

it('超限提示与空文本区分，超长文档不创建大量行号节点', async () => {
  const { root, state } = await mount(file({ status: 'TOO_LARGE', content: null }))
  expect(hostText(root)).toContain('文件类型暂不支持预览')
  state.file = file({ content: '' }); await settleHost(); expect(hostText(root)).toContain('此文件为空')
  state.file = file({ content: '\n'.repeat(10001) }); await settleHost()
  expect(hostNodes(root).length).toBeLessThan(30)
  expect(hostNodes(root).find(node => node.type === 'code')?.text).toHaveLength(10001)
})
