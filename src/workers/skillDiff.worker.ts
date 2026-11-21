import { skillDiff } from '@/utils/skillDiff'
self.onmessage = (event: MessageEvent<{ oldText: string; newText: string }>) => {
  try {
    const result = skillDiff(event.data.oldText, event.data.newText)
    self.postMessage({ result }, { transfer: [result.oldOffsets.buffer, result.newOffsets.buffer] })
  } catch {
    self.postMessage({ error: '文件差异计算失败，请重试' })
  }
}
