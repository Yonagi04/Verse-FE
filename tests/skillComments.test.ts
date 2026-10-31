import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import * as Vue from 'vue'
import { defineComponent, ref, type App } from 'vue'
import { useSkillComments } from '../src/composables/useSkillComments'
import type { CommentPage, SkillComment } from '../src/types/skillComment'
import { hostNode, hostRenderer, settleHost } from './helpers/vueHost'

const mocks = vi.hoisted(() => ({
  list: vi.fn(), replies: vi.fn(), create: vi.fn(), react: vi.fn(), remove: vi.fn(), confirm: vi.fn(),
  success: vi.fn(), session: 'session-a', identity: { token: 'session-a' },
}))
vi.mock('@/stores/user', () => ({ useUserStore: () => Vue.reactive(mocks.identity) }))
vi.mock('@/utils/auth', () => ({ getToken: () => mocks.session }))
vi.mock('ant-design-vue', () => ({ Modal: { confirm: mocks.confirm }, message: { success: mocks.success } }))
vi.mock('@/api/skillComment', () => ({ listSkillComments: mocks.list, listSkillReplies: mocks.replies,
  createSkillComment: mocks.create, reactToSkillComment: mocks.react, deleteSkillComment: mocks.remove }))
let app: App | undefined
let state: ReturnType<typeof useSkillComments>
const id = ref('20')
const comment = (commentId = '100', rootId = '100'): SkillComment => ({
  commentId, rootId, replyToCommentId: null, author: { userId: '2', displayName: '昵称', avatarUrl: null },
  content: '正文', createdAt: '2026-10-31T01:00:00Z', likeCount: 3, myReaction: 'NONE', replyCount: 21,
  deleted: false, canDelete: true, canReply: true, replyTo: null,
})
const page = (items: SkillComment[] = [comment()], size = 10): CommentPage => ({ page: 1, size, total: items.length, items })
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done }); return { promise, resolve } }
beforeEach(async () => {
  vi.resetAllMocks(); mocks.session = 'session-a'; Vue.reactive(mocks.identity).token = 'session-a'; id.value = '20'
  mocks.list.mockResolvedValue(page()); mocks.replies.mockResolvedValue({ ...page([comment('101')], 10), total: 21 })
  mocks.create.mockResolvedValue({ commentId: '102', rootId: '100', skillId: '20' })
  mocks.react.mockResolvedValue({ commentId: '100', reaction: 'LIKE', likeCount: 4 })
  mocks.remove.mockResolvedValue(undefined)
  app = hostRenderer.createApp(defineComponent({ setup() { state = useSkillComments(id); return () => null } }))
  app.mount(hostNode('root')); await settleHost()
})
afterEach(() => { app?.unmount() })

it('父列表默认10，回复固定10，父列表调整大小和排序不改变回复分页大小', async () => {
  expect(mocks.list.mock.calls[0]?.slice(0, 4)).toEqual(['20', 'hot', 1, 10])
  await state.loadReplies('100')
  expect(mocks.replies.mock.calls[0]?.slice(0, 4)).toEqual(['20', '100', 1, 10])
  state.changePage(3); await settleHost(); state.changeSize(50); await settleHost()
  expect(state.page.value).toBe(1); expect(state.size.value).toBe(50)
  state.changeSort('new'); await settleHost(); expect(state.sort.value).toBe('new')
  state.replyPage('100', 2); await settleHost()
  expect(state.replies['100']?.size).toBe(10); expect(state.size.value).toBe(50)
  expect(mocks.replies.mock.calls.at(-1)?.slice(0, 4)).toEqual(['20', '100', 2, 10])
})

