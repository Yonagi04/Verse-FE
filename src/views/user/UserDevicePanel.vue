<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { message, Modal } from 'ant-design-vue'
import {
  DesktopOutlined,
  LaptopOutlined,
  MobileOutlined,
  TabletOutlined,
  WindowsOutlined,
  AppleOutlined,
  AndroidOutlined,
} from '@ant-design/icons-vue'
import { getDevices, kickDevice } from '@/api/user'
import type { DeviceInfo } from '@/types/user'

// ========== State ==========
const loading = ref(false)
const kicking = ref(false)
const devices = ref<DeviceInfo[]>([])

// ========== Fetch ==========
async function fetchDevices() {
  loading.value = true
  try {
    devices.value = await getDevices()
  } catch {
    // handled by interceptor
  } finally {
    loading.value = false
  }
}

onMounted(fetchDevices)

// ========== Device Icon ==========
function getDeviceIcon(deviceName: string) {
  const lower = deviceName.toLowerCase()
  if (lower.includes('iphone') || lower.includes('android')) return 'mobile'
  if (lower.includes('ipad') || lower.includes('tablet')) return 'tablet'
  if (lower.includes('mac')) return 'mac'
  if (lower.includes('windows')) return 'windows'
  return 'desktop'
}

// ========== Format Time ==========
function formatTime(dateStr: string) {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// ========== Kick Device ==========
function handleKick(device: DeviceInfo) {
  Modal.confirm({
    title: '踢设备下线',
    content: `确定要将设备「${device.deviceName}」踢下线吗？该设备的下次请求将被拒绝。`,
    okText: '确认踢下线',
    cancelText: '取消',
    okType: 'danger',
    onOk: async () => {
      try {
        await kickDevice(device.deviceId)
        message.success('设备已踢下线')
        await fetchDevices()
      } catch {
        // handled by interceptor
      }
    },
  })
}
</script>

<template>
  <div class="device-panel">
    <h2 class="panel-title">登录设备管理</h2>
    <p class="panel-desc">查看和管理所有登录过的设备</p>

    <!-- Loading -->
    <div v-if="loading" class="loading-state">
      <a-spin />
      <span style="margin-left: 12px; color: #bfbfbf;">加载中...</span>
    </div>

    <!-- Empty -->
    <div v-else-if="devices.length === 0" class="empty-state">
      <DesktopOutlined style="font-size: 48px; color: #d9d9d9;" />
      <p style="color: #bfbfbf; margin-top: 16px;">暂无登录设备</p>
    </div>

    <!-- Device List -->
    <div v-else class="device-list">
      <div
        v-for="device in devices"
        :key="device.deviceId"
        class="device-card"
        :class="{ 'current-device': device.currentDevice }"
      >
        <div class="device-icon-col">
          <div class="device-icon" :class="getDeviceIcon(device.deviceName)">
            <LaptopOutlined v-if="getDeviceIcon(device.deviceName) === 'mac'" />
            <WindowsOutlined v-else-if="getDeviceIcon(device.deviceName) === 'windows'" />
            <MobileOutlined v-else-if="getDeviceIcon(device.deviceName) === 'mobile'" />
            <TabletOutlined v-else-if="getDeviceIcon(device.deviceName) === 'tablet'" />
            <DesktopOutlined v-else />
          </div>
        </div>

        <div class="device-info">
          <div class="device-header">
            <span class="device-name">{{ device.deviceName }}</span>
            <a-tag v-if="device.currentDevice" color="blue">当前设备</a-tag>
            <a-tag v-else-if="device.online" color="green">在线</a-tag>
            <a-tag v-else color="default">离线</a-tag>
          </div>
          <div class="device-meta">
            <span>{{ device.ip }}</span>
            <span class="meta-divider">·</span>
            <span>{{ device.region }}</span>
            <span class="meta-divider">·</span>
            <span>最近登录 {{ formatTime(device.lastLoginAt) }}</span>
          </div>
        </div>

        <div class="device-actions">
          <a-button
            v-if="!device.currentDevice && device.online"
            danger
            size="small"
            @click="handleKick(device)"
          >
            踢下线
          </a-button>
          <a-button
            v-else-if="!device.currentDevice && !device.online"
            size="small"
            disabled
          >
            已离线
          </a-button>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.device-panel {
  max-width: 720px;
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

// ========== States ==========
.loading-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 200px;
}

.loading-state {
  flex-direction: row;
}

// ========== Device List ==========
.device-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.device-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 20px;
  background: $color-bg;
  border: 1px solid $color-border;
  border-radius: $radius-card;
  transition: border-color 0.15s;

  &:hover {
    border-color: #d9d9d9;
  }

  &.current-device {
    border-color: $color-primary;
    background: #f6f9ff;
  }
}

// ========== Device Icon ==========
.device-icon-col {
  flex-shrink: 0;
}

.device-icon {
  width: 44px;
  height: 44px;
  border-radius: $radius-button;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  color: $color-text-secondary;
  background: $color-bg-secondary;

  .current-device & {
    color: $color-primary;
    background: #e6f4ff;
  }
}

// ========== Device Info ==========
.device-info {
  flex: 1;
  min-width: 0;
}

.device-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.device-name {
  font-size: $font-size-body;
  font-weight: 500;
  color: $color-text-primary;
}

.device-meta {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: $font-size-caption;
  color: $color-text-secondary;
  flex-wrap: wrap;
}

.meta-divider {
  color: #d9d9d9;
}

// ========== Actions ==========
.device-actions {
  flex-shrink: 0;
}
</style>
