<script setup lang="ts">
import { ref, computed, watch, onMounted, h } from 'vue'
import { Modal, message } from 'ant-design-vue'
import { PlusOutlined } from '@ant-design/icons-vue'
import { useTenantStore } from '@/stores/tenant'
import { ROLE_PERMISSIONS, PERMISSIONS, type Permission } from '@/utils/constants'
import {
  listLlmServices,
  disableLlmService,
  enableLlmService,
  prepareRemoveLlmService,
  removeLlmService,
  listLlmServiceTags,
  getLlmServiceInfo,
} from '@/api/llmService'
import PaginationBar from '@/components/PaginationBar.vue'
import LlmServiceCreateDrawer from './LlmServiceCreateDrawer.vue'
import LlmServiceEditDrawer from './LlmServiceEditDrawer.vue'
import LlmServiceDetailDrawer from './LlmServiceDetailDrawer.vue'
import ModelCompareDrawer from './components/ModelCompareDrawer.vue'
import ModelPickerModal from './components/ModelPickerModal.vue'
import ModelServiceCard from './components/ModelServiceCard.vue'
import ModelCatalogToolbar from './components/ModelCatalogToolbar.vue'
import ModelCompareBar from './components/ModelCompareBar.vue'
import type {
  LlmServiceInfo,
  LlmServiceInfoRespDTO,
  LlmServiceListRespDTO,
  LlmServiceRemovePreRespDTO,
  TagInfo,
} from '@/types/llmService'

const tenantStore = useTenantStore()

const selectedTenantId = ref<string | null>(null)
const data = ref<LlmServiceListRespDTO | null>(null)
const loading = ref(false)
const pageNum = ref(1)
const pageSize = ref(12)
const keyword = ref('')
const selectedTagCodes = ref<string[]>([])
const tags = ref<TagInfo[]>([])
const tagsLoading = ref(false)
const tagsError = ref(false)
const requestGeneration = ref(0)
const compareMode = ref(false)
const compareSelectedIds = ref<string[]>([])
const compareVisible = ref(false)
const pickerVisible = ref(false)

const createVisible = ref(false)
const editVisible = ref(false)
const detailVisible = ref(false)
const editingRecord = ref<LlmServiceInfo | null>(null)
const detailRecord = ref<LlmServiceInfo | null>(null)

const detailCache = ref<Record<string, LlmServiceInfoRespDTO>>({})
const detailLoading = ref<Record<string, boolean>>({})
const detailErrors = ref<Record<string, boolean>>({})
const compareRecordCache = ref<Record<string, LlmServiceInfo>>({})

// 权限以「下拉选中的租户」角色为准（而非全局 currentTenant）
const selectedRole = computed(() => {
  const tenant = tenantStore.tenants.find((item) => item.tenantId === selectedTenantId.value)
  return tenant?.role ?? null
})

const authorities = computed<Permission[]>(() => {
  if (!selectedRole.value) return []
  return ROLE_PERMISSIONS[selectedRole.value] ?? []
})

const canRegister = computed(() => authorities.value.includes(PERMISSIONS.TENANT_LLM_REGISTER))
const canUpdate = computed(() => authorities.value.includes(PERMISSIONS.TENANT_LLM_UPDATE))
const canDelete = computed(() => authorities.value.includes(PERMISSIONS.TENANT_LLM_DELETE))
const canCompare = computed(() => canRegister.value || canUpdate.value)

const tenantOptions = computed(() =>
  tenantStore.tenants.map((tenant) => ({ value: tenant.tenantId, label: tenant.name })),
)

const records = computed(() => data.value?.serviceInfoList ?? [])
const compareRecords = computed(() => compareSelectedIds.value
  .map((id) => records.value.find((record) => record.serviceId === id) ?? compareRecordCache.value[id])
  .filter((record): record is LlmServiceInfo => Boolean(record)))
const hasActiveFilters = computed(() => Boolean(keyword.value || selectedTagCodes.value.length))

