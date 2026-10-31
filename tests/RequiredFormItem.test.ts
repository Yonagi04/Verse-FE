import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { defineComponent, h, reactive, ref, ssrContextKey, type App } from 'vue'
import { Form, Input, type FormInstance } from 'ant-design-vue'
import type { Rule } from 'ant-design-vue/es/form/interface'
import RequiredFormItem from '../src/components/form/RequiredFormItem.vue'
import { attachClientRender, hostNode, hostNodes, hostRenderer, settleHost } from './helpers/vueHost'

// 真实 Form/Item/Input 验证规则及错误状态；提示位置和动画在浏览器验收。
attachClientRender(RequiredFormItem, new URL('../src/components/form/RequiredFormItem.vue', import.meta.url))
let app: App | undefined
beforeEach(() => {
  vi.stubGlobal('window', { matchMedia: () => ({ matches: false, addListener() {}, removeListener() {} }) })
  vi.stubGlobal('getComputedStyle', () => ({ marginBottom: '0px' }))
})
function mount(value = '', message?: string, rules?: Rule[]) {
  const model = reactive({ name: value })
  const form = ref<FormInstance>()
  const root = hostNode('root')
  app = hostRenderer.createApp(defineComponent({ setup: () => () => h(Form, { ref: form, model, layout: 'vertical' },
    () => h(RequiredFormItem, { name: 'name', label: '名称', message, rules },
      () => h(Input, { value: model.name, 'onUpdate:value': (next: string) => { model.name = next } }))) }))
  app.provide(ssrContextKey, {}); app.component('a-form-item', Form.Item); app.mount(root)
  return { model, form, root }
}
afterEach(() => { app?.unmount(); vi.unstubAllGlobals() })

it.each(['', ' \n\t '])('缺少名称%j时显示字段错误及输入框错误状态', async value => {
  const { form, root } = mount(value)
  await expect(form.value!.validateFields()).rejects.toMatchObject({ errorFields: [{ errors: ['请填写名称'] }] })
  await settleHost()
  expect(hostNodes(root).some(node => String(node.props.class).includes('ant-input-status-error'))).toBe(true)
})

it('补齐值后校验通过并清除红框及错误文案', async () => {
  const { form, model, root } = mount()
  await form.value!.validateFields().catch(() => {})
  model.name = '有效名称'
  await expect(form.value!.validateFields()).resolves.toEqual({ name: '有效名称' })
  await settleHost()
  expect(hostNodes(root).some(node => String(node.props.class).includes('ant-input-status-error'))).toBe(false)
})

it('允许复用者定制提示并保留额外格式校验', async () => {
  const { form, model } = mount('', '请填写 Skill 标识', [{ pattern: /^[a-z]+$/, message: '仅支持小写字母' }])
  await expect(form.value!.validateFields()).rejects.toMatchObject({ errorFields: [{ errors: ['请填写 Skill 标识'] }] })
  model.name = 'INVALID'
  await expect(form.value!.validateFields()).rejects.toMatchObject({ errorFields: [{ errors: ['仅支持小写字母'] }] })
  model.name = 'valid'
  await expect(form.value!.validateFields()).resolves.toEqual({ name: 'valid' })
})
