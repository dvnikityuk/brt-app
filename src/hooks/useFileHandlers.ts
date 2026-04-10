/**
 * useFileHandlers — хук для обработки загрузки файлов
 */
import { useCallback } from 'react'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { useAppStore } from '../store/useAppStore'
import { parseCatalogRows, parseDate, normCode } from '../engine'
import type { RawRow, StockRow, SalesPlanRow, PackagingRow } from '../types'

export function useFileHandlers() {
  const {
    setRawData,
    setStockData,
    setSalesPlan,
    setCatalog,
    setCatalogWarnings,
    setPackagingData,
    setPackagingWarnings,
    setDataRestored
  } = useAppStore()
  
  // ─── Generic file parser ───────────────────────────────────────────────────
  const parseFile = useCallback((
    file: File,
    onData: (rows: Record<string, unknown>[]) => void
  ) => {
    if (file.name.match(/\.(xlsx|xls)$/i)) {
      const reader = new FileReader()
      reader.onload = (e) => {
        // ВАЖНО: НЕ используем cellDates:true!
        // cellDates:true возвращает Date объекты в UTC → timezone смещение
        // Используем raw числа/строки и парсим сами через parseDate()
        // который корректно обрабатывает все форматы
        const wb = XLSX.read(new Uint8Array(e.target!.result as ArrayBuffer), {
          type: 'array',
          cellDates: false,  // ← получаем числа и строки, не Date объекты
          raw: false,        // ← форматированные строки для дат
        })
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
          wb.Sheets[wb.SheetNames[0]],
          { defval: '', raw: false }  // ← raw:false = форматированные значения
        )
        onData(rows)
      }
      reader.readAsArrayBuffer(file)
    } else {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        encoding: 'UTF-8',
        delimitersToGuess: [';', ',', '\t', '|'],
        complete: (r) => onData(r.data as Record<string, unknown>[]),
        error: () => {
          Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            delimiter: ';',
            encoding: 'windows-1251',
            complete: (r) => onData(r.data as Record<string, unknown>[])
          })
        }
      })
    }
  }, [])
  
  // ─── Catalog handler ───────────────────────────────────────────────────────
  const handleCatalogFile = useCallback((file: File) => {
    parseFile(file, (rows) => {
      const { items, warnings } = parseCatalogRows(rows)
      
      if (!items.length) {
        alert(
          `Справочник пуст или колонка "Код" не найдена.\n\n` +
          `Требуемые колонки:\n` +
          `• Код (или: code, артикул, sku)\n` +
          `• ТМЦ (или: наименование, name)\n` +
          `• Класс (или: class, категория)\n` +
          `• ТМЦ общее (или: группа тмц, раздел, tmcgroup)`
        )
        setCatalogWarnings(warnings)
        return
      }
      
      setCatalog(items)
      setCatalogWarnings(warnings)
    })
  }, [parseFile, setCatalog, setCatalogWarnings])
  
  // ─── Shipment handler ──────────────────────────────────────────────────────
  const handleShipmentFile = useCallback((file: File) => {
    parseFile(file, (rows) => {
      const parsed: RawRow[] = []
      let skipped = 0
      
      rows.forEach((r) => {
        const n: Record<string, string> = {}
        Object.keys(r).forEach((k) => {
          n[k.toLowerCase().trim().replace(/\s+/g, ' ')] = String(r[k])
        })
        
        const tmcGroup = n['тмц общее'] || n['тмц_общее'] || n['группа тмц'] || n['группа'] || 'Без группы'
        const cls = n['класс'] || n['class'] || n['категория'] || 'Без класса'
        const tmc = n['тмц'] || n['наименование'] || n['name'] || ''
        const code = n['код'] || n['артикул'] || n['code'] || ''
        const dateRaw = n['дата'] || n['date'] || n['период'] || n['месяц'] || ''
        const qtyRaw = n['количество'] || n['qty'] || n['кол-во'] || n['amount'] || '0'
        
        const date = parseDate(dateRaw)
        const qty = parseFloat(String(qtyRaw).replace(',', '.')) || 0
        
        if (!code || !date || qty <= 0) {
          skipped++
          return
        }
        
        parsed.push({
          tmcGroup,
          cls,
          tmc,
          code: normCode(code),
          date,
          qty
        })
      })
      
      console.log(`✅ Отгрузки: ${parsed.length} строк, пропущено: ${skipped}`)
      
      if (!parsed.length) {
        alert('Не удалось распознать данные.\nТребуемые колонки: ТМЦ общее, Класс, ТМЦ, Код, Дата, Количество')
        return
      }
      
      setRawData(parsed)
      setDataRestored(false)
    })
  }, [parseFile, setRawData, setDataRestored])
  
  // ─── Stock handler ─────────────────────────────────────────────────────────
  const handleStockFile = useCallback((file: File) => {
    parseFile(file, (rows) => {
      const parsed: StockRow[] = rows
        .map((r) => {
          const n: Record<string, string> = {}
          Object.keys(r).forEach((k) => {
            n[k.toLowerCase().trim()] = String(r[k])
          })
          
          const dateRaw = n['дата'] || n['date'] || n['дата остатка'] || n['на дату'] || ''
          const date = parseDate(dateRaw) || undefined
          
          return {
            code: normCode(n['код'] || n['артикул'] || n['code'] || ''),
            name: n['тмц'] || n['наименование'] || n['name'] || '',
            qty: parseFloat(String(n['количество'] || n['qty'] || n['остаток'] || n['кол-во'] || '0').replace(',', '.')) || 0,
            date
          }
        })
        .filter((r) => r.code && r.qty >= 0)
      
      console.log(`✅ Остатки: ${parsed.length} позиций`)
      setStockData(parsed)
    })
  }, [parseFile, setStockData])
  
  // ─── Sales plan handler ────────────────────────────────────────────────────
  const handleSalesPlanFile = useCallback((file: File) => {
    parseFile(file, (rows) => {
      if (!rows.length) return
      
      const parsed: SalesPlanRow[] = []
      const headers = Object.keys(rows[0])
      
      const MONTHS_LOWER = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']
      const MONTHS_FULL = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь']
      const MONTHS_EN = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
      
      const headerMonthMap = new Map<string, number>()
      
      headers.forEach((h) => {
        const raw = h.trim()
        const lo = raw.toLowerCase().replace(/\s+/g, ' ')
        
        // Parse date formats
        let m = raw.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/)
        if (m) {
          const mo = parseInt(m[2]) - 1
          if (mo >= 0 && mo < 12) {
            headerMonthMap.set(h, mo)
            return
          }
        }
        
        m = raw.match(/^(\d{4})[-/](\d{1,2})$/)
        if (m) {
          const mo = parseInt(m[2]) - 1
          if (mo >= 0 && mo < 12) {
            headerMonthMap.set(h, mo)
            return
          }
        }
        
        // Match month names
        let idx = MONTHS_LOWER.findIndex((x) => lo.startsWith(x))
        if (idx < 0) idx = MONTHS_FULL.findIndex((x) => lo === x)
        if (idx < 0) idx = MONTHS_EN.findIndex((x) => lo.startsWith(x))
        if (idx >= 0) {
          headerMonthMap.set(h, idx)
          return
        }
        
        // Numeric month
        const num = parseInt(lo)
        if (!isNaN(num) && num >= 1 && num <= 12) {
          headerMonthMap.set(h, num - 1)
        }
      })
      
      console.log(`📋 План продаж: найдено ${headerMonthMap.size} колонок месяцев`)
      
      if (headerMonthMap.size === 0) {
        alert(
          'Не найдены колонки месяцев в файле плана продаж.\n\n' +
          'Поддерживаемые форматы заголовков:\n' +
          '• 01.04.2026\n• 2026-04\n• Янв, Jan, Январь'
        )
        return
      }
      
      rows.forEach((r) => {
        const codeHeader = headers.find((h) =>
          ['код', 'code', 'артикул', 'sku'].includes(h.toLowerCase().trim())
        )
        const code = normCode((r[codeHeader || ''] as string) || '')
        
        const nameHeader = headers.find((h) =>
          ['тмц', 'наименование', 'name'].includes(h.toLowerCase().trim())
        )
        const name = String(r[nameHeader || ''] ?? '').trim()
        
        if (!code) return
        
        const months = Array(12).fill(0) as number[]
        headerMonthMap.forEach((monthIdx, header) => {
          const val = parseFloat(String(r[header] ?? '0').replace(',', '.')) || 0
          months[monthIdx] = (months[monthIdx] || 0) + val
        })
        
        parsed.push({ code, name, months })
      })
      
      console.log(`✅ План продаж: ${parsed.length} позиций`)
      
      if (!parsed.length) {
        alert('Не удалось загрузить план продаж.')
        return
      }
      
      setSalesPlan(parsed)
    })
  }, [parseFile, setSalesPlan])
  
  // ─── Packaging handler ─────────────────────────────────────────────────────
  const handlePackagingFile = useCallback((file: File) => {
    parseFile(file, (rows) => {
      if (!rows.length) {
        alert('Файл пуст')
        return
      }

      const parsed: PackagingRow[] = []
      const warnings: string[] = []

      rows.forEach((r, i) => {
        const n: Record<string, string> = {}
        Object.keys(r).forEach((k) => {
          n[k.toLowerCase().trim().replace(/\s+/g, ' ')] = String(r[k])
        })

        // Код
        const rawCode =
          n['код'] || n['code'] || n['артикул'] || n['sku'] || n['кодтмц'] || ''
        if (!rawCode.trim()) return
        const code = normCode(rawCode)

        // Наименование (необязательно)
        const name =
          n['тмц'] || n['наименование'] || n['name'] || n['номенклатура'] || rawCode

        // Количество в упаковке
        const packRaw =
          n['кол-во в упаковке'] ||
          n['количество в упаковке'] ||
          n['уп'] ||
          n['упаковка'] ||
          n['pack'] ||
          n['packqty'] ||
          n['кол упаковки'] ||
          n['в упаковке'] ||
          n['норма упаковки'] ||
          ''

        const packQty = parseFloat(String(packRaw).replace(',', '.'))

        if (!packQty || packQty <= 0) {
          warnings.push(`Строка ${i + 2}: код ${rawCode} — не найдено «Кол-во в упаковке»`)
          return
        }

        parsed.push({ code, name, packQty: Math.round(packQty) })
      })

      console.log(`✅ Упаковка: ${parsed.length} позиций, предупреждений: ${warnings.length}`)

      if (!parsed.length) {
        alert(
          'Не удалось распознать данные упаковки.\n\n' +
          'Требуемые колонки:\n' +
          '• Код (или: code, артикул, sku)\n' +
          '• Кол-во в упаковке (или: упаковка, pack, packQty, в упаковке)'
        )
        setPackagingWarnings(warnings)
        return
      }

      setPackagingData(parsed)
      setPackagingWarnings(warnings)
    })
  }, [parseFile, setPackagingData, setPackagingWarnings])

  return {
    handleCatalogFile,
    handleShipmentFile,
    handleStockFile,
    handleSalesPlanFile,
    handlePackagingFile,
  }
}
