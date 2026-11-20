import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle, ArrowDown, ArrowDownToLine, ArrowDownUp, ArrowUp, ChartNoAxesCombined,
  ChevronLeft, ChevronRight, CloudUpload, Database, FileSpreadsheet, FolderOpen, LayoutDashboard,
  List, Menu, Search, ShieldCheck, Table2, TrendingUp, Wallet, X,
} from 'lucide-react'
import { Button } from './components/ui/button'
import { Card } from './components/ui/card'
import { formatNumber, won } from './format'
import { analyze, decodeCsv, fields, fieldKeys, parseCsv, serialize, summarize } from './sales'

const Charts = lazy(() => import('./components/charts'))

const samples = [
  { name: '기본 매출 데이터', detail: '50건 · 표준 양식', file: 'ax-sales-50.csv' },
  { name: '실습 1 · 수량 × 단가', detail: '3건 · 한글 CSV (CP949)', file: 'ax-practice-quantity.csv' },
  { name: '실습 2 · 영문 컬럼', detail: '3건 · 날짜 및 금액 혼합', file: 'ax-practice-english.csv' },
]
const columns = [
  ['date', '거래일'], ['client', '고객사'], ['service', '서비스'],
  ['quantity', '수량'], ['price', '단가'], ['amount', '매출액'],
]
const pageSize = 7

