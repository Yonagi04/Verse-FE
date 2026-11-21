<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { HistoryOutlined, PlusOutlined, ReloadOutlined, ExportOutlined } from '@ant-design/icons-vue'
import type { SkillSource } from '@/types/skill'
import { useUserStore } from '@/stores/user'
import { getWorkspace, skillVersions, skillVersion } from '@/api/skillVersion'
import type { VersionPage, SkillVersion, SkillWorkspace } from '@/types/skillVersion'
import { apiErrorDetails } from '@/utils/apiError'
import SkillSourceSummary from './SkillSourceSummary.vue'
import SkillVersionFiles from './SkillVersionFiles.vue'
const route = useRoute(), user = useUserStore()
const skillId = computed(() => String(route.params.skillId))
const timeline = ref<VersionPage>(), selected = ref<SkillVersion>(), workspace = ref<SkillWorkspace>()
const page = ref(1), loading = ref(false), reading = ref(false), error = ref(''), detailError = ref('')
const tab = ref<'files' | 'information'>('files')
let controller = new AbortController(), detailController = new AbortController(), generation = 0, detailGeneration = 0
const date = (value?: string | null) => value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '—'
const name = computed(() => selected.value?.metadata?.name || workspace.value?.metadata?.name || workspace.value?.slug || 'Skill')
function sourceLabel(source: SkillSource | null) {
  if (!source) return '来源信息暂不可用'
  if (source.type === 'ZIP') return 'ZIP 上传'
  return ['GitHub', source.requestedRef, source.commitSha?.slice(0, 7)].filter(Boolean).join(' · ')
}
async function select(id: string) {
  detailController.abort(); detailController = new AbortController(); const turn = ++detailGeneration
  selected.value = undefined; detailError.value = ''; reading.value = true; tab.value = 'files'
  try { const value = await skillVersion(skillId.value, id, detailController.signal); if (turn === detailGeneration) selected.value = value }
  catch (failure) { const parsed = apiErrorDetails(failure); if (turn === detailGeneration && !parsed.cancelled) detailError.value = parsed.message }
  finally { if (turn === detailGeneration) reading.value = false }
}
async function load(reset = false) {
  if (reset) page.value = 1
  controller.abort(); detailController.abort(); controller = new AbortController(); const turn = ++generation; detailGeneration++
  loading.value = true; error.value = ''; selected.value = undefined; detailError.value = ''
  const head = reset ? undefined : timeline.value?.headSequence
  if (reset) { timeline.value = undefined; workspace.value = undefined }
  try {
    const [value, area] = await Promise.allSettled([skillVersions(skillId.value, page.value, head, controller.signal), getWorkspace(skillId.value, controller.signal)])
    if (turn !== generation) return
    if (value.status === 'rejected') throw value.reason
    timeline.value = value.value
    if (area.status === 'fulfilled') workspace.value = area.value
    // 基础信息或固定来源缺失不能抹掉时间线；节点详情仍可独立查看。
    if (value.value.items[0]) void select(value.value.items[0].versionId)
  } catch (failure) { const parsed = apiErrorDetails(failure); if (turn === generation && !parsed.cancelled) error.value = parsed.message }
  finally { if (turn === generation) loading.value = false }
}
watch([() => route.params.skillId, () => user.token], () => load(true), { immediate: true })
onBeforeUnmount(() => { generation++; detailGeneration++; controller.abort(); detailController.abort() })
</script>
<template>
  <section class="versions-page">
    <nav class="breadcrumb" aria-label="面包屑">
      <router-link to="/skills/mine">我的发布</router-link><span>/</span><span>版本管理</span>
    </nav>
    <header class="page-heading">
      <div class="entity">
        <span class="page-icon"><HistoryOutlined /></span>
        <div><h1>版本管理</h1><p class="skill-slug">{{ name }}<span v-if="workspace?.slug && workspace.slug !== name"> / {{ workspace.slug }}</span></p></div>
      </div>
      <div class="heading-actions">
        <router-link :to="`/skills/${skillId}`" custom v-slot="{ href, navigate }">
          <a-button :href="href" @click="navigate">查看公开页 <ExportOutlined /></a-button>
        </router-link>
        <router-link v-if="workspace?.skillStatus === 'ACTIVE'" :to="`/skills/${skillId}/publish`" custom v-slot="{ href, navigate }">
          <a-button type="primary" :href="href" @click="navigate"><PlusOutlined />发布新版</a-button>
        </router-link>
      </div>
    </header>
    <a-alert v-if="workspace?.skillStatus === 'OWNER_UNPUBLISHED'" type="warning" show-icon message="此 Skill 已下架，历史可读，当前不能准备或发布新版。" />
    <a-alert v-if="error" type="error" show-icon :message="error">
      <template #action><a-button @click="load(true)">重试</a-button></template>
    </a-alert>
    <a-spin :spinning="loading">
      <div v-if="timeline" class="version-layout">
        <aside class="timeline-card card">
          <header class="timeline-heading">
            <div class="timeline-label"><h2>版本历史</h2><span class="history-count">{{ timeline.total }}</span></div>
            <a-button type="text" shape="circle" :loading="loading" aria-label="刷新版本列表" title="刷新版本列表" @click="load(true)">
              <ReloadOutlined />
            </a-button>
          </header>
          <ol class="timeline">
            <li v-for="node in timeline.items" :key="node.versionId">
              <button class="timeline-node" :class="{ selected: selected?.versionId === node.versionId }"
                :aria-pressed="selected?.versionId === node.versionId" @click="select(node.versionId)">
                <div class="node-title">
                  <strong>{{ node.version }}</strong>
                  <span v-if="node.currentRelease" class="type current">当前公开</span>
                  <span v-else class="type" :class="node.type.toLowerCase()">{{ node.type === 'DRAFT' ? '草稿' : '正式版' }}</span>
                </div>
                <div class="node-meta">
                  <time :datetime="node.publishedAt">{{ date(node.publishedAt) }}</time>
                  <span>{{ sourceLabel(node.source) }}</span>
                </div>
                <p class="node-notes">{{ node.releaseNotes }}</p>
                <div v-if="node.baseVersionId" class="node-diff">
                  <span>相对 {{ node.baseVersion || '基准不可用' }}</span>
                  <span v-if="node.diffSummaryStatus === 'READY'" class="node-counts">
                    <span class="added">+{{ node.addedCount }}</span>
                    <span class="modified">~{{ node.modifiedCount }}</span>
                    <span class="deleted">−{{ node.deletedCount }}</span>
                  </span>
                  <span v-else>摘要不可用</span>
                </div>
                <p v-if="node.usedByVersion" class="used-by">已用于发布 {{ node.usedByVersion }}</p>
              </button>
            </li>
          </ol>
          <div v-if="timeline.total > timeline.size" class="timeline-footer">
            <a-pagination v-model:current="page" :total="timeline.total" :page-size="20" :show-size-changer="false" simple @change="load()" />
          </div>
        </aside>
        <article class="version-detail card">
          <a-spin :spinning="reading">
            <a-alert v-if="detailError" type="error" show-icon :message="detailError" />
            <template v-else-if="selected">
              <header class="detail-heading">
                <div class="detail-title">
                  <div class="version-identity">
                    <h2>{{ selected.version }}</h2>
                    <a-tag v-if="selected.currentRelease" color="green">当前公开</a-tag>
                    <a-tag v-else-if="selected.type === 'DRAFT'" color="gold">草稿 · 仅自己可见</a-tag>
                    <a-tag v-else>正式版</a-tag>
                  </div>
                  <div class="detail-actions">
                    <router-link v-if="selected.canPublish" :to="`/skills/${skillId}/publish?mode=LATEST_DRAFT`" custom v-slot="{ href, navigate }">
                      <a-button type="primary" :href="href" @click="navigate">以最新草稿发布正式版</a-button>
                    </router-link>
                  </div>
                </div>
                <p class="published-time">
                  {{ date(selected.publishedAt) }}
                  <span v-if="selected.sourceDraftVersion"> · 发布自 {{ selected.sourceDraftVersion }}</span>
                  <span v-if="selected.usedByVersion"> · 已用于发布 {{ selected.usedByVersion }}</span>
                  <span class="source-fact">{{ sourceLabel(selected.source) }}</span>
                </p>
                <div class="release-note"><span class="note-label">更新说明</span><p>{{ selected.releaseNotes }}</p></div>
                <div v-if="selected.baseVersionId && selected.diffSummaryStatus === 'READY'" class="diff-counts">
                  <span>相对 {{ selected.baseVersion || '基准信息不可用' }}</span>
                  <span class="added">+ {{ selected.addedCount }} 新增</span>
                  <span class="modified">~ {{ selected.modifiedCount }} 修改</span>
                  <span class="deleted">− {{ selected.deletedCount }} 删除</span>
                </div>
                <p v-else-if="selected.baseVersionId" class="published-time">历史比较摘要不可用</p>
              </header>
              <nav class="detail-tabs" aria-label="版本内容">
                <button type="button" :aria-pressed="tab === 'files'" @click="tab = 'files'">版本文件</button>
                <button type="button" :aria-pressed="tab === 'information'" @click="tab = 'information'">版本信息</button>
              </nav>
              <template v-if="tab === 'files'">
                <SkillVersionFiles v-if="selected.filesAvailable" :key="`${selected.versionId}:${user.token}`"
                  :skill-id="skillId" :target="{ versionId: selected.versionId }" />
                <a-alert v-else type="warning" show-icon message="此节点文件当前不可访问，历史记录仍保留。" />
              </template>
              <section v-else class="version-information">
                <dl v-if="selected.metadata" class="information">
                  <dt>名称</dt><dd>{{ selected.metadata.name }}</dd>
                  <dt>简介</dt><dd>{{ selected.metadata.summary }}</dd>
                  <dt>分类 / 标签</dt><dd>{{ selected.metadata.categoryId }} · {{ selected.metadata.tags.join('、') || '无' }}</dd>
                  <dt>原作者 / 许可</dt><dd>{{ selected.metadata.originalAuthor }} · {{ selected.metadata.license }}</dd>
                  <dt>来源链接</dt><dd>{{ selected.metadata.sourceUrl || '未提供' }}</dd>
                  <dt>兼容环境</dt><dd>{{ selected.metadata.compatibility }}</dd>
                  <dt>依赖与费用声明</dt><dd>{{ selected.metadata.dependencies }}</dd>
                </dl>
                <SkillSourceSummary v-if="selected.source" :source="selected.source" />
              </section>
            </template>
            <a-empty v-else-if="!reading" description="选择一个版本查看详情" class="empty" />
          </a-spin>
        </article>
      </div>
      <a-empty v-else-if="!loading && !error" description="暂无版本记录" />
    </a-spin>
  </section>
