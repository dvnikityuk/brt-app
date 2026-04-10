// ═══════════════════════════════════════════════════════════════════════════
// BRT Engine — точка входа
// Реэкспортирует все модули для обратной совместимости
// ═══════════════════════════════════════════════════════════════════════════

// Утилиты
export {
  normCode, mean, stdev, pct, holidayEff, linTrend, normInv,
  mkMonthKey, parseDate, getRec,
} from './utils'

// Выбросы
export { findOutliers, getOutlierBounds } from './outliers'

// Прогнозирование
export { holtForecast, maForecast, autoForecast, applySeasonality } from './forecast'

// Плановые месяцы
export { buildPlanMonths } from './planMonths'
export type { PlanMonth } from './planMonths'

// Справочники
export { parseCatalogRows, parsePackagingRows, roundUpToPack, qtyToPacks } from './catalog'

// Симуляция
export { simulateOrders, FILL_MONTHS } from './simulation'
export type { SimulationInput, SimulationResult } from './simulation'

// Основной анализ и pivot helpers
export { runAnalysis, getMetricVals, getRowVal } from './analysis'
