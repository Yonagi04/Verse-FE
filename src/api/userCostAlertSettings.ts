import request from './request'
import type { UserCostAlertSettingsView, ReplaceUserCostAlertSettings } from '@/types/userCostAlertSettings'

export function getUserCostAlertSettings(signal?: AbortSignal): Promise<UserCostAlertSettingsView> {
  return request.get('/users/me/cost-alert', { signal, silentError: true })
}
export function replaceUserCostAlertSettings(body: ReplaceUserCostAlertSettings, signal?: AbortSignal): Promise<UserCostAlertSettingsView> {
  return request.put('/users/me/cost-alert', body, { signal, silentError: true })
}
