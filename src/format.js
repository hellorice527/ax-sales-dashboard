const number = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 2 })
export const won = (value) => value == null ? '—' : `₩${number.format(value)}`
export const formatNumber = (value) => value == null ? '—' : number.format(value)
