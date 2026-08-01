<script setup lang="ts">
import { computed, h } from 'vue'
import type { VNode } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import {
  DashboardOutlined,
  TeamOutlined,
  ApiOutlined,
  BarChartOutlined,
  FileTextOutlined,
} from '@ant-design/icons-vue'

const router = useRouter()
const route = useRoute()

interface MenuItem {
  key: string
  icon: () => VNode
  label: string
  children?: MenuItem[]
}

const menuItems: MenuItem[] = [
  {
    key: '/dashboard',
    icon: () => h(DashboardOutlined),
    label: '仪表盘',
  },
  {
    key: '/tenants',
    icon: () => h(TeamOutlined),
    label: '租户管理',
    children: [
      { key: '/tenants', icon: () => h(TeamOutlined), label: '我的租户' },
    ],
  },
  {
    key: 'llm',
    icon: () => h(ApiOutlined),
    label: 'LLM 服务',
    children: [
      { key: '/llm-services', icon: () => h(ApiOutlined), label: '服务管理' },
      { key: '/api-keys', icon: () => h(ApiOutlined), label: 'API Key' },
    ],
  },
  {
    key: 'usage',
    icon: () => h(BarChartOutlined),
    label: '用量',
    children: [
      { key: '/token-usage', icon: () => h(BarChartOutlined), label: 'Token 消耗' },
      { key: '/logs', icon: () => h(FileTextOutlined), label: '调用日志' },
    ],
  },
]

const selectedKeys = computed(() => {
  const path = route.path
  // 子菜单匹配
  if (path.startsWith('/tenants')) return ['/tenants']
  return [path]
})

function handleMenuClick({ key }: { key: string }) {
  // 占位路径不做跳转
  if (key.startsWith('/') && !key.includes('llm-services') && !key.includes('api-keys') && !key.includes('token-usage') && !key.includes('/logs')) {
    router.push(key)
  }
}
</script>

<template>
  <a-menu
    mode="inline"
    theme="light"
    :selected-keys="selectedKeys"
    :items="menuItems"
    @click="handleMenuClick"
  />
</template>
