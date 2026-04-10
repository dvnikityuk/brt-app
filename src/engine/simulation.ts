// ═══════════════════════════════════════════════════════════════════════════
// Симуляция склада и расчёт заказов
// ═══════════════════════════════════════════════════════════════════════════
//
// МАТЕМАТИКА:
//
//   SS           = Z × σ × √(LT/30)          — страховой запас
//   targetStock  = SS + avg × coverMonths     — целевой уровень
//   maxStock     = SS + EOQ                   — максимум
//   ROP          = avg × (LT/30) + SS         — точка перезаказа
//
//   initStock    = currentStock (из файла) или 0 (не загружен)
//   fillRate     = (targetStock - initStock) / FILL_MONTHS
//
//   КРАТНОСТЬ УПАКОВКЕ:
//   rawOrd       = demand[fi] + fillRate      — «сырой» заказ в штуках
//   packQty      = количество в упаковке (из справочника, 0 = без кратности)
//   packCount    = ceil(rawOrd / packQty)     — кол-во упаковок (вверх)
//   ord          = packCount × packQty        — итоговый заказ кратный уп.
//
//   Пример: rawOrd=103, packQty=21
//     packCount = ceil(103/21) = ceil(4.9) = 5 уп.
//     ord       = 5 × 21 = 105 шт  ← кратно упаковке!
//
//   Заказ (факт-месяцы):
//     ord = actualVals[fi]  (реальные отгрузки — кратность не применяется)
//
//   Склад:
//     stockEnd[fi] = max(0, stockStart[fi] + ord[fi] - demand[fi])
//     stockStart[fi+1] = stockEnd[fi]
// ═══════════════════════════════════════════════════════════════════════════

import { holidayEff } from './utils'
import type { Settings } from '../types'

export const FILL_MONTHS = 3  // месяцев для наполнения склада с нуля

export interface SimulationInput {
  demandVals:     number[]   // [12] спрос: факт или прогноз
  actualVals:     number[]   // [12] фактические отгрузки
  isActual:       boolean[]  // [12] true = факт-месяц
  initStock:      number     // начальный остаток (0 если не загружен)
  targetStock:    number     // целевой уровень склада
  maxStock:       number     // максимальный уровень
  stockDateIndex: number     // с какого fi начинаем симуляцию
  packQty:        number     // количество в упаковке (0 = без кратности)
  settings:       Settings
}

export interface SimulationResult {
  orderPlan:      number[]   // [12] заказы в штуках (кратно упаковке!)
  orderPlanPacks: number[]   // [12] заказы в упаковках
  stockStart:     number[]   // [12] остаток на начало месяца
  stockEnd:       number[]   // [12] остаток на конец месяца
}

/**
 * Округляет заказ до кратного упаковке (вверх).
 * Если packQty <= 1 — возвращает исходное значение.
 *
 * Пример: roundUpToPack(103, 21) = 105 (5 уп × 21 шт)
 */
function roundUpToPack(qty: number, packQty: number): number {
  if (!packQty || packQty <= 1) return qty
  if (qty <= 0) return 0
  return Math.ceil(qty / packQty) * packQty
}

/**
 * Рассчитывает заказы и симулирует движение склада.
 *
 * Алгоритм:
 *   ШАГ 1: Базовые заказы в штуках
 *   ШАГ 2: Округление до кратного упаковке
 *   ШАГ 3: Применение производственных каникул
 *   ШАГ 4: Финальная симуляция склада
 */
