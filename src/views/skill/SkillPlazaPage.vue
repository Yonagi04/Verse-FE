<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { SearchOutlined, ArrowRightOutlined, CodeOutlined } from '@ant-design/icons-vue'
import { searchSkills, skillOptions } from '@/api/skill'
import type { SkillCard, SkillOptions, SkillPage } from '@/types/skill'
import { skillSearchFromUrl, skillSearchToUrl } from '@/utils/skill'
import { apiErrorDetails } from '@/utils/apiError'
const route = useRoute()
const router = useRouter()
const options = ref<SkillOptions>()
const page = ref<SkillPage<SkillCard>>()
const loading = ref(false)
const error = ref('')
const search = ref('')
const query = computed(() => skillSearchFromUrl(route.query))
let current: AbortController | undefined
let sequence = 0
async function load() {
  current?.abort()
  current = new AbortController()
  const turn = ++sequence
  loading.value = true
  error.value = ''
  search.value = query.value.keyword || ''
  try {
    const [result, taxonomy] = await Promise.all([
      searchSkills(query.value, current.signal),
      options.value ? Promise.resolve(options.value) : skillOptions(current.signal),
    ])
    if (turn === sequence) { page.value = result; options.value = taxonomy }
  } catch (failure) {
    const detail = apiErrorDetails(failure)
    if (turn === sequence && !detail.cancelled) {
      error.value = detail.uncertain || !/^[AB]\d{6}$/.test(detail.code || '')
        ? 'Skill 广场暂时无法加载，请稍后重试' : detail.message
    }
  } finally { if (turn === sequence) loading.value = false }
}
function filter(values: Partial<ReturnType<typeof skillSearchFromUrl>>) {
  void router.push({ path: '/skills', query: skillSearchToUrl({ ...query.value, ...values, page: values.page || 1 }) })
}
const nameFor = (id: string) => options.value?.categories.find(item => item.id === id)?.name || id
watch(() => route.fullPath, load, { immediate: true })
onBeforeUnmount(() => { sequence++; current?.abort() })
</script>
<template>
  <section class="plaza">
    <header class="heading"><div><div class="eyebrow">SKILLS</div><h1>Skill 广场</h1><p>发现、阅读并下载社区分享的 Skill，给你的智能体更多可能。</p></div>
      <router-link to="/skills/publish" custom v-slot="{ href, navigate }"><a-button type="primary" :href="href" @click="navigate">发布 Skill <ArrowRightOutlined /></a-button></router-link>
    </header>
    <div class="toolbar">
      <a-input-search v-model:value="search" :maxlength="80" placeholder="搜索 Skill 名称或作者" size="large" allow-clear @search="filter({ keyword: search })"><template #prefix><SearchOutlined /></template></a-input-search>
      <a-select :value="query.sort || 'relevance'" aria-label="排序" @change="(value: unknown) => filter({ sort: String(value) })" :options="[{ value: 'relevance', label: '相关优先' }, { value: 'updated', label: '最新发布' }]" />
    </div>
    <div class="filters">
      <a-select :value="query.source" allow-clear placeholder="全部来源" aria-label="来源"
        :options="[{ value: 'ZIP', label: 'ZIP 上传' }, { value: 'GITHUB', label: 'GitHub 导入' }]"
        @change="(value: unknown) => filter({ source: value ? String(value) : undefined })" />
      <a-select :value="query.category" allow-clear placeholder="全部分类" aria-label="分类" :options="options?.categories.map(item => ({ value: item.id, label: item.name }))" @change="(value: unknown) => filter({ category: value ? String(value) : undefined })" />
      <a-select mode="multiple" :value="query.tags || []" :max-tag-count="3" allow-clear placeholder="筛选标签（任一匹配）" aria-label="标签" :options="options?.tags.map(item => ({ value: item.id, label: item.name }))" @change="(value: unknown) => filter({ tags: (value as string[]).slice(0, 5) })" />
      <a-tag v-if="query.publisherId" closable @close="filter({ publisherId: undefined })">指定作者</a-tag>
      <span class="count" aria-live="polite">{{ loading ? '正在查找…' : error ? '' : `${page?.total || 0} 个 Skill` }}</span>
    </div>
    <a-alert v-if="error" type="error" show-icon :message="error"><template #action><a-button size="small" @click="load">重试</a-button></template></a-alert>
    <a-spin :spinning="loading">
      <div v-if="!error && page?.items.length" class="grid">
        <router-link v-for="skill in page.items" :key="skill.skillId" class="skill-card" :to="`/skills/${skill.skillId}`">
          <div class="card-top"><span class="skill-icon"><CodeOutlined /></span><span>{{ nameFor(skill.categoryId) }}</span></div>
          <h2>{{ skill.name }}</h2><p>{{ skill.summary }}</p>
          <div class="tags"><a-tag v-for="tag in skill.tags" :key="tag">{{ options?.tags.find(item => item.id === tag)?.name || tag }}</a-tag></div>
          <footer><span>{{ skill.publisher.publicName }}</span><span>{{ skill.version }}</span></footer>
        </router-link>
      </div>
      <a-empty v-else-if="!loading && !error" description="暂无匹配的 Skill，试试其他关键词或分类" class="empty" />
      <div v-else class="empty" />
    </a-spin>
    <a-pagination v-if="!error && page && page.total > 0" :current="query.page" :page-size="query.size" :total="page.total" :show-size-changer="false" @change="(value: number) => filter({ page: value })" />
  </section>
