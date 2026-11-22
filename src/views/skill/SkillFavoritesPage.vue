<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { LockOutlined, CodeOutlined, CalendarOutlined, FolderOutlined } from '@ant-design/icons-vue'
import { favoritePage } from '@/api/skillFavorite'
import { skillOptions } from '@/api/skill'
import { useSkillFavoriteStore } from '@/stores/skillFavorite'
import { useUserStore } from '@/stores/user'
import { getToken } from '@/utils/auth'
import { apiErrorDetails } from '@/utils/apiError'
import { favoriteQueryFromUrl, favoriteQueryToUrl, skillReleaseDate } from '@/utils/skillFavorite'
import type { FavoritePage, FavoriteQuery } from '@/types/skillFavorite'
import type { SkillOptions } from '@/types/skill'
import SkillFavoriteFolders from './favorites/SkillFavoriteFolders.vue'
import SkillFavoriteButton from './favorites/SkillFavoriteButton.vue'
const route = useRoute(), router = useRouter(), store = useSkillFavoriteStore(), user = useUserStore()
const query = computed(() => favoriteQueryFromUrl(route.query))
const result = ref<FavoritePage>(), options = ref<SkillOptions>()
const search = ref(''), error = ref(''), loading = ref(false)
const heading = computed(() => query.value.folderId === undefined ? '全部收藏' : store.folders?.folders.find(item => item.folderId === query.value.folderId)?.name || '收藏夹')
let controller: AbortController | undefined, turn = 0
function filter(values: Partial<FavoriteQuery>, replace = false) {
  const location = { path: '/skills/favorites', query: favoriteQueryToUrl({ ...query.value, ...values, page: values.page ?? 1 }) }
  return replace ? router.replace(location) : router.push(location)
}
async function load() {
  controller?.abort(); controller = new AbortController()
  const generation = ++turn, token = getToken(), current = query.value
  const alive = () => generation === turn && !!token && token === getToken()
  loading.value = true; error.value = ''; search.value = current.keyword || ''
  if (!token) { result.value = undefined; loading.value = false; return }
  try {
    const [page, vocabulary] = await Promise.all([favoritePage(current, controller.signal),
      options.value ? Promise.resolve(options.value) : skillOptions(controller.signal)])
    if (!alive()) return
    const last = Math.max(1, Math.ceil(page.total / 12))
    if (current.page > last) { await filter({ page: last }, true); return }
    result.value = page; options.value = vocabulary; store.observeItems(page.items)
  } catch (failure) {
    if (!alive()) return
    const parsed = apiErrorDetails(failure)
    if (parsed.cancelled) return
    if (parsed.code === 'A001702' && current.folderId && current.folderId !== '0') {
      result.value = undefined
      store.noticeType = 'info'
      store.notice = '此收藏夹已不存在，已返回全部收藏'
      await store.loadFolders()
      if (alive()) await filter({ folderId: undefined, keyword: undefined }, true)
    } else error.value = '收藏暂时无法加载，请重试'
  } finally { if (alive()) loading.value = false }
}
function retry() { void store.loadFolders(); void load() }
watch([() => route.fullPath, () => store.revision, () => user.token], () => {
  if (!user.token) result.value = undefined
  if (store.deletedFolder && store.deletedFolder === query.value.folderId) {
    void filter({ folderId: '0', keyword: undefined }, true)
    store.deletedFolder = undefined
  } else void load()
}, { immediate: true })
watch(() => user.token, () => { result.value = undefined; void store.loadFolders() }, { immediate: true })
onBeforeUnmount(() => { turn++; controller?.abort() })
</script>
<template>
  <section class="favorites-page">
    <nav class="module-nav" aria-label="SkillHub"><router-link to="/skills">Skill 广场</router-link><router-link to="/skills/favorites" aria-current="page">我的收藏</router-link></nav>
    <header class="heading"><div><div class="eyebrow">MY COLLECTION</div><h1>我的收藏</h1><p>把有用的 Skill 收好，下次从这里继续。</p></div><span class="private-label"><LockOutlined /> 仅自己可见</span></header>
    <div class="collection-layout">
      <SkillFavoriteFolders :query="query" />
      <div class="collection-content">
        <div class="list-heading"><h2>{{ heading }}</h2><span aria-live="polite">{{ loading ? '正在加载…' : result && !error ? `${result.total} 个 Skill` : '—' }}</span></div>
        <div class="toolbar"><a-input-search :value="search" @update:value="(value: string) => search = Array.from(value).slice(0, 80).join('')" placeholder="搜索当前范围内的 Skill 名称" aria-label="搜索收藏名称" allow-clear @search="filter({ keyword: Array.from(search.trim()).slice(0, 80).join('') })" />
          <a-select :value="query.sort" aria-label="收藏排序" :options="[{ value: 'saved', label: '最近收藏' }, { value: 'updated', label: '最近更新' }]" @change="(value: unknown) => filter({ sort: value === 'updated' ? 'updated' : 'saved' })" /></div>
        <a-alert v-if="store.readError" type="error" :message="store.readError" show-icon><template #action><a-button @click="retry">重试</a-button></template></a-alert>
        <a-alert v-if="error" type="error" :message="error" show-icon><template #action><a-button @click="retry">重试</a-button></template></a-alert>
        <div v-if="loading && !result" class="grid" role="status" aria-label="收藏加载中"><a-card v-for="index in 4" :key="index" loading /></div>
        <a-spin v-else :spinning="loading">
          <div v-if="!error && result?.items.length" class="grid">
            <article v-for="item in result.items" :key="item.favoriteId" class="skill-card" :class="{ unavailable: item.availability !== 'AVAILABLE' }">
              <div class="card-top"><span class="skill-icon"><CodeOutlined /></span><SkillFavoriteButton :skill-id="item.skillId" :name="item.availability === 'AVAILABLE' ? item.skill?.name : undefined" :available="item.availability === 'AVAILABLE'" compact /></div>
              <template v-if="item.availability === 'AVAILABLE' && item.skill">
                <h3><router-link :to="{ path: `/skills/${item.skillId}`, query: { returnTo: route.fullPath } }">{{ item.skill.name }}</router-link></h3>
                <p class="description">{{ item.skill.summary }}</p>
                <div class="tags"><a-tag>{{ options?.categories.find(option => option.id === item.skill?.categoryId)?.name || item.skill.categoryId }}</a-tag><a-tag v-for="tag in item.skill.tags" :key="tag">{{ options?.tags.find(option => option.id === tag)?.name || tag }}</a-tag></div>
                <div class="card-meta"><span>{{ item.skill.publisher.publicName }}</span><span>{{ item.skill.version }}</span></div>
                <div class="date"><CalendarOutlined /> 最近更新 {{ skillReleaseDate(item.skill.publishedAt) }}</div>
              </template>
              <template v-else><h3>Skill 暂不可用</h3><p class="description">内容已下架或暂停分发</p><div class="unavailable-note">收藏仍保留，你可以移动或取消收藏。</div></template>
              <footer><FolderOutlined /><span>{{ item.folderName }}</span></footer>
            </article>
          </div>
          <a-empty v-else-if="!loading && !error && result" class="empty" :description="query.keyword ? `没有找到与“${query.keyword}”匹配的 Skill` : store.folders?.total === 0 ? '还没有收藏 Skill' : '这个收藏夹还是空的'">
            <a-button v-if="query.keyword" @click="filter({ keyword: undefined })">清空搜索</a-button>
            <router-link v-else to="/skills" custom v-slot="{ href, navigate }"><a-button type="primary" :href="href" @click="navigate">去 Skill 广场</a-button></router-link>
          </a-empty>
        </a-spin>
        <a-pagination v-if="!error && result && result.total > 0" :current="query.page" :page-size="12" :total="result.total" :show-size-changer="false" @change="(page: number) => filter({ page })" />
      </div>
    </div>
  </section>
