<script setup lang="ts">
import { computed } from 'vue'
import { useThemeStore } from '@/stores/theme'

const themeStore = useThemeStore()
const brandImage = computed(() => `${import.meta.env.BASE_URL}images/login-page-${themeStore.resolvedMode}.png`)
</script>
<template>
  <div class="auth-shell">
    <aside class="brand-panel">
      <router-link to="/login" class="wordmark" aria-label="Verse 首页"><span class="logo">V</span>Verse</router-link>
      <div class="brand-copy"><div class="eyebrow">YOUR IDEAS. CONNECTED.</div><h1>一个入口，<br>继续你的<span>探索。</span></h1><p>连接你的账号与租户。<br>把更多时间，留给值得构建的想法。</p></div>
      <div class="brand-art" aria-hidden="true">
        <img class="brand-image" :class="{ 'brand-image-dark': themeStore.resolvedMode === 'dark' }" :src="brandImage" width="1448" height="1086" alt="" draggable="false">
        <small>探索 · 构建 · 协作</small>
      </div>
    </aside>
    <main class="auth-main"><div class="locale">统一 LLM 管理平台</div><div class="auth-content"><slot /></div><footer>© {{ new Date().getFullYear() }} Verse · 让想法保持连接</footer></main>
  </div>
</template>
<style lang="scss" scoped>
.auth-shell { height: 100vh; height: 100dvh; overflow: hidden; display: grid; grid-template-columns: 46% 54%; background: $color-bg; color: $color-text-primary; }
.brand-panel { min-height: 0; padding: 40px 9%; background: $color-primary-bg; display: flex; flex-direction: column; position: relative; overflow: hidden; isolation: isolate; }
.wordmark { display: flex; flex-shrink: 0; align-items: center; gap: 12px; color: $color-text-primary; font-size: 24px; font-weight: 700; width: fit-content; text-decoration: none; z-index: 1; }
.logo { display: inline-flex; align-items: center; justify-content: center; width: 36px; height: 36px; background: $color-primary-solid; color: white; border-radius: 9px; font-size: 28px; font-weight: 850; font-family: Arial,sans-serif; }
.brand-copy { flex-shrink: 0; margin-top: clamp(65px, 12vh, 115px); z-index: 1; }.eyebrow { font-size: 12px; color: var(--verse-adaptive-text-tertiary, #8c97a4); letter-spacing: 1.8px; font-weight: 700; }
h1 { font-size: clamp(32px, 3.8vw, 56px); font-weight: 750; line-height: 1.25; letter-spacing: -2px; margin: 24px 0; span { color: $color-primary; } }.brand-copy p { color: var(--verse-adaptive-text-secondary, #87919c); line-height: 1.9; }
.brand-art {
  width: 100%;
  max-width: 420px;
  min-height: 0;
  max-height: 343px;
  flex: 0 1 343px;
  display: grid;
  grid-template-rows: minmax(0, 1fr) auto;
  gap: 12px;
  margin-top: 54px;
}
.brand-image {
  display: block;
  width: auto;
  height: auto;
  max-width: 100%;
  max-height: 100%;
  min-width: 0;
  min-height: 0;
  place-self: center;
  object-fit: contain;
  mix-blend-mode: multiply;
  // A broad elliptical fade avoids a visible rectangular edge on opaque assets.
  -webkit-mask-image: radial-gradient(ellipse closest-side, #000 58%, rgba(0, 0, 0, .95) 70%, rgba(0, 0, 0, .65) 82%, rgba(0, 0, 0, .2) 93%, transparent 100%);
  mask-image: radial-gradient(ellipse closest-side, #000 58%, rgba(0, 0, 0, .95) 70%, rgba(0, 0, 0, .65) 82%, rgba(0, 0, 0, .2) 93%, transparent 100%);
}
.brand-image-dark { mix-blend-mode: lighten; }
.brand-art small { text-align: center; color: var(--verse-adaptive-text-tertiary, #94a1b2); font-size: 11px; letter-spacing: 2px; }.brand-note { margin-top: auto; padding-top: 30px; color: var(--verse-adaptive-text-tertiary, #929dab); font-size: 11px; z-index: 1; }
.auth-main { display: flex; flex-direction: column; min-width: 0; min-height: 0; overflow-y: auto; overscroll-behavior-y: contain; padding: 36px 7% 22px; }.locale { flex-shrink: 0; text-align: right; color: var(--verse-adaptive-text-tertiary, #9299a1); font-size: 11px; }.auth-content { flex-shrink: 0; width: 100%; max-width: 390px; margin: auto; padding: 34px 0; }footer { flex-shrink: 0; text-align: center; color: var(--verse-adaptive-text-tertiary, #a0a6af); font-size: 11px; padding: 12px; }
@media(max-width: 900px) { .brand-panel { padding: 32px 8%; }h1 { letter-spacing: -1px; }.auth-main { padding: 28px 7%; } }
@media(max-height: 740px) { .brand-art { margin-top: 24px; } }
@media(max-width: 680px) { .auth-shell { grid-template-columns: minmax(0, 1fr); grid-template-rows: auto minmax(0, 1fr); }.brand-panel { min-height: unset; padding: 24px; }.brand-copy,.brand-art,.brand-note { display: none; }.wordmark { font-size: 21px; }.auth-main { min-height: 0; padding: 22px 24px; }.auth-content { margin: auto; padding: 30px 0; }.locale { font-size: 10px; } }
</style>
