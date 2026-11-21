import { expect, it } from 'vitest'
import { lineDisplay, lineOffsets, lineToken, skillDiff } from '../src/utils/skillDiff'

function reconstruct(oldText: string, newText: string, budget?: number) {
  const diff = skillDiff(oldText, newText, budget)
  let old = '', next = ''
  for (const operation of diff.operations) for (let index = 0; index < operation.count; index++) {
    if (operation.kind !== 'insert') old += lineToken(oldText, diff.oldOffsets, operation.oldStart + index)
    if (operation.kind !== 'delete') next += lineToken(newText, diff.newOffsets, operation.newStart + index)
    if (operation.kind === 'equal') expect(lineToken(oldText, diff.oldOffsets, operation.oldStart + index))
      .toBe(lineToken(newText, diff.newOffsets, operation.newStart + index))
  }
  expect(old).toBe(oldText); expect(next).toBe(newText)
  return diff
}

it.each([
  ['', ''], ['', '中文'], ['a\n', ''], ['中文\r\n空行\r结尾', '中文\n空行\n结尾\n'],
  ['\n\n\n', '\r\r'], ['prefix\nold\nsuffix\n', 'prefix\nnew\nsuffix\n'], ['no-newline', 'no-newline\n'],
  ['a\nb\nc\n', 'c\nb\na\n'], ['a\n', 'a\n'], ['same\nold\nsame\n', 'same\nnew\nsame\n'],
])('diff精确模式可重建两侧原文：%j → %j', (oldText, newText) => { reconstruct(oldText, newText) })

it('只改换行符或末尾换行也必须显示真实删除与新增', () => {
  const diff = reconstruct('中文\r\n', '中文\n')
  expect(diff.operations.map(operation => operation.kind)).toEqual(['delete', 'insert'])
  expect(lineDisplay('中文\r\n')).toEqual({ text: '中文', ending: 'CRLF' })
  expect(lineDisplay('中文')).toEqual({ text: '中文', ending: 'NONE' })
  expect(lineOffsets('')).toEqual(new Int32Array([0]))
})
it('大段替换超过LCS预算时保留公共前后缀和真实替换内容', () => {
  const oldText = `start\n${'old\n'.repeat(2000)}end\r\n`
  const newText = `start\n${'new\n'.repeat(2000)}end\r\n`
  const diff = reconstruct(oldText, newText)
  expect(diff.coarse).toBe(true)
  expect(diff.operations.map(value => value.kind)).toEqual(['equal', 'delete', 'insert', 'equal'])
})
it('重复行和混合行尾的组合在精确和预算退化模式都可还原', () => {
  const tokens = ['', '中文', 'a\n', '\r', '\r\n', 'tail']
  for (let a = 0; a < tokens.length; a++) for (let b = 0; b < tokens.length; b++) {
    const oldText = tokens[a]! + tokens[b]!, newText = tokens[b]! + tokens[a]!
    reconstruct(oldText, newText); reconstruct(oldText, newText, 1)
  }
})
