import type { Settings, PivotLayer, MetricKey, HolidayMonth } from './types'

export const MONTHS_RU = Object.freeze([
  'Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн',
  'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'
]) as readonly string[]

export const MONTHS_RU_LONG = Object.freeze([
  'январь', 'февраль', 'март', 'апрель', 'май', 'июнь',
  'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'
]) as readonly string[]

export const MONTHS_RU_SHORT = Object.freeze([
  'янв', 'фев', 'мар', 'апр', 'май', 'июн',
  'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'
]) as readonly string[]

export const ALL_LAYERS: readonly PivotLayer[] = Object.freeze([
  { key: 'cls',      label: 'Класс ТМЦ'   },
  { key: 'tmcGroup', label: 'ТМЦ общее'   },
  { key: 'name',     label: 'Наименование' },
  { key: 'abcClass', label: 'ABC'          },
  { key: 'xyzClass', label: 'XYZ'          },
  { key: 'abcxyz',   label: 'ABC-XYZ'      },
]) as readonly PivotLayer[]

// ─── МЕТРИКИ ────────────────────────────────────────────────────────────────
//
// Три основных метрики для анализа:
//
//  forecastVals — расчётный прогноз модели (Holt/MA × сезонность × каникулы)
//                 Показывается для ВСЕХ 12 месяцев (даже факт-месяцев!)
//                 Позволяет сравнить: насколько модель точна vs факта
//
//  actualVals  — фактические отгрузки из файла
//                 Только для тех месяцев где есть данные, остальные = 0
//                 Позволяет увидеть: что реально было отгружено
//
//  orderPlan   — расчётный заказ ТОЛЬКО для будущих месяцев
//                 Для факт-месяцев = 0 (заказ уже выполнен)
//                 Показывает: сколько нужно заказать в будущем
//
// Дополнительные метрики для складского анализа:
//  stockStart / stockEnd / minStock / maxStock / targetStock / safetyStock
//  salesPlanVals / avgDemand

export const ALL_METRICS: readonly { key: MetricKey; label: string; color: string }[] = Object.freeze([
  // ─── Основные метрики ─────────────────────────────────────────────────────
  { key: 'forecastVals',  label: 'Прогноз',              color: '#3b82f6' }, // синий
  { key: 'actualVals',    label: 'Факт отгрузок',        color: '#059669' }, // зелёный
  { key: 'demandVals',    label: 'Спрос (факт+прогноз)', color: '#0891b2' }, // голубой
  { key: 'orderPlan',     label: 'Заказ',                color: '#f59e0b' }, // оранжевый
  // ─── Складские нормативы ──────────────────────────────────────────────────
  { key: 'stockStart',    label: 'Склад (нач)',      color: '#8b5cf6' },
  { key: 'stockEnd',      label: 'Склад (кон)',      color: '#7c3aed' },
  { key: 'minStock',      label: 'Min склад',        color: '#ef4444' },
  { key: 'maxStock',      label: 'Max склад',        color: '#dc2626' },
  { key: 'targetStock',   label: 'Целевой склад',    color: '#06b6d4' },
  { key: 'safetyStock',   label: 'Страховой запас',  color: '#f97316' },
  // ─── Прочие ───────────────────────────────────────────────────────────────
  { key: 'salesPlanVals', label: 'План продаж',      color: '#0ea5e9' },
  { key: 'avgDemand',     label: 'Ср. спрос/мес',   color: '#64748b' },
])

const METRICS_MAP = new Map(ALL_METRICS.map(m => [m.key, m]))
export const getMetricDef = (key: MetricKey) => METRICS_MAP.get(key)

export function defaultHolidays(): HolidayMonth[] {
  return Array.from({ length: 12 }, (_, fi) => {
    const calMonth = (3 + fi) % 12
    if (calMonth === 0) return { workDays: 14, capacity: 70 }
    if (calMonth === 4) return { workDays: 18, capacity: 85 }
    if (calMonth === 6 || calMonth === 7) return { workDays: 20, capacity: 90 }
    return { workDays: 22, capacity: 100 }
  })
}

const currentYear  = new Date().getFullYear()
const currentMonth = new Date().getMonth() + 1

export const DEF_SETTINGS: Settings = Object.freeze({
  serviceLevel:    95,
  leadTime:        30,
  fiscalStart:     4,
  fiscalYear:      currentMonth >= 4 ? currentYear : currentYear - 1,
  outlierMethod:   'iqr',
  outlierThreshold: 1.5,
  abcA:            80,
  abcB:            95,
  xyzX:            0.1,
  xyzY:            0.25,
  forecastMethod:  'auto',
  forecastAlpha:   0.3,
  forecastBeta:    0.1,
  minCleanPoints:  3,
  abcOverride:     false,
  abcSettings: {
    A: { serviceLevel: 97, leadTime: 14 },
    B: { serviceLevel: 95, leadTime: 30 },
    C: { serviceLevel: 90, leadTime: 45 },
  },
  useHolidays: false,
  holidays:    defaultHolidays(),
}) as Settings

const RECOMMENDATIONS: Record<string, string> = {
  AX: 'JIT, мин. страховой запас',
  AY: 'Регулярный пересчёт, умеренный буфер',
  AZ: 'Большой буфер, частый мониторинг',
  BX: 'Фиксированные заказы',
  BY: 'Периодический пересмотр',
  BZ: 'Заказ под потребность',
  CX: 'Редкие крупные заказы',
  CY: 'По мере необходимости',
  CZ: 'Рассмотреть вывод из ассортимента',
}
export const getRec = (abcxyz: string): string => RECOMMENDATIONS[abcxyz] || ''

export function makeFiscalLabels(fiscalStart: number): string[] {
  return Array.from({ length: 12 }, (_, i) => {
    const calMonth = (fiscalStart - 1 + i) % 12
    return MONTHS_RU[calMonth]
  })
}

export function makeFiscalLabelsWithYear(fiscalStart: number, fiscalYear: number): string[] {
  return Array.from({ length: 12 }, (_, i) => {
    const calMonth  = (fiscalStart - 1 + i) % 12
    const yearOffset = calMonth < fiscalStart - 1 ? 1 : 0
    return `${MONTHS_RU[calMonth]} ${fiscalYear + yearOffset}`
  })
}

export function autoDetectFiscalYear(lastDate: Date | null, fiscalStart: number): number {
  if (!lastDate) {
    const now = new Date()
    return now.getMonth() + 1 >= fiscalStart ? now.getFullYear() : now.getFullYear() - 1
  }
  const m = lastDate.getMonth() + 1
  const y = lastDate.getFullYear()
  return m >= fiscalStart ? y : y - 1
}

export function defaultFiscalYear(fiscalStart: number): number {
  const now = new Date()
  return now.getMonth() + 1 >= fiscalStart ? now.getFullYear() : now.getFullYear() - 1
}

export const DEFAULT_FILTERS = Object.freeze({
  abc:      'ALL',
  xyz:      'ALL',
  cls:      'ALL',
  tmcGroup: 'ALL',
  search:   '',
})
