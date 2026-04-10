export interface RawRow {
  tmcGroup: string
  cls: string
  tmc: string
  code: string
  date: Date
  qty: number
}

export interface StockRow {
  code: string
  name: string
  qty: number
  date?: Date
}

export interface SalesPlanRow {
  code: string
  name: string
  months: number[]
}

// ─── Упаковка ────────────────────────────────────────────────────────────────
export interface PackagingRow {
  code: string
  name: string
  packQty: number  // количество единиц в одной упаковке
}

export interface CatalogItem {
  code: string
  name: string
  cls: string
  tmcGroup: string
}

export interface AnalysisResult {
  code: string
  name: string
  cls: string
  tmcGroup: string
  abcClass: string
  xyzClass: string
  abcxyz: string
  abcCumPct: number
  avgDemand: number
  stdDemand: number
  cv: number
  trend: number
  safetyStock: number
  minStock: number
  targetStock: number
  maxStock: number
  rop: number
  eoq: number
  forecastVals: number[]
  totalForecast: number
  orderPlan: number[]
  totalOrders: number
  stockStart: number[]
  stockEnd: number[]
  outlierCount: number
  totalPoints: number
  currentStock: number
  stockDate: string
  stockDateIndex: number
  salesPlanVals: number[]
  forecastMethod: string
  hasSalesPlan: boolean
  annualDemand: number
  actualVals: number[]
  isActual: boolean[]
  demandVals: number[]
  // ─── Упаковка ───────────────────────────────────────────────────────────
  packQty: number          // кол-во в упаковке (1 = поштучно)
  orderPlanPacks: number[] // заказ в упаковках (округлено вверх)
  totalOrdersPacks: number // итого упаковок за год
}

export interface HolidayMonth {
  workDays: number
  capacity: number
}

export interface Settings {
  serviceLevel: number
  leadTime: number
  fiscalStart: number
  fiscalYear: number
  outlierMethod: string
  outlierThreshold: number
  abcA: number
  abcB: number
  xyzX: number
  xyzY: number
  forecastMethod: string
  forecastAlpha: number
  forecastBeta: number
  minCleanPoints: number
  abcOverride: boolean
  abcSettings: {
    A: { serviceLevel: number; leadTime: number }
    B: { serviceLevel: number; leadTime: number }
    C: { serviceLevel: number; leadTime: number }
  }
  useHolidays: boolean
  holidays: HolidayMonth[]
}

export interface Version {
  id: string
  name: string
  desc: string
  date: string
  settings: Settings
  seasonality: number[]
}

export type MetricKey =
  | 'forecastVals'   // Прогноз модели — расчётный на все 12 месяцев
  | 'actualVals'     // Факт отгрузок — только реальные данные (0 = нет данных)
  | 'demandVals'     // Спрос: факт где есть, прогноз где нет
  | 'orderPlan'      // Заказ: факт для прошлых, расчёт для будущих
  | 'stockStart'     // Склад на начало месяца
  | 'stockEnd'       // Склад на конец месяца
  | 'minStock'       // Min норматив (страховой запас)
  | 'maxStock'       // Max норматив
  | 'targetStock'    // Целевой норматив
  | 'salesPlanVals'  // План продаж (внешний файл)
  | 'safetyStock'    // Страховой запас
  | 'avgDemand'      // Средний спрос в месяц

export interface PivotLayer {
  key: 'cls' | 'tmcGroup' | 'name' | 'abcClass' | 'xyzClass' | 'abcxyz'
  label: string
}

export interface PivotConfig {
  layers: PivotLayer[]
  metrics: MetricKey[]
  compareMode: 'side' | 'month'
  collapsed: Record<string, boolean>
}

export type MonthStatus = 'fact' | 'current' | 'past' | 'future'
