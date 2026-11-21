/** 行边界包含真实行尾，不标准化空白；空文件没有行token。 */
export type DiffKind = 'equal' | 'delete' | 'insert'
export interface DiffOperation { kind: DiffKind; oldStart: number; newStart: number; count: number }
export interface SkillDiff { oldOffsets: Int32Array; newOffsets: Int32Array; operations: DiffOperation[]; coarse: boolean }
export function lineOffsets(text: string): Int32Array {
  const offsets = [0]
  const endings = /\r\n|\r|\n/g
  let match: RegExpExecArray | null
  while ((match = endings.exec(text))) offsets.push(match.index + match[0].length)
  if (offsets[offsets.length - 1] !== text.length) offsets.push(text.length)
  return Int32Array.from(offsets)
}
export function lineToken(text: string, offsets: Int32Array, index: number): string {
  return text.slice(offsets[index], offsets[index + 1])
}
export function lineDisplay(token: string): { text: string; ending: string } {
  const ending = token.endsWith('\r\n') ? 'CRLF' : token.endsWith('\n') ? 'LF' : token.endsWith('\r') ? 'CR' : 'NONE'
  return { text: ending === 'NONE' ? token : token.slice(0, ending === 'CRLF' ? -2 : -1), ending }
}
/** LCS预算以内精确比较；超出预算的整段替换仍可重建两侧全部原文。 */
export function skillDiff(oldText: string, newText: string, budget = 2_000_000): SkillDiff {
  const oldOffsets = lineOffsets(oldText), newOffsets = lineOffsets(newText)
  const oldLength = oldOffsets.length - 1, newLength = newOffsets.length - 1
  const operations: DiffOperation[] = []
  const equal = (a: number, b: number) => lineToken(oldText, oldOffsets, a) === lineToken(newText, newOffsets, b)
  function append(kind: DiffKind, oldStart: number, newStart: number, count = 1) {
    if (!count) return
    const previous = operations[operations.length - 1]
    if (previous?.kind === kind) previous.count += count
    else operations.push({ kind, oldStart, newStart, count })
  }
  let prefix = 0, suffix = 0
  while (prefix < oldLength && prefix < newLength && equal(prefix, prefix)) prefix++
  while (suffix < oldLength - prefix && suffix < newLength - prefix && equal(oldLength - suffix - 1, newLength - suffix - 1)) suffix++
  append('equal', 0, 0, prefix)
  const rows = oldLength - prefix - suffix, columns = newLength - prefix - suffix
  const coarse = rows > 0 && columns > 0 && (rows + 1) * (columns + 1) > budget
  if (coarse || !rows || !columns) {
    append('delete', prefix, prefix, rows)
    append('insert', prefix + rows, prefix, columns)
  } else {
    const width = columns + 1
    const table = new Uint32Array((rows + 1) * width)
    for (let a = rows - 1; a >= 0; a--) for (let b = columns - 1; b >= 0; b--) {
      table[a * width + b] = equal(a + prefix, b + prefix)
        ? table[(a + 1) * width + b + 1]! + 1 : Math.max(table[(a + 1) * width + b]!, table[a * width + b + 1]!)
    }
    let a = 0, b = 0
    while (a < rows || b < columns) {
      if (a < rows && b < columns && equal(a + prefix, b + prefix)) { append('equal', a++ + prefix, b++ + prefix) }
      else if (a < rows && (b === columns || table[(a + 1) * width + b]! >= table[a * width + b + 1]!)) append('delete', a++ + prefix, b + prefix)
      else append('insert', a + prefix, b++ + prefix)
    }
  }
  append('equal', oldLength - suffix, newLength - suffix, suffix)
  return { oldOffsets, newOffsets, operations, coarse }
}