function App() {
  const [dataset, setDataset] = useState(null)
  const [mapping, setMapping] = useState({})
  const [showMapping, setShowMapping] = useState(false)
  const [filename, setFilename] = useState('')
  const [isSample, setIsSample] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)
  const [section, setSection] = useState('overview')
  const [mobileNav, setMobileNav] = useState(false)
  const input = useRef(null)
  const latestLoad = useRef(0)

  async function loadFile(getBytes, name, sample = false) {
    const request = ++latestLoad.current
    setLoading(true)
    setError('')
    try {
      const data = parseCsv(decodeCsv(await getBytes()))
      if (request !== latestLoad.current) return
      setDataset(data)
      setMapping(data.mapping)
      setShowMapping(data.ambiguous.length > 0)
      setFilename(name)
      setIsSample(sample)
    } catch (reason) {
      if (request !== latestLoad.current) return
      setDataset(null)
      setMapping({})
      setFilename('')
      setIsSample(false)
      setError(reason.message || '파일을 읽을 수 없습니다.')
    } finally {
      if (request === latestLoad.current) setLoading(false)
    }
  }

  useEffect(() => {
    const sample = samples[0]
    loadFile(async () => {
      const response = await fetch(`${import.meta.env.BASE_URL}samples/${sample.file}`)
      if (!response.ok) throw new Error('기본 샘플을 불러오지 못했습니다.')
      return response.arrayBuffer()
    }, sample.file, true)
  }, [])

  function upload(files) {
    if (!files?.length) return
    const file = files[0]
    loadFile(() => {
      if (files.length > 1) throw new Error('CSV 파일을 한 번에 하나씩 선택해 주세요.')
      if (!/\.csv$/i.test(file.name)) throw new Error('.csv 형식의 파일을 선택해 주세요.')
      return file.arrayBuffer()
    }, file.name)
    if (input.current) input.current.value = ''
  }

  function reset() {
    latestLoad.current++
    setDataset(null)
    setMapping({})
    setFilename('')
    setIsSample(false)
    setError('')
    setLoading(false)
  }

  function goTo(id) {
    setSection(id)
    setMobileNav(false)
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const result = useMemo(() => dataset ? analyze(dataset, mapping) : { rows: [], issues: [], missing: [] }, [dataset, mapping])
  const stats = useMemo(() => summarize(result.rows), [result.rows])
  const needsMapping = Boolean(result.missing.length || result.duplicate)
  const canShowData = stats.count > 0 && !loading

  function download() {
    const url = URL.createObjectURL(new Blob([serialize(result.rows)], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'AX러닝랩-정리된-매출.csv'
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <div className="shell">
      {mobileNav && <button className="nav-overlay" aria-label="메뉴 닫기" onClick={() => setMobileNav(false)} />}
      <aside className={`sidebar ${mobileNav ? 'open' : ''}`}>
        <div className="brand">
          <div className="brand-icon"><ChartNoAxesCombined size={23} strokeWidth={2.5} /></div>
          <div><strong>AX러닝랩</strong><span>SALES ANALYTICS</span></div>
        </div>
        <nav aria-label="대시보드 메뉴">
          <p className="nav-label">워크스페이스</p>
          {[
            ['overview', '매출 대시보드', LayoutDashboard],
            ['transactions', '거래 내역', Table2],
            ['upload', '데이터 관리', FolderOpen],
          ].map(([id, label, Icon]) => (
            <button key={id} className={section === id ? 'nav-link active' : 'nav-link'} onClick={() => goTo(id)} aria-current={section === id ? 'location' : undefined}>
              <Icon size={18} />{label}
            </button>
          ))}
          <p className="nav-label resources-label">리소스</p>
          <button className={section === 'samples' ? 'nav-link active' : 'nav-link'} aria-current={section === 'samples' ? 'location' : undefined} onClick={() => goTo('samples')}><FileSpreadsheet size={18} />샘플 CSV</button>
        </nav>
        <div className="sidebar-footer"><div className="privacy-icon"><ShieldCheck size={18} /></div><div><strong>브라우저 내 처리</strong><span>CSV를 이 기기에서만 분석</span></div></div>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            <Button className="mobile-menu" variant="ghost" size="icon" aria-label="메뉴 열기" aria-expanded={mobileNav} onClick={() => setMobileNav(true)}><Menu /></Button>
            <span>워크스페이스</span><ChevronRight size={14} /><strong>매출 대시보드</strong>
          </div>
          <div className="local-status"><span />로컬 분석 모드</div>
        </header>
        <main className="content" id="overview">
          <div className="page-heading">
            <div><h1>매출 대시보드</h1><p>교육 서비스 매출과 거래 현황을 한눈에 확인하세요.</p></div>
            <Button variant="outline" disabled={!canShowData} onClick={download}><ArrowDownToLine />정리된 CSV 다운로드</Button>
          </div>

          <section id="upload" className={`upload-zone ${dragging ? 'dragging' : ''}`} aria-label="CSV 업로드"
            onDragOver={(event) => { event.preventDefault(); setDragging(true) }}
            onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false) }}
            onDrop={(event) => { event.preventDefault(); setDragging(false); upload(event.dataTransfer.files) }}>
            <div className="upload-copy"><div className="upload-icon"><CloudUpload size={24} /></div><div>
              <h2>CSV 파일 업로드</h2><p>파일을 끌어다 놓거나 선택하여 매출 데이터를 분석하세요.</p>
            </div></div>
            <input ref={input} type="file" accept=".csv,text/csv" hidden onChange={(event) => upload(event.target.files)} />
            <Button onClick={() => input.current.click()}><CloudUpload />파일 선택</Button>
          </section>

          <div className="file-status" aria-live="polite">
            {loading ? <span>CSV를 분석하는 중입니다…</span> : filename && <>
              <FileSpreadsheet size={15} /><strong>{filename}</strong>{isSample && <span className="sample-tag">샘플 데이터</span>}
              <span>{formatNumber(stats.count)}건 분석</span>
              <Button variant="ghost" size="icon" aria-label="현재 데이터 지우기" onClick={reset}><X /></Button>
            </>}
            {dataset && !loading && !needsMapping && <button className="text-action" onClick={() => setShowMapping(!showMapping)} aria-expanded={showMapping} aria-controls="column-mapping">컬럼 설정</button>}
          </div>

          {error && <div className="notice error" role="alert"><AlertCircle size={21} /><div><strong>파일을 분석할 수 없습니다</strong><p>{error}</p></div><Button variant="outline" size="sm" onClick={() => input.current.click()}>다시 선택</Button></div>}
          {dataset && (showMapping || needsMapping) && (
            <Card className="mapping-panel" id="column-mapping">
              <h2>CSV 컬럼 확인</h2>
              <p>원본의 각 컬럼을 아래 항목에 연결해 주세요. 매출액 컬럼을 생략하면 수량과 단가로 계산합니다.</p>
              {needsMapping && <p className="warning" role="alert">{result.duplicate ? '같은 원본 컬럼이 여러 항목에 연결되어 있습니다.' : '날짜, 고객사, 서비스와 매출액 또는 수량·단가를 연결해 주세요.'}</p>}
              {dataset.ambiguous.some((key) => mapping[key] == null) && <p className="warning">후보가 여러 개인 항목이 있습니다. 사용할 컬럼을 선택해 주세요.</p>}
              <div className="mapping-grid">
                {fieldKeys.map((key) => <div className="mapping-field" key={key}><label htmlFor={`map-${key}`}>{fields[key][0]}</label><select id={`map-${key}`} value={mapping[key] ?? ''} onChange={(event) => setMapping({ ...mapping, [key]: event.target.value === '' ? null : Number(event.target.value) })}>
                  <option value="">선택 안 함</option>
                  {dataset.headers.map((header, index) => <option key={index} value={index}>{index + 1}. {header || '(이름 없음)'}</option>)}
                </select></div>)}
              </div>
            </Card>
          )}

          {result.issues.length > 0 && <Card className="issue-panel">
            <div className="notice"><AlertCircle size={21} /><div><strong>확인이 필요한 거래 {formatNumber(result.issues.length)}건</strong><p>아래 거래는 집계와 다운로드에서 제외됩니다. 값을 수정하면 다시 분석합니다.</p></div></div>
            <details><summary>확인 항목 보기 및 수정</summary>
              <div className="issue-list">{result.issues.map((issue) => <Correction key={`${latestLoad.current}-${issue.row}`} issue={issue} headers={dataset.headers} save={(record) => setDataset((source) => ({ ...source, records: source.records.map((row, i) => i === issue.row - 1 ? record : row) }))} />)}</div>
            </details>
          </Card>}

          <div className="section-title"><h2>매출 요약</h2><span>{canShowData ? `${stats.months[0].name.replace('-', '.')} – ${stats.months.at(-1).name.replace('-', '.')}` : ''}</span></div>
          <div className="metrics">
            <Metric title="총매출" value={canShowData ? won(stats.total) : '—'} icon={Wallet} tone="blue" caption="분석 기간 누적 매출" />
            <Metric title="거래 건수" value={canShowData ? `${formatNumber(stats.count)}건` : '—'} icon={List} tone="indigo" caption="정상 분석된 거래" />
            <Metric title="평균 거래액" value={canShowData ? won(stats.average) : '—'} icon={TrendingUp} tone="violet" caption="거래 1건당 평균 매출" />
          </div>

          {canShowData ? <Suspense fallback={<Card className="empty-state" aria-busy="true">차트를 불러오는 중…</Card>}><Charts stats={stats} /></Suspense> : <Card className="empty-state"><Database size={28} /><h2>{loading ? '데이터를 불러오는 중' : '표시할 매출 데이터가 없습니다'}</h2><p>{needsMapping || result.issues.length ? '확인 항목을 해결하면 매출 차트와 거래 내역이 표시됩니다.' : 'CSV를 업로드하면 매출 차트와 거래 내역이 표시됩니다.'}</p></Card>}

          <Transactions rows={canShowData ? result.rows : []} key={`${filename}-${latestLoad.current}`} />
          <Card className="samples" id="samples">
            <h2>샘플 CSV 다운로드</h2><p>가상 고객사 데이터로 다양한 CSV 양식을 실습하세요.</p>
            <div className="sample-grid">{samples.map((sample) => <a key={sample.file} href={`${import.meta.env.BASE_URL}samples/${sample.file}`} download={sample.file}>
              <span className="sample-icon"><FileSpreadsheet size={19} /></span><span><strong>{sample.name}</strong><small>{sample.detail}</small></span><ArrowDownToLine size={17} className="sample-download" />
            </a>)}</div>
          </Card>
          <footer className="main-footer"><ShieldCheck size={15} />업로드한 CSV는 브라우저에서만 처리됩니다.</footer>
        </main>
      </div>
    </div>
  )
}

