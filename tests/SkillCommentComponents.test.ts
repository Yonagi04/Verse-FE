import { expect, it } from 'vitest'
import { defineComponent, h, ssrContextKey } from 'vue'
import Composer from '../src/views/skill/SkillCommentComposer.vue'
import Item from '../src/views/skill/SkillCommentItem.vue'
import type { SkillComment } from '../src/types/skillComment'
import { attachClientRender, hostNode, hostRenderer, hostNodes, hostText } from './helpers/vueHost'

attachClientRender(Composer, new URL('../src/views/skill/SkillCommentComposer.vue', import.meta.url))
attachClientRender(Item, new URL('../src/views/skill/SkillCommentItem.vue', import.meta.url))
const item: SkillComment = { commentId: '100', rootId: '100', replyToCommentId: null, author: { userId: '2', displayName: '张三', avatarUrl: null },
  content: '<script>alert(1)</script>', createdAt: '2026-10-31T01:00:00Z', likeCount: 3, myReaction: 'DISLIKE', replyCount: 0,
  deleted: false, canDelete: false, canReply: true, replyTo: null }
it('条目以纯文本显示内容，只显示点赞数、本人点踩状态和允许的按钮', () => {
  const root = hostNode('root'), app = hostRenderer.createApp(Item, { comment: item, now: Date.parse('2026-10-31T01:30:00Z'), timezone: 'Asia/Shanghai' })
  app.provide(ssrContextKey, {})
  app.component('a-avatar', defineComponent({ setup: (_, { slots }) => () => h('avatar', slots.default?.()) }))
  app.component('a-button', defineComponent({ setup: (_, { attrs, slots }) => () => h('button', attrs, slots.default?.()) }))
  app.mount(root)
  expect(hostText(root)).toContain('<script>alert(1)</script>')
  expect(hostText(root)).toContain('张')
  expect(hostText(root)).toContain('30分钟前')
  expect(hostText(root)).not.toContain('删除')
  expect(hostNodes(root).some(node => node.props['aria-label'] === '点踩' && node.props['aria-pressed'] === true)).toBe(true)
  expect(hostNodes(root).some(node => node.type === 'script' || node.props.innerHTML)).toBe(false)
  app.unmount()
})
it('输入框固定行数，不自动增高，超出1000码点禁止发送', () => {
  const root = hostNode('root'), app = hostRenderer.createApp(Composer, { modelValue: '😀'.repeat(1001) })
  app.provide(ssrContextKey, {})
  app.component('a-textarea', defineComponent({ setup: (_, { attrs }) => () => h('textarea', attrs) }))
  app.component('a-button', defineComponent({ setup: (_, { attrs, slots }) => () => h('button', attrs, slots.default?.()) }))
  app.mount(root)
  const textarea = hostNodes(root).find(node => node.type === 'textarea')!
  expect(textarea.props.rows).toBe(4); expect(textarea.props.autoSize).toBeUndefined()
  expect(hostNodes(root).find(node => node.type === 'button')?.props.disabled).toBe(true)
  expect(hostText(root)).toContain('1001 / 1000'); app.unmount()
})
