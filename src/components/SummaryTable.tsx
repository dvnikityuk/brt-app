// ═══════════════════════════════════════════════════════════════════════════
// SummaryTable — Сводная таблица с группировкой и авто-виртуализацией
//
// Логика выбора режима рендера:
//   items.length > VIRTUAL_THRESHOLD → VirtualList для плоских строк
//   items.length <= VIRTUAL_THRESHOLD → обычный DOM (полная группировка)
//
// Виртуализация подключена через @tanstack/react-virtual
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState, useMemo, useCallback, useRef, memo } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'

// ─── Порог переключения на виртуализацию ────────────────────────────────────
const VIRTUAL_THRESHOLD = 100

// ─── Типы ────────────────────────────────────────────────────────────────────
export interface SColumn<T> {
  key: string
  header: string
  render: (item: T) => React.ReactNode
  sortValue?: (item: T) => number | string
  align?: 'left' | 'right' | 'center'
  minWidth?: number
  total?: (items: T[]) => React.ReactNode
  aggregate?: (items: T[]) => React.ReactNode
  aggregateSortValue?: (items: T[]) => number
}

interface Props<T> {
  items: T[]
  columns: SColumn<T>[]
  groupKey1: (item: T) => string
  groupKey2: (item: T) => string
  rowKey: (item: T) => string
  onRowClick?: (item: T) => void
  selectedKey?: string
  label1?: string
  label2?: string
}

interface GroupNode<T> {
  key: string
  children: { key: string; items: T[] }[]
  allItems: T[]
}

// ─── Виртуализированный плоский список (для больших данных) ─────────────────
interface FlatRow<T> {
  type: 'g1' | 'g2' | 'item' | 'total1' | 'total2' | 'grand'
  key: string
  item?: T
  g1Key?: string
  g2Key?: string
  g1Items?: T[]
  g2Items?: T[]
  allItems?: T[]
  depth?: number
}

function buildFlatRows<T>(
  groups: GroupNode<T>[],
  collapsed: Record<string, boolean>,
  sortItems: (list: T[]) => T[],
  hasTotals: boolean,
  items: T[]
): FlatRow<T>[] {
  const rows: FlatRow<T>[] = []

  for (const g1 of groups) {
    const g1Collapsed = collapsed[g1.key]

    rows.push({
      type: 'g1',
      key: 'g1_' + g1.key,
      g1Key: g1.key,
      g1Items: g1.allItems,
    })

    if (!g1Collapsed) {
      for (const g2 of g1.children) {
        const g2Key = g1.key + '|' + g2.key
        const g2Collapsed = collapsed[g2Key]

        rows.push({
          type: 'g2',
          key: 'g2_' + g2Key,
          g1Key: g1.key,
          g2Key,
          g2Items: g2.items,
        })

        if (!g2Collapsed) {
          for (const item of sortItems(g2.items)) {
            rows.push({ type: 'item', key: 'item_' + g2Key, item, g2Key })
          }

          if (hasTotals) {
            rows.push({
              type: 'total2',
              key: 'total2_' + g2Key,
              g2Key,
              g2Items: g2.items,
            })
          }
        }
      }

      if (hasTotals) {
        rows.push({
          type: 'total1',
          key: 'total1_' + g1.key,
          g1Key: g1.key,
          g1Items: g1.allItems,
        })
      }
    }
  }

  if (hasTotals) {
    rows.push({ type: 'grand', key: 'grand', allItems: items })
  }

  return rows
}

