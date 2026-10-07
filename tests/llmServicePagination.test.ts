import { beforeEach, expect, it, vi } from 'vitest'
import { listAllLlmServices } from '../src/api/llmService'
import type { LlmServiceInfo, LlmServiceListRespDTO } from '../src/types/llmService'

const mocks = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('../src/api/request', () => ({ default: { get: mocks.get } }))
const models = (count: number): LlmServiceInfo[] => Array.from({ length: count }, (_, index) => ({
  serviceId: String(index + 1), name: `model-${index + 1}`, provider: 'openai',
  modelName: 'upstream', status: 1, createdByUsername: 'owner',
}))
function response(items: LlmServiceInfo[], page: number): LlmServiceListRespDTO {
  return { serviceInfoList: items.slice((page - 1) * 100, page * 100), total: items.length,
    totalPages: Math.ceil(items.length / 100), page, pageSize: 100 }
}
beforeEach(() => vi.clearAllMocks())

it.each([0, 1, 100, 101, 205])('完整加载 %s 个模型，每页至多 100 且不请求额外空页', async count => {
  const items = models(count)
  mocks.get.mockImplementation(async (_url: string, options: { params: { pageNum: number } }) => response(items, options.params.pageNum))
  expect(await listAllLlmServices('tenant')).toEqual(items)
  expect(mocks.get.mock.calls).toEqual(Array.from({ length: Math.max(1, Math.ceil(count / 100)) }, (_, page) => [
    '/llm-service/tenant/list', { params: { pageNum: page + 1, pageSize: 100 } },
  ]))
})

it('中间页失败向调用方传播错误，不返回部分集合或继续请求后续页', async () => {
  const failure = new Error('第二页读取失败')
  mocks.get.mockResolvedValueOnce(response(models(205), 1)).mockRejectedValueOnce(failure)
  await expect(listAllLlmServices('tenant')).rejects.toBe(failure)
  expect(mocks.get).toHaveBeenCalledTimes(2)
})

it('不同租户独立读取，不复用其他租户模型', async () => {
  const first = models(1)
  const second = models(1).map(model => ({ ...model, serviceId: 'other-model' }))
  mocks.get.mockResolvedValueOnce(response(first, 1)).mockResolvedValueOnce(response(second, 1))
  expect(await listAllLlmServices('tenant-a')).toEqual(first)
  expect(await listAllLlmServices('tenant-b')).toEqual(second)
  expect(mocks.get.mock.calls.map(([url]) => url)).toEqual(['/llm-service/tenant-a/list', '/llm-service/tenant-b/list'])
})
