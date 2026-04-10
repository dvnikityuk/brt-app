import { useCallback } from 'react'
import { useAppStore } from '../store/useAppStore'
import { useAnalysis } from './useAnalysis'
import { DEF_SETTINGS } from '../constants'
import { normCode } from '../engine'
import type { RawRow, StockRow, SalesPlanRow, PackagingRow, Settings, Version } from '../types'

interface BrtWarning { field: string; issue: string; fix: string }

function validateBrtFile(d: Record<string, unknown>): { isValid: boolean; warnings: BrtWarning[]; version: string } {
  const warnings: BrtWarning[] = []
  const version = String(d.version || '1.0')
  if (!d.rawData || !Array.isArray(d.rawData)) {
    warnings.push({ field: 'rawData', issue: 'Данные отгрузок отсутствуют', fix: 'Загрузите файл отгрузок заново' })
  }
  if (!d.settings || typeof d.settings !== 'object') {
    warnings.push({ field: 'settings', issue: 'Настройки отсутствуют', fix: 'Будут использованы значения по умолчанию' })
  }
  if (!d.seasonality || !Array.isArray(d.seasonality) || (d.seasonality as number[]).length !== 12) {
    warnings.push({ field: 'seasonality', issue: 'Сезонность отсутствует', fix: 'Сброшена до 1.0' })
  }
  if (version === '1.0') {
    warnings.push({ field: 'version', issue: 'Устаревший формат (v1.0)', fix: 'Сохраните проект заново' })
  }
  return { isValid: !!d.rawData && Array.isArray(d.rawData), warnings, version }
}

function showValidationWarnings(warnings: BrtWarning[], version: string): boolean {
  if (!warnings.length) return true
  const msg = [
    `Версия файла: ${version}`, '',
    'Предупреждения:',
    ...warnings.map((w, i) => `${i + 1}. ${w.field}: ${w.issue}\n   Действие: ${w.fix}`),
    '', 'Продолжить загрузку?',
  ].join('\n')
  return confirm(msg)
}

