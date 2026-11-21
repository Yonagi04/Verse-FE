<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { onBeforeRouteLeave, useRoute } from 'vue-router'
import { UploadOutlined, CheckCircleOutlined } from '@ant-design/icons-vue'
import { useSkillVersionPublication } from '@/composables/useSkillVersionPublication'
import { skillStatusLabel } from '@/utils/skill'
import SkillSourceSummary from './SkillSourceSummary.vue'
import SkillVersionFiles from './SkillVersionFiles.vue'
const state = useSkillVersionPublication(), route = useRoute()
const { workspace, task, preview, receipt, notes, error, notice, loading, busy, intent, type, skillId, active, checking, editable, ready } = state
const input = ref<HTMLInputElement>(), replaceFile = ref<File>(), replaceOpen = ref(false)
const latestRequested = computed(() => route.query.mode === 'LATEST_DRAFT')
const leaveMessage = '本次更新说明尚未保存，确认离开？已发布版本不会受到影响。'
onBeforeRouteLeave(() => !state.hasUnsavedChanges.value || window.confirm(leaveMessage))
function beforeUnload(event: BeforeUnloadEvent) { if (state.hasUnsavedChanges.value) { event.preventDefault(); event.returnValue = '' } }
onMounted(() => window.addEventListener('beforeunload', beforeUnload))
onBeforeUnmount(() => window.removeEventListener('beforeunload', beforeUnload))
function prepare(file?: File) {
  if (checking.value || workspace.value?.artifactId) { replaceFile.value = file; replaceOpen.value = true }
  else void state.prepare(file)
}
function selectFile(event: Event) {
  const element = event.target as HTMLInputElement
  if (element.files?.[0]) prepare(element.files[0])
  element.value = ''
}
function replace() { replaceOpen.value = false; void state.prepare(replaceFile.value); replaceFile.value = undefined }
</script>
<template>
  <section class="version-publish">
    <nav class="breadcrumb" aria-label="面包屑">
      <router-link to="/skills/mine">我的发布</router-link><span>/</span>
      <router-link :to="`/skills/${skillId}/versions`">版本管理</router-link><span>/</span><span>发布新版</span>
    </nav>
    <header class="page-heading">
      <div class="page-identity"><span class="page-icon"><UploadOutlined /></span><div><h1>发布新版</h1><p>{{ workspace?.metadata?.name || 'Skill' }}<span> · 沿用基础信息与创建来源</span></p></div></div>
      <router-link :to="`/skills/${skillId}/versions`" custom v-slot="{ href, navigate }"><a-button :href="href" @click="navigate">返回版本管理</a-button></router-link>
    </header>
    <a-alert v-if="error" type="error" show-icon :message="error" class="notice"><template #action><a-button size="small" :disabled="busy || !!intent" @click="state.load">刷新状态</a-button></template></a-alert>
    <a-alert v-if="notice && !intent" type="info" show-icon :message="notice" class="notice" />
    <a-alert v-if="intent" type="warning" show-icon message="正在确认发布结果" description="本次请求的结果尚未确认，恢复前不能发起另一种发布。" class="notice"><template #action><a-button type="primary" :loading="busy" @click="state.recover">恢复原发布结果</a-button></template></a-alert>
    <a-result v-if="receipt" status="success" :title="`${receipt.version} 发布成功`" :sub-title="receipt.type === 'DRAFT' ? '仅自己可见，当前公开版本和下载内容保持不变。' : '公开内容与下载已切换到本次正式版。'" class="card">
      <template #extra><router-link :to="`/skills/${skillId}/versions`" custom v-slot="{ href, navigate }"><a-button type="primary" :href="href" @click="navigate">查看版本时间线</a-button></router-link></template>
    </a-result>
    <a-spin v-else :spinning="loading">
      <template v-if="workspace">
        <a-alert v-if="workspace.skillStatus !== 'ACTIVE'" type="warning" show-icon message="此 Skill 当前无法发布新版，请返回版本管理核对状态。" />
        <section v-else-if="!active" class="start-card card">
          <div class="section-heading"><span class="section-icon"><UploadOutlined /></span><div><h2>开始下一次迭代</h2><p>当前公开 <strong>{{ workspace.currentVersion }}</strong> · 选择本次更新的内容来源</p></div></div>
          <p>准备新版文件，或使用本轮最新草稿新建正式版。已发布节点及说明保持原样。</p>
          <div class="start-actions">
            <a-button :type="latestRequested ? 'default' : 'primary'" :disabled="busy || !!intent" @click="state.open('NEW_CONTENT')">{{ workspace.creationSource?.type === 'GITHUB' ? '从原 GitHub 来源准备新版' : '上传新版 ZIP' }}</a-button>
            <a-button v-if="workspace.canPromote" :type="latestRequested ? 'primary' : 'default'" :disabled="busy || !!intent" @click="state.open('LATEST_DRAFT')">以本轮最新草稿开始正式发布</a-button>
          </div>
          <SkillSourceSummary v-if="workspace.creationSource" :source="workspace.creationSource" />
        </section>
        <template v-else>
          <div class="steps card" aria-label="发布流程">
            <span :class="{ complete: workspace.status === 'READY' }"><b><CheckCircleOutlined v-if="workspace.status === 'READY'" /><template v-else>1</template></b>准备文件</span><i />
            <span><b>2</b>填写更新说明</span><i /><span><b>3</b>确认发布</span>
          </div>
          <div class="editor-layout">
            <div class="editor-main">
              <section class="card form-section">
                <header class="section-heading"><span class="section-number">01</span><div><h2>{{ workspace.sourceVersionId ? '采用本轮最新草稿' : '版本内容' }}</h2><p>{{ workspace.sourceVersionId ? '使用草稿固定的文件与实际来源，不重新上传或访问 GitHub。' : '完整替换本次文件集合，校验与保存不会自动发布。' }}</p></div></header>
                <div v-if="!workspace.sourceVersionId" class="prepare-box">
                  <span class="upload-icon"><UploadOutlined /></span>
                  <div class="prepare-copy"><h3>{{ workspace.creationSource?.type === 'GITHUB' ? '从固定 GitHub 来源拉取' : '上传完整的新版 ZIP 包' }}</h3><p>{{ workspace.creationSource?.type === 'GITHUB' ? '沿用原仓库、引用与目录，记录本次实际提交。' : '最多 20 MiB / 500 个文件。新版不存在的旧文件视为删除。' }}</p></div>
                  <input v-if="workspace.creationSource?.type === 'ZIP'" ref="input" type="file" accept=".zip,application/zip" hidden @change="selectFile" />
                  <a-button v-if="workspace.creationSource?.type === 'ZIP'" :disabled="!editable" :loading="busy" @click="input?.click()">选择新版 ZIP</a-button>
                  <a-button v-else :disabled="!editable" :loading="busy" @click="prepare()">{{ workspace.artifactId || checking ? '重新拉取文件' : '拉取新版文件' }}</a-button>
                </div>
                <div v-if="task" class="task-status"><a-spin v-if="checking" size="small" /><CheckCircleOutlined v-else-if="task.status === 'SUCCEEDED'" /><strong>{{ skillStatusLabel(task.status) }}</strong><span>{{ task.reason || '准备过程不影响当前公开版本' }}</span></div>
                <SkillSourceSummary v-if="workspace.source || workspace.creationSource" :source="(workspace.source || workspace.creationSource)!" />
                <a-alert v-if="workspace.status === 'READY' && workspace.artifactId" type="success" show-icon message="文件校验通过，可以查看完整文件和差异。" class="validation-notice" />
              </section>
              <section class="card notes-section">
                <header class="section-heading"><span class="section-number">02</span><div><h2><label for="version-release-notes">更新说明 <span class="required">*</span></label></h2><p>记录本次变化，说明将随版本固定保存。</p></div></header>
                <a-textarea id="version-release-notes" v-model:value="notes" :disabled="!editable" :maxlength="2000" :rows="6" show-count placeholder="描述本次文件变化、修复及使用注意事项…" />
              </section>
              <section v-if="workspace.status === 'READY' && workspace.artifactId" class="card preview-section">
                <div class="preview-heading"><h2>文件预览与差异</h2><a-radio-group v-if="!workspace.sourceVersionId" v-model:value="type" size="small" :disabled="busy || !!intent"><a-radio-button value="RELEASE">正式版基准</a-radio-button><a-radio-button value="DRAFT">草稿基准</a-radio-button></a-radio-group></div>
                <SkillVersionFiles :key="`${workspace.revision}:${type}`" :skill-id="skillId" :target="{ revision: workspace.revision, type }" />
              </section>
            </div>
            <aside class="editor-aside card">
              <div class="aside-heading"><h2>发布检查</h2><span class="private-label">个人工作区</span></div>
              <div class="current-release"><span>当前公开版本</span><strong>{{ workspace.currentVersion }}</strong><p>{{ workspace.slug }}</p></div>
              <ul class="publish-checks"><li>沿用基础信息与作者声明</li><li>{{ workspace.creationSource?.type === 'GITHUB' ? 'GitHub 来源固定' : 'ZIP 上传来源固定' }}</li><li>已发布的版本与文件保持原样</li></ul>
              <a-button block :disabled="!editable || !notes.trim()" :loading="busy" @click="state.save">保存待发布内容</a-button>
              <div class="publish-actions">
                <template v-if="!workspace.sourceVersionId"><a-button block :disabled="!ready || !notes.trim()" @click="state.confirm('DRAFT')">发布草稿版</a-button><small>仅自己可见，公开版本仍为 {{ workspace.currentVersion }}。</small></template>
                <a-button block type="primary" :disabled="!ready || !notes.trim()" @click="state.confirm('RELEASE')">发布正式版</a-button><small>公开并更新下载版本，下一步核对编号与内容。</small>
              </div>
              <a-popconfirm title="放弃当前待发布内容？" description="会取消本次准备，已发布版本不受影响。" ok-text="确认放弃" cancel-text="继续编辑" @confirm="state.abandon"><a-button block danger type="text" :disabled="busy || !!intent">放弃本次准备</a-button></a-popconfirm>
            </aside>
          </div>
        </template>
      </template>
    </a-spin>
    <a-modal :open="!!preview" :title="preview?.type === 'DRAFT' ? '确认发布私人草稿' : '确认发布正式版'" :width="720" :closable="!busy && !intent" :mask-closable="false" :confirm-loading="busy" :cancel-button-props="{ disabled: busy || !!intent }" :ok-button-props="{ disabled: !!intent }" ok-text="确认发布此版本" cancel-text="返回修改" @cancel="preview = undefined" @ok="state.publish">
      <template v-if="preview">
        <section class="confirm-hero"><span>{{ preview.type === 'DRAFT' ? '仅自己可见' : '公开并更新下载版本' }}</span><h2>{{ preview.version }}</h2><p v-if="preview.type === 'DRAFT'">当前公开版本仍为 {{ preview.currentVersion }}，私人说明及文件不会公开。</p><p v-else>发布成功后，公开内容与下载将一起切换到 {{ preview.version }}。</p><p v-if="preview.sourceDraftVersion">发布自 {{ preview.sourceDraftVersion }} · 原草稿与说明保持不变</p></section>
        <div class="confirm-summary"><span>相对 {{ preview.baseVersion || '空文件集合' }}</span><div><span class="added">+ {{ preview.addedCount }} 新增</span><span class="modified">~ {{ preview.modifiedCount }} 修改</span><span class="deleted">− {{ preview.deletedCount }} 删除</span></div></div>
        <a-alert v-if="preview.addedCount + preview.modifiedCount + preview.deletedCount === 0" type="info" show-icon message="文件无变化，仍可显式发布本次更新说明或来源快照。" />
        <div class="confirm-notes"><span>更新说明</span><p>{{ preview.releaseNotes }}</p></div>
        <SkillSourceSummary :source="preview.source" /><small class="digest">文件数 {{ preview.fileCount }} · 内容摘要 {{ preview.contentSha256 }}</small>
      </template>
      <a-alert v-if="error" type="error" show-icon :message="error" class="notice" /><a-alert v-if="intent" type="warning" show-icon message="发布结果尚未确认，请恢复原发布操作。"><template #action><a-button :loading="busy" @click="state.recover">恢复结果</a-button></template></a-alert>
    </a-modal>
    <a-modal v-model:open="replaceOpen" title="替换尚未发布的临时内容" ok-text="停止旧任务并重新校验" cancel-text="保留当前内容" @ok="replace"><p>旧任务的迟到结果将无法覆盖新文件。替换只影响本次待发布内容，已发布节点保持不变。</p></a-modal>
  </section>
