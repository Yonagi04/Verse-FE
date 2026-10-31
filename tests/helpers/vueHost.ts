import { readFileSync } from 'node:fs'
import { parse, compileScript, compileTemplate } from '@vue/compiler-sfc'
import * as Vue from 'vue'
import { createRenderer, nextTick } from 'vue'

export interface HostNode {
  type: string
  text: string
  props: Record<string, unknown>
  children: HostNode[]
  parent: HostNode | null
  style: Record<string, string>
}
export const hostNode = (type: string, text = ''): HostNode => ({ type, text, props: {}, children: [], parent: null, style: {} })
export const hostRenderer = createRenderer<HostNode, HostNode>({
  createElement: type => hostNode(type), createText: text => hostNode('text', text), createComment: () => hostNode('comment'),
  setText: (target, text) => { target.text = text },
  setElementText: (target, text) => { target.text = text; target.children = [] },
  parentNode: target => target.parent,
  nextSibling: target => target.parent?.children[target.parent.children.indexOf(target) + 1] ?? null,
  patchProp: (target, key, _old, value) => { target.props[key] = value },
  insert(target, parent, anchor = null) {
    if (target.parent) target.parent.children.splice(target.parent.children.indexOf(target), 1)
    target.parent = parent
    const position = anchor ? parent.children.indexOf(anchor) : -1
    parent.children.splice(position < 0 ? parent.children.length : position, 0, target)
  },
  remove(target) {
    if (target.parent) target.parent.children.splice(target.parent.children.indexOf(target), 1)
    target.parent = null
  },
})

// Vite测试提供SSR脚本；真实组件交互需要附上同一SFC的客户端模板。
export function attachClientRender(component: { render?: unknown }, filename: URL) {
  const { descriptor } = parse(readFileSync(filename, 'utf8'), { filename: filename.pathname })
  const script = compileScript(descriptor, { id: filename.pathname })
  const template = compileTemplate({ source: descriptor.template!.content, filename: filename.pathname,
    id: filename.pathname, compilerOptions: { bindingMetadata: script.bindings } })
  if (template.errors.length) throw new Error(String(template.errors))
  const render = template.code.replace(/import \{([^}]+)\} from "vue"/g,
    (_, names: string) => 'const {' + names.replace(/ as /g, ': ') + '} = Vue')
    .replace('export function render', 'return function render')
  component.render = new Function('Vue', render)(Vue)
}
export const hostText = (node: HostNode): string => node.text + node.children.map(hostText).join(' ')
export const hostNodes = (node: HostNode): HostNode[] => [node, ...node.children.flatMap(hostNodes)]
export async function settleHost() {
  for (let index = 0; index < 12; index++) { await Promise.resolve(); await nextTick() }
}
