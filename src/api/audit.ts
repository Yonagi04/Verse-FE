import request from './request'
import type { LlmAuditDetailRespDTO, LlmAuditListRespDTO } from '@/types/audit'

// 分页获取审计记录列表（userId 可选，仅 ADMIN/SUPER_ADMIN 生效；MEMBER 忽略）
export function listAuditLogs(
  tenantId: string,
  pageNum: number,
  pageSize: number,
  userId?: string,
): Promise<LlmAuditListRespDTO> {
  return request.get(`/audit/${tenantId}/list`, {
    params: { pageNum, pageSize, ...(userId ? { userId } : {}) },
  })
}

// 获取审计记录详情（回源 S3 返回完整输入/输出）
export function getAuditDetail(tenantId: string, auditId: number): Promise<LlmAuditDetailRespDTO> {
  return request.get(`/audit/${tenantId}/detail/${auditId}`)
}
