// ═══════════════════════════════════════════════════════════════════════════
// Плановые месяцы — единый источник правды для engine И useFiscalYear
// ═══════════════════════════════════════════════════════════════════════════

import { mkMonthKey } from './utils'

export interface PlanMonth {
  fi:       number   // fiscal index (0..11)
  calMonth: number   // calendar month 0-based (0=Янв, 11=Дек)
  calYear:  number   // calendar year
  key:      string   // "YYYY-MM"
}

/**
 * Строит 12-месячное окно фискального года содержащего lastShipDate.
 *
 * Алгоритм:
 *   1. Определяем FY содержащий lastShipDate:
 *      lastShipMonth >= fsMonth → FY начался в lastShipYear
 *      lastShipMonth < fsMonth  → FY начался в lastShipYear - 1
 *
 *   2. Строим 12 месяцев начиная с fsMonth
 *
 * Примеры (fiscalStart=4 → апрель):
 *   lastShip = Июн 2026 → planFYStart=2026 → [Апр2026..Мар2027]
 *   lastShip = Мар 2026 → planFYStart=2025 → [Апр2025..Мар2026]
 *   lastShip = Дек 2026 → planFYStart=2026 → [Апр2026..Мар2027]
 *
 * ВАЖНО: эта же функция используется в useFiscalYear → синхронизация гарантирована
 */
export function buildPlanMonths(lastShipDate: Date, fiscalStart: number): PlanMonth[] {
  const fsMonth       = fiscalStart - 1  // 0-based
  const lastShipMonth = lastShipDate.getMonth()
  const lastShipYear  = lastShipDate.getFullYear()

  // FY начался в lastShipYear если lastShip ≥ fsMonth
  // FY начался в lastShipYear-1 если lastShip < fsMonth
  const planFYStart = lastShipMonth >= fsMonth ? lastShipYear : lastShipYear - 1

  const months: PlanMonth[] = []
  for (let fi = 0; fi < 12; fi++) {
    const calMonth   = (fsMonth + fi) % 12
    const yearOffset = Math.floor((fsMonth + fi) / 12)
    const calYear    = planFYStart + yearOffset
    months.push({ fi, calMonth, calYear, key: mkMonthKey(calYear, calMonth) })
  }
  return months
}
