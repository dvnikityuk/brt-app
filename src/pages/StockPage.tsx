import { memo, useMemo } from 'react'
// useMemo used for columns
import { useAppStore, useFiltered, useMonthStatus, useFiscalMonthsFromLastShipment, useFiscalLabelsFromLastShipment } from '../store/useAppStore'
import { FilterBar } from '../components/FilterBar'
import { SummaryTable, type SColumn } from '../components/SummaryTable'
import { PivotTable } from '../components/PivotTable'
import type { AnalysisResult } from '../types'

const S = {
  card: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 14 } as React.CSSProperties,
  warn: { background: '#fefce8', border: '1px solid #fcd34d', borderRadius: 8, padding: 14, fontSize: 13, color: '#854d0e' } as React.CSSProperties,
  stat: { background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: '8px 16px', textAlign: 'center' as const },
}

export const StockPage = memo(function StockPage() {
  const results      = useAppStore(s => s.results)
  const stockData    = useAppStore(s => s.stockData)
  const filters      = useAppStore(s => s.filters)
  const setFilters   = useAppStore(s => s.setFilters)
  const pivotStock    = useAppStore(s => s.pivotStock)
  const setPivotStock = useAppStore(s => s.setPivotStock)

  const filtered    = useFiltered()
  const monthStatus = useMonthStatus()

  const fiscalMonths = useFiscalMonthsFromLastShipment()
  const fiscalLabels = useFiscalLabelsFromLastShipment()

  const columns = useMemo((): SColumn<AnalysisResult>[] => [
    { key: 'code', header: 'Код', sortValue: r => r.code, minWidth: 70,
      render: r => <span style={{ fontWeight: 600, color: '#1e40af', fontSize: 11 }}>{r.code}</span> },
    { key: 'name', header: 'Наименование', sortValue: r => r.name, minWidth: 150,
      render: r => <span style={{ fontSize: 11 }}>{r.name}</span> },
    { key: 'abcxyz', header: 'ABC-XYZ', sortValue: r => r.abcxyz,
      render: r => {
        const c = r.abcClass === 'A' ? '#16a34a' : r.abcClass === 'B' ? '#d97706' : '#dc2626'
        const bg = r.abcClass === 'A' ? '#f0fdf4' : r.abcClass === 'B' ? '#fffbeb' : '#fff5f5'
        return <span style={{ background: bg, color: c, padding: '1px 6px', borderRadius: 4, fontWeight: 600, fontSize: 10 }}>{r.abcxyz}</span>
      } },
    { key: 'avgDemand', header: 'Ср. спрос', sortValue: r => r.avgDemand, align: 'right',
      render: r => <span style={{ fontSize: 11 }}>{Math.round(r.avgDemand).toLocaleString('ru')}</span>,
      total: items => <>{Math.round(items.reduce((s, r) => s + r.avgDemand, 0)).toLocaleString('ru')}</>,
      aggregate: items => <>{Math.round(items.reduce((s, r) => s + r.avgDemand, 0)).toLocaleString('ru')}</>,
      aggregateSortValue: items => items.reduce((s, r) => s + r.avgDemand, 0) },
    { key: 'minStock', header: 'Min', sortValue: r => r.minStock, align: 'right',
      render: r => <span style={{ color: '#dc2626', fontWeight: 600, fontSize: 11 }}>{Math.round(r.minStock).toLocaleString('ru')}</span>,
      total: items => <span style={{ color: '#dc2626' }}>{Math.round(items.reduce((s, r) => s + r.minStock, 0)).toLocaleString('ru')}</span>,
      aggregate: items => <span style={{ color: '#dc2626' }}>{Math.round(items.reduce((s, r) => s + r.minStock, 0)).toLocaleString('ru')}</span>,
      aggregateSortValue: items => items.reduce((s, r) => s + r.minStock, 0) },
    { key: 'targetStock', header: 'Целевой', sortValue: r => r.targetStock, align: 'right',
      render: r => <span style={{ color: '#d97706', fontWeight: 600, fontSize: 11 }}>{Math.round(r.targetStock).toLocaleString('ru')}</span>,
      total: items => <span style={{ color: '#d97706' }}>{Math.round(items.reduce((s, r) => s + r.targetStock, 0)).toLocaleString('ru')}</span>,
      aggregate: items => <span style={{ color: '#d97706' }}>{Math.round(items.reduce((s, r) => s + r.targetStock, 0)).toLocaleString('ru')}</span>,
      aggregateSortValue: items => items.reduce((s, r) => s + r.targetStock, 0) },
    { key: 'maxStock', header: 'Max', sortValue: r => r.maxStock, align: 'right',
      render: r => <span style={{ color: '#16a34a', fontWeight: 600, fontSize: 11 }}>{Math.round(r.maxStock).toLocaleString('ru')}</span>,
      total: items => <span style={{ color: '#16a34a' }}>{Math.round(items.reduce((s, r) => s + r.maxStock, 0)).toLocaleString('ru')}</span>,
      aggregate: items => <span style={{ color: '#16a34a' }}>{Math.round(items.reduce((s, r) => s + r.maxStock, 0)).toLocaleString('ru')}</span>,
      aggregateSortValue: items => items.reduce((s, r) => s + r.maxStock, 0) },
    { key: 'rop', header: 'ROP', sortValue: r => r.rop, align: 'right',
      render: r => <span style={{ fontSize: 11 }}>{Math.round(r.rop).toLocaleString('ru')}</span>,
      total: items => <>{Math.round(items.reduce((s, r) => s + r.rop, 0)).toLocaleString('ru')}</>,
      aggregate: items => <>{Math.round(items.reduce((s, r) => s + r.rop, 0)).toLocaleString('ru')}</>,
      aggregateSortValue: items => items.reduce((s, r) => s + r.rop, 0) },
    { key: 'current', header: 'Текущий', sortValue: r => r.currentStock, align: 'right',
      render: r => <span style={{ fontSize: 11, color: r.currentStock >= 0 ? '#374151' : '#94a3b8' }}>{r.currentStock >= 0 ? r.currentStock.toLocaleString('ru') : '—'}</span>,
      total: items => { const w = items.filter(r => r.currentStock >= 0); return <>{w.length > 0 ? w.reduce((s, r) => s + r.currentStock, 0).toLocaleString('ru') : '—'}</> },
      aggregate: items => { const w = items.filter(r => r.currentStock >= 0); return <>{w.length > 0 ? w.reduce((s, r) => s + r.currentStock, 0).toLocaleString('ru') : '—'}</> },
      aggregateSortValue: items => items.filter(r => r.currentStock >= 0).reduce((s, r) => s + r.currentStock, 0) },
    { key: 'stockDate', header: 'Дата',
      render: r => <span style={{ fontSize: 10, color: '#94a3b8' }}>{r.stockDate || '—'}</span> },
    { key: 'status', header: 'Статус', sortValue: r => r.currentStock >= 0 ? (r.currentStock <= r.minStock ? 0 : r.currentStock <= r.targetStock ? 1 : 2) : -1,
      render: r => {
        if (r.currentStock < 0) return <span style={{ color: '#94a3b8', fontSize: 11 }}>—</span>
        if (r.currentStock <= r.minStock) return <span style={{ color: '#dc2626', fontWeight: 600, fontSize: 11 }}>Дефицит</span>
        if (r.currentStock <= r.targetStock) return <span style={{ color: '#d97706', fontWeight: 600, fontSize: 11 }}>Мало</span>
        return <span style={{ color: '#16a34a', fontWeight: 600, fontSize: 11 }}>Норма</span>
      } },
  ], [])

  if (!results.length) return <div style={S.warn}>Загрузите данные и запустите анализ</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <FilterBar filters={filters} onFilters={setFilters} results={results} filtered={filtered} />

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {([
          ['Min (страховой)', Math.round(filtered.reduce((s, r) => s + r.minStock, 0)).toLocaleString('ru'), '#dc2626'],
          ['Целевой', Math.round(filtered.reduce((s, r) => s + r.targetStock, 0)).toLocaleString('ru'), '#d97706'],
          ['Max', Math.round(filtered.reduce((s, r) => s + r.maxStock, 0)).toLocaleString('ru'), '#16a34a'],
          ['С остатками', filtered.filter(r => r.currentStock >= 0).length, '#1e40af'],
        ] as [string, string | number, string][]).map(([l, v, c]) => (
          <div key={l} style={S.stat}>
            <div style={{ fontSize: 18, fontWeight: 700, color: c }}>{v}</div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{l}</div>
          </div>
        ))}
      </div>

      <div style={S.card}>
        <div style={{ fontWeight: 600, fontSize: 12, color: '#374151', marginBottom: 4 }}>Нормативы складских остатков</div>
        {!stockData.length && <div style={{ fontSize: 11, color: '#d97706', marginBottom: 8 }}>Файл остатков не загружен — используется целевой запас</div>}
        {stockData.length > 0 && !stockData.some(s => s.date) && <div style={{ fontSize: 11, color: '#d97706', marginBottom: 8 }}>Дата не указана — остатки привязаны к 1-му месяцу</div>}
        <SummaryTable<AnalysisResult>
          items={filtered}
          groupKey1={r => r.cls}
          groupKey2={r => r.tmcGroup}
          rowKey={r => r.code}
          label1="Класс"
          label2="ТМЦ общее"
          columns={columns}
        />
      </div>

      <div style={S.card}>
        <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 10, color: '#374151' }}>Сводная по складу</div>
        <PivotTable results={filtered} config={pivotStock} onConfig={setPivotStock} fiscalMonths={fiscalMonths} fiscalLabels={fiscalLabels} title="Группа" monthStatus={monthStatus} />
      </div>
    </div>
  )
})
