/**
 * OutlierChart — графики анализа выбросов для выбранного SKU
 * График 1: история + зона нормы
 * График 2: до и после очистки
 * ~120 строк
 */
import { memo, useMemo } from 'react'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ReferenceLine, ResponsiveContainer, Area, Scatter
} from 'recharts'
import { MONTHS_RU } from '../../constants'

interface OutlierSku {
  months: string[]
  vals: number[]
  mask: boolean[]
  avg: number
  lower: number
  upper: number
}

interface TooltipPayload { name: string; value: number; color: string }

const OutlierTooltip = memo(function OutlierTooltip({
  active, payload, label
}: { active?: boolean; payload?: TooltipPayload[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 12px', fontSize: 11, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
      <div style={{ fontWeight: 700, marginBottom: 4, color: '#374151' }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color, marginBottom: 2 }}>
          <span style={{ fontWeight: 600 }}>{p.name}:</span>{' '}
          {typeof p.value === 'number' ? p.value.toLocaleString('ru') : p.value}
        </div>
      ))}
    </div>
  )
})

interface Props {
  selected: OutlierSku
}

export const OutlierChart = memo(function OutlierChart({ selected }: Props) {
  const chart1Data = useMemo(() => selected.months.map((m, i) => {
    const [yr, mo] = m.split('-')
    const label = MONTHS_RU[+mo - 1] + "'" + yr.slice(2)
    const isOut = selected.mask[i]
    return {
      label,
      норма: isOut ? null : selected.vals[i],
      выброс: isOut ? selected.vals[i] : null,
      скорректировано: isOut ? Math.round(selected.avg) : null,
      верхняяГраница: Math.round(Math.min(selected.upper, selected.vals[i] * 3)),
      нижняяГраница: Math.max(0, Math.round(selected.lower)),
    }
  }), [selected])

  const chart2Data = useMemo(() => {
    const cleanVals = selected.vals.map((v, i) => selected.mask[i] ? Math.round(selected.avg) : v)
    return selected.months.map((m, i) => {
      const [yr, mo] = m.split('-')
      return {
        label: MONTHS_RU[+mo - 1] + "'" + yr.slice(2),
        исходные: selected.vals[i],
        очищенные: cleanVals[i],
        выброс: selected.mask[i] ? selected.vals[i] : null,
        замена: selected.mask[i] ? cleanVals[i] : null,
      }
    })
  }, [selected])

  const chartStyle = { width: '100%', height: 200, background: '#fafafa', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 8px 4px 0' }
  const axisProps = { tick: { fontSize: 10, fill: '#64748b' }, angle: -45, textAnchor: 'end' as const, interval: 0, height: 50 }

  return (
    <>
      {/* График 1: история с выбросами */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
          История с выбросами и зоной нормы
        </div>
        <div style={chartStyle}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chart1Data} margin={{ top: 5, right: 16, left: 5, bottom: 30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="label" {...axisProps} />
              <YAxis tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={(v: number) => v.toLocaleString('ru')} width={55} />
              <Tooltip content={<OutlierTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} iconType="square" />
              <Area type="monotone" dataKey="верхняяГраница" fill="rgba(16,185,129,0.08)" stroke="#10b981" strokeDasharray="6 3" strokeWidth={1.5} name="Верхняя граница" dot={false} activeDot={false} />
              <Area type="monotone" dataKey="нижняяГраница" fill="#ffffff" stroke="#f59e0b" strokeDasharray="6 3" strokeWidth={1.5} name="Нижняя граница" dot={false} activeDot={false} />
              <Bar dataKey="норма" name="Норма" fill="rgba(59,130,246,0.7)" radius={[3, 3, 0, 0]} maxBarSize={32} />
              <Bar dataKey="выброс" name="Выброс" fill="rgba(239,68,68,0.7)" radius={[3, 3, 0, 0]} maxBarSize={32} />
              <Bar dataKey="скорректировано" name="Скорр." fill="rgba(16,185,129,0.8)" radius={[3, 3, 0, 0]} maxBarSize={32} />
              <ReferenceLine y={Math.round(selected.avg)} stroke="#3b82f6" strokeDasharray="5 3" strokeWidth={2}
                label={{ value: `Ср: ${Math.round(selected.avg)}`, fill: '#3b82f6', fontSize: 10, position: 'insideTopRight' }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* График 2: до и после очистки */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
          Сравнение: до и после очистки
        </div>
        <div style={{ ...chartStyle, height: 180 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chart2Data} margin={{ top: 5, right: 16, left: 5, bottom: 30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="label" {...axisProps} />
              <YAxis tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={(v: number) => v.toLocaleString('ru')} width={55} />
              <Tooltip content={<OutlierTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} />
              <Line type="monotone" dataKey="исходные" name="Исходные" stroke="#cbd5e1" strokeWidth={2} strokeDasharray="5 3" dot={false} activeDot={{ r: 4 }} />
              <Line type="monotone" dataKey="очищенные" name="После очистки" stroke="#3b82f6" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
              <Scatter dataKey="выброс" name="Выброс" fill="#ef4444" />
              <Scatter dataKey="замена" name="Замена" fill="#10b981" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </>
  )
})
