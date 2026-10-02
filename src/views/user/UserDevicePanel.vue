<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { message, Modal } from 'ant-design-vue'
import { DesktopOutlined, LaptopOutlined, MobileOutlined, TabletOutlined, WindowsOutlined, ReloadOutlined, LockOutlined, InfoCircleOutlined } from '@ant-design/icons-vue'
import { getDevices, kickDevice } from '@/api/user'
import type { DeviceInfo } from '@/types/user'

const loading = ref(false)
const failed = ref(false)
const kicking = ref<string | null>(null)
const confirming = ref(false)
const devices = ref<DeviceInfo[]>([])
async function fetchDevices() {
  if (loading.value) return
  loading.value = true
  failed.value = false
  try {
    devices.value = await getDevices()
  } catch {
    failed.value = true
    // handled by interceptor
  } finally {
    loading.value = false
  }
}
onMounted(fetchDevices)
function getDeviceIcon(deviceName: string) {
  const lower = deviceName.toLowerCase()
  if (lower.includes('iphone') || lower.includes('android')) return MobileOutlined
  if (lower.includes('ipad') || lower.includes('tablet')) return TabletOutlined
  if (lower.includes('mac')) return LaptopOutlined
  if (lower.includes('windows')) return WindowsOutlined
  return DesktopOutlined
}
function formatTime(value: string) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}
function handleKick(device: DeviceInfo) {
  if (device.currentDevice || !device.online || confirming.value || kicking.value) return
  confirming.value = true
  Modal.confirm({
    title: '踢设备下线',
    content: `确定要将「${device.deviceName}」踢下线吗？该设备需要重新登录才能继续使用。`,
    okText: '确认踢下线', cancelText: '取消', okType: 'danger',
    afterClose: () => { confirming.value = false },
    onOk: async () => {
      if (kicking.value) return
      kicking.value = device.deviceId
      try {
        await kickDevice(device.deviceId)
        message.success('设备已踢下线')
        await fetchDevices()
      } catch (error) {
        // handled by interceptor
        throw error
      } finally {
        kicking.value = null
      }
    },
  })
}
</script>

<template>
  <section class="profile-card panel-card">
    <div class="panel-heading"><div><h2>登录设备</h2><p>查看账户的登录设备。发现不认识的设备时，可以将其踢下线。</p></div><a-button :loading="loading" :disabled="!!kicking" @click="fetchDevices"><ReloadOutlined />刷新</a-button></div>
    <div v-if="loading" class="state-card" aria-busy="true"><a-spin /><p>正在加载登录设备…</p></div>
    <div v-else-if="failed" class="state-card"><InfoCircleOutlined /><h3>登录设备暂时无法加载</h3><a-button type="primary" @click="fetchDevices">重新加载</a-button></div>
    <div v-else-if="!devices.length" class="state-card"><DesktopOutlined /><p>暂无登录设备</p></div>
    <div v-else class="device-list">
      <article v-for="device in devices" :key="device.deviceId" class="device" :class="{ current: device.currentDevice }">
        <span class="device-mark"><component :is="getDeviceIcon(device.deviceName)" /></span>
        <div class="device-copy">
          <div class="device-title"><strong>{{ device.deviceName }}</strong><a-tag v-if="device.currentDevice" color="blue">当前设备</a-tag><a-tag v-else-if="device.online" color="success">在线</a-tag><a-tag v-else>离线</a-tag></div>
          <div class="device-meta"><span class="mono">{{ device.ip }}</span><span>{{ device.region || '未知地区' }}</span><span>最近登录 {{ formatTime(device.lastLoginAt) }}</span></div>
        </div>
        <a-button v-if="!device.currentDevice" :danger="device.online" :disabled="!device.online || !!kicking" :loading="kicking === device.deviceId" @click="handleKick(device)">{{ device.online ? '踢下线' : '已离线' }}</a-button>
      </article>
    </div>
    <p class="notice"><LockOutlined />当前设备无法在此踢下线。被踢下线的设备需要重新登录。</p>
  </section>
</template>

<style lang="scss" scoped>
@use './user-center';
.device-list { display: flex; flex-direction: column; gap: 12px; }
.device {
  display: flex; align-items: center; gap: 16px; padding: 20px; border: 1px solid $color-border; border-radius: $radius-input;
  &.current { background: $color-primary-bg; border-color: theme-alpha('link', 0.45); }
}
.device-mark {
  width: 44px; height: 44px; border-radius: $radius-button; background: $color-bg-secondary; display: grid; place-items: center; color: $color-text-secondary; flex-shrink: 0; font-size: 22px;
  .current & { background: theme-alpha('link', 0.08); color: $color-primary; }
}
.device-copy { flex: 1; min-width: 0; }
.device-title {
  display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-bottom: 8px;
  strong { font-weight: 500; overflow-wrap: anywhere; }
  :deep(.ant-tag) { margin: 0; }
}
.device-meta { display: flex; flex-wrap: wrap; gap: 4px 10px; font-size: $font-size-caption; color: $color-text-secondary; line-height: 1.7; overflow-wrap: anywhere; }
@container profile (max-width: 540px) {
  .device { flex-wrap: wrap; padding: 16px; gap: 12px; }
  .device > :deep(.ant-btn) { margin-left: 56px; }
  .device-copy { flex-basis: calc(100% - 56px); }
}
</style>
