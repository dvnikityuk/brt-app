import { memo, useRef } from 'react'
import * as XLSX from 'xlsx'
import { useAppStore } from '../store/useAppStore'
import { useFileHandlers } from '../hooks/useFileHandlers'
import { useProject } from '../hooks/useProject'
import { useAnalysis } from '../hooks/useAnalysis'
import { MONTHS_RU } from '../constants'

const S = {
  card: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 14 } as React.CSSProperties,
  btn: { padding: '6px 12px', border: '1px solid #e2e8f0', borderRadius: 6, cursor: 'pointer', fontSize: 12, background: '#fff', color: '#374151' } as React.CSSProperties,
  btnPrimary: { padding: '6px 14px', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, background: '#1e40af', color: '#fff', fontWeight: 600 } as React.CSSProperties,
  label: { fontSize: 11, color: '#94a3b8' } as React.CSSProperties,
}

function downloadTemplate(name: string, rows: Record<string, unknown>[], cols: { wch: number }[]) {
  const ws = XLSX.utils.json_to_sheet(rows)
  ws['!cols'] = cols
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, name)
  XLSX.writeFile(wb, `Шаблон_${name}.xlsx`)
}

export const UploadPage = memo(function UploadPage() {
  const {
    rawData, stockData, salesPlan, catalog, catalogWarnings,
    packagingData, packagingWarnings, dataRestored, loading, settings,
    clearAllData, setCatalog, setCatalogWarnings, setPackagingData, setPackagingWarnings,
  } = useAppStore()

  const { handleCatalogFile, handleShipmentFile, handleStockFile, handleSalesPlanFile, handlePackagingFile } = useFileHandlers()
  const { saveProject, loadProject } = useProject()
  const { runAnalysis } = useAnalysis()

  const refs = {
    file:    useRef<HTMLInputElement>(null),
    stock:   useRef<HTMLInputElement>(null),
    sales:   useRef<HTMLInputElement>(null),
    catalog: useRef<HTMLInputElement>(null),
    pack:    useRef<HTMLInputElement>(null),
    project: useRef<HTMLInputElement>(null),
  }

  const fiscalMos = Array.from({ length: 12 }, (_, i) => (settings.fiscalStart - 1 + i) % 12)

  return (
    <div style={{ maxWidth: 820, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 10 }}>

      {/* Restored banner */}
      {dataRestored && (
        <div style={{ ...S.card, background: '#fefce8', border: '1px solid #fcd34d', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
          <span style={{ color: '#854d0e' }}>Данные восстановлены: {rawData.length.toLocaleString()} записей{catalog.length ? ` · Справочник: ${catalog.length}` : ''}</span>
          <button onClick={clearAllData} style={{ ...S.btn, marginLeft: 'auto', fontSize: 11 }}>Очистить</button>
        </div>
      )}

      {/* Catalog */}
      <div style={{ ...S.card, border: '1px solid #bfdbfe' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 13, color: '#1e40af' }}>
              Справочник ТМЦ
              {catalog.length > 0 && <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 400, color: '#64748b' }}>{catalog.length} позиций</span>}
            </div>
            <div style={{ ...S.label, marginTop: 2 }}>Рекомендуется загрузить первым · Колонки: Код, ТМЦ, Класс, ТМЦ общее</div>
            {catalog.length > 0 && (
              <div style={{ display: 'flex', gap: 12, marginTop: 6, fontSize: 11 }}>
                <span style={{ color: '#16a34a' }}>Классов: {new Set(catalog.map(c => c.cls)).size}</span>
                <span style={{ color: '#7c3aed' }}>Групп: {new Set(catalog.map(c => c.tmcGroup)).size}</span>
                {catalogWarnings.length > 0 && <span style={{ color: '#d97706' }}>{catalogWarnings.length} предупреждений</span>}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            <button onClick={() => refs.catalog.current?.click()} style={S.btnPrimary}>{catalog.length ? 'Обновить' : 'Загрузить'}</button>
            <button onClick={() => downloadTemplate('Справочник_ТМЦ', [
              { 'Код': 'SKU001', 'ТМЦ': 'Подшипник 6205', 'Класс': 'Подшипники', 'ТМЦ общее': 'Запчасти двигателя' },
              { 'Код': 'SKU002', 'ТМЦ': 'Фильтр масляный', 'Класс': 'Фильтры', 'ТМЦ общее': 'Расходные материалы' },
            ], [{ wch: 12 }, { wch: 35 }, { wch: 20 }, { wch: 30 }])} style={S.btn}>Шаблон</button>
            {catalog.length > 0 && <button onClick={() => { setCatalog([]); setCatalogWarnings([]) }} style={{ ...S.btn, color: '#ef4444' }}>×</button>}
          </div>
        </div>
        <input ref={refs.catalog} type="file" accept=".csv,.xlsx,.xls" style={{ display: 'none' }} onChange={e => { if (e.target.files?.[0]) handleCatalogFile(e.target.files[0]) }} />
      </div>

      {/* File zones */}
      {[
        { label: 'Данные отгрузок', sub: 'Обязательно · CSV / XLSX · Колонки: ТМЦ общее, Класс, ТМЦ, Код, Дата, Количество', ref: refs.file,  handler: handleShipmentFile,  count: rawData.length,  color: '#16a34a' },
        { label: 'Остатки склада',  sub: 'Необязательно · XLSX · Колонки: Код, Наименование, Количество, Дата',                ref: refs.stock,  handler: handleStockFile,     count: stockData.length, color: '#7c3aed' },
        { label: 'План продаж',     sub: 'Необязательно · XLSX · Колонки: Код, Наименование, Янв...Дек или даты',              ref: refs.sales,  handler: handleSalesPlanFile, count: salesPlan.length, color: '#0284c7' },
      ].map(z => (
        <div key={z.label}
          style={{ background: '#fff', border: `1px dashed ${z.count ? z.color : '#cbd5e1'}`, borderRadius: 8, padding: 12, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
          onClick={() => z.ref.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) z.handler(f) }}
        >
          <input ref={z.ref} type="file" accept=".csv,.xlsx,.xls" style={{ display: 'none' }} onChange={e => { if (e.target.files?.[0]) z.handler(e.target.files[0]) }} />
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: z.count ? z.color : '#cbd5e1', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 500, fontSize: 12, color: z.count ? z.color : '#374151' }}>
              {z.label} {z.count ? `· ${z.count.toLocaleString()} строк` : ''}
            </div>
            <div style={S.label}>{z.sub}</div>
          </div>
          <span style={{ ...S.label, flexShrink: 0 }}>Нажмите или перетащите</span>
        </div>
      ))}

      {/* Packaging */}
      <div style={{ ...S.card, border: `1px dashed ${packagingData.length ? '#d97706' : '#cbd5e1'}` }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: packagingData.length ? '#d97706' : '#cbd5e1', flexShrink: 0, marginTop: 4 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 500, fontSize: 12, color: packagingData.length ? '#d97706' : '#374151' }}>
              Кол-во в упаковке {packagingData.length ? `· ${packagingData.length} позиций` : ''}
            </div>
            <div style={S.label}>Необязательно · XLSX · Колонки: Код, Кол-во в упаковке · Заказ округляется до кратного</div>
            {packagingData.length > 0 && (
              <div style={{ display: 'flex', gap: 12, marginTop: 4, fontSize: 11 }}>
                <span style={{ color: '#64748b' }}>Мин: {Math.min(...packagingData.map(p => p.packQty))} шт</span>
                <span style={{ color: '#64748b' }}>Макс: {Math.max(...packagingData.map(p => p.packQty))} шт</span>
                {packagingWarnings.length > 0 && <span style={{ color: '#ef4444' }}>{packagingWarnings.length} предупреждений</span>}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            <button onClick={() => refs.pack.current?.click()} style={S.btn}>Загрузить</button>
            <button onClick={() => downloadTemplate('Упаковка', [
              { 'Код': 'SKU001', 'ТМЦ': 'Подшипник 6205',  'Кол-во в упаковке': 10 },
              { 'Код': 'SKU002', 'ТМЦ': 'Фильтр масляный', 'Кол-во в упаковке': 6 },
            ], [{ wch: 14 }, { wch: 35 }, { wch: 22 }])} style={S.btn}>Шаблон</button>
            {packagingData.length > 0 && <button onClick={() => { setPackagingData([]); setPackagingWarnings([]) }} style={{ ...S.btn, color: '#ef4444' }}>×</button>}
          </div>
        </div>
        <input ref={refs.pack} type="file" accept=".csv,.xlsx,.xls" style={{ display: 'none' }} onChange={e => { if (e.target.files?.[0]) handlePackagingFile(e.target.files[0]) }} />
      </div>

      {/* Project */}
      <div style={{ ...S.card, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 500, flex: 1, color: '#374151' }}>Проект (все данные + настройки)</span>
        <button onClick={saveProject} disabled={!rawData.length} style={{ ...S.btnPrimary, opacity: rawData.length ? 1 : 0.4 }}>Сохранить .brt</button>
        <button onClick={() => refs.project.current?.click()} style={S.btn}>Загрузить .brt</button>
        <input ref={refs.project} type="file" accept=".brt,.json" style={{ display: 'none' }} onChange={e => { if (e.target.files?.[0]) loadProject(e.target.files[0]) }} />
      </div>

      {/* Sales plan preview */}
      {salesPlan.length > 0 && (
        <div style={S.card}>
          <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 8, color: '#374151' }}>
            План продаж · {salesPlan.length} позиций
            <button onClick={() => {}} style={{ ...S.btn, fontSize: 10, marginLeft: 8, padding: '2px 8px', color: '#ef4444' }}>×</button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  <th style={{ padding: '4px 8px', textAlign: 'left', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontWeight: 500 }}>Объём</th>
                  {fiscalMos.map((mi, fi) => (
                    <th key={fi} style={{ padding: '4px 8px', textAlign: 'center', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontWeight: 500 }}>{MONTHS_RU[mi]}</th>
                  ))}
                  <th style={{ padding: '4px 8px', textAlign: 'center', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontWeight: 500 }}>Итого</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ padding: '4px 8px', color: '#374151' }}>Сумма</td>
                  {fiscalMos.map((mi, fi) => {
                    const total = salesPlan.reduce((s, sp) => s + (sp.months[mi] || 0), 0)
                    return <td key={fi} style={{ padding: '4px 8px', textAlign: 'center', color: total > 0 ? '#374151' : '#cbd5e1' }}>{total > 0 ? total.toLocaleString('ru') : '—'}</td>
                  })}
                  <td style={{ padding: '4px 8px', textAlign: 'center', fontWeight: 600, color: '#374151' }}>
                    {salesPlan.reduce((s, sp) => s + sp.months.reduce((a, b) => a + b, 0), 0).toLocaleString('ru')}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Run analysis */}
      {rawData.length > 0 && (
        <button onClick={runAnalysis} disabled={loading} style={{ ...S.btnPrimary, padding: '10px 24px', fontSize: 13, alignSelf: 'flex-start', opacity: loading ? 0.6 : 1, cursor: loading ? 'default' : 'pointer' }}>
          {loading ? 'Анализ...' : 'Запустить анализ'}
        </button>
      )}

      {/* Preview */}
      {rawData.length > 0 && (
        <div style={S.card}>
          <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 8, color: '#374151' }}>Предпросмотр данных</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
            {[['Записей', rawData.length], ['SKU', new Set(rawData.map(r => r.code)).size], ['Классов', new Set(rawData.map(r => r.cls)).size], ['Групп', new Set(rawData.map(r => r.tmcGroup)).size]].map(([l, v]) => (
              <div key={String(l)} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: '6px 14px', textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#1e40af' }}>{(v as number).toLocaleString()}</div>
                <div style={{ fontSize: 10, color: '#94a3b8' }}>{l}</div>
              </div>
            ))}
          </div>
          <div style={{ overflowX: 'auto', maxHeight: 180, border: '1px solid #e2e8f0', borderRadius: 6 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead style={{ position: 'sticky', top: 0, background: '#f8fafc' }}>
                <tr>{['ТМЦ общее', 'Класс', 'ТМЦ', 'Код', 'Дата', 'Кол-во'].map(h => (
                  <th key={h} style={{ padding: '5px 8px', textAlign: 'left', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontWeight: 500 }}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {rawData.slice(0, 20).map((r, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '3px 8px' }}>{r.tmcGroup}</td>
                    <td style={{ padding: '3px 8px' }}>{r.cls}</td>
                    <td style={{ padding: '3px 8px' }}>{r.tmc}</td>
                    <td style={{ padding: '3px 8px', fontWeight: 600, color: '#1e40af' }}>{r.code}</td>
                    <td style={{ padding: '3px 8px' }}>{r.date.toLocaleDateString('ru')}</td>
                    <td style={{ padding: '3px 8px', textAlign: 'right' }}>{r.qty.toLocaleString('ru')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
})
