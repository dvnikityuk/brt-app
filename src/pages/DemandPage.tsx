import { memo, useMemo } from 'react'
import {
  ComposedChart, Bar, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import { useAppStore, useMonthStatus, useFiltered, useFiscalMonthsFromLastShipment, useFiscalLabelsFromLastShipment } from '../store/useAppStore'
import { FilterBar } from '../components/FilterBar'
import { PivotTable } from '../components/PivotTable'
import { ALL_METRICS } from '../constants'
import { getMetricVals } from '../engine'
import type { MetricKey } from '../types'

const S = {
  card: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 14 } as React.CSSProperties,
  stat: { background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: '8px 16px', textAlign: 'center' as const },
  warn: { background: '#fefce8', border: '1px solid #fcd34d', borderRadius: 8, padding: 14, fontSize: 13, color: '#854d0e' } as React.CSSProperties,
  legend: { background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 14px', fontSize: 11, color: '#64748b', display: 'flex', gap: 16, flexWrap: 'wrap' as const },
}

// Пояснение метрик для пользователя
const METRIC_DESCRIPTIONS: Record<string, string> = {
  forecastVals:  'Прогноз — расчёт модели (Holt / MA × сезонность). Показывается для ВСЕХ месяцев включая факт — для оценки точности модели.',
  actualVals:    'Факт отгрузок — реальные данные из файла. Только для месяцев с данными.',
  orderPlan:     'Заказ — сколько нужно произвести/заказать в будущих месяцах. Для факт-месяцев = 0.',
  stockStart:    'Склад (начало) — остаток на начало месяца по симуляции.',
  stockEnd:      'Склад (конец) — остаток на конец месяца по симуляции.',
  minStock:      'Min склад — страховой запас (нижняя граница).',
  maxStock:      'Max склад — максимальный норматив (SS + EOQ).',
  targetStock:   'Целевой склад — рабочий уровень (SS + ср.спрос).',
  safetyStock:   'Страховой запас — буфер против колебаний спроса.',
  salesPlanVals: 'План продаж — данные из загруженного файла плана.',
  avgDemand:     'Ср. спрос — среднемесячный спрос по истории.',
}

export const DemandPage = memo(function DemandPage() {
  const results        = useAppStore(s => s.results)
  const rawData        = useAppStore(s => s.rawData)
  const filters        = useAppStore(s => s.filters)
  const setFilters     = useAppStore(s => s.setFilters)
  const pivotDemand    = useAppStore(s => s.pivotDemand)
  const setPivotDemand = useAppStore(s => s.setPivotDemand)

  const filtered    = useFiltered()
  const monthStatus = useMonthStatus()

  const fiscalMonths = useFiscalMonthsFromLastShipment()
  const fiscalLabels = useFiscalLabelsFromLastShipment()

  const selectedMetricDefs = useMemo(() =>
    pivotDemand.metrics
      .map(mk => ALL_METRICS.find(m => m.key === mk))
      .filter(Boolean) as { key: MetricKey; label: string; color: string }[],
    [pivotDemand.metrics]
  )

  // Данные для графика: факт и прогноз всегда раздельно
  const chartData = useMemo(() =>
    fiscalLabels.map((label, fi) => {
      const point: Record<string, string | number> = { label }

      // Всегда добавляем факт и прогноз для сравнения
      point['Факт'] = filtered.reduce((s, r) =>
        s + (r.actualVals?.[fi] ?? 0), 0)
      point['Прогноз'] = filtered.reduce((s, r) =>
        s + r.forecastVals[fi], 0)
      // Дополнительные выбранные метрики
      selectedMetricDefs.forEach(m => {
        if (m.key !== 'forecastVals' && m.key !== 'actualVals') {
          point[m.label] = filtered.reduce(
            (s, r) => s + getMetricVals(r, m.key, fiscalMonths)[fi], 0
          )
        }
      })
      return point
    }),
    [filtered, selectedMetricDefs, fiscalLabels, fiscalMonths]
  )

  // Кол-во факт и прогноз месяцев
  const factCount = useMemo(
    () => monthStatus.filter(s => s === 'fact').length,
    [monthStatus]
  )
  const forecastCount = 12 - factCount

  if (!rawData.length || !results.length) {
    return <div style={S.warn}>Загрузите данные и нажмите «Запустить анализ»</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <FilterBar filters={filters} onFilters={setFilters} results={results} filtered={filtered} />

      {/* Пояснение метрик */}
      <div style={S.legend}>
        <div>
          <span style={{ color: '#059669', fontWeight: 600 }}>Факт отгрузок</span>
          {' '}— реальные данные из файла ({factCount} мес.)
        </div>
        <div>
          <span style={{ color: '#3b82f6', fontWeight: 600 }}>Прогноз</span>
          {' '}— расчёт модели × сезонность × каникулы ({forecastCount} мес. вперёд)
        </div>
        <div>
          <span style={{ color: '#f59e0b', fontWeight: 600 }}>Заказ</span>
          {' '}— план производства/закупок для будущих месяцев
        </div>
        <div style={{ color: '#94a3b8', fontSize: 10 }}>
          Прогноз отображается и для факт-месяцев — чтобы оценить точность модели
        </div>
      </div>

      {/* Статистика */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {([
          ['SKU', filtered.length, '#1e40af'],
          ['Ср. спрос / мес', Math.round(filtered.reduce((s, r) => s + r.avgDemand, 0) / Math.max(1, filtered.length)), '#16a34a'],
          ['Год. прогноз', filtered.reduce((s, r) => s + r.totalForecast, 0).toLocaleString('ru'), '#7c3aed'],
          ['Факт мес.', factCount, '#059669'],
          ['Прогноз мес.', forecastCount, '#3b82f6'],
          ['С выбросами', filtered.filter(r => r.outlierCount > 0).length, '#d97706'],
        ] as [string, string | number, string][]).map(([l, v, c]) => (
          <div key={l} style={S.stat}>
            <div style={{ fontSize: 18, fontWeight: 700, color: c }}>{v}</div>
            <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>{l}</div>
          </div>
        ))}
      </div>

      {/* График: Факт vs Прогноз (всегда вместе) */}
      <div style={{ ...S.card, padding: '14px 8px 8px 0' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', padding: '0 14px 8px', display: 'flex', gap: 16, alignItems: 'baseline' }}>
          <span>Факт vs Прогноз</span>
          <span style={{ fontSize: 10, fontWeight: 400, color: '#94a3b8' }}>
            зелёные столбцы — факт отгрузок, синяя линия — прогноз модели
          </span>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={chartData} margin={{ top: 5, right: 16, left: 10, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              angle={-30} textAnchor="end" height={40}
            />
            <YAxis
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              tickFormatter={(v: number) => v >= 1000 ? Math.round(v / 1000) + 'k' : String(v)}
              width={44}
            />
            <Tooltip
              formatter={(v: unknown) => [(v as number).toLocaleString('ru')]}
              contentStyle={{ fontSize: 11, borderRadius: 6, border: '1px solid #e2e8f0' }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {/* Факт — столбцы */}
            <Bar
              dataKey="Факт"
              fill="rgba(5,150,105,0.6)"
              radius={[3, 3, 0, 0]}
              maxBarSize={40}
            />
            {/* Прогноз — линия поверх */}
            <Line
              type="monotone"
              dataKey="Прогноз"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={{ r: 2, fill: '#3b82f6' }}
              activeDot={{ r: 4 }}
            />
            {/* Дополнительные метрики */}
            {selectedMetricDefs
              .filter(m => m.key !== 'forecastVals' && m.key !== 'actualVals')
              .map(m => (
                <Line
                  key={m.key}
                  type="monotone"
                  dataKey={m.label}
                  stroke={m.color}
                  strokeWidth={1.5}
                  strokeDasharray="4 2"
                  dot={false}
                />
              ))
            }
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Описание выбранных метрик */}
      {selectedMetricDefs.length > 0 && (
        <div style={{ ...S.legend, flexDirection: 'column', gap: 4 }}>
          <div style={{ fontWeight: 600, marginBottom: 2 }}>Выбранные метрики в таблице:</div>
          {selectedMetricDefs.map(m => (
            <div key={m.key} style={{ display: 'flex', gap: 8 }}>
              <span style={{ color: m.color, fontWeight: 600, minWidth: 140 }}>{m.label}</span>
              <span>{METRIC_DESCRIPTIONS[m.key] || ''}</span>
            </div>
          ))}
        </div>
      )}

      {/* Сводная таблица */}
      <div style={S.card}>
        <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 10, color: '#374151' }}>
          Сводная таблица отгрузок
        </div>
        <PivotTable
          results={filtered}
          config={pivotDemand}
          onConfig={setPivotDemand}
          fiscalMonths={fiscalMonths}
          fiscalLabels={fiscalLabels}
          title="Группа / SKU"
          monthStatus={monthStatus}
        />
      </div>
    </div>
  )
})
