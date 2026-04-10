// ═══════════════════════════════════════════════════════════════════════════
// Методы прогнозирования спроса
// ═══════════════════════════════════════════════════════════════════════════
//
// ВСЕ методы возвращают БАЗОВЫЙ прогноз (массив из N значений).
// Сезонность применяется ПОСЛЕ в runAnalysis.
//
// Важно: прогноз обучается на исторических данных (до планового FY).
// Факт-месяцы текущего FY включаются в обучение — они самые актуальные!
// ═══════════════════════════════════════════════════════════════════════════

import { mean } from './utils'

/**
 * Двойное экспоненциальное сглаживание Холта.
 * Хорошо для данных с трендом (XYZ = Y или Z).
 *
 * L[t] = α × Y[t] + (1−α) × (L[t-1] + T[t-1])  — уровень
 * T[t] = β × (L[t] − L[t-1]) + (1−β) × T[t-1]  — тренд
 * F[t+h] = L[t] + h × T[t]                        — прогноз (НЕ экстраполируем тренд!)
 *
 * @param vals   Исторические значения (очищенные от выбросов)
 * @param alpha  Параметр сглаживания уровня (0.1 — 0.9)
 * @param beta   Параметр сглаживания тренда (0.05 — 0.5)
 * @param n      Количество периодов прогноза
 */
export const holtForecast = (vals: number[], alpha: number, beta: number, n: number): number[] => {
  if (!vals.length) return new Array(n).fill(0)

  let lv = vals[0]
  let tr = vals.length >= 2 ? vals[1] - vals[0] : 0

  for (let i = 1; i < vals.length; i++) {
    const prevLv = lv
    lv = alpha * vals[i] + (1 - alpha) * (lv + tr)
    tr = beta * (lv - prevLv) + (1 - beta) * tr
  }

  // Используем финальный уровень БЕЗ экстраполяции тренда
  // Это предотвращает нереалистичный рост/падение прогноза
  const base = Math.max(0, lv)
  return new Array(n).fill(base)
}

/**
 * Скользящее среднее (Moving Average).
 * Хорошо для стабильного спроса (XYZ = X).
 *
 * MA[w] = среднее последних w значений
 *
 * @param vals  Исторические значения
 * @param w     Размер окна (3 или 6 месяцев)
 * @param n     Количество периодов прогноза
 */
export const maForecast = (vals: number[], w: number, n: number): number[] => {
  if (!vals.length) return new Array(n).fill(0)
  const windowVals = vals.slice(-w)
  const base       = Math.max(0, mean(windowVals))
  return new Array(n).fill(base)
}

/**
 * Автоматический выбор метода по XYZ классу.
 * X (стабильный) → MA-3 (быстрый отклик на изменения)
 * Y/Z (нестабильный) → Holt (учитывает тренд)
 */
export const autoForecast = (
  vals: number[],
  cv: number,
  xyzX: number,
  alpha: number,
  beta: number,
  n: number
): { forecast: number[]; method: string } => {
  if (cv <= xyzX) {
    return { forecast: maForecast(vals, 3, n), method: 'ma3' }
  }
  return { forecast: holtForecast(vals, alpha, beta, n), method: 'holt' }
}

/**
 * Применить сезонность к базовому прогнозу.
 * forecastVals[fi] = baseForecast[fi] × seasonality[calMonth[fi]]
 *
 * @param baseForecast  Базовый прогноз (без сезонности)
 * @param fiscalMonths  Массив [12] — calendar month indices для каждого fiscal slot
 * @param seasonality   Массив [12] — коэффициенты сезонности (0=Янв, 11=Дек)
 */
export const applySeasonality = (
  baseForecast: number[],
  fiscalMonths: number[],
  seasonality: number[]
): number[] =>
  baseForecast.map((v, fi) => {
    const calMonth = fiscalMonths[fi]
    const coef     = seasonality[calMonth] ?? 1
    return Math.max(0, Math.round(v * coef))
  })
