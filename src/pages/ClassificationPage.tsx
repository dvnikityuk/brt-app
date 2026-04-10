import { memo, useMemo } from 'react'
import { useAppStore, useFiltered } from '../store/useAppStore'
import { FilterBar } from '../components/FilterBar'
import { SummaryTable, type SColumn } from '../components/SummaryTable'
import { getRec } from '../engine'
import type { AnalysisResult } from '../types'

const S = {
  card: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 14 } as React.CSSProperties,
  warn: { background: '#fefce8', border: '1px solid #fcd34d', borderRadius: 8, padding: 14, fontSize: 13, color: '#854d0e' } as React.CSSProperties,
  th: { padding: '5px 8px', textAlign: 'left' as const, borderBottom: '1px solid #e2e8f0', color: '#64748b', fontWeight: 500, fontSize: 11 },
}

function abcColor(cls: string) {
  return cls === 'A' ? '#16a34a' : cls === 'B' ? '#d97706' : '#dc2626'
}
function abcBg(cls: string) {
  return cls === 'A' ? '#f0fdf4' : cls === 'B' ? '#fffbeb' : '#fff5f5'
}

export const ClassificationPage = memo(function ClassificationPage() {
  const results    = useAppStore(s => s.results)
  const filters    = useAppStore(s => s.filters)
  const setFilters = useAppStore(s => s.setFilters)
  const filtered   = useFiltered()

  const columns = useMemo((): SColumn<AnalysisResult>[] => [
    { key: 'code', header: 'Код', sortValue: r => r.code, minWidth: 70,
      render: r => <span style={{ fontWeight: 600, color: '#1e40af', fontSize: 11 }}>{r.code}</span> },
    { key: 'name', header: 'Наименование', sortValue: r => r.name, minWidth: 160,
      render: r => <span style={{ fontSize: 11, lineHeight: 1.3 }}>{r.name}</span> },
    { key: 'abcxyz', header: 'Класс', sortValue: r => r.abcxyz,
      render: r => <span style={{ background: abcBg(r.abcClass), color: abcColor(r.abcClass), padding: '1px 6px', borderRadius: 4, fontWeight: 600, fontSize: 10 }}>{r.abcxyz}</span>,
      aggregate: items => {
        const a = items.filter(r => r.abcClass === 'A').length
        const b = items.filter(r => r.abcClass === 'B').length
        const c = items.filter(r => r.abcClass === 'C').length
        return <span style={{ fontSize: 10 }}>
          {a > 0 && <span style={{ color: '#16a34a', fontWeight: 600 }}>A:{a} </span>}
          {b > 0 && <span style={{ color: '#d97706', fontWeight: 600 }}>B:{b} </span>}
          {c > 0 && <span style={{ color: '#dc2626', fontWeight: 600 }}>C:{c}</span>}
        </span>
      } },
    { key: 'avgDemand', header: 'Ср. спрос', sortValue: r => r.avgDemand, align: 'right',
      render: r => <span style={{ fontSize: 11 }}>{Math.round(r.avgDemand).toLocaleString('ru')}</span>,
      total: items => <>{Math.round(items.reduce((s, r) => s + r.avgDemand, 0)).toLocaleString('ru')}</>,
      aggregate: items => <>{Math.round(items.reduce((s, r) => s + r.avgDemand, 0)).toLocaleString('ru')}</>,
      aggregateSortValue: items => items.reduce((s, r) => s + r.avgDemand, 0) },
    { key: 'cv', header: 'CV', sortValue: r => r.cv, align: 'right',
      render: r => <span style={{ fontSize: 11, color: r.cv > 0.25 ? '#dc2626' : r.cv > 0.1 ? '#d97706' : '#16a34a' }}>{(r.cv * 100).toFixed(0)}%</span>,
      aggregate: items => {
        const td = items.reduce((s, r) => s + r.avgDemand, 0)
        const w = td > 0 ? items.reduce((s, r) => s + r.cv * r.avgDemand, 0) / td : 0
        return <span style={{ fontSize: 10, color: '#64748b' }}>{(w * 100).toFixed(0)}%</span>
      },
      aggregateSortValue: items => { const td = items.reduce((s, r) => s + r.avgDemand, 0); return td > 0 ? items.reduce((s, r) => s + r.cv * r.avgDemand, 0) / td : 0 } },
    { key: 'trend', header: 'Тренд', sortValue: r => r.trend, align: 'right',
      render: r => <span style={{ fontSize: 11, color: r.trend > 2 ? '#16a34a' : r.trend < -2 ? '#dc2626' : '#94a3b8' }}>{r.trend > 0 ? '+' : ''}{r.trend.toFixed(1)}%</span> },
    { key: 'annualDemand', header: 'Год. спрос', sortValue: r => r.annualDemand, align: 'right',
      render: r => <span style={{ fontSize: 11 }}>{r.annualDemand.toLocaleString('ru')}</span>,
      total: items => <>{items.reduce((s, r) => s + r.annualDemand, 0).toLocaleString('ru')}</>,
      aggregate: items => <>{items.reduce((s, r) => s + r.annualDemand, 0).toLocaleString('ru')}</>,
      aggregateSortValue: items => items.reduce((s, r) => s + r.annualDemand, 0) },
    { key: 'rec', header: 'Рекомендация',
      render: r => <span style={{ fontSize: 10, color: '#64748b' }}>{getRec(r.abcxyz)}</span> },
  ], [])

  if (!results.length) return <div style={S.warn}>Загрузите данные и запустите анализ</div>

  const totalDemand = filtered.reduce((s, r) => s + r.annualDemand, 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <FilterBar filters={filters} onFilters={setFilters} results={results} filtered={filtered} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {/* ABC-XYZ matrix */}
        <div style={S.card}>
          <div style={{ fontWeight: 600, fontSize: 12, color: '#374151', marginBottom: 8 }}>Матрица ABC-XYZ</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                {['Класс', 'SKU', '% шт', 'Спрос', '% об', 'Рекомендация'].map(h => (
                  <th key={h} style={S.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {['A', 'B', 'C'].flatMap(a => ['X', 'Y', 'Z'].map(x => {
                const cls = a + x
                const items = filtered.filter(r => r.abcxyz === cls)
                if (!items.length) return null
                const demand = items.reduce((s, r) => s + r.annualDemand, 0)
                return (
                  <tr key={cls} style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }}
                    onClick={() => setFilters({ ...filters, abc: a, xyz: x })}>
                    <td style={{ padding: '5px 8px' }}>
                      <span style={{ background: abcBg(a), color: abcColor(a), padding: '1px 6px', borderRadius: 4, fontWeight: 600, fontSize: 11 }}>{cls}</span>
                    </td>
                    <td style={{ padding: '5px 8px', fontWeight: 500 }}>{items.length}</td>
                    <td style={{ padding: '5px 8px', color: '#64748b' }}>{((items.length / Math.max(1, filtered.length)) * 100).toFixed(0)}%</td>
                    <td style={{ padding: '5px 8px', fontWeight: 500 }}>{demand.toLocaleString('ru')}</td>
                    <td style={{ padding: '5px 8px', color: '#64748b' }}>{((demand / Math.max(1, totalDemand)) * 100).toFixed(0)}%</td>
                    <td style={{ padding: '5px 8px', color: '#94a3b8', fontSize: 10 }}>{getRec(cls)}</td>
                  </tr>
                )
              })).filter(Boolean)}
              <tr style={{ background: '#f8fafc', fontWeight: 600 }}>
                <td style={{ padding: '5px 8px', fontSize: 11 }}>Итого</td>
                <td style={{ padding: '5px 8px', fontSize: 11 }}>{filtered.length}</td>
                <td style={{ padding: '5px 8px', fontSize: 11 }}>100%</td>
                <td style={{ padding: '5px 8px', fontSize: 11 }}>{totalDemand.toLocaleString('ru')}</td>
                <td style={{ padding: '5px 8px', fontSize: 11 }}>100%</td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>

        {/* Distribution bars */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* ABC */}
          <div style={S.card}>
            <div style={{ fontWeight: 600, fontSize: 11, color: '#374151', marginBottom: 8 }}>ABC по объёму</div>
            {['A', 'B', 'C'].map(a => {
              const demand = filtered.filter(r => r.abcClass === a).reduce((s, r) => s + r.annualDemand, 0)
              const pct = totalDemand > 0 ? Math.round(demand / totalDemand * 100) : 0
              const cnt = filtered.filter(r => r.abcClass === a).length
              return (
                <div key={a} style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3, fontSize: 11 }}>
                    <span style={{ fontWeight: 600, color: abcColor(a) }}>{a} · {cnt} SKU</span>
                    <span style={{ color: '#94a3b8' }}>{pct}%</span>
                  </div>
                  <div style={{ height: 6, background: '#f1f5f9', borderRadius: 3 }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: abcColor(a), borderRadius: 3 }} />
                  </div>
                </div>
              )
            })}
          </div>
          {/* XYZ */}
          <div style={S.card}>
            <div style={{ fontWeight: 600, fontSize: 11, color: '#374151', marginBottom: 8 }}>XYZ по вариации</div>
            {['X', 'Y', 'Z'].map(x => {
              const cnt = filtered.filter(r => r.xyzClass === x).length
              const pct = filtered.length > 0 ? Math.round(cnt / filtered.length * 100) : 0
              const avgCV = filtered.filter(r => r.xyzClass === x).reduce((s, r) => s + r.cv, 0) / Math.max(1, cnt)
              const color = x === 'X' ? '#1e40af' : x === 'Y' ? '#7c3aed' : '#64748b'
              const label = x === 'X' ? 'Стабильный' : x === 'Y' ? 'Умеренный' : 'Нестабильный'
              return (
                <div key={x} style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3, fontSize: 11 }}>
                    <span style={{ fontWeight: 600, color }}>{x} {label} · {cnt}</span>
                    <span style={{ color: '#94a3b8' }}>{pct}% · CV {(avgCV * 100).toFixed(0)}%</span>
                  </div>
                  <div style={{ height: 6, background: '#f1f5f9', borderRadius: 3 }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3 }} />
                  </div>
                </div>
              )
            })}
          </div>
          {/* Quick stats */}
          <div style={{ display: 'flex', gap: 6 }}>
            {[
              { label: 'Ср. CV', value: (filtered.reduce((s, r) => s + r.cv, 0) / Math.max(1, filtered.length) * 100).toFixed(0) + '%', color: '#64748b' },
              { label: 'Выбросы', value: filtered.filter(r => r.outlierCount > 0).length, color: '#d97706' },
              { label: 'Тренд+', value: filtered.filter(r => r.trend > 2).length, color: '#16a34a' },
              { label: 'Тренд−', value: filtered.filter(r => r.trend < -2).length, color: '#dc2626' },
            ].map(s => (
              <div key={s.label} style={{ flex: 1, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: '6px 8px', textAlign: 'center' }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 9, color: '#94a3b8' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={S.card}>
        <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 8, color: '#374151' }}>Список SKU</div>
        <SummaryTable<AnalysisResult>
          items={filtered}
          groupKey1={r => r.cls}
          groupKey2={r => r.tmcGroup}
          rowKey={r => r.code}
          label1="Класс"
          label2="ТМЦ общее"
          onRowClick={r => setFilters({ ...filters, abc: r.abcClass, xyz: r.xyzClass })}
          columns={columns}
        />
      </div>
    </div>
  )
})
