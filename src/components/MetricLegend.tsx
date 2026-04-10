import React from 'react'

// ─── Описание каждой метрики ─────────────────────────────────────────────────
export const METRIC_DESCRIPTIONS: Record<string, {
  label:   string
  color:   string
  desc:    string
  formula: string
  example: string
}> = {
  forecastVals: {
    label:   'Прогноз',
    color:   '#3b82f6',
    desc:    'Расчётный прогноз модели × коэффициент сезонности. Показывается для ВСЕХ месяцев, включая фактические — для сравнения точности модели.',
    formula: 'Прогноз[мес] = Базовый прогноз × Сезонность[мес]',
    example: 'Если базовый = 500, сезонность Дек = 1.3 → Прогноз Дек = 650',
  },
  actualVals: {
    label:   'Факт отгрузок',
    color:   '#059669',
    desc:    'Реальные данные из файла отгрузок. Только для прошедших месяцев. Для будущих = 0.',
    formula: 'Факт[мес] = Сумма отгрузок за месяц из файла',
    example: 'Апрель 2026: 480 шт (из файла отгрузок)',
  },
  demandVals: {
    label:   'Спрос (факт + прогноз)',
    color:   '#0891b2',
    desc:    'Лучшая оценка спроса: фактические данные там где есть, прогноз там где нет. Используется для расчёта заказов.',
    formula: 'Спрос[мес] = Факт если есть, иначе Прогноз',
    example: 'Апр (факт)=480, Май (прогноз)=510',
  },
  orderPlan: {
    label:   'Заказ',
    color:   '#10b981',
    desc:    'Расчётный план заказов. Для прошедших месяцев = фактические отгрузки. Для будущих = расчёт с учётом наполнения склада.',
    formula: 'Заказ[мес] = Спрос[мес] + Наполнение склада (первые 3 мес)',
    example: 'Если склад = 0, target = 600: Заказ₁ = 500 + 200 = 700',
  },
  stockStart: {
    label:   'Склад (начало)',
    color:   '#8b5cf6',
    desc:    'Остаток на складе на начало месяца. Для первого месяца = загруженный остаток (или 0).',
    formula: 'Склад_нач[i] = Склад_кон[i-1]',
    example: 'Начало Мая = Конец Апреля = 350 шт',
  },
  stockEnd: {
    label:   'Склад (конец)',
    color:   '#7c3aed',
    desc:    'Остаток на складе на конец месяца после всех операций.',
    formula: 'Склад_кон[i] = max(0, Склад_нач[i] + Заказ[i] − Спрос[i])',
    example: 'нач=350, заказ=500, спрос=480 → кон=370',
  },
  minStock: {
    label:   'Min склад (страховой запас)',
    color:   '#ef4444',
    desc:    'Страховой запас — минимально допустимый уровень. Ниже этого уровня = риск дефицита.',
    formula: 'SS = Z × σ × √(LT/30)  где Z=нормальное распределение(уровень сервиса)',
    example: 'SL=95%(Z=1.645), σ=50, LT=30дн → SS = 82 шт',
  },
  targetStock: {
    label:   'Целевой запас',
    color:   '#f59e0b',
    desc:    'Рабочий уровень склада = страховой запас + покрытие на период поставки.',
    formula: 'Target = SS + avg × max(1, LT/30)',
    example: 'SS=82, avg=500, LT=30дн → Target = 82 + 500×1 = 582 шт',
  },
  maxStock: {
    label:   'Max склад',
    color:   '#06b6d4',
    desc:    'Максимальный уровень склада = страховой запас + экономичный объём заказа.',
    formula: 'Max = SS + EOQ  где EOQ = avg × √(2/0.2)',
    example: 'SS=82, EOQ=1118 → Max = 1200 шт',
  },
  safetyStock: {
    label:   'Страховой запас',
    color:   '#f97316',
    desc:    'Буфер против неопределённости спроса и поставок. Растёт с уровнем сервиса и сроком поставки.',
    formula: 'SS = Z × σ × √(LT/30)',
    example: 'SL=99%(Z=2.326) → SS в 1.4× больше чем при SL=95%',
  },
  salesPlanVals: {
    label:   'План продаж',
    color:   '#0ea5e9',
    desc:    'Данные из загруженного плана продаж по месяцам.',
    formula: 'Из файла плана продаж (колонки = месяцы)',
    example: 'Апр 2026 = 600 шт (из плана)',
  },
  avgDemand: {
    label:   'Средний спрос',
    color:   '#64748b',
    desc:    'Среднемесячный спрос из исторических данных (после очистки выбросов).',
    formula: 'avg = mean(cleanHistoryVals)',
    example: 'История 12 мес, очищенная → avg = 487 шт/мес',
  },
}

// ─── Компонент легенды ────────────────────────────────────────────────────────

interface MetricLegendProps {
  metrics:   string[]   // список активных метрик
  compact?:  boolean    // компактный режим (только цветные точки)
}

