<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import type { FormInstance } from 'ant-design-vue'
import type { Rule, ValidateErrorEntity } from 'ant-design-vue/es/form/interface'
import { UploadOutlined, CheckCircleOutlined } from '@ant-design/icons-vue'
import { useSkillPublication } from '@/composables/useSkillPublication'
import { skillBytes, skillStatusLabel } from '@/utils/skill'
import SkillMarkdown from './SkillMarkdown.vue'
import RequiredFormItem from '@/components/form/RequiredFormItem.vue'
import SkillGithubSourceForm from './SkillGithubSourceForm.vue'
import SkillGithubSourceConfirmation from './SkillGithubSourceConfirmation.vue'
import SkillGithubCandidateList from './SkillGithubCandidateList.vue'
import SkillSourceSummary from './SkillSourceSummary.vue'
import SkillDraftFileList from './SkillDraftFileList.vue'
import { getToken } from '@/utils/auth'
const state = useSkillPublication()
const { authorName, options, draft, task, publication, submitIntent, form, slug, loading, busy, error,
  notice, editable, checking, waiting, ready, sourceType, sourceChanged, githubInput, githubIntent,
  candidates, candidatesLoading, files, filesLoading } = state
const fileInput = ref<HTMLInputElement>()
const showPreview = ref(false)
const requestedSource = ref<'ZIP' | 'GITHUB'>()
const leaveMessage = '发布信息尚未保存，离开会丢失这些编辑。已保存的导入任务仍可从「我的发布」继续。确认离开？'
onBeforeRouteLeave(() => !state.hasUnsavedChanges?.value || window.confirm(leaveMessage))
function beforeUnload(event: BeforeUnloadEvent) {
  if (state.hasUnsavedChanges?.value) { event.preventDefault(); event.returnValue = '' }
}
onMounted(() => window.addEventListener('beforeunload', beforeUnload))
onBeforeUnmount(() => window.removeEventListener('beforeunload', beforeUnload))
function changeSource(value: 'ZIP' | 'GITHUB') {
  if (value === sourceType.value) return
  if (checking.value || waiting.value || draft.value?.status === 'READY') requestedSource.value = value
  else void state.switchSource(value)
}
function onSourceChange(event: { target: { value: 'ZIP' | 'GITHUB' } }) {
  changeSource(event.target.value)
}
async function confirmSourceChange() {
  if (requestedSource.value) await state.switchSource(requestedSource.value)
  requestedSource.value = undefined
}
const creationModel = reactive({ slug })
const editorForm = ref<FormInstance>()
const slugRules: Rule[] = [{ pattern: /^[a-z0-9]+(?:-[a-z0-9]+)*$/, message: '仅支持小写字母、数字及单个连字符' }]
// 与后端 SkillPublicationPolicy 保持一致；严格匹配到字符串末尾，拒绝尾部换行。
const versionRules: Rule[] = [{
  pattern: new RegExp('^(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)'
    + '(?:-(?:0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*)(?:\\.(?:0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*))*)?'
    + '(?:\\+[0-9A-Za-z-]+(?:\\.[0-9A-Za-z-]+)*)?(?![\\s\\S])'),
  message: '请填写合法的 SemVer 版本，如 1.0.0、1.0.0-beta.1 或 1.0.0+build.1；主/次/修订号和纯数字预发布号不能有前导零',
}]
const draftFields = ['name', 'summary', 'categoryId', 'version', 'releaseNotes', 'originalAuthor', 'compatibility', 'dependencies']
const publicationFields = ['license', 'distributionAuthorized', 'declarationsConfirmed']
const distributionRules: Rule[] = [{ required: true, type: 'enum', enum: [true], message: '请确认拥有此内容的分发权' }]
const declarationRules: Rule[] = [{ required: true, type: 'enum', enum: [true], message: '请确认已核对声明内容' }]

