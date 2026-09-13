<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useUserStore } from '@/stores/user'
import { useTenantStore } from '@/stores/tenant'
import { getLlmCount } from '@/api/llmService'
import { getUsageDashboard } from '@/api/usage'
import type { UsageDashboard } from '@/types/usage'
import UsageTrendChart from '@/views/usage/components/UsageTrendChart.vue'
import {
  DashboardOutlined,
  ApiOutlined,
  TeamOutlined,
  BarChartOutlined,
} from '@ant-design/icons-vue'

const userStore = useUserStore()
const tenantStore = useTenantStore()

const llmCount = ref<number | null>(null)
const usage = ref<UsageDashboard | null>(null)
const usageLoading = ref(false)
let usageSequence = 0

const activeTenantId = computed(
  () => tenantStore.currentTenantId,
)

async function fetchLlmCount() {
  if (!activeTenantId.value) {
    llmCount.value = null
    return
  }
  try {
    llmCount.value = await getLlmCount(activeTenantId.value)
  } catch {
    llmCount.value = null
  }
}

async function fetchUsage() {
  const tenantId = activeTenantId.value
  const current = ++usageSequence
  if (!tenantId) { usage.value = null; return }
  usageLoading.value = true
  try {
    const value = await getUsageDashboard(tenantId)
    if (current === usageSequence) usage.value = value
  } catch {
    if (current === usageSequence) usage.value = null
  } finally {
    if (current === usageSequence) usageLoading.value = false
  }
}

const formatCount = (value?: string) => value == null ? '--' : BigInt(value).toLocaleString()

onMounted(async () => {
  await fetchLlmCount()
  await fetchUsage()
})

watch(activeTenantId, () => {
  fetchLlmCount()
  fetchUsage()
})
</script>

<template>
  <div class="dashboard">
    <div class="page-header">
      <h2 class="page-title">仪表盘</h2>
      <p class="page-desc">欢迎回来，{{ userStore.user?.nickname || userStore.user?.username }}</p>
    </div>

    <a-empty v-if="!activeTenantId" description="暂无有效当前租户，请先进入租户管理选择或创建租户">
      <router-link to="/tenants" custom v-slot="{ href, navigate }">
        <a-button type="primary" :href="href" @click="navigate">前往租户管理</a-button>
      </router-link>
    </a-empty>

    <a-row v-else :gutter="[16, 16]">
      <a-col :span="6">
        <a-card class="stat-card">
          <div class="stat-content">
            <TeamOutlined class="stat-icon" />
            <div>
              <div class="stat-value">{{ tenantStore.tenants.length }}</div>
              <div class="stat-label">租户数</div>
            </div>
          </div>
        </a-card>
      </a-col>
      <a-col :span="6">
        <a-card class="stat-card">
          <div class="stat-content">
            <ApiOutlined class="stat-icon" />
            <div>
              <div class="stat-value">{{ llmCount ?? '--' }}</div>
              <div class="stat-label">LLM 服务</div>
            </div>
          </div>
        </a-card>
      </a-col>
      <a-col :span="6">
        <a-card class="stat-card">
          <div class="stat-content">
            <BarChartOutlined class="stat-icon" />
            <div>
              <div class="stat-value">{{ formatCount(usage?.today.totalTokens) }}</div>
              <div class="stat-label">今日 Token</div>
            </div>
          </div>
        </a-card>
      </a-col>
      <a-col :span="6">
        <a-card class="stat-card">
          <div class="stat-content">
            <DashboardOutlined class="stat-icon" />
            <div>
              <div class="stat-value">{{ formatCount(usage?.today.requestCount) }}</div>
              <div class="stat-label">API 调用</div>
            </div>
          </div>
        </a-card>
      </a-col>
    </a-row>

    <a-row :gutter="[16, 16]" class="usage-charts">
      <a-col :xs="24" :xl="12"><UsageTrendChart title="最近 24 小时用量" :points="usage?.recent24Hours.points ?? []" :loading="usageLoading" :data-delay-minutes="usage?.dataDelayMinutes" /></a-col>
      <a-col :xs="24" :xl="12"><UsageTrendChart title="最近 7 天用量" :points="usage?.recent7Days.points ?? []" :loading="usageLoading" /></a-col>
    </a-row>
  </div>
</template>

<style lang="scss" scoped>
.dashboard {
  max-width: 1200px;
}

.page-header {
  margin-bottom: 24px;

  .page-title {
    font-size: $font-size-title;
    font-weight: 600;
    color: $color-text-primary;
    margin: 0 0 8px 0;
  }

  .page-desc {
    color: $color-text-secondary;
    margin: 0;
  }
}

.stat-card {
  border-radius: $radius-card;

  .stat-content {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .stat-icon {
    font-size: 32px;
    color: $color-primary;
  }

  .stat-value {
    font-size: 24px;
    font-weight: 600;
    color: $color-text-primary;
  }

  .stat-label {
    font-size: $font-size-body;
    color: $color-text-secondary;
    margin-top: 4px;
  }
}
.usage-charts { margin-top: 24px; }
</style>
