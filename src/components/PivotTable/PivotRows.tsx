/**
 * PivotRows — рендеринг строк сводной таблицы
 * Рекурсивный рендер дерева узлов
 * ~150 строк
 */
import React, { memo, useCallback } from 'react'
import type { AnalysisResult } from '../../types'
import type { MetricKey } from '../../types'
import { getMetricVals } from '../../engine'

export interface TreeNode {
  key: string
  label: string
  children: TreeNode[]
  items: AnalysisResult[]
  depth: number
  path: string
}

interface MetricDef {
  key: MetricKey
  label: string
  color: string
}

interface Props {
  nodes: TreeNode[]
  collapsed: Record<string, boolean>
  onToggle: (path: string) => void
  metrics: MetricKey[]
  metricDefs: MetricDef[]
  fiscalLabels: string[]
  fiscalMonths: number[]
  layersLength: number
  sumMetric: (items: AnalysisResult[], mk: MetricKey) => number[]
}

export const PivotRows = memo(function PivotRows({
  nodes, collapsed, onToggle, metrics, metricDefs,
  fiscalLabels, fiscalMonths, layersLength, sumMetric
}: Props) {
  const renderNodes = useCallback((ns: TreeNode[]): React.ReactNode[] => {
    const rows: React.ReactNode[] = []

    for (const node of ns) {
      const isCollapsed = collapsed[node.path]
      const hasChildren = node.children.length > 0
      const indent = node.depth * 16
      const bg = node.depth === 0 ? '#f1f5f9' : node.depth === 1 ? '#f8fafc' : '#fff'

      // Заголовок группы
      rows.push(
        <tr key={node.path + '_h'} style={{ background: bg }}>
          <td
            colSpan={2}
            style={{ padding: '6px 8px', paddingLeft: indent + 8, fontWeight: 600, fontSize: 12, cursor: hasChildren ? 'pointer' : 'default', borderBottom: '1px solid #e2e8f0', position: 'sticky', left: 0, background: bg, zIndex: 1 }}
            onClick={() => hasChildren && onToggle(node.path)}
          >
            {hasChildren && <span style={{ marginRight: 4 }}>{isCollapsed ? '▶' : '▼'}</span>}
            {node.label}
            <span style={{ marginLeft: 6, color: '#94a3b8', fontSize: 10 }}>({node.items.length})</span>
          </td>
          {fiscalLabels.map((_, mi) => {
            const sums = metrics.map(mk => sumMetric(node.items, mk)[mi])
            return (
              <td key={mi} style={{ padding: '4px 6px', textAlign: 'right', fontSize: 11, borderBottom: '1px solid #e2e8f0', minWidth: 72 }}>
                {sums.map((v, si) => (
                  <div key={si} style={{ color: metricDefs[si]?.color, fontWeight: si === 0 ? 600 : 400 }}>
                    {v.toLocaleString('ru')}
                  </div>
                ))}
              </td>
            )
          })}
          <td style={{ padding: '4px 6px', textAlign: 'right', fontSize: 11, fontWeight: 700, borderBottom: '1px solid #e2e8f0', background: '#f0f9ff', minWidth: 72, position: 'sticky', right: 0 }}>
            {metrics.map((mk, si) => (
              <div key={si} style={{ color: metricDefs[si]?.color }}>
                {sumMetric(node.items, mk).reduce((s, v) => s + v, 0).toLocaleString('ru')}
              </div>
            ))}
          </td>
        </tr>
      )

      // Дочерние узлы
      if (!isCollapsed && hasChildren) {
        rows.push(...renderNodes(node.children))
      }

      // Листовые элементы
      if (!isCollapsed && node.depth === layersLength - 1) {
        for (const r of node.items) {
          rows.push(
            <tr key={node.path + r.code} style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td style={{ padding: '3px 8px', paddingLeft: indent + 32, fontSize: 11, position: 'sticky', left: 0, background: '#fff', zIndex: 1, minWidth: 200 }}>
                <div style={{ wordBreak: 'break-word', whiteSpace: 'normal', lineHeight: 1.4 }}>{r.name}</div>
                <div style={{ fontSize: 9, color: '#94a3b8' }}>{r.code}</div>
              </td>
              <td style={{ padding: '3px 6px', fontSize: 10, minWidth: 60 }}>
                <span style={{
                  background: r.abcClass === 'A' ? '#dcfce7' : r.abcClass === 'B' ? '#fef9c3' : '#fee2e2',
                  color: r.abcClass === 'A' ? '#166534' : r.abcClass === 'B' ? '#854d0e' : '#991b1b',
                  padding: '1px 5px', borderRadius: 8, fontWeight: 700, fontSize: 10
                }}>
                  {r.abcxyz}
                </span>
              </td>
              {fiscalLabels.map((_, mi) => (
                <td key={mi} style={{ padding: '3px 6px', textAlign: 'right', fontSize: 11, minWidth: 72 }}>
                  {metrics.map((mk, si) => (
                    <div key={si} style={{ color: metricDefs[si]?.color, fontWeight: si === 0 ? 600 : 400 }}>
                      {getMetricVals(r, mk, fiscalMonths)[mi].toLocaleString('ru')}
                    </div>
                  ))}
                </td>
              ))}
              <td style={{ padding: '3px 6px', textAlign: 'right', fontSize: 11, fontWeight: 700, background: '#f0f9ff', position: 'sticky', right: 0, minWidth: 72 }}>
                {metrics.map((mk, si) => (
                  <div key={si} style={{ color: metricDefs[si]?.color }}>
                    {getMetricVals(r, mk, fiscalMonths).reduce((s, v) => s + v, 0).toLocaleString('ru')}
                  </div>
                ))}
              </td>
            </tr>
          )
        }
      }
    }

    return rows
  }, [collapsed, fiscalLabels, fiscalMonths, layersLength, metricDefs, metrics, onToggle, sumMetric])

  return <>{renderNodes(nodes)}</>
})
