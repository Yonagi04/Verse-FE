import request from './request'

export type CaseState = 'PENDING' | 'RESOLVED'
export type Decision = 'CHARGE' | 'NO_CHARGE'

export interface CasePrice {
  mode: 'REQUEST' | 'TOKEN'
  requestFen: string | null
  inputFen: string | null
  cachedFen: string | null
  outputFen: string | null
}

export interface Resolution {
  status: string
  costFen: string | null
  method: 'AUTO' | 'ADMIN'
  resolvedAt: string
  inputTokens: number | null
  cachedTokens: number | null
  outputTokens: number | null
}

export interface ReconciliationCase {
  id: string
  requestId: string
  serviceId: string | null
  model: string | null
  source: string
  requestedAt: string
  state: CaseState
  reason: string
  version: number
  reviewRequired: boolean
  price: CasePrice | null
  resolution: Resolution | null
}

export interface ReconciliationBatch {
  code: string
  scanId: string
  scannedAt: string
  pendingCount: number
  resolvedCount: number
  nextCursor: string | null
  items: ReconciliationCase[]
}

export interface ResolveCase {
  decision: Decision
  evidenceConfirmed: boolean
  version: number
  submissionKey: string
  inputTokens?: number
  cachedTokens?: number
  outputTokens?: number
}

const base = (code: string) => `/cost-reconciliation-batches/${encodeURIComponent(code)}/cases`

export function listCases(code: string, state: CaseState, after?: string): Promise<ReconciliationBatch> {
  return request.get(base(code), { params: { state, after }, silentError: true })
}

export function caseDetail(code: string, id: string): Promise<ReconciliationCase> {
  return request.get(`${base(code)}/${encodeURIComponent(id)}`, { silentError: true })
}

export function resolveCase(code: string, id: string, body: ResolveCase): Promise<ReconciliationCase> {
  return request.post(`${base(code)}/${encodeURIComponent(id)}/resolve`, body, { silentError: true })
}
