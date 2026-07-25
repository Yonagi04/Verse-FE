<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { PlusOutlined } from '@ant-design/icons-vue'
import { useTenantStore } from '@/stores/tenant'
const router = useRouter()
const tenantStore = useTenantStore()
const loading = ref(false)

const columns = [
  {
    title: '租户名称',
    dataIndex: 'name',
    key: 'name',
  },
  {
    title: '类型',
    dataIndex: 'type',
    key: 'type',
  },
  {
    title: '角色',
    dataIndex: 'role',
    key: 'role',
  },
  {
    title: '加入时间',
    dataIndex: 'joinedAt',
    key: 'joinedAt',
  },
  {
    title: '最近访问',
    dataIndex: 'lastAccessedAt',
    key: 'lastAccessedAt',
  },
  {
    title: '操作',
    key: 'action',
  },
]

onMounted(async () => {
  loading.value = true
  try {
    await tenantStore.fetchTenants()
  } catch {
    message.error('获取租户列表失败')
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="tenant-list">
    <div class="page-header">
      <div>
        <h2 class="page-title">我的租户</h2>
        <p class="page-desc">查看你已加入的所有租户</p>
      </div>
      <a-button type="primary" @click="router.push('/tenants/create')">
        <PlusOutlined />
        创建租户
      </a-button>
    </div>

    <a-card :bordered="false">
      <a-table
        :columns="columns"
        :data-source="tenantStore.tenants"
        :loading="loading"
        row-key="tenantId"
        :pagination="false"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'type'">
            <a-tag :color="record.type === 'PERSONAL' ? 'default' : 'blue'">
              {{ record.type === 'PERSONAL' ? '个人' : '团队' }}
            </a-tag>
          </template>
          <template v-if="column.key === 'role'">
            <a-tag :color="record.role === 'SUPER_ADMIN' ? 'red' : record.role === 'ADMIN' ? 'orange' : 'default'">
              {{ record.role === 'SUPER_ADMIN' ? '超级管理员' : record.role === 'ADMIN' ? '管理员' : '成员' }}
            </a-tag>
          </template>
          <template v-if="column.key === 'joinedAt'">
            {{ new Date(record.joinedAt).toLocaleDateString() }}
          </template>
          <template v-if="column.key === 'lastAccessedAt'">
            {{ record.lastAccessedAt ? new Date(record.lastAccessedAt).toLocaleDateString() : '从未访问' }}
          </template>
          <template v-if="column.key === 'action'">
            <a-button type="link" size="small" disabled>进入</a-button>
          </template>
        </template>
      </a-table>
    </a-card>
  </div>
</template>

<style lang="scss" scoped>
.tenant-list {
  max-width: 1200px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
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
</style>
