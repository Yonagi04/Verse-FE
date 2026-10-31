export interface SkillPublisher { publisherId: string; handle: string; publicName: string }
export interface SkillOption { id: string; name: string }
export interface SkillOptions {
  categories: SkillOption[]; tags: SkillOption[]; maxArchiveBytes: number; maxUnpackedBytes: number; maxFiles: number
}
export interface SkillCard {
  skillId: string; publisher: SkillPublisher; slug: string; name: string; summary: string; categoryId: string
  tags: string[]; version: string; versionId: string; publishedAt: string
}
export interface SkillPage<T> { page: number; size: number; total: number; items: T[] }
export interface SkillDetail {
  skill: SkillCard; availability: string; skillMarkdown: string | null; license: string | null
  originalAuthor: string | null; sourceUrl: string | null; compatibility: string | null; dependencies: string | null
  archiveBytes: number | null; sha256: string | null
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
}
export interface SkillImportTask {
  jobId: string; draftId: string; status: string; draftRevision: number; errorCode: string | null
  reason: string | null; attempts: number; updatedAt: string
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