</template>
<style scoped lang="scss">
.version-publish { @include skill-page-typography($font-size-body, $font-size-caption); max-width: 1440px; margin: 0 auto; }
.breadcrumb { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 20px; color: $color-text-tertiary; font-size: $font-size-caption; }.breadcrumb a { color: $color-text-secondary; &:hover { color: $color-primary; } }
.page-heading { display: flex; align-items: center; justify-content: space-between; gap: 20px; margin-bottom: 24px; }.page-identity { display: flex; align-items: center; gap: 14px; min-width: 0; }.page-icon { display: grid; place-items: center; flex: none; width: 44px; height: 44px; border-radius: $radius-card; background: $color-primary-bg; color: $color-primary; font-size: 22px; }
h1 { margin: 0; font-size: $font-size-title; font-weight: 600; line-height: 1.4; color: $color-text-primary; }.page-heading p { margin: 3px 0 0; color: $color-text-secondary; overflow-wrap: anywhere; }.page-heading p span { color: $color-text-tertiary; }
h2 { margin: 0; color: $color-text-primary; font-size: $font-size-h3; font-weight: 600; }h3 { color: $color-text-primary; }.card { min-width: 0; overflow: hidden; background: $color-bg; border: 1px solid $color-border; border-radius: $radius-card; }.notice { margin-bottom: 16px; }
.start-card { max-width: 880px; padding: 28px; }.start-card > p { margin: 20px 0 0; color: $color-text-secondary; line-height: 1.8; }.start-actions { display: flex; flex-wrap: wrap; gap: 12px; margin: 24px 0; }
.section-heading { display: flex; align-items: flex-start; gap: 12px; }.section-heading p { margin: 6px 0 0; color: $color-text-secondary; font-size: $font-size-caption; line-height: 1.7; }.section-number, .section-icon { display: grid; place-items: center; flex: none; width: 28px; height: 28px; border-radius: 6px; background: $color-bg-secondary; color: $color-text-tertiary; font-size: $font-size-caption; font-weight: 500; }.section-icon { width: 40px; height: 40px; color: $color-primary; background: $color-primary-bg; font-size: 20px; }
.steps { display: flex; align-items: center; padding: 16px 24px; margin-bottom: 20px; }.steps > span { display: flex; align-items: center; gap: 10px; color: $color-text-secondary; font-size: $font-size-caption; }.steps b { display: grid; place-items: center; width: 24px; height: 24px; border: 1px solid $color-border; border-radius: 50%; background: $color-bg-secondary; color: $color-text-secondary; font-size: $font-size-caption; font-weight: 500; }.steps .complete b { color: $color-primary; background: $color-primary-bg; border-color: transparent; }.steps i { flex: 1; height: 1px; margin: 0 24px; background: $color-border; }
.editor-layout { display: grid; grid-template-columns: minmax(0, 1fr) 280px; gap: 20px; align-items: start; }.editor-main { display: grid; gap: 20px; min-width: 0; }.form-section, .notes-section { padding: 24px; }.notes-section { padding-bottom: 42px; }.required { font-size: $font-size-body; color: $color-danger; font-weight: 400; }
.prepare-box { display: flex; align-items: center; flex-wrap: wrap; gap: 16px; margin-top: 20px; padding: 20px; border: 1px dashed $color-border-input; border-radius: $radius-input; background: $color-bg-secondary; }.upload-icon { display: grid; place-items: center; flex: none; width: 40px; height: 40px; border: 1px solid $color-border; border-radius: $radius-input; background: $color-bg; color: $color-primary; font-size: 20px; }.prepare-copy { flex: 1; min-width: 180px; }.prepare-copy h3 { margin: 0; font-size: $font-size-body; font-weight: 500; }.prepare-copy p { margin: 6px 0 0; color: $color-text-tertiary; font-size: $font-size-caption; line-height: 1.7; }.prepare-box > .ant-btn { margin-left: auto; }
.task-status { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; padding-top: 16px; color: $color-text-secondary; font-size: $font-size-caption; }.task-status > .anticon { color: $color-success; }.task-status span:last-child { color: $color-text-tertiary; }.validation-notice { margin-top: 16px; }
.notes-section .ant-input-textarea { margin-top: 20px; }:deep(textarea.ant-input) { resize: none; overflow-y: auto; height: 150px; line-height: 1.8; }:deep(.ant-input-textarea-show-count::after) { margin-top: 6px; font-size: $font-size-caption; color: $color-text-tertiary; }
.preview-heading { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; padding: 16px 20px; }.preview-heading :deep(.ant-radio-button-wrapper) { font-size: $font-size-caption; }
.editor-aside { padding: 20px; position: sticky; top: 0; }.aside-heading { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; justify-content: space-between; }.aside-heading h2 { font-size: $font-size-body; }.private-label { color: $color-text-tertiary; font-size: $font-size-caption; }.current-release { padding: 20px 0 16px; border-bottom: 1px solid $color-border; }.current-release > span { color: $color-text-tertiary; font-size: $font-size-caption; }.current-release strong { display: block; margin: 4px 0; color: $color-text-primary; font-size: $font-size-h2; font-weight: 600; }.current-release p { margin: 0; color: $color-text-secondary; font-size: $font-size-caption; overflow-wrap: anywhere; }
.publish-checks { display: grid; gap: 12px; list-style: none; padding: 0; margin: 20px 0; color: $color-text-secondary; font-size: $font-size-caption; }.publish-checks li { display: flex; gap: 8px; align-items: baseline; }.publish-checks li::before { content: '✓'; color: $color-success; }
.publish-actions { display: grid; gap: 8px; padding: 20px 0 12px; margin-top: 20px; border-top: 1px solid $color-border; }.publish-actions small { margin: 0 0 8px; color: $color-text-tertiary; font-size: $font-size-caption; line-height: 1.7; }
.confirm-hero { padding: 20px; margin: 20px 0; border: 1px solid $color-border; border-radius: $radius-input; background: $color-primary-bg; }.confirm-hero > span { color: $color-text-secondary; font-size: $font-size-caption; }.confirm-hero h2 { margin: 6px 0 12px; font-size: $font-size-title; }.confirm-hero p { margin: 6px 0 0; color: $color-text-secondary; font-size: $font-size-body; line-height: 1.8; }.confirm-summary { display: flex; flex-wrap: wrap; gap: 8px 20px; justify-content: space-between; margin: 16px 0; font-size: $font-size-caption; color: $color-text-secondary; }.confirm-summary > div { display: flex; flex-wrap: wrap; gap: 16px; }.added { color: $color-success; }.modified { color: $color-primary; }.deleted { color: $color-danger; }
.confirm-notes { padding: 16px 0; border-block: 1px solid $color-border; }.confirm-notes > span { color: $color-text-tertiary; font-size: $font-size-caption; }.confirm-notes p { margin: 8px 0 0; white-space: pre-wrap; overflow-wrap: anywhere; color: $color-text-primary; font-size: $font-size-body; line-height: 1.8; }.digest { display: block; margin: 16px 0 0; overflow-wrap: anywhere; color: $color-text-tertiary; font-size: $font-size-caption; line-height: 1.7; }
@media (max-width: 1100px) { .editor-layout { grid-template-columns: minmax(0, 1fr) 248px; gap: 16px; }.editor-main { gap: 16px; }.form-section, .notes-section { padding: 20px; }.notes-section { padding-bottom: 40px; }.prepare-box { padding: 16px; }.upload-icon { display: none; } }
@media (max-width: 900px) { .editor-layout { grid-template-columns: 1fr; }.editor-aside { position: static; }.steps { padding: 16px; }.steps i { margin: 0 16px; } }
@media (max-width: 600px) { .page-heading { align-items: flex-start; flex-direction: column; gap: 16px; }.page-icon { width: 40px; height: 40px; }.page-heading p span { display: block; margin-top: 2px; }.steps { padding: 14px 12px; }.steps > span { gap: 6px; }.steps i { margin: 0 8px; }.steps b { width: 20px; height: 20px; }.form-section, .notes-section, .start-card { padding: 16px; }.notes-section { padding-bottom: 40px; }.prepare-box { gap: 12px; }.prepare-copy { min-width: 100%; }.prepare-box > .ant-btn { margin-left: 0; }.preview-heading { padding: 16px; }.section-number { width: 24px; height: 24px; }.start-actions { flex-direction: column; align-items: flex-start; } }
</style>
