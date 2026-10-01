/** 每栏下一轮的白名单配置。 */
export interface RunConfig { system?: string; temperature?: number | null; topP?: number | null; maxTokens?: number | null }
/** 稳定栏位允许使用相同模型。 */
export interface Lane { laneId: string; serviceId: string; config: RunConfig }
export interface WorkbenchConfig { lanes: Lane[]; synced: boolean; presetId?: string; presetVersion?: number }
export interface ParameterRange { min: number; max: number }
export interface WorkbenchModel {
  serviceId: string; name: string; provider: string; description?: string; contextWindow?: number
  capabilities: { system: boolean; temperature?: ParameterRange; topP?: ParameterRange; maxTokens?: number }
  pricing?: { currency: string; billingMode: string; inputPriceFen?: number; outputPriceFen?: number; requestPriceFen?: number; periodType: string }
}
export interface PresetVersion { number: number; createdAt: string; config: WorkbenchConfig }
export interface WorkbenchResource {
  id: string; title: string; description?: string; kind: 'GROUP' | 'PRESET'; revision: number; generating: boolean
  payload: WorkbenchConfig & { prefix?: ChatMessage[]; source?: { groupId: string; title: string; roundNo?: number; laneLabel?: string }; versions?: PresetVersion[] }
  attempts?: Attempt[]; sourceAvailable?: boolean; createdAt: string; updatedAt: string
}
export interface ChatMessage { role: string; content: string }
export interface ChatRequest { model: string; messages: ChatMessage[]; stream: boolean; temperature?: number; top_p?: number; max_tokens?: number }
export interface Attempt {
  attemptId: string; groupId: string; roundId: string; roundNo: number; laneId: string; attemptNo: number; requestId: string
  serviceId: string; prompt: string; reply: string; status: 'PENDING' | 'STREAMING' | 'STOPPING' | 'COMPLETED' | 'STOPPED' | 'FAILED'
  snapshot: { request?: ChatRequest; config: RunConfig; modelName: string; provider?: string; presetId?: string; presetVersion?: number }
  error?: { code: string; message: string; reason?: string; retryAfterSeconds?: number }
  metrics: { inputTokens?: number; outputTokens?: number; firstContentMs?: number; durationMs?: number; evidence: string; costStatus: string; costFen?: number; currency?: string }
  createdAt: string; finishedAt?: string
}
export type WorkbenchEvent = { type: 'accepted' | 'delta'; attemptId: string; requestId?: string; text?: string } | (Attempt & { type: 'completed' | 'error' })
