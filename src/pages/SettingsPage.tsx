/**
 * SettingsPage — настройки анализа
 *
 * ИЗМЕНЕНИЕ: Убран ручной выбор "Начало фискального года".
 * Период определяется АВТОМАТИЧЕСКИ из lastShipDate.
 * fiscalStart теперь означает только ПОРЯДОК ОТОБРАЖЕНИЯ колонок.
 *
 * Пользователь видит информационный блок:
 *   "Данные по: Июн 2026 → Прогноз: Июл 2026 — Июн 2027"
 */
import { memo, useCallback, useRef, useMemo } from 'react'
import { useAppStore, useLastShipmentDate } from '../store/useAppStore'
import { useAnalysis } from '../hooks/useAnalysis'
import { useProject } from '../hooks/useProject'
import { MONTHS_RU, DEF_SETTINGS, defaultHolidays } from '../constants'
import { normInv, buildPlanMonths } from '../engine'
import { SeasonalityEditor } from '../components/SeasonalityEditor'
import { HolidaysEditor } from '../components/HolidaysEditor'
import type { Settings } from '../types'

const SettingsPage = memo(() => {
  const settings    = useAppStore((s) => s.settings)
  const seasonality = useAppStore((s) => s.seasonality)
  const rawData     = useAppStore((s) => s.rawData)
  const results     = useAppStore((s) => s.results)
  const loading     = useAppStore((s) => s.loading)

  const setSettings    = useAppStore((s) => s.setSettings)
  const setSeasonality = useAppStore((s) => s.setSeasonality)
  const setHolidays    = useAppStore((s) => s.setHolidays)

  const { runAnalysisWithSettings } = useAnalysis()
  const { saveSettings, loadSettings } = useProject()
  const lastShipDate = useLastShipmentDate()

  const settingsFileRef = useRef<HTMLInputElement>(null)

  const hasData = rawData.length > 0

  // ── Плановые месяцы (для информационного блока) ────────────────────────
  const planInfo = useMemo(() => {
    if (!lastShipDate) return null
    const planMonths = buildPlanMonths(lastShipDate, settings.fiscalStart)
    const first = planMonths[0]
    const last  = planMonths[11]
    // Находим первый прогнозный месяц
    const firstForecastFi = planMonths.findIndex(pm => {
      const key = pm.key
      const dataKeys = new Set(rawData.map(r =>
        `${r.date.getFullYear()}-${String(r.date.getMonth() + 1).padStart(2, '0')}`
      ))
      return !dataKeys.has(key)
    })
    return {
      periodLabel: `${MONTHS_RU[first.calMonth]} ${first.calYear} — ${MONTHS_RU[last.calMonth]} ${last.calYear}`,
      factCount: firstForecastFi < 0 ? 12 : firstForecastFi,
      forecastFrom: firstForecastFi >= 0
        ? `${MONTHS_RU[planMonths[firstForecastFi].calMonth]} ${planMonths[firstForecastFi].calYear}`
        : null,
    }
  }, [lastShipDate, settings.fiscalStart, rawData])

  const fiscalMonths = useMemo(
    () => Array.from({ length: 12 }, (_, i) => (settings.fiscalStart - 1 + i) % 12),
    [settings.fiscalStart]
  )

  // ── Изменение настроек ──────────────────────────────────────────────────
  const handleSettings = useCallback((newSettings: Settings) => {
    setSettings(newSettings)
    if (hasData) {
      const currentSeasonality = useAppStore.getState().seasonality
      runAnalysisWithSettings(newSettings, currentSeasonality)
    }
  }, [setSettings, hasData, runAnalysisWithSettings])

  const set = useCallback(<K extends keyof Settings>(key: K, val: Settings[K]) => {
    handleSettings({ ...settings, [key]: val })
  }, [settings, handleSettings])

  // ── Изменение сезонности ────────────────────────────────────────────────
  const handleSeasonality = useCallback((newSeasonality: number[]) => {
    setSeasonality(newSeasonality)
    if (hasData) {
      const currentSettings = useAppStore.getState().settings
      runAnalysisWithSettings(currentSettings, newSeasonality)
    }
  }, [setSeasonality, hasData, runAnalysisWithSettings])

  // ── Изменение каникул ───────────────────────────────────────────────────
  // Вызывается из HolidaysEditor при любом изменении (toggle, слайдеры, пресет)
  const handleSettingsFromHolidays = useCallback((newSettings: Settings) => {
    setSettings(newSettings)
    setHolidays(newSettings.holidays)
    if (hasData) {
      const currentSeasonality = useAppStore.getState().seasonality
      runAnalysisWithSettings(newSettings, currentSeasonality)
    }
  }, [setSettings, setHolidays, hasData, runAnalysisWithSettings])

  // ── Сброс ───────────────────────────────────────────────────────────────
  const handleReset = useCallback(() => {
    const defSeason   = Array(12).fill(1) as number[]
    const defHolidays = defaultHolidays()
    const defSettings = { ...DEF_SETTINGS, holidays: defHolidays }
    setSettings(defSettings)
    setSeasonality(defSeason)
    setHolidays(defHolidays)
    if (hasData) runAnalysisWithSettings(defSettings, defSeason)
  }, [setSettings, setSeasonality, setHolidays, hasData, runAnalysisWithSettings])

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', padding: '10px 14px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', flex: 1 }}>Настройки анализа</span>
        <button onClick={saveSettings} style={{ padding: '6px 14px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>
          Сохранить .json
        </button>
        <button onClick={() => settingsFileRef.current?.click()} style={{ padding: '6px 14px', background: '#f8fafc', color: '#374151', border: '1px solid #e2e8f0', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>
          Загрузить
        </button>
        <input ref={settingsFileRef} type="file" accept=".json" style={{ display: 'none' }}
          onChange={e => { if (e.target.files?.[0]) loadSettings(e.target.files[0]) }} />
        <button onClick={handleReset} style={{ padding: '6px 14px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>
          Сброс
        </button>
      </div>

      {/* Статус пересчёта */}
      {results.length > 0 && (
        <div style={{ padding: '8px 14px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, fontSize: 12, color: '#166534', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>Изменение настроек автоматически пересчитывает анализ ({results.length} SKU).</span>
          {loading && <span style={{ color: '#2563eb', fontWeight: 600 }}>Пересчёт...</span>}
        </div>
      )}

      {/* Информационный блок периода — ВМЕСТО ручного выбора месяца */}
      <div style={{ padding: '10px 14px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12 }}>
        <div style={{ fontWeight: 700, color: '#1e293b', marginBottom: 6 }}>
          Плановый период (определяется автоматически из данных отгрузок)
        </div>
        {lastShipDate && planInfo ? (
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center' }}>
            <div>
              <span style={{ color: '#64748b' }}>Последняя отгрузка: </span>
              <span style={{ fontWeight: 600, color: '#1e293b' }}>
                {MONTHS_RU[lastShipDate.getMonth()]} {lastShipDate.getFullYear()}
              </span>
            </div>
            <div>
              <span style={{ color: '#64748b' }}>Период: </span>
              <span style={{ fontWeight: 600, color: '#2563eb' }}>{planInfo.periodLabel}</span>
            </div>
            {planInfo.factCount > 0 && (
              <div>
                <span style={{ color: '#64748b' }}>Факт: </span>
                <span style={{ fontWeight: 600, color: '#166534' }}>{planInfo.factCount} мес.</span>
              </div>
            )}
            {planInfo.forecastFrom && (
              <div>
                <span style={{ color: '#64748b' }}>Прогноз с: </span>
                <span style={{ fontWeight: 600, color: '#7c3aed' }}>{planInfo.forecastFrom}</span>
              </div>
            )}
          </div>
        ) : (
          <div style={{ color: '#94a3b8' }}>
            Загрузите данные отгрузок — период определится автоматически
          </div>
        )}
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ color: '#64748b', fontSize: 11 }}>
              Порядок отображения колонок начиная с:
            </span>
            <select
              value={settings.fiscalStart}
              onChange={e => set('fiscalStart', +e.target.value)}
              style={{ padding: '4px 8px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 11, color: '#374151' }}
            >
              {MONTHS_RU.map((m, i) => (
                <option key={i} value={i + 1}>{m}</option>
              ))}
            </select>
            <span style={{ fontSize: 11, color: '#94a3b8' }}>
              (не влияет на расчёт факта/прогноза — только на порядок колонок)
            </span>
          </div>
        </div>
      </div>

      {/* Основные параметры */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>

        {/* Общие */}
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#1e293b', marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid #f1f5f9' }}>
            Общие параметры
          </div>
          {([
            { label: 'Уровень сервиса', key: 'serviceLevel' as const, min: 80, max: 99, unit: '%', step: 1 },
            { label: 'Срок поставки (дни)', key: 'leadTime' as const, min: 1, max: 180, unit: ' дн', step: 1 },
          ]).map(({ label, key, min, max, unit, step }) => (
            <div key={key} style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 11, color: '#64748b', display: 'block', marginBottom: 3 }}>{label}</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="range" min={min} max={max} step={step}
                  value={settings[key] as number}
                  onChange={e => set(key, +e.target.value)}
                  style={{ flex: 1, accentColor: '#2563eb' }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: '#2563eb', minWidth: 46, textAlign: 'right' }}>
                  {settings[key] as number}{unit}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Выбросы */}
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#1e293b', marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid #f1f5f9' }}>
            Выбросы
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 11, color: '#64748b', display: 'block', marginBottom: 3 }}>Метод</label>
            <select value={settings.outlierMethod}
              onChange={e => set('outlierMethod', e.target.value)}
              style={{ width: '100%', padding: '6px 8px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 12 }}>
              <option value="iqr">IQR (межквартильный)</option>
              <option value="zscore">Z-Score</option>
              <option value="mad">MAD (медианное)</option>
              <option value="none">Не применять</option>
            </select>
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 11, color: '#64748b', display: 'block', marginBottom: 3 }}>
              Порог = {settings.outlierThreshold.toFixed(1)}
            </label>
            <input type="range" min={1} max={3} step={0.1}
              value={settings.outlierThreshold}
              onChange={e => set('outlierThreshold', +e.target.value)}
              style={{ width: '100%', accentColor: '#f59e0b' }} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: '#64748b', display: 'block', marginBottom: 3 }}>
              Мин. чистых точек = {settings.minCleanPoints}
            </label>
            <input type="range" min={1} max={6} step={1}
              value={settings.minCleanPoints}
              onChange={e => set('minCleanPoints', +e.target.value)}
              style={{ width: '100%', accentColor: '#f59e0b' }} />
          </div>
        </div>

        {/* Прогноз */}
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#1e293b', marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid #f1f5f9' }}>
            Прогнозирование
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 11, color: '#64748b', display: 'block', marginBottom: 3 }}>Метод</label>
            <select value={settings.forecastMethod}
              onChange={e => set('forecastMethod', e.target.value)}
              style={{ width: '100%', padding: '6px 8px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 12 }}>
              <option value="auto">Авто (по XYZ)</option>
              <option value="holt">Холт (с трендом)</option>
              <option value="ma3">MA-3 (3 мес.)</option>
              <option value="ma6">MA-6 (6 мес.)</option>
            </select>
          </div>
          {['holt', 'auto'].includes(settings.forecastMethod) && (
            <>
              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 11, color: '#64748b', display: 'block', marginBottom: 3 }}>
                  α (уровень) = {settings.forecastAlpha}
                </label>
                <input type="range" min={0.1} max={0.9} step={0.05}
                  value={settings.forecastAlpha}
                  onChange={e => set('forecastAlpha', +e.target.value)}
                  style={{ width: '100%', accentColor: '#8b5cf6' }} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: '#64748b', display: 'block', marginBottom: 3 }}>
                  β (тренд) = {settings.forecastBeta}
                </label>
                <input type="range" min={0.05} max={0.5} step={0.05}
                  value={settings.forecastBeta}
                  onChange={e => set('forecastBeta', +e.target.value)}
                  style={{ width: '100%', accentColor: '#8b5cf6' }} />
              </div>
            </>
          )}
        </div>

        {/* ABC/XYZ */}
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#1e293b', marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid #f1f5f9' }}>
            Границы ABC / XYZ
          </div>
          {([
            { label: 'A: до % оборота', key: 'abcA' as const, min: 50, max: 90, step: 1, color: '#16a34a' },
            { label: 'B: до % оборота', key: 'abcB' as const, min: 85, max: 99, step: 1, color: '#d97706' },
            { label: 'X: CV до',        key: 'xyzX' as const, min: 0.05, max: 0.3, step: 0.01, color: '#2563eb' },
            { label: 'Y: CV до',        key: 'xyzY' as const, min: 0.15, max: 0.5, step: 0.01, color: '#7c3aed' },
          ]).map(({ label, key, min, max, step, color }) => (
            <div key={key} style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 11, color: '#64748b', display: 'block', marginBottom: 3 }}>{label}</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="range" min={min} max={max} step={step}
                  value={settings[key] as number}
                  onChange={e => set(key, +e.target.value)}
                  style={{ flex: 1, accentColor: color }} />
                <span style={{ fontSize: 12, fontWeight: 700, color, minWidth: 40 }}>
                  {settings[key] as number}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ABC-классы индивидуальные */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <input type="checkbox" id="abcOv" checked={settings.abcOverride}
            onChange={e => set('abcOverride', e.target.checked)}
            style={{ width: 15, height: 15 }} />
          <label htmlFor="abcOv" style={{ fontSize: 12, fontWeight: 600, cursor: 'pointer', color: '#1e293b' }}>
            Индивидуальные параметры для A, B, C классов
          </label>
          {settings.abcOverride && (
            <span style={{ background: '#f0fdf4', color: '#166534', padding: '1px 8px', borderRadius: 10, fontSize: 10, fontWeight: 600 }}>
              Вкл
            </span>
          )}
        </div>

        {settings.abcOverride && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {(['A', 'B', 'C'] as const).map(cl => (
              <div key={cl} style={{
                background: cl === 'A' ? '#f0fdf4' : cl === 'B' ? '#fefce8' : '#fef2f2',
                border: `1px solid ${cl === 'A' ? '#86efac' : cl === 'B' ? '#fcd34d' : '#fca5a5'}`,
                borderRadius: 8, padding: 12,
              }}>
                <div style={{
                  fontWeight: 700, fontSize: 13, marginBottom: 10,
                  color: cl === 'A' ? '#166534' : cl === 'B' ? '#854d0e' : '#991b1b',
                }}>
                  Класс {cl}
                </div>
                <div style={{ marginBottom: 8 }}>
                  <label style={{ fontSize: 10, color: '#64748b', display: 'block', marginBottom: 2 }}>
                    Уровень сервиса
                  </label>
                  <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                    <input type="range" min={80} max={99}
                      value={settings.abcSettings[cl].serviceLevel}
                      onChange={e => handleSettings({
                        ...settings,
                        abcSettings: {
                          ...settings.abcSettings,
                          [cl]: { ...settings.abcSettings[cl], serviceLevel: +e.target.value },
                        },
                      })}
                      style={{ flex: 1 }} />
                    <span style={{ fontWeight: 700, fontSize: 11, minWidth: 32 }}>
                      {settings.abcSettings[cl].serviceLevel}%
                    </span>
                  </div>
                </div>
                <div style={{ marginBottom: 8 }}>
                  <label style={{ fontSize: 10, color: '#64748b', display: 'block', marginBottom: 2 }}>
                    Срок поставки
                  </label>
                  <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                    <input type="range" min={1} max={90}
                      value={settings.abcSettings[cl].leadTime}
                      onChange={e => handleSettings({
                        ...settings,
                        abcSettings: {
                          ...settings.abcSettings,
                          [cl]: { ...settings.abcSettings[cl], leadTime: +e.target.value },
                        },
                      })}
                      style={{ flex: 1 }} />
                    <span style={{ fontWeight: 700, fontSize: 11, minWidth: 38 }}>
                      {settings.abcSettings[cl].leadTime} дн
                    </span>
                  </div>
                </div>
                <div style={{ padding: '4px 8px', background: '#fff', borderRadius: 6, fontSize: 10, color: '#64748b' }}>
                  SS = {normInv(settings.abcSettings[cl].serviceLevel / 100).toFixed(2)} × σ × √{(settings.abcSettings[cl].leadTime / 30).toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Сезонность */}
      <SeasonalityEditor
        seasonality={seasonality}
        onSeasonality={handleSeasonality}
        rawData={rawData}
        fiscalStart={settings.fiscalStart}
      />

      {/* Каникулы */}
      <HolidaysEditor
        settings={settings}
        onSettings={handleSettingsFromHolidays}
        fiscalMonths={fiscalMonths}
      />

    </div>
  )
})

SettingsPage.displayName = 'SettingsPage'
export default SettingsPage
