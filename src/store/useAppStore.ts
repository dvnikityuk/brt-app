/**
 * Zustand Store — центральное хранилище состояния приложения
 *
 * КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ:
 * seasonality и settings.holidays УБРАНЫ из persist.
 * Они хранятся ТОЛЬКО в памяти (не в localStorage).
 *
 * Причина: zustand/persist при каждом рендере гидрирует store
 * из localStorage и ПЕРЕЗАПИСЫВАЕТ новые значения старыми.
 * Это означало что изменения сезонности/каникул никогда не
 * доходили до runAnalysis — всегда брались старые из localStorage.
 *
 * Решение:
 * - persist сохраняет ТОЛЬКО: obligs, versions, settings БЕЗ holidays
 * - seasonality хранится в отдельном localStorage ключе вручную
 * - holidays хранится в отдельном localStorage ключе вручную
 * - Оба читаются при инициализации store ОДИН РАЗ
 * - При изменении — сохраняются вручную через localStorage.setItem
 *   но НЕ через persist (нет автоматической гидрации)
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useMemo } from 'react'
import type {
  RawRow, StockRow, SalesPlanRow, CatalogItem,
  AnalysisResult, Settings, Version, PackagingRow, HolidayMonth
} from '../types'
import { DEF_SETTINGS, defaultHolidays } from '../constants'

// ─── Filters ─────────────────────────────────────────────────────────────────
export interface Filters {
  abc: string
  xyz: string
  cls: string
  tmcGroup: string
  search: string
}

export const DEFAULT_FILTERS: Filters = {
  abc: 'ALL',
  xyz: 'ALL',
  cls: 'ALL',
  tmcGroup: 'ALL',
  search: '',
}

// ─── Pivot Config ────────────────────────────────────────────────────────────
export interface PivotConfig {
  layers: Array<{ key: string; label: string }>
  metrics: string[]
  compareMode: 'side' | 'month'
  collapsed: Record<string, boolean>
}

// ─── Helpers: ручное чтение/запись без persist ───────────────────────────────
function readSeasonality(): number[] {
  try {
    const s = localStorage.getItem('brt-seasonality')
    if (s) return JSON.parse(s) as number[]
  } catch { /* ignore */ }
  return Array(12).fill(1) as number[]
}

function saveSeasonality(s: number[]): void {
  try { localStorage.setItem('brt-seasonality', JSON.stringify(s)) } catch { /* ignore */ }
}

function readHolidays(): HolidayMonth[] {
  try {
    const s = localStorage.getItem('brt-holidays')
    if (s) return JSON.parse(s) as HolidayMonth[]
  } catch { /* ignore */ }
  return defaultHolidays()
}

function saveHolidays(h: HolidayMonth[]): void {
  try { localStorage.setItem('brt-holidays', JSON.stringify(h)) } catch { /* ignore */ }
}

// ─── Дебаунс для тяжёлых операций localStorage ───────────────────────────────
// Предотвращает зависание UI при частых записях больших данных
function debounce<T extends (...args: Parameters<T>) => void>(fn: T, ms: number): T {
  let timer: ReturnType<typeof setTimeout>
  return ((...args: Parameters<T>) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), ms)
  }) as T
}

// Дебаунсированное сохранение rawData (тяжёлый объект)
const saveLastDataDebounced = debounce((data: unknown) => {
  try {
    localStorage.setItem('brt-lastdata', JSON.stringify(data))
  } catch { /* storage full */ }
}, 1000)

// ─── State Interface ─────────────────────────────────────────────────────────
interface AppState {
  // DATA
  rawData: RawRow[]
  stockData: StockRow[]
  salesPlan: SalesPlanRow[]
  catalog: CatalogItem[]
  catalogWarnings: string[]
  packagingData: PackagingRow[]
  packagingWarnings: string[]
  results: AnalysisResult[]

  // SETTINGS
  settings: Settings
  seasonality: number[]   // НЕ в persist — хранится вручную
  versions: Version[]

  // UI
  activeTab: string
  filters: Filters
  loading: boolean
  dataRestored: boolean

  // PIVOT CONFIGS
  pivotDemand: PivotConfig
  pivotStock: PivotConfig
  pivotPlan: PivotConfig

  // ACTIONS: Data
  setRawData: (data: RawRow[]) => void
  setStockData: (data: StockRow[]) => void
  setSalesPlan: (data: SalesPlanRow[]) => void
  setCatalog: (data: CatalogItem[]) => void
  setCatalogWarnings: (w: string[]) => void
  setPackagingData: (data: PackagingRow[]) => void
  setPackagingWarnings: (w: string[]) => void
  setResults: (results: AnalysisResult[]) => void
  clearAllData: () => void

