<script setup lang="ts">
import { useUserStore } from '@/stores/user'
import {
  DashboardOutlined,
  ApiOutlined,
  TeamOutlined,
  BarChartOutlined,
} from '@ant-design/icons-vue'

const userStore = useUserStore()
</script>

<template>
  <div class="dashboard">
    <div class="page-header">
      <h2 class="page-title">仪表盘</h2>
      <p class="page-desc">欢迎回来，{{ userStore.user?.nickname || userStore.user?.username }}</p>
    </div>

    <a-row :gutter="[16, 16]">
      <a-col :span="6">
        <a-card class="stat-card">
          <div class="stat-content">
            <TeamOutlined class="stat-icon" />
            <div>
              <div class="stat-value">--</div>
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
              <div class="stat-value">--</div>
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
              <div class="stat-value">--</div>
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
              <div class="stat-value">--</div>
              <div class="stat-label">API 调用</div>
            </div>
          </div>
        </a-card>
      </a-col>
    </a-row>

    <a-card title="快速开始" style="margin-top: 24px">
      <a-empty description="更多功能即将上线" />
    </a-card>
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
</style>
