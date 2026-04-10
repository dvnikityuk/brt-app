/**
 * HolidaysEditor — редактор производственных каникул
 * Вызывает onSettings при каждом изменении → SettingsPage автопересчитывает
 */
import { memo, useCallback, useMemo } from 'react'
import type { Settings, HolidayMonth } from '../types'
import { MONTHS_RU, defaultHolidays } from '../constants'
import { holidayEff } from '../engine'

interface Props {
  settings: Settings
  onSettings: (s: Settings) => void
  fiscalMonths: number[]
}

export const HolidaysEditor = memo(function HolidaysEditor({
  settings, onSettings, fiscalMonths,
}: Props) {
  const { useHolidays, holidays } = settings

  const totalDeficit = useMemo(() =>
    holidays.reduce((s, h) => s + Math.max(0, (1 - holidayEff(h)) * 100), 0),
    [holidays]
  )

  const toggle = useCallback((checked: boolean) => {
    onSettings({ ...settings, useHolidays: checked })
  }, [settings, onSettings])

  const updateHoliday = useCallback((fi: number, key: keyof HolidayMonth, val: number) => {
    const next = holidays.map((h, i) => i === fi ? { ...h, [key]: val } : h)
    onSettings({ ...settings, holidays: next })
  }, [settings, holidays, onSettings])

  const resetHolidays = useCallback(() =>
    onSettings({ ...settings, holidays: defaultHolidays() }),
    [settings, onSettings]
  )

  const clearHolidays = useCallback(() =>
    onSettings({ ...settings, holidays: new Array(12).fill({ workDays: 22, capacity: 100 }) }),
    [settings, onSettings]
  )

  return (
    <div>
      {/* Заголовок */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
          <input
            type="checkbox" checked={useHolidays}
            onChange={e => toggle(e.target.checked)}
            style={{ width: 14, height: 14 }}
          />
          <span style={{ fontWeight: 600, fontSize: 12, color: '#374151' }}>
            Производственные каникулы
          </span>
        </label>

        {useHolidays && (
          <span style={{ fontSize: 11, color: '#92400e', background: '#fef3c7', padding: '2px 8px', borderRadius: 4 }}>
            Дефицит: {totalDeficit.toFixed(0)} пунктов
          </span>
        )}

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <button
            onClick={resetHolidays}
            style={{ padding: '3px 10px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 6, cursor: 'pointer', fontSize: 11 }}
          >
            Пресет
          </button>
          <button
            onClick={clearHolidays}
            style={{ padding: '3px 10px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 6, cursor: 'pointer', fontSize: 11 }}
          >
            Сброс
          </button>
        </div>
      </div>

      {/* Описание алгоритма */}
      {useHolidays && (
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: '7px 12px', marginBottom: 10, fontSize: 11, color: '#475569', lineHeight: 1.6 }}>
          Заказ месяца × (Рабочих дней ÷ 22) × (Мощность ÷ 100).
          Дефицит: 80% переносится в <b>предыдущий</b> месяц, 20% — в <b>следующий</b>.
          Годовая сумма заказов не изменяется.
        </div>
      )}

      {/* Таблица */}
      {useHolidays && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                {['Месяц', 'Рабочих дней (из 22)', 'Мощность %', 'Эффективность', 'Статус'].map(h => (
                  <th key={h} style={{ padding: '5px 8px', textAlign: 'left', borderBottom: '2px solid #e2e8f0', fontSize: 10, color: '#475569', fontWeight: 600 }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {fiscalMonths.map((calMonth, fi) => {
                const h       = holidays[fi]
                const eff     = holidayEff(h)
                const effPct  = Math.round(eff * 100)
                const reduced = eff < 0.99
                const rowBg   = eff < 0.5 ? '#fef2f2' : eff < 0.8 ? '#fefce8' : '#fff'
                const clr     = eff < 0.5 ? '#ef4444' : eff < 0.8 ? '#f59e0b' : '#10b981'
                const status  = eff < 0.5 ? 'Критично' : eff < 0.8 ? 'Снижено' : 'Норма'

                return (
                  <tr key={fi} style={{ background: rowBg, borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '5px 8px', fontWeight: reduced ? 600 : 400, color: reduced ? '#92400e' : '#374151' }}>
                      {MONTHS_RU[calMonth]}
                    </td>
                    <td style={{ padding: '5px 8px', minWidth: 160 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <input
                          type="range" min={0} max={22} step={1} value={h.workDays}
                          onChange={e => updateHoliday(fi, 'workDays', +e.target.value)}
                          style={{ flex: 1, accentColor: '#1e40af' }}
                        />
                        <span style={{ fontWeight: 600, color: '#1e40af', minWidth: 24, textAlign: 'right' }}>
                          {h.workDays}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: '5px 8px', minWidth: 160 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <input
                          type="range" min={0} max={100} step={5} value={h.capacity}
                          onChange={e => updateHoliday(fi, 'capacity', +e.target.value)}
                          style={{ flex: 1, accentColor: '#7c3aed' }}
                        />
                        <span style={{ fontWeight: 600, color: '#7c3aed', minWidth: 32, textAlign: 'right' }}>
                          {h.capacity}%
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: '5px 8px', minWidth: 80 }}>
                      <div style={{ background: '#f1f5f9', borderRadius: 4, height: 18, position: 'relative', overflow: 'hidden' }}>
                        <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${effPct}%`, background: clr, transition: 'width 0.2s' }} />
                        <span style={{ position: 'relative', fontSize: 10, fontWeight: 700, color: effPct > 50 ? '#fff' : '#374151', paddingLeft: 4 }}>
                          {effPct}%
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: '5px 8px', color: clr, fontWeight: reduced ? 600 : 400, fontSize: 11 }}>
                      {status}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
})