it('首次展开回复后，成功响应写入可见列表并响应式结束loading', async () => {
  const response = deferred<CommentPage>()
  mocks.replies.mockReturnValueOnce(response.promise)
  const rendered: string[] = []
  const stop = Vue.watchEffect(() => {
    const current = state.replies['100']
    rendered.push(`${current?.loading}:${current?.result?.items[0]?.content ?? ''}`)
  })
  try {
    const loading = state.loadReplies('100')
    await settleHost()
    expect(rendered.at(-1)).toBe('true:')
    response.resolve(page([{ ...comment('101'), content: '接口返回的子评论' }], 10))
    await loading; await settleHost()
    expect(state.replies['100']?.result?.items[0]?.content).toBe('接口返回的子评论')
    expect(state.replies['100']?.loading).toBe(false)
    expect(rendered.at(-1)).toBe('false:接口返回的子评论')
  } finally { stop() }
})

it('首次回复请求失败后结束loading并展示错误，重试成功后恢复内容', async () => {
  mocks.replies.mockRejectedValueOnce(new Error('回复加载失败'))
  await state.loadReplies('100')
  expect(state.replies['100']?.loading).toBe(false)
  expect(state.replies['100']?.error).toBe('回复加载失败')
  await state.loadReplies('100')
  expect(state.replies['100']?.loading).toBe(false)
  expect(state.replies['100']?.error).toBe('')
  expect(state.replies['100']?.result?.items[0]?.commentId).toBe('101')
})

it('发送失败保留草稿，同内容重试复用UUID，成功才清空并展示最新', async () => {
  mocks.create.mockRejectedValueOnce(new Error('连接失败'))
  state.rootDraft.value = '评论正文'; await state.send()
  expect(state.rootDraft.value).toBe('评论正文'); expect(state.actionError.value).toContain('连接失败')
  const firstKey = mocks.create.mock.calls[0]?.[3]
  await state.send()
  expect(mocks.create.mock.calls[1]?.[3]).toBe(firstKey)
  expect(state.rootDraft.value).toBe(''); expect(state.sort.value).toBe('new'); expect(state.page.value).toBe(1)
})

it('改写内容换新幂等键，空白与超长内容不发送', async () => {
  mocks.create.mockRejectedValue(new Error('失败'))
  state.rootDraft.value = '原文'; await state.send()
  state.rootDraft.value = '改文'; await state.send()
  expect(mocks.create.mock.calls[0]?.[3]).not.toBe(mocks.create.mock.calls[1]?.[3])
  state.rootDraft.value = ' '; await state.send()
  state.rootDraft.value = '😀'.repeat(1001); await state.send()
  expect(mocks.create).toHaveBeenCalledTimes(2)
})

it('双击只发一次，回复发送保留真实子评论目标并加载末页', async () => {
  await state.reply(comment('101', '100')); state.replyDraft.value = '回复子评论'
  const pending = deferred<{ commentId: string; rootId: string; skillId: string }>()
  mocks.create.mockReturnValue(pending.promise)
  const first = state.send(true); await state.send(true)
  expect(mocks.create).toHaveBeenCalledOnce()
  expect(mocks.create.mock.calls[0]?.slice(0, 3)).toEqual(['20', '回复子评论', '101'])
  pending.resolve({ commentId: '102', rootId: '100', skillId: '20' }); await first
  expect(state.replyDraft.value).toBe(''); expect(state.target.value).toBeUndefined()
  expect(state.replies['100']?.page).toBe(3)
})

it('切回复对象需要处理草稿，取消不丢稿，确认才清空', async () => {
  await state.reply(comment()); state.replyDraft.value = '未发送'
  mocks.confirm.mockImplementationOnce(options => options.onCancel())
  await state.reply(comment('101'))
  expect(state.replyDraft.value).toBe('未发送'); expect(state.target.value?.commentId).toBe('100')
  mocks.confirm.mockImplementationOnce(options => options.onOk())
  await state.reply(comment('101'))
  expect(state.replyDraft.value).toBe(''); expect(state.target.value?.commentId).toBe('101')
})

