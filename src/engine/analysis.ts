// ═══════════════════════════════════════════════════════════════════════════
// Основной анализ — runAnalysis, getMetricVals, getRowVal
// ═══════════════════════════════════════════════════════════════════════════

import type {
  RawRow, StockRow, SalesPlanRow, CatalogItem,
  AnalysisResult, Settings, PackagingRow,
} from '../types'

import { normCode, mean, stdev, linTrend, normInv, mkMonthKey } from './utils'
import { findOutliers } from './outliers'
import { holtForecast, maForecast, applySeasonality } from './forecast'
import { buildPlanMonths } from './planMonths'
import { parseCatalogRows, parsePackagingRows } from './catalog'
import { simulateOrders } from './simulation'

export { parseCatalogRows, parsePackagingRows }

// ─── Проверка и миграция устаревших .brt файлов ───────────────────────────
export function validateAndMigrateResult(r: Partial<AnalysisResult>): AnalysisResult {
  const N = 12
  const zero12 = () => new Array(N).fill(0)
  const false12 = () => new Array(N).fill(false)

  return {
    code:         r.code         ?? '',
    name:         r.name         ?? '',
    cls:          r.cls          ?? 'Без класса',
    tmcGroup:     r.tmcGroup     ?? 'Без группы',
    abcClass:     r.abcClass     ?? 'C',
    xyzClass:     r.xyzClass     ?? 'Z',
    abcxyz:       r.abcxyz       ?? 'CZ',
    abcCumPct:    r.abcCumPct    ?? 0,
    avgDemand:    r.avgDemand    ?? 0,
    stdDemand:    r.stdDemand    ?? 0,
    cv:           r.cv           ?? 0,
    trend:        r.trend        ?? 0,
    safetyStock:  r.safetyStock  ?? 0,
    minStock:     r.minStock     ?? 0,
    targetStock:  r.targetStock  ?? 0,
    maxStock:     r.maxStock     ?? 0,
    rop:          r.rop          ?? 0,
    eoq:          r.eoq          ?? 0,
    forecastVals: r.forecastVals ?? zero12(),
    totalForecast: r.totalForecast ?? 0,
    orderPlan:    r.orderPlan    ?? zero12(),
    totalOrders:  r.totalOrders  ?? 0,
    stockStart:   r.stockStart   ?? zero12(),
    stockEnd:     r.stockEnd     ?? zero12(),
    outlierCount: r.outlierCount ?? 0,
    totalPoints:  r.totalPoints  ?? 0,
    currentStock: r.currentStock ?? -1,
    stockDate:    r.stockDate    ?? '',
    stockDateIndex: r.stockDateIndex ?? 0,
    salesPlanVals: r.salesPlanVals ?? zero12(),
    forecastMethod: r.forecastMethod ?? 'ma3',
    hasSalesPlan: r.hasSalesPlan ?? false,
    annualDemand: r.annualDemand ?? 0,
    actualVals:   r.actualVals   ?? zero12(),
    isActual:     r.isActual     ?? false12(),
    demandVals:   r.demandVals   ?? r.forecastVals ?? zero12(),
    packQty:      r.packQty      ?? 1,
    orderPlanPacks: r.orderPlanPacks ?? zero12(),
    totalOrdersPacks: r.totalOrdersPacks ?? 0,
  }
}

