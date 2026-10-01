<script setup lang="ts">
import { reactive, watch } from 'vue'
const props = defineProps<{ value?: string }>()
const emit = defineEmits<{ 'update:value': [value: string] }>()
const form = reactive({ system: true, temperature: false, tempMin: 0, tempMax: 2, topP: false, topMin: 0, topMax: 1, output: false, maxTokens: 8192 })
watch(() => props.value, value => {
  let p: Record<string, any> = {}; try { p = JSON.parse(value || '{}') } catch { /* 未配置时保持禁用。 */ }
  Object.assign(form, { system: p.system !== false, temperature: !!p.temperature, tempMin: p.temperature?.min ?? 0, tempMax: p.temperature?.max ?? 2, topP: !!p.topP, topMin: p.topP?.min ?? 0, topMax: p.topP?.max ?? 1, output: !!p.maxTokens, maxTokens: p.maxTokens || 8192 })
}, { immediate: true })
function changed() {
  const p: Record<string, unknown> = { system: form.system }
  if (form.temperature) p.temperature = { min: form.tempMin, max: form.tempMax }
  if (form.topP) p.topP = { min: form.topMin, max: form.topMax }
  if (form.output) p.maxTokens = form.maxTokens
  emit('update:value', JSON.stringify(p))
}
</script>
<template><section class="playground-capabilities"><a-collapse ghost><a-collapse-panel key="playground" header="PlayGround 参数能力"><p class="hint">按目标模型实际支持情况填写；未勾选的数值参数在 PlayGround 中禁用。数值范围按适配器协议校验，PlayGround 输出上限与 API 转发输出上限独立。</p>
  <a-form-item label="系统提示词"><a-switch v-model:checked="form.system" @change="changed" /></a-form-item>
  <a-form-item label="Temperature"><a-checkbox v-model:checked="form.temperature" @change="changed">支持</a-checkbox><a-space v-if="form.temperature"><a-input-number v-model:value="form.tempMin" :min="0" :max="form.tempMax" :step="0.1" @change="changed" /><span>至</span><a-input-number v-model:value="form.tempMax" :min="form.tempMin" :max="2" :step="0.1" @change="changed" /></a-space></a-form-item>
  <a-form-item label="Top P"><a-checkbox v-model:checked="form.topP" @change="changed">支持</a-checkbox><a-space v-if="form.topP"><a-input-number v-model:value="form.topMin" :min="0" :max="form.topMax" :step="0.1" @change="changed" /><span>至</span><a-input-number v-model:value="form.topMax" :min="form.topMin" :max="1" :step="0.1" @change="changed" /></a-space></a-form-item>
  <a-form-item label="PlayGround 输出上限" extra="仅用于 PlayGround；请求留空时使用此上限，不受 API 转发输出上限约束。"><a-checkbox v-model:checked="form.output" @change="changed">支持</a-checkbox><a-input-number v-if="form.output" v-model:value="form.maxTokens" :min="1" :precision="0" @change="changed" /></a-form-item>
</a-collapse-panel></a-collapse></section></template>
<style lang="scss" scoped>
.playground-capabilities { margin: 24px 0; padding-top: 12px; border-top: 1px solid $color-border; }
.hint { margin-bottom: 16px; font-size: $font-size-caption; color: $color-text-secondary; line-height: 1.8; }
.ant-checkbox-wrapper { margin-right: 12px; }
</style>
