// ═══════════════════════════════════════════════════════════════════════════
// useFiscalYear — использует buildPlanMonths() из engine
// ГАРАНТИЯ: planMonthKeys[fi] === planMonths[fi].key в engine
// → isActual[fi] в engine ВСЕГДА совпадает с factMonthsGlobal[fi] в UI
// ═══════════════════════════════════════════════════════════════════════════

import { useMemo } from 'react'
import type { RawRow, Settings, MonthStatus } from '../types'
import { MONTHS_RU, autoDetectFiscalYear } from '../constants'
import { buildPlanMonths } from '../engine'

interface UseFiscalYearReturn {
  fiscalMonths: number[]
  fiscalLabels: string[]
  fiscalLabelsExcel: string[]
  lastShipmentDate: Date | null
  activeFiscalYear: number
  planMonthKeys: string[]
  factMonthsGlobal: boolean[]
  monthStatus: MonthStatus[]
}

export function useFiscalYear(rawData: RawRow[], settings: Settings): UseFiscalYearReturn {

  // Последняя дата отгрузки
  const lastShipmentDate = useMemo(() => {
    if (!rawData.length) return null
    let max = rawData[0].date
    for (const r of rawData) if (r.date > max) max = r.date
    return max
  }, [rawData])

  // Авто-определённый фискальный год
  const activeFiscalYear = useMemo(() =>
    autoDetectFiscalYear(lastShipmentDate, settings.fiscalStart),
    [lastShipmentDate, settings.fiscalStart]
  )

  // Фискальные месяцы (индексы 0-11 в календарном порядке)
  // fiscalMonths[0] = fiscalStart-1, fiscalMonths[1] = fiscalStart, ...
  const fiscalMonths = useMemo(() =>
    Array.from({ length: 12 }, (_, i) => (settings.fiscalStart - 1 + i) % 12),
    [settings.fiscalStart]
  )

  // Простые лейблы ("Апр", "Май", ...)
  const fiscalLabels = useMemo(() =>
    fiscalMonths.map(mi => MONTHS_RU[mi]),
    [fiscalMonths]
  )

  // ─── КЛЮЧЕВОЙ МОМЕНТ: используем buildPlanMonths из engine ───────────────
  // Это ГАРАНТИРУЕТ что planMonthKeys[fi] === planMonths[fi].key в runAnalysis
  // → isActual[fi] (engine) совпадает с factMonthsGlobal[fi] (UI)
  const planMonths = useMemo(() => {
    if (!lastShipmentDate) return null
    return buildPlanMonths(lastShipmentDate, settings.fiscalStart)
  }, [lastShipmentDate, settings.fiscalStart])

  const planMonthKeys = useMemo(() =>
    planMonths ? planMonths.map(pm => pm.key) : [],
    [planMonths]
  )

  // Какие плановые месяцы имеют фактические данные отгрузок
  const factMonthsGlobal = useMemo(() => {
    if (!planMonths || !rawData.length) return Array(12).fill(false) as boolean[]

    // Строим Set всех ключей месяцев в rawData
    const dataKeys = new Set<string>()
    for (const r of rawData) {
      dataKeys.add(`${r.date.getFullYear()}-${String(r.date.getMonth() + 1).padStart(2, '0')}`)
    }

    // Проверяем каждый плановый месяц
    return planMonths.map(pm => dataKeys.has(pm.key))
  }, [planMonths, rawData])

  // Лейблы с годом для Excel ("Апр 2026", ...)
  const fiscalLabelsExcel = useMemo(() => {
    if (!planMonths) return fiscalLabels
    return planMonths.map(pm => `${MONTHS_RU[pm.calMonth]} ${pm.calYear}`)
  }, [planMonths, fiscalLabels])

  // Статус каждого месяца для цветовой индикации в UI
  const monthStatus = useMemo((): MonthStatus[] => {
    if (!planMonthKeys.length) return Array(12).fill('future') as MonthStatus[]
    const now = new Date()
    const nowKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    return planMonthKeys.map((mk, fi) => {
      if (factMonthsGlobal[fi]) return 'fact'    // ✅ Есть данные
      if (mk === nowKey) return 'current'         // 📍 Текущий месяц
      if (mk < nowKey) return 'past'              // ⏮ Прошедший (нет данных)
      return 'future'                             // 🔮 Будущий
    })
  }, [planMonthKeys, factMonthsGlobal])

  return {
    fiscalMonths,
    fiscalLabels,
    fiscalLabelsExcel,
    lastShipmentDate,
    activeFiscalYear,
    planMonthKeys,
    factMonthsGlobal,
    monthStatus,
  }
}
