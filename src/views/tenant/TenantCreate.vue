<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { createTenant } from '@/api/tenant'
import type { TenantCreateReqDTO } from '@/types/tenant'

const router = useRouter()
const loading = ref(false)

const form = reactive<TenantCreateReqDTO>({
  name: '',
  description: '',
})

async function handleSubmit() {
  loading.value = true
  try {
    await createTenant({ ...form })
    message.success('租户创建成功')
    router.push('/tenants')
  } catch {
    // handled by interceptor
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="tenant-create">
    <div class="page-header">
      <h2 class="page-title">创建租户</h2>
      <p class="page-desc">创建一个新的团队租户</p>
    </div>

    <a-card :bordered="false" style="max-width: 600px">
      <a-form :model="form" layout="vertical" @finish="handleSubmit">
        <a-form-item
          name="name"
          label="租户名称"
          :rules="[
            { required: true, message: '请输入租户名称' },
            { max: 25, message: '不超过 25 个字符' },
          ]"
        >
          <a-input v-model:value="form.name" placeholder="输入租户名称" />
        </a-form-item>
        <a-form-item
          name="description"
          label="描述"
          :rules="[{ max: 200, message: '不超过 200 个字符' }]"
        >
          <a-textarea
            v-model:value="form.description"
            placeholder="输入租户描述（可选）"
            :rows="3"
          />
        </a-form-item>
        <a-form-item>
          <a-space>
            <a-button type="primary" html-type="submit" :loading="loading">
              创建
            </a-button>
            <a-button @click="router.push('/tenants')">取消</a-button>
          </a-space>
        </a-form-item>
      </a-form>
    </a-card>
  </div>
</template>

<style lang="scss" scoped>
.tenant-create {
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
</style>
