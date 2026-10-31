import type { LocationQuery, LocationQueryRaw } from 'vue-router'
import type { SkillSearch } from '@/types/skill'

const scalar = (value: LocationQuery[string]) => typeof value === 'string' ? value : undefined
export function skillSearchFromUrl(query: LocationQuery): SkillSearch {
  const page = Number(scalar(query.page) || 1)
  const size = Number(scalar(query.size) || 12)
  const tags = Array.isArray(query.tags) ? query.tags.filter((tag): tag is string => typeof tag === 'string') : scalar(query.tags) ? [String(query.tags)] : []
  return { keyword: scalar(query.keyword)?.slice(0, 80), category: scalar(query.category), tags: tags.slice(0, 5),
    publisherId: scalar(query.publisherId), sort: scalar(query.sort) === 'updated' ? 'updated' : undefined,
    page: Number.isInteger(page) && page >= 1 && page <= 10000 ? page : 1, size: size === 24 ? 24 : 12 }
}
export function skillSearchToUrl(query: SkillSearch): LocationQueryRaw {
  return { keyword: query.keyword?.trim() || undefined, category: query.category || undefined,
    tags: query.tags?.length ? query.tags : undefined, publisherId: query.publisherId || undefined,
    sort: query.sort || undefined, page: query.page > 1 ? String(query.page) : undefined,
    size: query.size === 24 ? '24' : undefined }
}
export function safeSkillDownloadPath(path: string): boolean {
  return /^\/api\/v1\/skills\/downloads\/[a-f0-9]{64}$/.test(path)
}
export const skillStatusLabel = (status: string) => ({ ACTIVE: '已发布', DRAFT: '草稿', OWNER_UNPUBLISHED: '已下架',
  PLATFORM_DISABLED: '已停用', EDITING: '编辑中', READY: '检查通过', SUBMITTED: '已提交', CANCELLED: '已取消',
  EXPIRED: '已过期', WAITING_UPLOAD: '等待上传', UPLOADING: '正在接收', QUEUED: '排队中', RUNNING: '正在检查',
  RETRY_WAIT: '等待重试', SUCCEEDED: '检查通过', FAILED: '检查失败' }[status] || status)
export const skillBytes = (bytes: number | null | undefined) => bytes == null ? '—' : `${(bytes / 1024 / 1024).toFixed(2)} MiB`
