import { useCallback } from 'react'
import { useAppStore } from '../store/useAppStore'
import type { Settings } from '../types'
import { DEF_SETTINGS, defaultHolidays } from '../constants'

export function useSettings() {
  const { settings, setSettings, setSeasonality, setHolidays, resetSettings: storeReset } = useAppStore()

  const resetSettings = useCallback(() => {
    storeReset()
  }, [storeReset])

  const applySettings = useCallback((newSettings: Partial<Settings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }))
    if (newSettings.holidays) setHolidays(newSettings.holidays)
  }, [setSettings, setHolidays])

  const resetToDefaults = useCallback(() => {
    setSettings({ ...DEF_SETTINGS, holidays: defaultHolidays() })
    setSeasonality(Array(12).fill(1))
    setHolidays(defaultHolidays())
  }, [setSettings, setSeasonality, setHolidays])

  return { settings, resetSettings, applySettings, resetToDefaults }
}
