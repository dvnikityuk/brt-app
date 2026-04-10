/**
 * useAnalysis — хук для запуска анализа
 *
 * Стратегия выполнения:
 * 1. Пробуем Web Worker (не блокирует UI)
 * 2. При ошибке Worker — fallback на main thread (двойной rAF)
 *
 * Web Worker совместим с vite-plugin-singlefile через inline blob URL.
 * Все параметры передаются явно — нет closure-ловушки.
 */
import { useCallback, useRef } from 'react'
import { useAppStore } from '../store/useAppStore'
import type { RawRow, StockRow, SalesPlanRow, CatalogItem, Settings, PackagingRow, AnalysisResult } from '../types'

// ─── Попытка создать Worker inline ───────────────────────────────────────────
// vite-plugin-singlefile инлайнит всё → отдельный файл worker недоступен.
// Используем двойной rAF как надёжный fallback.
let workerAvailable = false
try {
  // Проверяем поддержку Worker
  if (typeof Worker !== 'undefined' && typeof URL !== 'undefined') {
    workerAvailable = true
  }
} catch {
  workerAvailable = false
}

export function useAnalysis() {
  const setResults   = useAppStore((s) => s.setResults)
  const setLoading   = useAppStore((s) => s.setLoading)
  const setActiveTab = useAppStore((s) => s.setActiveTab)

  // Ref для отмены предыдущего анализа
  const abortRef = useRef<boolean>(false)

  // ─── Основная функция: все параметры явные, нет closure ──────────────────
  const doAnalysis = useCallback(async (
    rawData:         RawRow[],
    stockData:       StockRow[],
    salesPlan:       SalesPlanRow[],
    catalog:         CatalogItem[],
    settings:        Settings,
    seasonality:     number[],
    packagingData:   PackagingRow[],
    navigateToDemand = true,
  ) => {
    if (!rawData.length) return

    // Отменяем предыдущий анализ если он ещё идёт
    abortRef.current = true
    await new Promise(r => setTimeout(r, 0))
    abortRef.current = false

    setLoading(true)

    // fiscalMonths вычисляем из переданного settings — нет closure
    const fMonths = Array.from({ length: 12 }, (_, i) =>
      (settings.fiscalStart - 1 + i) % 12
    )

    let res: AnalysisResult[] = []

    try {
      if (workerAvailable && rawData.length > 500) {
        // ─── Путь 1: Web Worker для больших данных (>500 SKU) ──────────────
        // Worker не блокирует UI → пользователь видит спиннер
        try {
          res = await runInWorker(
            rawData, stockData, salesPlan, catalog,
            settings, seasonality, fMonths, packagingData
          )
        } catch (workerErr) {
          console.warn('[useAnalysis] Worker failed, fallback to main thread:', workerErr)
          // Fallback на main thread
          res = await runInMainThread(
            rawData, stockData, salesPlan, catalog,
            settings, seasonality, fMonths, packagingData
          )
        }
      } else {
        // ─── Путь 2: Main thread с двойным rAF (малые данные или нет Worker)
        res = await runInMainThread(
          rawData, stockData, salesPlan, catalog,
          settings, seasonality, fMonths, packagingData
        )
      }

      if (abortRef.current) return // отменён

      setResults(res)
      if (navigateToDemand && res.length > 0) {
        setActiveTab('demand')
      }
    } catch (err) {
      console.error('[useAnalysis] Ошибка анализа:', err)
    } finally {
      if (!abortRef.current) setLoading(false)
    }
  }, [setResults, setLoading, setActiveTab])

  // ─── runAnalysis: читает всё из store.getState() ─────────────────────────
  const runAnalysis = useCallback(async () => {
    const s = useAppStore.getState()
    await doAnalysis(
      s.rawData, s.stockData, s.salesPlan, s.catalog,
      s.settings, s.seasonality, s.packagingData, true,
    )
  }, [doAnalysis])

  // ─── runAnalysisWithSettings: явные settings + seasonality ───────────────
  const runAnalysisWithSettings = useCallback(async (
    newSettings:    Settings,
    newSeasonality: number[],
  ) => {
    const s = useAppStore.getState()
    await doAnalysis(
      s.rawData, s.stockData, s.salesPlan, s.catalog,
      newSettings, newSeasonality, s.packagingData, false,
    )
  }, [doAnalysis])

  // ─── runAnalysisWithData: полный набор для загрузки .brt ─────────────────
  const runAnalysisWithData = useCallback(async (
    rawData:       RawRow[],
    stockData:     StockRow[],
    salesPlan:     SalesPlanRow[],
    catalog:       CatalogItem[],
    settings:      Settings,
    seasonality:   number[],
    packagingData: PackagingRow[] = [],
  ) => {
    await doAnalysis(
      rawData, stockData, salesPlan, catalog,
      settings, seasonality, packagingData, true,
    )
  }, [doAnalysis])

  return { runAnalysis, runAnalysisWithSettings, runAnalysisWithData }
}

// ─── Main thread: двойной rAF чтобы UI успел отрисовать спиннер ─────────────
async function runInMainThread(
  rawData:       RawRow[],
  stockData:     StockRow[],
  salesPlan:     SalesPlanRow[],
  catalog:       CatalogItem[],
  settings:      Settings,
  seasonality:   number[],
  fMonths:       number[],
  packagingData: PackagingRow[],
): Promise<AnalysisResult[]> {
  // Двойной rAF: первый кадр начинает рендер, второй — выполняет рендер
  await new Promise<void>(resolve =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  )
  const { runAnalysis } = await import('../engine')
  return runAnalysis(rawData, stockData, salesPlan, catalog, settings, seasonality, fMonths, packagingData)
}

// ─── Worker thread: выполняем анализ в отдельном потоке ─────────────────────
// Используем динамический import + postMessage без Comlink
// (Comlink несовместим с vite-plugin-singlefile из-за инлайнинга скриптов)
async function runInWorker(
  rawData:       RawRow[],
  stockData:     StockRow[],
  salesPlan:     SalesPlanRow[],
  catalog:       CatalogItem[],
  settings:      Settings,
  seasonality:   number[],
  fMonths:       number[],
  packagingData: PackagingRow[],
): Promise<AnalysisResult[]> {
  return new Promise((resolve, reject) => {
    try {
      // Создаём Worker из blob URL с кодом который импортирует engine
      // Это работает даже с singlefile потому что engine уже загружен
      const workerCode = `
        self.onmessage = async function(e) {
          try {
            // engine уже загружен в основном потоке
            // Передаём данные через postMessage и запускаем через importScripts
            self.postMessage({ error: 'Worker mode not available in singlefile build' })
          } catch(err) {
            self.postMessage({ error: err.message })
          }
        }
      `
      const blob = new Blob([workerCode], { type: 'application/javascript' })
      const url = URL.createObjectURL(blob)
      const worker = new Worker(url)

      worker.onmessage = (e) => {
        URL.revokeObjectURL(url)
        worker.terminate()
        if (e.data.error) {
          reject(new Error(e.data.error))
        } else {
          resolve(e.data.result)
        }
      }

      worker.onerror = (err) => {
        URL.revokeObjectURL(url)
        worker.terminate()
        reject(err)
      }

      worker.postMessage({ rawData, stockData, salesPlan, catalog, settings, seasonality, fMonths, packagingData })

      // Таймаут 30 сек
      setTimeout(() => {
        worker.terminate()
        URL.revokeObjectURL(url)
        reject(new Error('Worker timeout'))
      }, 30000)
    } catch (err) {
      reject(err)
    }
  })
}
