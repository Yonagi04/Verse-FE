<script setup lang="ts">
import { computed } from 'vue'
import type { NamePath, Rule } from 'ant-design-vue/es/form/interface'

// 文本和字符串单选字段复用父级Ant Form的校验、错误状态及输入框关联。
const props = withDefaults(defineProps<{
  name: NamePath
  label: string
  message?: string
  rules?: Rule[]
}>(), { rules: () => [] })
const fieldRules = computed<Rule[]>(() => [
  { required: true, whitespace: true, message: props.message || `请填写${props.label}` },
  ...props.rules,
])
</script>

<template>
  <a-form-item :name="name" :label="label" :rules="fieldRules" :validate-trigger="['change', 'blur']" validate-first required>
    <slot />
  </a-form-item>
</template>

<style scoped>
:deep(.ant-form-item-explain-error) { text-align: left; }
</style>