</template>
<style lang="scss" scoped>
.plaza { max-width: 1200px; margin: 0 auto; }
.heading { display: flex; align-items: center; justify-content: space-between; gap: 24px; margin: 20px 0 30px; }
.eyebrow { color: $color-primary; letter-spacing: .16em; font-size: 11px; font-weight: 700; }
h1 { font-size: clamp(24px, 2.7vw, 34px); margin: 12px 0; font-weight: 650; letter-spacing: -.04em; color: $color-text-primary; }
.heading p { color: $color-text-secondary; margin: 0; }
.toolbar { display: flex; align-items: center; gap: 12px; padding: 18px; background: $color-bg; border: 1px solid $color-border; border-radius: $radius-card; }
.toolbar > .ant-select { width: 126px; flex: none; }
.filters { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; margin: 20px 0; }
.filters > .ant-select:first-child { width: 150px; }.filters > .ant-select:nth-child(2) { min-width: 230px; }
.count { margin-left: auto; font-size: 12px; color: $color-text-tertiary; }
.grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 18px; margin-bottom: 24px; }
.skill-card { display: flex; flex-direction: column; min-width: 0; padding: 22px; border: 1px solid $color-border; border-radius: $radius-card; background: $color-bg; color: $color-text-primary; transition: border-color .15s; }
.skill-card:hover, .skill-card:focus-visible { border-color: $color-primary; }
.card-top { display: flex; justify-content: space-between; align-items: center; color: $color-text-secondary; font-size: 12px; }
.skill-icon { display: grid; place-items: center; width: 38px; height: 38px; border-radius: 10px; background: $color-primary-bg; color: $color-primary; font-size: 20px; }
h2 { font-size: 17px; margin: 18px 0 10px; overflow-wrap: anywhere; }.skill-card > p { color: $color-text-secondary; line-height: 1.7; min-height: 48px; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.tags { margin: auto 0 18px; padding-top: 6px; }footer { display: flex; justify-content: space-between; gap: 10px; padding-top: 16px; border-top: 1px solid $color-border; font-size: 12px; }footer small { display: block; color: $color-text-tertiary; }
.empty { min-height: 240px; padding: 50px 0; }
@media(max-width: 1050px) { .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media(max-width: 600px) { .heading { align-items: flex-start; flex-direction: column; }.grid { grid-template-columns: 1fr; }.toolbar { padding: 12px; }.toolbar > .ant-select { width: 108px; }.filters > .ant-select { flex: 1; }.count { width: 100%; margin: 0; } }
</style>
