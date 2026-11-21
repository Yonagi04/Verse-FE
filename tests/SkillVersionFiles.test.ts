import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { defineComponent, h, reactive, ssrContextKey, type App } from 'vue'
import VersionFiles from '../src/views/skill/SkillVersionFiles.vue'
import type { SkillFileContent } from '../src/types/skill'
import { attachClientRender, hostNode, hostNodes, hostRenderer, hostText, settleHost, type HostNode } from './helpers/vueHost'

const mocks = vi.hoisted(() => ({ changes: vi.fn(), files: vi.fn(), content: vi.fn(), comparison: vi.fn(), identity: { token: 'session' } }))
vi.mock('@/api/skillVersion', () => ({ versionChanges: mocks.changes, versionFiles: mocks.files,
  versionContent: mocks.content, versionComparison: mocks.comparison }))
vi.mock('@/stores/user', () => ({ useUserStore: () => reactive(mocks.identity) }))
vi.mock('@/views/skill/SkillFilePreview.vue', () => ({ default: defineComponent({ props: ['file'],
  setup: props => () => h('preview', { path: props.file.relativePath }, props.file.content) }) }))
vi.mock('@/views/skill/SkillTextDiff.vue', () => ({ default: defineComponent({ props: ['oldText', 'newText'],
  setup: props => () => h('diff', `${props.oldText} → ${props.newText}`) }) }))
attachClientRender(VersionFiles, new URL('../src/views/skill/SkillVersionFiles.vue', import.meta.url))

let app: App | undefined, root: HostNode
const file = (relativePath: string) => ({ relativePath, sizeBytes: 10, sha256: 'a'.repeat(64) })
const body = (text: string): SkillFileContent => ({ ...file('SKILL.md'), versionId: '70', kind: 'MARKDOWN', language: null, status: 'READY', content: text })
async function mount() {
  root = hostNode('root')
  app = hostRenderer.createApp(VersionFiles, { skillId: '20', target: { versionId: '70' } })
  app.provide(ssrContextKey, {})
  app.component('a-spin', defineComponent({ inheritAttrs: false, setup: (_, { slots }) => () => slots.default?.() }))
  app.component('a-alert', defineComponent({ setup: (_, { attrs, slots }) => () => h('alert', [String(attrs.message), slots.action?.()]) }))
  app.component('a-button', defineComponent({ setup: (_, { attrs, slots }) => () => h('button', attrs, slots.default?.()) }))
  app.mount(root); await settleHost()
}
beforeEach(() => {
  vi.resetAllMocks()
  mocks.files.mockResolvedValue({ versionId: '70', rootName: 'root', maxPreviewBytes: 1048576,
    items: [file('.gitignore'), file('SKILL.md')] })
  mocks.content.mockResolvedValue(body('# Skill 正文'))
})
afterEach(() => { app?.unmount(); app = undefined })

it('首版直接展示完整文件并优先预览SKILL.md，不提供空基准的差异信息', async () => {
  mocks.changes.mockResolvedValue({ baseVersionId: null, baseVersion: null, targetVersionId: '70',
    items: [{ relativePath: 'SKILL.md', changeType: 'ADDED', oldFile: null, newFile: file('SKILL.md') }] })
  await mount()
  expect(hostText(root)).toContain('全部文件')
  expect(hostText(root)).toContain('.gitignore')
  expect(hostText(root)).not.toContain('空文件集合')
  expect(hostText(root)).not.toContain('文件差异')
  expect(hostText(root)).not.toContain('新增')
  expect(hostNodes(root).find(node => node.type === 'preview')?.props.path).toBe('SKILL.md')
  expect(mocks.content.mock.calls[0]?.slice(0, 3)).toEqual(['20', { versionId: '70' }, 'SKILL.md'])
  expect(mocks.comparison).not.toHaveBeenCalled()
})

it('后续版本继续展示固定基准与文件差异', async () => {
  mocks.changes.mockResolvedValue({ baseVersionId: '69', baseVersion: 'v1', targetVersionId: '70',
    items: [{ relativePath: 'SKILL.md', changeType: 'MODIFIED', oldFile: file('SKILL.md'), newFile: file('SKILL.md') }] })
  mocks.comparison.mockResolvedValue({ baseVersionId: '69', targetVersionId: '70', changeType: 'MODIFIED',
    oldFile: body('旧正文'), newFile: body('新正文') })
  await mount()
  expect(hostText(root)).toContain('相对 v1')
  expect(hostText(root)).toContain('文件差异')
  expect(hostText(root)).toContain('旧正文 → 新正文')
  expect(hostNodes(root).some(node => node.type === 'diff')).toBe(true)
  expect(mocks.content).not.toHaveBeenCalled()
})
