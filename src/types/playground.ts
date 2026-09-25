export interface PlaygroundStatus { enabled: boolean; limitRpm: number; limitRph: number }
export interface PlaygroundModel { serviceId: string; name: string; provider: string; description: string | null; contextWindow: number | null }
export interface PlaygroundSession { sessionId: string; title: string; serviceId: string; modelName: string; turnCount: number; createdAt: string; updatedAt: string }
export interface PlaygroundTurn { turnId: string; prompt: string; reply: string | null; status: 'PENDING' | 'STREAMING' | 'COMPLETED' | 'STOPPED' | 'FAILED'; requestId: string; createdAt: string; finishedAt: string | null }
export interface PlaygroundDetail extends PlaygroundSession { modelAvailable: boolean; turns: PlaygroundTurn[] }
export interface PlaygroundSessions { sessions: PlaygroundSession[]; total: number; totalPages: number; page: number; pageSize: number }
export type PlaygroundEvent =
  | { type: 'accepted'; sessionId: string; turnId: string; requestId: string; status: 'PENDING' }
  | { type: 'delta'; turnId: string; seq: number; text: string }
  | { type: 'completed' | 'stopped'; turnId: string; status: string; reply: string }
  | { type: 'error'; turnId: string; status: 'FAILED'; code: string; message: string; retryAfterSeconds?: number | null }
