<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { InfoCircleOutlined, ReloadOutlined } from '@ant-design/icons-vue'
import { getLoginHistory } from '@/api/user'
import type { LoginHistoryItem } from '@/types/user'

const loading = ref(false)
const failed = ref(false)
const records = ref<LoginHistoryItem[]>([])
const currentPage = ref(1)
const pageSize = ref(20)
const total = ref(0)
let requestSequence = 0
function formatTime(value: string) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}
const columns = [
  { title:'登录方式', key:'loginSource', width:100 },
  { title: '登录时间', dataIndex: 'loginTime', key: 'loginTime', width: 180 },
  { title: '设备名称', dataIndex: 'deviceName', key: 'deviceName', width: 160 },
  { title: 'IP 地址', dataIndex: 'ip', key: 'ip', width: 140 },
  { title: '地区', dataIndex: 'region', key: 'region', width: 100 },
  { title: '结果', key: 'result', width: 80 },
  { title: '失败原因', key: 'failReason', width: 150 },
]
async function fetchData() {
  const sequence = ++requestSequence
  loading.value = true
  failed.value = false
  try {
    const data = await getLoginHistory(currentPage.value, pageSize.value)
    if (sequence !== requestSequence) return
    records.value = data.historyInfos
    total.value = data.total
  } catch {
    if (sequence === requestSequence) failed.value = true
    // handled by interceptor
  } finally {
    if (sequence === requestSequence) loading.value = false
  }
}
onMounted(fetchData)
function handlePageChange(page: number, size: number) {
  currentPage.value = size !== pageSize.value ? 1 : page
  pageSize.value = size
  void fetchData()
}
</script>

<template>
  <section class="profile-card panel-card">
    <div class="panel-heading"><div><h2>登录历史</h2><p>回顾最近的登录记录，留意异常的设备、地区与登录失败。</p></div></div>
    <div v-if="failed && !loading" class="state-card"><InfoCircleOutlined /><h3>登录历史暂时无法加载</h3><a-button type="primary" @click="fetchData"><ReloadOutlined />重新加载</a-button></div>
    <template v-else>
      <a-table class="history-table" :columns="columns" :data-source="records" :loading="loading" :pagination="false"
        :row-key="(record: LoginHistoryItem) => `${record.loginTime}-${record.deviceName}-${record.ip}-${record.result}`" size="middle" :scroll="{ x: 810 }">
        <template #bodyCell="{ column, record }">
          <span v-if="column.key === 'loginSource'">{{ ({ PASSWORD:'密码', GOOGLE:'Google', GITHUB:'GitHub', GITLAB:'GitLab' } as Record<string,string>)[record.loginSource || 'PASSWORD'] || '密码' }}</span>
          <span v-if="column.key === 'loginTime'" class="mono">{{ formatTime(record.loginTime) }}</span>
          <span v-else-if="column.key === 'ip'" class="mono">{{ record.ip }}</span>
          <a-tag v-else-if="column.key === 'result'" :color="record.result === '成功' ? 'success' : 'error'">{{ record.result }}</a-tag>
          <span v-else-if="column.key === 'failReason'" :class="{ muted: !record.failReason }">{{ record.result === '失败' && record.failReason ? record.failReason : '—' }}</span>
        </template>
      </a-table>
      <a-pagination class="history-pagination" :current="currentPage" :total="total" :page-size="pageSize" :disabled="loading"
        :show-total="(count: number) => `共 ${count} 条`" :page-size-options="['5', '10', '20', '50']" show-size-changer show-quick-jumper @change="handlePageChange" />
    </template>
  </section>
</template>

<style lang="scss" scoped>
@use './user-center';
.history-table {
  :deep(.ant-table) { font-size: 13px; }
  :deep(.ant-table-container) { border: 1px solid $color-border; border-radius: $radius-input; overflow: hidden; }
  :deep(.ant-table-thead > tr > th) { padding: 14px 16px; font-weight: 500; background: $color-bg-secondary; }
  :deep(.ant-table-thead > tr > th::before) { display: none; }
  :deep(.ant-table-tbody > tr > td) { padding: 16px; }
  :deep(.ant-tag) { margin: 0; }
}
.history-pagination {
  margin-top: 20px; display: flex; justify-content: flex-end; align-items: center; flex-wrap: wrap; gap: 8px 0;
  :deep(.ant-pagination-item), :deep(.ant-pagination-prev), :deep(.ant-pagination-next) { border-radius: $radius-button; }
  :deep(.ant-pagination-options) { display: inline-flex; align-items: center; flex-wrap: wrap; gap: 8px; margin: 0; }
  :deep(.ant-pagination-options-quick-jumper) { margin: 0; }
}
@container profile (max-width: 540px) {
  .history-pagination { justify-content: flex-start; }
  .history-pagination :deep(.ant-pagination-options) { width: 100%; }
}
</style>
