// Хук для работы с Web Worker анализа
import { useCallback, useRef, useState } from 'react'
import type { RawRow, StockRow, SalesPlanRow, CatalogItem, AnalysisResult, Settings } from '../types'

interface UseAnalysisWorkerReturn {
  results: AnalysisResult[]
  loading: boolean
  error: string | null
  runAnalysis: (
    rawData: RawRow[],
    stockData: StockRow[],
    salesPlan: SalesPlanRow[],
    catalog: CatalogItem[],
    settings: Settings,
    seasonality: number[],
    fiscalMonths: number[]
  ) => void
  cancelAnalysis: () => void
}

export function useAnalysisWorker(): UseAnalysisWorkerReturn {
  const [results, setResults] = useState<AnalysisResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const workerRef = useRef<Worker | null>(null)

  const cancelAnalysis = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.terminate()
      workerRef.current = null
      setLoading(false)
    }
  }, [])

  const runAnalysis = useCallback((
    rawData: RawRow[],
    stockData: StockRow[],
    salesPlan: SalesPlanRow[],
    catalog: CatalogItem[],
    settings: Settings,
    seasonality: number[],
    fiscalMonths: number[]
  ) => {
    // Отменяем предыдущий анализ
    cancelAnalysis()
    
    setLoading(true)
    setError(null)

    // Создаём новый воркер
    const worker = new Worker(
      new URL('../workers/analysis.worker.ts', import.meta.url),
      { type: 'module' }
    )
    workerRef.current = worker

    worker.onmessage = (e: MessageEvent) => {
      const { type, payload } = e.data
      
      if (type === 'ANALYZE_SUCCESS') {
        setResults(payload)
        setLoading(false)
        worker.terminate()
        workerRef.current = null
      } else if (type === 'ANALYZE_ERROR') {
        setError(payload)
        setLoading(false)
        worker.terminate()
        workerRef.current = null
      }
    }

    worker.onerror = (e) => {
      setError(e.message || 'Worker error')
      setLoading(false)
      worker.terminate()
      workerRef.current = null
    }

    // Отправляем данные в воркер
    worker.postMessage({
      type: 'ANALYZE',
      payload: {
        rawData,
        stockData,
        salesPlan,
        catalog,
        settings,
        seasonality,
        fiscalMonths
      }
    })
  }, [cancelAnalysis])

  return {
    results,
    loading,
    error,
    runAnalysis,
    cancelAnalysis
  }
}
