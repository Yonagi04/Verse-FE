<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { mySkills, unpublishSkill } from '@/api/skill'
import type { SkillMine, SkillPage } from '@/types/skill'
import { apiErrorDetails } from '@/utils/apiError'
import { skillStatusLabel } from '@/utils/skill'
const result = ref<SkillPage<SkillMine>>()
const page = ref(1)
const loading = ref(false)
const error = ref('')
const selected = ref<SkillMine>()
const reason = ref('')
const submitting = ref(false)
const modalError = ref('')
let request: AbortController | undefined
let generation = 0
let commandKey = ''
const mutation = new AbortController()
async function load() {
  request?.abort(); request = new AbortController()
  const turn = ++generation
  loading.value = true; error.value = ''
  try { const value = await mySkills(page.value, request.signal); if (turn === generation) result.value = value }
  catch (failure) { const parsed = apiErrorDetails(failure); if (turn === generation && !parsed.cancelled) error.value = parsed.message }
  finally { if (turn === generation) loading.value = false }
}
function confirmUnpublish(row: SkillMine) {
  selected.value = row; reason.value = ''; modalError.value = ''; commandKey = crypto.randomUUID()
}
async function unpublish() {
  if (!selected.value || submitting.value || !reason.value.trim()) return
  submitting.value = true; modalError.value = ''
  try {
    await unpublishSkill(selected.value.skillId, selected.value.revision, reason.value, commandKey, mutation.signal)
    selected.value = undefined
    await load()
  } catch (failure) { const parsed = apiErrorDetails(failure); if (!parsed.cancelled) modalError.value = parsed.message }
  finally { submitting.value = false }
}
void load()
onBeforeUnmount(() => { generation++; request?.abort(); mutation.abort() })
</script>
<template>
  <section class="mine-page">
    <header><div><router-link to="/skills">Skill 广场</router-link><h1>我的发布</h1><p>管理个人草稿和已分享内容，与当前租户无关。</p></div><router-link to="/skills/publish" custom v-slot="{ href, navigate }"><a-button type="primary" :href="href" @click="navigate">发布 Skill</a-button></router-link></header>
    <a-alert v-if="error" type="error" show-icon :message="error"><template #action><a-button @click="load">重试</a-button></template></a-alert>
    <a-spin :spinning="loading"><div v-if="!error && result?.items.length" class="publications">
      <article v-for="row in result.items" :key="row.skillId"><div class="row-info"><div><h2>{{ row.name }}</h2><a-tag :color="row.status === 'ACTIVE' ? 'green' : undefined">{{ skillStatusLabel(row.status) }}</a-tag></div><p>{{ row.slug }} <span v-if="row.version">· {{ row.version }}</span></p><small v-if="row.status === 'DRAFT'">{{ skillStatusLabel(row.draftStatus) }} <span v-if="row.jobStatus">· {{ skillStatusLabel(row.jobStatus) }}</span></small></div>
        <div class="row-actions"><router-link v-if="row.status !== 'DRAFT'" :to="`/skills/${row.skillId}`">查看公开页</router-link><router-link v-if="row.draftId && row.status === 'DRAFT' && !['CANCELLED', 'EXPIRED'].includes(row.draftStatus)" :to="`/skills/publish/${row.draftId}`">继续编辑</router-link><a-button v-if="row.status === 'ACTIVE'" danger size="small" @click="confirmUnpublish(row)">下架</a-button></div>
      </article>
    </div><a-empty v-else-if="!loading && !error" description="还没有发布内容，创建第一个 Skill 吧" class="empty" /><div v-else class="empty" /></a-spin>
    <a-pagination v-if="!error && result?.total" v-model:current="page" :total="result.total" :page-size="12" :show-size-changer="false" @change="load" />
    <a-modal :open="!!selected" title="下架 Skill" :confirm-loading="submitting" :ok-button-props="{ danger: true, disabled: !reason.trim() }" :cancel-button-props="{ disabled: submitting }" :closable="!submitting" :mask-closable="!submitting" ok-text="确认下架" @ok="unpublish" @cancel="selected = undefined">
      <p>「{{ selected?.name }}」将停止下载。已有包和发布记录保留，本版暂不支持恢复上架。</p><a-textarea v-model:value="reason" :maxlength="300" :rows="4" placeholder="请填写下架原因" :disabled="submitting" /><a-alert v-if="modalError" type="error" :message="modalError" show-icon class="modal-error" />
    </a-modal>
  </section>
</template>
<style lang="scss" scoped>
.mine-page { max-width: 1000px; margin: 0 auto; }header { display: flex; align-items: center; justify-content: space-between; gap: 18px; margin-bottom: 28px; }h1 { margin: 10px 0; font-size: 28px; color: $color-text-primary; }header p { color: $color-text-secondary; }.publications { border: 1px solid $color-border; border-radius: $radius-card; overflow: hidden; background: $color-bg; margin-bottom: 22px; }article { display: flex; gap: 20px; justify-content: space-between; padding: 24px; border-bottom: 1px solid $color-border; }article:last-child { border: 0; }.row-info { min-width: 0; }.row-info > div { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }h2 { font-size: 16px; margin: 0; color: $color-text-primary; overflow-wrap: anywhere; }.row-info p { color: $color-text-secondary; font-size: 12px; margin: 10px 0; }.row-info small { color: $color-text-tertiary; }.row-actions { display: flex; align-items: center; gap: 18px; flex: none; font-size: 12px; }.empty { min-height: 230px; padding: 60px 0; }.modal-error { margin-top: 16px; }:deep(textarea.ant-input) { resize: none; overflow-y: auto; }
@media(max-width: 600px) { header { align-items: flex-start; }article { flex-direction: column; padding: 20px; }.row-actions { justify-content: flex-end; } }
</style>
