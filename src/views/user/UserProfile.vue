<script setup lang="ts">
import { reactive, ref, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import { useUserStore } from '@/stores/user'
import { getCurrentUser, updateProfile, updatePassword } from '@/api/user'
import type { UserUpdateReqDTO, UserRespDTO } from '@/types/user'

const userStore = useUserStore()
const loading = ref(false)
const pwdLoading = ref(false)
const profile = ref<UserRespDTO | null>(null)

const form = reactive<UserUpdateReqDTO>({
  nickname: '',
  email: '',
  phone: '',
})

const passwordForm = reactive({
  password: '',
})

onMounted(async () => {
  try {
    profile.value = await getCurrentUser(false)
    form.nickname = profile.value.nickname || ''
    form.email = profile.value.email || ''
    form.phone = profile.value.phone || ''
  } catch {
    // ignore
  }
})

async function handleUpdateProfile() {
  loading.value = true
  try {
    await updateProfile({ ...form })
    message.success('个人信息更新成功')
    await userStore.fetchProfile()
  } catch {
    // handled by interceptor
  } finally {
    loading.value = false
  }
}

async function handleUpdatePassword() {
  if (passwordForm.password.length < 8 || passwordForm.password.length > 32) {
    message.error('密码长度为 8-32 个字符')
    return
  }
  pwdLoading.value = true
  try {
    await updatePassword({ password: passwordForm.password })
    message.success('密码修改成功')
    passwordForm.password = ''
  } catch {
    // handled by interceptor
  } finally {
    pwdLoading.value = false
  }
}
</script>

<template>
  <div class="profile-page">
    <div class="page-header">
      <h2 class="page-title">个人信息</h2>
      <p class="page-desc">管理你的账户信息</p>
    </div>

    <a-row :gutter="24">
      <a-col :span="12">
        <a-card title="基本信息" :bordered="false">
          <template v-if="profile">
            <a-descriptions :column="1" bordered size="small">
              <a-descriptions-item label="用户 ID">{{ profile.userId }}</a-descriptions-item>
              <a-descriptions-item label="用户名">{{ profile.username }}</a-descriptions-item>
              <a-descriptions-item label="昵称">{{ profile.nickname || '-' }}</a-descriptions-item>
              <a-descriptions-item label="邮箱">{{ profile.email || '-' }}</a-descriptions-item>
              <a-descriptions-item label="手机号">{{ profile.phone || '-' }}</a-descriptions-item>
            </a-descriptions>
          </template>
          <a-skeleton v-else active />
        </a-card>
      </a-col>
      <a-col :span="12">
        <a-card title="编辑资料" :bordered="false" style="margin-bottom: 24px">
          <a-form :model="form" layout="vertical" @finish="handleUpdateProfile">
            <a-form-item name="nickname" label="昵称" :rules="[{ required: true, message: '请输入昵称' }]">
              <a-input v-model:value="form.nickname" placeholder="输入昵称" />
            </a-form-item>
            <a-form-item name="email" label="邮箱" :rules="[{ required: true, type: 'email', message: '请输入有效邮箱' }]">
              <a-input v-model:value="form.email" placeholder="输入邮箱" />
            </a-form-item>
            <a-form-item name="phone" label="手机号" :rules="[{ required: true, pattern: /^1[3-9]\d{9}$/, message: '请输入有效手机号' }]">
              <a-input v-model:value="form.phone" placeholder="输入手机号" />
            </a-form-item>
            <a-form-item>
              <a-button type="primary" html-type="submit" :loading="loading">
                保存修改
              </a-button>
            </a-form-item>
          </a-form>
        </a-card>

        <a-card title="修改密码" :bordered="false">
          <a-form :model="passwordForm" layout="vertical" @finish="handleUpdatePassword">
            <a-form-item name="password" label="新密码" :rules="[{ required: true, min: 8, max: 32, message: '密码长度为 8-32 个字符' }]">
              <a-input-password v-model:value="passwordForm.password" placeholder="输入新密码" />
            </a-form-item>
            <a-form-item>
              <a-button type="primary" html-type="submit" :loading="pwdLoading">
                修改密码
              </a-button>
            </a-form-item>
          </a-form>
        </a-card>
      </a-col>
    </a-row>
  </div>
</template>

<style lang="scss" scoped>
.profile-page {
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
