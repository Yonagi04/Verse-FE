import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readFlow, saveFlow, useExternalAuthFlow, leaveForAuthorization, endFlow } from '../src/hooks/useExternalAuthFlow'
import type { ExternalFlowContext } from '../src/types/externalAuth'
const mocks = vi.hoisted(() => ({ getFlow:vi.fn(), cancelFlow:vi.fn(), acknowledgeFlow:vi.fn(), token:'session-one' }))
vi.mock('@/api/externalAuth', () => mocks)
vi.mock('@/utils/auth', () => ({ getToken:() => mocks.token }))
class MemoryStorage {
  private data = new Map<string,string>()
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
  it('到期凭证被清除且无法继续使用', async () => {
    await saveFlow({...start(),expiresAt:new Date(Date.now()-1000).toISOString()},'google','LOGIN')
    expect(() => readFlow(id)).toThrow('过期'); expect(sessionStorage.getItem('verse_external_flow:'+id)).toBeNull()
  })
  it('启动前校验官方HTTPS主机', async () => {
    await expect(leaveForAuthorization({...start(),authorizationUrl:'https://evil.example/'},'google','LOGIN')).rejects.toThrow('认证地址无效')
    expect(window.location.assign).not.toHaveBeenCalled(); expect(() => readFlow(id)).toThrow()
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
})
