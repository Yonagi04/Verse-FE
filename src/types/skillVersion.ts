import type { SkillMetadata, SkillSource, SkillFile, SkillFileContent } from './skill'

export type VersionType = 'DRAFT' | 'RELEASE'
export type WorkspaceMode = 'NEW_CONTENT' | 'LATEST_DRAFT'
export interface SkillWorkspace {
  skillId: string; draftId: string; slug: string; skillStatus: string; skillRevision: string
  baseSkillRevision: string | null; revision: string; status: string; jobId: string | null
  artifactId: string | null; contentSha256: string | null; sourceVersionId: string | null; releaseNotes: string | null
  currentReleaseAt?: string | null; nextReleaseVersion?: string | null; latestDraftVersion?: string | null; latestDraftAt?: string | null; canPromote?: boolean
  metadata: SkillMetadata | null; creationSource: SkillSource | null; source: SkillSource | null; currentVersion: string | null
}
export interface VersionPreview {
  type: VersionType; version: string; workspaceRevision: string; expectedSkillRevision: string; confirmationDigest: string
  baseVersionId: string | null; baseVersion: string | null; addedCount: number; modifiedCount: number; deletedCount: number
  fileCount: number; contentSha256: string; source: SkillSource; sourceDraftVersion: string | null
  currentVersion: string | null; releaseNotes: string
}
export interface VersionPublishInput {
  workspaceRevision: string; expectedSkillRevision: string; type: VersionType; confirmationDigest: string
}
export interface VersionReceipt {
  skillId: string; versionId: string; type: VersionType; version: string; sequence: string; publishedAt: string
  sourceDraftVersionId: string | null; submissionId: string | null; approvalId: string | null
}
export interface SkillVersion {
  versionId: string; type: VersionType; version: string; sequence: string; status: string; publishedAt: string
  releaseNotes: string; source: SkillSource | null; metadata: SkillMetadata | null; currentRelease: boolean
  canPublish: boolean; sourceDraftVersionId: string | null; sourceDraftVersion?: string | null; usedByVersion: string | null; baseVersionId: string | null
  baseVersion: string | null; diffSummaryStatus: 'READY' | 'UNAVAILABLE'
  addedCount: number | null; modifiedCount: number | null; deletedCount: number | null; filesAvailable: boolean
}
export interface VersionPage { page: number; size: number; total: number; headSequence: string; items: SkillVersion[] }
export interface FileChange {
  relativePath: string; changeType: 'ADDED' | 'MODIFIED' | 'DELETED' | 'UNCHANGED'; oldFile: SkillFile | null; newFile: SkillFile | null
}
export interface VersionChanges { baseVersionId: string | null; baseVersion: string | null; targetVersionId: string | null; items: FileChange[] }
export interface FileComparison {
  baseVersionId: string | null; targetVersionId: string | null; changeType: FileChange['changeType']
  oldFile: SkillFileContent | null; newFile: SkillFileContent | null
}