// ─── Виртуальный тело таблицы ────────────────────────────────────────────────
function VirtualBody<T>({
  flatRows,
  columns,
  collapsed,
  toggleCollapse,
  onRowClick,
  selectedKey,
  rowKey,
  label1,
  label2,
  hasAggregates,
}: {
  flatRows: FlatRow<T>[]
  columns: SColumn<T>[]
  collapsed: Record<string, boolean>
  toggleCollapse: (key: string) => void
  onRowClick?: (item: T) => void
  selectedKey?: string
  rowKey: (item: T) => string
  label1?: string
  label2?: string
  hasAggregates: boolean
}) {
  const parentRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: flatRows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 32,
    overscan: 15,
  })

  const virtualItems = virtualizer.getVirtualItems()

  return (
    <div
      ref={parentRef}
      style={{ height: Math.min(600, virtualizer.getTotalSize() + 2), overflow: 'auto' }}
    >
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
        {virtualItems.map(vRow => {
          const row = flatRows[vRow.index]
          let content: React.ReactNode = null

          if (row.type === 'g1') {
            const isCollapsed = collapsed[row.g1Key!]
            content = (
              <tr
                onClick={() => toggleCollapse(row.g1Key!)}
                style={{ background: '#f1f5f9', cursor: 'pointer', display: 'table', width: '100%', tableLayout: 'fixed' }}
              >
                {isCollapsed && hasAggregates ? (
                  columns.map((col, ci) => (
                    <td key={col.key} style={{ padding: '5px 8px', fontSize: ci === 0 ? 11 : 10, fontWeight: ci === 0 ? 700 : 600, color: ci === 0 ? '#374151' : '#4338ca', textAlign: col.align || 'left' }}>
                      {ci === 0 ? (<><span style={{ marginRight: 6 }}>▶</span>{label1 ? `${label1}: ` : ''}{row.g1Key} <span style={{ color: '#94a3b8', fontWeight: 400, fontSize: 10 }}>({row.g1Items?.length})</span></>) : (col.aggregate ? col.aggregate(row.g1Items!) : '')}
                    </td>
                  ))
                ) : (
                  <td colSpan={columns.length} style={{ padding: '5px 10px', fontWeight: 700, fontSize: 11, color: '#374151' }}>
                    <span style={{ marginRight: 6 }}>{isCollapsed ? '▶' : '▼'}</span>
                    {label1 ? `${label1}: ` : ''}{row.g1Key}
                    <span style={{ marginLeft: 8, color: '#94a3b8', fontWeight: 400, fontSize: 10 }}>({row.g1Items?.length})</span>
                  </td>
                )}
              </tr>
            )
          } else if (row.type === 'g2') {
            const isCollapsed = collapsed[row.g2Key!]
            content = (
              <tr
                onClick={() => toggleCollapse(row.g2Key!)}
                style={{ background: '#f8fafc', cursor: 'pointer', display: 'table', width: '100%', tableLayout: 'fixed' }}
              >
                {isCollapsed && hasAggregates ? (
                  columns.map((col, ci) => (
                    <td key={col.key} style={{ padding: '4px 8px', paddingLeft: ci === 0 ? 24 : 8, fontSize: 10, fontWeight: ci === 0 ? 600 : 500, color: ci === 0 ? '#64748b' : '#6d28d9', textAlign: col.align || 'left' }}>
                      {ci === 0 ? (<><span style={{ marginRight: 6 }}>▶</span>{label2 ? `${label2}: ` : ''}{row.g2Key?.split('|')[1]} <span style={{ color: '#94a3b8', fontWeight: 400 }}>({row.g2Items?.length})</span></>) : (col.aggregate ? col.aggregate(row.g2Items!) : '')}
                    </td>
                  ))
                ) : (
                  <td colSpan={columns.length} style={{ padding: '4px 10px', paddingLeft: 24, fontWeight: 600, fontSize: 10, color: '#64748b' }}>
                    <span style={{ marginRight: 6 }}>{isCollapsed ? '▶' : '▼'}</span>
                    {label2 ? `${label2}: ` : ''}{row.g2Key?.split('|')[1]}
                    <span style={{ marginLeft: 6, color: '#94a3b8', fontWeight: 400 }}>({row.g2Items?.length})</span>
                  </td>
                )}
              </tr>
            )
          } else if (row.type === 'item' && row.item) {
            const key = rowKey(row.item)
            const isSelected = selectedKey === key
            content = (
              <tr
                onClick={() => onRowClick?.(row.item!)}
                style={{ borderBottom: '1px solid #f1f5f9', cursor: onRowClick ? 'pointer' : 'default', background: isSelected ? '#eff6ff' : '#fff', display: 'table', width: '100%', tableLayout: 'fixed' }}
              >
                {columns.map(col => (
                  <td key={col.key} style={{ padding: '4px 8px', textAlign: col.align || 'left', fontSize: 10, minWidth: col.minWidth }}>
                    {col.render(row.item!)}
                  </td>
                ))}
              </tr>
            )
          } else if (row.type === 'total2') {
            content = (
              <tr style={{ background: '#f0fdf4', borderBottom: '1px solid #e2e8f0', display: 'table', width: '100%', tableLayout: 'fixed' }}>
                {columns.map((col, ci) => (
                  <td key={col.key} style={{ padding: '3px 8px', textAlign: col.align || 'left', fontSize: 10, fontWeight: 600, color: '#16a34a' }}>
                    {ci === 0 ? `Итого ${row.g2Key?.split('|')[1]}` : col.total ? col.total(row.g2Items!) : ''}
                  </td>
                ))}
              </tr>
            )
          } else if (row.type === 'total1') {
            content = (
              <tr style={{ background: '#e0f2fe', borderBottom: '2px solid #bae6fd', display: 'table', width: '100%', tableLayout: 'fixed' }}>
                {columns.map((col, ci) => (
                  <td key={col.key} style={{ padding: '4px 8px', textAlign: col.align || 'left', fontSize: 10, fontWeight: 700, color: '#0369a1' }}>
                    {ci === 0 ? `Итого ${row.g1Key}` : col.total ? col.total(row.g1Items!) : ''}
                  </td>
                ))}
              </tr>
            )
          } else if (row.type === 'grand') {
            content = (
              <tr style={{ background: '#f0fdf4', fontWeight: 700, display: 'table', width: '100%', tableLayout: 'fixed' }}>
                {columns.map((col, ci) => (
                  <td key={col.key} style={{ padding: '6px 8px', textAlign: col.align || 'left', fontSize: 11, fontWeight: 700, background: '#f0fdf4', borderTop: '2px solid #86efac' }}>
                    {ci === 0 ? `ИТОГО (${row.allItems?.length})` : col.total ? col.total(row.allItems!) : ''}
                  </td>
                ))}
              </tr>
            )
          }

          return (
            <div
              key={row.key}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${vRow.start}px)`,
              }}
            >
              <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                <tbody>{content}</tbody>
              </table>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Основной компонент ───────────────────────────────────────────────────────
function SummaryTableInner<T>({
  items,
  columns,
  groupKey1,
  groupKey2,
  rowKey,
  onRowClick,
  selectedKey,
  label1,
  label2,
}: Props<T>) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [sortCol, setSortCol] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const toggleCollapse = useCallback((key: string) => {
    setCollapsed(prev => ({ ...prev, [key]: !prev[key] }))
  }, [])

  const expandAll = useCallback(() => setCollapsed({}), [])

  const handleSort = useCallback((colKey: string) => {
    setSortCol(prev => {
      if (prev === colKey) {
        setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
        return prev
      }
      setSortDir('asc')
      return colKey
    })
  }, [])

  // Построение дерева групп с сортировкой
  const groups = useMemo((): GroupNode<T>[] => {
    const g1Map: Record<string, Record<string, T[]>> = {}
    for (const item of items) {
      const k1 = groupKey1(item)
      const k2 = groupKey2(item)
      if (!g1Map[k1]) g1Map[k1] = {}
      if (!g1Map[k1][k2]) g1Map[k1][k2] = []
      g1Map[k1][k2].push(item)
    }

    let result = Object.keys(g1Map)
      .sort()
      .map(k1 => ({
        key: k1,
        allItems: Object.values(g1Map[k1]).flat(),
        children: Object.keys(g1Map[k1])
          .sort()
          .map(k2 => ({ key: k2, items: g1Map[k1][k2] })),
      }))

    if (sortCol) {
      const col = columns.find(c => c.key === sortCol)
      if (col?.aggregateSortValue) {
        result = [...result].sort((a, b) => {
          const va = col.aggregateSortValue!(a.allItems)
          const vb = col.aggregateSortValue!(b.allItems)
          return sortDir === 'asc' ? va - vb : vb - va
        })
        result = result.map(g1 => ({
          ...g1,
          children: [...g1.children].sort((a, b) => {
            const va = col.aggregateSortValue!(a.items)
            const vb = col.aggregateSortValue!(b.items)
            return sortDir === 'asc' ? va - vb : vb - va
          }),
        }))
      }
    }

    return result
  }, [items, groupKey1, groupKey2, sortCol, sortDir, columns])

  const collapseAll = useCallback(() => {
    const all: Record<string, boolean> = {}
    for (const g of groups) {
      all[g.key] = true
      for (const c of g.children) all[g.key + '|' + c.key] = true
    }
    setCollapsed(all)
  }, [groups])

  const sortItems = useCallback(
    (list: T[]): T[] => {
      if (!sortCol) return list
      const col = columns.find(c => c.key === sortCol)
      if (!col?.sortValue) return list
      const sorted = [...list].sort((a, b) => {
        const va = col.sortValue!(a)
        const vb = col.sortValue!(b)
        if (typeof va === 'number' && typeof vb === 'number') return va - vb
        return String(va).localeCompare(String(vb), 'ru')
      })
      return sortDir === 'desc' ? sorted.reverse() : sorted
    },
    [sortCol, sortDir, columns]
  )

  const hasAggregates = columns.some(c => c.aggregate)
  const hasTotals = columns.some(c => c.total)

  // Используем виртуализацию когда строк > VIRTUAL_THRESHOLD
  const useVirtual = items.length > VIRTUAL_THRESHOLD

  // Для виртуализации строим плоский список
  const flatRows = useMemo(() => {
    if (!useVirtual) return []
    return buildFlatRows(groups, collapsed, sortItems, hasTotals, items)
  }, [useVirtual, groups, collapsed, sortItems, hasTotals, items])

  // Для обычного режима рендерим DOM напрямую
  const renderRows = useMemo(() => {
    if (useVirtual) return []
    const rows: React.ReactNode[] = []

    for (const g1 of groups) {
      const g1Collapsed = collapsed[g1.key]

      if (g1Collapsed && hasAggregates) {
        rows.push(
          <tr key={'g1_' + g1.key} onClick={() => toggleCollapse(g1.key)} style={{ background: '#eef2ff', cursor: 'pointer', borderBottom: '1px solid #c7d2fe' }}>
            {columns.map((col, ci) => (
              <td key={col.key} style={{ padding: '5px 8px', textAlign: col.align || 'left', fontSize: ci === 0 ? 11 : 10, fontWeight: ci === 0 ? 700 : 600, color: ci === 0 ? '#374151' : '#4338ca' }}>
                {ci === 0 ? (<><span style={{ marginRight: 6, fontSize: 10 }}>▶</span>{label1 ? `${label1}: ` : ''}{g1.key}<span style={{ marginLeft: 8, color: '#94a3b8', fontWeight: 400, fontSize: 10 }}>({g1.allItems.length})</span></>) : (col.aggregate ? col.aggregate(g1.allItems) : '')}
              </td>
            ))}
          </tr>
        )
      } else {
        rows.push(
          <tr key={'g1_' + g1.key} onClick={() => toggleCollapse(g1.key)} style={{ background: '#f1f5f9', cursor: 'pointer' }}>
            <td colSpan={columns.length} style={{ padding: '5px 10px', fontWeight: 700, fontSize: 11, color: '#374151' }}>
              <span style={{ marginRight: 6, fontSize: 10 }}>{g1Collapsed ? '▶' : '▼'}</span>
              {label1 ? `${label1}: ` : ''}{g1.key}
              <span style={{ marginLeft: 8, color: '#94a3b8', fontWeight: 400, fontSize: 10 }}>({g1.allItems.length})</span>
            </td>
          </tr>
        )
      }

      if (!g1Collapsed) {
        for (const g2 of g1.children) {
          const g2Key = g1.key + '|' + g2.key
          const g2Collapsed = collapsed[g2Key]

          if (g2Collapsed && hasAggregates) {
            rows.push(
              <tr key={'g2_' + g2Key} onClick={() => toggleCollapse(g2Key)} style={{ background: '#f5f3ff', cursor: 'pointer', borderBottom: '1px solid #e9e5ff' }}>
                {columns.map((col, ci) => (
                  <td key={col.key} style={{ padding: '4px 8px', paddingLeft: ci === 0 ? 24 : 8, textAlign: col.align || 'left', fontSize: 10, fontWeight: ci === 0 ? 600 : 500, color: ci === 0 ? '#64748b' : '#6d28d9' }}>
                    {ci === 0 ? (<><span style={{ marginRight: 6, fontSize: 9 }}>▶</span>{label2 ? `${label2}: ` : ''}{g2.key}<span style={{ marginLeft: 6, color: '#94a3b8', fontWeight: 400 }}>({g2.items.length})</span></>) : (col.aggregate ? col.aggregate(g2.items) : '')}
                  </td>
                ))}
              </tr>
            )
          } else {
            rows.push(
              <tr key={'g2_' + g2Key} onClick={() => toggleCollapse(g2Key)} style={{ background: '#f8fafc', cursor: 'pointer' }}>
                <td colSpan={columns.length} style={{ padding: '4px 10px', paddingLeft: 24, fontWeight: 600, fontSize: 10, color: '#64748b' }}>
                  <span style={{ marginRight: 6, fontSize: 9 }}>{g2Collapsed ? '▶' : '▼'}</span>
                  {label2 ? `${label2}: ` : ''}{g2.key}
                  <span style={{ marginLeft: 6, color: '#94a3b8', fontWeight: 400 }}>({g2.items.length})</span>
                </td>
              </tr>
            )
          }

          if (!g2Collapsed) {
            for (const item of sortItems(g2.items)) {
              const key = rowKey(item)
              const isSelected = selectedKey === key
              rows.push(
                <tr key={key} onClick={() => onRowClick?.(item)} style={{ borderBottom: '1px solid #f1f5f9', cursor: onRowClick ? 'pointer' : 'default', background: isSelected ? '#eff6ff' : '#fff' }}>
                  {columns.map(col => (
                    <td key={col.key} style={{ padding: '4px 8px', textAlign: col.align || 'left', fontSize: 10, minWidth: col.minWidth }}>
                      {col.render(item)}
                    </td>
                  ))}
                </tr>
              )
            }

            if (hasTotals) {
              rows.push(
                <tr key={'t2_' + g2Key} style={{ background: '#f0fdf4', borderBottom: '1px solid #e2e8f0' }}>
                  {columns.map((col, ci) => (
                    <td key={col.key} style={{ padding: '3px 8px', textAlign: col.align || 'left', fontSize: 10, fontWeight: 600, color: '#16a34a' }}>
                      {ci === 0 ? `Итого ${g2.key}` : col.total ? col.total(g2.items) : ''}
                    </td>
                  ))}
                </tr>
              )
            }
          }
        }

        if (hasTotals) {
          rows.push(
            <tr key={'t1_' + g1.key} style={{ background: '#e0f2fe', borderBottom: '2px solid #bae6fd' }}>
              {columns.map((col, ci) => (
                <td key={col.key} style={{ padding: '4px 8px', textAlign: col.align || 'left', fontSize: 10, fontWeight: 700, color: '#0369a1' }}>
                  {ci === 0 ? `Итого ${g1.key}` : col.total ? col.total(g1.allItems) : ''}
                </td>
              ))}
            </tr>
          )
        }
      }
    }

    return rows
  }, [useVirtual, groups, collapsed, columns, hasAggregates, hasTotals, sortItems, rowKey, selectedKey, onRowClick, toggleCollapse, label1, label2])

  // Заголовок таблицы (общий для обоих режимов)
  const tableHeader = (
    <thead style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 5 }}>
      <tr>
        {columns.map(col => {
          const isSorted = sortCol === col.key
          return (
            <th
              key={col.key}
              onClick={() => col.sortValue && handleSort(col.key)}
              style={{
                padding: '6px 8px',
                textAlign: col.align || 'left',
                borderBottom: '2px solid #e2e8f0',
                fontSize: 10,
                color: isSorted ? '#2563eb' : '#475569',
                fontWeight: 600,
                whiteSpace: 'nowrap',
                cursor: col.sortValue ? 'pointer' : 'default',
                userSelect: 'none',
                minWidth: col.minWidth,
                background: isSorted ? '#eff6ff' : '#f8fafc',
              }}
            >
              {col.header}
              {isSorted ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
            </th>
          )
        })}
      </tr>
    </thead>
  )

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 8, alignItems: 'center' }}>
        <button onClick={expandAll} style={{ fontSize: 11, padding: '3px 10px', border: '1px solid #e2e8f0', borderRadius: 6, background: '#fff', cursor: 'pointer', color: '#64748b' }}>
          ▼ Раскрыть
        </button>
        <button onClick={collapseAll} style={{ fontSize: 11, padding: '3px 10px', border: '1px solid #e2e8f0', borderRadius: 6, background: '#fff', cursor: 'pointer', color: '#64748b' }}>
          ▶ Свернуть
        </button>
        <span style={{ marginLeft: 'auto', fontSize: 10, color: '#94a3b8' }}>
          {items.length} позиций · {groups.length} {label1 || 'групп'}
          {useVirtual && (
            <span style={{ marginLeft: 6, background: '#dbeafe', color: '#1e40af', padding: '1px 6px', borderRadius: 4, fontSize: 9 }}>
              ⚡ Virtual
            </span>
          )}
        </span>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: 8 }}>
        {useVirtual ? (
          // ─── Виртуализированный режим (> 200 строк) ─────────────────────
          <>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              {tableHeader}
            </table>
            <VirtualBody
              flatRows={flatRows}
              columns={columns}
              collapsed={collapsed}
              toggleCollapse={toggleCollapse}
              onRowClick={onRowClick}
              selectedKey={selectedKey}
              rowKey={rowKey}
              label1={label1}
              label2={label2}
              hasAggregates={hasAggregates}
            />
          </>
        ) : (
          // ─── Обычный режим (≤ 200 строк) ────────────────────────────────
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            {tableHeader}
            <tbody>
              {renderRows}
              {hasTotals && (
                <tr style={{ background: '#f0fdf4', fontWeight: 700, position: 'sticky', bottom: 0, zIndex: 4 }}>
                  {columns.map((col, ci) => (
                    <td key={col.key} style={{ padding: '6px 8px', textAlign: col.align || 'left', fontSize: 11, fontWeight: 700, background: '#f0fdf4', borderTop: '2px solid #86efac' }}>
                      {ci === 0 ? `ИТОГО (${items.length})` : col.total ? col.total(items) : ''}
                    </td>
                  ))}
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

export const SummaryTable = memo(SummaryTableInner) as typeof SummaryTableInner
