type TenantContextRecoveryHandler = () => Promise<void>

let handler: TenantContextRecoveryHandler | null = null
let recoveryPromise: Promise<void> | null = null

/** 布局层注册恢复逻辑，请求层只发布事件，避免反向依赖 Pinia。 */
export function registerTenantContextRecovery(nextHandler: TenantContextRecoveryHandler) {
  handler = nextHandler
  return () => {
    if (handler === nextHandler) handler = null
  }
}

/** 合并同一时刻的多个上下文冲突，只执行一次刷新与导航。 */
export function triggerTenantContextRecovery(): Promise<void> {
  if (!handler) return Promise.resolve()
  if (!recoveryPromise) {
    recoveryPromise = handler().finally(() => { recoveryPromise = null })
  }
  return recoveryPromise
}
