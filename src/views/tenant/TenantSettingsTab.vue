<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import { getTenantSettings, updateTenantSettings } from '@/api/tenant'
import { useTenantStore } from '@/stores/tenant'
import type { TenantSettingsRespDTO, TenantSettingsUpdateReqDTO } from '@/types/tenant'

const props = defineProps<{
  tenantId: string
}>()

const emit = defineEmits<{
  saved: [settings: TenantSettingsRespDTO]
  close: []
  leave: []
}>()

interface SettingsForm {
  name: string
  description: string
  joinApprovalMode: 0 | 1
  auditEnabled: boolean
  activityRecordingEnabled: boolean
  rpmEnabled: boolean
  rateLimitRpm: number | null
  tpmEnabled: boolean
  rateLimitTpm: number | null
}

const tenantStore = useTenantStore()
const loading = ref(true)
const saving = ref(false)
const snapshot = ref<TenantSettingsRespDTO | null>(null)
const form = reactive<SettingsForm>({
  name: '',
  description: '',
  joinApprovalMode: 0,
  auditEnabled: false,
  activityRecordingEnabled: false,
  rpmEnabled: false,
  rateLimitRpm: null,
  tpmEnabled: false,
  rateLimitTpm: null,
})

const editable = computed(() => snapshot.value?.editable === true)
const isTeam = computed(() => snapshot.value?.type === 'TEAM')
const canClose = computed(() => isTeam.value && snapshot.value?.role === 'SUPER_ADMIN')
const canLeave = computed(() => isTeam.value && ['ADMIN', 'MEMBER'].includes(snapshot.value?.role ?? ''))
const nameError = computed(() => {
  const length = form.name.trim().length
  if (length === 0) return '请输入租户名称'
  if (length > 25) return '租户名称不能超过 25 个字符'
  return ''
})
const descriptionError = computed(() =>
  form.description.length > 200 ? '租户简介不能超过 200 个字符' : '',
)
const rpmError = computed(() => validateLimit(form.rpmEnabled, form.rateLimitRpm, 'RPM'))
const tpmError = computed(() => validateLimit(form.tpmEnabled, form.rateLimitTpm, 'TPM'))
const valid = computed(() => !nameError.value && !descriptionError.value && !rpmError.value && !tpmError.value)
const dirty = computed(() => {
  if (!snapshot.value) return false
  return JSON.stringify(toPayload()) !== JSON.stringify(snapshotPayload(snapshot.value))
})

function validateLimit(enabled: boolean, value: number | null, label: string) {
  if (!enabled) return ''
  if (value === null || !Number.isInteger(value) || value <= 0) {
    return `${label} 上限必须为正整数`
  }
  return ''
}

function snapshotPayload(settings: TenantSettingsRespDTO): TenantSettingsUpdateReqDTO {
  return {
    name: settings.name,
    description: settings.description,
    joinApprovalMode: settings.type === 'PERSONAL' ? 0 : settings.joinApprovalMode,
    auditEnabled: settings.auditEnabled,
    activityRecordingEnabled: settings.activityRecordingEnabled,
    rateLimitRpm: settings.rateLimitRpm,
    rateLimitTpm: settings.rateLimitTpm,
  }
}

function toPayload(): TenantSettingsUpdateReqDTO {
  return {
    name: form.name.trim(),
    description: form.description.trim() || null,
    joinApprovalMode: isTeam.value ? form.joinApprovalMode : 0,
    auditEnabled: form.auditEnabled,
    activityRecordingEnabled: form.activityRecordingEnabled,
    rateLimitRpm: form.rpmEnabled ? form.rateLimitRpm : null,
    rateLimitTpm: form.tpmEnabled ? form.rateLimitTpm : null,
  }
}

function applySnapshot(settings: TenantSettingsRespDTO) {
  snapshot.value = settings
  form.name = settings.name
  form.description = settings.description ?? ''
  form.joinApprovalMode = settings.type === 'PERSONAL' ? 0 : settings.joinApprovalMode
  form.auditEnabled = settings.auditEnabled
  form.activityRecordingEnabled = settings.activityRecordingEnabled
  form.rpmEnabled = settings.rateLimitRpm !== null && settings.rateLimitRpm > 0
  form.rateLimitRpm = settings.rateLimitRpm
  form.tpmEnabled = settings.rateLimitTpm !== null && settings.rateLimitTpm > 0
  form.rateLimitTpm = settings.rateLimitTpm
}

