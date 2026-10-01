import { h } from 'vue'
import { message, Modal } from 'ant-design-vue'
import Decimal from 'decimal.js'
import type { Attempt, ChatRequest, WorkbenchResource } from '@/types/playgroundWorkbench'
export async function copyWorkbenchText(text: string) {
  try { await navigator.clipboard.writeText(text); message.success('已复制') }
  catch { Modal.info({ title: '浏览器限制了剪贴板，请手动复制', width: 720, content: h('textarea', { value: text, readonly: true, style: 'width:100%;height:260px', onFocus: (e: FocusEvent) => (e.target as HTMLTextAreaElement).select() }) }) }
}
export function downloadWorkbench(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }))
  const link = document.createElement('a'); link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
}
export function requestCode(request: ChatRequest, format: string) {
  const json = JSON.stringify(request, null, 2)
  if (format === 'request') return json
  if (format === 'curl') return '# VERSE_BASE_URL 示例：https://verse.example.com/api/v1/openai\n# 使用具有该模型权限的 VERSE_API_KEY\ncurl "${VERSE_BASE_URL}/chat/completions" \\\n  -H "Authorization: Bearer ${VERSE_API_KEY}" \\\n  -H "Content-Type: application/json" \\\n  --data-binary @- <<\'VERSE_REQUEST\'\n' + json + '\nVERSE_REQUEST'
  if (format === 'python') return 'import os\nimport json\nfrom openai import OpenAI\n\nclient = OpenAI(api_key=os.environ["VERSE_API_KEY"], base_url=os.environ["VERSE_BASE_URL"])\nrequest = json.loads(' + JSON.stringify(JSON.stringify(request)) + ')\nfor chunk in client.chat.completions.create(**request):\n    if chunk.choices:\n        print(chunk.choices[0].delta.content or "", end="", flush=True)\n'
  return 'import OpenAI from "openai";\n\nconst client = new OpenAI({ apiKey: process.env.VERSE_API_KEY, baseURL: process.env.VERSE_BASE_URL });\nconst stream = await client.chat.completions.create(' + json + ');\nfor await (const chunk of stream) {\n  process.stdout.write(chunk.choices[0]?.delta?.content ?? "");\n}\n'
}
export const evidenceLabel = (value: string) => ({ EXACT: '精确', ESTIMATED: '估算', UNKNOWN: '未知' }[value] || value)
export const moneyFen = (value: string | number) => new Decimal(value).div(100).toFixed(6)
export function costLabel(a: Attempt) {
  const m = a.metrics
  if (m.costFen != null) return `${m.currency || ''} ${moneyFen(m.costFen)}${m.evidence === 'ESTIMATED' ? '（估算）' : ''}`
  return m.costStatus === 'PENDING' ? '结算中' : ['UNPRICED', 'UNCALCULABLE'].includes(m.costStatus) ? '不可计算' : m.costStatus === 'NOT_CHARGEABLE' ? '未计费（实际费用未知）' : '未知'
}
export function sessionMarkdown(group: WorkbenchResource) {
  let text = `# ${group.title}\n\n`
  if (group.payload.prefix?.length) text += '## 分叉历史前缀\n\n' + group.payload.prefix.map(m => `### ${m.role}\n\n${m.content}\n`).join('\n')
  for (const a of group.attempts || []) text += `\n## 第 ${a.roundNo} 轮 · ${a.snapshot.modelName} · 尝试 ${a.attemptNo}\n\n${a.prompt}\n\n${a.reply}\n\n状态：${a.status}\n请求 ID：${a.requestId}\n费用：${costLabel(a)}\n配置：${JSON.stringify(a.snapshot.config)}\n指标：${JSON.stringify(a.metrics)}\n`
  return text
}