  // ACTIONS: Settings
  setSettings: (s: Settings | ((prev: Settings) => Settings)) => void
  setSeasonality: (s: number[]) => void          // сохраняет в отдельный ключ
  setHolidays: (h: HolidayMonth[]) => void       // сохраняет в отдельный ключ
  setVersions: (v: Version[] | ((prev: Version[]) => Version[])) => void
  resetSettings: () => void

  // ACTIONS: UI
  setActiveTab: (tab: string) => void
  setFilters: (f: Filters | ((prev: Filters) => Filters)) => void
  setFilter: (key: keyof Filters, value: string) => void
  resetFilters: () => void
  setLoading: (loading: boolean) => void
  setDataRestored: (v: boolean) => void

  // ACTIONS: Pivot
  setPivotDemand: (c: PivotConfig) => void
  setPivotStock: (c: PivotConfig) => void
  setPivotPlan: (c: PivotConfig) => void
}

// ─── Default Pivot Configs ───────────────────────────────────────────────────
// КЛЮЧЕВЫЕ МЕТРИКИ для сравнения:
// - forecastVals: расчётный прогноз (ВСЕГДА — для сравнения с фактом)
// - actualVals: фактические отгрузки
// - demandVals: факт+прогноз (спрос)
// - orderPlan: план заказов (будущее)
// - orderActual: факт+план заказов (полная картина)

const defaultPivotDemand: PivotConfig = {
  layers: [{ key: 'cls', label: 'Класс ТМЦ' }, { key: 'tmcGroup', label: 'ТМЦ общее' }],
  // Показываем прогноз vs факт для сравнения
  metrics: ['forecastVals', 'actualVals'],
  compareMode: 'month',
  collapsed: {},
}

const defaultPivotStock: PivotConfig = {
  layers: [{ key: 'cls', label: 'Класс ТМЦ' }, { key: 'tmcGroup', label: 'ТМЦ общее' }],
  metrics: ['minStock', 'targetStock', 'maxStock'],
  compareMode: 'side',
  collapsed: {},
}

const defaultPivotPlan: PivotConfig = {
  layers: [{ key: 'cls', label: 'Класс ТМЦ' }, { key: 'tmcGroup', label: 'ТМЦ общее' }],
  metrics: ['demandVals', 'orderPlan'],
  compareMode: 'month',
  collapsed: {},
}

// ─── Инициализация seasonality и holidays ────────────────────────────────────
// Читаем ОДИН РАЗ при создании store из отдельных ключей
const initSeasonality = readSeasonality()
const initHolidays    = readHolidays()

// Начальные settings — без holidays из persist (holidays читается отдельно)
const initSettings: Settings = {
  ...DEF_SETTINGS,
  holidays: initHolidays,
}

