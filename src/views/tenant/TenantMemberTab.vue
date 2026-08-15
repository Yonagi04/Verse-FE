<script setup lang="ts">
import { ref, computed, watch, h } from 'vue'
import { message, Modal } from 'ant-design-vue'
import { ExclamationCircleOutlined } from '@ant-design/icons-vue'
import { useTenantStore } from '@/stores/tenant'
import { useUserStore } from '@/stores/user'
import { updateMemberRole, removeMember, getUnreviewedJoinRequestCount } from '@/api/tenant'
import { formatDate } from '@/utils/date'
import TenantJoinRequestPanel from './TenantJoinRequestPanel.vue'
import UserPublicProfileModal from './UserPublicProfileModal.vue'
import PaginationBar from '@/components/PaginationBar.vue'
import type { TenantMemberInfo, TenantMembersListRespDTO } from '@/types/tenant'

const props = defineProps<{
  tenantId: string
}>()

const tenantStore = useTenantStore()
const userStore = useUserStore()

const membersData = ref<TenantMembersListRespDTO | null>(null)
const loading = ref(false)
const pageNum = ref(1)
const pageSize = ref(10)
const roleLoading = ref<number | null>(null)

// Sub-tab state: only for ADMIN/SUPER_ADMIN
const memberSubTab = ref<'members' | 'approval'>('members')
const pendingApprovalCount = ref(0)

// Public profile modal
const profileVisible = ref(false)
const profileUserId = ref<number | null>(null)

function openProfile(member: TenantMemberInfo) {
  profileUserId.value = member.userId
  profileVisible.value = true
}

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
  if (!allRoles.includes(targetRole)) allRoles.push(targetRole)
  return allRoles
}

function isCurrentUser(member: TenantMemberInfo): boolean {
  return String(member.userId) === userStore.user?.userId
}

const columns = computed(() => {
  const cols = [
    { title: '成员', key: 'member', width: 240 },
    { title: '角色', key: 'role', width: 120 },
    { title: '加入时间', key: 'joinedAt' },
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

async function fetchPendingCount() {
  if (!canManage()) return
  try {
    const resp = await getUnreviewedJoinRequestCount(props.tenantId)
    pendingApprovalCount.value = resp
  } catch {
    // handled by interceptor
  }
}

watch(() => props.tenantId, () => {
  pageNum.value = 1
  pageSize.value = 10
  memberSubTab.value = 'members'
  fetchMembers()
  fetchPendingCount()
}, { immediate: true })
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

</script>

<template>
  <div class="member-tab">
    <!-- Sub-tabs for ADMIN/SUPER_ADMIN -->
    <div v-if="canManage()" class="member-subtabs">
      <button
        class="member-subtab"
        :class="{ active: memberSubTab === 'members' }"
        @click="memberSubTab = 'members'"
      >
        成员列表
      </button>
      <button
        class="member-subtab"
        :class="{ active: memberSubTab === 'approval' }"
        @click="memberSubTab = 'approval'"
      >
        加入审批
        <span v-if="pendingApprovalCount > 0" class="approval-badge">{{ pendingApprovalCount }}</span>
      </button>
    </div>

    <!-- Member List -->
    <template v-if="!canManage() || memberSubTab === 'members'">
      <a-table
        :columns="columns"
        :data-source="membersData?.tenantMembers ?? []"
        :loading="loading"
        :pagination="false"
        row-key="userId"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'member'">
            <div class="member-info" @click="openProfile(record)">
              <span class="member-name">{{ record.nickname || record.username }}</span>
              <span v-if="record.nickname" class="member-username">@{{ record.username }}</span>
            </div>
          </template>

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

          <template v-if="column.key === 'joinedAt'">
            {{ formatDate(record.joinedAt) }}
          </template>

          <template v-if="column.key === 'action'">
            <div v-if="isCurrentUser(record)" class="action-placeholder">
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

      <PaginationBar
        v-if="membersData"
        v-model:current-page="pageNum"
        v-model:page-size="pageSize"
        :total-pages="membersData.totalPages"
        :total="membersData.total"
        :page-size="pageSize"
        page-jump-id="memberPageJump"
        total-label="人"
      />
    </template>

    <!-- Join Request Approval (Admin only) -->
    <template v-if="canManage() && memberSubTab === 'approval'">
      <TenantJoinRequestPanel :tenant-id="tenantId" @changed="fetchPendingCount" />
    </template>

    <!-- Public Profile Modal -->
    <UserPublicProfileModal
      :visible="profileVisible"
      :user-id="profileUserId ?? 0"
      @close="profileVisible = false"
    />

  </div>
</template>

<style lang="scss" scoped>
.member-subtabs {
  display: flex;
  border-bottom: 1px solid $color-border;
  margin-bottom: 16px;
}

.member-subtab {
  position: relative;
  padding: 8px 12px;
  font-size: 13px;
  color: $color-text-secondary;
  cursor: pointer;
  border: none;
  background: none;
  font-family: inherit;
  transition: color 0.2s;

  &:hover {
    color: $color-primary;
  }

  &.active {
    color: $color-primary;
    font-weight: 500;

    &::after {
      content: '';
      position: absolute;
      bottom: -1px;
      left: 0;
      right: 0;
      height: 2px;
      background: $color-primary;
    }
  }
}

.member-info {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;

  &:hover .member-name {
    color: $color-primary;
  }
}

.member-name {
  font-weight: 500;
  color: $color-text-primary;
  transition: color 0.15s;
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

.approval-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 14px;
  height: 14px;
  padding: 0 3px;
  margin-left: 4px;
  border-radius: 7px;
  background: $color-danger;
  color: #fff;
  font-size: 10px;
  font-weight: 600;
  line-height: 1;
}

</style>
