import { memo, useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import { useAppStore, useFiltered, useMonthStatus, useFiscalMonthsFromLastShipment, useFiscalLabelsFromLastShipment } from '../store/useAppStore'
import { FilterBar } from '../components/FilterBar'
import { PivotTable } from '../components/PivotTable'
import { holidayEff } from '../engine'
import type { HolidayMonth, AnalysisResult } from '../types'

const S = {
  card: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 14 } as React.CSSProperties,
  warn: { background: '#fefce8', border: '1px solid #fcd34d', borderRadius: 8, padding: 14, fontSize: 13, color: '#854d0e' } as React.CSSProperties,
  stat: { background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: '8px 16px', textAlign: 'center' as const },
  th: {
    padding: '6px 4px',
    textAlign: 'center' as const,
    borderBottom: '2px solid #e2e8f0',
    fontSize: 11,
    color: '#475569',
    fontWeight: 600,
    whiteSpace: 'nowrap' as const,
  } as React.CSSProperties,
  td: {
    padding: '4px 4px',
    fontSize: 11,
    borderBottom: '1px solid #f1f5f9',
  } as React.CSSProperties,
}

type SortKey = 'cls' | 'tmcGroup' | 'name' | 'code' | 'total'
type SortDir = 'asc' | 'desc'

export const ProductionPage = memo(function ProductionPage() {
  const results      = useAppStore(s => s.results)
  const settings     = useAppStore(s => s.settings)
  const filters      = useAppStore(s => s.filters)
  const setFilters   = useAppStore(s => s.setFilters)
  const pivotPlan    = useAppStore(s => s.pivotPlan)
  const setPivotPlan = useAppStore(s => s.setPivotPlan)

  const filtered    = useFiltered()
  const monthStatus = useMonthStatus()

  const [sortKey, setSortKey] = useState<SortKey>('total')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir(key === 'total' ? 'desc' : 'asc')
    }
  }

  const fiscalMonths = useFiscalMonthsFromLastShipment()
  const fiscalLabels = useFiscalLabelsFromLastShipment()

  const getVal = (r: AnalysisResult, fi: number) => {
    if (r.isActual?.[fi]) return r.actualVals?.[fi] ?? 0
    return r.orderPlan[fi]
  }

  const getTotal = (r: AnalysisResult) =>
    fiscalMonths.reduce((s, _, fi) => s + getVal(r, fi), 0)

  const sorted = useMemo(() => {
    const groups: Record<string, AnalysisResult[]> = {}
    filtered.forEach(r => {
      if (!groups[r.cls]) groups[r.cls] = []
      groups[r.cls].push(r)
    })
    Object.keys(groups).forEach(cls => {
      groups[cls].sort((a, b) => {
        let cmp = 0
        switch (sortKey) {
          case 'cls':      cmp = a.cls.localeCompare(b.cls, 'ru'); break
          case 'tmcGroup': cmp = a.tmcGroup.localeCompare(b.tmcGroup, 'ru'); break
          case 'name':     cmp = a.name.localeCompare(b.name, 'ru'); break
          case 'code':     cmp = a.code.localeCompare(b.code, 'ru'); break
          case 'total':    cmp = getTotal(a) - getTotal(b); break
        }
        return sortDir === 'desc' ? -cmp : cmp
      })
    })
    return Object.keys(groups).sort().flatMap(cls => groups[cls])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, sortKey, sortDir, fiscalMonths])

  const exportMatrix = () => {
    const wb = XLSX.utils.book_new()
    const rows = sorted.map(r => {
      const row: Record<string, string | number> = {
        'Класс': r.cls, 'ТМЦ общее': r.tmcGroup, 'ТМЦ': r.name, 'Код': r.code,
      }
      let total = 0, totalPacks = 0
      fiscalLabels.forEach((label, fi) => {
        const val = getVal(r, fi)
        const isFact = r.isActual?.[fi] ?? false
        row[`${label} шт${isFact ? ' (Ф)' : ''}`] = val
        if (r.packQty && r.packQty > 1) {
          row[`${label} уп`] = r.orderPlanPacks?.[fi] ?? 0
          totalPacks += r.orderPlanPacks?.[fi] ?? 0
        }
        total += val
      })
      row['Итого шт'] = total
      if (r.packQty && r.packQty > 1) row['Итого уп'] = totalPacks
      return row
    })
    const ws = XLSX.utils.json_to_sheet(rows)
    XLSX.utils.book_append_sheet(wb, ws, 'Матрица заказов')
    XLSX.writeFile(wb, 'BRT_матрица_заказов.xlsx')
  }

  if (!results.length) return <div style={S.warn}>Загрузите данные и запустите анализ</div>

  const hasPackaging = filtered.some(r => r.packQty && r.packQty > 1)
  const arrow = (key: SortKey) => sortKey === key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''
  const thSort = (key: SortKey) => ({
    ...S.th,
    cursor: 'pointer',
    userSelect: 'none' as const,
    background: sortKey === key ? '#e0f2fe' : '#f8fafc',
    color: sortKey === key ? '#0369a1' : '#475569',
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <FilterBar filters={filters} onFilters={setFilters} results={results} filtered={filtered} />

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ fontSize: 11, color: '#64748b', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: '6px 12px' }}>
          Заказ = Спрос + Наполнение склада · Сезонность · Каникулы
          {settings.useHolidays && <span style={{ marginLeft: 8, color: '#d97706', fontWeight: 600 }}>Каникулы</span>}
          {hasPackaging && <span style={{ marginLeft: 8, color: '#7c3aed', fontWeight: 600 }}>Кратность уп.</span>}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {([
          ['Прогноз', filtered.reduce((s, r) => s + r.totalForecast, 0).toLocaleString('ru'), '#1e40af'],
          ['Заказ',   filtered.reduce((s, r) => s + r.totalOrders, 0).toLocaleString('ru'), '#16a34a'],
          ['SKU',     filtered.length, '#64748b'],
        ] as [string, string | number, string][]).map(([l, v, c]) => (
          <div key={l} style={S.stat}>
            <div style={{ fontSize: 18, fontWeight: 700, color: c }}>{v}</div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>{l}</div>
          </div>
        ))}
      </div>

      {/* Pivot */}
      <div style={S.card}>
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10, color: '#374151' }}>Сводный план</div>
        <PivotTable
          results={filtered}
          config={pivotPlan}
          onConfig={setPivotPlan}
          fiscalMonths={fiscalMonths}
          fiscalLabels={fiscalLabels}
          title="Группа / SKU"
          monthStatus={monthStatus}
        />
      </div>

      {/* Detail matrix */}
      <div style={S.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 13, color: '#374151' }}>Детальный план заказов</div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
              <span style={{ background: '#dcfce7', padding: '2px 6px', borderRadius: 4, marginRight: 8 }}>Ф — факт</span>
              <span style={{ background: '#e0f2fe', padding: '2px 6px', borderRadius: 4, marginRight: 8 }}>П — план</span>
              {hasPackaging && <span style={{ color: '#7c3aed' }}>шт / уп</span>}
              <span style={{ marginLeft: 12, color: '#94a3b8' }}>Клик по заголовку — сортировка</span>
            </div>
          </div>
          <button onClick={exportMatrix} style={{ padding: '6px 14px', background: '#1e40af', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
            Экспорт Excel
          </button>
        </div>

        <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: 8, maxHeight: 600 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
              <tr style={{ background: '#f8fafc' }}>
                <th onClick={() => toggleSort('cls')} style={{ ...thSort('cls'), textAlign: 'left', position: 'sticky', left: 0, zIndex: 11, borderRight: '1px solid #e2e8f0', minWidth: 100, padding: '6px 8px' }}>
                  Класс{arrow('cls')}
                </th>
                <th onClick={() => toggleSort('tmcGroup')} style={{ ...thSort('tmcGroup'), textAlign: 'left', minWidth: 120, padding: '6px 8px' }}>
                  ТМЦ общее{arrow('tmcGroup')}
                </th>
                <th onClick={() => toggleSort('name')} style={{ ...thSort('name'), textAlign: 'left', minWidth: 180, padding: '6px 8px' }}>
                  Наименование{arrow('name')}
                </th>
                <th onClick={() => toggleSort('code')} style={{ ...thSort('code'), textAlign: 'left', minWidth: 70, padding: '6px 8px' }}>
                  Код{arrow('code')}
                </th>
                {fiscalLabels.map((label, fi) => {
                  const h = settings.useHolidays && settings.holidays?.[fi]
                  const eff = h ? holidayEff(h as HolidayMonth) : 1
                  const st = monthStatus[fi]
                  const bg = st === 'fact' ? '#dcfce7' : st === 'current' ? '#dbeafe' : eff < 0.99 ? '#fefce8' : '#f8fafc'
                  const clr = st === 'fact' ? '#166534' : st === 'current' ? '#1e40af' : '#475569'
                  return (
                    <th key={fi} style={{ ...S.th, background: bg, color: clr, minWidth: 65, borderLeft: '1px solid #e2e8f0' }}>
                      <div>{label}</div>
                      {st === 'fact'    && <div style={{ fontSize: 9, fontWeight: 400, color: '#16a34a' }}>факт</div>}
                      {st === 'current' && <div style={{ fontSize: 9, fontWeight: 400, color: '#1e40af' }}>тек.</div>}
                      {eff < 0.99 && st === 'future' && <div style={{ fontSize: 9, fontWeight: 400, color: '#d97706' }}>{Math.round(eff * 100)}%</div>}
                    </th>
                  )
                })}
                <th onClick={() => toggleSort('total')} style={{ ...thSort('total'), background: sortKey === 'total' ? '#bae6fd' : '#e0f2fe', color: '#0369a1', position: 'sticky', right: 0, zIndex: 11, borderLeft: '2px solid #0369a1', minWidth: 70 }}>
                  Итого{arrow('total')}
                </th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const rows: React.ReactNode[] = []
                let currentCls = ''

                sorted.forEach((r, idx) => {
                  if (r.cls !== currentCls) {
                    currentCls = r.cls
                    const clsItems = sorted.filter(x => x.cls === r.cls)
                    const clsTotal = clsItems.reduce((s, x) => s + getTotal(x), 0)
                    rows.push(
                      <tr key={`cls_${r.cls}`} style={{ background: '#f1f5f9' }}>
                        <td colSpan={4} style={{ padding: '8px 10px', fontWeight: 700, fontSize: 12, color: '#374151', position: 'sticky', left: 0, background: '#f1f5f9', borderBottom: '1px solid #e2e8f0' }}>
                          {r.cls} ({clsItems.length})
                        </td>
                        {fiscalMonths.map((_, fi) => (
                          <td key={fi} style={{ ...S.td, textAlign: 'center', fontWeight: 600, color: '#64748b', background: '#f1f5f9', borderLeft: '1px solid #e2e8f0' }}>
                            {clsItems.reduce((s, x) => s + getVal(x, fi), 0).toLocaleString('ru')}
                          </td>
                        ))}
                        <td style={{ ...S.td, textAlign: 'center', fontWeight: 700, background: '#e0f2fe', color: '#0369a1', position: 'sticky', right: 0, borderLeft: '2px solid #0369a1' }}>
                          {clsTotal.toLocaleString('ru')}
                        </td>
                      </tr>
                    )
                  }

                  const vals = fiscalMonths.map((_, fi) => getVal(r, fi))
                  const total = vals.reduce((s, v) => s + v, 0)
                  const hasPack = r.packQty && r.packQty > 1

                  rows.push(
                    <tr key={r.code} style={{ background: idx % 2 === 0 ? '#fff' : '#fafafa' }}>
                      <td style={{ ...S.td, position: 'sticky', left: 0, background: idx % 2 === 0 ? '#fff' : '#fafafa', zIndex: 1, borderRight: '1px solid #f1f5f9', paddingLeft: 20, color: '#94a3b8', fontSize: 10 }}>
                        └
                      </td>
                      <td style={{ ...S.td, color: '#64748b', minWidth: 100, maxWidth: 160 }}>
                        <div style={{ whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: 1.4 }}>{r.tmcGroup}</div>
                      </td>
                      <td style={{ ...S.td, minWidth: 180, maxWidth: 240 }}>
                        <div style={{ fontWeight: 500, whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: 1.4 }}>{r.name}</div>
                        <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>
                          <span style={{
                            background: r.abcClass === 'A' ? '#dcfce7' : r.abcClass === 'B' ? '#fef9c3' : '#fee2e2',
                            color: r.abcClass === 'A' ? '#166534' : r.abcClass === 'B' ? '#854d0e' : '#991b1b',
                            padding: '0 4px', borderRadius: 3, fontWeight: 600,
                          }}>{r.abcxyz}</span>
                          {hasPack && <span style={{ marginLeft: 4, color: '#7c3aed' }}>×{r.packQty}</span>}
                        </div>
                      </td>
                      <td style={{ ...S.td, fontWeight: 600, color: '#1e40af' }}>{r.code}</td>
                      {vals.map((v, fi) => {
                        const isFact = r.isActual?.[fi] ?? false
                        const packs = r.orderPlanPacks?.[fi] ?? 0
                        return (
                          <td key={fi} style={{ ...S.td, textAlign: 'center', borderLeft: '1px solid #f1f5f9', background: v > 0 ? (isFact ? '#f0fdf4' : '') : '' }}>
                            {v > 0 ? (
                              <div>
                                <div style={{ fontWeight: 500, color: isFact ? '#166534' : '#374151' }}>{v.toLocaleString('ru')}</div>
                                {hasPackaging && hasPack && packs > 0 && (
                                  <div style={{ fontSize: 10, color: '#7c3aed', fontWeight: 500 }}>{packs} уп</div>
                                )}
                              </div>
                            ) : (
                              <span style={{ color: '#d1d5db' }}>—</span>
                            )}
                          </td>
                        )
                      })}
                      <td style={{ ...S.td, textAlign: 'center', fontWeight: 700, background: '#e0f2fe', color: '#0369a1', position: 'sticky', right: 0, borderLeft: '2px solid #0369a1' }}>
                        {total.toLocaleString('ru')}
                        {hasPackaging && hasPack && (
                          <div style={{ fontSize: 10, color: '#7c3aed', fontWeight: 600 }}>
                            {(r.orderPlanPacks ?? []).reduce((s, v) => s + v, 0)} уп
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })
                return rows
              })()}

              {/* Grand total */}
              <tr style={{ background: '#f0fdf4', fontWeight: 700, position: 'sticky', bottom: 0 }}>
                <td colSpan={4} style={{ padding: '8px 10px', fontSize: 12, position: 'sticky', left: 0, background: '#f0fdf4', borderRight: '1px solid #e2e8f0', borderTop: '2px solid #16a34a' }}>
                  ИТОГО ({filtered.length} позиций)
                </td>
                {fiscalMonths.map((_, fi) => {
                  const sumVal = filtered.reduce((s, r) => s + getVal(r, fi), 0)
                  const sumPacks = filtered.reduce((s, r) => s + (r.orderPlanPacks?.[fi] ?? 0), 0)
                  return (
                    <td key={fi} style={{ padding: '8px 4px', textAlign: 'center', borderLeft: '1px solid #e2e8f0', borderTop: '2px solid #16a34a', background: '#f0fdf4' }}>
                      <div style={{ fontSize: 11, fontWeight: 700 }}>{sumVal.toLocaleString('ru')}</div>
                      {hasPackaging && sumPacks > 0 && <div style={{ fontSize: 10, color: '#7c3aed' }}>{sumPacks} уп</div>}
                    </td>
                  )
                })}
                <td style={{ padding: '8px 4px', textAlign: 'center', fontSize: 12, background: '#bbf7d0', color: '#166534', position: 'sticky', right: 0, borderLeft: '2px solid #0369a1', borderTop: '2px solid #16a34a' }}>
                  {filtered.reduce((s, r) => s + fiscalMonths.reduce((ss, _, fi) => ss + getVal(r, fi), 0), 0).toLocaleString('ru')}
                  {hasPackaging && (
                    <div style={{ fontSize: 10, color: '#7c3aed' }}>
                      {filtered.reduce((s, r) => s + (r.orderPlanPacks ?? []).reduce((ss, v) => ss + v, 0), 0)} уп
                    </div>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
})

// hasPackaging нужен внутри map — вынесем как переменную модуля
const hasPackaging = false // будет переопределён через filtered внутри компонента
void hasPackaging