</template>
<style lang="scss" scoped>
.favorites-page { @include skill-page-typography; max-width: 1200px; margin: 0 auto; }.module-nav { display: flex; gap: 24px; border-bottom: 1px solid $color-border; margin: 0 0 28px; }.module-nav a { padding: 0 2px 14px; color: $color-text-secondary; font-size: $skill-font-size-secondary; }.module-nav a[aria-current] { color: $color-primary; border-bottom: 2px solid $color-primary; font-weight: 600; }.heading { display: flex; justify-content: space-between; align-items: center; gap: 24px; margin-bottom: 28px; }.eyebrow { color: $color-primary; letter-spacing: .14em; font-size: $skill-font-size-secondary; font-weight: 700; }h1 { font-size: 32px; font-weight: 650; letter-spacing: -.7px; margin: 10px 0; }.heading p { color: $color-text-secondary; margin: 0; }.private-label { color: $color-text-secondary; font-size: $skill-font-size-secondary; white-space: nowrap; }.collection-layout { display: grid; grid-template-columns: 216px minmax(0, 1fr); gap: 24px; align-items: start; }.collection-content { min-width: 0; }.list-heading { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 16px; }.list-heading h2 { font-size: 18px; margin: 0; overflow-wrap: anywhere; }.list-heading span { color: $color-text-secondary; font-size: $skill-font-size-secondary; flex: none; }.toolbar { display: flex; gap: 12px; padding: 14px; border: 1px solid $color-border; border-radius: $radius-card; background: $color-bg; margin-bottom: 20px; }.toolbar > .ant-select { width: 126px; flex: none; }.grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; margin: 0 0 24px; }.skill-card { display: flex; flex-direction: column; min-width: 0; padding: 22px; border: 1px solid $color-border; border-radius: $radius-card; background: $color-bg; }.card-top { display: flex; justify-content: space-between; align-items: center; }.skill-icon { width: 38px; height: 38px; display: grid; place-items: center; border-radius: 10px; background: $color-primary-bg; color: $color-primary; font-size: 20px; }h3 { font-size: 18px; margin: 18px 0 10px; overflow-wrap: anywhere; }h3 a { color: $color-text-primary; }.description { color: $color-text-secondary; line-height: 1.7; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; min-height: 54px; margin: 0 0 16px; }.tags { margin: auto 0 18px; padding-top: 6px; }.tags :deep(.ant-tag) { margin-bottom: 6px; }.card-meta { display: flex; justify-content: space-between; gap: 10px; font-size: $skill-font-size-secondary; color: $color-text-secondary; }.date { display: flex; gap: 6px; color: $color-text-secondary; font-size: $skill-font-size-secondary; margin-top: 12px; }footer { display: flex; align-items: center; gap: 7px; border-top: 1px solid $color-border; padding-top: 14px; margin-top: 16px; font-size: $skill-font-size-secondary; color: $color-text-secondary; }footer span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.unavailable-note { margin: auto 0 12px; color: $color-text-tertiary; font-size: $skill-font-size-secondary; }.unavailable .skill-icon { background: $color-bg-secondary; color: $color-text-tertiary; }.empty { min-height: 300px; padding: 64px 20px; }.collection-content > .ant-alert { margin-bottom: 16px; }@media(min-width: 1600px) { .grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }@media(max-width: 1050px) { .collection-layout { grid-template-columns: 1fr; gap: 20px; } }@media(max-width: 600px) { .grid { grid-template-columns: 1fr; }.toolbar { flex-wrap: wrap; padding: 12px; }.toolbar > .ant-input-search { flex-basis: 100%; }.toolbar > .ant-select { margin-left: auto; }.heading { align-items: flex-start; gap: 12px; }h1 { font-size: 28px; }.heading p { font-size: $skill-font-size-secondary; }.private-label { font-size: 12px; margin-top: 6px; } }
</style>
