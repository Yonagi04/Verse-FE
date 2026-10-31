import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { defineComponent, h, reactive, ref, ssrContextKey, type App } from 'vue'
import { Form, Input, type FormInstance } from 'ant-design-vue'
import Publish from '../src/views/skill/SkillPublishPage.vue'
import RequiredFormItem from '../src/components/form/RequiredFormItem.vue'
import { attachClientRender, hostNode, hostNodes, hostRenderer, hostText, settleHost } from './helpers/vueHost'

const mocks = vi.hoisted(() => ({ state: {} as Record<string, unknown>, session: 'current-session' }))
vi.mock('@/composables/useSkillPublication', () => ({ useSkillPublication: () => mocks.state }))
vi.mock('@/utils/auth', () => ({ getToken: () => mocks.session }))
vi.mock('@/views/skill/SkillMarkdown.vue', () => ({ default: { render: () => null } }))
attachClientRender(Publish, new URL('../src/views/skill/SkillPublishPage.vue', import.meta.url))
attachClientRender(RequiredFormItem, new URL('../src/components/form/RequiredFormItem.vue', import.meta.url))
let app: App | undefined
beforeEach(() => {
  mocks.session = 'current-session'
  vi.stubGlobal('window', { matchMedia: () => ({ matches: false, addListener() {}, removeListener() {} }) })
  vi.stubGlobal('document', { getElementById: () => null })
})
afterEach(() => { app?.unmount(); vi.unstubAllGlobals() })

function mount(stage: 'create' | 'READY' = 'READY') {
  const state = {
    authorName: ref('账号昵称'), options: ref({ categories: [{ id: 'general', name: '通用' }], tags: [] }),
    draft: ref(stage === 'READY' ? { draftId: '30', slug: 'test-skill', status: 'READY', revision: 2 } : null),
    task: ref(null), publication: ref(null), submitIntent: ref(null),
    form: reactive({ name: '有效名称', summary: '简介', categoryId: 'general', tags: [], version: '1.0.0',
      releaseNotes: '首版说明', license: 'MIT', originalAuthor: '原作者', sourceUrl: '', compatibility: '兼容环境',
      dependencies: '无', distributionAuthorized: true, declarationsConfirmed: true }),
    slug: ref(''), loading: ref(false), busy: ref(false), error: ref(''), notice: ref(''),
    editable: ref(true), checking: ref(false), create: vi.fn(), save: vi.fn(), submit: vi.fn(),
  }
  mocks.state = state
  const root = hostNode('root')
  app = hostRenderer.createApp(Publish); app.provide(ssrContextKey, {})
  app.component('a-form', Form); app.component('a-form-item', Form.Item)
  for (const name of ['a-input', 'a-textarea']) app.component(name, Input)
  // 此处验证表单规则，选择器的弹层交互由浏览器验收；保留真实 Input 的字段上下文。
  app.component('a-select', defineComponent({ inheritAttrs: false, setup: (_, { attrs }) => () =>
    h(Input, { ...attrs, value: Array.isArray(attrs.value) ? attrs.value.join(',') : attrs.value }) }))
  const passthrough = defineComponent({ inheritAttrs: false, setup: (_, { slots }) => () => slots.default?.() })
  for (const name of ['router-link', 'a-spin', 'a-tag', 'a-checkbox']) app.component(name, passthrough)
  for (const name of ['a-button', 'a-alert', 'a-result']) {
    app.component(name, defineComponent({ setup: (_, { attrs, slots }) => () => h(name, attrs, slots.default?.()) }))
  }
  const instance = app.mount(root)
  const button = (label: string) => hostNodes(root).find(node => node.type === 'a-button' && hostText(node).includes(label))!
  const click = (label: string) => (button(label).props.onClick as () => Promise<void>)()
  const create = async () => {
    const form = hostNodes(root).find(node => node.type === 'form')!
    ;(form.props.onSubmit as (event: object) => void)({ preventDefault() {}, stopPropagation() {} })
    await settleHost()
  }
  const invalidFields = () => hostNodes(root).filter(node => node.type === 'input'
    && String(node.props.class).includes('ant-input-status-error')).map(node => String(node.props.id).replace(/^form_item_/, ''))
  const validateVersion = () => (instance.$refs.editorForm as FormInstance).validateFields(['version'])
  return { state, root, create, click, invalidFields, validateVersion }
}

it.each(['', ' \t ', 'Bad--Slug'])('创建标识%j无效时拒绝下一步并标红', async slug => {
  const page = mount('create'); page.state.slug.value = slug
  await page.create()
  expect(page.state.create).not.toHaveBeenCalled()
  expect(page.invalidFields()).toContain('slug')
})

it('合法标识只触发一次创建', async () => {
  const page = mount('create'); page.state.slug.value = 'review-helper'
  await page.create()
  expect(page.state.create).toHaveBeenCalledTimes(1)
  expect(page.invalidFields()).toEqual([])
})

