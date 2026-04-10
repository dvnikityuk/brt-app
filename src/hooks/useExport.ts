import { useCallback } from 'react'
import * as XLSX from 'xlsx'
import { useAppStore, useFiscalMonths } from '../store/useAppStore'
import { MONTHS_RU } from '../constants'
import { getRec } from '../engine'

export function useExport() {
  const { results, catalog, settings } = useAppStore()
  const fiscalMonths = useFiscalMonths()

  const getFiscalLabelsWithYear = useCallback(() => {
    const fiscalYear = settings.fiscalYear
    return fiscalMonths.map((mi) => {
      const yearOffset = mi < settings.fiscalStart - 1 ? 1 : 0
      const year = fiscalYear + yearOffset
      return `${MONTHS_RU[mi]} ${year}`
    })
  }, [fiscalMonths, settings])

  const exportExcel = useCallback(async () => {
    if (!results.length) return
    const fiscalLabelsExcel = getFiscalLabelsWithYear()
    const wb = XLSX.utils.book_new()

    // Sheet 1: Summary
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        results.map((r) => ({
          'ТМЦ общее': r.tmcGroup,
          'Класс': r.cls,
          'Наименование': r.name,
          'Код': r.code,
          'ABC': r.abcClass,
          'XYZ': r.xyzClass,
          'ABC-XYZ': r.abcxyz,
          'Ср. спрос': Math.round(r.avgDemand),
          'CV': +r.cv.toFixed(3),
          'Тренд %': +r.trend.toFixed(1),
          'Страховой': Math.round(r.safetyStock),
          'Min склад': Math.round(r.minStock),
          'Целевой': Math.round(r.targetStock),
          'Max склад': Math.round(r.maxStock),
          'ROP': Math.round(r.rop),
          'EOQ': Math.round(r.eoq),
          'Год. прогноз': r.totalForecast,
          'Год. заказ': r.totalOrders,
          'Рекомендация': getRec(r.abcxyz),
        }))
      ),
      'Сводка'
    )

    // Sheet 2: Order Matrix
    const sortedAll = [...results].sort((a, b) =>
      (a.cls + a.tmcGroup + a.name).localeCompare(b.cls + b.tmcGroup + b.name)
    )

    const matrixRows = sortedAll.map((r) => {
      const row: Record<string, string | number> = {
        'Класс': r.cls,
        'ТМЦ общее': r.tmcGroup,
        'ТМЦ': r.name,
        'Код': r.code,
      }
      let total = 0
      fiscalLabelsExcel.forEach((label, fi) => {
        const isFact = r.isActual?.[fi] ?? false
        const val = isFact ? (r.actualVals?.[fi] ?? 0) : r.orderPlan[fi]
        row[label + (isFact ? ' (Ф)' : '')] = val
        total += val
      })
      row['Итого'] = total
      return row
    })

    const wsMatrix = XLSX.utils.json_to_sheet(matrixRows)
    wsMatrix['!cols'] = Object.keys(matrixRows[0] || {}).map((_, i) => ({
      wch: i === 2 ? 35 : i < 4 ? 20 : 9,
    }))
    XLSX.utils.book_append_sheet(wb, wsMatrix, 'Матрица заказов')

    // Sheet 3: Forecast
    const forecastRows = sortedAll.map((r) => {
      const row: Record<string, string | number> = {
        'Класс': r.cls,
        'ТМЦ общее': r.tmcGroup,
        'ТМЦ': r.name,
        'Код': r.code,
      }
      fiscalLabelsExcel.forEach((label, fi) => {
        const val = r.demandVals?.[fi] ?? r.forecastVals[fi]
        const isFact = r.isActual?.[fi] ?? false
        row[label + (isFact ? ' (Ф)' : '')] = val
      })
      row['Итого'] = r.demandVals?.reduce((s, v) => s + v, 0) ?? r.totalForecast
      return row
    })
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(forecastRows), 'Прогноз')

    // Sheet 4: Catalog
    if (catalog.length) {
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(
          catalog.map((c) => ({
            'Код': c.code,
            'Наименование': c.name,
            'Класс': c.cls,
            'ТМЦ общее': c.tmcGroup,
          }))
        ),
        'Справочник ТМЦ'
      )
    }

    XLSX.writeFile(wb, `BRT_${new Date().getFullYear()}.xlsx`)
  }, [results, catalog, getFiscalLabelsWithYear])

  return { exportExcel }
}