// ─── Store ───────────────────────────────────────────────────────────────────
export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // INITIAL STATE
      rawData: [],
      stockData: [],
      salesPlan: [],
      catalog: [],
      catalogWarnings: [],
      packagingData: [],
      packagingWarnings: [],
      results: [],

      settings:    initSettings,
      seasonality: initSeasonality,
      versions: [],

      activeTab: 'upload',
      filters: DEFAULT_FILTERS,
      loading: false,
      dataRestored: false,

      pivotDemand: defaultPivotDemand,
      pivotStock:  defaultPivotStock,
      pivotPlan:   defaultPivotPlan,

      // ACTIONS: Data
      setRawData: (data) => {
        set({ rawData: data })
        // Дебаунс: сохраняем в localStorage через 1 сек после последнего изменения
        // Предотвращает зависание UI при загрузке большого файла
        saveLastDataDebounced({ rawData: data.slice(0, 50000), savedAt: new Date().toISOString() })
      },
      setStockData:         (data) => set({ stockData: data }),
      setSalesPlan:         (data) => set({ salesPlan: data }),
      setCatalog:           (data) => set({ catalog: data }),
      setCatalogWarnings:   (catalogWarnings) => set({ catalogWarnings }),
      setPackagingData:     (packagingData) => set({ packagingData }),
      setPackagingWarnings: (packagingWarnings) => set({ packagingWarnings }),
      setResults:           (results) => set({ results }),

      clearAllData: () => set({
        rawData: [], stockData: [], salesPlan: [], catalog: [],
        catalogWarnings: [], packagingData: [], packagingWarnings: [],
        results: [], dataRestored: false,
      }),

      // ACTIONS: Settings
      setSettings: (s) => set((state) => {
        const newSettings = typeof s === 'function' ? s(state.settings) : s
        // Если holidays изменились — сохраняем отдельно
        if (newSettings.holidays !== state.settings.holidays) {
          saveHolidays(newSettings.holidays)
        }
        return { settings: newSettings }
      }),

      // setSeasonality: сохраняет в отдельный ключ localStorage
      // НЕ через persist — нет автоматической гидрации
      setSeasonality: (seasonality) => {
        saveSeasonality(seasonality)  // вручную в localStorage
        set({ seasonality })
      },

      // setHolidays: обновляет settings.holidays + сохраняет отдельно
      setHolidays: (holidays) => {
        saveHolidays(holidays)  // вручную в localStorage
        set((state) => ({ settings: { ...state.settings, holidays } }))
      },

      setVersions: (v) => set((state) => ({
        versions: typeof v === 'function' ? v(state.versions) : v,
      })),
      resetSettings: () => {
        const defSeason = Array(12).fill(1) as number[]
        const defHolidays = defaultHolidays()
        saveSeasonality(defSeason)
        saveHolidays(defHolidays)
        set({
          settings:    { ...DEF_SETTINGS, holidays: defHolidays },
          seasonality: defSeason,
        })
      },

      // ACTIONS: UI
      setActiveTab: (activeTab) => set({ activeTab }),
      setFilters: (f) => set((state) => ({
        filters: typeof f === 'function' ? f(state.filters) : f,
      })),
      setFilter: (key, value) => set((state) => ({
        filters: { ...state.filters, [key]: value },
      })),
      resetFilters: () => set({ filters: DEFAULT_FILTERS }),
      setLoading:      (loading) => set({ loading }),
      setDataRestored: (dataRestored) => set({ dataRestored }),

      // ACTIONS: Pivot
      setPivotDemand: (pivotDemand) => set({ pivotDemand }),
      setPivotStock:  (pivotStock)  => set({ pivotStock }),
      setPivotPlan:   (pivotPlan)   => set({ pivotPlan }),
    }),
    {
      name: 'brt-storage',
      // КРИТИЧЕСКИ ВАЖНО: seasonality и holidays НЕ в partialize!
      // Они хранятся в отдельных ключах и не гидрируются автоматически.
      partialize: (state) => ({
        settings: {
          ...state.settings,
          holidays: undefined,
        },
        versions: state.versions,
      }),
      // После гидрации из persist — восстанавливаем holidays и seasonality
      // из отдельных ключей (они могли измениться)
      onRehydrateStorage: () => (state) => {
        if (!state) return
        // Восстанавливаем holidays из отдельного ключа
        const holidays = readHolidays()
        state.settings = { ...state.settings, holidays }
        // Восстанавливаем seasonality из отдельного ключа
        state.seasonality = readSeasonality()
      },
    }
  )
)

// ─── Selectors (мемоизированные) ─────────────────────────────────────────────

export const useFiltered = () => {
  const results = useAppStore((s) => s.results)
  const filters = useAppStore((s) => s.filters)

  return useMemo(() => {
    if (!results.length) return []
    const searchLower = filters.search.toLowerCase()
    return results.filter(r => {
      if (filters.abc !== 'ALL' && r.abcClass !== filters.abc) return false
      if (filters.xyz !== 'ALL' && r.xyzClass !== filters.xyz) return false
      if (filters.cls !== 'ALL' && r.cls !== filters.cls) return false
      if (filters.tmcGroup !== 'ALL' && r.tmcGroup !== filters.tmcGroup) return false
      if (searchLower && !r.name.toLowerCase().includes(searchLower) && !r.code.toLowerCase().includes(searchLower)) return false
      return true
    })
  }, [results, filters])
}

export const useFiscalMonths = () => {
  const fiscalStart = useAppStore((s) => s.settings.fiscalStart)
  return useMemo(
    () => Array.from({ length: 12 }, (_, i) => (fiscalStart - 1 + i) % 12),
    [fiscalStart]
  )
}

/**
 * Возвращает fiscalMonths начиная с последнего месяца отгрузок.
 * Используется для всех вкладок — первый месяц = последний факт.
 * Если данных нет — fallback на fiscalStart.
 */
export const useFiscalMonthsFromLastShipment = () => {
  const rawData     = useAppStore((s) => s.rawData)
  const fiscalStart = useAppStore((s) => s.settings.fiscalStart)
  const results     = useAppStore((s) => s.results)

  return useMemo(() => {
    // Определяем последний месяц с фактом
    let startCalMonth = fiscalStart - 1 // fallback

    if (results.length > 0) {
      // Из результатов анализа — последний факт-месяц
      for (let fi = 11; fi >= 0; fi--) {
        if (results.some(r => r.isActual?.[fi] === true)) {
          // fiscalMonths[fi] = calMonth
          startCalMonth = (fiscalStart - 1 + fi) % 12
          break
        }
      }
    } else if (rawData.length > 0) {
      // Из rawData напрямую
      let lastDate = rawData[0].date
      for (const r of rawData) if (r.date > lastDate) lastDate = r.date
      startCalMonth = lastDate.getMonth()
    }

    // Строим 12 месяцев начиная с startCalMonth
    return Array.from({ length: 12 }, (_, i) => (startCalMonth + i) % 12)
  }, [rawData, fiscalStart, results])
}