export function simulateOrders(input: SimulationInput): SimulationResult {
  const {
    demandVals, actualVals, isActual,
    initStock, targetStock, maxStock,
    stockDateIndex, packQty, settings,
  } = input

  const N = 12

  // ── ШАГ 1: Базовые заказы в штуках ──────────────────────────────────────
  const fillRate    = Math.max(0, (targetStock - initStock) / FILL_MONTHS)
  const rawOrders   = new Array(N).fill(0) as number[]
  let   filledCount = 0
  let   s           = initStock

  for (let fi = 0; fi < N; fi++) {
    if (fi < stockDateIndex) {
      rawOrders[fi] = 0
      continue
    }

    if (isActual[fi]) {
      // Факт-месяц: заказ = реальные отгрузки (без кратности — это история)
      rawOrders[fi] = actualVals[fi]
      s = Math.max(0, s - actualVals[fi])
    } else {
      // Прогноз-месяц: спрос + наполнение склада
      const dem  = demandVals[fi]
      const fill = filledCount < FILL_MONTHS ? fillRate : 0
      filledCount++

      const headroom = Math.max(0, maxStock - s)
      const raw = Math.max(0, dem + fill)
      const capped = Math.min(raw, headroom + dem)

      rawOrders[fi] = capped
      s = Math.max(0, s + capped - dem)
    }
  }

  // ── ШАГ 2: Округление до кратного упаковке ───────────────────────────────
  // Применяется ТОЛЬКО к прогнозным месяцам
  // Факт-месяцы (реальные отгрузки) остаются без изменений
  const packedOrders = rawOrders.map((ord, fi) => {
    if (fi < stockDateIndex) return 0
    if (isActual[fi]) return ord  // факт — без округления
    return roundUpToPack(Math.round(ord), packQty)
  })

  // ── ШАГ 3: Производственные каникулы ────────────────────────────────────
  // Перераспределяем дефицит с учётом кратности упаковке:
  //   80% → предыдущий месяц (накапливаем заранее)
  //   20% → следующий месяц (догоняем после)
  const finalOrders = [...packedOrders]

  if (settings.useHolidays && settings.holidays?.length === N) {
    for (let fi = 0; fi < N; fi++) {
      if (fi < stockDateIndex || isActual[fi]) continue

      const eff = holidayEff(settings.holidays[fi])
      if (eff >= 1) continue

      const original = finalOrders[fi]
      // Уменьшаем заказ с учётом эффективности (кратно упаковке)
      const reduced  = roundUpToPack(Math.round(original * eff), packQty)
      const deficit  = original - reduced
      if (deficit <= 0) continue

      finalOrders[fi] = reduced

      // 80% дефицита → предыдущий прогнозный месяц (кратно упаковке)
      if (fi > 0 && !isActual[fi - 1] && fi - 1 >= stockDateIndex) {
        const extra = roundUpToPack(Math.round(deficit * 0.8), packQty)
        finalOrders[fi - 1] = finalOrders[fi - 1] + extra
      }

      // 20% дефицита → следующий прогнозный месяц (кратно упаковке)
      if (fi < N - 1 && !isActual[fi + 1]) {
        const extra = roundUpToPack(Math.round(deficit * 0.2), packQty)
        finalOrders[fi + 1] = finalOrders[fi + 1] + extra
      }
    }
  }

  // ── ШАГ 4: Финальная симуляция склада ───────────────────────────────────
  const orderPlan:      number[] = new Array(N).fill(0)
  const orderPlanPacks: number[] = new Array(N).fill(0)
  const stockStart:     number[] = new Array(N).fill(0)
  const stockEnd:       number[] = new Array(N).fill(0)
  let   stock = initStock

  for (let fi = 0; fi < N; fi++) {
    if (fi < stockDateIndex) {
      stockStart[fi]     = 0
      stockEnd[fi]       = 0
      orderPlan[fi]      = 0
      orderPlanPacks[fi] = 0
      continue
    }

    stockStart[fi] = Math.round(stock)

    if (isActual[fi]) {
      // Факт: заказ = отгрузки, склад убывает на спрос
      const ord = actualVals[fi]
      orderPlan[fi]      = ord
      orderPlanPacks[fi] = packQty > 1
        ? Math.round(ord / packQty)   // для факта — просто делим (не ceil)
        : 0
      stock       = Math.max(0, stock - actualVals[fi])
      stockEnd[fi] = Math.round(stock)

    } else {
      // Прогноз: кратный заказ, склад = нач + заказ - спрос
      const dem     = demandVals[fi]
      const ord     = finalOrders[fi]
      orderPlan[fi]      = ord
      orderPlanPacks[fi] = packQty > 1 ? Math.ceil(ord / packQty) : 0
      stock       = Math.max(0, stock + ord - dem)
      stockEnd[fi] = Math.round(stock)
    }
  }

  return { orderPlan, orderPlanPacks, stockStart, stockEnd }
}
