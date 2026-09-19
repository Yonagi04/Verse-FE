<script setup lang="ts">
import { computed } from 'vue'
import {
  ApiOutlined,
  ClockCircleOutlined,
  LinkOutlined,
  SettingOutlined,
  TeamOutlined,
} from '@ant-design/icons-vue'
import { formatDateTime } from '@/utils/date'
import { formatTenantActivity, type TenantActivityIcon } from '@/utils/tenantActivity'
import type { TenantActivityItemRespDTO } from '@/types/tenant'

const props = withDefaults(defineProps<{
  item: TenantActivityItemRespDTO
  compact?: boolean
}>(), {
  compact: false,
})

const formatted = computed(() => formatTenantActivity(props.item))
const iconComponents: Record<TenantActivityIcon, typeof SettingOutlined> = {
  setting: SettingOutlined,
  member: TeamOutlined,
  invite: LinkOutlined,
  service: ApiOutlined,
  default: ClockCircleOutlined,
}
</script>

<template>
  <article class="activity-entry" :class="{ compact }">
    <span class="activity-icon" :class="`kind-${formatted.icon}`">
      <component :is="iconComponents[formatted.icon]" />
    </span>
    <div class="activity-content">
      <div class="activity-title">
        {{ formatted.action }}
        <strong v-if="formatted.targetName">{{ formatted.targetName }}</strong>
      </div>
      <div v-if="formatted.detailText && !compact" class="activity-detail">
        {{ formatted.detailText }}
      </div>
      <div class="activity-meta">
        <span>{{ formatted.actorName }}</span>
        <span>·</span>
        <time :datetime="item.occurredAt">{{ formatDateTime(item.occurredAt) }}</time>
      </div>
    </div>
  </article>
</template>

<style lang="scss" scoped>
.activity-entry {
  display: flex;
  gap: 12px;
  min-width: 0;
  padding: 14px 0;
}

.activity-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  flex: 0 0 auto;
  border-radius: 50%;
  background: #e6f4ff;
  color: $color-primary;

  &.kind-member { background: #f6ffed; color: $color-success; }
  &.kind-invite { background: #fffbe6; color: $color-warning; }
  &.kind-service { background: #f9f0ff; color: #722ed1; }
  &.kind-default { background: $color-bg-secondary; color: $color-text-secondary; }
}

.activity-content {
  min-width: 0;
  flex: 1;
}

.activity-title {
  color: $color-text-primary;
  line-height: 1.55;

  strong {
    margin-left: 5px;
    font-weight: 600;
  }
}

.activity-detail,
.activity-meta {
  margin-top: 4px;
  color: $color-text-secondary;
  font-size: $font-size-caption;
  line-height: 1.5;
}

.activity-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.compact {
  padding: 11px 0;

  .activity-icon {
    width: 30px;
    height: 30px;
  }
}
</style>
