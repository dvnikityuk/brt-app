/**
 * Web Worker для тяжёлых вычислений анализа
 * Использует Comlink для типобезопасного API
 * 
 * ВАЖНО: vite-plugin-singlefile инлайнит всё в один HTML.
 * Worker создаётся через URL blob чтобы обойти ограничение.
 */
import * as Comlink from 'comlink'
import type { RawRow, StockRow, SalesPlanRow, CatalogItem, Settings, PackagingRow } from '../types'

const api = {
  async runAnalysis(
    rawData:       RawRow[],
    stockData:     StockRow[],
    salesPlan:     SalesPlanRow[],
    catalog:       CatalogItem[],
    settings:      Settings,
    seasonality:   number[],
    fiscalMonths:  number[],
    packagingData: PackagingRow[],
  ) {
    // Динамический импорт engine внутри worker
    const { runAnalysis } = await import('../engine')
    return runAnalysis(
      rawData, stockData, salesPlan, catalog,
      settings, seasonality, fiscalMonths, packagingData
    )
  }
}

Comlink.expose(api)