it('完整草稿缺必填信息时不保存，修正后允许保存', async () => {
  const page = mount()
  Object.assign(page.state.form, { name: '', summary: '   ', categoryId: '', version: '', releaseNotes: '',
    originalAuthor: '', compatibility: '', dependencies: '' })
  await page.click('保存完整草稿'); await settleHost()
  expect(page.state.save).not.toHaveBeenCalled()
  expect(page.invalidFields()).toEqual(expect.arrayContaining([
    'name', 'summary', 'categoryId', 'version', 'releaseNotes', 'originalAuthor', 'compatibility', 'dependencies',
  ]))
  Object.assign(page.state.form, { name: '名称', summary: '简介', categoryId: 'general', version: '1.0.0',
    releaseNotes: '首版', originalAuthor: '本人', compatibility: '通用', dependencies: '无' })
  await page.click('保存完整草稿'); await settleHost()
  expect(page.state.save).toHaveBeenCalledTimes(1)
  expect(page.invalidFields()).toEqual([])
})

it.each(['0', '0.1', '0..2', 'v1.0.0', '01.0.0', '1.01.0', '1.0.01', '1.0.0-01',
  '1.0.0-', '1.0.0+', '1.0.0-alpha..1', '1.0.0+build..1', ' 1.0.0', '1.0.0\n'])(
  '版本%j不符合SemVer时阻止保存和发布，并显示具体提示', async version => {
    const page = mount(); page.state.form.version = version
    for (const action of ['保存完整草稿', '确认声明并发布']) {
      await page.click(action); await settleHost()
      expect(page.state.save).not.toHaveBeenCalled()
      expect(page.state.submit).not.toHaveBeenCalled()
      expect(page.invalidFields()).toEqual(['version'])
      await expect(page.validateVersion()).rejects.toMatchObject({ errorFields: [{ name: ['version'],
        errors: [expect.stringContaining('请填写合法的 SemVer 版本，如 1.0.0')] }] })
    }
  },
)

it.each(['', '   '])('版本%j为空时保留必填提示', async version => {
  const page = mount(); page.state.form.version = version
  await page.click('确认声明并发布'); await settleHost()
  expect(page.state.submit).not.toHaveBeenCalled()
  expect(page.invalidFields()).toEqual(['version'])
  await expect(page.validateVersion()).rejects.toMatchObject({ errorFields: [{ errors: ['请填写版本'] }] })
})

it.each(['0.0.0', '0.1.2', '1.0.0', '1.0.0-alpha.1', '1.0.0-0', '1.0.0-01a',
  '1.0.0+001', '1.0.0-rc.1+build.001'])(
  '合法版本%j可以保存和发布', async version => {
    const page = mount(); page.state.form.version = version
    await page.click('保存完整草稿')
    expect(page.state.save).toHaveBeenCalledTimes(1)
    await page.click('确认声明并发布'); await settleHost()
    expect(page.state.submit).toHaveBeenCalledTimes(1)
    expect(page.invalidFields()).toEqual([])
    expect(page.state.form.version).toBe(version)
  },
)

it('版本失焦时提示格式错误，修正后清除错误并允许发布', async () => {
  const page = mount(); page.state.form.version = '0.1'
  await settleHost()
  const input = hostNodes(page.root).find(node => node.type === 'input' && node.props.id === 'form_item_version')!
  ;(input.props.onBlur as (event: object) => void)({ target: { value: '0.1' } })
  await settleHost()
  expect(page.invalidFields()).toEqual(['version'])
  await expect(page.validateVersion()).rejects.toMatchObject({ errorFields: [{ name: ['version'],
    errors: [expect.stringContaining('请填写合法的 SemVer 版本')] }] })
  page.state.form.version = '0.1.0'
  await page.click('确认声明并发布'); await settleHost()
  expect(page.state.submit).toHaveBeenCalledTimes(1)
  expect(page.invalidFields()).toEqual([])
  await expect(page.validateVersion()).resolves.toEqual({ version: '0.1.0' })
})

it('许可和声明只阻止发布，允许保存草稿；补齐后可发布', async () => {
  const page = mount()
  Object.assign(page.state.form, { license: '', distributionAuthorized: false, declarationsConfirmed: false })
  await page.click('确认声明并发布'); await settleHost()
  expect(page.state.submit).not.toHaveBeenCalled()
  expect(page.invalidFields()).toContain('license')
  await page.click('保存完整草稿'); await settleHost()
  expect(page.state.save).toHaveBeenCalledTimes(1)
  expect(page.invalidFields()).toEqual([])
  Object.assign(page.state.form, { license: 'MIT', distributionAuthorized: true, declarationsConfirmed: true })
  await page.click('确认声明并发布')
  expect(page.state.submit).toHaveBeenCalledTimes(1)
})

it.each(['distributionAuthorized', 'declarationsConfirmed'] as const)('未确认%s时不能发布', async field => {
  const page = mount(); page.state.form[field] = false
  await page.click('确认声明并发布')
  expect(page.state.submit).not.toHaveBeenCalled()
})

it.each(['session', 'draft'] as const)('异步校验期间%s变化后不继续原操作', async changed => {
  const page = mount()
  const pending = page.click('确认声明并发布')
  if (changed === 'session') mocks.session = 'another-session'
  else page.state.draft.value = { draftId: '31', slug: 'another-skill', status: 'READY', revision: 1 }
  await pending
  expect(page.state.submit).not.toHaveBeenCalled()
})