function Metric({ title, value, icon: Icon, tone, caption }) {
  return <Card className="metric"><div><h3>{title}</h3><strong>{value}</strong><p>{caption}</p></div><span className={`metric-icon ${tone}`}><Icon size={21} /></span></Card>
}

function Correction({ issue, headers, save }) {
  const [values, setValues] = useState(() => headers.map((_, index) => issue.record[index] ?? ''))
  return <form onSubmit={(event) => { event.preventDefault(); save(values) }}>
    <strong>거래 {issue.row} · {issue.problems.join(', ')}</strong>
    {issue.record.length > headers.length && <p>헤더에 없는 값: {issue.record.slice(headers.length).join(' | ')}. 저장하면 아래 컬럼 값만 반영합니다.</p>}
    <div className="mapping-grid">{headers.map((label, index) => <label key={index}>{label || `컬럼 ${index + 1}`}<input value={values[index]} onChange={(event) => setValues(values.map((value, i) => i === index ? event.target.value : value))} /></label>)}</div>
    <Button size="sm" type="submit">수정 적용</Button>
  </form>
}

function Transactions({ rows }) {
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState({ key: 'date', ascending: false })
  const [page, setPage] = useState(0)
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return rows.filter((row) => columns.some(([key]) => String(row[key] ?? '').toLowerCase().includes(needle)
      || (typeof row[key] === 'number' && formatNumber(row[key]).includes(needle))))
      .sort((a, b) => {
        const left = a[sort.key]
        const right = b[sort.key]
        if (left == null || right == null) return Number(left == null) - Number(right == null)
        const compare = typeof left === 'number' ? left - right : left.localeCompare(right, 'ko')
        return sort.ascending ? compare : -compare
      })
  }, [rows, query, sort])
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, pages - 1)

  return <Card id="transactions" className="transactions">
    <div className="table-heading"><div><h2>상세 매출 내역</h2><p>고객사, 서비스 또는 거래 정보로 검색하세요.</p></div><label className="search"><Search size={16} /><input type="search" aria-label="거래 검색" placeholder="거래 검색…" value={query} onChange={(event) => { setQuery(event.target.value); setPage(0) }} /></label></div>
    <div className="table-scroll"><table>
      <thead><tr>{columns.map(([key, label]) => {
        const selected = sort.key === key
        const Icon = selected ? (sort.ascending ? ArrowUp : ArrowDown) : ArrowDownUp
        return <th key={key} scope="col" aria-sort={selected ? (sort.ascending ? 'ascending' : 'descending') : 'none'}><button onClick={() => { setSort({ key, ascending: selected ? !sort.ascending : true }); setPage(0) }}>{label}<Icon size={12} /></button></th>
      })}</tr></thead>
      <tbody>{filtered.length ? filtered.slice(currentPage * pageSize, (currentPage + 1) * pageSize).map((row) => <tr key={row.id}>
        <td>{row.date}</td><td>{row.client}</td><td><span className="service-tag">{row.service}</span></td><td>{formatNumber(row.quantity)}</td><td>{won(row.price)}</td><td><strong>{won(row.amount)}</strong></td>
      </tr>) : <tr><td colSpan={6} className="table-empty">{rows.length ? '검색 결과가 없습니다.' : '분석된 거래가 없습니다.'}</td></tr>}</tbody>
    </table></div>
    <div className="pagination"><span>총 {formatNumber(filtered.length)}건</span><div>
      <Button variant="outline" size="icon" aria-label="이전 페이지" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}><ChevronLeft /></Button>
      <span>{currentPage + 1} / {pages}</span>
      <Button variant="outline" size="icon" aria-label="다음 페이지" disabled={currentPage + 1 >= pages} onClick={() => setPage(currentPage + 1)}><ChevronRight /></Button>
    </div></div>
  </Card>
}

export default App