export function useProject() {
  const {
    rawData, stockData, salesPlan, catalog, settings, seasonality, versions,
    setRawData, setStockData, setSalesPlan, setCatalog,
    setSettings, setSeasonality, setHolidays, setVersions, setDataRestored,
    packagingData, setPackagingData,
  } = useAppStore()

  const { runAnalysisWithData } = useAnalysis()

  const saveProject = useCallback(() => {
    const data = JSON.stringify({
      rawData, stockData, salesPlan, catalog, packagingData,
      settings, seasonality, versions,
      savedAt: new Date().toISOString(), version: '2.0',
    })
    const blob = new Blob([data], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `BRT_project_${new Date().toISOString().slice(0, 10)}.brt`
    a.click()
  }, [rawData, stockData, salesPlan, catalog, packagingData, settings, seasonality, versions])

  const loadProject = useCallback((file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const d = JSON.parse(e.target!.result as string)
        const { isValid, warnings, version } = validateBrtFile(d)
        if (!isValid) { alert(`Файл повреждён.\n\n${warnings[0]?.issue || ''}`); return }
        if (warnings.length > 0 && !showValidationWarnings(warnings, version)) return

        const restoredRaw: RawRow[] = d.rawData
          ? d.rawData.map((r: RawRow & { date: string }) => ({ ...r, date: new Date(r.date), code: normCode(r.code) }))
          : []
        const restoredStock: StockRow[] = d.stockData
          ? d.stockData.map((s: StockRow & { date?: string }) => ({ ...s, code: normCode(s.code), date: s.date ? new Date(s.date) : undefined }))
          : []
        const restoredSales: SalesPlanRow[] = d.salesPlan
          ? d.salesPlan.map((sp: SalesPlanRow) => ({ ...sp, code: normCode(sp.code) }))
          : []
        const restoredPackaging: PackagingRow[] = d.packagingData
          ? d.packagingData.map((p: PackagingRow) => ({ ...p, code: normCode(p.code) }))
          : []
        const restoredSettings: Settings = d.settings ? { ...DEF_SETTINGS, ...d.settings } : DEF_SETTINGS
        const restoredSeason: number[] = Array.isArray(d.seasonality) && d.seasonality.length === 12
          ? d.seasonality : Array(12).fill(1)

        try { localStorage.removeItem('brt-storage') } catch { /* ignore */ }

        setRawData(restoredRaw); setStockData(restoredStock); setSalesPlan(restoredSales)
        setCatalog(d.catalog || []); setPackagingData(restoredPackaging)
        setVersions(d.versions || []); setDataRestored(true)
        setSettings(restoredSettings); setSeasonality(restoredSeason)
        setHolidays(restoredSettings.holidays ?? [])

        if (restoredRaw.length > 0) {
          requestAnimationFrame(() => requestAnimationFrame(() => {
            runAnalysisWithData(restoredRaw, restoredStock, restoredSales, d.catalog || [], restoredSettings, restoredSeason, restoredPackaging)
          }))
        }
      } catch (err) {
        console.error('Ошибка загрузки проекта:', err)
        alert('Ошибка загрузки проекта. Проверьте формат файла .brt')
      }
    }
    reader.readAsText(file)
  }, [setRawData, setStockData, setSalesPlan, setCatalog, setSettings, setSeasonality, setHolidays, setVersions, setDataRestored, setPackagingData, runAnalysisWithData])

  const saveSettings = useCallback(() => {
    const data = JSON.stringify({ settings, seasonality }, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `BRT_settings_${new Date().toISOString().slice(0, 10)}.json`
    a.click()
  }, [settings, seasonality])

  const loadSettings = useCallback((file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const d = JSON.parse(e.target!.result as string)
        const newSettings = d.settings ? { ...DEF_SETTINGS, ...d.settings } : null
        const newSeasonality = Array.isArray(d.seasonality) && d.seasonality.length === 12 ? d.seasonality as number[] : null
        if (newSettings) { setSettings(newSettings); if (newSettings.holidays) setHolidays(newSettings.holidays) }
        if (newSeasonality) setSeasonality(newSeasonality)
        const state = useAppStore.getState()
        if (state.rawData.length > 0) {
          requestAnimationFrame(() => requestAnimationFrame(() => {
            runAnalysisWithData(state.rawData, state.stockData, state.salesPlan, state.catalog, newSettings || state.settings, newSeasonality || state.seasonality, state.packagingData)
          }))
        }
      } catch { alert('Ошибка загрузки настроек') }
    }
    reader.readAsText(file)
  }, [setSettings, setSeasonality, setHolidays, runAnalysisWithData])

  const saveVersion = useCallback((name: string, desc: string) => {
    if (!name.trim()) return
    const version: Version = { id: Date.now().toString(), name: name.trim(), desc, date: new Date().toLocaleString('ru'), settings, seasonality }
    setVersions((prev) => [...prev, version])
  }, [settings, seasonality, setVersions])

  const loadVersion = useCallback((version: Version) => {
    try { localStorage.removeItem('brt-storage') } catch { /* ignore */ }
    setSettings(version.settings); setSeasonality(version.seasonality)
    if (version.settings.holidays) setHolidays(version.settings.holidays)
    const state = useAppStore.getState()
    if (state.rawData.length > 0) {
      requestAnimationFrame(() => requestAnimationFrame(() => {
        runAnalysisWithData(state.rawData, state.stockData, state.salesPlan, state.catalog, version.settings, version.seasonality, state.packagingData)
      }))
    }
  }, [setSettings, setSeasonality, setHolidays, runAnalysisWithData])

  const deleteVersion = useCallback((id: string) => {
    setVersions((prev) => prev.filter((v) => v.id !== id))
  }, [setVersions])

  return { saveProject, loadProject, saveSettings, loadSettings, saveVersion, loadVersion, deleteVersion }
}
