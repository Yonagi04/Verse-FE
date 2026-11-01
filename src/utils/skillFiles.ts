import type { SkillFile } from '@/types/skill'

export interface SkillFileNode {
  path: string; name: string; directory: boolean; depth: number; children: SkillFileNode[]
}

/** 文件清单最多五百项，目录只由规范化相对路径推导。 */
export function skillFileTree(files: SkillFile[]): SkillFileNode[] {
  const roots: SkillFileNode[] = []
  const nodes = new Map<string, SkillFileNode>()
  for (const file of files) {
    let children = roots
    const segments = file.relativePath.split('/')
    segments.forEach((name, index) => {
      const path = segments.slice(0, index + 1).join('/')
      let node = nodes.get(path)
      if (!node) {
        node = { path, name, directory: index < segments.length - 1, depth: index, children: [] }
        nodes.set(path, node); children.push(node)
      }
      children = node.children
    })
  }
  const sort = (items: SkillFileNode[]) => {
    items.sort((left, right) => Number(right.directory) - Number(left.directory)
      || (left.name < right.name ? -1 : left.name > right.name ? 1 : 0))
    items.forEach(item => sort(item.children))
  }
  sort(roots)
  return roots
}

export function visibleSkillFiles(nodes: SkillFileNode[], expanded: Set<string>): SkillFileNode[] {
  return nodes.flatMap(node => [node, ...(node.directory && expanded.has(node.path)
    ? visibleSkillFiles(node.children, expanded) : [])])
}
