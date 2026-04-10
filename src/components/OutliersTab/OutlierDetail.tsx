/**
 * OutlierDetail — детальный анализ выбранного SKU
 * Информация + графики + таблица найденных выбросов
 * ~120 строк
 */
import { memo } from 'react'
import { MONTHS_RU } from '../../constants'
import { mean } from '../../engine'
import { OutlierChart } from './OutlierChart'

export interface OutlierSku {
  r: { code: string; name: string; cls: string; tmcGroup: string; abcxyz: string; abcClass: string; xyzClass: string }
  months: string[]
  vals: number[]
  mask: boolean[]
  avg: number
  lower: number
  upper: number
}

interface Props {
  selected: OutlierSku
}

export const OutlierDetail = memo(function OutlierDetail({ selected }: Props) {
  const outlierCount = selected.mask.filter(Boolean).length

  return (
    <>
      {/* Инфо о выбранном SKU */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12, padding: '8px 10px', background: '#f8fafc', borderRadius: 8, fontSize: 11 }}>
        <span><b>Код:</b> {selected.r.code}</span>
        <span><b>ТМЦ:</b> {selected.r.name}</span>
        <span><b>Класс:</b> {selected.r.cls}</span>
        <span>
          <b>ABC-XYZ:</b>{' '}
          <span style={{ background: '#dbeafe', color: '#1e40af', padding: '1px 5px', borderRadius: 6, fontWeight: 700 }}>
            {selected.r.abcxyz}
          </span>
        </span>
        <span><b>Точек:</b> {selected.vals.length}</span>
        <span><b>Выбросов:</b> <span style={{ color: '#ef4444', fontWeight: 700 }}>{outlierCount}</span></span>
        <span><b>Ср. до:</b> {mean(selected.vals).toFixed(0)}</span>
        <span><b>Ср. после:</b> {selected.avg.toFixed(0)}</span>
        <span><b>Норма:</b> [{Math.round(selected.lower)} — {Math.round(selected.upper)}]</span>
      </div>

      {/* Графики */}
      <OutlierChart selected={selected} />

      {/* Таблица найденных выбросов */}
      {outlierCount > 0 ? (
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 6 }}>Найденные выбросы</div>
          <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead style={{ background: '#f1f5f9' }}>
                <tr>
                  {['Период', 'Исходное', 'Нижняя граница', 'Верхняя граница', 'Скорр.', 'Отклонение', 'Тип'].map(h => (
                    <th key={h} style={{ padding: '6px 10px', textAlign: 'left', borderBottom: '2px solid #e2e8f0', fontSize: 10, color: '#475569', fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {selected.vals.map((v, i) => {
                  if (!selected.mask[i]) return null
                  const [yr, mo] = selected.months[i].split('-')
                  const corrected = Math.round(selected.avg)
                  const isHigh = v > selected.upper
                  const boundary = isHigh ? selected.upper : selected.lower
                  const dev = ((Math.abs(v - boundary) / Math.max(1, boundary)) * 100).toFixed(0)
                  return (
                    <tr key={i} style={{ background: '#fef2f2', borderBottom: '1px solid #fee2e2' }}>
                      <td style={{ padding: '5px 10px', fontWeight: 600 }}>{MONTHS_RU[+mo - 1]} {yr}</td>
                      <td style={{ padding: '5px 10px', color: '#dc2626', fontWeight: 700 }}>{v.toLocaleString('ru')}</td>
                      <td style={{ padding: '5px 10px', color: '#64748b' }}>{Math.round(selected.lower).toLocaleString('ru')}</td>
                      <td style={{ padding: '5px 10px', color: '#64748b' }}>{Math.round(selected.upper).toLocaleString('ru')}</td>
                      <td style={{ padding: '5px 10px', color: '#10b981', fontWeight: 600 }}>{corrected.toLocaleString('ru')}</td>
                      <td style={{ padding: '5px 10px', color: '#ef4444', fontWeight: 600 }}>{isHigh ? '+' : '-'}{dev}%</td>
                      <td style={{ padding: '5px 10px', color: isHigh ? '#dc2626' : '#2563eb' }}>{isHigh ? 'Высокий' : 'Низкий'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div style={{ padding: '12px 16px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, fontSize: 12, color: '#166534' }}>
          Для данного SKU выбросов не обнаружено
        </div>
      )}
    </>
  )
})
