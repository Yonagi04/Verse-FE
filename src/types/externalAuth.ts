import type { UserLoginRespDTO } from './user'
export type ExternalProvider = 'google' | 'github' | 'gitlab'
export const providerNames: Record<ExternalProvider, string> = { google: 'Google', github: 'GitHub', gitlab: 'GitLab' }
export interface ProviderInfo { provider: ExternalProvider; enabled: boolean; availability: 'AVAILABLE' | 'DISABLED' | 'TEMPORARILY_UNAVAILABLE' }
export interface ExternalFlowStart { flowId: string; flowToken: string; authorizationUrl: string; expiresAt: string }
export interface ExternalAccountSummary { displayName: string | null; username: string | null; maskedEmail: string | null }
export interface ExternalAccount { userId: string; username: string; nickname: string; avatar: string | null; status: 'NORMAL' | 'DISABLED' }
export type ExternalStage = 'AUTHORIZING' | 'AUTHENTICATING' | 'LOGIN_READY' | 'SELECT_REQUIRED' | 'REGISTER_REQUIRED' | 'EXISTING_ACCOUNT_LOGIN' | 'BIND_CONFIRM_REQUIRED' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'EXPIRED' | 'INVALIDATED'
export interface ExternalFlowContext {
  flowId: string; purpose: 'LOGIN' | 'BIND'; stage: ExternalStage; provider: ExternalProvider
  externalAccount: ExternalAccountSummary | null; accounts: ExternalAccount[]
  registrationDefaults: { nickname: string | null; verifiedEmail: string | null } | null
  targetAccount: ExternalAccount | null; boundAccountCount: number | null; expiresAt: string; errorReason: string | null
  completion: { registrationCompleted: boolean; sessionStatus: 'ISSUED' | 'FAILED' | 'NOT_STARTED' } | null
}
export interface ExternalLoginCompletion { outcome: 'LOGGED_IN' | 'REGISTERED_LOGIN_FAILED'; registrationCompleted: boolean; login: UserLoginRespDTO | null; nextAction: 'DASHBOARD' | 'REAUTHENTICATE' }
export interface Binding extends ExternalAccountSummary { bindingId: string; boundAt: string }
export interface BindingInfo extends ProviderInfo { binding: Binding | null; canBind: boolean; canUnbind: boolean; unavailableReason: string | null }
export interface ReauthInput { password: string; action: 'BIND' | 'UNBIND' | 'ATTACH'; provider?: ExternalProvider; bindingId?: string; flowId?: string }
export interface ReauthResult { reauthToken: string; expiresAt: string }
export interface BindingResult { bindingId: string; outcome: 'BOUND' | 'ALREADY_BOUND' | 'UNBOUND' | 'ALREADY_UNBOUND'; sessionsRetained: boolean }
