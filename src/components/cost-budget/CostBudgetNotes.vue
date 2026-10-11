<script setup lang="ts">
import { InfoCircleOutlined } from '@ant-design/icons-vue'
</script>

<template>
  <aside class="cost-notes">
    <InfoCircleOutlined aria-hidden="true" />
    <div>
      <h4>费用口径</h4>
      <p>仅累计已配置价格且可计算的预估费用，未计价不代表免费。已开始的调用可能继续产生费用。</p>
    </div>
  </aside>
</template>

<style lang="scss" scoped>
.cost-notes {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding-top: 16px;
  border-top: 1px solid $color-border;
  color: $color-text-secondary;

  h4 { margin: 0 0 4px; font-size: $font-size-caption; font-weight: 500; color: $color-text-secondary; }
  p { margin: 0; font-size: $font-size-caption; line-height: 1.8; }
}
</style>
