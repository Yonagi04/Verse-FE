import http from './request'
import type { CommentPage, CommentReaction, CommentReactionResult, CommentReceipt } from '@/types/skillComment'

const base = (skillId: string) => `/skills/${skillId}/comments`
const config = (signal?: AbortSignal) => ({ signal, silentError: true })
export const listSkillComments = (skillId: string, sort: 'hot' | 'new', page: number, size: number,
  signal?: AbortSignal): Promise<CommentPage> =>
  http.get(base(skillId), { ...config(signal), params: { sort, page, size } })
export const listSkillReplies = (skillId: string, rootId: string, page: number, size: number,
  signal?: AbortSignal): Promise<CommentPage> =>
  http.get(`${base(skillId)}/${rootId}/replies`, { ...config(signal), params: { page, size } })
export const createSkillComment = (skillId: string, content: string, replyToCommentId: string | undefined,
  key: string, signal?: AbortSignal): Promise<CommentReceipt> =>
  http.post(base(skillId), { content, replyToCommentId }, { ...config(signal), headers: { 'Idempotency-Key': key } })
export const reactToSkillComment = (skillId: string, commentId: string, reaction: CommentReaction,
  signal?: AbortSignal): Promise<CommentReactionResult> =>
  http.put(`${base(skillId)}/${commentId}/reaction`, { reaction }, config(signal))
export const deleteSkillComment = (skillId: string, commentId: string, signal?: AbortSignal): Promise<void> =>
  http.delete(`${base(skillId)}/${commentId}`, config(signal))
