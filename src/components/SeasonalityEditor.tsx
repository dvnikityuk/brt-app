/**
 * SeasonalityEditor — редактор коэффициентов сезонности
 *
 * onSeasonality вызывается при КАЖДОМ изменении с новым массивом
 * SettingsPage.handleSeasonality получает новый массив и вызывает
 * runAnalysisWithSettings(settings, newSeasonality) — явная передача
 */
import { memo, useCallback } from 'react'
import type { RawRow } from '../types'
import { MONTHS_RU } from '../constants'
import { mean } from '../engine'

interface Props {
  seasonality:    number[]
  onSeasonality:  (s: number[]) => void
  rawData:        RawRow[]
  fiscalStart:    number
}

export const SeasonalityEditor = memo(({ seasonality, onSeasonality, rawData, fiscalStart }: Props) => {
  // Рассчитать коэффициенты из данных отгрузок
  const calcFromData = useCallback(() => {
    if (!rawData.length) return
    const sums   = new Array(12).fill(0) as number[]
    const counts = new Array(12).fill(0) as number[]
    for (const r of rawData) {
      const mo = r.date.getMonth()
      sums[mo]   += r.qty
      counts[mo] += 1
    }
    const avgs  = sums.map((s, i) => counts[i] ? s / counts[i] : 0)
    const total = mean(avgs.filter(v => v > 0)) || 1
    const coefs = avgs.map(v => v > 0 ? Math.round((v / total) * 100) / 100 : 1)
    onSeasonality(coefs)
  }, [rawData, onSeasonality])

  const reset = useCallback(() => {
    onSeasonality(new Array(12).fill(1))
  }, [onSeasonality])

  const boostMonths = useCallback((months: number[]) => {
    const s = [...seasonality]
    months.forEach(m => { s[m] = Math.min(3, +(s[m] * 1.3).toFixed(2)) })
    onSeasonality(s)
  }, [seasonality, onSeasonality])

  // Порядок месяцев по фискальному году
  const fiscal = Array.from({ length: 12 }, (_, i) => (fiscalStart - 1 + i) % 12)
  const max    = Math.max(...seasonality, 1)

  // Обновить один месяц
  const updateMonth = useCallback((mi: number, val: number) => {
    const s = [...seasonality]
    s[mi] = Math.max(0.1, Math.min(3, val))
    console.log('[SeasonalityEditor] updateMonth:', mi, '→', s[mi], '| Новый массив:', JSON.stringify(s))
    onSeasonality(s)
  }, [seasonality, onSeasonality])

  return (
    <div style={{
      background: '#fff',
      border: '1px solid #e2e8f0',
      borderRadius: 8,
      padding: 14,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#1e293b' }}>
          Сезонность
        </span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={calcFromData}
            disabled={!rawData.length}
            style={{
              fontSize: 11, padding: '4px 10px',
              background: rawData.length ? '#2563eb' : '#e2e8f0',
              color: rawData.length ? '#fff' : '#94a3b8',
              border: 'none', borderRadius: 6,
              cursor: rawData.length ? 'pointer' : 'default',
            }}
          >
            Из данных
          </button>
          <button onClick={reset} style={{ fontSize: 11, padding: '4px 10px', background: '#f1f5f9', color: '#374151', border: '1px solid #e2e8f0', borderRadius: 6, cursor: 'pointer' }}>
            Сброс
          </button>
          <button onClick={() => boostMonths([5, 6, 7])} style={{ fontSize: 11, padding: '4px 10px', background: '#fefce8', color: '#92400e', border: '1px solid #fcd34d', borderRadius: 6, cursor: 'pointer' }}>
            Лето +
          </button>
          <button onClick={() => boostMonths([11, 0, 1])} style={{ fontSize: 11, padding: '4px 10px', background: '#eff6ff', color: '#1e40af', border: '1px solid #bfdbfe', borderRadius: 6, cursor: 'pointer' }}>
            Зима +
          </button>
        </div>
      </div>

      {/* Визуальные бары */}
      <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: 52, marginBottom: 10 }}>
        {fiscal.map(mi => {
          const v = seasonality[mi] ?? 1
          const h = Math.round((v / max) * 44)
          const color = v > 1.05 ? '#10b981' : v < 0.95 ? '#f59e0b' : '#3b82f6'
          return (
            <div key={mi} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <span style={{ fontSize: 8, color: '#94a3b8', lineHeight: 1 }}>{v.toFixed(2)}</span>
              <div style={{ width: '100%', height: h, background: color, borderRadius: 2, minHeight: 2 }} />
            </div>
          )
        })}
      </div>

      {/* Inputs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 3 }}>
        {fiscal.map(mi => (
          <div key={mi} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
            <span style={{ fontSize: 9, color: '#94a3b8' }}>{MONTHS_RU[mi]}</span>
            <input
              type="number"
              value={seasonality[mi] ?? 1}
              min={0.1}
              max={3}
              step={0.05}
              onChange={e => updateMonth(mi, +e.target.value)}
              style={{
                width: '100%', padding: '3px 2px',
                border: '1px solid #e2e8f0', borderRadius: 4,
                fontSize: 10, textAlign: 'center',
              }}
            />
          </div>
        ))}
      </div>
    </div>
  )
})

SeasonalityEditor.displayName = 'SeasonalityEditor'
