<script setup lang="ts">
import { UserOutlined, CheckOutlined, LaptopOutlined, CodeOutlined } from '@ant-design/icons-vue'
</script>
<template>
  <div class="auth-shell">
    <aside class="brand-panel">
      <router-link to="/login" class="wordmark" aria-label="Verse 首页"><span class="logo">V</span>Verse</router-link>
      <div class="brand-copy"><div class="eyebrow">YOUR IDEAS. CONNECTED.</div><h1>一个入口，<br>继续你的<span>探索。</span></h1><p>连接你的账号与租户。<br>把更多时间，留给值得构建的想法。</p></div>
      <div class="brand-art" aria-hidden="true"><div class="orbit"></div><div class="orbit orbit-two"></div><div class="orbit orbit-three"></div>
        <svg class="connections" viewBox="0 0 400 210"><path d="M65 45H110Q132 45 132 95V110H198M65 165H110Q132 165 132 115M250 110H295Q318 110 318 85V45H345M295 110Q318 110 318 135V165H345" fill="none" stroke="#c8d7e8" stroke-width="1.5"/><path d="M65 45H110Q132 45 132 95V110H198" fill="none" stroke="#88b5eb" stroke-dasharray="4 4"/><circle cx="132" cy="110" r="3" fill="#1677ff"/></svg>
        <span class="art-tile tile-user"><UserOutlined /></span><span class="art-tile tile-check"><CheckOutlined /></span><span class="art-tile tile-screen"><LaptopOutlined /></span><span class="art-tile tile-lines"><CodeOutlined /></span><div class="center-mark"><span class="logo">V</span></div><small>探索 · 构建 · 协作</small>
      </div>
    </aside>
    <main class="auth-main"><div class="locale">统一 LLM 管理平台</div><div class="auth-content"><slot /></div><footer>© {{ new Date().getFullYear() }} Verse · 让想法保持连接</footer></main>
  </div>
</template>
<style lang="scss" scoped>
.auth-shell { height: 100vh; height: 100dvh; overflow: hidden; display: grid; grid-template-columns: 46% 54%; background: $color-bg; color: $color-text-primary; }
.brand-panel { min-height: 0; padding: 40px 9%; background: $color-primary-bg; display: flex; flex-direction: column; position: relative; overflow: hidden; }
.wordmark { display: flex; align-items: center; gap: 12px; color: $color-text-primary; font-size: 24px; font-weight: 700; width: fit-content; text-decoration: none; z-index: 1; }
.logo { display: inline-flex; align-items: center; justify-content: center; width: 36px; height: 36px; background: $color-primary; color: white; border-radius: 9px; font-size: 28px; font-weight: 850; font-family: Arial,sans-serif; }
.brand-copy { margin-top: clamp(65px, 12vh, 115px); z-index: 1; }.eyebrow { font-size: 12px; color: #8c97a4; letter-spacing: 1.8px; font-weight: 700; }
h1 { font-size: clamp(32px, 3.8vw, 56px); font-weight: 750; line-height: 1.25; letter-spacing: -2px; margin: 24px 0; span { color: $color-primary; } }.brand-copy p { color: #87919c; line-height: 1.9; }
.brand-art { width: 100%; max-width: 420px; height: 230px; position: relative; margin-top: 54px; }.orbit { position: absolute; border: 1px solid #edf2fa; border-radius: 50%; width: 650px; height: 650px; top: -285px; left: 20%; pointer-events: none; }.orbit-two { width: 520px; height: 520px; top: -220px; left: 35%; }.orbit-three { width: 390px; height: 390px; top: -155px; left: 50%; }
.connections { position: absolute; width: 100%; top: 0; }.art-tile { position: absolute; width: 65px; height: 48px; background: rgba(255,255,255,.9); border: 1px solid #e6edf6; border-radius: 13px; display: grid; place-items: center; color: #9bb0c8; font-size: 28px; box-shadow: 0 1px 3px #e7edf5; }.tile-user { left: 0; top: 10px; }.tile-check { left: 0; top: 125px; }.tile-screen { right: 0; top: 10px; }.tile-lines { right: 0; top: 125px; }
.center-mark { position: absolute; left: 50%; top: 48px; transform: translateX(-50%); width: 88px; height: 88px; border-radius: 24px; background: #ffffffd9; border: 1px solid #e8edf4; box-shadow: 0 8px 25px #dce6f380; display: grid; place-items: center; .logo { width: 48px; height: 48px; font-size: 44px; border-radius: 14px; } }.brand-art small { position: absolute; top: 155px; width: 100%; text-align: center; color: #94a1b2; font-size: 11px; letter-spacing: 2px; }.brand-note { margin-top: auto; padding-top: 30px; color: #929dab; font-size: 11px; z-index: 1; }
.auth-main { display: flex; flex-direction: column; min-width: 0; min-height: 0; overflow-y: auto; overscroll-behavior-y: contain; padding: 36px 7% 22px; }.locale { flex-shrink: 0; text-align: right; color: #9299a1; font-size: 11px; }.auth-content { flex-shrink: 0; width: 100%; max-width: 390px; margin: auto; padding: 34px 0; }footer { flex-shrink: 0; text-align: center; color: #a0a6af; font-size: 11px; padding: 12px; }
@media(max-width: 900px) { .brand-panel { padding: 32px 8%; }h1 { letter-spacing: -1px; }.auth-main { padding: 28px 7%; } }
@media(max-width: 680px) { .auth-shell { grid-template-columns: minmax(0, 1fr); grid-template-rows: auto minmax(0, 1fr); }.brand-panel { min-height: unset; padding: 24px; }.brand-copy,.brand-art,.brand-note { display: none; }.wordmark { font-size: 21px; }.auth-main { min-height: 0; padding: 22px 24px; }.auth-content { margin: auto; padding: 30px 0; }.locale { font-size: 10px; } }
</style>
