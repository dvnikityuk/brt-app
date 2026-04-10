// ═══════════════════════════════════════════════════════════════════════════
// CatalogTab Component - Оптимизированная вкладка справочника
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useMemo, useCallback, memo } from 'react'
import type { CatalogItem, AnalysisResult } from '../types'

// ─── Типы ────────────────────────────────────────────────────────────────────
type SortKey = 'cls' | 'tmcGroup' | 'code' | 'name' | 'inResults' | 'abcxyz' | 'avgDemand' | 'annualDemand'
type SortDir = 'asc' | 'desc'

interface Props {
  catalog: CatalogItem[]
  catalogWarnings?: string[]
  results: AnalysisResult[]
  onDeleteCatalog: () => void
}

interface CatalogRow {
  code: string
  name: string
  cls: string
  tmcGroup: string
  inResults: boolean
  abcClass: string
  xyzClass: string
  abcxyz: string
  avgDemand: number
  annualDemand: number
}

// ─── Стили ───────────────────────────────────────────────────────────────────
const styles = {
  toolbar: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
    flexWrap: 'wrap' as const,
  },
  searchInput: {
    padding: '6px 10px',
    border: '1px solid #e2e8f0',
    borderRadius: 8,
    fontSize: 12,
    width: 300,
  },
  tableContainer: {
    overflowX: 'auto' as const,
    border: '1px solid #e2e8f0',
    borderRadius: 8,
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    fontSize: 11,
  },
  deleteBtn: {
    padding: '5px 12px',
    background: '#fef2f2',
    color: '#dc2626',
    border: '1px solid #fecaca',
    borderRadius: 8,
    cursor: 'pointer',
    fontSize: 11,
  },
}

