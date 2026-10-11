import request from './request'
import { useTenantStore } from '@/stores/tenant'
import type { CostLimitPatch } from '@/types/costBudget'
import type { LlmCostStatus, LlmCostWarningPatch, CostNotificationReadiness } from '@/types/llmCostBudget'
/** 新 scope 通过可信当前租户授权；阻止已过期抽屉把操作发到新租户。 */
export function requireCostTenant(tenantId: string) {
  if (useTenantStore().currentTenantId !== tenantId) throw new Error('工作空间已变化，请重新打开模型配置')
}
export function getLlmCostStatus(tenantId: string, serviceId: string): Promise<LlmCostStatus> {
  requireCostTenant(tenantId)
  return request.get(`/llm-services/${serviceId}/cost-status`, { silentError: true })
}
export function listLlmCostStatuses(tenantId: string, serviceIds: string[]): Promise<{ items: LlmCostStatus[] }> {
  requireCostTenant(tenantId)
  return request.get('/llm-services/cost-status', { params: { serviceIds: serviceIds.join(',') }, silentError: true })
}
export function updateLlmCostBudget(tenantId: string, serviceId: string, data: { costLimit?: CostLimitPatch; costWarning?: LlmCostWarningPatch }): Promise<LlmCostStatus> {
  requireCostTenant(tenantId)
  return request.post(`/llm-services/${serviceId}/cost-budget/update`, data)
}
export function getCostNotificationReadiness(tenantId: string): Promise<CostNotificationReadiness> {
  requireCostTenant(tenantId)
  return request.get('/llm-services/cost-notification-readiness', { silentError: true })
}