async function fetchServices() {
  if (!selectedTenantId.value) return
  const generation = ++requestGeneration.value
  loading.value = true
  try {
    const result = await listLlmServices(
      selectedTenantId.value,
      pageNum.value,
      pageSize.value,
      keyword.value || undefined,
      selectedTagCodes.value,
    )
    if (generation !== requestGeneration.value) return
    data.value = result
    if (result.serviceInfoList.length === 0 && pageNum.value > 1) pageNum.value--
  } catch {
    // handled by interceptor
  } finally {
    if (generation === requestGeneration.value) loading.value = false
  }
}

async function fetchTags() {
  tagsLoading.value = true
  tagsError.value = false
  try {
    tags.value = await listLlmServiceTags()
  } catch {
    tagsError.value = true
  } finally {
    tagsLoading.value = false
  }
}

async function fetchHoverDetail(record: LlmServiceInfo) {
  if (
    !selectedTenantId.value
    || detailCache.value[record.serviceId]
    || detailLoading.value[record.serviceId]
    || detailErrors.value[record.serviceId]
  ) return
  const tenantId = selectedTenantId.value
  detailLoading.value = { ...detailLoading.value, [record.serviceId]: true }
  detailErrors.value = { ...detailErrors.value, [record.serviceId]: false }
  try {
    const detail = await getLlmServiceInfo(tenantId, record.serviceId, { silentError: true })
    if (tenantId !== selectedTenantId.value) return
    detailCache.value = { ...detailCache.value, [record.serviceId]: detail }
  } catch {
    if (tenantId === selectedTenantId.value) {
      detailErrors.value = { ...detailErrors.value, [record.serviceId]: true }
    }
  } finally {
    detailLoading.value = { ...detailLoading.value, [record.serviceId]: false }
  }
}

function clearCompareSelection() {
  compareSelectedIds.value = []
  compareRecordCache.value = {}
}

function handleSearch(value: string) {
  keyword.value = value.trim()
  pageNum.value = 1
  clearCompareSelection()
  fetchServices()
}

function handleTagChange(codes: string[]) {
  selectedTagCodes.value = codes
  pageNum.value = 1
  clearCompareSelection()
  fetchServices()
}

function resetFilters() {
  keyword.value = ''
  selectedTagCodes.value = []
  pageNum.value = 1
  clearCompareSelection()
  fetchServices()
}

function toggleCompareMode() {
  compareMode.value = !compareMode.value
  clearCompareSelection()
}

function toggleCompareRecord(record: LlmServiceInfo) {
  if (!compareMode.value) return
  if (compareSelectedIds.value.includes(record.serviceId)) {
    compareSelectedIds.value = compareSelectedIds.value.filter((id) => id !== record.serviceId)
    return
  }
  if (compareSelectedIds.value.length >= 2) {
    message.info('最多选择 2 个模型')
    return
  }
  compareRecordCache.value = { ...compareRecordCache.value, [record.serviceId]: record }
  compareSelectedIds.value = [...compareSelectedIds.value, record.serviceId]
}

function startCompare() {
  if (compareRecords.value.length === 2) compareVisible.value = true
}

function openDetail(record: LlmServiceInfo) {
  detailRecord.value = record
  detailVisible.value = true
}

function openEdit(record: LlmServiceInfo) {
  editingRecord.value = record
  editVisible.value = true
}

function handleToggle(record: LlmServiceInfo) {
  if (!selectedTenantId.value) return
  const disabled = record.status === 0
  const action = disabled ? '启用' : '停用'
  Modal.confirm({
    title: `${action}模型`,
    content: `确定${action}「${record.name}」吗？`,
    okText: action,
    okType: disabled ? 'primary' : 'danger',
    cancelText: '取消',
    onOk: async () => {
      if (disabled) {
        await enableLlmService(selectedTenantId.value!, record.serviceId)
      } else {
        await disableLlmService(selectedTenantId.value!, record.serviceId)
      }
      message.success(`已${action}`)
      delete detailCache.value[record.serviceId]
      fetchServices()
    },
  })
}

async function handleRemove(record: LlmServiceInfo) {
  if (!selectedTenantId.value) return
  let prep: LlmServiceRemovePreRespDTO
  try {
    prep = await prepareRemoveLlmService(selectedTenantId.value, record.serviceId)
  } catch {
    return
  }
  Modal.confirm({
    title: '删除模型',
    content: h('div', { style: 'white-space: pre-line; line-height: 1.6;' }, prep.info),
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    onOk: async () => {
      await removeLlmService(selectedTenantId.value!, record.serviceId, { token: prep.token })
      message.success('已删除')
      clearCompareSelection()
      delete detailCache.value[record.serviceId]
      fetchServices()
    },
  })
}

