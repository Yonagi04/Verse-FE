import http from './request'
import type { AxiosRequestConfig } from 'axios'
import type { UserRegisterReqDTO } from '@/types/user'
import type { ProviderInfo, ExternalProvider, ExternalFlowStart, ExternalFlowContext, ExternalLoginCompletion, BindingInfo, ReauthInput, ReauthResult, BindingResult } from '@/types/externalAuth'
const base = '/auth/external'
const management = '/users/me/external-accounts'
function options(token?: string, verse = false): AxiosRequestConfig {
  return { authMode: verse ? 'verse' : 'anonymous', silentError: true, headers: { 'X-Requested-With': 'XMLHttpRequest', ...(token ? { 'X-External-Flow-Token': token } : {}) } }
}
export const getProviders = () => http.get<ProviderInfo[], ProviderInfo[]>(`${base}/providers`, options())
export const startExternalLogin = (provider: ExternalProvider) => http.post<ExternalFlowStart, ExternalFlowStart>(`${base}/flows`, { provider }, options())
export const getFlow = (id: string, token: string) => http.get<ExternalFlowContext, ExternalFlowContext>(`${base}/flows/${id}`, options(token))
export const completeExternalLogin = (id: string, token: string, userId?: string) => http.post<ExternalLoginCompletion, ExternalLoginCompletion>(`${base}/flows/${id}/complete`, { userId }, options(token))
export const registerExternal = (id: string, token: string, form: UserRegisterReqDTO) => http.post<ExternalLoginCompletion, ExternalLoginCompletion>(`${base}/flows/${id}/register`, form, options(token))
export const continueBinding = (id: string, token: string) => http.post<ExternalFlowContext, ExternalFlowContext>(`${base}/flows/${id}/continue-binding`, {}, options(token))
export const attachCurrentUser = (id: string, token: string, reauthToken: string) => http.post<ExternalFlowContext, ExternalFlowContext>(`${base}/flows/${id}/attach-current-user`, { reauthToken }, options(token, true))
export const cancelFlow = (id: string, token: string) => http.post<void, void>(`${base}/flows/${id}/cancel`, {}, options(token))
export const acknowledgeFlow = (id: string, token: string) => http.post<void, void>(`${base}/flows/${id}/acknowledge`, {}, options(token))
export const getExternalAccounts = () => http.get<BindingInfo[], BindingInfo[]>(management, options(undefined, true))
export const reauthExternal = (input: ReauthInput, flowToken?: string) => http.post<ReauthResult, ReauthResult>(`${management}/reauth`, input, options(flowToken, true))
export const startExternalBinding = (provider: ExternalProvider, reauthToken: string) => http.post<ExternalFlowStart, ExternalFlowStart>(`${management}/flows`, { provider, reauthToken }, options(undefined, true))
export const confirmExternalBinding = (id: string, token: string) => http.post<BindingResult, BindingResult>(`${management}/flows/${id}/confirm`, {}, options(token, true))
export const unbindExternal = (id: string, reauthToken: string, operationId: string) => http.post<BindingResult, BindingResult>(`${management}/${id}/unbind`, { reauthToken, operationId }, options(undefined, true))
