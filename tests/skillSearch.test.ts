import { describe, expect, it } from 'vitest'
import { safeSkillDownloadPath, skillSearchFromUrl, skillSearchToUrl } from '../src/utils/skill'

describe('Skill URL查询契约', () => {
  it('搜索、作者、标签和分页能往返而不丢筛选', () => {
    const query = skillSearchFromUrl({ keyword: '中文 %_', publisherId: '9007199254740993', tags: ['coding', 'testing'], category: 'development', page: '3', size: '24', sort: 'updated' })
    expect(query.publisherId).toBe('9007199254740993')
    expect(skillSearchToUrl(query)).toEqual({ keyword: '中文 %_', publisherId: '9007199254740993', tags: ['coding', 'testing'], category: 'development', page: '3', size: '24', sort: 'updated' })
  })
  it('非法分页回到有效默认，标签和关键词有界', () => {
    const result = skillSearchFromUrl({ keyword: 'x'.repeat(100), tags: ['1', '2', '3', '4', '5', '6'], page: '-1', size: '999' })
    expect(result.page).toBe(1); expect(result.size).toBe(12)
    expect(result.keyword?.length).toBe(80); expect(result.tags).toEqual(['1', '2', '3', '4', '5'])
    expect(skillSearchToUrl({ page: 1, size: 12, keyword: '  ' }).keyword).toBeUndefined()
  })
  it('只接受站内固定下载能力路径，拒绝外部和路径绕过', () => {
    expect(safeSkillDownloadPath('/api/v1/skills/downloads/' + 'a'.repeat(64))).toBe(true)
    for (const path of ['https://evil.invalid/file', '//evil.invalid/file', '/api/v1/skills/downloads/../x',
      '/api/v1/skills/downloads/' + 'a'.repeat(64) + '?redirect=elsewhere', '/api/v1/skills/downloads/short']) {
      expect(safeSkillDownloadPath(path)).toBe(false)
    }
  })
})
