import { expect, it } from 'vitest'
import { skillFileTree, visibleSkillFiles } from '../src/utils/skillFiles'

it('由扁平清单推导目录，目录优先稳定排序，根层可见但嵌套默认折叠', () => {
  const tree = skillFileTree(['z.txt', 'src/nested/main.py', 'docs/a.md', 'src/a.c', 'SKILL.md']
    .map(relativePath => ({ relativePath, sizeBytes: 1, sha256: 'hash' })))
  expect(tree.map(node => node.path)).toEqual(['docs', 'src', 'SKILL.md', 'z.txt'])
  expect(visibleSkillFiles(tree, new Set()).map(node => node.path)).toEqual(['docs', 'src', 'SKILL.md', 'z.txt'])
  expect(visibleSkillFiles(tree, new Set(['src'])).map(node => node.path))
    .toEqual(['docs', 'src', 'src/nested', 'src/a.c', 'SKILL.md', 'z.txt'])
  const expanded = visibleSkillFiles(tree, new Set(['src', 'src/nested']))
  expect(expanded.find(node => node.path === 'src/nested/main.py')).toMatchObject({ depth: 2, directory: false, name: 'main.py' })
  expect(skillFileTree([])).toEqual([])
})

it('路径中的特殊对象属性名及中文只是普通文件名，不污染目录结构', () => {
  const tree = skillFileTree(['__proto__/constructor.txt', '文档/说明.md'].map(relativePath => ({ relativePath, sizeBytes: 0, sha256: 'hash' })))
  expect(tree).toHaveLength(2)
  expect(tree[0]?.children[0]?.name).toBe('constructor.txt')
  expect(tree[1]?.children[0]?.path).toBe('文档/说明.md')
})
