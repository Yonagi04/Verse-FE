export interface SkillPublisher { publisherId: string; handle: string; publicName: string }
export interface SkillOption { id: string; name: string }
export interface SkillOptions {
  categories: SkillOption[]; tags: SkillOption[]; maxArchiveBytes: number; maxUnpackedBytes: number; maxFiles: number
  githubLimits?: { maxArchiveBytes: number; maxUnpackedBytes: number; maxEntries: number; maxCandidates: number }
}
export interface SkillCard {
  skillId: string; publisher: SkillPublisher; slug: string; name: string; summary: string; categoryId: string
  tags: string[]; version: string; versionId: string; publishedAt: string
  sourceType?: 'ZIP' | 'GITHUB'
}
export interface SkillPage<T> { page: number; size: number; total: number; items: T[] }
export interface SkillDetail {
  skill: SkillCard; availability: string; skillMarkdown: string | null; license: string | null
  originalAuthor: string | null; sourceUrl: string | null; compatibility: string | null; dependencies: string | null
  archiveBytes: number | null; sha256: string | null
  source?: SkillSource | null
}
export interface SkillSearch {
  keyword?: string; category?: string; tags?: string[]; source?: string; publisherId?: string
  sort?: string; page: number; size: number
}
export interface SkillMetadata {
  name: string; summary: string; categoryId: string; tags: string[]; version: string; releaseNotes: string
  license: string; originalAuthor: string; sourceUrl: string; compatibility: string; dependencies: string
  distributionAuthorized: boolean; declarationsConfirmed: boolean
}
export interface SkillDraft {
  draftId: string; skillId: string; slug: string; status: string; revision: number; jobId: string | null
  metadata: SkillMetadata | null; packageName: string | null; packageDescription: string | null
  skillMarkdown: string | null; archiveBytes: number | null; fileCount: number | null; updatedAt: string
  artifactId?: string | null; contentSha256?: string | null; source?: SkillSource | null
}
export interface SkillImportTask {
  jobId: string; draftId: string; status: string; draftRevision: number; errorCode: string | null
  reason: string | null; attempts: number; updatedAt: string
  sourceType?: 'ZIP' | 'GITHUB'; phase?: string; sourceOptions?: SkillGithubSourceOption[]
  source?: SkillSource | null; candidateCount?: number; scanDigest?: string | null; waitUntil?: string | null
  retryable?: boolean; retryAt?: string | null; issues?: SkillValidationIssue[]; requestedSource?: SkillGithubInput | null
}
export interface SkillPublication {
  skillId: string; submissionId: string; approvalId: string; versionId: string; approvalStatus: string
  decisionSource: string; publicationStatus: string; publisher: string; slug: string
}
export interface SkillMine {
  skillId: string; draftId: string | null; name: string; slug: string; status: string; draftStatus: string
  jobStatus: string | null; version: string | null; revision: number; updatedAt: string
}
export interface SkillDownloadGrant { downloadUrl: string; expiresAt: string; sha256: string; archiveBytes: number }
export interface SkillSource {
  schemaVersion: number; type: 'ZIP' | 'GITHUB'; repositoryUrl: string | null; repositoryId: string | null
  requestedRef: string | null; resolvedRefType: string | null; commitSha: string | null; directory: string | null
}
export interface SkillGithubInput {
  repositoryUrl: string; refType: 'DEFAULT' | 'AUTO' | 'BRANCH' | 'TAG' | 'COMMIT'; ref: string | null; directory: string | null
}
export interface SkillGithubSourceOption { sourceOptionId: string; source: SkillSource; treeSha: string }
export interface SkillValidationIssue { code: string; path: string; line: number | null; message: string }
export interface SkillGithubCandidate {
  candidateId: string; directory: string; packageName: string | null; packageDescription: string | null
  fileCount: number; unpackedBytes: number; selectable: boolean; issues: SkillValidationIssue[]
}
export interface SkillGithubCandidates {
  page: number; size: number; total: number; items: SkillGithubCandidate[]; scanDigest: string | null
}
export interface SkillDraftFiles {
  page: number; size: number; total: number; artifactId: string; contentSha256: string
  items: { relativePath: string; sizeBytes: number; sha256: string }[]
}