it('赞踩以服务端结果更新，单条并发被抑制，失败保持旧状态', async () => {
  const item = comment('101')
  const pending = deferred<{ commentId: string; reaction: 'LIKE'; likeCount: number }>()
  mocks.react.mockReturnValueOnce(pending.promise)
  const first = state.react(item, 'LIKE'); await state.react(item, 'DISLIKE')
  expect(mocks.react).toHaveBeenCalledOnce()
  pending.resolve({ commentId: '101', reaction: 'LIKE', likeCount: 4 }); await first
  expect(item.myReaction).toBe('LIKE'); expect(item.likeCount).toBe(4)
  mocks.react.mockRejectedValueOnce(new Error('更新失败')); await state.react(item, 'NONE')
  expect(item.myReaction).toBe('LIKE'); expect(item.likeCount).toBe(4)
})

it('删除确认前不请求，确认后刷新，失败保留原列表', async () => {
  state.remove(comment())
  expect(mocks.remove).not.toHaveBeenCalled()
  await mocks.confirm.mock.calls[0]?.[0].onOk()
  expect(mocks.remove.mock.calls[0]?.slice(0, 2)).toEqual(['20', '100'])
  mocks.remove.mockRejectedValueOnce(new Error('不可删除'))
  state.remove(comment())
  await expect(mocks.confirm.mock.calls[1]?.[0].onOk()).rejects.toThrow('不可删除')
  expect(state.result.value?.items[0]?.content).toBe('正文')
})

it('点赞等待期间列表替换，成功后仍更新当前对象并刷新权威状态', async () => {
  state.changeSort('new'); await settleHost()
  const old = state.result.value!.items[0]!
  const pending = deferred<{ commentId: string; reaction: 'LIKE'; likeCount: number }>()
  mocks.react.mockReturnValueOnce(pending.promise)
  const vote = state.react(old, 'LIKE')
  const replacement = comment()
  mocks.list.mockResolvedValueOnce(page([replacement]))
  await state.load()
  expect(state.result.value!.items[0]).not.toBe(old)
  mocks.list.mockResolvedValueOnce(page([{ ...replacement, myReaction: 'LIKE', likeCount: 4 }]))
  pending.resolve({ commentId: '100', reaction: 'LIKE', likeCount: 4 }); await vote
  expect(state.result.value!.items[0]!.myReaction).toBe('LIKE')
  expect(state.result.value!.items[0]!.likeCount).toBe(4)
})

it('新回复后按刷新得到的准确回复数定位，整10条不误跳第二页', async () => {
  mocks.list.mockResolvedValueOnce(page([{ ...comment(), replyCount: 10 }]))
  mocks.replies.mockResolvedValueOnce({ ...page([comment('101')], 10), total: 10 })
  await state.reply(comment()); state.replyDraft.value = '第10条'
  await state.send(true)
  expect(mocks.replies.mock.calls.at(-1)?.slice(0, 4)).toEqual(['20', '100', 1, 10])
})

it('切换账号或Skill后忽略旧请求结果和旧发送完成，清空旧草稿', async () => {
  const old = deferred<CommentPage>()
  mocks.list.mockReturnValueOnce(old.promise)
  const loading = state.load()
  const sending = deferred<{ commentId: string; rootId: string; skillId: string }>()
  mocks.create.mockReturnValueOnce(sending.promise)
  state.rootDraft.value = '旧账号评论'; const pending = state.send()
  mocks.session = 'session-b'; Vue.reactive(mocks.identity).token = 'session-b'; id.value = '30'
  await settleHost()
  expect(state.rootDraft.value).toBe('')
  state.rootDraft.value = '新账号草稿'
  old.resolve(page([comment('old')])); sending.resolve({ commentId: 'old', rootId: 'old', skillId: '20' })
  await loading; await pending
  expect(state.result.value?.items[0]?.commentId).toBe('100')
  expect(state.rootDraft.value).toBe('新账号草稿')
  expect(mocks.success).not.toHaveBeenCalled()
})
