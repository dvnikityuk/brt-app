/**
 * PivotControls — панель управления сводной таблицей
 * Слои группировки, выбор показателей, режим отображения
 * ~100 строк
 */
import { memo, useCallback } from 'react'
import type { PivotConfig } from '../../store/useAppStore'
import { ALL_METRICS, ALL_LAYERS } from '../../constants'
import type { PivotLayer, MetricKey } from '../../types'

interface TreeNode {
  path: string
  children: TreeNode[]
}

interface Props {
  config: PivotConfig
  onConfig: (c: PivotConfig) => void
  tree: TreeNode[]
}

export const PivotControls = memo(function PivotControls({ config, onConfig, tree }: Props) {
  const { layers, metrics, compareMode } = config

  const moveLayer = useCallback((idx: number, dir: -1 | 1) => {
    const nl = [...layers]
    const t = idx + dir
    if (t < 0 || t >= nl.length) return
    ;[nl[idx], nl[t]] = [nl[t], nl[idx]]
    onConfig({ ...config, layers: nl })
  }, [config, layers, onConfig])

  const toggleLayer = useCallback((layer: PivotLayer) => {
    const ex = layers.find(l => l.key === layer.key)
    if (ex) {
      if (layers.length === 1) return
      onConfig({ ...config, layers: layers.filter(l => l.key !== layer.key) })
    } else {
      onConfig({ ...config, layers: [...layers, layer] })
    }
  }, [config, layers, onConfig])

  const toggleMetric = useCallback((mk: MetricKey) => {
    const ex = metrics.includes(mk)
    if (ex && metrics.length === 1) return
    onConfig({ ...config, metrics: ex ? metrics.filter(m => m !== mk) : [...metrics, mk] })
  }, [config, metrics, onConfig])

  const collapseAll = useCallback(() => {
    const all: Record<string, boolean> = {}
    const col = (ns: TreeNode[]) => ns.forEach(n => {
      if (n.children.length) { all[n.path] = true; col(n.children) }
    })
    col(tree)
    onConfig({ ...config, collapsed: all })
  }, [config, onConfig, tree])

  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
      {/* Слои */}
      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 12px', minWidth: 220 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 6 }}>Слои группировки</div>
        {layers.map((l, idx) => (
          <div key={l.key} style={{ display: 'flex', alignItems: 'center', gap: 3, background: '#e0f2fe', borderRadius: 6, padding: '3px 6px', marginBottom: 3 }}>
            <button onClick={() => moveLayer(idx, -1)} disabled={idx === 0}
              style={{ border: 'none', background: 'none', cursor: idx === 0 ? 'default' : 'pointer', color: idx === 0 ? '#cbd5e1' : '#3b82f6', fontSize: 11, padding: '0 2px' }}>▲</button>
            <button onClick={() => moveLayer(idx, 1)} disabled={idx === layers.length - 1}
              style={{ border: 'none', background: 'none', cursor: idx === layers.length - 1 ? 'default' : 'pointer', color: idx === layers.length - 1 ? '#cbd5e1' : '#3b82f6', fontSize: 11, padding: '0 2px' }}>▼</button>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#1e40af', flex: 1 }}>{l.label}</span>
            <button onClick={() => toggleLayer(l as PivotLayer)}
              style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 11 }}>✕</button>
          </div>
        ))}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 4 }}>
          {ALL_LAYERS.filter(l => !layers.find(a => a.key === l.key)).map(l => (
            <button key={l.key} onClick={() => toggleLayer(l)}
              style={{ fontSize: 10, padding: '2px 7px', border: '1px dashed #cbd5e1', borderRadius: 10, background: '#fff', cursor: 'pointer', color: '#64748b' }}>
              + {l.label}
            </button>
          ))}
        </div>
      </div>

      {/* Показатели */}
      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 12px', minWidth: 200 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 6 }}>Показатели</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
          {ALL_METRICS.map(m => {
            const active = metrics.includes(m.key)
            return (
              <button key={m.key} onClick={() => toggleMetric(m.key)}
                style={{ fontSize: 10, padding: '3px 8px', border: `1px solid ${active ? m.color : '#e2e8f0'}`, borderRadius: 10, background: active ? m.color + '20' : '#fff', cursor: 'pointer', color: active ? m.color : '#64748b', fontWeight: active ? 700 : 400 }}>
                {m.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Режим */}
      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 12px' }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 6 }}>Режим</div>
        <div style={{ display: 'flex', gap: 4 }}>
          {([['side', 'Строками'], ['month', 'По месяцам']] as const).map(([v, l]) => (
            <button key={v} onClick={() => onConfig({ ...config, compareMode: v })}
              style={{ fontSize: 11, padding: '4px 8px', border: `1px solid ${compareMode === v ? '#3b82f6' : '#e2e8f0'}`, borderRadius: 8, background: compareMode === v ? '#eff6ff' : '#fff', cursor: 'pointer', color: compareMode === v ? '#1d4ed8' : '#64748b', fontWeight: compareMode === v ? 700 : 400 }}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Раскрыть/Свернуть */}
      <div style={{ display: 'flex', gap: 4, alignSelf: 'flex-end' }}>
        <button onClick={() => onConfig({ ...config, collapsed: {} })}
          style={{ fontSize: 11, padding: '4px 8px', border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff', cursor: 'pointer', color: '#64748b' }}>
          ▼ Раскрыть
        </button>
        <button onClick={collapseAll}
          style={{ fontSize: 11, padding: '4px 8px', border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff', cursor: 'pointer', color: '#64748b' }}>
          ▶ Свернуть
        </button>
      </div>
    </div>
  )
})
