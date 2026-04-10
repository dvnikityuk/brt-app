// ═══════════════════════════════════════════════════════════════════════════
// VirtualTable - Виртуализированная таблица для больших данных
// ═══════════════════════════════════════════════════════════════════════════

import React, { useRef, useMemo, useCallback, memo } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VColumn<T> {
  key: string
  header: string
  width?: number
  minWidth?: number
  align?: 'left' | 'right' | 'center'
  render: (item: T, index: number) => React.ReactNode
  sortValue?: (item: T) => number | string
  total?: (items: T[]) => React.ReactNode
}

interface VirtualTableProps<T> {
  items: T[]
  columns: VColumn<T>[]
  rowKey: (item: T) => string
  rowHeight?: number
  maxHeight?: number
  onRowClick?: (item: T) => void
  selectedKey?: string
  showTotal?: boolean
  emptyMessage?: string
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = {
  container: {
    border: '1px solid #e2e8f0',
    borderRadius: 8,
    overflow: 'hidden',
    background: '#fff',
  },
  headerRow: {
    display: 'flex',
    background: '#f8fafc',
    borderBottom: '2px solid #e2e8f0',
    position: 'sticky' as const,
    top: 0,
    zIndex: 10,
  },
  headerCell: {
    padding: '8px 10px',
    fontSize: 11,
    fontWeight: 600,
    color: '#475569',
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    cursor: 'pointer',
    userSelect: 'none' as const,
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  row: {
    display: 'flex',
    borderBottom: '1px solid #f1f5f9',
    transition: 'background 0.1s',
  },
  cell: {
    padding: '6px 10px',
    fontSize: 11,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  totalRow: {
    display: 'flex',
    background: '#f0fdf4',
    borderTop: '2px solid #86efac',
    position: 'sticky' as const,
    bottom: 0,
    zIndex: 5,
  },
  totalCell: {
    padding: '8px 10px',
    fontSize: 11,
    fontWeight: 700,
    color: '#166534',
  },
}

// ─── Component ────────────────────────────────────────────────────────────────

function VirtualTableInner<T>({
  items,
  columns,
  rowKey,
  rowHeight = 36,
  maxHeight = 500,
  onRowClick,
  selectedKey,
  showTotal = false,
  emptyMessage = 'Нет данных',
}: VirtualTableProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null)

  // Virtualizer
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 10,
  })

  const virtualItems = virtualizer.getVirtualItems()
  const totalSize = virtualizer.getTotalSize()

  // Column widths
  const columnWidths = useMemo(() => {
    const total = columns.reduce((sum, col) => sum + (col.width || col.minWidth || 100), 0)
    return columns.map(col => {
      const w = col.width || col.minWidth || 100
      return `${(w / total) * 100}%`
    })
  }, [columns])

  // Row click handler
  const handleRowClick = useCallback((item: T) => {
    onRowClick?.(item)
  }, [onRowClick])

  if (!items.length) {
    return (
      <div style={{ ...styles.container, padding: 24, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
        {emptyMessage}
      </div>
    )
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.headerRow}>
        {columns.map((col, ci) => (
          <div
            key={col.key}
            style={{
              ...styles.headerCell,
              width: columnWidths[ci],
              minWidth: col.minWidth,
              justifyContent: col.align === 'right' ? 'flex-end' : col.align === 'center' ? 'center' : 'flex-start',
            }}
          >
            {col.header}
          </div>
        ))}
      </div>

      {/* Virtualized body */}
      <div
        ref={parentRef}
        style={{
          height: Math.min(maxHeight, totalSize + 2),
          overflow: 'auto',
        }}
      >
        <div
          style={{
            height: totalSize,
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualItems.map(virtualRow => {
            const item = items[virtualRow.index]
            const key = rowKey(item)
            const isSelected = selectedKey === key

            return (
              <div
                key={key}
                style={{
                  ...styles.row,
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: rowHeight,
                  transform: `translateY(${virtualRow.start}px)`,
                  background: isSelected ? '#eff6ff' : undefined,
                  cursor: onRowClick ? 'pointer' : 'default',
                }}
                onClick={() => handleRowClick(item)}
              >
                {columns.map((col, ci) => (
                  <div
                    key={col.key}
                    style={{
                      ...styles.cell,
                      width: columnWidths[ci],
                      minWidth: col.minWidth,
                      textAlign: col.align || 'left',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: col.align === 'right' ? 'flex-end' : col.align === 'center' ? 'center' : 'flex-start',
                    }}
                  >
                    {col.render(item, virtualRow.index)}
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      </div>

      {/* Total row */}
      {showTotal && columns.some(c => c.total) && (
        <div style={styles.totalRow}>
          {columns.map((col, ci) => (
            <div
              key={col.key}
              style={{
                ...styles.totalCell,
                width: columnWidths[ci],
                minWidth: col.minWidth,
                textAlign: col.align || 'left',
              }}
            >
              {ci === 0 ? `Итого (${items.length})` : col.total?.(items)}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export const VirtualTable = memo(VirtualTableInner) as typeof VirtualTableInner
