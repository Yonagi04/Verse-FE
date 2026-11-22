import type { LocationQuery, LocationQueryRaw } from 'vue-router'
import type { FavoriteFolder, FavoriteQuery } from '@/types/skillFavorite'

export const cleanFolderName = (value: string) => value.trim().normalize('NFC')
export function folderNameError(value: string, folders: FavoriteFolder[], exclude?: string): string {
  const name = cleanFolderName(value)
  if (!name) return '请输入收藏夹名称'
  if (Array.from(name).length > 20) return '收藏夹名称不能超过 20 个字符'
  if (/[\p{Cc}]/u.test(name)) return '名称不能包含控制字符'
  if (['默认收藏夹', '全部收藏'].includes(name)) return '此名称为系统保留名称，请换一个'
  const key = name.toLowerCase().normalize('NFC')
  if (folders.some(item => item.folderId !== exclude && item.name.toLowerCase().normalize('NFC') === key)) return '已存在同名收藏夹，请换一个名称'
  return ''
}
const scalar = (value: LocationQuery[string]) => typeof value === 'string' ? value : undefined
export function favoriteQueryFromUrl(query: LocationQuery): FavoriteQuery {
  const folder = scalar(query.folder)
  const page = Number(scalar(query.page) || 1)
  return { folderId: folder && /^(0|[1-9]\d{0,18})$/.test(folder) && BigInt(folder) <= 9223372036854775807n ? folder : undefined,
    keyword: Array.from(scalar(query.keyword)?.trim() || '').slice(0, 80).join('') || undefined,
    sort: scalar(query.sort) === 'updated' ? 'updated' : 'saved',
    page: Number.isInteger(page) && page >= 1 && page <= 10000 ? page : 1, size: 12 }
}
export function favoriteQueryToUrl(query: FavoriteQuery): LocationQueryRaw {
  return { folder: query.folderId, keyword: query.keyword?.trim() || undefined,
    sort: query.sort === 'updated' ? 'updated' : undefined, page: query.page > 1 ? String(query.page) : undefined }
}
export function skillReturnPath(value: unknown): string {
  if (typeof value !== 'string' || /[\\#\p{Cc}]/u.test(value)) return '/skills'
  const path = value.split('?')[0]
  return path === '/skills' || path === '/skills/favorites' ? value : '/skills'
}
const releaseFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' })
export function skillReleaseDate(value: string | null | undefined): string {
  if (!value || !Number.isFinite(Date.parse(value))) return '—'
  const parts = Object.fromEntries(releaseFormatter.formatToParts(new Date(value)).map(item => [item.type, item.value]))
  return `${parts.year}-${parts.month}-${parts.day}`
}
