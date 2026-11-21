import http from './request'
import type { SkillFiles, SkillFileContent, SkillImportTask } from '@/types/skill'
import type { SkillWorkspace, WorkspaceMode, VersionPreview, VersionType, VersionPublishInput, VersionReceipt,
  VersionPage, SkillVersion, VersionChanges, FileComparison } from '@/types/skillVersion'

const base = (id: string) => `/skills/${id}`
const personal = (signal?: AbortSignal) => ({ signal, silentError: true })
const command = (key: string, signal?: AbortSignal) => ({ ...personal(signal), headers: { 'Idempotency-Key': key } })
export const getWorkspace = (id: string, signal?: AbortSignal): Promise<SkillWorkspace> =>
  http.get(`${base(id)}/workspace`, personal(signal))
export const openWorkspace = (id: string, mode: WorkspaceMode, expectedSkillRevision: string, key: string, signal?: AbortSignal): Promise<SkillWorkspace> =>
  http.post(`${base(id)}/workspace`, { mode, expectedSkillRevision }, command(key, signal))
export const saveWorkspace = (id: string, revision: string, releaseNotes: string, signal?: AbortSignal): Promise<SkillWorkspace> =>
  http.put(`${base(id)}/workspace`, { revision, releaseNotes }, personal(signal))
export const importWorkspaceGithub = (id: string, revision: string, key: string, signal?: AbortSignal): Promise<SkillImportTask> =>
  http.post(`${base(id)}/workspace/github-imports`, { revision }, command(key, signal))
export const publicationPreview = (id: string, type: VersionType, signal?: AbortSignal): Promise<VersionPreview> =>
  http.get(`${base(id)}/workspace/publication-preview`, { ...personal(signal), params: { type } })
export const publishVersion = (id: string, input: VersionPublishInput, key: string, signal?: AbortSignal): Promise<VersionReceipt> =>
  http.post(`${base(id)}/versions`, input, command(key, signal))
export const publicationResult = (id: string, key: string, signal?: AbortSignal): Promise<{ status: 'COMMITTED' | 'UNCONFIRMED'; receipt: VersionReceipt | null }> =>
  http.get(`${base(id)}/publication-results/${key}`, personal(signal))
export const skillVersions = (id: string, page: number, headSequence?: string, signal?: AbortSignal): Promise<VersionPage> =>
  http.get(`${base(id)}/versions`, { ...personal(signal), params: { page, size: 20, headSequence } })
export const skillVersion = (id: string, version: string, signal?: AbortSignal): Promise<SkillVersion> =>
  http.get(`${base(id)}/versions/${version}`, personal(signal))

export type VersionFileTarget = { versionId: string } | { revision: string; type: VersionType }
function location(id: string, target: VersionFileTarget, kind: 'files' | 'files/content' | 'changes' | 'comparison') {
  return 'versionId' in target
    ? { url: `${base(id)}/versions/${target.versionId}/${kind.startsWith('files') ? `history-${kind}` : kind}`, params: {} }
    : { url: `${base(id)}/workspace/${kind}`, params: { revision: target.revision, type: target.type } }
}
function read<T>(id: string, target: VersionFileTarget, kind: Parameters<typeof location>[2], path?: string, signal?: AbortSignal): Promise<T> {
  const value = location(id, target, kind)
  // request拦截器已解包Result；Axios泛型条件类型无法表达通用T的解包。
  return http.get(value.url, { ...personal(signal), params: { ...value.params, path } }) as unknown as Promise<T>
}
export const versionFiles = (id: string, target: VersionFileTarget, signal?: AbortSignal) => read<SkillFiles>(id, target, 'files', undefined, signal)
export const versionContent = (id: string, target: VersionFileTarget, path: string, signal?: AbortSignal) => read<SkillFileContent>(id, target, 'files/content', path, signal)
export const versionChanges = (id: string, target: VersionFileTarget, signal?: AbortSignal) => read<VersionChanges>(id, target, 'changes', undefined, signal)
export const versionComparison = (id: string, target: VersionFileTarget, path: string, signal?: AbortSignal) => read<FileComparison>(id, target, 'comparison', path, signal)
