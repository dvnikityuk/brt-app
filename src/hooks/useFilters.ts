/**
 * useFilters — хук для работы с фильтрами
 *
 * Единый источник правды: всё хранится в useAppStore
 * Нет дублирования логики фильтрации — useFiltered() из store.
 *
 * Использование:
 *   const { filters, setFilter, resetFilters, filtered, isFiltered } = useFilters()
 */
import { useCallback } from 'react'
import {
  useAppStore,
  useFiltered,
  useIsFiltered,
  useUniqueClasses,
  useUniqueGroups,
  type Filters,
} from '../store/useAppStore'

export type { Filters }

export function useFilters() {
  const filters    = useAppStore((s) => s.filters)
  const setFilters = useAppStore((s) => s.setFilters)
  const setFilter  = useAppStore((s) => s.setFilter)
  const resetFilters = useAppStore((s) => s.resetFilters)

  // Мемоизированные данные из store
  const filtered      = useFiltered()
  const isFiltered    = useIsFiltered()
  const uniqueClasses = useUniqueClasses()
  const uniqueGroups  = useUniqueGroups()

  // Хелпер для обновления через spread (для совместимости с FilterBar)
  const onFilters = useCallback(
    (f: Filters) => setFilters(f),
    [setFilters]
  )

  return {
    filters,
    setFilters: onFilters,
    setFilter,
    resetFilters,
    filtered,
    isFiltered,
    uniqueClasses,
    uniqueGroups,
  }
}
