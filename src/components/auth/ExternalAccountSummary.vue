<script setup lang="ts">
import ProviderIcon from './ProviderIcon.vue'
import { providerNames, type ExternalProvider, type ExternalAccountSummary } from '@/types/externalAuth'
defineProps<{ provider: ExternalProvider; account: ExternalAccountSummary | null }>()
</script>
<template><div class="account-summary"><ProviderIcon :provider="provider" /><div><strong>{{ providerNames[provider] }}</strong><span>{{ account?.username ? '@' + account.username : account?.displayName || providerNames[provider] + ' 账户' }}</span><small v-if="account?.maskedEmail">{{ account.maskedEmail }}</small></div></div></template>
<style lang="scss" scoped>.account-summary { display: flex; align-items: center; gap: 14px; padding: 16px; border: 1px solid $color-border; border-radius: $radius-card; background: $color-bg-secondary; margin: 22px 0; div { display: flex; flex-direction: column; gap: 3px; min-width: 0; }strong { font-size: 13px; }span,small { color: $color-text-secondary; overflow-wrap: anywhere; }small { font-size: 12px; } }</style>
