<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { LikeOutlined, LikeFilled, DislikeOutlined, DislikeFilled, UserOutlined } from '@ant-design/icons-vue'
import type { CommentReaction, SkillComment } from '@/types/skillComment'
import { commentTime } from '@/utils/skillComment'
const props = defineProps<{ comment: SkillComment; busy?: boolean; now: number; timezone: string }>()
const emit = defineEmits<{ reply: [comment: SkillComment]; remove: [comment: SkillComment]
  react: [comment: SkillComment, reaction: CommentReaction] }>()
const imageFailed = ref(false)
watch(() => props.comment.author?.avatarUrl, () => { imageFailed.value = false })
const initial = computed(() => Array.from(props.comment.author?.displayName || '用')[0])
function react(value: CommentReaction) {
  emit('react', props.comment, props.comment.myReaction === value ? 'NONE' : value)
}
</script>
<template>
  <article class="comment-item" :class="{ 'deleted-comment': comment.deleted }" :id="'skill-comment-' + comment.commentId">
    <template v-if="comment.deleted">
      <a-avatar class="deleted-avatar" aria-label="已删除评论的默认头像">
        <template #icon><UserOutlined /></template>
      </a-avatar>
      <div class="comment-body">
        <div class="comment-name">已删除评论</div>
        <p class="comment-content">该评论已被作者删除</p>
      </div>
    </template>
    <template v-else>
      <a-avatar :src="imageFailed ? undefined : comment.author?.avatarUrl || undefined"
        :alt="comment.author?.displayName" @error="imageFailed = true">{{ initial }}</a-avatar>
      <div class="comment-body">
        <div class="comment-name">{{ comment.author?.displayName }}</div>
        <p v-if="comment.replyTo" class="reply-target">回复 {{ comment.replyTo.displayName }}</p>
        <p class="comment-content">{{ comment.content }}</p>
        <div class="comment-actions">
          <time :datetime="comment.createdAt">{{ commentTime(comment.createdAt, now, timezone) }}</time>
          <a-button type="text" size="small" :disabled="busy" :aria-pressed="comment.myReaction === 'LIKE'"
            :class="{ selected: comment.myReaction === 'LIKE' }" aria-label="点赞" @click="react('LIKE')">
            <LikeFilled v-if="comment.myReaction === 'LIKE'" /><LikeOutlined v-else /> {{ comment.likeCount }}
          </a-button>
          <a-button type="text" size="small" :disabled="busy" :aria-pressed="comment.myReaction === 'DISLIKE'"
            :class="{ selected: comment.myReaction === 'DISLIKE' }" aria-label="点踩" @click="react('DISLIKE')">
            <DislikeFilled v-if="comment.myReaction === 'DISLIKE'" /><DislikeOutlined v-else />
          </a-button>
          <a-button v-if="comment.canReply" type="text" size="small" :disabled="busy" @click="emit('reply', comment)">回复</a-button>
          <a-button v-if="comment.canDelete" type="text" danger size="small" :disabled="busy" @click="emit('remove', comment)">删除</a-button>
        </div>
        <slot />
      </div>
    </template>
  </article>
</template>
<style lang="scss" scoped>
.comment-item { display: flex; align-items: flex-start; gap: 12px; padding: 18px 0; min-width: 0; }
.comment-body { flex: 1; min-width: 0; }.comment-name { color: $color-text-primary; font-weight: 600; }
.comment-content { white-space: pre-wrap; overflow-wrap: anywhere; margin: 8px 0; line-height: 1.8; }
.reply-target { color: $color-text-tertiary; font-size: 13px; margin: 6px 0; }
.deleted-avatar { background: $color-bg-secondary; color: $color-text-tertiary; flex-shrink: 0; }
.deleted-comment .comment-name, .deleted-comment .comment-content { color: $color-text-tertiary; }
.comment-actions { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
time { color: $color-text-tertiary; font-size: 12px; margin-right: 8px; }.comment-actions .selected { color: $color-primary; }
</style>