function fallbackName(detail: LlmServiceInfoRespDTO | undefined) {
  if (!detail?.fallbackServiceId) return null
  return records.value.find((record) => record.serviceId === detail.fallbackServiceId)?.name ?? null
}

function handleServicesChanged() {
  detailCache.value = {}
  detailErrors.value = {}
  fetchServices()
}

function startPickerCompare(baseline: LlmServiceInfo) {
  compareRecordCache.value = { [baseline.serviceId]: baseline }
  compareSelectedIds.value = [baseline.serviceId]
  pickerVisible.value = true
}

function finishPickerCompare(comparison: LlmServiceInfo) {
  const baseline = compareRecords.value[0]
  if (!baseline) return
  compareRecordCache.value = {
    [baseline.serviceId]: baseline,
    [comparison.serviceId]: comparison,
  }
  compareSelectedIds.value = [baseline.serviceId, comparison.serviceId]
  compareVisible.value = true
}

watch(selectedTenantId, (tenantId) => {
  data.value = null
  pageNum.value = 1
  clearCompareSelection()
  detailCache.value = {}
  detailLoading.value = {}
  detailErrors.value = {}
  if (tenantId) fetchServices()
})

watch([pageNum, pageSize], () => {
  clearCompareSelection()
  if (selectedTenantId.value) fetchServices()
})

onMounted(async () => {
  try {
    if (tenantStore.tenants.length === 0) await tenantStore.fetchTenants()
  } catch {
    // handled by interceptor
  }
  selectedTenantId.value = tenantStore.currentTenant?.tenantId ?? tenantStore.tenants[0]?.tenantId ?? null
  fetchTags()
})
</script>