async function validateEditor(action: 'save' | 'submit') {
  const target = editorForm.value
  const draftId = draft.value?.draftId
  const session = getToken()
  if (!target || !draftId || busy.value || !editable.value || submitIntent.value || githubIntent.value) return
  if (action === 'submit' && !ready.value) return
  error.value = ''
  const current = () => target === editorForm.value && draftId === draft.value?.draftId && session === getToken()
  if (action === 'save') target.clearValidate(publicationFields)
  try {
    await target.validateFields(action === 'save' ? draftFields : undefined)
  } catch (failure) {
    const invalid = failure as Partial<ValidateErrorEntity>
    if (!Array.isArray(invalid?.errorFields)) throw failure
    if (current() && invalid.errorFields[0]) {
      target.scrollToField(invalid.errorFields[0].name, { block: 'center', behavior: 'smooth' })
    }
    return
  }
  if (current() && !busy.value && editable.value && !submitIntent.value) await state[action]()
}
function selectFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) void state.retryUpload(file)
  input.value = ''
}
</script>
<template>
  <section class="publish-page">
    <header class="page-heading"><div><router-link to="/skills">Skill 广场</router-link><h1>发布 Skill</h1><p>上传 ZIP 或导入公开 GitHub 仓库，核对内容与声明后分享。</p></div><router-link to="/skills/mine">我的发布</router-link></header>
    <a-alert v-if="error" type="error" show-icon :message="error" class="notice"><template #action><a-button size="small" :disabled="busy" @click="draft ? state.refreshDraft() : state.load()">重试读取状态</a-button></template></a-alert>
    <a-alert v-if="notice" type="success" show-icon :message="notice" class="notice" />
    <a-spin :spinning="loading">
      <a-result v-if="publication" status="success" title="Skill 已发布">
        <template #extra><router-link :to="`/skills/${publication.skillId}`" custom v-slot="{ href, navigate }"><a-button type="primary" :href="href" @click="navigate">查看公开页面</a-button></router-link><router-link to="/skills/mine" class="after-link">我的发布</router-link></template>
      </a-result>
      <div v-else-if="!loading && !draft" class="panel new-draft-panel">
        <span class="step">01 / 新建草稿</span><h2>为这个 Skill 确定一个地址</h2><p>发布账号：{{ authorName }}</p>
        <a-form :model="creationModel" layout="vertical" novalidate :scroll-to-first-error="{ block: 'center' }" @finish="state.create">
          <RequiredFormItem name="slug" label="Skill 标识（slug）" message="请填写 Skill 标识" :rules="slugRules">
            <a-input v-model:value="slug" :maxlength="64" placeholder="例如 review-helper，创建后固定" />
          </RequiredFormItem>
          <a-button type="primary" html-type="submit" :loading="busy" :disabled="busy || loading || !options">创建草稿</a-button>
        </a-form>
      </div>
      <template v-else-if="draft">
        <div v-if="githubIntent" class="panel recovery"><h3>恢复导入命令结果</h3><p>上次请求的结果尚未确认，请先恢复同一次操作。</p><a-button type="primary" :loading="busy" @click="state.retryGithubIntent">恢复原操作</a-button></div>
        <div v-if="submitIntent && !publication" class="panel recovery"><h3>恢复提交结果</h3><p>此草稿存在已发起的提交。请先使用原始修订与幂等键查询或重试，避免重复提交。</p><a-button type="primary" :loading="busy" @click="state.retrySubmission">恢复原提交</a-button></div>
        <a-alert v-if="!editable && !submitIntent" type="info" :message="`草稿${skillStatusLabel(draft.status)}，无法继续编辑`" show-icon>
          <template v-if="draft.status === 'SUBMITTED'" #action><router-link :to="`/skills/${draft.skillId}`">查看公开页面</router-link></template>
        </a-alert>
        <a-form :key="draft.draftId" ref="editorForm" :model="form" layout="vertical" novalidate
          class="editor-grid" :class="{ readonly: !editable || !!submitIntent }" :disabled="busy || !editable || !!submitIntent || !!githubIntent">
          <div class="editor-main">
            <section class="panel upload-panel"><span class="step">01 / Skill 包</span><div class="section-title"><h2>选择来源</h2><a-tag>{{ skillStatusLabel(draft.status) }}</a-tag></div>
              <a-radio-group :value="sourceType" :disabled="busy || !editable || !!submitIntent || !!githubIntent" class="source-tabs" @change="onSourceChange"><a-radio-button value="ZIP">上传 ZIP</a-radio-button><a-radio-button value="GITHUB">GitHub 导入</a-radio-button></a-radio-group>
              <template v-if="sourceType === 'ZIP'">
              <p>单个 Skill，支持根目录或一层同名包装目录。完整保留资源文件，不执行包内脚本。</p>
              <div class="upload-box"><UploadOutlined /><strong>{{ draft.packageName || '选择你的 Skill 包' }}</strong><span>ZIP ≤ {{ skillBytes(options?.maxArchiveBytes) }} · {{ options?.maxFiles || 500 }} 个文件</span>
                <input ref="fileInput" type="file" accept=".zip,application/zip" class="file-input" aria-label="选择Skill ZIP" :disabled="busy || checking || !editable || !!submitIntent" @change="selectFile" />
                <a-button :loading="busy" :disabled="busy || checking || !editable || !!submitIntent" @click="fileInput?.click()">{{ draft.packageName ? '重新选择 ZIP' : '选择 ZIP 文件' }}</a-button>
              </div>
              </template>
              <SkillGithubSourceForm v-else v-model="githubInput" :busy="busy" :disabled="checking || waiting || !editable || !!submitIntent || !!githubIntent"
                :max-archive-bytes="options?.githubLimits?.maxArchiveBytes" @import="state.startGithub" />
              <div v-if="task && !sourceChanged" class="task-status" aria-live="polite"><a-spin v-if="checking" size="small" /><CheckCircleOutlined v-else-if="task.status === 'SUCCEEDED'" /><strong>{{ task.status === 'RUNNING' && task.sourceType === 'GITHUB' ? ({ RESOLVE: '正在解析引用', FETCH: '正在获取与扫描快照', VALIDATE: '正在检查所选 Skill' }[task.phase || ''] || skillStatusLabel(task.status)) : skillStatusLabel(task.status) }}</strong><a-button v-if="checking || waiting" size="small" :disabled="busy" @click="state.cancel">取消</a-button></div>
              <template v-if="task && !sourceChanged">
                <a-alert v-if="task.reason" :type="task.status === 'FAILED' ? 'error' : 'info'" :message="task.reason" show-icon />
                <p v-if="task.retryAt && task.status === 'FAILED'">建议重试时间：{{ task.retryAt }}</p>
                <a-alert v-for="issue in task.issues || []" :key="`${issue.code}:${issue.path}`" type="error" show-icon :message="`${issue.path}：${issue.message}`" />
                <SkillGithubSourceConfirmation v-if="task.status === 'WAITING_CONFIRMATION'" :options="task.sourceOptions || []" :busy="busy" @confirm="state.confirmSource" />
                <SkillGithubCandidateList v-if="task.status === 'WAITING_SELECTION' && candidates" :result="candidates" :busy="busy" :loading="candidatesLoading" @select="state.selectCandidate" @page="state.loadCandidates" />
                <a-button v-if="task.sourceType === 'GITHUB' && task.status === 'FAILED' && task.source?.commitSha" :disabled="busy || !!githubIntent" @click="state.retryFixedGithub">重试此固定提交</a-button>
                <a-button v-if="!checking && task.status !== 'SUCCEEDED'" type="link" @click="state.refreshDraft">重新读取状态</a-button>
                <p v-if="checking || waiting">任务已保存，离开后可以从「我的发布」继续。</p>
              </template>
              <SkillSourceSummary v-if="draft.source && !sourceChanged" :source="draft.source" />
              <div v-if="draft.archiveBytes && !sourceChanged" class="package-meta">{{ skillBytes(draft.archiveBytes) }} · {{ draft.fileCount }} 个文件 <a-button type="link" @click="showPreview = !showPreview">{{ showPreview ? '收起正文' : '预览 SKILL.md' }}</a-button></div>
              <SkillMarkdown v-if="showPreview && draft.skillMarkdown && !sourceChanged" :text="draft.skillMarkdown" />
              <SkillDraftFileList v-if="ready && files" :result="files" :loading="filesLoading" @page="state.loadFiles" />
            </section>
            <section class="panel"><span class="step">02 / 公开信息</span><h2>让其他人了解这个 Skill</h2>
              <RequiredFormItem name="name" label="名称"><a-input v-model:value="form.name" :maxlength="80" /></RequiredFormItem>
              <RequiredFormItem name="summary" label="简介"><a-textarea v-model:value="form.summary" :maxlength="300" :rows="4" show-count /></RequiredFormItem>
              <div class="form-row">
                <RequiredFormItem name="categoryId" label="分类" message="请选择分类"><a-select v-model:value="form.categoryId" :options="options?.categories.map(item => ({ value: item.id, label: item.name }))" /></RequiredFormItem>
                <RequiredFormItem name="version" label="版本（SemVer）" message="请填写版本" :rules="versionRules"><a-input v-model:value="form.version" :maxlength="64" placeholder="1.0.0" /></RequiredFormItem>
              </div>
              <a-form-item name="tags" label="标签（最多5个）"><a-select v-model:value="form.tags" mode="multiple" :options="options?.tags.map(item => ({ value: item.id, label: item.name, disabled: form.tags.length >= 5 && !form.tags.includes(item.id) }))" /></a-form-item>
              <RequiredFormItem name="releaseNotes" label="首版说明"><a-textarea v-model:value="form.releaseNotes" :maxlength="2000" :rows="4" /></RequiredFormItem>
            </section>
            <section class="panel"><span class="step">03 / 分发与环境声明</span><h2>请明确许可、来源和依赖</h2>
              <RequiredFormItem name="license" label="许可证或分发许可"><a-input v-model:value="form.license" :maxlength="200" placeholder="例如 MIT；请确认它与包内许可一致" /></RequiredFormItem>
              <RequiredFormItem name="originalAuthor" label="原作者"><a-input v-model:value="form.originalAuthor" :maxlength="100" placeholder="本人原创也请明确填写" /></RequiredFormItem>
              <a-form-item v-if="sourceType === 'ZIP'" name="sourceUrl" label="来源地址（可选，作者提供）"><a-input v-model:value="form.sourceUrl" :maxlength="500" placeholder="https://...，不含账号凭据" /></a-form-item>
              <RequiredFormItem name="compatibility" label="兼容环境"><a-textarea v-model:value="form.compatibility" :maxlength="500" :rows="3" placeholder="明确适用客户端、系统与版本要求" /></RequiredFormItem>
              <RequiredFormItem name="dependencies" label="依赖和费用"><a-textarea v-model:value="form.dependencies" :maxlength="2000" :rows="4" placeholder="声明依赖、环境变量名称及费用；没有依赖请明确填写「无」。不要填写真实密钥。" /></RequiredFormItem>
              <a-form-item name="distributionAuthorized" :rules="distributionRules"><a-checkbox v-model:checked="form.distributionAuthorized" :disabled="!ready">我确认拥有此内容的分发权，许可证允许本平台公开分发。</a-checkbox></a-form-item>
              <a-form-item name="declarationsConfirmed" :rules="declarationRules"><a-checkbox v-model:checked="form.declarationsConfirmed" :disabled="!ready">我已核对兼容环境、依赖、费用与秘密信息，声明真实完整。</a-checkbox></a-form-item>
            </section>
          </div>
          <aside class="panel publish-aside"><span class="step">发布检查</span><h3>{{ authorName }}</h3><p>{{ draft.slug }}</p><ul><li>检查通过的完整 Skill</li><li>可读的公开信息与文件列表</li><li>明确的许可及依赖声明</li></ul><a-button block :disabled="busy || !editable || !!submitIntent || !!githubIntent" :loading="busy" @click="validateEditor('save')">保存完整草稿</a-button><a-button block type="primary" :disabled="busy || !ready || !!submitIntent || !!githubIntent" :loading="busy" @click="validateEditor('submit')">确认声明并发布</a-button><small>发布后的包和声明不可覆盖。</small></aside>
        </a-form>
      </template>
    </a-spin>
    <a-modal :open="!!requestedSource" title="更换 Skill 来源" :confirm-loading="busy" @ok="confirmSourceChange" @cancel="requestedSource = undefined">
      <p>更换来源将停止当前未完成的导入。新来源需要重新检查，并重新确认分发和依赖声明。</p>
    </a-modal>
  </section>
