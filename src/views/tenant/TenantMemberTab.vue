<script setup lang="ts">
import { ref, computed, watch, h } from 'vue'
import { message, Modal } from 'ant-design-vue'
import { ExclamationCircleOutlined } from '@ant-design/icons-vue'
import { useTenantStore } from '@/stores/tenant'
import { updateMemberRole, removeMember } from '@/api/tenant'
import { formatDate } from '@/utils/date'
import TenantInviteModal from './TenantInviteModal.vue'
import type { TenantMemberInfo, TenantMembersListRespDTO } from '@/types/tenant'

const props = defineProps<{
  tenantId: string
}>()

const tenantStore = useTenantStore()

const membersData = ref<TenantMembersListRespDTO | null>(null)
const loading = ref(false)
const pageNum = ref(1)
const pageSize = ref(10)
const inviteModalVisible = ref(false)
const roleLoading = ref<number | null>(null)

// Role hierarchy
const ROLE_RANK: Record<string, number> = { SUPER_ADMIN: 3, ADMIN: 2, MEMBER: 1 }
const ROLE_LABELS: Record<string, string> = { SUPER_ADMIN: '超级管理员', ADMIN: '管理员', MEMBER: '成员' }

const currentUserRole = computed(() => {
  const t = tenantStore.tenants.find((t) => t.tenantId === props.tenantId)
  return t?.role ?? null
})

function canManage(): boolean {
  const role = currentUserRole.value
  return role === 'SUPER_ADMIN' || role === 'ADMIN'
}

function canOperateOnRole(targetRole: string): boolean {
  const myRank = ROLE_RANK[currentUserRole.value ?? ''] ?? 0
  const targetRank = ROLE_RANK[targetRole] ?? 0
  return myRank > targetRank
}

function getAvailableRoles(targetRole: string): string[] {
  const myRank = ROLE_RANK[currentUserRole.value ?? ''] ?? 0
  const allRoles = Object.keys(ROLE_RANK).filter((r) => ROLE_RANK[r] < myRank)
  // Always include the target's current role
  if (!allRoles.includes(targetRole)) allRoles.push(targetRole)
  return allRoles
}

const columns = computed(() => {
  const cols = [
    {
      title: '成员',
      key: 'member',
      width: 240,
    },
    {
      title: '角色',
      key: 'role',
      width: 120,
    },
    {
      title: '加入时间',
      key: 'joinedAt',
    },
  ]
  if (canManage()) {
    cols.push({ title: '操作', key: 'action', width: 200 })
  }
  return cols
})

async function fetchMembers() {
  loading.value = true
  try {
    membersData.value = await tenantStore.fetchMembers(props.tenantId, pageNum.value, pageSize.value)
  } catch {
    // handled by interceptor
  } finally {
    loading.value = false
  }
}

watch(() => props.tenantId, () => { pageNum.value = 1; pageSize.value = 10; fetchMembers() }, { immediate: true })
watch([pageNum, pageSize], () => { fetchMembers() })

async function handleRoleChange(member: TenantMemberInfo, newRole: string) {
  if (member.role === newRole) return
  roleLoading.value = member.userId
  try {
    await updateMemberRole(props.tenantId, member.userId, { newRole })
    message.success(`已将「${member.nickname || member.username}」的角色更改为「${ROLE_LABELS[newRole]}」`)
    fetchMembers()
  } catch {
    // handled by interceptor
  } finally {
    roleLoading.value = null
  }
}

function handleRemove(member: TenantMemberInfo) {
  Modal.confirm({
    title: '移除成员',
    icon: h(ExclamationCircleOutlined, { style: 'color: #faad14' }),
    content: h('div', [
      h('div', { style: 'margin-bottom: 12px;' }, [
        '确认将 ', h('strong', member.nickname || member.username), ' 从当前租户中移除？',
      ]),
      h('ul', { style: 'color: #667085; font-size: 13px; padding-left: 20px; margin: 0;' }, [
        h('li', '移除后该成员将无法访问此租户'),
        h('li', '成员的个人数据不会被删除'),
        h('li', '可随时通过邀请码重新加入'),
      ]),
    ]),
    okText: '确认移除',
    okType: 'danger',
    cancelText: '取消',
    onOk: async () => {
      try {
        await removeMember(props.tenantId, member.userId)
        message.success(`已将「${member.nickname || member.username}」移出租户`)
        // Go to previous page if current page is empty
        if (membersData.value && membersData.value.tenantMembers.length === 1 && pageNum.value > 1) {
          pageNum.value--
        } else {
          fetchMembers()
        }
      } catch {
        // handled by interceptor
      }
    },
  })
}