export const MetricLegend: React.FC<MetricLegendProps> = ({ metrics, compact = false }) => {
  if (!metrics.length) return null

  if (compact) {
    return (
      <div style={{
        display:    'flex',
        gap:        8,
        flexWrap:   'wrap',
        fontSize:   11,
        color:      '#64748b',
        alignItems: 'center',
      }}>
        {metrics.map(mk => {
          const def = METRIC_DESCRIPTIONS[mk]
          if (!def) return null
          return (
            <span key={mk} style={{ display: 'flex', alignItems: 'center', gap: 3 }} title={def.desc}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: def.color, display: 'inline-block' }} />
              {def.label}
            </span>
          )
        })}
      </div>
    )
  }

  return (
    <div style={{
      background:   '#f8fafc',
      border:       '1px solid #e2e8f0',
      borderRadius: 8,
      padding:      '8px 12px',
      marginBottom: 8,
    }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: '#94a3b8', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Показатели
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {metrics.map(mk => {
          const def = METRIC_DESCRIPTIONS[mk]
          if (!def) return null
          return (
            <div key={mk} style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
              <div style={{
                width:        10,
                height:       10,
                borderRadius: '50%',
                background:   def.color,
                marginTop:    2,
                flexShrink:   0,
              }} />
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#374151' }}>{def.label}</div>
                <div style={{ fontSize: 10, color: '#64748b', maxWidth: 220 }}>{def.desc}</div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── ROP панель ──────────────────────────────────────────────────────────────

interface ROPPanelProps {
  rop:         number
  minStock:    number
  targetStock: number
  maxStock:    number
  currentStock: number
  avgDemand:   number
  leadTime:    number
}

export const ROPPanel: React.FC<ROPPanelProps> = ({
  rop, minStock, targetStock, maxStock, currentStock, avgDemand, leadTime,
}) => {
  const hasStock   = currentStock >= 0
  const needOrder  = hasStock && currentStock <= rop
  const isDeficit  = hasStock && currentStock <= minStock
  const isLow      = hasStock && currentStock > minStock && currentStock <= targetStock
  const isOk       = hasStock && currentStock > targetStock

  const status = isDeficit ? { label: 'Дефицит', color: '#dc2626', bg: '#fef2f2' }
    : isLow    ? { label: 'Мало — заказать', color: '#d97706', bg: '#fffbeb' }
    : needOrder ? { label: 'Пора заказывать (ROP)', color: '#f59e0b', bg: '#fefce8' }
    : isOk     ? { label: 'Норма', color: '#16a34a', bg: '#f0fdf4' }
    : { label: 'Нет данных', color: '#94a3b8', bg: '#f8fafc' }

  const items = [
    { label: 'ROP (точка перезаказа)', value: Math.round(rop), color: '#f59e0b',
      desc: `При остатке ≤ ${Math.round(rop)} нужно заказывать` },
    { label: 'Min (страховой)', value: Math.round(minStock), color: '#ef4444',
      desc: 'Ниже = риск дефицита' },
    { label: 'Целевой', value: Math.round(targetStock), color: '#f59e0b',
      desc: 'Рабочий уровень склада' },
    { label: 'Max', value: Math.round(maxStock), color: '#10b981',
      desc: 'Выше = излишки' },
  ]

  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-start' }}>
      {items.map(item => (
        <div key={item.label}
          style={{
            background:   '#fff',
            border:       '1px solid #e2e8f0',
            borderRadius: 8,
            padding:      '6px 12px',
            minWidth:     100,
          }}
          title={item.desc}
        >
          <div style={{ fontSize: 16, fontWeight: 700, color: item.color }}>
            {item.value.toLocaleString('ru')}
          </div>
          <div style={{ fontSize: 10, color: '#64748b' }}>{item.label}</div>
        </div>
      ))}

      {hasStock && (
        <div style={{
          background:   status.bg,
          border:       `1px solid ${status.color}30`,
          borderRadius: 8,
          padding:      '6px 12px',
        }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: status.color }}>
            {currentStock.toLocaleString('ru')}
          </div>
          <div style={{ fontSize: 10, color: status.color, fontWeight: 600 }}>
            Текущий · {status.label}
          </div>
        </div>
      )}

      <div style={{
        background:   '#f8fafc',
        border:       '1px solid #e2e8f0',
        borderRadius: 8,
        padding:      '6px 12px',
        fontSize:     10,
        color:        '#64748b',
      }}>
        <div style={{ fontWeight: 600, marginBottom: 2, color: '#475569' }}>Формула ROP</div>
        <div>ROP = avg × (LT/30) + SS</div>
        <div>= {Math.round(avgDemand)} × {(leadTime/30).toFixed(1)} + SS</div>
        <div>= {Math.round(rop)} шт</div>
        <div style={{ marginTop: 4, color: '#94a3b8' }}>
          При LT = {leadTime} дн, avg = {Math.round(avgDemand)} шт/мес
        </div>
      </div>
    </div>
  )
}