async function loadSettings() {
  loading.value = true
  try {
    applySnapshot(await getTenantSettings(props.tenantId))
  } catch {
    snapshot.value = null
  } finally {
    loading.value = false
  }
}

function resetForm() {
  if (snapshot.value) applySnapshot(snapshot.value)
}

async function saveSettings() {
  if (!editable.value || !dirty.value || !valid.value) return
  saving.value = true
  try {
    const saved = await updateTenantSettings(props.tenantId, toPayload())
    applySnapshot(saved)
    await tenantStore.fetchTenants()
    emit('saved', saved)
    message.success('租户设置已保存')
  } catch {
    // 保留当前表单和脏状态，统一请求拦截器负责提示。
  } finally {
    saving.value = false
  }
}

onMounted(loadSettings)
</script>

<template>
  <a-spin :spinning="loading">
    <div v-if="snapshot" class="settings-wrap">
      <header class="settings-heading">
        <h2>租户设置</h2>
        <p>管理租户资料、成员加入规则与模型调用限制。</p>
        <a-alert
          v-if="!editable"
          type="info"
          show-icon
          message="你可以查看当前设置，但只有管理员可以修改。"
        />
      </header>

      <a-card class="settings-section" title="基本信息">
        <template #extra><span class="section-desc">这些信息会展示在租户首页。</span></template>
        <a-form layout="vertical">
          <a-form-item label="租户名称" required :validate-status="nameError ? 'error' : ''" :help="nameError">
            <a-input v-model:value="form.name" :disabled="!editable" :maxlength="25" show-count />
          </a-form-item>
          <a-form-item label="租户简介" :validate-status="descriptionError ? 'error' : ''" :help="descriptionError">
            <div class="tenant-description-field">
              <a-textarea
                v-model:value="form.description"
                :disabled="!editable"
                :maxlength="200"
                :rows="4"
                show-count
                placeholder="用一句话说明当前租户的用途"
              />
            </div>
          </a-form-item>
        </a-form>
      </a-card>

      <a-card v-if="isTeam" class="settings-section" title="成员与加入">
        <template #extra><span class="section-desc">设置新成员加入当前租户时的处理方式。</span></template>
        <a-radio-group v-model:value="form.joinApprovalMode" :disabled="!editable" class="approval-options">
          <a-radio :value="1">
            <span class="option-title">需要管理员审批</span>
            <span class="option-desc">新成员提交申请后，由超级管理员或管理员确认通过。</span>
          </a-radio>
          <a-radio :value="0">
            <span class="option-title">无需审批</span>
            <span class="option-desc">持有有效邀请码的用户可直接加入，请谨慎启用。</span>
          </a-radio>
        </a-radio-group>
      </a-card>

      <a-card class="settings-section activity-settings" title="租户动态">
        <div class="setting-row compact-row">
          <div>
            <div class="setting-title">记录租户动态</div>
            <div class="setting-desc">
              开启后会记录租户设置、成员和模型服务等关键变更；关闭后不再产生新动态，
              历史记录仍会保留，但重新开启前无法查看。
            </div>
          </div>
          <a-switch v-model:checked="form.activityRecordingEnabled" :disabled="!editable" />
        </div>
      </a-card>

      <a-card class="settings-section" title="模型调用">
        <template #extra><span class="section-desc">租户限制作用于全部 API Key 和模型调用。</span></template>
        <div class="setting-row">
          <div>
            <div class="setting-title">模型调用审计</div>
            <div class="setting-desc">记录模型输入、输出和关键元数据，用于安全审查和问题追踪。</div>
          </div>
          <a-switch v-model:checked="form.auditEnabled" :disabled="!editable" />
        </div>
        <div class="setting-row">
          <div>
            <div class="setting-title">租户 RPM</div>
            <div class="setting-desc">限制每分钟最大请求数；关闭时不设置租户级上限。</div>
          </div>
          <div class="limit-control">
            <a-switch v-model:checked="form.rpmEnabled" :disabled="!editable" />
            <a-input-number
              v-model:value="form.rateLimitRpm"
              :disabled="!editable || !form.rpmEnabled"
              :min="1"
              :max="2147483647"
              :precision="0"
              placeholder="请输入上限"
            />
            <span class="unit">次/分钟</span>
            <div v-if="rpmError" class="limit-error">{{ rpmError }}</div>
          </div>
        </div>
        <div class="setting-row">
          <div>
            <div class="setting-title">租户 TPM</div>
            <div class="setting-desc">限制每分钟最大 Token 数；关闭时不设置租户级上限。</div>
          </div>
          <div class="limit-control">
            <a-switch v-model:checked="form.tpmEnabled" :disabled="!editable" />
            <a-input-number
              v-model:value="form.rateLimitTpm"
              :disabled="!editable || !form.tpmEnabled"
              :min="1"
              :max="2147483647"
              :precision="0"
              placeholder="请输入上限"
            />
            <span class="unit">Token/分</span>
            <div v-if="tpmError" class="limit-error">{{ tpmError }}</div>
          </div>
        </div>
      </a-card>

      <a-card v-if="canClose || canLeave" class="settings-section danger-card" title="危险操作">
        <div class="danger-row">
          <div v-if="canClose">
            <div class="setting-title">解散租户</div>
            <div class="setting-desc">所有成员将失去访问权限，关联服务会停止工作，此操作不可撤销。</div>
          </div>
          <div v-else>
            <div class="setting-title">退出租户</div>
            <div class="setting-desc">退出后将无法访问当前租户资源，再次加入需要重新申请或使用邀请码。</div>
          </div>
          <a-button v-if="canClose" danger @click="emit('close')">解散租户</a-button>
          <a-button v-else danger @click="emit('leave')">退出租户</a-button>
        </div>
      </a-card>

      <div v-if="editable" class="save-bar">
        <span :class="['save-state', { dirty }]">{{ dirty ? '有未保存的更改' : '所有更改已保存' }}</span>
        <a-space>
          <a-button :disabled="!dirty || saving" @click="resetForm">取消</a-button>
          <a-button type="primary" :disabled="!dirty || !valid" :loading="saving" @click="saveSettings">
            保存更改
          </a-button>
        </a-space>
      </div>
    </div>
    <a-empty v-else-if="!loading" description="暂时无法加载租户设置" />
  </a-spin>