<template>
  <div class="llm-service-list">
    <div class="page-header">
      <div>
        <div class="page-eyebrow">MODEL CATALOG</div>
        <h2 class="page-title">模型服务</h2>
        <p class="page-desc">集中管理租户可调用的模型、供应商接入与计费策略</p>
      </div>
      <div class="page-actions">
        <a-select
          v-model:value="selectedTenantId"
          :options="tenantOptions"
          placeholder="选择租户"
          class="tenant-select"
        />
        <a-button
          v-if="canRegister"
          type="primary"
          :disabled="!selectedTenantId"
          @click="createVisible = true"
        >
          <PlusOutlined />
          添加模型
        </a-button>
      </div>
    </div>

    <section v-if="selectedTenantId" class="catalog-shell">
      <ModelCatalogToolbar
        :keyword="keyword"
        :tags="tags"
        :selected-codes="selectedTagCodes"
        :result-count="data?.total ?? 0"
        :tags-loading="tagsLoading"
        :tags-error="tagsError"
        :compare-mode="compareMode"
        :can-compare="canCompare"
        @update:keyword="keyword = $event"
        @update:selected-codes="handleTagChange"
        @search="handleSearch"
        @retry-tags="fetchTags"
        @toggle-compare="toggleCompareMode"
        @reset="resetFilters"
      />

      <div class="grid-wrap">
        <div v-if="loading" class="model-grid" aria-label="正在加载模型服务">
          <div v-for="index in pageSize" :key="index" class="skeleton-card">
            <a-skeleton active avatar :paragraph="{ rows: 4 }" />
          </div>
        </div>

        <div v-else-if="records.length" class="model-grid">
          <ModelServiceCard
            v-for="record in records"
            :key="record.serviceId"
            :record="record"
            :dictionary="tags"
            :compare-mode="compareMode"
            :selected="compareSelectedIds.includes(record.serviceId)"
            :selection-disabled="compareSelectedIds.length >= 2 && !compareSelectedIds.includes(record.serviceId)"
            :can-update="canUpdate"
            :can-delete="canDelete"
            :detail="detailCache[record.serviceId]"
            :detail-loading="detailLoading[record.serviceId]"
            :detail-error="detailErrors[record.serviceId]"
            :fallback-name="fallbackName(detailCache[record.serviceId])"
            @detail="openDetail"
            @edit="openEdit"
            @toggle-status="handleToggle"
            @remove="handleRemove"
            @toggle-compare="toggleCompareRecord"
            @request-detail="fetchHoverDetail"
          />
        </div>

        <a-empty
          v-else
          :description="hasActiveFilters ? '没有匹配的模型，请更换关键词或清除能力筛选' : '暂无模型服务，点击右上角添加'"
        />
      </div>

      <div v-if="data && data.total > 0" class="pagination-wrap">
        <PaginationBar
          v-model:current-page="pageNum"
          v-model:page-size="pageSize"
          :total-pages="data.totalPages"
          :total="data.total"
          :page-size-options="[12, 24, 48]"
          page-jump-id="llmServicePageJump"
          total-label="个模型"
        />
      </div>
    </section>

    <a-card v-else :bordered="false">
      <a-empty description="你还没有加入任何租户">
        <router-link to="/tenants" custom v-slot="{ href, navigate }">
          <a-button type="primary" :href="href" @click="navigate">前往租户管理</a-button>
        </router-link>
      </a-empty>
    </a-card>

    <ModelCompareBar
      :visible="compareMode"
      :selected="compareRecords"
      @cancel="toggleCompareMode"
      @compare="startCompare"
    />

    <LlmServiceCreateDrawer
      v-if="selectedTenantId"
      v-model:visible="createVisible"
      :tenant-id="selectedTenantId"
      @done="handleServicesChanged"
    />

    <LlmServiceEditDrawer
      v-if="selectedTenantId"
      v-model:visible="editVisible"
      :tenant-id="selectedTenantId"
      :record="editingRecord"
      @done="handleServicesChanged"
    />

    <LlmServiceDetailDrawer
      v-if="selectedTenantId"
      v-model:visible="detailVisible"
      :tenant-id="selectedTenantId"
      :record="detailRecord"
      :dictionary="tags"
      @compare="startPickerCompare"
    />
    <ModelCompareDrawer
      v-if="selectedTenantId"
      v-model:open="compareVisible"
      :tenant-id="selectedTenantId"
      :baseline="compareRecords[0] ?? null"
      :comparison="compareRecords[1] ?? null"
      :dictionary="tags"
    />
    <ModelPickerModal
      v-if="selectedTenantId && compareRecords[0]"
      v-model:open="pickerVisible"
      :tenant-id="selectedTenantId"
      :exclude-service-id="compareRecords[0].serviceId"
      @select="finishPickerCompare"
    />
  </div>
</template>

<style lang="scss" scoped>
.llm-service-list {
  width: 100%;
  max-width: 1480px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  margin-bottom: 22px;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
}

.page-eyebrow {
  margin-bottom: 4px;
  color: $color-primary;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.06em;
}

.page-title {
  margin: 0;
  color: $color-text-primary;
  font-size: 26px;
  font-weight: 600;
  line-height: 1.3;
}

.page-desc {
  margin: 6px 0 0;
  color: $color-text-secondary;
}

.page-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.tenant-select {
  width: 200px;
}

.catalog-shell {
  overflow: visible;
  border: 1px solid #eaecf0;
  border-radius: 16px;
  background: $color-bg;
  box-shadow: $shadow-light;
}

.grid-wrap {
  min-height: 420px;
  padding: 16px;

  :deep(.ant-empty) {
    display: flex;
    min-height: 380px;
    justify-content: center;
    flex-direction: column;
  }
}

.model-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}

.skeleton-card {
  min-height: 238px;
  padding: 20px 16px;
  border: 1px solid #eaecf0;
  border-radius: $radius-card;
  background: $color-bg;
}

.pagination-wrap {
  padding: 0 16px 16px;
  border-top: 1px solid $color-border;

  :deep(.pagination-bar) {
    margin-top: 0;
  }
}

@media (max-width: 1180px) {
  .model-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 960px) {
  .model-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .page-header {
    align-items: stretch;
    flex-direction: column;
  }

  .page-actions {
    width: 100%;
  }

  .tenant-select {
    min-width: 0;
    flex: 1;
  }
}

@media (max-width: 580px) {
  .model-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .page-title {
    font-size: $font-size-title;
  }
}
</style>