</template>
<style lang="scss" scoped>
.source-tabs { margin-bottom: 16px; }
.publish-page { max-width: 1120px; margin: 0 auto; }.page-heading { display: flex; align-items: center; justify-content: space-between; gap: 18px; margin-bottom: 24px; }h1 { color: $color-text-primary; font-size: 28px; margin: 8px 0; }p { color: $color-text-secondary; line-height: 1.8; }h2 { font-size: 19px; color: $color-text-primary; margin: 12px 0 16px; }.notice { margin-bottom: 16px; }.panel { min-width: 0; padding: 26px; border: 1px solid $color-border; background: $color-bg; border-radius: $radius-card; margin-bottom: 20px; }.new-draft-panel { max-width: 620px; margin: 20px auto; padding: 36px; }.step { font-size: 11px; color: $color-primary; font-weight: 650; letter-spacing: .09em; }.editor-grid { display: grid; grid-template-columns: minmax(0, 1fr) 260px; gap: 22px; }.editor-main { min-width: 0; }.section-title { display: flex; justify-content: space-between; align-items: center; }.upload-box { position: relative; display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 28px 14px; background: $color-bg-secondary; border: 1px dashed $color-border-input; border-radius: $radius-input; }.upload-box > .anticon { color: $color-primary; font-size: 25px; }.upload-box > span:not(.anticon) { color: $color-text-tertiary; font-size: 12px; }.file-input { display: none; }.task-status { display: flex; align-items: center; gap: 10px; margin: 16px 0; font-size: 12px; }.package-meta { color: $color-text-secondary; font-size: 12px; margin-top: 16px; }.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }.panel :deep(textarea.ant-input) { resize: none; overflow-y: auto; }.panel :deep(.ant-checkbox-wrapper) { display: flex; align-items: flex-start; line-height: 1.7; margin: 12px 0; }.publish-aside { position: sticky; top: 20px; height: fit-content; }.publish-aside p { font-size: 12px; overflow-wrap: anywhere; }.publish-aside ul { padding-left: 18px; color: $color-text-secondary; font-size: 12px; line-height: 2.3; margin: 20px 0; }.publish-aside .ant-btn { margin: 6px 0; }.publish-aside small { display: block; color: $color-text-tertiary; line-height: 1.8; margin-top: 16px; }.recovery { border-color: $color-primary; }.after-link { margin-left: 16px; }
@media(max-width: 900px) { .editor-grid { grid-template-columns: 1fr; }.publish-aside { position: static; grid-row: 2; } }
@media(max-width: 600px) { .panel { padding: 20px; }.page-heading { align-items: flex-start; }.form-row { grid-template-columns: 1fr; gap: 0; } }
</style>
