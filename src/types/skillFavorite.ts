import type { SkillCard, SkillPage } from './skill'

export interface FavoriteFolder { folderId: string; name: string; defaultFolder: boolean; count: number }
export interface FavoriteFolders { folders: FavoriteFolder[]; total: number; folderLimit: number; favoriteLimit: number }
export interface FavoriteStatus {
  skillId: string; favoriteId: string | null; folderId: string | null; folderName: string | null; savedAt: string | null
}
export interface FavoriteItem {
  favoriteId: string; skillId: string; folderId: string; folderName: string; savedAt: string
  availability: 'AVAILABLE' | 'UNAVAILABLE'; skill: SkillCard | null
}
export interface FavoriteQuery { folderId?: string; keyword?: string; sort: 'saved' | 'updated'; page: number; size: 12 }
export type FavoritePage = SkillPage<FavoriteItem>
export interface FolderReceipt { folderId: string; changed: boolean; migrated: number }
export interface FavoriteReceipt {
  outcome: 'CREATED' | 'EXISTING' | 'MOVED' | 'CANCELLED' | 'ABSENT' | 'RESTORED'
  favoriteId: string; skillId: string | null; folderId: string | null; savedAt: string | null
  removed: boolean; undoExpiresAt: string | null; fallbackToDefault: boolean
}
export type FavoriteAction =
  | { type: 'create'; skillId: string; folderId: string }
  | { type: 'move'; favoriteId: string; folderId: string }
  | { type: 'cancel' | 'restore'; favoriteId: string }
  | { type: 'createFolder'; name: string }
  | { type: 'renameFolder'; folderId: string; name: string }
  | { type: 'deleteFolder'; folderId: string }
