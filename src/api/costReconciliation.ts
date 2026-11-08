import { reconciliationRequest } from './reconciliationTransport'

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

export function listCases(token: string, code: string, state: CaseState, after?: string): Promise<ReconciliationBatch> {
  const params = new URLSearchParams({ state })
  if (after) params.set('after', after)
  return reconciliationRequest(`${base(code)}?${params}`, token)
}

export function caseDetail(token: string, code: string, id: string): Promise<ReconciliationCase> {
  return reconciliationRequest(`${base(code)}/${encodeURIComponent(id)}`, token)
}

export function resolveCase(token: string, code: string, id: string, body: ResolveCase): Promise<ReconciliationCase> {
  return reconciliationRequest(`${base(code)}/${encodeURIComponent(id)}/resolve`, token, body)
}
