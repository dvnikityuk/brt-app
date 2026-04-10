/**
 * PivotTable — сводная таблица с группировкой
 * Собирает PivotControls + PivotRows + шапку + итоги
 * ~120 строк
 */
import { memo, useMemo, useCallback } from 'react'
import type { AnalysisResult, MetricKey } from '../../types'
import type { PivotConfig } from '../../store/useAppStore'
import { ALL_METRICS } from '../../constants'
import { getMetricVals, getRowVal } from '../../engine'
import { PivotControls } from './PivotControls'
import { PivotRows, type TreeNode } from './PivotRows'

interface Props {
  results: AnalysisResult[]
  config: PivotConfig
  onConfig: (c: PivotConfig) => void
  fiscalMonths: number[]
  fiscalLabels: string[]
  title?: string
  monthStatus?: ('fact' | 'current' | 'past' | 'future')[]
}

export const PivotTable = memo(function PivotTable({
  results, config, onConfig, fiscalMonths, fiscalLabels, title, monthStatus
}: Props) {
  const { layers, metrics, collapsed } = config
  const headerBg = '#f1f5f9'

  const metricDefs = useMemo(
    () => metrics.map(mk => ALL_METRICS.find(m => m.key === mk)!).filter(Boolean),
    [metrics]
  )

  const toggleCollapse = useCallback((key: string) => {
    onConfig({ ...config, collapsed: { ...collapsed, [key]: !collapsed[key] } })
  }, [config, collapsed, onConfig])

  // Кэш для sumMetric — избегаем повторных вычислений одних и тех же групп
  const sumMetricCache = useMemo(() => new Map<string, number[]>(), [results, fiscalMonths, metrics])

  const sumMetric = useCallback((items: AnalysisResult[], metric: MetricKey): number[] => {
    // Ключ кэша: коды SKU + метрика
    const cacheKey = metric + ':' + items.map(r => r.code).join(',')
    const cached = sumMetricCache.get(cacheKey)
    if (cached) return cached

    const s = Array(12).fill(0) as number[]
    for (const r of items) {
      const vals = getMetricVals(r, metric, fiscalMonths)
      for (let i = 0; i < 12; i++) s[i] += vals[i]
    }
    sumMetricCache.set(cacheKey, s)
    return s
  }, [fiscalMonths, sumMetricCache])

  // Построение дерева
  const tree = useMemo((): TreeNode[] => {
    const build = (items: AnalysisResult[], depth: number, path: string): TreeNode[] => {
      if (depth >= layers.length) return []
      const layer = layers[depth]
      const groups: Record<string, AnalysisResult[]> = {}
      for (const r of items) {
        const v = getRowVal(r, layer.key)
        if (!groups[v]) groups[v] = []
        groups[v].push(r)
      }
      return Object.keys(groups).sort().map(k => ({
        key: k, label: k, depth, path: path + '|' + k,
        items: groups[k],
        children: build(groups[k], depth + 1, path + '|' + k)
      }))
    }
    return build(results, 0, '')
  }, [results, layers])

  const grandTotals = useMemo(
    () => metrics.map(mk => sumMetric(results, mk as MetricKey)),
    [results, metrics, sumMetric]
  )

  return (
    <div>
      <PivotControls config={config} onConfig={onConfig} tree={tree} />

      <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: 8 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: headerBg }}>
            <tr>
              <th style={{ padding: '8px 10px', textAlign: 'left', background: headerBg, borderBottom: '2px solid #e2e8f0', position: 'sticky', left: 0, zIndex: 11, minWidth: 200, fontSize: 12, color: '#475569' }}>
                {title || 'Наименование'}
              </th>
              <th style={{ padding: '8px 6px', background: headerBg, borderBottom: '2px solid #e2e8f0', minWidth: 60, fontSize: 12 }}>
                Класс
              </th>
              {fiscalLabels.map((l, i) => {
                const st = monthStatus?.[i]
                const thBg = st === 'fact' ? '#dcfce7' : st === 'current' ? '#dbeafe' : headerBg
                const thClr = st === 'fact' ? '#166534' : st === 'current' ? '#1e40af' : '#475569'
                return (
                  <th key={i} style={{ padding: '8px 6px', textAlign: 'center', background: thBg, borderBottom: '2px solid #e2e8f0', minWidth: 72, fontSize: 11, color: thClr }}>
                    {st === 'fact' && <div style={{ fontSize: 8, fontWeight: 700, color: '#166534' }}>Факт</div>}
                    {st === 'current' && <div style={{ fontSize: 8, fontWeight: 700, color: '#1e40af' }}>Текущий</div>}
                    {l}
                    <div style={{ fontWeight: 400, fontSize: 9, marginTop: 2 }}>
                      {metricDefs.map(m => <span key={m.key} style={{ color: m.color }}>●</span>)}
                    </div>
                  </th>
                )
              })}
              <th style={{ padding: '8px 6px', textAlign: 'center', background: '#e0f2fe', borderBottom: '2px solid #e2e8f0', minWidth: 72, fontSize: 11, color: '#0369a1', position: 'sticky', right: 0, zIndex: 11 }}>
                Итого
              </th>
            </tr>
          </thead>
          <tbody>
            <PivotRows
              nodes={tree}
              collapsed={collapsed}
              onToggle={toggleCollapse}
              metrics={metrics as MetricKey[]}
              metricDefs={metricDefs}
              fiscalLabels={fiscalLabels}
              fiscalMonths={fiscalMonths}
              layersLength={layers.length}
              sumMetric={sumMetric}
            />
            {/* Итого */}
            <tr style={{ background: '#f0fdf4', fontWeight: 700 }}>
              <td colSpan={2} style={{ padding: '8px 10px', fontSize: 12, position: 'sticky', left: 0, background: '#f0fdf4', zIndex: 1 }}>
                ИТОГО
              </td>
              {Array(12).fill(0).map((_, mi) => (
                <td key={mi} style={{ padding: '5px 6px', textAlign: 'right', fontSize: 11 }}>
                  {metrics.map((_, si) => (
                    <div key={si} style={{ color: metricDefs[si]?.color }}>
                      {grandTotals[si][mi].toLocaleString('ru')}
                    </div>
                  ))}
                </td>
              ))}
              <td style={{ padding: '5px 6px', textAlign: 'right', fontSize: 11, background: '#bbf7d0', position: 'sticky', right: 0 }}>
                {metrics.map((_, si) => (
                  <div key={si} style={{ color: metricDefs[si]?.color }}>
                    {grandTotals[si].reduce((s, v) => s + v, 0).toLocaleString('ru')}
                  </div>
                ))}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
})
