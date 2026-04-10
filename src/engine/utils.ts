// ═══════════════════════════════════════════════════════════════════════════
// Математические утилиты и вспомогательные функции
// ═══════════════════════════════════════════════════════════════════════════

import type { HolidayMonth } from '../types'

export const normCode = (code: unknown): string =>
  String(code ?? '').trim().toUpperCase().replace(/\s+/g, '')

export const mean = (arr: number[]): number => {
  const len = arr.length
  if (len === 0) return 0
  let sum = 0
  for (let i = 0; i < len; i++) sum += arr[i]
  return sum / len
}

export const stdev = (arr: number[]): number => {
  const len = arr.length
  if (len < 2) return 0
  const m = mean(arr)
  let sum = 0
  for (let i = 0; i < len; i++) {
    const diff = arr[i] - m
    sum += diff * diff
  }
  return Math.sqrt(sum / (len - 1))
}

export const pct = (sorted: number[], p: number): number => {
  const len = sorted.length
  if (len === 0) return 0
  const idx = (p / 100) * (len - 1)
  const lo  = Math.floor(idx)
  const hi  = Math.ceil(idx)
  if (lo === hi) return sorted[lo]
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo)
}

export const holidayEff = (h: HolidayMonth): number =>
  Math.min(1, (h.workDays / 22) * (h.capacity / 100))

export const linTrend = (vals: number[]): number => {
  const n = vals.length
  if (n < 3) return 0
  const xm = (n - 1) / 2
  const ym = mean(vals)
  let num = 0, den = 0
  for (let i = 0; i < n; i++) {
    const dx = i - xm
    num += dx * (vals[i] - ym)
    den += dx * dx
  }
  return den && ym ? (num / den / ym) * 100 : 0
}

// Обратная функция нормального распределения (алгоритм Beasley-Springer-Moro)
export const normInv = (p: number): number => {
  const a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02,
              1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00]
  const b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02,
              6.680131188771972e+01, -1.328068155288572e+01]
  const pL = 0.02425
  let q: number, r: number
  if (p < pL) {
    q = Math.sqrt(-2 * Math.log(p))
    return (((((a[0]*q+a[1])*q+a[2])*q+a[3])*q+a[4])*q+a[5]) /
           ((((b[0]*q+b[1])*q+b[2])*q+b[3])*q+b[4]*q+1)
  }
  if (p <= 1 - pL) {
    q = p - 0.5; r = q * q
    return (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5]) * q /
           (((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1)
  }
  q = Math.sqrt(-2 * Math.log(1 - p))
  return -(((((a[0]*q+a[1])*q+a[2])*q+a[3])*q+a[4])*q+a[5]) /
           ((((b[0]*q+b[1])*q+b[2])*q+b[3])*q+b[4]*q+1)
}

export const mkMonthKey = (year: number, month0based: number): string =>
  `${year}-${String(month0based + 1).padStart(2, '0')}`

/**
 * Парсит дату из любого формата.
 * ВАЖНО: XLSX с cellDates:true возвращает Date в UTC.
 * Например 01.03.2026 → 2026-03-01T00:00:00Z
 * В timezone UTC+3 это 28.02.2026T21:00 → getMonth()=1=Февраль!
 * Решение: всегда используем UTC-методы для Date объектов из XLSX.
 */
export const parseDate = (v: unknown): Date | null => {
  if (!v) return null

  // Если уже Date объект (из XLSX cellDates:true — всегда UTC)
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return null
    // Нормализуем: берём UTC дату и создаём локальную полночь
    // чтобы getMonth()/getFullYear() давали правильные значения
    return new Date(
      v.getUTCFullYear(),
      v.getUTCMonth(),
      v.getUTCDate(),
      0, 0, 0, 0
    )
  }

  const s = String(v).trim()
  if (!s) return null

  // Excel serial number (число дней с 1900-01-01)
  // Диапазон: 5-6 цифр, типичные значения 40000-50000
  if (/^\d{5,6}$/.test(s)) {
    const serial = parseInt(s)
    // Excel неверно считает 1900 високосным → корректируем
    const offset = serial > 59 ? serial - 1 : serial
    const msPerDay = 86400000
    const epoch = new Date(1899, 11, 31).getTime()
    const d = new Date(epoch + offset * msPerDay)
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0)
  }

  // DD.MM.YYYY или DD-MM-YYYY или DD/MM/YYYY
  let m = s.match(/^(\d{1,2})[.\-\/](\d{1,2})[.\-\/](\d{4})$/)
  if (m) {
    const day = +m[1], month = +m[2] - 1, year = +m[3]
    if (month >= 0 && month < 12 && day >= 1 && day <= 31) {
      return new Date(year, month, day, 0, 0, 0, 0)
    }
  }

  // YYYY-MM-DD или YYYY/MM/DD (ISO формат)
  m = s.match(/^(\d{4})[.\-\/](\d{1,2})[.\-\/](\d{1,2})/)
  if (m) {
    const year = +m[1], month = +m[2] - 1, day = +m[3]
    if (month >= 0 && month < 12 && day >= 1 && day <= 31) {
      return new Date(year, month, day, 0, 0, 0, 0)
    }
  }

  // MM.YYYY или MM/YYYY (без дня — берём 1-е число)
  m = s.match(/^(\d{1,2})[.\-\/](\d{4})$/)
  if (m) {
    const month = +m[1] - 1, year = +m[2]
    if (month >= 0 && month < 12) {
      return new Date(year, month, 1, 0, 0, 0, 0)
    }
  }

  // Попытка стандартного парсинга
  const d = new Date(s)
  if (!isNaN(d.getTime())) {
    // Если строка содержит 'Z' или '+' — это UTC → нормализуем
    if (s.includes('Z') || s.includes('+') || s.match(/T\d{2}:/)) {
      return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0)
    }
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0)
  }

  return null
}

export const getRec = (abcxyz: string): string => ({
  AX: 'JIT, мин. страховой запас',
  AY: 'Регулярный пересчёт, умеренный буфер',
  AZ: 'Большой буфер, частый мониторинг',
  BX: 'Фиксированные заказы',
  BY: 'Периодический пересмотр',
  BZ: 'Заказ под потребность',
  CX: 'Редкие крупные заказы',
  CY: 'По мере необходимости',
  CZ: 'Рассмотреть вывод из ассортимента',
}[abcxyz] || '')
