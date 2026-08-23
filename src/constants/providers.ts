// ========== LLM 供应商目录 ==========
// 前端展示名：国产品牌中文、国外厂商英文；接口 provider 参数恒为英文 slug。
// Logo 使用 @lobehub/icons-static-svg（静态 SVG，<img> 加载），缺失时回退首字母 monogram。

import openaiLogo from '@lobehub/icons-static-svg/icons/openai.svg'
import claudeLogo from '@lobehub/icons-static-svg/icons/claude-color.svg'
import geminiLogo from '@lobehub/icons-static-svg/icons/gemini-color.svg'
import mistralLogo from '@lobehub/icons-static-svg/icons/mistral-color.svg'
import xaiLogo from '@lobehub/icons-static-svg/icons/xai.svg'
import perplexityLogo from '@lobehub/icons-static-svg/icons/perplexity-color.svg'
import cohereLogo from '@lobehub/icons-static-svg/icons/cohere-color.svg'
import metaLogo from '@lobehub/icons-static-svg/icons/meta-color.svg'
import deepseekLogo from '@lobehub/icons-static-svg/icons/deepseek-color.svg'
import zhipuLogo from '@lobehub/icons-static-svg/icons/zhipu-color.svg'
import qwenLogo from '@lobehub/icons-static-svg/icons/qwen-color.svg'
import doubaoLogo from '@lobehub/icons-static-svg/icons/doubao-color.svg'
import kimiLogo from '@lobehub/icons-static-svg/icons/kimi.svg'
import minimaxLogo from '@lobehub/icons-static-svg/icons/minimax-color.svg'
import wenxinLogo from '@lobehub/icons-static-svg/icons/wenxin-color.svg'
import hunyuanLogo from '@lobehub/icons-static-svg/icons/hunyuan-color.svg'
import stepfunLogo from '@lobehub/icons-static-svg/icons/stepfun-color.svg'
import zerooneLogo from '@lobehub/icons-static-svg/icons/zeroone-color.svg'
import baichuanLogo from '@lobehub/icons-static-svg/icons/baichuan-color.svg'
import openrouterLogo from '@lobehub/icons-static-svg/icons/openrouter-color.svg'
import siliconcloudLogo from '@lobehub/icons-static-svg/icons/siliconcloud-color.svg'
import azureLogo from '@lobehub/icons-static-svg/icons/azure-color.svg'
import bedrockLogo from '@lobehub/icons-static-svg/icons/bedrock-color.svg'
import ollamaLogo from '@lobehub/icons-static-svg/icons/ollama.svg'

export type ProviderGroup = '海外' | '国内' | '聚合 / 网关'

export interface Provider {
  slug: string
  displayName: string
  letter: string
  color: string
  apiUrl: string
  group: ProviderGroup
  logo: string
}

const LOGOS: Record<string, string> = {
  openai: openaiLogo,
  anthropic: claudeLogo,
  gemini: geminiLogo,
  mistral: mistralLogo,
  grok: xaiLogo,
  perplexity: perplexityLogo,
  cohere: cohereLogo,
  llama: metaLogo,
  deepseek: deepseekLogo,
  zhipu: zhipuLogo,
  qwen: qwenLogo,
  doubao: doubaoLogo,
  kimi: kimiLogo,
  minimax: minimaxLogo,
  ernie: wenxinLogo,
  hunyuan: hunyuanLogo,
  stepfun: stepfunLogo,
  yi: zerooneLogo,
  baichuan: baichuanLogo,
  openrouter: openrouterLogo,
  siliconflow: siliconcloudLogo,
  azure: azureLogo,
  bedrock: bedrockLogo,
  ollama: ollamaLogo,
}

// [group, displayName, letter, color, slug, apiUrl]
type RawProvider = [ProviderGroup, string, string, string, string, string]

