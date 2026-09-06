<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { listLlmServices } from '@/api/llmService'
import { getProviderBySlug } from '@/constants/providers'
import type { LlmServiceInfo } from '@/types/llmService'

const props = defineProps<{ open: boolean; tenantId: string; excludeServiceId: string }>()
const emit = defineEmits<{ (e: 'update:open', value: boolean): void; (e: 'select', record: LlmServiceInfo): void }>()
const keyword = ref(''); const records = ref<LlmServiceInfo[]>([]); const loading = ref(false); const selectedId = ref<string>()
const selected = computed(() => records.value.find((record) => record.serviceId === selectedId.value))
async function fetch() { loading.value = true; try { records.value = (await listLlmServices(props.tenantId, 1, 100, keyword.value || undefined)).serviceInfoList.filter((record) => record.serviceId !== props.excludeServiceId) } catch {} finally { loading.value = false } }
watch(() => props.open, (open) => { if (open) { keyword.value = ''; selectedId.value = undefined; fetch() } }, { immediate: true })
function confirm() { if (selected.value) { emit('select', selected.value); emit('update:open', false) } }
function providerDisplayName(slug: string): string { return getProviderBySlug(slug)?.displayName ?? slug }
</script>
<template>
  <a-modal :open="open" title="选择对比模型" ok-text="开始对比" cancel-text="取消" :ok-button-props="{ disabled: !selected }" @cancel="emit('update:open', false)" @ok="confirm">
    <a-input-search v-model:value="keyword" allow-clear placeholder="搜索模型名称或供应商" @search="fetch" />
    <a-list :data-source="records" :loading="loading" class="picker-list">
      <template #renderItem="{ item }"><a-list-item><a-radio :checked="selectedId === item.serviceId" @change="selectedId = item.serviceId">{{ item.name }} <span class="secondary">{{ providerDisplayName(item.provider) }}</span></a-radio></a-list-item></template>
    </a-list>
  </a-modal>
</template>
<style lang="scss" scoped>.picker-list { margin-top: 12px; max-height: 360px; overflow: auto; }.secondary { margin-left: 8px; color: $color-text-secondary; }</style>