<script setup lang="ts">
import { computed, onBeforeUnmount, ref, toRef } from 'vue'
import PaginationBar from '@/components/PaginationBar.vue'
import { useSettingsStore } from '@/stores/settings'
import { useSkillComments } from '@/composables/useSkillComments'
import SkillCommentItem from './SkillCommentItem.vue'
import SkillCommentComposer from './SkillCommentComposer.vue'
import SkillReplyPagination from './SkillReplyPagination.vue'
const props = defineProps<{ skillId: string }>()
const settings = useSettingsStore()
const { sort, page, size, result, loading, error, actionError, rootDraft, replyDraft, target, posting, replies, busy,
  load, loadReplies, reply, cancelReply, send, react, remove, changePage, changeSize, changeSort, replyPage, collapseReplies } = useSkillComments(toRef(props, 'skillId'))
const totalPages = computed(() => Math.max(1, Math.ceil((result.value?.total ?? 0) / size.value)))
const now = ref(Date.now())
const timer = setInterval(() => { now.value = Date.now() }, 60000)
onBeforeUnmount(() => clearInterval(timer))
</script>
<template>
  <section class="skill-comments" aria-label="Skill评论">
    <h2>评论</h2>
    <SkillCommentComposer v-model="rootDraft" :loading="posting" @send="send()" />
    <div class="comment-toolbar">
      <span>{{ result?.total ?? 0 }} 个讨论</span>
      <a-radio-group :value="sort" button-style="solid" size="small" :disabled="posting"
        @change="changeSort($event.target.value)">
        <a-radio-button value="hot">最热</a-radio-button><a-radio-button value="new">最新</a-radio-button>
      </a-radio-group>
    </div>
    <a-alert v-if="actionError" type="error" show-icon :message="actionError" />
    <a-alert v-if="error" type="error" show-icon :message="error">
      <template #action><a-button @click="load">重试</a-button></template>
    </a-alert>
    <a-spin :spinning="loading">
      <a-empty v-if="!error && result && result.total === 0" description="还没有评论，来分享你的体验吧" />
      <div v-for="root in result?.items" :key="root.commentId" class="comment-thread">
        <SkillCommentItem :comment="root" :now="now" :timezone="settings.timezone" :busy="busy.has(root.commentId)"
          @reply="reply" @react="react" @remove="remove">
          <div v-if="target?.commentId === root.commentId" class="reply-composer">
            <SkillCommentComposer v-model="replyDraft" :loading="posting" :label="'回复 ' + target.author?.displayName" @send="send(true)" />
            <a-button type="link" :disabled="posting" @click="cancelReply">取消回复</a-button>
          </div>
        </SkillCommentItem>
        <div v-if="root.replyCount > 0 || replies[root.commentId]" class="thread-replies">
          <a-button v-if="!replies[root.commentId]" type="link" @click="loadReplies(root.commentId)">查看 {{ root.replyCount }} 条回复</a-button>
          <template v-else>
            <a-alert v-if="replies[root.commentId]!.error" type="error" :message="replies[root.commentId]!.error">
              <template #action><a-button @click="loadReplies(root.commentId)">重试</a-button></template>
            </a-alert>
            <a-spin :spinning="replies[root.commentId]!.loading">
              <SkillCommentItem v-for="item in replies[root.commentId]!.result?.items" :key="item.commentId"
                :comment="item" :now="now" :timezone="settings.timezone" :busy="busy.has(item.commentId)"
                @reply="reply" @react="react" @remove="remove">
                <div v-if="target?.commentId === item.commentId" class="reply-composer">
                  <SkillCommentComposer v-model="replyDraft" :loading="posting" :label="'回复 ' + target.author?.displayName" @send="send(true)" />
                  <a-button type="link" :disabled="posting" @click="cancelReply">取消回复</a-button>
                </div>
              </SkillCommentItem>
              <SkillReplyPagination v-if="replies[root.commentId]!.result"
                :current-page="replies[root.commentId]!.page"
                :total-pages="Math.max(1, Math.ceil(replies[root.commentId]!.result!.total / replies[root.commentId]!.size))"
                :disabled="posting || replies[root.commentId]!.loading"
                @change="replyPage(root.commentId, $event)" @collapse="collapseReplies(root.commentId)" />
            </a-spin>
          </template>
        </div>
      </div>
      <PaginationBar v-if="result?.total" :current-page="page" :page-size="size" :total="result.total"
        :total-pages="totalPages" :page-jump-id="'comment-roots-' + skillId"
        @update:current-page="changePage" @update:page-size="changeSize" />
    </a-spin>
  </section>
</template>
<style lang="scss" scoped>
.skill-comments { border: 1px solid $color-border; background: $color-bg; border-radius: $radius-card; padding: 28px; margin-top: 24px; min-width: 0; }
h2 { font-size: 20px; margin: 0 0 20px; color: $color-text-primary; }
.comment-toolbar { display: flex; justify-content: space-between; align-items: center; margin: 24px 0 8px; color: $color-text-secondary; }
.comment-thread { border-bottom: 1px solid $color-border; }.thread-replies { margin-left: 44px; padding-bottom: 16px; }
.reply-composer { margin-top: 14px; }
:deep(.pagination-bar) { flex-wrap: wrap; gap: 12px; }
@media(max-width: 600px) { .skill-comments { padding: 18px; }.thread-replies { margin-left: 12px; } }
</style>