const RAW_PROVIDERS: RawProvider[] = [
  // 海外
  ['海外', 'OpenAI', 'O', '#10a37f', 'openai', 'https://api.openai.com/v1'],
  ['海外', 'Anthropic', 'A', '#d97757', 'anthropic', 'https://api.anthropic.com/v1'],
  ['海外', 'Google Gemini', 'G', '#4285f4', 'gemini', 'https://generativelanguage.googleapis.com/v1beta/openai'],
  ['海外', 'Mistral AI', 'M', '#fa5000', 'mistral', 'https://api.mistral.ai/v1'],
  ['海外', 'xAI Grok', 'X', '#111111', 'grok', 'https://api.x.ai/v1'],
  ['海外', 'Perplexity', 'P', '#20808d', 'perplexity', 'https://api.perplexity.ai'],
  ['海外', 'Cohere', 'C', '#39594d', 'cohere', 'https://api.cohere.ai/v1'],
  ['海外', 'Meta Llama', 'L', '#0866ff', 'llama', 'https://api.llama-api.com'],
  // 国内
  ['国内', 'DeepSeek', '深', '#4d6bfe', 'deepseek', 'https://api.deepseek.com/v1'],
  ['国内', '智谱AI', '智', '#3859ff', 'zhipu', 'https://open.bigmodel.cn/api/paas/v4'],
  ['国内', '通义千问', '通', '#615ced', 'qwen', 'https://dashscope.aliyuncs.com/compatible-mode/v1'],
  ['国内', '豆包', '豆', '#3370ff', 'doubao', 'https://ark.cn-beijing.volces.com/api/v3'],
  ['国内', 'Kimi', 'K', '#161616', 'kimi', 'https://api.moonshot.cn/v1'],
  ['国内', 'MiniMax', 'M', '#f23f5d', 'minimax', 'https://api.minimax.io/v1'],
  ['国内', '文心一言', '文', '#2932e1', 'ernie', 'https://qianfan.baidubce.com/v2'],
  ['国内', '腾讯混元', '混', '#00a4ff', 'hunyuan', 'https://api.hunyuan.cloud.tencent.com/v1'],
  ['国内', '阶跃星辰', '阶', '#6b5bff', 'stepfun', 'https://api.stepfun.com/v1'],
  ['国内', '零一万物', '零', '#1a1a1a', 'yi', 'https://api.lingyiwanwu.com/v1'],
  ['国内', '百川智能', '百', '#5b21b6', 'baichuan', 'https://api.baichuan-ai.com/v1'],
  // 聚合 / 网关
  ['聚合 / 网关', 'OpenRouter', 'O', '#000000', 'openrouter', 'https://openrouter.ai/api/v1'],
  ['聚合 / 网关', '硅基流动', '硅', '#4f46e5', 'siliconflow', 'https://api.siliconflow.cn/v1'],
  ['聚合 / 网关', 'Azure OpenAI', 'Az', '#0078d4', 'azure', 'https://{resource}.openai.azure.com'],
  ['聚合 / 网关', 'AWS Bedrock', 'A', '#ff9900', 'bedrock', 'https://{region}.amazonaws.com'],
  ['聚合 / 网关', 'Ollama', 'O', '#000000', 'ollama', 'http://localhost:11434/v1'],
]

export const PROVIDERS: Provider[] = RAW_PROVIDERS.map(
  ([group, displayName, letter, color, slug, apiUrl]) => ({
    group,
    displayName,
    letter,
    color,
    slug,
    apiUrl,
    logo: LOGOS[slug] ?? '',
  }),
)

export const PROVIDER_GROUPS: { label: ProviderGroup; providers: Provider[] }[] = (
  ['海外', '国内', '聚合 / 网关'] as ProviderGroup[]
).map((label) => ({
  label,
  providers: PROVIDERS.filter((p) => p.group === label),
}))

/** 根据 slug 查找供应商，未知供应商返回 undefined */
export function getProviderBySlug(slug: string): Provider | undefined {
  return PROVIDERS.find((p) => p.slug === slug)
}

/**
 * 供应商名称前缀：选择供应商后自动更新名称。
 * 空名称 → `slug-`；已有任一已知 slug 前缀 → 替换为新 slug 前缀；否则前置 `slug-`。
 */
export function prefixProviderName(name: string, slug: string): string {
  const trimmed = name.trim()
  if (!trimmed) return `${slug}-`
  for (const p of PROVIDERS) {
    const prefix = `${p.slug}-`
    if (trimmed.toLowerCase().startsWith(prefix)) {
      return `${slug}-${trimmed.slice(prefix.length)}`
    }
  }
  return `${slug}-${trimmed}`
}
