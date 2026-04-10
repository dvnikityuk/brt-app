// ═══════════════════════════════════════════════════════════════════════════
// Парсеры справочников (ТМЦ, упаковка)
// ═══════════════════════════════════════════════════════════════════════════

import type { CatalogItem, PackagingRow } from '../types'
import { normCode } from './utils'

// ─── Синонимы колонок справочника ────────────────────────────────────────────
const CATALOG_SYNONYMS: Record<string, string[]> = {
  code: [
    'код', 'code', 'артикул', 'id', 'номер', 'sku',
    'кодтмц', 'код_тмц', 'кодтовара', 'article', 'item',
  ],
  name: [
    'тмц', 'наименование', 'название', 'name', 'товар',
    'номенклатура', 'продукт', 'наим', 'itemname', 'description',
  ],
  cls: [
    'класс', 'class', 'категория', 'тип', 'вид', 'классификация',
  ],
  tmcGroup: [
    'тмц общее', 'тмцобщее', 'тмц_общее', 'tmcgroup',
    'группатмц', 'группа тмц', 'grouptmc',
    'группатоваров', 'группа товаров',
    'раздел', 'надгруппа', 'родитель', 'parent', 'section',
  ],
}

function matchCatalogCol(header: string): string | null {
  const hNorm = header.trim().toLowerCase().replace(/[\s\-_]+/g, ' ').trim()
  const hFlat = hNorm.replace(/\s+/g, '')

  // Точное совпадение
  for (const [field, syns] of Object.entries(CATALOG_SYNONYMS)) {
    for (const s of syns) {
      const sNorm = s.toLowerCase().replace(/[\s\-_]+/g, ' ').trim()
      const sFlat = sNorm.replace(/\s+/g, '')
      if (hNorm === sNorm || hFlat === sFlat) return field
    }
  }

  // Частичное совпадение (для длинных синонимов)
  for (const [field, syns] of Object.entries(CATALOG_SYNONYMS)) {
    for (const s of syns) {
      const sFlat = s.toLowerCase().replace(/[\s\-_]+/g, '').replace(/\s+/g, '')
      if (sFlat.length >= 4 && (hFlat.includes(sFlat) || sFlat.includes(hFlat))) return field
    }
  }

  return null
}

/**
 * Парсит строки Excel/CSV в список CatalogItem.
 * Автоматически определяет колонки по синонимам.
 */
export function parseCatalogRows(rows: Record<string, unknown>[]): {
  items: CatalogItem[]
  warnings: string[]
} {
  if (!rows.length) return { items: [], warnings: ['Файл пуст'] }

  const headers = Object.keys(rows[0] ?? {})
  if (!headers.length) return { items: [], warnings: ['Нет заголовков'] }

  const colMap: Record<string, string> = {}
  headers.forEach(h => {
    const f = matchCatalogCol(h)
    if (f && !colMap[f]) colMap[f] = h
  })

  const warnings: string[] = []
  if (!colMap.code)     warnings.push('Колонка "Код" не найдена')
  if (!colMap.name)     warnings.push('Колонка "ТМЦ" не найдена')
  if (!colMap.cls)      warnings.push('Колонка "Класс" не найдена')
  if (!colMap.tmcGroup) warnings.push('Колонка "ТМЦ общее" не найдена')

  const items: CatalogItem[] = []
  const seen  = new Set<string>()

  for (let i = 0; i < rows.length; i++) {
    const row     = rows[i]
    const rawCode = String(row[colMap.code] ?? '').trim()
    if (!rawCode) continue

    const code = normCode(rawCode)
    if (!code) continue

    if (seen.has(code)) {
      warnings.push(`Дубликат: "${rawCode}" (строка ${i + 2})`)
      continue
    }
    seen.add(code)

    items.push({
      code,
      name:     String(row[colMap.name]     ?? '').trim() || rawCode,
      cls:      String(row[colMap.cls]      ?? '').trim() || 'Без класса',
      tmcGroup: String(row[colMap.tmcGroup] ?? '').trim() || 'Без группы',
    })
  }

  return { items, warnings }
}

// ─── Синонимы колонок упаковки ────────────────────────────────────────────────
const PACK_COL_SYNONYMS = [
  'количество в упаковке', 'кол-во в упаковке', 'кол в упаковке',
  'упаковка', 'pack', 'packqty', 'pack qty', 'в упаковке',
  'штук в упаковке', 'шт в упаковке', 'кратность', 'кратность заказа',
  'min заказ', 'минимальный заказ', 'упаковочная единица',
]

/**
 * Парсит строки Excel/CSV в список PackagingRow.
 * Колонки: Код, [ТМЦ], Количество в упаковке
 */
export function parsePackagingRows(rows: Record<string, unknown>[]): {
  items: PackagingRow[]
  warnings: string[]
} {
  if (!rows.length) return { items: [], warnings: ['Файл пуст'] }

  const headers  = Object.keys(rows[0] ?? {})
  const warnings: string[] = []

  const codeCol = headers.find(h =>
    ['код', 'code', 'артикул', 'sku'].includes(h.toLowerCase().trim())
  )
  const nameCol = headers.find(h =>
    ['тмц', 'наименование', 'name', 'номенклатура'].includes(h.toLowerCase().trim())
  )
  const packCol = headers.find(h =>
    PACK_COL_SYNONYMS.includes(h.toLowerCase().trim())
  )

  if (!codeCol) warnings.push('Колонка "Код" не найдена')
  if (!packCol) warnings.push('Колонка "Количество в упаковке" не найдена')
  if (!codeCol || !packCol) return { items: [], warnings }

  const items: PackagingRow[] = []
  const seen  = new Set<string>()

  for (let i = 0; i < rows.length; i++) {
    const row     = rows[i]
    const rawCode = String(row[codeCol] ?? '').trim()
    if (!rawCode) continue

    const code = normCode(rawCode)
    if (!code) continue

    if (seen.has(code)) {
      warnings.push(`Дубликат: "${rawCode}" (строка ${i + 2})`)
      continue
    }
    seen.add(code)

    const packQty = parseFloat(String(row[packCol] ?? '1').replace(',', '.')) || 1
    const name    = nameCol ? String(row[nameCol] ?? '').trim() : rawCode

    items.push({
      code,
      name,
      packQty: Math.max(1, Math.round(packQty)),
    })
  }

  return { items, warnings }
}

// ─── Утилиты упаковки ────────────────────────────────────────────────────────

/** Округлить кол-во вверх до кратного упаковке */
export const roundUpToPack = (qty: number, packQty: number): number => {
  if (packQty <= 1) return qty
  return Math.ceil(qty / packQty) * packQty
}

/** Перевести штуки в количество упаковок */
export const qtyToPacks = (qty: number, packQty: number): number => {
  if (packQty <= 1) return qty
  return Math.ceil(qty / packQty)
}
