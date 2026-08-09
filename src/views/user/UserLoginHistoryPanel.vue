<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { getLoginHistory } from '@/api/user'
import PaginationBar from '@/components/PaginationBar.vue'
import type { LoginHistoryItem } from '@/types/user'

// ========== State ==========
const loading = ref(false)
const records = ref<LoginHistoryItem[]>([])
const currentPage = ref(1)
const pageSize = ref(20)
const total = ref(0)

const totalPages = computed(() => Math.ceil(total.value / pageSize.value) || 1)

// ========== Columns ==========
const columns = [
  {
    title: '登录时间',
    dataIndex: 'loginTime',
    key: 'loginTime',
    width: 180,
  },
  {
    title: '设备名称',
    dataIndex: 'deviceName',
    key: 'deviceName',
    width: 160,
  },
  {
    title: 'IP 地址',
    dataIndex: 'ip',
    key: 'ip',
    width: 140,
  },
  {
    title: '地区',
    dataIndex: 'region',
    key: 'region',
    width: 100,
  },
  {
    title: '结果',
    key: 'result',
    width: 140,
  },
  {
    title: '失败原因',
    key: 'failReason',
  },
]

// ========== Fetch ==========
async function fetchData() {
  loading.value = true
  try {
    const res = await getLoginHistory(currentPage.value, pageSize.value)
    records.value = res.records
    total.value = res.total
  } catch {
    // handled by interceptor
  } finally {
    loading.value = false
  }
}

onMounted(() => fetchData())

function handlePageChange(page: number) {
  currentPage.value = page
  fetchData()
}

function handlePageSizeChange(size: number) {
  pageSize.value = size
  currentPage.value = 1
  fetchData()
}
</script>

<template>
  <div class="history-panel">
    <h2 class="panel-title">登录历史</h2>
    <p class="panel-desc">查看你的登录活动记录</p>

    <a-table
      :columns="columns"
      :data-source="records"
      :loading="loading"
      :pagination="false"
      row-key="loginTime"
      size="middle"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'result'">
          <a-tag v-if="record.result === 'SUCCESS'" color="success">成功</a-tag>
          <a-tag v-else color="error">失败</a-tag>
        </template>
        <template v-else-if="column.key === 'failReason'">
          <span v-if="record.result === 'FAIL' && record.failReason" class="fail-reason">
            {{ record.failReason }}
          </span>
          <span v-else style="color: #d9d9d9;">-</span>
        </template>
      </template>
    </a-table>

    <PaginationBar
      :current-page="currentPage"
      :total-pages="totalPages"
      :total="total"
      :page-size="pageSize"
      @update:current-page="handlePageChange"
      @update:page-size="handlePageSizeChange"
    />
  </div>
</template>

<style lang="scss" scoped>
.history-panel {
  // full width
}

.panel-title {
  font-size: $font-size-h2;
  font-weight: 600;
  color: $color-text-primary;
  margin: 0 0 4px;
}

.panel-desc {
  font-size: $font-size-body;
  color: $color-text-secondary;
  margin: 0 0 24px;
}

.fail-reason {
  color: $color-danger;
  font-size: 13px;
}
</style>