// ─── Основной анализ ──────────────────────────────────────────────────────
export function runAnalysis(
  rawData:       RawRow[],
  stockData:     StockRow[],
  salesPlan:     SalesPlanRow[],
  catalog:       CatalogItem[],
  settings:      Settings,
  seasonality:   number[],     // [12] — коэффициенты по calendar month (0=Янв)
  fiscalMonths:  number[],     // [12] — calendar month indices для отображения
  packagingData: PackagingRow[] = []
): AnalysisResult[] {
  if (!rawData.length) return []
  const N = 12

  // ── ШАГ 1: Последняя дата отгрузки ───────────────────────────────────────
  let lastShipDate = rawData[0].date
  for (const r of rawData) if (r.date > lastShipDate) lastShipDate = r.date

  // ── ШАГ 2: Плановые месяцы (12-месячное окно FY) ─────────────────────────
  const planMonths   = buildPlanMonths(lastShipDate, settings.fiscalStart)
  const planStartKey = planMonths[0].key
  const planKeySet   = new Set(planMonths.map(pm => pm.key))

  // ── ШАГ 3: Агрегация отгрузок ────────────────────────────────────────────
  const allMonthly = new Map<string, Map<string, number>>()
  const meta       = new Map<string, { name: string; cls: string; tmcGroup: string }>()
  const catalogMap = new Map<string, CatalogItem>()
  for (const c of catalog) catalogMap.set(normCode(c.code), c)

  for (const r of rawData) {
    const code = normCode(r.code)
    if (!code || !r.date || r.qty <= 0) continue
    const key = mkMonthKey(r.date.getFullYear(), r.date.getMonth())
    if (!allMonthly.has(code)) {
      allMonthly.set(code, new Map())
      const cat = catalogMap.get(code)
      meta.set(code, {
        name:     cat?.name     || r.tmc      || code,
        cls:      cat?.cls      || r.cls      || 'Без класса',
        tmcGroup: cat?.tmcGroup || r.tmcGroup || 'Без группы',
      })
    }
    const md = allMonthly.get(code)!
    md.set(key, (md.get(key) || 0) + r.qty)
  }

  // Обогащаем мета из справочника
  for (const cat of catalog) {
    if (allMonthly.has(cat.code)) {
      meta.set(cat.code, { name: cat.name, cls: cat.cls, tmcGroup: cat.tmcGroup })
    }
  }

  // ── ШАГ 4: ABC ────────────────────────────────────────────────────────────
  const skuAnnual = new Map<string, number>()
  for (const [code, md] of allMonthly) {
    let total = 0
    for (const v of md.values()) total += v
    skuAnnual.set(code, total)
  }

  const sortedAbc = [...skuAnnual.entries()].sort((a, b) => b[1] - a[1])
  let totalDemand = 0
  for (const [, v] of sortedAbc) totalDemand += v

  const abcMap    = new Map<string, string>()
  const abcCumMap = new Map<string, number>()
  let cum = 0
  for (const [code, val] of sortedAbc) {
    cum += val
    const p = totalDemand > 0 ? (cum / totalDemand) * 100 : 0
    abcCumMap.set(code, p)
    abcMap.set(code, p <= settings.abcA ? 'A' : p <= settings.abcB ? 'B' : 'C')
  }

  // ── ШАГ 5: Вспомогательные карты ─────────────────────────────────────────
  const stockMap = new Map<string, { qty: number; date?: Date }>()
  for (const s of stockData) stockMap.set(normCode(s.code), { qty: s.qty, date: s.date })

  const salesMap = new Map<string, number[]>()
  for (const s of salesPlan) salesMap.set(normCode(s.code), s.months)

  const packMap = new Map<string, number>()
  for (const p of packagingData) packMap.set(normCode(p.code), Math.max(1, p.packQty))

  // ── ШАГ 6: Анализ по каждому SKU ─────────────────────────────────────────
  const results: AnalysisResult[] = []

  for (const [code, md] of allMonthly) {
    const info = meta.get(code)!

    // Все записи хронологически
    const allEntries = [...md.entries()].sort(([a], [b]) => a.localeCompare(b))

    // ── ОБУЧАЮЩИЕ ДАННЫЕ ────────────────────────────────────────────────────
    // ИСПРАВЛЕНИЕ: включаем факт-месяцы текущего FY в обучение!
    // Они уже произошли и содержат самые актуальные данные.
    // Исключаем только БУДУЩИЕ месяцы планового периода (где нет данных).
    //
    // Логика:
    //   - Данные ДО начала планового FY → всегда в обучении
    //   - Данные В плановом FY с фактом → тоже в обучении (они произошли!)
    //   - Данные В плановом FY без факта → НЕ в обучении (будущее)
    const trainingEntries = allEntries.filter(([key]) => {
      if (key < planStartKey) return true          // история до FY — берём
      if (planKeySet.has(key) && md.has(key)) return true  // факт в FY — тоже берём!
      return false
    })

    const useEntries = trainingEntries.length >= 2
      ? trainingEntries
      : allEntries.filter(([key]) => !planKeySet.has(key))

    const finalEntries = useEntries.length >= 1
      ? useEntries
      : allEntries

    if (!finalEntries.length) continue

    const trainingVals = finalEntries.map(([, v]) => v)

    // ── Выбросы ─────────────────────────────────────────────────────────────
    const mask        = findOutliers(trainingVals, settings.outlierMethod, settings.outlierThreshold)
    const outlierCount = mask.filter(Boolean).length
    let cleanVals     = trainingVals.filter((_, i) => !mask[i])
    if (cleanVals.length < settings.minCleanPoints || outlierCount / trainingVals.length > 0.4) {
      cleanVals = trainingVals
    }
    if (!cleanVals.length) continue

    const avg   = mean(cleanVals)
    const sd    = stdev(cleanVals)
    const cv    = avg > 0 ? sd / avg : 0
    const trend = linTrend(cleanVals)

    // ── ABC/XYZ ─────────────────────────────────────────────────────────────
    const abcClass = abcMap.get(code) || 'C'
    const xyzClass = cv <= settings.xyzX ? 'X' : cv <= settings.xyzY ? 'Y' : 'Z'
    const abcxyz   = abcClass + xyzClass

    // ── Нормативы склада ────────────────────────────────────────────────────
    const abcKey = abcClass as 'A' | 'B' | 'C'
    const sl = (settings.abcOverride
      ? (settings.abcSettings[abcKey]?.serviceLevel ?? settings.serviceLevel)
      : settings.serviceLevel) / 100
    const lt = settings.abcOverride
      ? (settings.abcSettings[abcKey]?.leadTime ?? settings.leadTime)
      : settings.leadTime

    const z           = normInv(sl)
    const ltm         = lt / 30
    const packQty     = packMap.get(code) ?? 1

    // Вспомогательная функция — округление вверх до кратного упаковке
    const roundUp = (v: number) =>
      packQty > 1 ? Math.ceil(v / packQty) * packQty : Math.round(v)

    // Нормативы — кратны упаковке (физически на складе целые упаковки)
    const ssRaw       = Math.max(0, z * sd * Math.sqrt(ltm))
    const ss          = roundUp(ssRaw)
    const coverMonths = Math.max(1, ltm)
    const targetStock = roundUp(ss + avg * coverMonths)
    const eoq         = roundUp(Math.max(avg, Math.round(avg * Math.sqrt(2 / 0.2))))
    const maxStock    = roundUp(ss + eoq)
    const rop         = roundUp(avg * ltm + ss)

    // ── ПРОГНОЗ ─────────────────────────────────────────────────────────────
    let method = settings.forecastMethod
    let baseForecast: number[]

    if (method === 'auto') {
      if (cv <= settings.xyzX) {
        baseForecast = maForecast(cleanVals, 3, N)
        method = 'ma3'
      } else {
        baseForecast = holtForecast(cleanVals, settings.forecastAlpha, settings.forecastBeta, N)
        method = 'holt'
      }
    } else if (method === 'ma3') {
      baseForecast = maForecast(cleanVals, 3, N)
    } else if (method === 'ma6') {
      baseForecast = maForecast(cleanVals, 6, N)
    } else {
      baseForecast = holtForecast(cleanVals, settings.forecastAlpha, settings.forecastBeta, N)
    }

    // Применяем сезонность
    const forecastVals = applySeasonality(baseForecast, fiscalMonths, seasonality)

    // ── ФАКТ vs ПРОГНОЗ ─────────────────────────────────────────────────────
    const isActual:   boolean[] = planMonths.map(pm => md.has(pm.key))
    const actualVals: number[]  = planMonths.map((pm, fi) =>
      isActual[fi] ? (md.get(pm.key) || 0) : 0
    )
    const demandVals: number[] = planMonths.map((_, fi) =>
      isActual[fi] ? actualVals[fi] : forecastVals[fi]
    )

    // ── ОСТАТКИ ─────────────────────────────────────────────────────────────
    const stockEntry   = stockMap.get(code)
    const currentStock = stockEntry ? stockEntry.qty : -1
    const stockDate    = stockEntry?.date
    const hasStock     = currentStock >= 0

    let stockDateIndex = 0
    let stockDateLabel = ''
    if (stockDate) {
      const sdKey = mkMonthKey(stockDate.getFullYear(), stockDate.getMonth())
      const fi    = planMonths.findIndex(pm => pm.key === sdKey)
      if (fi >= 0) {
        stockDateIndex = fi
      } else if (sdKey < planMonths[0].key) {
        stockDateIndex = 0
      } else {
        stockDateIndex = N
      }
      stockDateLabel = `${String(stockDate.getMonth() + 1).padStart(2, '0')}.${stockDate.getFullYear()}`
    }

    // ── ПЛАН ПРОДАЖ ─────────────────────────────────────────────────────────
    const rawSP = salesMap.get(code) ?? null
    const salesPlanVals: number[] = rawSP
      ? fiscalMonths.map(mi => rawSP[mi] ?? 0)
      : new Array(N).fill(0)
    const hasSalesPlan = rawSP !== null && rawSP.some(v => v > 0)

    // ── РАСЧЁТ ЗАКАЗОВ И СИМУЛЯЦИЯ СКЛАДА ───────────────────────────────────
    const initStock = hasStock ? currentStock : 0

    const { orderPlan, orderPlanPacks, stockStart, stockEnd } = simulateOrders({
      demandVals,
      actualVals,
      isActual,
      initStock,
      targetStock,
      maxStock,
      stockDateIndex,
      packQty,
      settings,
    })

    results.push({
      code, name: info.name, cls: info.cls, tmcGroup: info.tmcGroup,
      abcClass, xyzClass, abcxyz,
      abcCumPct:   abcCumMap.get(code) || 0,
      avgDemand:   avg,
      stdDemand:   sd,
      cv, trend,
      safetyStock: ss,
      minStock:    ss,
      targetStock, maxStock, rop, eoq,
      forecastVals,
      totalForecast: forecastVals.reduce((s, v) => s + v, 0),
      orderPlan,
      totalOrders:   orderPlan.reduce((s, v) => s + v, 0),
      stockStart, stockEnd,
      outlierCount,
      totalPoints: allEntries.length,
      currentStock,
      stockDate: stockDateLabel,
      stockDateIndex,
      salesPlanVals, hasSalesPlan,
      forecastMethod: method,
      annualDemand: skuAnnual.get(code) || 0,
      actualVals, isActual, demandVals,
      packQty,
      orderPlanPacks,
      totalOrdersPacks: orderPlanPacks.reduce((s, v) => s + v, 0),
    })
  }

  return results
}

