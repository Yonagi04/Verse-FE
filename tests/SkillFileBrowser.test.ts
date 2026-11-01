import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { defineComponent, h, reactive, ssrContextKey, type App } from 'vue'
import Browser from '../src/views/skill/SkillFileBrowser.vue'
import type { SkillFileContent, SkillFiles } from '../src/types/skill'
import { attachClientRender, hostNode, hostNodes, hostRenderer, hostText, settleHost, type HostNode } from './helpers/vueHost'

const mocks = vi.hoisted(() => ({ list: vi.fn(), read: vi.fn() }))
vi.mock('@/api/skill', () => ({ skillFiles: mocks.list, skillFileContent: mocks.read }))
vi.mock('@/views/skill/SkillFilePreview.vue', () => ({ default: defineComponent({ props: ['file'],
  setup: props => () => h('preview', { path: props.file.relativePath }, props.file.content ?? props.file.status) }) }))
attachClientRender(Browser, new URL('../src/views/skill/SkillFileBrowser.vue', import.meta.url))
const files = (): SkillFiles => ({ versionId: '70', rootName: 'my-package', maxPreviewBytes: 1048576,
  items: ['SKILL.md', 'docs/readme.txt', 'docs/nested/main.py', 'image.png'].map(relativePath => ({ relativePath, sizeBytes: 2, sha256: 'hash' })) })
const content = (path: string, text = '正文', versionId = '70'): SkillFileContent => ({
  versionId, relativePath: path, sizeBytes: text.length, sha256: 'hash', kind: 'TEXT', language: null, status: 'READY', content: text,
})
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done }); return { promise, resolve } }
let app: App | undefined
let root: HostNode
let identity: { skillId: string; versionId: string }
const button = (label: string) => hostNodes(root).find(node => node.type === 'button'
  && (node.props['aria-label'] === label || node.props.title === label || hostText(node) === label))!
const click = async (target: HostNode) => { (target.props.onClick as () => void)(); await settleHost() }
async function mount() {
  root = hostNode('root'); identity = reactive({ skillId: '20', versionId: '70' })
  app = hostRenderer.createApp(defineComponent({ setup: () => () => h(Browser, identity) }))
  app.provide(ssrContextKey, {})
  app.component('a-spin', defineComponent({ inheritAttrs: false, setup: (_, { slots }) => () => slots.default?.() }))
  app.component('a-alert', defineComponent({ setup: (_, { attrs, slots }) => () => h('alert', [String(attrs.message), slots.action?.()]) }))
  app.component('a-button', defineComponent({ setup: (_, { attrs, slots }) => () => h('button', attrs, slots.default?.()) }))
  app.mount(root); await settleHost()
}
beforeEach(() => {
  vi.resetAllMocks(); mocks.list.mockResolvedValue(files())
  mocks.read.mockImplementation((_id: string, version: string, path: string) => Promise.resolve(content(path, '正文', version)))
})
afterEach(() => app?.unmount())

it('根默认展开，右侧按钮逐级展开目录，点文件才在右侧预览', async () => {
  await mount()
  expect(hostText(root)).toContain('my-package')
  expect(hostText(root)).toContain('共 4 个文件')
  expect(hostText(root)).not.toContain('文本预览上限')
  expect(button('展开 docs').props.class).toBe('folder-button')
  expect(button('SKILL.md')).toBeDefined(); expect(button('docs/readme.txt')).toBeUndefined()
  expect(mocks.read).not.toHaveBeenCalled()
  await click(button('展开 docs'))
  expect(button('docs/readme.txt')).toBeDefined(); expect(button('docs/nested/main.py')).toBeUndefined()
  await click(button('展开 docs/nested')); await click(button('docs/nested/main.py'))
  expect(hostNodes(root).find(node => node.type === 'preview')?.props.path).toBe('docs/nested/main.py')
  expect(mocks.read.mock.calls[0]?.slice(0, 3)).toEqual(['20', '70', 'docs/nested/main.py'])
  await click(button('收起 docs')); expect(button('docs/readme.txt')).toBeUndefined()
  await click(button('展开或收起根目录')); expect(button('SKILL.md')).toBeUndefined()
})

it('快速切文件取消旧读取，旧响应晚到也不能覆盖当前文件', async () => {
  const old = deferred<SkillFileContent>(); mocks.read.mockReturnValueOnce(old.promise)
  await mount(); await click(button('SKILL.md'))
  expect(hostText(root)).toContain('正在读取文件')
  await click(button('image.png'))
  expect((mocks.read.mock.calls[0]?.[3] as AbortSignal).aborted).toBe(true)
  old.resolve(content('SKILL.md', '旧文件')); await settleHost()
  expect(hostNodes(root).find(node => node.type === 'preview')?.props.path).toBe('image.png')
  expect(hostText(root)).not.toContain('旧文件')
})

it('读取错误可重试，切换文件立即清除前一个正文', async () => {
  await mount(); await click(button('SKILL.md')); expect(hostText(root)).toContain('正文')
  mocks.read.mockRejectedValueOnce(new Error('存储暂不可用'))
  await click(button('image.png')); expect(hostText(root)).not.toContain('正文'); expect(hostText(root)).toContain('存储暂不可用')
  await click(button('重试')); expect(hostText(root)).toContain('正文')
})

it('列表错误可重试，空清单与版本不匹配分别给出可观察状态', async () => {
  mocks.list.mockRejectedValueOnce(new Error('查询失败'))
  await mount(); expect(hostText(root)).toContain('查询失败')
  mocks.list.mockResolvedValueOnce({ ...files(), items: [] }); await click(button('重试'))
  expect(hostText(root)).toContain('包内暂无文件')
  identity.versionId = '71'; await settleHost()
  expect(hostText(root)).toContain('文件版本已变化')
})

it('清单或正文资源变更及组件卸载均丢弃旧响应', async () => {
  const old = deferred<SkillFiles>(); mocks.list.mockReturnValueOnce(old.promise)
  await mount()
  mocks.list.mockResolvedValueOnce({ ...files(), versionId: '71', rootName: 'new-package' })
  identity.versionId = '71'; await settleHost()
  old.resolve(files()); await settleHost(); expect(hostText(root)).toContain('new-package')
  const reading = deferred<SkillFileContent>(); mocks.read.mockReturnValueOnce(reading.promise)
  await click(button('SKILL.md'))
  const signal = mocks.read.mock.calls.at(-1)?.[3] as AbortSignal
  app?.unmount(); app = undefined
  expect(signal.aborted).toBe(true)
  reading.resolve(content('SKILL.md')); await settleHost()
  expect(hostNodes(root).some(node => node.type === 'preview')).toBe(false)
})

it('正文返回错误路径或版本时拒绝展示', async () => {
  await mount(); mocks.read.mockResolvedValueOnce(content('wrong.txt'))
  await click(button('SKILL.md')); expect(hostText(root)).toContain('文件版本已变化')
  expect(hostNodes(root).some(node => node.type === 'preview')).toBe(false)
  mocks.read.mockResolvedValueOnce(content('SKILL.md', '错误正文', '71'))
  await click(button('重试')); expect(hostText(root)).not.toContain('错误正文')
})