</template>

<style lang="scss" scoped>
.settings-wrap {
  max-width: 980px;
  margin: 0 auto;
}

.settings-heading {
  margin-bottom: 20px;

  h2 {
    margin: 0;
    color: $color-text-primary;
    font-size: $font-size-h2;
  }

  p {
    margin: 5px 0 16px;
    color: $color-text-secondary;
  }
}

.settings-section {
  margin-bottom: 16px;
  border-radius: $radius-card;
  box-shadow: $shadow-light;
}

.section-desc,
.setting-desc,
.option-desc {
  color: $color-text-secondary;
  font-size: $font-size-caption;
}

.tenant-description-field :deep(textarea) {
  height: 96px !important;
  min-height: 96px !important;
  max-height: 96px !important;
  overflow-y: auto !important;
  resize: none !important;
}

.approval-options {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;

  :deep(.ant-radio-wrapper) {
    align-items: flex-start;
    min-height: 90px;
    margin: 0;
    padding: 16px;
    border: 1px solid $color-border;
    border-radius: 8px;
  }
}

.option-title,
.option-desc {
  display: block;
}

.option-title,
.setting-title {
  color: $color-text-primary;
  font-weight: 500;
}

.option-desc,
.setting-desc {
  margin-top: 5px;
  line-height: 1.55;
}

.setting-row,
.danger-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
}

.setting-row {
  min-height: 72px;
  padding: 18px 0;
  border-bottom: 1px solid $color-border;

  &:first-child { padding-top: 0; }
  &:last-child { padding-bottom: 0; border-bottom: 0; }
}

.compact-row {
  min-height: 48px;
  padding: 0;
}

.limit-control {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;

  :deep(.ant-input-number) { width: 170px; }
}

.unit {
  width: 64px;
  color: $color-text-secondary;
  font-size: $font-size-caption;
}

.limit-error {
  position: absolute;
  right: 74px;
  top: 36px;
  color: $color-danger;
  font-size: $font-size-caption;
}

.danger-card {
  border-color: #ffccc7;
  box-shadow: none;

  :deep(.ant-card-head-title) { color: $color-danger; }
}

.save-bar {
  position: sticky;
  bottom: 12px;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border: 1px solid #d6e4ff;
  border-radius: 8px;
  background: $color-bg;
  box-shadow: $shadow-light;
}

.save-state {
  color: $color-text-secondary;
  font-size: 13px;

  &.dirty { color: $color-warning; }
}

@media (max-width: 720px) {
  .approval-options { grid-template-columns: 1fr; }
  .setting-row,
  .danger-row { align-items: flex-start; flex-direction: column; }
  .limit-control { flex-wrap: wrap; width: 100%; }
  .section-desc { display: none; }
}
</style>