// ─── Pivot helpers ────────────────────────────────────────────────────────────
export function getMetricVals(r: AnalysisResult, metric: string, fiscalMonths: number[]): number[] {
  switch (metric) {
    // Расчётный прогноз × сезонность (ВСЕГДА, даже для факт-месяцев — для сравнения!)
    case 'forecastVals':  return r.forecastVals

    // Только факт из файла отгрузок (0 для будущих месяцев)
    case 'actualVals':    return r.actualVals || new Array(12).fill(0)

    // Спрос = факт где есть, прогноз где нет
    case 'demandVals':    return r.demandVals || r.forecastVals

    // Заказ = actualVals для факт-месяцев, расчётный для прогноза
    case 'orderPlan':     return r.orderPlan

    // Движение склада
    case 'stockStart':    return r.stockStart
    case 'stockEnd':      return r.stockEnd

    // Нормативы (одно значение на все месяцы)
    case 'minStock':      return fiscalMonths.map(() => Math.round(r.minStock))
    case 'maxStock':      return fiscalMonths.map(() => Math.round(r.maxStock))
    case 'targetStock':   return fiscalMonths.map(() => Math.round(r.targetStock))
    case 'safetyStock':   return fiscalMonths.map(() => Math.round(r.safetyStock))

    // Прочее
    case 'salesPlanVals': return r.salesPlanVals.slice(0, 12)
    case 'avgDemand':     return fiscalMonths.map(() => Math.round(r.avgDemand))

    default:              return new Array(12).fill(0)
  }
}

export function getRowVal(r: AnalysisResult, key: string): string {
  switch (key) {
    case 'cls':      return r.cls
    case 'tmcGroup': return r.tmcGroup
    case 'name':     return r.name
    case 'abcClass': return r.abcClass
    case 'xyzClass': return r.xyzClass
    case 'abcxyz':   return r.abcxyz
    default:         return ''
  }
}
