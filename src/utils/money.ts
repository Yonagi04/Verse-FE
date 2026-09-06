import Decimal from 'decimal.js'

const FEN_PER_YUAN = new Decimal(100)
const YUAN_SYMBOL = '¥'

export function yuanToFenString(value: string): string {
  if (value.trim() === '') throw new Error('金额不能为空')
  const decimal = new Decimal(value)
  if (decimal.isNegative()) throw new Error('金额不能为负数')
  const fen = decimal.mul(FEN_PER_YUAN)
  if (fen.decimalPlaces() > 12) throw new Error('金额精度不能超过 14 位小数')
  return fen.toFixed(fen.decimalPlaces())
}

export function fenToYuanDecimal(value: string): Decimal {
  return new Decimal(value).div(FEN_PER_YUAN)
}

export function sumFen(values: Array<string | null | undefined>): string | null {
  const known = values.filter((value): value is string => value != null)
  if (!known.length) return null
  return known.reduce((sum, value) => sum.plus(value), new Decimal(0)).toFixed()
}

export function compareFen(left: string, right: string): number {
  return new Decimal(left).cmp(new Decimal(right))
}

export function formatYuan(value: string | null | undefined, nullText = '无法计算'): string {
  if (value == null) return nullText
  const yuan = fenToYuanDecimal(value)
  if (yuan.gt(0) && yuan.lt('0.0001')) return `< ${YUAN_SYMBOL}0.0001`
  return `${YUAN_SYMBOL}${yuan.toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toFixed(4)}`
}

export function formatPreciseYuan(value: string | null | undefined, nullText = '无法计算'): string {
  if (value == null) return nullText
  const yuan = fenToYuanDecimal(value)
  return `${YUAN_SYMBOL}${yuan.toFixed(20).replace(/(?:\.0+|(?<=(?:\.\d*?[1-9]))0+)$/, '')}`
}
