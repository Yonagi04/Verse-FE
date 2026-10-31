<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { DownloadOutlined, ArrowLeftOutlined } from '@ant-design/icons-vue'
import { skillDetail, skillDownload, skillOptions, readSkillArchive } from '@/api/skill'
import type { SkillDetail, SkillOptions } from '@/types/skill'
import { apiErrorDetails } from '@/utils/apiError'
import { safeSkillDownloadPath, skillBytes } from '@/utils/skill'
import SkillMarkdown from './SkillMarkdown.vue'
import SkillCommentSection from './SkillCommentSection.vue'
import { getToken } from '@/utils/auth'
import { handleExpiredSession } from '@/api/request'
import { useUserStore } from '@/stores/user'
const route = useRoute()
const user = useUserStore()
const detail = ref<SkillDetail>()
const options = ref<SkillOptions>()
const loading = ref(false)
const downloading = ref(false)
const error = ref('')
const downloadError = ref('')
let controller: AbortController | undefined
let sequence = 0
const available = computed(() => detail.value?.availability === 'AVAILABLE')
async function load() {
  controller?.abort(); controller = new AbortController()
  const turn = ++sequence
  loading.value = true; error.value = ''; detail.value = undefined; downloadError.value = ''; downloading.value = false
  try {
    const [value, vocabulary] = await Promise.all([skillDetail(String(route.params.skillId), controller.signal), skillOptions(controller.signal)])
    if (turn === sequence) { detail.value = value; options.value = vocabulary }
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
watch([() => route.params.skillId, () => user.token], load, { immediate: true })
onBeforeUnmount(() => { sequence++; controller?.abort() })
</script>
<template>
  <section class="detail-page">
    <router-link to="/skills" class="back"><ArrowLeftOutlined /> 返回 Skill 广场</router-link>
    <a-alert v-if="error" show-icon type="error" :message="error"><template #action><a-button @click="load">重试</a-button></template></a-alert>
    <a-spin :spinning="loading"><div v-if="detail" class="detail-layout">
      <div class="main-panel">
        <header><a-tag>{{ options?.categories.find(item => item.id === detail?.skill.categoryId)?.name || detail.skill.categoryId }}</a-tag><h1>{{ detail.skill.name }}</h1><p class="summary">{{ detail.skill.summary }}</p>
          <router-link :to="{ path: '/skills', query: { publisherId: detail.skill.publisher.publisherId } }">{{ detail.skill.publisher.publicName }}</router-link>
          <div class="tags"><a-tag v-for="tag in detail.skill.tags" :key="tag">{{ options?.tags.find(item => item.id === tag)?.name || tag }}</a-tag></div>
        </header>
        <a-alert v-if="!available" type="warning" show-icon message="此 Skill 当前不可用" description="内容已下架或暂停分发，正文与下载暂不可用。" />
        <template v-else><h2>SKILL.md</h2><p class="reading-note">包内文档仅供阅读，图片和链接不会自动加载。使用前请检查包内脚本和依赖。</p><SkillMarkdown :text="detail.skillMarkdown || ''" /></template>
      </div>
      <aside>
        <div class="download-panel"><span class="label">当前版本</span><strong>{{ detail.skill.version }}</strong><div>{{ skillBytes(detail.archiveBytes) }} · ZIP</div>
          <a-button block type="primary" size="large" :loading="downloading" :disabled="!available || !options" @click="download"><DownloadOutlined /> 下载 Skill</a-button>
          <a-alert v-if="downloadError" type="error" :message="downloadError" show-icon />
          <small>下载前会重新检查版本可用性。</small>
        </div>
        <div v-if="available" class="declarations"><h3>作者声明</h3><dl><dt>许可证</dt><dd>{{ detail.license }}</dd><dt>兼容环境</dt><dd>{{ detail.compatibility || '无' }}</dd><dt>依赖</dt><dd>{{ detail.dependencies || '无' }}</dd><dt v-if="detail.originalAuthor">原作者</dt><dd v-if="detail.originalAuthor">{{ detail.originalAuthor }}</dd><dt v-if="detail.sourceUrl">来源</dt><dd v-if="detail.sourceUrl">{{ detail.sourceUrl }}</dd></dl><h3>SHA-256</h3><code>{{ detail.sha256 }}</code></div>
      </aside>
    </div><div v-else class="loading-space" /></a-spin>
    <SkillCommentSection v-if="available && detail" :key="detail.skill.skillId + ':' + user.token" :skill-id="detail.skill.skillId" />
  </section>
</template>
<style lang="scss" scoped>
.detail-page { max-width: 1200px; margin: 0 auto; }.back { display: inline-flex; align-items: center; gap: 8px; margin: 4px 0 24px; }
.detail-layout { display: grid; grid-template-columns: minmax(0, 1fr) 290px; gap: 24px; }.main-panel, .download-panel, .declarations { border: 1px solid $color-border; border-radius: $radius-card; padding: 28px; background: $color-bg; min-width: 0; }
header { margin-bottom: 32px; padding-bottom: 24px; border-bottom: 1px solid $color-border; }h1 { font-size: 32px; line-height: 1.3; margin: 15px 0; overflow-wrap: anywhere; color: $color-text-primary; }.summary { font-size: 15px; line-height: 1.8; color: $color-text-secondary; }header a span, .reading-note { color: $color-text-tertiary; font-size: 12px; }.tags { margin-top: 18px; }
h2 { font-size: 17px; color: $color-text-primary; }.download-panel strong { display: block; font-size: 27px; margin: 10px 0; }.label, .download-panel div, .download-panel p, small { color: $color-text-secondary; font-size: 12px; }.download-panel .ant-btn { margin: 22px 0 12px; }.download-panel small { display: block; line-height: 1.7; }.declarations { padding: 22px; margin-top: 18px; }h3 { font-size: 13px; }dl { line-height: 1.7; }dt { color: $color-text-tertiary; font-size: 12px; }dd { margin: 4px 0 16px; overflow-wrap: anywhere; }.declarations code { font-size: 11px; overflow-wrap: anywhere; color: $color-text-secondary; }.loading-space { min-height: 280px; }
@media(max-width: 850px) { .detail-layout { grid-template-columns: 1fr; }aside { grid-row: 1; }.main-panel { padding: 20px; } }
</style>
