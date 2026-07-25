<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { UserOutlined, LogoutOutlined } from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'

const router = useRouter()
const userStore = useUserStore()

async function handleLogout() {
  await userStore.signOut()
  message.success('已退出登录')
  router.push('/login')
}

function goProfile() {
  router.push('/profile')
}
</script>

<template>
  <a-dropdown placement="bottomRight">
    <div class="user-trigger">
      <a-avatar :size="32" style="background-color: $color-primary">
        <template #icon>
          <UserOutlined />
        </template>
      </a-avatar>
      <span class="username">{{ userStore.user?.nickname || userStore.user?.username || '用户' }}</span>
    </div>
    <template #overlay>
      <a-menu>
        <a-menu-item key="profile" @click="goProfile">
          <UserOutlined />
          <span style="margin-left: 8px">个人信息</span>
        </a-menu-item>
        <a-menu-divider />
        <a-menu-item key="logout" @click="handleLogout">
          <LogoutOutlined />
          <span style="margin-left: 8px">退出登录</span>
        </a-menu-item>
      </a-menu>
    </template>
  </a-dropdown>
</template>

<style lang="scss" scoped>
.user-trigger {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;

  .username {
    font-size: $font-size-body;
    color: $color-text-primary;
  }
}
</style>
