import request from './request'
import axios from 'axios'
import { getToken } from '@/utils/auth'
import type { Result } from '@/types/api'
import type { UsageBreakdown, UsageBreakdownFilters, UsageDashboard, UsageExportType, UsageFilterOptions, UsageMetrics, UsageReport, UsageReportFilters } from '@/types/usage'

export const getUsageDashboard = (tenantId:string):Promise<UsageDashboard> => request.get(`/usage/${tenantId}/dashboard`)
export const getUsageOverview = (tenantId:string, params:Omit<UsageReportFilters,'granularity'>):Promise<UsageMetrics> => request.get(`/usage/${tenantId}/overview`,{params})
export const getUsageTimeseries = (tenantId:string, params:UsageReportFilters):Promise<UsageReport> => request.get(`/usage/${tenantId}/timeseries`,{params})
export const getUsageBreakdown = (tenantId:string, params:UsageBreakdownFilters):Promise<UsageBreakdown> => request.get(`/usage/${tenantId}/breakdown`,{params})
export const getUsageFilterOptions = (tenantId:string):Promise<UsageFilterOptions> => request.get(`/usage/${tenantId}/filters`)

/** 下载二进制报表；若服务端返回 JSON 错误，则先解码并抛出业务错误。 */
export async function downloadUsageExport(tenantId:string,type:UsageExportType,params:UsageBreakdownFilters):Promise<void>{
 const response=await axios.get(`${import.meta.env.VITE_API_BASE_URL}/usage/${tenantId}/export`,{params:{...params,type},responseType:'blob',validateStatus:()=>true,headers:{Authorization:`Bearer ${getToken()??''}`}})
 const contentType=String(response.headers['content-type']??'')
 if(contentType.includes('application/json')||response.status>=400){try{const result=JSON.parse(await response.data.text()) as Result;throw new Error(result.message||'导出失败')}catch(e){if(e instanceof SyntaxError)throw new Error(`导出失败（HTTP ${response.status}）`);throw e}}
 const disposition=String(response.headers['content-disposition']??'');const encoded=/filename\*=UTF-8''([^;]+)/i.exec(disposition)?.[1]
 const quoted=/filename="?([^";]+)"?/i.exec(disposition)?.[1];let filename='usage-report.xlsx'
 try{filename=decodeURIComponent(encoded??quoted??filename).replace(/[\\/:*?"<>|]/g,'_')}catch{/* 使用安全默认文件名 */}
 const url=URL.createObjectURL(response.data);const anchor=document.createElement('a');anchor.href=url;anchor.download=filename;document.body.appendChild(anchor);anchor.click();anchor.remove();window.setTimeout(()=>URL.revokeObjectURL(url),1000)
}
