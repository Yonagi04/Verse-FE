<script setup lang="ts">
import ProviderIcon from './ProviderIcon.vue'
import { providerNames, type ExternalProvider, type ProviderInfo } from '@/types/externalAuth'
defineProps<{ providers: ProviderInfo[]; loading?: ExternalProvider | null; disabled?: boolean }>()
defineEmits<{ select: [provider: ExternalProvider] }>()
</script>
<template><div class="provider-buttons" aria-label="其他登录方式"><a-button v-for="item in providers.filter(p => p.enabled)" :key="item.provider" block size="large" :loading="loading === item.provider" :disabled="disabled || !!loading || item.availability !== 'AVAILABLE'" @click="$emit('select', item.provider)"><ProviderIcon :provider="item.provider" />使用 {{ providerNames[item.provider] }} 登录<span v-if="item.availability !== 'AVAILABLE'">（暂不可用）</span></a-button></div></template>
<style lang="scss" scoped>.provider-buttons { display: grid; gap: 10px; :deep(button) { height: 46px; border-color: var(--verse-adaptive-border-input, #e0e3e8); border-radius: $radius-input; display: flex; align-items: center; justify-content: center; gap: 10px; font-size: 13px; box-shadow: none; } }</style>
