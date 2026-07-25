import type { Role, TenantType } from './user'

export interface TenantCreateReqDTO {
  name: string
  description?: string
}

export interface TenantInfoRespDTO {
  tenantId: number
  name: string
  type: TenantType
  description: string
}

export interface TenantInfoListRespDTO {
  tenantId: number
  name: string
  type: TenantType
  role: Role
  joinedAt: string
  lastAccessedAt: string
}
