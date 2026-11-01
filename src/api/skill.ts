import http, { handleExpiredSession } from './request'
import { getToken } from '@/utils/auth'
import type { SkillCard, SkillDetail, SkillDownloadGrant, SkillDraft, SkillImportTask, SkillMetadata,
  SkillMine, SkillOptions, SkillPage, SkillPublication, SkillSearch } from '@/types/skill'
import type { SkillGithubInput, SkillGithubCandidates, SkillDraftFiles } from '@/types/skill'
import { safeSkillDownloadPath } from '@/utils/skill'

const base = '/skills'
const personal = (signal?: AbortSignal) => ({ signal, silentError: true })
const command = (key: string, signal?: AbortSignal) => ({ ...personal(signal), headers: { 'Idempotency-Key': key } })

export const skillOptions = (signal?: AbortSignal): Promise<SkillOptions> => http.get(`${base}/options`, personal(signal))
export function searchSkills(query: SkillSearch, signal?: AbortSignal): Promise<SkillPage<SkillCard>> {
  const params = new URLSearchParams()
  Object.entries(query).forEach(([key, value]) => {
    if (Array.isArray(value)) value.forEach(item => params.append(key, item))
    else if (value !== undefined && value !== '') params.set(key, String(value))
  })
  return http.get(base, { ...personal(signal), params })
}
export const skillDetail = (id: string, signal?: AbortSignal): Promise<SkillDetail> => http.get(`${base}/${id}`, personal(signal))
export const createSkillDraft = (slug: string, key: string, signal?: AbortSignal): Promise<SkillDraft> =>
  http.post(`${base}/drafts`, { slug }, command(key, signal))
export const getSkillDraft = (id: string, signal?: AbortSignal): Promise<SkillDraft> => http.get(`${base}/drafts/${id}`, personal(signal))
export const saveSkillDraft = (id: string, revision: number, metadata: SkillMetadata, signal?: AbortSignal): Promise<SkillDraft> =>
  http.put(`${base}/drafts/${id}`, { revision, metadata }, personal(signal))
export const abandonSkillDraft = (id: string, revision: number, signal?: AbortSignal): Promise<void> =>
  http.delete(`${base}/drafts/${id}`, { ...personal(signal), params: { revision } })
export const createSkillImport = (id: string, revision: number, key: string, signal?: AbortSignal): Promise<SkillImportTask> =>
  http.post(`${base}/drafts/${id}/imports`, { revision }, command(key, signal))
export const uploadSkillArchive = (id: string, file: File, signal?: AbortSignal): Promise<SkillImportTask> =>
  http.put(`${base}/imports/${id}/archive`, file, { ...personal(signal), timeout: 125000, headers: { 'Content-Type': 'application/zip' } })
export const skillImportStatus = (id: string, signal?: AbortSignal): Promise<SkillImportTask> =>
  http.get(`${base}/imports/${id}`, personal(signal))
export const cancelSkillImport = (id: string, signal?: AbortSignal): Promise<void> => http.delete(`${base}/imports/${id}`, personal(signal))
export const createSkillGithubImport = (id: string, revision: number, input: SkillGithubInput, key: string, signal?: AbortSignal): Promise<SkillImportTask> =>
  http.post(`${base}/drafts/${id}/github-imports`, { revision, ...input }, command(key, signal))
export const confirmSkillGithubSource = (id: string, revision: number, sourceOptionId: string, key: string, signal?: AbortSignal): Promise<SkillImportTask> =>
  http.post(`${base}/imports/${id}/source-confirmations`, { revision, sourceOptionId }, command(key, signal))
export const skillGithubCandidates = (id: string, page: number, signal?: AbortSignal): Promise<SkillGithubCandidates> =>
  http.get(`${base}/imports/${id}/candidates`, { ...personal(signal), params: { page, size: 20 } })
export const selectSkillGithubCandidate = (id: string, revision: number, scanDigest: string, candidateId: string, key: string, signal?: AbortSignal): Promise<SkillImportTask> =>
  http.post(`${base}/imports/${id}/selections`, { revision, scanDigest, candidateId }, command(key, signal))
export const skillDraftFiles = (id: string, page: number, signal?: AbortSignal): Promise<SkillDraftFiles> =>
  http.get(`${base}/drafts/${id}/files`, { ...personal(signal), params: { page, size: 50 } })
export const submitSkillDraft = (id: string, revision: number, key: string, signal?: AbortSignal): Promise<SkillPublication> =>
  http.post(`${base}/drafts/${id}/submissions`, { revision }, command(key, signal))
export const skillSubmission = (id: string, signal?: AbortSignal): Promise<SkillPublication> =>
  http.get(`${base}/submissions/${id}`, personal(signal))
export const mySkills = (page: number, signal?: AbortSignal): Promise<SkillPage<SkillMine>> =>
  http.get(`${base}/me/publications`, { ...personal(signal), params: { page } })
export const unpublishSkill = (id: string, revision: number, reason: string, key: string, signal?: AbortSignal): Promise<number> =>
  http.post(`${base}/${id}/unpublish`, { revision, reason }, command(key, signal))
export const skillDownload = (id: string, version: string, signal?: AbortSignal): Promise<SkillDownloadGrant> =>
  http.post(`${base}/${id}/versions/${version}/download-grants`, {}, personal(signal))

export async function readSkillArchive(path: string, maximumBytes: number, signal?: AbortSignal, sessionToken = getToken()): Promise<Blob> {
  if (!safeSkillDownloadPath(path)) throw new Error('下载地址不合法')
  if (!sessionToken) { handleExpiredSession(sessionToken); throw new Error('请登录后下载 Skill') }
  if (sessionToken !== getToken()) throw new Error('登录账号已变更，请重新下载')
  const response = await fetch(path, { signal, headers: { Authorization: `Bearer ${sessionToken}` },
    credentials: 'same-origin', referrerPolicy: 'no-referrer', cache: 'no-store' })
  if (response.status === 401) {
    handleExpiredSession(sessionToken)
    throw new Error('登录已过期，请重新登录')
  }
  if (sessionToken !== getToken()) throw new Error('登录账号已变更，请重新下载')
  if (!response.ok) {
    const result = await response.json().catch(() => null) as { message?: string } | null
    throw new Error(result?.message || '下载未完成，请重新领取下载授权')
  }
  if (!response.headers.get('Content-Type')?.startsWith('application/zip')
    || Number(response.headers.get('Content-Length')) > maximumBytes) throw new Error('下载内容类型或大小不合法')
  const blob = await response.blob()
  if (sessionToken !== getToken()) throw new Error('登录账号已变更，请重新下载')
  if (blob.size === 0 || blob.size > maximumBytes) throw new Error('下载包大小不合法')
  return blob
}
