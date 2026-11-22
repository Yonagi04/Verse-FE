<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { DownloadOutlined, ArrowLeftOutlined, HistoryOutlined, PlusOutlined } from '@ant-design/icons-vue'
import { skillDetail, skillDownload, skillOptions, readSkillArchive } from '@/api/skill'
import type { SkillDetail, SkillOptions } from '@/types/skill'
import { apiErrorDetails } from '@/utils/apiError'
import { safeSkillDownloadPath, skillBytes } from '@/utils/skill'
import SkillMarkdown from './SkillMarkdown.vue'
import SkillCommentSection from './SkillCommentSection.vue'
import SkillSourceSummary from './SkillSourceSummary.vue'
import SkillFileBrowser from './SkillFileBrowser.vue'
import { getToken } from '@/utils/auth'
import { handleExpiredSession } from '@/api/request'
import { useUserStore } from '@/stores/user'
import { useSkillFavoriteStore } from '@/stores/skillFavorite'
import { skillReturnPath } from '@/utils/skillFavorite'
import SkillFavoriteButton from './favorites/SkillFavoriteButton.vue'
const route = useRoute()
const user = useUserStore()
const favorites = useSkillFavoriteStore()
const returnTo = computed(() => skillReturnPath(route.query?.returnTo))
const detail = ref<SkillDetail>()
const options = ref<SkillOptions>()
const loading = ref(false)
const downloading = ref(false)
const error = ref('')
const downloadError = ref('')
const activeTab = ref<'introduction' | 'files' | 'comments'>('introduction')
const visitedFiles = ref(false)
const visitedComments = ref(false)
const tabs = [{ key: 'introduction', label: '介绍' }, { key: 'files', label: '文件' }, { key: 'comments', label: '评论' }] as const
function changeTab(tab: typeof activeTab.value) {
  activeTab.value = tab
  if (tab === 'files') visitedFiles.value = true
  if (tab === 'comments') visitedComments.value = true
}
function moveTab(event: KeyboardEvent, index: number) {
  let next: number
  if (event.key === 'ArrowRight') next = (index + 1) % tabs.length
  else if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length
  else if (event.key === 'Home') next = 0
  else if (event.key === 'End') next = tabs.length - 1
  else return
  event.preventDefault()
  changeTab(tabs[next]!.key)
  const buttons = (event.currentTarget as HTMLElement).parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
  buttons?.[next]?.focus()
}
let controller: AbortController | undefined
let sequence = 0
const available = computed(() => detail.value?.availability === 'AVAILABLE')
async function load() {
  controller?.abort(); controller = new AbortController()
  const turn = ++sequence
  const token = getToken()
  void favorites.loadStatuses([String(route.params.skillId)])
  loading.value = true; error.value = ''; detail.value = undefined; downloadError.value = ''; downloading.value = false
  activeTab.value = 'introduction'; visitedFiles.value = false; visitedComments.value = false
  try {
    const [value, vocabulary] = await Promise.all([skillDetail(String(route.params.skillId), controller.signal), skillOptions(controller.signal)])
    if (turn === sequence && token === getToken()) { detail.value = value; options.value = vocabulary }
  } catch (failure) { const parsed = apiErrorDetails(failure); if (turn === sequence && !parsed.cancelled) error.value = parsed.message }
  finally { if (turn === sequence) loading.value = false }
}
async function download() {
  const skill = detail.value?.skill
  if (!skill || downloading.value) return
  const turn = sequence
  const sessionToken = getToken()
  if (!sessionToken) { handleExpiredSession(sessionToken); return }
  const signal = controller?.signal
  const current = () => turn === sequence && sessionToken === getToken() && !signal?.aborted
  downloading.value = true; downloadError.value = ''
  try {
    const grant = await skillDownload(skill.skillId, skill.versionId, signal)
    if (!current()) return
    if (!safeSkillDownloadPath(grant.downloadUrl)) throw new Error('下载地址不合法')
    const blob = await readSkillArchive(grant.downloadUrl, options.value!.maxArchiveBytes, signal, sessionToken)
    if (!current()) return
    const bytes = await blob.arrayBuffer()
    if (!current()) return
    const digest = await crypto.subtle.digest('SHA-256', bytes)
    const sha256 = [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('')
    if (sha256 !== grant.sha256) throw new Error('下载包摘要不匹配，请重试')
    if (!current()) return
    const objectUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = objectUrl; link.referrerPolicy = 'no-referrer'; link.download = `${skill.slug}-${skill.version}.zip`
    document.body.appendChild(link); link.click(); link.remove()
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
  } catch (failure) { const parsed = apiErrorDetails(failure); if (turn === sequence && !parsed.cancelled) downloadError.value = parsed.message }
  finally { if (turn === sequence) downloading.value = false }
}
watch([() => route.params.skillId, () => user.token, () => favorites.revision], load, { immediate: true })
onBeforeUnmount(() => { sequence++; controller?.abort() })
</script>
<template>
  <section class="detail-page">
    <router-link :to="returnTo" class="back"><ArrowLeftOutlined /> {{ returnTo.startsWith('/skills/favorites') ? '返回我的收藏' : '返回 Skill 广场' }}</router-link>
    <a-alert v-if="error" show-icon type="error" :message="error"><template #action><a-button @click="load">重试</a-button></template></a-alert>
    <a-spin :spinning="loading"><div v-if="detail" class="detail-layout">
      <div class="main-panel">
        <header v-if="available"><a-tag>{{ options?.categories.find(item => item.id === detail?.skill.categoryId)?.name || detail.skill.categoryId }}</a-tag>
          <div class="detail-title-row">
            <h1>{{ detail.skill.name }}</h1>
            <div v-if="detail.canManage" class="owner-actions">
              <router-link :to="`/skills/${detail.skill.skillId}/versions`" custom v-slot="{ href, navigate }">
                <a-button :href="href" @click="navigate"><HistoryOutlined />版本管理</a-button>
              </router-link>
              <router-link :to="`/skills/${detail.skill.skillId}/publish`" custom v-slot="{ href, navigate }">
                <a-button type="primary" :href="href" @click="navigate"><PlusOutlined />发布新版</a-button>
              </router-link>
            </div>
          </div>
          <p class="summary">{{ detail.skill.summary }}</p>
          <router-link :to="{ path: '/skills', query: { publisherId: detail.skill.publisher.publisherId } }">{{ detail.skill.publisher.publicName }}</router-link>
          <div class="tags"><a-tag v-for="tag in detail.skill.tags" :key="tag">{{ options?.tags.find(item => item.id === tag)?.name || tag }}</a-tag></div>
        </header>
        <a-alert v-if="!available" type="warning" show-icon message="此 Skill 当前不可用" description="内容已下架或暂停分发，正文与下载暂不可用。" />
        <section v-else class="detail-body" aria-label="Skill 正文">
          <div class="detail-tabs" role="tablist" aria-label="详情内容">
            <button v-for="(tab, index) in tabs" :id="'skill-tab-' + tab.key" :key="tab.key" type="button" role="tab"
              :aria-selected="activeTab === tab.key" :aria-controls="'skill-panel-' + tab.key" :tabindex="activeTab === tab.key ? 0 : -1"
              @click="changeTab(tab.key)" @keydown="moveTab($event, index)">{{ tab.label }}</button>
          </div>
          <div v-show="activeTab === 'introduction'" id="skill-panel-introduction" role="tabpanel" aria-labelledby="skill-tab-introduction">
            <h2>SKILL.md</h2><p class="reading-note">包内文档仅供阅读，图片和链接不会自动加载。使用前请检查包内脚本和依赖。</p><SkillMarkdown :text="detail.skillMarkdown || ''" />
          </div>
          <div v-show="activeTab === 'files'" id="skill-panel-files" role="tabpanel" aria-labelledby="skill-tab-files">
            <SkillFileBrowser v-if="visitedFiles" :key="detail.skill.skillId + ':' + detail.skill.versionId + ':' + user.token" :skill-id="detail.skill.skillId" :version-id="detail.skill.versionId" />
          </div>
          <div v-show="activeTab === 'comments'" id="skill-panel-comments" role="tabpanel" aria-labelledby="skill-tab-comments">
            <SkillCommentSection v-if="visitedComments" :key="detail.skill.skillId + ':' + user.token" :skill-id="detail.skill.skillId" />
          </div>
        </section>
      </div>
      <aside class="detail-sidebar">
        <div v-if="available" class="download-panel"><span class="label">当前版本</span><strong>{{ detail.skill.version }}</strong><div>{{ skillBytes(detail.archiveBytes) }} · ZIP</div>
          <div class="download-actions">
            <a-button block type="primary" size="large" :loading="downloading" :disabled="!available || !options" @click="download"><DownloadOutlined /> 下载 Skill</a-button>
            <SkillFavoriteButton :skill-id="detail.skill.skillId" :name="detail.skill.name" />
          </div>
          <a-alert v-if="downloadError" type="error" :message="downloadError" show-icon />
          <small>下载前会重新检查版本可用性。</small>
        </div>
        <SkillFavoriteButton v-else :skill-id="String(route.params.skillId)" :available="false" />
        <a-alert v-if="favorites.readError" type="error" :message="favorites.readError"><template #action><a-button @click="favorites.loadStatuses([String(route.params.skillId)])">重试</a-button></template></a-alert>
        <section v-if="available && detail.source" class="source-panel">
          <h3>Skill 来源</h3>
          <SkillSourceSummary :source="detail.source" />
        </section>
        <div v-if="available" class="declarations"><h3>作者声明</h3><dl><dt>许可证</dt><dd>{{ detail.license }}</dd><dt>兼容环境</dt><dd>{{ detail.compatibility || '无' }}</dd><dt>依赖</dt><dd>{{ detail.dependencies || '无' }}</dd><dt v-if="detail.originalAuthor">原作者</dt><dd v-if="detail.originalAuthor">{{ detail.originalAuthor }}</dd><dt v-if="detail.sourceUrl">来源</dt><dd v-if="detail.sourceUrl">{{ detail.sourceUrl }}</dd></dl><h3>SHA-256</h3><code>{{ detail.sha256 }}</code></div>
      </aside>
    </div><div v-else class="loading-space" /></a-spin>
  </section>
</template>
<style lang="scss" scoped>
.detail-page { @include skill-page-typography; max-width: 1200px; margin: 0 auto; }.back { display: inline-flex; align-items: center; gap: 8px; margin: 4px 0 24px; }
.detail-tabs { display: flex; gap: 24px; border-bottom: 1px solid $color-border; margin-bottom: 24px; }.detail-tabs button { padding: 0 4px 14px; border: 0; border-bottom: 2px solid transparent; background: transparent; color: $color-text-secondary; font-size: $skill-font-size-body; cursor: pointer; }.detail-tabs button[aria-selected="true"] { color: $color-primary; border-bottom-color: $color-primary; font-weight: 600; }.detail-body :deep(.skill-comments) { margin: 0; padding: 0; border: 0; }
.detail-title-row { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px 24px; margin: 15px 0; }.detail-title-row h1 { flex: 1; min-width: 220px; margin: 0; }.owner-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 12px; }.detail-sidebar { display: grid; gap: 20px; align-content: start; }
.detail-layout { display: grid; grid-template-columns: minmax(0, 1fr) 310px; gap: 24px; }.main-panel, .download-panel, .declarations, .source-panel { border: 1px solid $color-border; border-radius: $radius-card; padding: 28px; background: $color-bg; min-width: 0; }
.source-panel { padding: 22px; }.source-panel h3 { margin: 0 0 14px; }.source-panel :deep(.source-summary) { margin: 0; padding: 0; border: 0; background: transparent; border-radius: 0; }
header { margin-bottom: 24px; }h1 { font-size: 32px; line-height: 1.3; margin: 15px 0; overflow-wrap: anywhere; color: $color-text-primary; }.summary { font-size: $skill-font-size-body; line-height: 1.8; color: $color-text-secondary; }header a span, .reading-note { color: $color-text-tertiary; font-size: $skill-font-size-secondary; }.tags { margin-top: 18px; }
h2 { font-size: 22px; color: $color-text-primary; }.download-panel strong { display: block; font-size: 27px; margin: 10px 0; }.label, .download-panel div, .download-panel p, small { color: $color-text-secondary; font-size: $skill-font-size-secondary; }.download-actions { display: grid; gap: 10px; margin: 22px 0 12px; }.download-panel small { display: block; line-height: 1.7; }.declarations { padding: 22px; }h3 { font-size: 18px; }dl { line-height: 1.7; }dt { color: $color-text-tertiary; font-size: $skill-font-size-secondary; }dd { margin: 4px 0 16px; overflow-wrap: anywhere; }.declarations code { font-size: $skill-font-size-secondary; overflow-wrap: anywhere; color: $color-text-secondary; }.loading-space { min-height: 280px; }
@media(max-width: 850px) { .detail-layout { grid-template-columns: 1fr; }aside { grid-row: 1; }.main-panel { padding: 20px; } }
</style>