/**
 * Метки месяцев начиная с последнего месяца отгрузок
 */
export const useFiscalLabelsFromLastShipment = () => {
  const fiscalMonths = useFiscalMonthsFromLastShipment()
  return useMemo(
    () => fiscalMonths.map(mi => ['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек'][mi]),
    [fiscalMonths]
  )
}

export const useMonthStatus = () => {
  const results  = useAppStore((s) => s.results)
  const rawData  = useAppStore((s) => s.rawData)
  const settings = useAppStore((s) => s.settings)

  return useMemo((): ('fact' | 'current' | 'past' | 'future')[] => {
    const fsMonth = settings.fiscalStart - 1 // 0-based
    if (!rawData.length) return Array(12).fill('future') as ('fact'|'current'|'past'|'future')[]

    let lastShipDate = rawData[0].date
    for (const r of rawData) if (r.date > lastShipDate) lastShipDate = r.date

    // ─── ИСПРАВЛЕННАЯ ЛОГИКА (совпадает с buildPlanMonths в engine.ts) ──────
    // planFYStart = год начала FY который СОДЕРЖИТ lastShipDate
    // lastShipDate >= fsMonth того же года → FY начался в lastShipYear
    // lastShipDate < fsMonth → FY начался в lastShipYear - 1
    const lastShipMonth = lastShipDate.getMonth() // 0-based
    const lastShipYear  = lastShipDate.getFullYear()

    const planFYStart = lastShipMonth >= fsMonth
      ? lastShipYear       // lastShipDate внутри FY текущего года
      : lastShipYear - 1   // lastShipDate до начала FY → FY был в прошлом году

    const now = new Date()
    const nowKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

    // Строим 12 ключей планового FY
    const planKeys: string[] = []
    for (let fi = 0; fi < 12; fi++) {
      const calMonth   = (fsMonth + fi) % 12
      const yearOffset = Math.floor((fsMonth + fi) / 12)
      const calYear    = planFYStart + yearOffset
      planKeys.push(`${calYear}-${String(calMonth + 1).padStart(2, '0')}`)
    }

    // Определяем факт-месяцы:
    // Если есть результаты анализа — читаем isActual из них (engine уже вычислил)
    // Если нет — определяем по rawData напрямую
    const factFlags: boolean[] = Array(12).fill(false)
    if (results.length > 0) {
      // isActual[fi] = true означает что в rawData есть данные за planKeys[fi]
      // engine и useMonthStatus используют одну логику buildPlanMonths → синхронизированы
      for (let fi = 0; fi < 12; fi++) {
        factFlags[fi] = results.some(r => r.isActual?.[fi] === true)
      }
    } else {
      // До запуска анализа — определяем по rawData
      const dataKeys = new Set<string>()
      for (const r of rawData) {
        dataKeys.add(`${r.date.getFullYear()}-${String(r.date.getMonth() + 1).padStart(2, '0')}`)
      }
      for (let fi = 0; fi < 12; fi++) {
        factFlags[fi] = dataKeys.has(planKeys[fi])
      }
    }

    return planKeys.map((mk, fi) => {
      if (factFlags[fi]) return 'fact'    // есть данные отгрузок
      if (mk === nowKey)  return 'current' // текущий месяц
      if (mk < nowKey)    return 'past'    // прошёл, данных нет
      return 'future'                      // ещё не наступил
    })
  }, [results, rawData, settings.fiscalStart])
}

export const useLastShipmentDate = () => {
  const rawData = useAppStore((s) => s.rawData)
  return useMemo(() => {
    if (!rawData.length) return null
    return rawData.reduce((max, r) => (r.date > max ? r.date : max), rawData[0].date)
  }, [rawData])
}

export const useIsFiltered = () => {
  const filters = useAppStore((s) => s.filters)
  return useMemo(
    () =>
      filters.abc !== 'ALL' ||
      filters.xyz !== 'ALL' ||
      filters.cls !== 'ALL' ||
      filters.tmcGroup !== 'ALL' ||
      !!filters.search,
    [filters]
  )
}

export const useUniqueClasses = () => {
  const results = useAppStore((s) => s.results)
  return useMemo(() => [...new Set(results.map(r => r.cls))].sort(), [results])
}

export const useUniqueGroups = () => {
  const results = useAppStore((s) => s.results)
  return useMemo(() => [...new Set(results.map(r => r.tmcGroup))].sort(), [results])
}