</template>
<style scoped lang="scss">
.versions-page { @include skill-page-typography($font-size-body, $font-size-caption); max-width: 1440px; margin: 0 auto; }
.breadcrumb { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 20px; color: $color-text-tertiary; font-size: $font-size-caption; }
.breadcrumb a { color: $color-text-secondary; &:hover { color: $color-primary; } }
.page-heading { display: flex; align-items: center; justify-content: space-between; gap: 20px; margin-bottom: 24px; }
.entity { display: flex; align-items: center; gap: 14px; min-width: 0; }
.page-icon { display: grid; place-items: center; flex: none; width: 44px; height: 44px; background: $color-primary-bg; color: $color-primary; border-radius: $radius-card; font-size: 22px; }
h1 { margin: 0; color: $color-text-primary; font-size: $font-size-title; font-weight: 600; line-height: 1.4; }
.skill-slug { margin: 3px 0 0; color: $color-text-secondary; overflow-wrap: anywhere; }.skill-slug > span { color: $color-text-tertiary; }
.heading-actions, .detail-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; flex: none; }
.versions-page > .ant-alert { margin-bottom: 16px; }
.version-layout { display: grid; grid-template-columns: 272px minmax(0, 1fr); gap: 20px; align-items: start; }
.card { min-width: 0; background: $color-bg; border: 1px solid $color-border; border-radius: $radius-card; overflow: hidden; }
.timeline-card { position: sticky; top: 0; }
.timeline-heading { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-bottom: 1px solid $color-border; }
.timeline-label { display: flex; align-items: center; gap: 8px; }.timeline-heading h2 { margin: 0; color: $color-text-primary; font-size: $font-size-body; font-weight: 600; }
.history-count { min-width: 22px; padding: 0 6px; border: 1px solid $color-border; border-radius: 4px; color: $color-text-secondary; background: $color-bg-secondary; font-size: $font-size-caption; text-align: center; }
.timeline { list-style: none; padding: 8px; margin: 0; max-height: calc(100vh - 266px); overflow-y: auto; }
.timeline li + li { margin-top: 4px; }
.timeline-node { position: relative; display: block; width: 100%; padding: 14px 12px 14px 28px; border: 1px solid transparent; border-radius: $radius-input; background: transparent; color: $color-text-primary; text-align: left; cursor: pointer; }
.timeline-node::before { content: ''; position: absolute; left: 12px; top: 21px; width: 6px; height: 6px; border-radius: 50%; background: $color-border-input; }
.timeline-node:hover { background: $color-bg-hover; }
.timeline-node.selected { background: $color-primary-bg; border-color: theme-alpha('link', .2); }
.timeline-node.selected::before { background: $color-primary; box-shadow: 0 0 0 3px theme-alpha('link', .09); }
.timeline-node:focus-visible, .detail-tabs button:focus-visible { outline: 2px solid $color-focus; outline-offset: -2px; }
.node-title { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 6px; margin-bottom: 6px; }.node-title strong { font-size: $font-size-body; font-weight: 600; overflow-wrap: anywhere; }
.type { padding: 1px 6px; border-radius: 4px; font-size: $font-size-caption; background: $color-bg-secondary; color: $color-text-secondary; }.type.draft { color: $color-warning; background: theme-alpha('warning', .09); }.type.current { color: $color-success; background: theme-alpha('success', .09); }
.node-meta { display: grid; gap: 3px; color: $color-text-tertiary; font-size: $font-size-caption; overflow-wrap: anywhere; }
.node-notes { margin: 10px 0; color: $color-text-secondary; font-size: $font-size-caption; line-height: 1.7; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; white-space: pre-wrap; overflow-wrap: anywhere; }
.node-diff { display: flex; align-items: baseline; justify-content: space-between; flex-wrap: wrap; gap: 4px 8px; color: $color-text-tertiary; font-size: $font-size-caption; }.node-counts { display: flex; gap: 8px; font-variant-numeric: tabular-nums; }
.used-by { margin: 8px 0 0; color: $color-text-tertiary; font-size: $font-size-caption; }.node-notes:last-child { margin-bottom: 0; }
.added { color: $color-success; }.modified { color: $color-primary; }.deleted { color: $color-danger; }
.timeline-footer { display: flex; justify-content: center; padding: 16px; border-top: 1px solid $color-border; }
.detail-heading { padding: 24px 24px 20px; }
.detail-title { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
.version-identity { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; }.version-identity h2 { margin: 0; font-size: $font-size-h2; font-weight: 600; line-height: 1.4; color: $color-text-primary; overflow-wrap: anywhere; }.version-identity .ant-tag { margin: 0; }
.published-time { display: flex; align-items: baseline; flex-wrap: wrap; gap: 4px 12px; margin: 8px 0 0; color: $color-text-tertiary; font-size: $font-size-caption; overflow-wrap: anywhere; }.source-fact { border-left: 1px solid $color-border; padding-left: 12px; }
.release-note { margin: 20px 0 16px; }.note-label { display: block; margin-bottom: 6px; color: $color-text-tertiary; font-size: $font-size-caption; }.release-note p { margin: 0; color: $color-text-primary; line-height: 1.8; white-space: pre-wrap; overflow-wrap: anywhere; }
.diff-counts { display: flex; align-items: center; flex-wrap: wrap; gap: 8px 16px; font-size: $font-size-caption; }.diff-counts > span:first-child { color: $color-text-tertiary; }
.detail-tabs { display: flex; gap: 24px; padding: 0 24px; border-top: 1px solid $color-border; background: $color-bg; }
.detail-tabs button { padding: 13px 0; border: 0; border-bottom: 2px solid transparent; background: transparent; color: $color-text-secondary; font-size: $font-size-body; cursor: pointer; }
.detail-tabs button[aria-pressed='true'] { color: $color-primary; border-bottom-color: $color-primary; font-weight: 500; }
.version-information { padding: 24px; border-top: 1px solid $color-border; }.information { display: grid; grid-template-columns: 112px minmax(0, 1fr); gap: 18px 20px; margin: 0; }.information dt { color: $color-text-secondary; }.information dd { margin: 0; color: $color-text-primary; white-space: pre-wrap; overflow-wrap: anywhere; }
.empty { padding: 80px 20px; }
@media (max-width: 1100px) { .version-layout { grid-template-columns: 240px minmax(0, 1fr); gap: 16px; }.detail-heading, .version-information { padding: 20px; } }
@media (max-width: 900px) { .version-layout { grid-template-columns: 1fr; }.timeline-card { position: static; }.timeline { display: flex; gap: 8px; max-height: 250px; }.timeline li { flex: 0 0 240px; }.timeline li + li { margin: 0; }.timeline-node { height: 100%; }.timeline-heading { padding: 8px 16px; } }
@media (max-width: 600px) { .page-heading { align-items: flex-start; flex-direction: column; gap: 16px; }.breadcrumb { margin-bottom: 16px; }.page-icon { width: 40px; height: 40px; }.heading-actions { width: 100%; }.detail-heading, .version-information { padding: 16px; }.detail-tabs { padding: 0 16px; }.information { grid-template-columns: 1fr; gap: 6px; }.information dd + dt { margin-top: 10px; } }
</style>
