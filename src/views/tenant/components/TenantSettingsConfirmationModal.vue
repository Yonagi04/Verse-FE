<script setup lang="ts">
import type { TenantSettingsConfirmation, TenantSettingsSaveRequest } from '@/types/tenantCostBudget'
import { formatBudgetDateTime } from '@/utils/date'
import { formatBudgetYuan } from '@/utils/costBudget'
defineProps<{ pending: TenantSettingsConfirmation | null; busy: boolean; target: TenantSettingsSaveRequest | null }>()
const labels = { name: '租户名称', description: '简介', joinApprovalMode: '加入审批', auditEnabled: '调用审计', activityRecordingEnabled: '动态记录', playgroundEnabled: 'PlayGround', rateLimitRpm: 'RPM', rateLimitTpm: 'TPM', dailyLimitFen: '日限额', weeklyLimitFen: '周限额', monthlyLimitFen: '月限额' }
const display = (value: unknown) => typeof value === 'boolean' ? value ? '开启' : '关闭' : value ?? '不限/空'
const emit = defineEmits<{ confirm: []; cancel: [] }>()
</script>
<template>
  <a-modal :open="!!pending" title="确认保存整份租户设置" :confirm-loading="busy" :cancel-button-props="{ disabled: busy }" :closable="!busy" :mask-closable="false" @ok="emit('confirm')" @cancel="emit('cancel')">
    <template v-if="pending">
      <p class="warning">{{ pending.warningMessage }}</p>
      <p v-for="hit in pending.immediateLimits" :key="hit.period">{{ hit.period }}：{{ formatBudgetDateTime(hit.periodEnd) }}</p>
      <p>确认期限：{{ formatBudgetDateTime(pending.confirmationExpiresAt) }}。过期后点击确认会刷新预览，需要再次确认。</p>
      <template v-if="pending.currentSnapshot && target">
        <a-alert type="warning" message="正式设置已发生变化，请对照后再次明确确认；本次拟保存内容保持不变。" />
        <table><thead><tr><th>设置</th><th>最新已保存</th><th>本次拟保存</th></tr></thead><tbody>
          <tr v-for="key in (['name','description','joinApprovalMode','auditEnabled','activityRecordingEnabled','playgroundEnabled','rateLimitRpm','rateLimitTpm'] as const)" :key="key"><td>{{ labels[key] }}</td><td>{{ display(pending.currentSnapshot.settings[key]) }}</td><td>{{ display(target[key]) }}</td></tr>
          <tr v-for="key in (['dailyLimitFen','weeklyLimitFen','monthlyLimitFen'] as const)" :key="key"><td>{{ labels[key] }}</td><td>{{ formatBudgetYuan(pending.currentSnapshot.costLimit[key]) }}</td><td>{{ formatBudgetYuan(target.costLimit?.[key] ?? null) }}</td></tr>
          <tr><td>预算开关</td><td>{{ display(pending.currentSnapshot.costLimit.enabled) }}</td><td>{{ display(target.costLimit?.enabled) }}</td></tr>
          <tr><td>预警</td><td>{{ pending.currentSnapshot.costWarning.enabled }} / {{ pending.currentSnapshot.costWarning.thresholdPercent }}% / {{ pending.currentSnapshot.costWarning.channels.join('、') }}</td><td>{{ target.costWarning?.enabled }} / {{ target.costWarning?.thresholdPercent }}% / {{ target.costWarning?.channels?.join('、') }}</td></tr>
        </tbody></table>
      </template>
    </template>
  </a-modal>
</template>
<style lang="scss" scoped>
.warning { white-space: pre-line; }
table { width: 100%; table-layout: fixed; font-size: $font-size-caption; overflow-wrap: anywhere; }
td, th { padding: 6px; text-align: left; }
</style>