// ─── Компонент ───────────────────────────────────────────────────────────────
export const CatalogTab = memo(function CatalogTab({
  catalog,
  results,
  onDeleteCatalog,
}: Props) {
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('cls')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const toggle = useCallback((key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }, [sortKey])

  const arrow = useCallback((key: SortKey) => 
    sortKey === key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : '',
    [sortKey, sortDir]
  )

  // Построение строк с данными анализа
  const rows = useMemo((): CatalogRow[] => {
    const resultMap = new Map(results.map(r => [r.code, r]))
    return catalog.map(c => {
      const r = resultMap.get(c.code)
      return {
        code: c.code,
        name: c.name,
        cls: c.cls,
        tmcGroup: c.tmcGroup,
        inResults: !!r,
        abcClass: r?.abcClass ?? '',
        xyzClass: r?.xyzClass ?? '',
        abcxyz: r?.abcxyz ?? '',
        avgDemand: r ? Math.round(r.avgDemand) : -1,
        annualDemand: r?.annualDemand ?? 0,
      }
    })
  }, [catalog, results])

  // Фильтрация и сортировка
  const sorted = useMemo(() => {
    const q = search.toLowerCase()
    const filtered = q
      ? rows.filter(r =>
          r.code.toLowerCase().includes(q) ||
          r.name.toLowerCase().includes(q) ||
          r.cls.toLowerCase().includes(q) ||
          r.tmcGroup.toLowerCase().includes(q)
        )
      : rows

    return [...filtered].sort((a, b) => {
      const av = a[sortKey]
      const bv = b[sortKey]
      const cmp = typeof av === 'number' && typeof bv === 'number'
        ? av - bv
        : String(av ?? '').localeCompare(String(bv ?? ''), 'ru')
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [rows, search, sortKey, sortDir])

  // Статистика
  const stats = useMemo(() => ({
    classes: new Set(catalog.map(c => c.cls)).size,
    groups: new Set(catalog.map(c => c.tmcGroup)).size,
    inResults: rows.filter(r => r.inResults).length,
    noData: rows.filter(r => !r.inResults).length,
  }), [catalog, rows])

  // Пустое состояние
  if (!catalog.length) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
        Справочник ТМЦ не загружен.<br/>
        <span style={{ fontSize: 11 }}>
          Загрузите файл на вкладке «Загрузка» (колонки: Код, ТМЦ, Класс, ТМЦ общее)
        </span>
      </div>
    )
  }

  // Функция рендера заголовка
  const th = (key: SortKey, label: string, align: 'left' | 'right' | 'center' = 'left', minW?: number) => (
    <th
      onClick={() => toggle(key)}
      style={{
        padding: '6px 10px',
        textAlign: align,
        borderBottom: '2px solid #e2e8f0',
        fontSize: 11,
        color: sortKey === key ? '#2563eb' : '#475569',
        fontWeight: 600,
        whiteSpace: 'nowrap',
        cursor: 'pointer',
        userSelect: 'none',
        background: sortKey === key ? '#eff6ff' : '#f1f5f9',
        minWidth: minW,
      }}
    >
      {label}{arrow(key)}
    </th>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Toolbar */}
      <div style={styles.toolbar}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Поиск по коду, названию, классу, группе..."
          style={styles.searchInput}
        />
        <span style={{ fontSize: 11, color: '#94a3b8' }}>
          {sorted.length} из {catalog.length}
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 16, fontSize: 11, color: '#64748b', alignItems: 'center' }}>
          <span>Классов: <b>{stats.classes}</b></span>
          <span>Групп: <b>{stats.groups}</b></span>
          <span>В отгрузках: <b style={{ color: '#16a34a' }}>{stats.inResults}</b></span>
          <span>Нет данных: <b style={{ color: '#d97706' }}>{stats.noData}</b></span>
          <button onClick={onDeleteCatalog} style={styles.deleteBtn}>
            Очистить
          </button>
        </div>
      </div>

      {/* Table */}
      <div style={styles.tableContainer}>
        <table style={styles.table}>
          <thead style={{ position: 'sticky', top: 0, zIndex: 5 }}>
            <tr>
              {th('cls', 'Класс')}
              {th('tmcGroup', 'ТМЦ общее')}
              {th('code', 'Код')}
              {th('name', 'Наименование', 'left', 220)}
              {th('inResults', 'В отгрузках', 'center')}
              {th('abcxyz', 'ABC-XYZ', 'center')}
              {th('avgDemand', 'Ср. спрос/мес', 'right')}
              {th('annualDemand', 'Год. спрос', 'right')}
            </tr>
          </thead>
          <tbody>
            {sorted.map(r => {
              const abcBg = r.abcClass === 'A' ? '#f0fdf4' :
                           r.abcClass === 'B' ? '#fffbeb' :
                           r.abcClass === 'C' ? '#fff5f5' : '#f8fafc'
              const abcClr = r.abcClass === 'A' ? '#16a34a' :
                            r.abcClass === 'B' ? '#d97706' :
                            r.abcClass === 'C' ? '#dc2626' : '#94a3b8'
              return (
                <tr
                  key={r.code}
                  style={{
                    borderBottom: '1px solid #f1f5f9',
                    background: r.inResults ? '#fff' : '#fffbeb',
                  }}
                >
                  <td style={{ padding: '5px 10px' }}>{r.cls}</td>
                  <td style={{ padding: '5px 10px' }}>{r.tmcGroup}</td>
                  <td style={{ padding: '5px 10px', fontWeight: 600, color: '#1e40af', whiteSpace: 'nowrap' }}>
                    {r.code}
                  </td>
                  <td style={{ padding: '5px 10px', maxWidth: 260, wordBreak: 'break-word', lineHeight: 1.4 }}>
                    {r.name}
                  </td>
                  <td style={{ padding: '5px 10px', textAlign: 'center' }}>
                    {r.inResults
                      ? <span style={{ color: '#16a34a', fontWeight: 600 }}>да</span>
                      : <span style={{ color: '#d97706' }}>нет</span>}
                  </td>
                  <td style={{ padding: '5px 10px', textAlign: 'center' }}>
                    {r.abcxyz
                      ? <span style={{ background: abcBg, color: abcClr, padding: '2px 7px', borderRadius: 8, fontWeight: 700, fontSize: 10 }}>{r.abcxyz}</span>
                      : <span style={{ color: '#cbd5e1' }}>—</span>}
                  </td>
                  <td style={{ padding: '5px 10px', textAlign: 'right' }}>
                    {r.avgDemand >= 0 ? r.avgDemand.toLocaleString('ru') : '—'}
                  </td>
                  <td style={{ padding: '5px 10px', textAlign: 'right' }}>
                    {r.annualDemand > 0 ? r.annualDemand.toLocaleString('ru') : '—'}
                  </td>
                </tr>
              )
            })}
            {/* Footer */}
            <tr style={{ background: '#f0fdf4', fontWeight: 700, position: 'sticky', bottom: 0 }}>
              <td colSpan={4} style={{ padding: '6px 10px', fontSize: 11 }}>
                Итого ({sorted.length} позиций)
              </td>
              <td style={{ padding: '6px 10px', textAlign: 'center', fontSize: 11, color: '#16a34a' }}>
                {sorted.filter(r => r.inResults).length}
              </td>
              <td />
              <td style={{ padding: '6px 10px', textAlign: 'right', fontSize: 11 }}>
                {sorted.length > 0
                  ? Math.round(
                      sorted.filter(r => r.avgDemand >= 0).reduce((s, r) => s + r.avgDemand, 0) /
                      Math.max(1, sorted.filter(r => r.avgDemand >= 0).length)
                    ).toLocaleString('ru')
                  : '—'}
              </td>
              <td style={{ padding: '6px 10px', textAlign: 'right', fontSize: 11 }}>
                {sorted.reduce((s, r) => s + r.annualDemand, 0).toLocaleString('ru')}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
})
