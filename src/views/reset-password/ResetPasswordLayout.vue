<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import AuthShell from '@/components/auth/AuthShell.vue'

const route = useRoute()
const steps = [
  { name: 'SendCode', title: '输入手机号' },
  { name: 'VerifyCode', title: '验证验证码' },
  { name: 'ResetPassword', title: '设置新密码' },
]
const currentStep = computed(() => Math.max(0, steps.findIndex(step => step.name === route.name)))
const transitionName = ref('step-forward')
// 依据步骤顺序区分前进和返回，品牌布局始终保持挂载。
watch(currentStep, (next, previous) => {
  transitionName.value = next < previous ? 'step-backward' : 'step-forward'
})
</script>

<template>
  <AuthShell>
    <div class="eyebrow">RESET YOUR PASSWORD</div>
    <ol class="reset-steps" aria-label="找回密码步骤">
      <li v-for="(step, index) in steps" :key="step.name" :class="{ active: index === currentStep, completed: index < currentStep }" :aria-current="index === currentStep ? 'step' : undefined">
        <span class="step-number">{{ index + 1 }}</span>
        <span>{{ step.title }}</span>
      </li>
    </ol>
    <div class="step-viewport">
      <router-view v-slot="{ Component, route: stepRoute }">
        <Transition :name="transitionName" mode="out-in">
          <component :is="Component" :key="stepRoute.path" />
        </Transition>
      </router-view>
    </div>
  </AuthShell>
</template>

<style lang="scss" scoped>
.eyebrow { margin-bottom: 24px; font-size: 12px; letter-spacing: 1.7px; color: $color-text-secondary; font-weight: 700; }
.reset-steps { display: flex; list-style: none; margin: 0 0 28px; padding: 0; }
.reset-steps li {
  position: relative; flex: 1; display: flex; flex-direction: column; align-items: center; gap: 8px; color: $color-text-secondary; font-size: 12px;
  &:not(:last-child)::after { content: ''; position: absolute; top: 12px; left: calc(50% + 20px); width: calc(100% - 40px); border-top: 1px solid $color-border-input; }
  &.active, &.completed { color: $color-primary; }
  &.completed::after { border-color: $color-primary; }
}
.step-number { display: grid; place-items: center; width: 24px; height: 24px; border: 1px solid $color-border-input; border-radius: 50%; background: $color-bg; font-size: 12px; }
.active .step-number { color: $color-on-primary; background: $color-primary-solid; border-color: $color-primary; }
.completed .step-number { background: $color-primary-bg; border-color: $color-primary; }
// 预留表单高度避免步骤切换时品牌区和步骤栏跳动，内边距保留输入框焦点轮廓。
.step-viewport { overflow: hidden; min-height: 420px; margin: -6px; padding: 6px; }
.step-forward-enter-active, .step-backward-enter-active, .step-forward-leave-active, .step-backward-leave-active { transition: transform 160ms ease, opacity 160ms ease; }
.step-forward-enter-from, .step-backward-leave-to { opacity: 0; transform: translateX(100%); }
.step-forward-leave-to, .step-backward-enter-from { opacity: 0; transform: translateX(-100%); }
:deep(.ant-input), :deep(.ant-input-affix-wrapper) { min-height: 44px; font-size: 13px; }
:deep(.ant-input-affix-wrapper .ant-input) { min-height: unset; }
:deep(.ant-form-item-label label) { font-size: 13px; }
:deep(.ant-btn-primary) { height: 46px; font-size: 14px; }
@media (prefers-reduced-motion: reduce) {
  .step-forward-enter-active, .step-backward-enter-active, .step-forward-leave-active, .step-backward-leave-active { transition: none; }
  .step-forward-enter-from, .step-backward-leave-to, .step-forward-leave-to, .step-backward-enter-from { transform: none; }
}
</style>
