import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { analyze, decodeCsv, parseCsv, parseDate, parseNumber, serialize, summarize } from '../src/sales.js'

async function sample(name) {
  const bytes = await readFile(new URL(`../public/samples/${name}`, import.meta.url))
  return analyze(parseCsv(decodeCsv(bytes)))
}

test('standard UTF-8 sample has 50 valid transactions and matching chart totals', async () => {
  const { rows, issues } = await sample('ax-sales-50.csv')
  const stats = summarize(rows)
  assert.equal(issues.length, 0)
  assert.equal(stats.count, 50)
  assert.equal(stats.total, 186190000)
  assert.equal(stats.average, stats.total / 50)
  assert.equal(stats.months.length, 6)
  assert.equal(stats.services.length, 4)
  assert.equal(stats.months.reduce((sum, { value }) => sum + value, 0), stats.total)
  assert.equal(stats.services.reduce((sum, { value }) => sum + value, 0), stats.total)
})

test('CP949 reordered semicolon sample calculates revenue from quantity and unit price', async () => {
  const { rows, issues } = await sample('ax-practice-quantity.csv')
  assert.equal(issues.length, 0)
  assert.equal(rows[0].client, '가상기업 온빛')
  assert.deepEqual(rows.map((row) => row.amount), [2240000, 2400000, 1560000])
  assert.deepEqual(summarize(rows).months, [{ name: '2026-07', value: 4640000 }, { name: '2026-08', value: 1560000 }])
})

test('English headers and mixed date and amount formats are recognized', async () => {
  const { rows, issues } = await sample('ax-practice-english.csv')
  assert.equal(issues.length, 0)
  assert.deepEqual(rows.map((row) => row.date), ['2026-07-18', '2026-08-21', '2026-09-04'])
  assert.deepEqual(rows.map((row) => row.amount), [1560000, 2240000, 960000])
  assert.ok(rows.every((row) => row.quantity == null && row.price == null))
})

test('ambiguity and missing columns require a mapping decision', () => {
  const source = parseCsv('date,거래일,name,service,amount\n2026-01-18,2026-01-19,가상회사,수업,2000')
  assert.deepEqual(source.ambiguous, ['date'])
  assert.deepEqual(analyze(source).missing, ['date', 'client'])
  assert.equal(analyze(source, { ...source.mapping, date: 1, client: 1 }).duplicate, true)
  assert.equal(analyze(source, { ...source.mapping, date: 1, client: 2 }).rows[0].date, '2026-01-19')
})

test('invalid fields are surfaced, and blank revenue uses quantity and price when available', () => {
  const source = parseCsv('날짜,고객사,서비스,수량,단가,매출액\n01/02/2026,가상회사,수업,2,1000,\n2026-01-02,가상회사,수업,2,1000,오류\n2026-01-02,,수업,2,1000,\n2026-01-02,가상회사,수업,2,1000,')
  const { rows, issues } = analyze(source)
  assert.deepEqual(issues.map(({ problems }) => problems), [['날짜'], ['매출액 또는 수량·단가'], ['고객사']])
  assert.deepEqual(rows.map(({ amount }) => amount), [2000])
  assert.throws(() => parseCsv(''), /헤더와 거래 데이터/)
  assert.throws(() => parseCsv('날짜,회사명\n"2026-01-01,회사'), /따옴표/)
})

test('dates and numbers preserve valid values and reject malformed or ambiguous ones', () => {
  assert.equal(parseDate('2024. 2. 29.'), '2024-02-29')
  assert.equal(parseDate('2026-02-29'), null)
  assert.equal(parseDate('02/03/2026'), null)
  assert.equal(parseNumber('₩12,345.50', true), 12345.5)
  assert.equal(parseNumber('(1,200원)', true), -1200)
  assert.equal(parseNumber('1,23', true), null)
  assert.equal(parseNumber('0'), 0)
  assert.equal(parseNumber(''), null)
})

test('export has standard headers and preserves valid normalized rows', async () => {
  const { rows } = await sample('ax-practice-quantity.csv')
  const csv = serialize(rows)
  assert.ok(csv.startsWith('\uFEFF날짜,고객사,서비스,수량,단가,매출액'))
  assert.deepEqual(analyze(parseCsv(csv)).rows, rows)
  assert.match(serialize([{ ...rows[0], client: '=1+1' }]), /'=1\+1/)
})
