/**
 * OutliersTab — анализ выбросов
 * Оркестрирует OutlierDetail + SummaryTable
 * ~150 строк
 */
import { useState, useMemo, useEffect, useCallback, memo } from 'react'
import type { RawRow, AnalysisResult, Settings } from '../../types'
import { normCode, findOutliers, mean, stdev, pct } from '../../engine'
import { SummaryTable, type SColumn } from '../SummaryTable'
import { OutlierDetail, type OutlierSku } from './OutlierDetail'

interface Props {
  results: AnalysisResult[]
  rawData: RawRow[]
  settings: Settings
}

export const OutliersTab = memo(function OutliersTab({ results, rawData, settings }: Props) {
  const [selectedCode, setSelectedCode] = useState<string>('')
  const [showAll, setShowAll] = useState(false)

  // Вычисляем данные выбросов
  const allOutlierData = useMemo<OutlierSku[]>(() => {
    const result: OutlierSku[] = []
    for (const r of results) {
      const monthly: Record<string, number> = {}
      for (const d of rawData) {
        if (normCode(d.code) !== r.code) continue
        const mk = `${d.date.getFullYear()}-${String(d.date.getMonth() + 1).padStart(2, '0')}`
        monthly[mk] = (monthly[mk] || 0) + d.qty
      }
      const months = Object.keys(monthly).sort()
      const vals = months.map(m => monthly[m])
      if (!vals.length) continue

      const mask = findOutliers(vals, settings.outlierMethod, settings.outlierThreshold)
      const cleanVals = vals.filter((_, i) => !mask[i])
      const base = cleanVals.length >= 2 ? cleanVals : vals
      const avg = mean(base)
      const sorted = [...base].sort((a, b) => a - b)
      let lower = 0, upper = Infinity

      if (settings.outlierMethod === 'iqr') {
        const Q1 = pct(sorted, 25), Q3 = pct(sorted, 75), IQR = Q3 - Q1
        lower = Q1 - settings.outlierThreshold * IQR
        upper = Q3 + settings.outlierThreshold * IQR
      } else if (settings.outlierMethod === 'zscore') {
        const sd = stdev(vals)
        lower = avg - settings.outlierThreshold * sd
        upper = avg + settings.outlierThreshold * sd
      } else if (settings.outlierMethod === 'mad') {
        const med = pct(sorted, 50)
        const mads = vals.map(v => Math.abs(v - med)).sort((a, b) => a - b)
        const mad = pct(mads, 50) || 1
        lower = med - (settings.outlierThreshold * mad) / 0.6745
        upper = med + (settings.outlierThreshold * mad) / 0.6745
      }
      result.push({ r, months, vals, mask, avg, lower, upper })
    }
    return result
  }, [results, rawData, settings])

  const withOutliers = useMemo(() => allOutlierData.filter(d => d.mask.some(Boolean)), [allOutlierData])
  const displayList = showAll ? allOutlierData : withOutliers
  const totalOutliers = useMemo(() => withOutliers.reduce((s, d) => s + d.mask.filter(Boolean).length, 0), [withOutliers])
  const totalPoints = useMemo(() => allOutlierData.reduce((s, d) => s + d.vals.length, 0), [allOutlierData])

  useEffect(() => {
    if (!selectedCode) {
      const first = withOutliers[0] ?? allOutlierData[0]
      if (first) setSelectedCode(first.r.code)
    }
  }, [withOutliers, allOutlierData, selectedCode])

  const selected = useMemo(() => allOutlierData.find(d => d.r.code === selectedCode), [allOutlierData, selectedCode])
  const handleRowClick = useCallback((d: OutlierSku) => setSelectedCode(d.r.code), [])

  // Колонки таблицы
  const columns = useMemo((): SColumn<OutlierSku>[] => [
    { key: 'code', header: 'Код', sortValue: d => d.r.code, minWidth: 70,
      render: d => <span style={{ fontWeight: 600, color: '#1e40af' }}>{d.r.code}</span> },
    { key: 'name', header: 'Наименование', sortValue: d => d.r.name, minWidth: 150,
      render: d => <span style={{ maxWidth: 200, wordBreak: 'break-word', lineHeight: 1.3, display: 'inline-block' }}>{d.r.name}</span> },
    { key: 'abcxyz', header: 'ABC-XYZ', sortValue: d => d.r.abcxyz,
      render: d => {
        const c = d.r.abcClass === 'A' ? '#16a34a' : d.r.abcClass === 'B' ? '#d97706' : '#dc2626'
        const bg = d.r.abcClass === 'A' ? '#f0fdf4' : d.r.abcClass === 'B' ? '#fffbeb' : '#fff5f5'
        return <span style={{ background: bg, color: c, padding: '1px 6px', borderRadius: 6, fontWeight: 700, fontSize: 10 }}>{d.r.abcxyz}</span>
      } },
    { key: 'points', header: 'Точек', sortValue: d => d.vals.length, align: 'right',
      render: d => <>{d.vals.length}</>,
      total: items => <>{items.reduce((s, d) => s + d.vals.length, 0)}</>,
      aggregate: items => <>{items.reduce((s, d) => s + d.vals.length, 0)}</>,
      aggregateSortValue: items => items.reduce((s, d) => s + d.vals.length, 0) },
    { key: 'outliers', header: 'Выбр.', sortValue: d => d.mask.filter(Boolean).length, align: 'right',
      render: d => {
        const cnt = d.mask.filter(Boolean).length
        return cnt > 0
          ? <span style={{ background: '#fef2f2', color: '#dc2626', padding: '1px 6px', borderRadius: 8, fontWeight: 700 }}>{cnt}</span>
          : <span style={{ color: '#16a34a' }}>✓</span>
      },
      total: items => <span style={{ color: '#dc2626', fontWeight: 700 }}>{items.reduce((s, d) => s + d.mask.filter(Boolean).length, 0)}</span>,
      aggregate: items => {
        const cnt = items.reduce((s, d) => s + d.mask.filter(Boolean).length, 0)
        return cnt > 0 ? <span style={{ color: '#dc2626', fontWeight: 700 }}>{cnt}</span> : <span style={{ color: '#16a34a' }}>✓</span>
      },
      aggregateSortValue: items => items.reduce((s, d) => s + d.mask.filter(Boolean).length, 0) },
    { key: 'avgBefore', header: 'Ср. до', sortValue: d => mean(d.vals), align: 'right',
      render: d => <>{mean(d.vals).toFixed(0)}</>,
      aggregate: items => <>{Math.round(items.reduce((s, d) => s + mean(d.vals), 0)).toLocaleString('ru')}</>,
      aggregateSortValue: items => items.reduce((s, d) => s + mean(d.vals), 0) },
    { key: 'avgAfter', header: 'Ср. после', sortValue: d => d.avg, align: 'right',
      render: d => <span style={{ fontWeight: d.mask.some(Boolean) ? 600 : 400, color: d.mask.some(Boolean) ? '#16a34a' : '#374151' }}>{d.avg.toFixed(0)}</span>,
      aggregate: items => <span style={{ color: '#16a34a', fontWeight: 600 }}>{Math.round(items.reduce((s, d) => s + d.avg, 0)).toLocaleString('ru')}</span>,
      aggregateSortValue: items => items.reduce((s, d) => s + d.avg, 0) },
  ], [])

  if (!results.length) {
    return <div style={{ background: '#fefce8', border: '1px solid #fcd34d', borderRadius: 8, padding: 14, fontSize: 13 }}>Загрузите данные и нажмите «Запустить анализ»</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* KPI */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {([
          ['Всего SKU', allOutlierData.length, '#3b82f6'],
          ['С выбросами', withOutliers.length, '#ef4444'],
          ['Выбросов', totalOutliers, '#f59e0b'],
          ['% от данных', totalPoints > 0 ? (totalOutliers / totalPoints * 100).toFixed(1) + '%' : '0%', '#8b5cf6'],
          ['Метод', settings.outlierMethod.toUpperCase(), '#10b981'],
          ['Порог', settings.outlierThreshold.toFixed(1), '#06b6d4'],
        ] as [string, string | number, string][]).map(([l, v, c]) => (
          <div key={l} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '7px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: c }}>{v}</div>
            <div style={{ fontSize: 10, color: '#64748b' }}>{l}</div>
          </div>
        ))}
      </div>

      {/* Выбор SKU + детальный анализ */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: 12 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, fontWeight: 600 }}>SKU для анализа:</span>
          <select value={selectedCode} onChange={e => setSelectedCode(e.target.value)}
            style={{ padding: '5px 10px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12, minWidth: 300, flex: 1 }}>
            {displayList.map(d => (
              <option key={d.r.code} value={d.r.code}>
                {d.r.code} — {d.r.name} [{d.r.abcxyz}]
                {d.mask.some(Boolean) ? ` (${d.mask.filter(Boolean).length} выбр.)` : ' ✓'}
              </option>
            ))}
          </select>
          <button onClick={() => setShowAll(v => !v)}
            style={{ padding: '5px 10px', background: showAll ? '#3b82f6' : '#f1f5f9', color: showAll ? '#fff' : '#374151', border: '1px solid #e2e8f0', borderRadius: 8, cursor: 'pointer', fontSize: 11 }}>
            {showAll ? 'Все SKU' : 'Только с выбросами'}
          </button>
        </div>
        {selected && <OutlierDetail selected={selected} />}
      </div>

      {/* Сводная таблица */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: 12 }}>
        <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 8 }}>
          Сводная таблица — {withOutliers.length} SKU с выбросами из {allOutlierData.length}
        </div>
        <SummaryTable<OutlierSku>
          items={allOutlierData}
          groupKey1={d => d.r.cls}
          groupKey2={d => d.r.tmcGroup}
          rowKey={d => d.r.code}
          label1="Класс" label2="ТМЦ общее"
          selectedKey={selectedCode}
          onRowClick={handleRowClick}
          columns={columns}
        />
      </div>

      {/* Инфо о методе */}
      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 12px', fontSize: 11, color: '#64748b', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <span><b>Метод:</b> {settings.outlierMethod === 'iqr' ? 'IQR — межквартильный размах' : settings.outlierMethod === 'zscore' ? 'Z-Score' : settings.outlierMethod === 'mad' ? 'MAD — медианное отклонение' : 'Не применяется'}</span>
        <span><b>Порог:</b> {settings.outlierThreshold}</span>
        <span style={{ marginLeft: 'auto', color: '#3b82f6' }}>Настройки → вкладка «Настройки»</span>
      </div>
    </div>
  )
})
