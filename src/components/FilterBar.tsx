import { memo, useMemo } from 'react'
import type { AnalysisResult } from '../types'

export interface Filters {
  abc: string; xyz: string; cls: string; tmcGroup: string; search: string
}

interface Props {
  filters: Filters
  onFilters: (f: Filters) => void
  results: AnalysisResult[]
  filtered: AnalysisResult[]
}

const BTN_BASE: React.CSSProperties = { padding: '3px 10px', borderRadius: 4, border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', fontSize: 11, cursor: 'pointer' }

export const FilterBar = memo(function FilterBar({ filters, onFilters, results, filtered }: Props) {
  const classes = useMemo(() => [...new Set(results.map(r => r.cls))].sort(), [results])
  const groups  = useMemo(() => [...new Set(results.map(r => r.tmcGroup))].sort(), [results])
  const f = (k: keyof Filters, v: string) => onFilters({ ...filters, [k]: v })

  const isActive = filters.abc !== 'ALL' || filters.xyz !== 'ALL' || filters.cls !== 'ALL' || filters.tmcGroup !== 'ALL' || !!filters.search

  const SEL: React.CSSProperties = { padding: '4px 8px', border: '1px solid #e2e8f0', borderRadius: 4, fontSize: 11, background: '#fff', outline: 'none', color: '#374151' }

  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', padding: '8px 12px', background: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0', marginBottom: 4 }}>
      {/* ABC */}
      <div style={{ display: 'flex', gap: 2 }}>
        {['ALL', 'A', 'B', 'C'].map(v => (
          <button key={v} onClick={() => f('abc', v)} style={{ ...BTN_BASE, borderColor: filters.abc === v ? '#1e40af' : '#e2e8f0', background: filters.abc === v ? '#1e40af' : '#fff', color: filters.abc === v ? '#fff' : '#64748b', fontWeight: filters.abc === v ? 600 : 400 }}>
            {v === 'ALL' ? 'Все ABC' : v}
          </button>
        ))}
      </div>

      {/* XYZ */}
      <div style={{ display: 'flex', gap: 2 }}>
        {['ALL', 'X', 'Y', 'Z'].map(v => (
          <button key={v} onClick={() => f('xyz', v)} style={{ ...BTN_BASE, borderColor: filters.xyz === v ? '#7c3aed' : '#e2e8f0', background: filters.xyz === v ? '#7c3aed' : '#fff', color: filters.xyz === v ? '#fff' : '#64748b', fontWeight: filters.xyz === v ? 600 : 400 }}>
            {v === 'ALL' ? 'Все XYZ' : v}
          </button>
        ))}
      </div>

      <select value={filters.cls} onChange={e => f('cls', e.target.value)} style={SEL}>
        <option value="ALL">Все классы</option>
        {classes.map(c => <option key={c} value={c}>{c}</option>)}
      </select>

      <select value={filters.tmcGroup} onChange={e => f('tmcGroup', e.target.value)} style={SEL}>
        <option value="ALL">Все группы</option>
        {groups.map(g => <option key={g} value={g}>{g}</option>)}
      </select>

      <input value={filters.search} onChange={e => f('search', e.target.value)} placeholder="Поиск..." style={{ ...SEL, width: 140 }} />

      {isActive && (
        <button onClick={() => onFilters({ abc: 'ALL', xyz: 'ALL', cls: 'ALL', tmcGroup: 'ALL', search: '' })} style={{ ...BTN_BASE, color: '#ef4444', borderColor: '#fecaca' }}>
          × Сброс
        </button>
      )}

      <span style={{ marginLeft: 'auto', fontSize: 11, color: '#94a3b8' }}>{filtered.length} / {results.length}</span>
    </div>
  )
})
