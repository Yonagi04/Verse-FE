import { afterEach, expect, it, vi } from 'vitest'
import { defineComponent, h, ref, ssrContextKey, type App } from 'vue'
import TextDiff from '../src/views/skill/SkillTextDiff.vue'
import { skillDiff, type SkillDiff } from '../src/utils/skillDiff'
import { attachClientRender, hostNode, hostNodes, hostRenderer, hostText, settleHost } from './helpers/vueHost'
attachClientRender(TextDiff, new URL('../src/views/skill/SkillTextDiff.vue', import.meta.url))
let app: App | undefined
afterEach(() => { app?.unmount(); app = undefined; vi.unstubAllGlobals() })
it('大段上下文展开与滚动都只物化至多60行，并终止旧Worker', async () => {
  const workers: { terminated: boolean }[] = []
  class TestWorker {
    terminated = false
    onmessage?: (event: { data: { result: SkillDiff } }) => void
    constructor() { workers.push(this) }
    postMessage(value: { oldText: string; newText: string }) { this.onmessage?.({ data: { result: skillDiff(value.oldText, value.newText) } }) }
    terminate() { this.terminated = true }
  }
  vi.stubGlobal('Worker', TestWorker)
  const text = ref('中文\r\n'.repeat(50_000))
  app = hostRenderer.createApp(defineComponent({ setup: () => () => h(TextDiff, { oldText: text.value, newText: text.value }) }))
  for (const name of ['a-alert', 'a-spin']) app.component(name, defineComponent({ render: () => null }))
  app.provide(ssrContextKey, {})
  const root = hostNode('root'); app.mount(root); await settleHost()
  const rows = () => hostNodes(root).filter(node => String(node.props.class).includes('diff-line'))
  expect(rows()).toHaveLength(7)
  const expand = hostNodes(root).find(node => node.type === 'button' && hostText(node).includes('展开'))!
  ;(expand.props.onClick as () => void)(); await settleHost(); expect(rows()).toHaveLength(60)
  const scroller = hostNodes(root).find(node => String(node.props.class).includes('diff-scroll'))!
  ;(scroller.props.onScroll as (event: object) => void)({ target: { scrollTop: 100_000 } }); await settleHost()
  expect(rows().length).toBeLessThanOrEqual(60); expect(hostText(root)).toContain('中文')
  text.value = '<img src=x onerror=alert(1)>\n'; await settleHost()
  expect(workers.every(worker => worker.terminated)).toBe(true)
  expect(hostNodes(root).some(node => node.type === 'img')).toBe(false)
  expect(hostText(root)).toContain('<img src=x onerror=alert(1)>')
})