function jumpToPage(totalPages: number) {
  const input = document.getElementById('memberPageJump') as HTMLInputElement
  if (!input) return
  const page = parseInt(input.value)
  if (isNaN(page) || page < 1 || page > totalPages) return
  pageNum.value = page
}
</script>

<template>
  <div class="member-tab">
    <div class="member-toolbar">
      <a-button @click="inviteModalVisible = true">
        生成邀请码
      </a-button>
    </div>

    <a-table
      :columns="columns"
      :data-source="membersData?.tenantMembers ?? []"
      :loading="loading"
      :pagination="false"
      row-key="userId"
    >
      <!-- 成员 -->
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'member'">
          <div class="member-info">
            <span class="member-name">{{ record.nickname || record.username }}</span>
            <span v-if="record.nickname" class="member-username">@{{ record.username }}</span>
          </div>
        </template>

        <!-- 角色 -->
        <template v-if="column.key === 'role'">
          <a-tag
            :color="
              record.role === 'SUPER_ADMIN'
                ? 'red'
                : record.role === 'ADMIN'
                  ? 'orange'
                  : 'default'
            "
          >
            {{ ROLE_LABELS[record.role] || record.role }}
          </a-tag>
        </template>

        <!-- 加入时间 -->
        <template v-if="column.key === 'joinedAt'">
          {{ formatDate(record.joinedAt) }}
        </template>

        <!-- 操作 -->
        <template v-if="column.key === 'action'">
          <div v-if="record.userId === 0" class="action-placeholder">
            当前用户
          </div>
          <div v-else-if="!canOperateOnRole(record.role)" class="action-placeholder">
            无权限操作
          </div>
          <div v-else class="action-group">
            <a-select
              :value="record.role"
              size="small"
              style="width: 110px;"
              :loading="roleLoading === record.userId"
              @change="(val: string) => handleRoleChange(record, val)"
            >
              <a-select-option
                v-for="r in getAvailableRoles(record.role)"
                :key="r"
                :value="r"
              >
                {{ ROLE_LABELS[r] }}
              </a-select-option>
            </a-select>
            <a-button type="link" danger size="small" @click="handleRemove(record)">
              移除
            </a-button>
          </div>
        </template>
      </template>
    </a-table>

    <!-- Pagination -->
    <div v-if="membersData" class="member-pagination">
      <div class="pagination-left">
        <span class="page-size-label">每页</span>
        <a-select
          :value="pageSize"
          size="small"
          style="width: 70px;"
          @change="(val: number) => pageSize = val"
        >
          <a-select-option :value="5">5</a-select-option>
          <a-select-option :value="10">10</a-select-option>
          <a-select-option :value="20">20</a-select-option>
          <a-select-option :value="50">50</a-select-option>
        </a-select>
        <span class="page-size-label">条</span>
      </div>
      <div class="pagination-center">
        <span class="page-total">共 {{ membersData.total }} 人</span>
      </div>
      <div class="pagination-right">
        <span class="page-jump-label">跳至</span>
        <a-input
          id="memberPageJump"
          size="small"
          style="width: 52px; text-align: center;"
          :placeholder="String(pageNum)"
          @keydown.enter="jumpToPage(membersData.totalPages)"
        />
        <span class="page-jump-label">页</span>
      </div>
    </div>

    <!-- Invite Modal -->
    <TenantInviteModal
      v-model:visible="inviteModalVisible"
      :tenant-id="tenantId"
    />
  </div>
</template>

<style lang="scss" scoped>
.member-toolbar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 16px;
}

.member-info {
  display: flex;
  align-items: center;
  gap: 6px;
}

.member-name {
  font-weight: 500;
  color: $color-text-primary;
}

.member-username {
  font-size: 12px;
  color: #98a2b3;
}

.action-placeholder {
  font-size: 12px;
  color: #98a2b3;
}

.action-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.member-pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 16px;
  padding-top: 16px;
}

.pagination-left,
.pagination-center,
.pagination-right {
  display: flex;
  align-items: center;
  gap: 6px;
}

.page-size-label,
.page-jump-label {
  font-size: 13px;
  color: $color-text-secondary;
}

.page-total {
  font-size: 13px;
  color: $color-text-secondary;
  margin-right: 8px;
}
</style>
