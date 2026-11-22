import http from './request'
import type { FavoriteFolders, FavoriteStatus, FavoriteQuery, FavoritePage, FavoriteAction, FavoriteReceipt, FolderReceipt } from '@/types/skillFavorite'

const base = '/skills/me'
const read = (signal?: AbortSignal) => ({ signal, silentError: true })
export const favoriteFolders = (signal?: AbortSignal): Promise<FavoriteFolders> => http.get(`${base}/favorite-folders`, read(signal))
export function favoriteStatuses(ids: string[], signal?: AbortSignal): Promise<FavoriteStatus[]> {
  const params = new URLSearchParams()
  const uniqueIds = [...new Set(ids)].sort()
  uniqueIds.forEach(id => params.append('skillIds', id))
  return http.get(`${base}/favorites/statuses`, { ...read(signal), params })
}
export const favoritePage = (query: FavoriteQuery, signal?: AbortSignal): Promise<FavoritePage> =>
  http.get(`${base}/favorites`, { ...read(signal), params: query })

export function favoriteCommand(action: FavoriteAction, key: string, signal?: AbortSignal): Promise<FavoriteReceipt | FolderReceipt> {
  const config = { ...read(signal), headers: { 'Idempotency-Key': key } }
  switch (action.type) {
    case 'create': return http.post(`${base}/favorites`, { skillId: action.skillId, folderId: action.folderId }, config)
    case 'move': return http.put(`${base}/favorites/${action.favoriteId}`, { folderId: action.folderId }, config)
    case 'cancel': return http.delete(`${base}/favorites/${action.favoriteId}`, config)
    case 'restore': return http.post(`${base}/favorites/${action.favoriteId}/restore`, undefined, config)
    case 'createFolder': return http.post(`${base}/favorite-folders`, { name: action.name }, config)
    case 'renameFolder': return http.put(`${base}/favorite-folders/${action.folderId}`, { name: action.name }, config)
    case 'deleteFolder': return http.delete(`${base}/favorite-folders/${action.folderId}`, config)
  }
}
