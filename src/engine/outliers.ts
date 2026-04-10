// ═══════════════════════════════════════════════════════════════════════════
// Обнаружение и обработка выбросов
// ═══════════════════════════════════════════════════════════════════════════

import { mean, stdev, pct } from './utils'

/**
 * Обнаруживает выбросы в массиве значений
 * Возвращает булев массив: true = выброс
 *
 * Методы:
 *   iqr    — межквартильный размах (рекомендуется для скошенных распределений)
 *   zscore — стандартные отклонения (для нормальных распределений)
 *   mad    — медианное абсолютное отклонение (устойчивый метод)
 *   none   — не применять
 */
export const findOutliers = (vals: number[], method: string, thr: number): boolean[] => {
  const n    = vals.length
  const mask = new Array(n).fill(false)
  if (n < 4 || method === 'none') return mask

  const sorted = [...vals].sort((a, b) => a - b)

  if (method === 'iqr') {
    const Q1  = pct(sorted, 25)
    const Q3  = pct(sorted, 75)
    const IQR = Q3 - Q1
    const lo  = Q1 - thr * IQR
    const hi  = Q3 + thr * IQR
    for (let i = 0; i < n; i++) {
      if (vals[i] < lo || vals[i] > hi) mask[i] = true
    }

  } else if (method === 'zscore') {
    const m = mean(vals)
    const s = stdev(vals)
    if (s > 0) {
      for (let i = 0; i < n; i++) {
        if (Math.abs((vals[i] - m) / s) > thr) mask[i] = true
      }
    }

  } else if (method === 'mad') {
    const med  = pct(sorted, 50)
    const mads = vals.map(v => Math.abs(v - med)).sort((a, b) => a - b)
    const mad  = pct(mads, 50) || 1
    for (let i = 0; i < n; i++) {
      if (Math.abs(0.6745 * (vals[i] - med) / mad) > thr) mask[i] = true
    }
  }

  return mask
}

/**
 * Получить границы нормальной зоны для отображения в UI
 */
export const getOutlierBounds = (
  vals: number[],
  cleanVals: number[],
  method: string,
  thr: number
): { lower: number; upper: number; avg: number } => {
  const avg  = mean(cleanVals.length >= 2 ? cleanVals : vals)
  const sorted = [...(cleanVals.length >= 2 ? cleanVals : vals)].sort((a, b) => a - b)

  let lower = 0
  let upper = Infinity

  if (method === 'iqr') {
    const Q1  = pct(sorted, 25)
    const Q3  = pct(sorted, 75)
    const IQR = Q3 - Q1
    lower = Q1 - thr * IQR
    upper = Q3 + thr * IQR
  } else if (method === 'zscore') {
    const sd = stdev(vals)
    lower    = avg - thr * sd
    upper    = avg + thr * sd
  } else if (method === 'mad') {
    const med  = pct(sorted, 50)
    const mads = vals.map(v => Math.abs(v - med)).sort((a, b) => a - b)
    const mad  = pct(mads, 50) || 1
    lower      = med - thr * mad / 0.6745
    upper      = med + thr * mad / 0.6745
  }

  return { lower, upper, avg }
}
