import Papa from 'papaparse'

export const fields = {
  date: ['날짜', '거래일', '매출일', '일자', '결제일', '교육일', '판매일자', '수강일', '매출일자', '거래일자', 'date', 'sale date', 'transaction date', 'paid at'],
  client: ['고객사', '고객', '회사명', '기업명', '업체명', '거래처', '수강기업', 'client', 'customer', 'company', 'account'],
  service: ['서비스', '서비스명', '교육과정', '상품', '상품명', '과정명', '품목', '교육명', 'service', 'product', 'course', 'program', 'item'],
  quantity: ['수량', '인원', '참여인원', '참가인원', '교육인원', '인원수', '구매수량', 'quantity', 'qty', 'units', 'seats'],
  price: ['단가', '판매단가', '교육단가', '1인단가', '인당요금', '단가원', 'unit price', 'price per seat', 'price', 'rate'],
  amount: ['매출액', '매출', '합계', '결제금액', '판매금액', '총금액', '총매출', '공급가액', '매출액원', 'amount', 'sales', 'revenue', 'total', 'total amount', 'sales amount'],
}
export const fieldKeys = Object.keys(fields)
const normalize = (value) => value.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')

export function decodeCsv(bytes) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return new TextDecoder('euc-kr', { fatal: true }).decode(bytes)
  }
}

export function parseCsv(text) {
  const parsed = Papa.parse(text.replace(/^\uFEFF/, ''), { skipEmptyLines: 'greedy' })
  if (parsed.errors.some((error) => error.type !== 'Delimiter')) {
    throw new Error('CSV의 따옴표 또는 구분자 형식을 확인해 주세요.')
  }
  const [headers, ...records] = parsed.data
  if (!headers || !records.length) throw new Error('헤더와 거래 데이터가 포함된 CSV 파일을 선택해 주세요.')
  const mapping = {}
  const ambiguous = []
  for (const key of fieldKeys) {
    const names = fields[key].map(normalize)
    const candidates = headers.flatMap((header, index) => names.includes(normalize(header)) ? [index] : [])
    mapping[key] = candidates.length === 1 ? candidates[0] : null
    if (candidates.length > 1) ambiguous.push(key)
  }
  return { headers, records, mapping, ambiguous }
}

export function parseDate(input) {
  const value = input.trim()
  const iso = value.match(/^(\d{4})[-/.]\s*(\d{1,2})[-/.]\s*(\d{1,2})\.?$/)
    ?? value.match(/^(\d{4})(\d{2})(\d{2})$/)
    ?? value.match(/^(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일$/)
  const local = value.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/)
  let year, month, day
  if (iso) {
    year = Number(iso[1])
    month = Number(iso[2])
    day = Number(iso[3])
  } else if (local) {
    const first = Number(local[1])
    const second = Number(local[2])
    year = Number(local[3])
    if (first > 12) { day = first; month = second }
    else if (second > 12 || first === second) { month = first; day = second }
    else return null
  } else return null

  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null
  return [year, String(month).padStart(2, '0'), String(day).padStart(2, '0')].join('-')
}

export function parseNumber(input, money = false) {
  let value = input.trim()
  if (money) {
    value = value.replace(/^([+-]?)\s*(?:KRW|₩)\s*/i, '$1').replace(/\s*(?:원|KRW)$/i, '')
    if (/^\(.+\)$/.test(value)) return parseNumber('-' + value.slice(1, -1), true)
  }
  if (!/^[+-]?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(value)) return null
  const number = Number(value.replaceAll(',', ''))
  return Number.isFinite(number) && Math.abs(number) <= Number.MAX_SAFE_INTEGER ? number : null
}

export function analyze(dataset, mapping = dataset.mapping) {
  const { headers, records } = dataset
  const missing = ['date', 'client', 'service'].filter((key) => mapping[key] == null)
  if (mapping.amount == null && (mapping.quantity == null || mapping.price == null)) {
    missing.push('amount')
  }
  const selected = fieldKeys.map((key) => mapping[key]).filter((index) => index != null)
  const duplicate = new Set(selected).size !== selected.length
  if (missing.length || duplicate) return { rows: [], issues: [], missing, duplicate }
  const rows = []
  const issues = []
  records.forEach((record, index) => {
    const raw = (key) => record[mapping[key]]?.trim() ?? ''
    const date = parseDate(raw('date'))
    const client = raw('client')
    const service = raw('service')
    const quantity = parseNumber(raw('quantity'))
    const price = parseNumber(raw('price'), true)
    const computed = quantity != null && price != null
    const amount = raw('amount') ? parseNumber(raw('amount'), true)
      : computed ? parseNumber(String(quantity * price), true) : null
    const problems = []
    if (record.length !== headers.length) problems.push('컬럼 개수')
    if (!date) problems.push('날짜')
    if (!client) problems.push('고객사')
    if (!service) problems.push('서비스')
    if (raw('quantity') && quantity == null) problems.push('수량')
    if (raw('price') && price == null) problems.push('단가')
    if (amount == null) problems.push('매출액 또는 수량·단가')
    if (problems.length) issues.push({ row: index + 1, problems, record })
    else rows.push({ id: index + 1, date, client, service, quantity, price, amount })
  })
  return { rows, issues, missing, duplicate }
}

export function summarize(rows) {
  const months = new Map()
  const services = new Map()
  let total = 0
  for (const row of rows) {
    total += row.amount
    const month = row.date.slice(0, 7)
    months.set(month, (months.get(month) ?? 0) + row.amount)
    services.set(row.service, (services.get(row.service) ?? 0) + row.amount)
  }
  return {
    total,
    count: rows.length,
    average: rows.length ? total / rows.length : 0,
    months: [...months].sort(([a], [b]) => a.localeCompare(b)).map(([name, value]) => ({ name, value })),
    services: [...services].sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value })),
  }
}

export function serialize(rows) {
  const labels = fieldKeys.map((key) => fields[key][0])
  const data = rows.map((row) => fieldKeys.map((key) => {
    const value = row[key] ?? ''
    return typeof value === 'string' && /^[=+\-@\t\r]/.test(value) ? "'" + value : value
  }))
  return '\uFEFF' + Papa.unparse({ fields: labels, data })
}
