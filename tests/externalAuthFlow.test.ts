import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readFlow, saveFlow, useExternalAuthFlow, leaveForAuthorization, endFlow, cancelStoredFlows, cancelAbandonedFlows } from '../src/hooks/useExternalAuthFlow'
import type { ExternalFlowContext } from '../src/types/externalAuth'
const mocks = vi.hoisted(() => ({ getFlow:vi.fn(), cancelFlow:vi.fn(), acknowledgeFlow:vi.fn(), token:'session-one' }))
vi.mock('@/api/externalAuth', () => mocks)
vi.mock('@/utils/auth', () => ({ getToken:() => mocks.token }))
class MemoryStorage {
  private data = new Map<string,string>()
  get length() { return this.data.size }
  key(index:number) { return Array.from(this.data.keys())[index] ?? null }
  getItem(key:string) { return this.data.get(key) ?? null }
  setItem(key:string,value:string) { this.data.set(key,value) }
  removeItem(key:string) { this.data.delete(key) }
}
const id = 'a'.repeat(32)
const start = () => ({ flowId:id, flowToken:'tab-proof', authorizationUrl:'https://accounts.google.com/o/oauth2/v2/auth', expiresAt:new Date(Date.now()+600000).toISOString() })
function context(stage = 'REGISTER_REQUIRED'): ExternalFlowContext {
  return { flowId:id, purpose:'LOGIN', provider:'google', stage:stage as ExternalFlowContext['stage'], externalAccount:null,
    accounts:[], registrationDefaults:null, targetAccount:null, boundAccountCount:null, expiresAt:new Date(Date.now()+300000).toISOString(), errorReason:null, completion:null }
}
beforeEach(() => {
  vi.clearAllMocks(); vi.stubGlobal('sessionStorage',new MemoryStorage()); mocks.token='session-one'
  vi.stubGlobal('window',{ location:{assign:vi.fn()} }); mocks.cancelFlow.mockResolvedValue(undefined); mocks.acknowledgeFlow.mockResolvedValue(undefined)
})
describe('标签页认证凭证', () => {
  it('仅有流程URL无法恢复任何认证权限', () => { expect(() => readFlow(id)).toThrow('发起认证'); expect(mocks.getFlow).not.toHaveBeenCalled() })
  it('每个流程独立保存，当前标签页刷新可恢复', async () => {
    await saveFlow(start(),'google','LOGIN'); await saveFlow({...start(),flowId:'b'.repeat(32)},'github','LOGIN')
    expect(readFlow(id).flowToken).toBe('tab-proof'); expect(readFlow().provider).toBe('github')
  })
  it('动作期限按服务端刷新，不能沿用授权阶段期限', async () => {
    await saveFlow(start(),'google','LOGIN'); const result=context(); mocks.getFlow.mockResolvedValue(result)
    await useExternalAuthFlow().load(id); expect(readFlow(id).expiresAt).toBe(result.expiresAt)
  })
  it('原绑定会话被换号后不能恢复绑定界面', async () => {
    await saveFlow(start(),'google','BIND'); mocks.token='another-session'
    await expect(useExternalAuthFlow().load(id)).rejects.toThrow('登录会话已变化'); expect(mocks.getFlow).not.toHaveBeenCalled()
  })
  it('到期凭证不能继续业务操作，但保留到取消确认后才清除', async () => {
    await saveFlow({...start(),expiresAt:new Date(Date.now()-1000).toISOString()},'google','LOGIN')
    expect(() => readFlow(id)).toThrow('过期'); expect(sessionStorage.getItem('verse_external_flow:'+id)).not.toBeNull()
    await cancelStoredFlows()
    expect(mocks.cancelFlow).toHaveBeenCalledWith(id,'tab-proof'); expect(sessionStorage.getItem('verse_external_flow:'+id)).toBeNull()
  })
  it('启动前校验官方HTTPS主机', async () => {
    await expect(leaveForAuthorization({...start(),authorizationUrl:'https://evil.example/'},'google','LOGIN')).rejects.toThrow('认证地址无效')
    expect(window.location.assign).not.toHaveBeenCalled(); expect(() => readFlow(id)).toThrow()
  })
  it('飞书授权地址保存流程后跳转到官方主机', async () => {
    const authorizationUrl = 'https://accounts.feishu.cn/open-apis/authen/v1/authorize?client_id=cli_test&state=state'
    await leaveForAuthorization({...start(), authorizationUrl}, 'feishu', 'LOGIN')
    expect(window.location.assign).toHaveBeenCalledWith(authorizationUrl)
    expect(readFlow(id).provider).toBe('feishu')
  })
  it('飞书拒绝伪造主机、明文地址及携带URL凭据的跳转', async () => {
    for (const authorizationUrl of ['https://accounts.feishu.cn.evil.example/', 'http://accounts.feishu.cn/', 'https://user:secret@accounts.feishu.cn/', 'https://accounts.google.com/']) {
      await expect(leaveForAuthorization({...start(), authorizationUrl}, 'feishu', 'LOGIN')).rejects.toThrow('认证地址无效')
    }
    expect(window.location.assign).not.toHaveBeenCalled()
    expect(() => readFlow(id)).toThrow()
  })
  it('存储失败时取消流程，不跳转到外部平台', async () => {
    vi.stubGlobal('sessionStorage',{setItem:() => { throw new Error('storage unavailable') }})
    await expect(leaveForAuthorization(start(),'google','LOGIN')).rejects.toThrow('无法保存')
    expect(mocks.cancelFlow).toHaveBeenCalledWith(id,'tab-proof'); expect(window.location.assign).not.toHaveBeenCalled()
  })
  it('完成后只清除当前流程，保留其他流程', async () => {
    await saveFlow(start(),'google','LOGIN'); await saveFlow({...start(),flowId:'b'.repeat(32)},'github','LOGIN')
    await endFlow(id,true); expect(mocks.acknowledgeFlow).toHaveBeenCalledWith(id,'tab-proof'); expect(readFlow().provider).toBe('github')
  })
  it('旧请求返回不能覆盖较新的流程上下文', async () => {
    await saveFlow(start(),'google','LOGIN')
    let resolveOld!: (context:ExternalFlowContext) => void
    mocks.getFlow.mockImplementationOnce(() => new Promise(resolve => { resolveOld=resolve })).mockResolvedValueOnce(context('SELECT_REQUIRED'))
    const flow=useExternalAuthFlow(); const old=flow.load(id); const rejection=expect(old).rejects.toThrow('已切换')
    await flow.load(id); resolveOld(context()); await rejection; expect(flow.context.value?.stage).toBe('SELECT_REQUIRED')
  })
  it('手动离开注册流程时清理飞书登录和此前两个未完成绑定', async () => {
    await saveFlow(start(),'feishu','LOGIN')
    await saveFlow({...start(),flowId:'b'.repeat(32),flowToken:'github-proof'},'github','BIND')
    await saveFlow({...start(),flowId:'c'.repeat(32),flowToken:'feishu-proof'},'feishu','BIND')
    sessionStorage.setItem('unrelated','keep')
    await cancelAbandonedFlows({path:'/login',meta:{},query:{}})
    expect(mocks.cancelFlow).toHaveBeenCalledTimes(3)
    expect(mocks.cancelFlow).toHaveBeenCalledWith(id,'tab-proof')
    expect(mocks.cancelFlow).toHaveBeenCalledWith('b'.repeat(32),'github-proof')
    expect(mocks.cancelFlow).toHaveBeenCalledWith('c'.repeat(32),'feishu-proof')
    expect(sessionStorage.getItem('verse_external_current')).toBeNull()
    expect(sessionStorage.getItem('unrelated')).toBe('keep')
    expect(() => readFlow()).toThrow()
  })
  it('认证内部跳转、已有账号登录续接和刷新恢复均保留当前流程', async () => {
    await saveFlow(start(),'feishu','LOGIN')
    for (const path of ['/auth/external/callback','/register/external','/login/select-account','/profile/external-account/confirm'])
      await cancelAbandonedFlows({path,meta:{externalFlow:true},query:{flow:id}})
    await cancelAbandonedFlows({path:'/login',meta:{},query:{flow:id}})
    expect(mocks.cancelFlow).not.toHaveBeenCalled(); expect(readFlow(id).flowToken).toBe('tab-proof')
  })
  it('续接已有账号绑定只保留指定流程，不读取其他标签页证明', async () => {
    await saveFlow(start(),'feishu','LOGIN')
    await saveFlow({...start(),flowId:'b'.repeat(32)},'github','BIND')
    await cancelStoredFlows(id)
    expect(mocks.cancelFlow).toHaveBeenCalledTimes(1)
    expect(mocks.cancelFlow).toHaveBeenCalledWith('b'.repeat(32),'tab-proof')
    expect(readFlow(id).provider).toBe('feishu')
    expect(mocks.cancelFlow).not.toHaveBeenCalledWith('c'.repeat(32),expect.anything())
  })
  it('取消失败保留证明，其他流程仍完成清理，下一次可重试', async () => {
    await saveFlow(start(),'feishu','LOGIN')
    await saveFlow({...start(),flowId:'b'.repeat(32)},'github','BIND')
    mocks.cancelFlow.mockRejectedValueOnce(new Error('network error'))
    await expect(cancelStoredFlows()).rejects.toThrow('无法结束上次外部认证')
    expect(readFlow(id).flowToken).toBe('tab-proof')
    expect(sessionStorage.getItem('verse_external_flow:'+'b'.repeat(32))).toBeNull()
    await cancelStoredFlows()
    expect(mocks.cancelFlow).toHaveBeenCalledTimes(3); expect(sessionStorage.getItem('verse_external_flow:'+id)).toBeNull()
  })
  it('服务端确认旧证明无效后可清理，损坏的记录也不会阻止新发起', async () => {
    await saveFlow(start(),'feishu','LOGIN')
    sessionStorage.setItem('verse_external_flow:'+'b'.repeat(32),'{broken')
    mocks.cancelFlow.mockRejectedValueOnce(Object.assign(new Error('invalid'),{code:'A002101'}))
    await cancelStoredFlows()
    expect(mocks.cancelFlow).toHaveBeenCalledTimes(1)
    expect(sessionStorage.getItem('verse_external_flow:'+id)).toBeNull()
    expect(sessionStorage.getItem('verse_external_flow:'+'b'.repeat(32))).toBeNull()
  })
  it('路由后台清理与新发起前的清理等待同一个取消请求', async () => {
    await saveFlow(start(),'feishu','LOGIN')
    let completeCancellation!: () => void
    mocks.cancelFlow.mockImplementationOnce(() => new Promise<void>(resolve => { completeCancellation=resolve }))
    const navigating=cancelAbandonedFlows({path:'/profile',meta:{},query:{}})
    let ready=false
    const beforeStart=cancelStoredFlows().then(() => { ready=true })
    await Promise.resolve()
    expect(ready).toBe(false); expect(mocks.cancelFlow).toHaveBeenCalledTimes(1)
    completeCancellation(); await Promise.all([navigating,beforeStart])
    expect(ready).toBe(true); expect(sessionStorage.getItem('verse_external_flow:'+id)).toBeNull()
  })
  it('完成响应确认失败也保留恢复证明', async () => {
    await saveFlow(start(),'feishu','LOGIN'); mocks.acknowledgeFlow.mockRejectedValueOnce(new Error('response lost'))
    await expect(endFlow(id,true)).rejects.toThrow('response lost')
    expect(readFlow(id).flowToken).toBe('tab-proof')
    await endFlow(id,true); expect(sessionStorage.getItem('verse_external_flow:'+id)).toBeNull()
  })
})
