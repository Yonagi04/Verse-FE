import type { SkillPage } from './skill'

export type CommentReaction = 'NONE' | 'LIKE' | 'DISLIKE'
export interface CommentProfile { userId: string; displayName: string; avatarUrl: string | null }
export interface SkillComment {
  commentId: string; rootId: string; replyToCommentId: string | null
  author: CommentProfile | null; content: string | null; createdAt: string; likeCount: number
  myReaction: CommentReaction; replyCount: number; deleted: boolean; canDelete: boolean; canReply: boolean
  replyTo: { commentId: string; displayName: string; deleted: boolean } | null
}
export type CommentPage = SkillPage<SkillComment>
export interface CommentReceipt { commentId: string; rootId: string; skillId: string }
export interface CommentReactionResult { commentId: string; reaction: CommentReaction; likeCount: number }
