import {
  Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { Card } from './ui/card'
import { formatNumber, won } from '../format'

const colors = ['#2563eb', '#5a91f4', '#8b5eed', '#86aefa', '#4f46e5', '#0f766e']

export default function Charts({ stats }) {
  return <div className="charts">
    <Card className="chart-card"><h2>월별 매출 추이</h2><p>거래일 기준 월별 매출 합계</p><MonthlyChart data={stats.months} /></Card>
    <Card className="chart-card"><h2>서비스별 매출 비중</h2><p>서비스별 매출 구성</p><ServiceChart data={stats.services} total={stats.total} /></Card>
  </div>
}

function MonthlyChart({ data }) {
  return <div className="monthly-chart" role="img" aria-label={`월별 매출: ${data.map(({ name, value }) => `${name} ${won(value)}`).join(', ')}`}>
    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
      <AreaChart data={data} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
        <defs><linearGradient id="sales-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3b82f6" stopOpacity={0.24} /><stop offset="100%" stopColor="#3b82f6" stopOpacity={0.025} /></linearGradient></defs>
        <CartesianGrid vertical={false} stroke="#e9eef6" strokeDasharray="4 4" />
        <XAxis dataKey="name" tickFormatter={(value) => `${value.slice(2, 4)}.${value.slice(5)}`} stroke="#e5ebf3" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} tickMargin={10} minTickGap={16} />
        <YAxis width={56} tickFormatter={(value) => value ? `${formatNumber(value / 10000)}만` : '0'} tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
        <Tooltip formatter={(value) => [won(value), '매출']} labelFormatter={(name) => `${name.slice(0, 4)}년 ${Number(name.slice(5))}월`} contentStyle={{ borderRadius: 10, borderColor: '#e4eaf3', fontSize: 12 }} />
        <Area isAnimationActive={false} type="linear" dataKey="value" stroke="#2563eb" strokeWidth={2.5} fill="url(#sales-fill)" dot={{ r: 3.5, strokeWidth: 2, fill: 'white' }} activeDot={{ r: 5 }} />
      </AreaChart>
    </ResponsiveContainer>
  </div>
}

function ServiceChart({ data, total }) {
  const canShowShare = total > 0 && data.every(({ value }) => value >= 0)
  const slices = data.map((entry, index) => ({ ...entry, color: colors[index % colors.length] })).filter(({ value }) => value > 0)
  return <div className="service-chart">
    {canShowShare && <div className="donut">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart><Pie isAnimationActive={false} data={slices} dataKey="value" nameKey="name" innerRadius="70%" outerRadius="94%" paddingAngle={slices.length > 1 ? 3 : 0} stroke="none" startAngle={90} endAngle={-270}>
          {slices.map(({ name, color }) => <Cell key={name} fill={color} />)}
        </Pie><Tooltip formatter={(value) => won(value)} contentStyle={{ borderRadius: 10, fontSize: 12 }} /></PieChart>
      </ResponsiveContainer>
      <div className="donut-center"><span>총 서비스</span><strong>{formatNumber(data.length)}개</strong></div>
    </div>}
    <div className="legend-wrap">{!canShowShare && <p>음수 매출이 있거나 총매출이 0원 이하이면 서비스별 금액을 표시합니다.</p>}
      <ul className="legend">{data.map(({ name, value }, index) => <li key={name}><i style={{ backgroundColor: colors[index % colors.length] }} /><span title={name}>{name}</span><strong title={won(value)}>{canShowShare ? `${(value * 100 / total).toFixed(1)}%` : won(value)}</strong></li>)}</ul>
    </div>
  </div>
}
