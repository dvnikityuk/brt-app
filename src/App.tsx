import { lazy, Suspense, useState, useEffect, useCallback } from 'react'
import { SectionErrorBoundary } from './components/ErrorBoundary'
import { useAppStore } from './store/useAppStore'
import { useAnalysis } from './hooks/useAnalysis'
import { useExport } from './hooks/useExport'
import { MONTHS_RU, autoDetectFiscalYear } from './constants'
import { normCode } from './engine'
import type { RawRow, StockRow, SalesPlanRow } from './types'

const UploadPage         = lazy(() => import('./pages/UploadPage').then(m => ({ default: m.UploadPage })))
const DemandPage         = lazy(() => import('./pages/DemandPage').then(m => ({ default: m.DemandPage })))
const ClassificationPage = lazy(() => import('./pages/ClassificationPage').then(m => ({ default: m.ClassificationPage })))
const OutliersTab        = lazy(() => import('./components/OutliersTab').then(m => ({ default: m.OutliersTab })))
const StockPage          = lazy(() => import('./pages/StockPage').then(m => ({ default: m.StockPage })))
const ProductionPage     = lazy(() => import('./pages/ProductionPage').then(m => ({ default: m.ProductionPage })))
const SettingsPage       = lazy(() => import('./pages/SettingsPage'))
const CatalogPage        = lazy(() => import('./pages/CatalogPage').then(m => ({ default: m.CatalogPage })))

const PageLoader = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: '#94a3b8', fontSize: 13 }}>
    Загрузка...
  </div>
)

// ─── Руководство пользователя ─────────────────────────────────────────────────
interface GuideBlock { subtitle: string; text: string }
interface GuideStep  { num: string; text: string }
interface GuideSection {
  title: string
  color: string
  steps?: GuideStep[]
  blocks?: GuideBlock[]
}

const GUIDE: GuideSection[] = [
  {
    title: 'Быстрый старт — 5 шагов',
    color: '#1e40af',
    steps: [
      {
        num: '1',
        text: 'Справочник ТМЦ (рекомендуется, загружать первым)\n' +
              'Колонки: Код | ТМЦ | Класс | ТМЦ общее\n' +
              'Пример: SKU001 | Петля шпагатная | Расходные | Запасные части\n' +
              'Коды нормализуются автоматически: SKU001 = sku001 = "SKU 001"'
      },
      {
        num: '2',
        text: 'Данные отгрузок (обязательно)\n' +
              'Колонки: Код | ТМЦ | Класс | ТМЦ общее | Дата | Количество\n' +
              'Пример строки: SKU001 | Петля шпагатная | Расходные | Запасные | 01.04.2025 | 120\n' +
              'Формат даты: 01.04.2025 или 2025-04-01. Несколько строк на месяц — суммируются.'
      },
      {
        num: '3',
        text: 'Остатки склада (необязательно)\n' +
              'Колонки: Код | Наименование | Количество | Дата\n' +
              'Пример: SKU001 | Петля шпагатная | 350 | 01.07.2026\n' +
              'Дата (01.07.2026) — определяет начало симуляции склада.\n' +
              'Если не загружен — симуляция начинается с 0.'
      },
      {
        num: '4',
        text: 'Упаковки (необязательно)\n' +
              'Колонки: Код | Количество в упаковке\n' +
              'Пример: SKU001 | 24\n' +
              'Заказ будет округляться вверх до целого числа упаковок.\n' +
              'Если не загружен — заказ в штуках без кратности.'
      },
      {
        num: '5',
        text: 'Нажмите «Запустить анализ»\n' +
              'Система автоматически определит период прогноза из данных,\n' +
              'классифицирует позиции по ABC-XYZ, рассчитает прогноз,\n' +
              'нормативы склада и план заказов по месяцам.\n' +
              'Результат — на вкладке «Производство».'
      },
    ]
  },
  {
    title: 'Пример полного расчёта — Петля шпагатная SKU001',
    color: '#047857',
    blocks: [
      {
        subtitle: 'Входные данные',
        text: 'История отгрузок за 12 месяцев (шт/мес):\n' +
              'Янв=100, Фев=90, Мар=110, Апр=130, Май=140, Июн=150\n' +
              'Июл=160, Авг=155, Сен=120, Окт=100, Ноя=95,  Дек=80\n\n' +
              'Остаток склада на 01.07.2026 = 350 шт\n' +
              'Уровень сервиса = 95% | Срок поставки = 30 дней\n' +
              'Упаковка = 24 шт/уп'
      },
      {
        subtitle: 'Шаг 1 — Статистика из истории',
        text: 'Среднее μ = (100+90+110+130+140+150+160+155+120+100+95+80) / 12 = 119 шт/мес\n' +
              'Стандартное отклонение σ = 26 шт\n' +
              'CV = σ / μ = 26 / 119 = 0.22 → класс Y (умеренные колебания)\n' +
              'Тренд: небольшой рост в середине года, снижение к зиме\n' +
              'ABC: зависит от доли SKU001 в общем обороте всех позиций'
      },
      {
        subtitle: 'Шаг 2 — Нормативы склада',
        text: 'Z-фактор для 95% сервиса = 1.645\n' +
              'SS = 1.645 × 26 × √(30/30) = 1.645 × 26 × 1.0 = 43 шт\n\n' +
              'Min склад  = SS = 43 шт  (ниже — дефицит, срочный заказ)\n' +
              'Целевой    = SS + μ = 43 + 119 = 162 шт  (рабочий уровень)\n' +
              'Max склад  = SS + EOQ = 43 + 244 = 287 шт\n' +
              'ROP        = μ × 1 + SS = 119 + 43 = 162 шт  (точка перезаказа)\n\n' +
              'Интерпретация ROP: когда остаток падает до 162 шт — размещать заказ!'
      },
      {
        subtitle: 'Шаг 3 — Прогноз спроса (метод Holt, класс Y)',
        text: 'Метод Holt (двойное экспоненциальное сглаживание):\n' +
              '  α=0.3 (сглаживание уровня), β=0.1 (сглаживание тренда)\n' +
              '  Базовый уровень после обучения ≈ 119 шт/мес\n\n' +
              'Применение сезонности (пример коэффициентов):\n' +
              '  Июл коэф = 1.34 → прогноз = 119 × 1.34 = 159 шт\n' +
              '  Авг коэф = 1.30 → прогноз = 119 × 1.30 = 155 шт\n' +
              '  Сен коэф = 1.01 → прогноз = 119 × 1.01 = 120 шт\n' +
              '  Окт коэф = 0.84 → прогноз = 119 × 0.84 = 100 шт\n' +
              '  Ноя коэф = 0.80 → прогноз = 119 × 0.80 =  95 шт\n' +
              '  Дек коэф = 0.67 → прогноз = 119 × 0.67 =  80 шт'
      },
      {
        subtitle: 'Шаг 4 — Расчёт заказов (склад = 350 шт, целевой = 162 шт)',
        text: 'Начальный остаток = 350 шт > Целевой = 162 шт → ИЗЛИШЕК 188 шт\n' +
              'fillRate = -(188 / 3) = -63 шт/мес (постепенно сокращаем заказ)\n\n' +
              'Июл: заказ_сырой = 159 - 63 = 96 шт → кратно 24: ceil(96/24)×24 = 4×24 = 96 шт\n' +
              '     склад_кон = 350 + 96 - 159 = 287 шт\n' +
              'Авг: заказ_сырой = 155 - 63 = 92 шт → кратно 24: ceil(92/24)×24 = 4×24 = 96 шт\n' +
              '     склад_кон = 287 + 96 - 155 = 228 шт\n' +
              'Сен: заказ_сырой = 120 - 63 = 57 шт → кратно 24: ceil(57/24)×24 = 3×24 = 72 шт\n' +
              '     склад_кон = 228 + 72 - 120 = 180 шт\n' +
              'Окт: fillRate = 0 (3 мес прошло), заказ = 100 шт → ceil(100/24)×24 = 5×24 = 120 шт\n' +
              '     склад_кон = 180 + 120 - 100 = 200 шт ← движется к целевому 162\n' +
              '...и так далее до стабилизации склада на уровне ~162 шт'
      },
    ]
  },
  {
    title: 'ABC-XYZ классификация',
    color: '#7c3aed',
    blocks: [
      {
        subtitle: 'ABC — по доле в годовом обороте',
        text: 'Все позиции сортируются по убыванию объёма отгрузок.\n' +
              'Накопительная доля считается от общего оборота:\n\n' +
              '  A: накопительно ≤ 80% оборота — ключевые позиции, приоритет №1\n' +
              '  B: 80–95% — средние позиции, регулярный контроль\n' +
              '  C: > 95% — второстепенные, минимальный запас\n\n' +
              'Пример (5 позиций, итого = 2500 шт):\n' +
              '  SKU1: 1000 → накоп. 40%  → A\n' +
              '  SKU2:  800 → накоп. 72%  → A\n' +
              '  SKU3:  400 → накоп. 88%  → B\n' +
              '  SKU4:  200 → накоп. 96%  → C\n' +
              '  SKU5:  100 → накоп. 100% → C'
      },
      {
        subtitle: 'XYZ — по стабильности спроса',
        text: 'CV = σ / μ (коэффициент вариации)\n\n' +
              '  X: CV ≤ 0.10 — стабильный спрос, легко прогнозировать\n' +
              '      Пример: [99,100,101,100,99,102] → CV = 0.01\n\n' +
              '  Y: CV ≤ 0.25 — умеренные колебания, метод Holt\n' +
              '      Пример: [80,120,90,150,100,110] → CV = 0.22\n\n' +
              '  Z: CV > 0.25 — нестабильный, сложно планировать\n' +
              '      Пример: [0,200,50,0,300,0] → CV = 1.1'
      },
      {
        subtitle: 'Матрица 9 классов и стратегии',
        text: 'AX: JIT-поставки, минимальный страховой запас (SS × 0.5)\n' +
              'AY: Регулярный пересчёт каждые 2 недели, умеренный буфер\n' +
              'AZ: Большой страховой запас (SS × 1.5), ежедневный мониторинг\n' +
              'BX: Фиксированные заказы по расписанию\n' +
              'BY: Периодический пересмотр раз в месяц\n' +
              'BZ: Заказ под конкретную потребность или проект\n' +
              'CX: Редкие крупные заказы, минимум на складе\n' +
              'CY: Заказ по мере необходимости\n' +
              'CZ: Рассмотреть вывод из ассортимента или замену'
      },
    ]
  },
  {
    title: 'Нормативы склада — формулы и примеры',
    color: '#b45309',
    blocks: [
      {
        subtitle: 'Страховой запас SS',
        text: 'Формула: SS = Z × σ × √(LT / 30)\n\n' +
              'Z — фактор сервиса (обратная нормальная функция):\n' +
              '  90% → Z = 1.282\n' +
              '  95% → Z = 1.645  ← по умолчанию\n' +
              '  97% → Z = 1.881\n' +
              '  99% → Z = 2.326\n\n' +
              'σ — стандартное отклонение месячного спроса (из истории)\n' +
              'LT — срок поставки в днях\n\n' +
              'Примеры при σ=26:\n' +
              '  95%, LT=30д: SS = 1.645 × 26 × 1.00 = 43 шт\n' +
              '  95%, LT=60д: SS = 1.645 × 26 × 1.41 = 61 шт\n' +
              '  99%, LT=30д: SS = 2.326 × 26 × 1.00 = 61 шт'
      },
      {
        subtitle: 'Целевой запас и ROP',
        text: 'Целевой = SS + μ × ceil(LT/30)\n' +
              '  При LT=30д: Целевой = SS + μ × 1 (1 мес покрытия + буфер)\n' +
              '  При LT=60д: Целевой = SS + μ × 2 (2 мес покрытия + буфер)\n\n' +
              'ROP (точка перезаказа):\n' +
              '  ROP = μ × (LT/30) + SS\n' +
              '  Когда остаток ≤ ROP — пора размещать заказ!\n' +
              '  При μ=119, LT=30д: ROP = 119 + 43 = 162 шт\n\n' +
              'ABC-Override: разные параметры для A, B, C классов:\n' +
              '  A: сервис 97%, LT 14 дней → высокий приоритет\n' +
              '  B: сервис 95%, LT 30 дней → стандарт\n' +
              '  C: сервис 90%, LT 45 дней → экономия'
      },
      {
        subtitle: 'Кратность упаковке в нормативах',
        text: 'Все нормативы округляются вверх до целой упаковки:\n\n' +
              '  SS     = roundUp(Z × σ × √(LT/30), packQty)\n' +
              '  Min    = SS\n' +
              '  Целевой = roundUp(SS + μ × cover, packQty)\n' +
              '  Max    = roundUp(Целевой + EOQ, packQty)\n' +
              '  ROP    = roundUp(μ × LT/30 + SS, packQty)\n\n' +
              'Пример с packQty = 24:\n' +
              '  SS сырой = 43 шт → ceil(43/24) × 24 = 2×24 = 48 шт\n' +
              '  Целевой сырой = 162 шт → ceil(162/24) × 24 = 7×24 = 168 шт\n\n' +
              'Склад нач/кон — фактический остаток, НЕ кратен упаковке.'
      },
    ]
  },
  {
    title: 'Алгоритм заказов — подробно',
    color: '#0369a1',
    blocks: [
      {
        subtitle: 'Факт-месяцы (зелёные колонки в таблице)',
        text: 'Месяцы с реальными данными отгрузок из файла.\n\n' +
              'Заказ = фактические отгрузки (план уже выполнен).\n' +
              'Склад нач = загруженный остаток (не меняется для прошлых мес.).\n' +
              'Эти данные используются для обучения модели прогноза.\n\n' +
              'Важно: нельзя симулировать склад за прошлые месяцы\n' +
              'без данных о поступлениях — поэтому остаток фиксируется.'
      },
      {
        subtitle: 'Прогнозные месяцы — формула заказа',
        text: 'rawOrd = demand[fi] + fillRate\n\n' +
              'fillRate вычисляется один раз перед симуляцией:\n' +
              '  Если склад < целевого (дефицит):\n' +
              '    fillRate = (целевой - склад) / 3  ← наполняем за 3 мес\n' +
              '    Пример: склад=0, целевой=162 → fillRate = +54 шт/мес\n\n' +
              '  Если склад > целевого (излишек):\n' +
              '    fillRate = -(склад - целевой) / 3  ← снижаем за 3 мес\n' +
              '    Пример: склад=350, целевой=162 → fillRate = -63 шт/мес\n\n' +
              '  Если склад = целевому:\n' +
              '    fillRate = 0 → заказ = спрос (поддержание уровня)\n\n' +
              'Вывод: заказ ≈ спрос — это НОРМА при оптимальном складе!'
      },
      {
        subtitle: 'Кратность упаковке',
        text: 'После расчёта сырого заказа — округление вверх до упаковки:\n\n' +
              '  packs = ceil(rawOrd / packQty)\n' +
              '  ord   = packs × packQty\n\n' +
              'Примеры с упаковкой 24 шт:\n' +
              '  rawOrd = 96  → ceil(96/24)  = 4 уп → 96 шт  (точно)\n' +
              '  rawOrd = 92  → ceil(92/24)  = 4 уп → 96 шт  (+4 шт)\n' +
              '  rawOrd = 57  → ceil(57/24)  = 3 уп → 72 шт  (+15 шт)\n' +
              '  rawOrd = 159 → ceil(159/24) = 7 уп → 168 шт (+9 шт)\n\n' +
              'В таблице видны оба значения: 168 шт / 7 уп'
      },
      {
        subtitle: 'Производственные каникулы',
        text: 'Ограничение мощности в отдельных месяцах.\n' +
              'Настраивается на вкладке «Настройки» → Производственные каникулы.\n\n' +
              'Параметры на месяц:\n' +
              '  Рабочих дней (из 22) и Мощность (%)\n\n' +
              'Эффективность = (дней/22) × (мощность/100)\n\n' +
              'Пример: Январь, 14 дней, 70% мощность:\n' +
              '  Эфф = (14/22) × 0.70 = 0.445 = 44.5%\n' +
              '  Базовый заказ = 168 шт\n' +
              '  Скорректированный = ceil(168 × 0.445 / 24) × 24 = 4×24 = 96 шт\n' +
              '  Дефицит = 168 - 96 = 72 шт\n' +
              '  → Декабрь получает +58 шт (80% дефицита — заранее)\n' +
              '  → Февраль получает +14 шт (20% дефицита — догоняем)\n' +
              '  Итого за год не изменилось!'
      },
    ]
  },
  {
    title: 'Сезонность — настройка и расчёт',
    color: '#0891b2',
    blocks: [
      {
        subtitle: 'Что такое коэффициент сезонности',
        text: 'Коэффициент > 1.0 — спрос в этом месяце выше среднего.\n' +
              'Коэффициент < 1.0 — спрос ниже среднего.\n' +
              'Коэффициент = 1.0 — спрос на среднем уровне.\n\n' +
              'Пример коэффициентов для Петли шпагатной:\n' +
              '  Янв=0.84, Фев=0.76, Мар=0.92, Апр=1.09, Май=1.18, Июн=1.26\n' +
              '  Июл=1.34, Авг=1.30, Сен=1.01, Окт=0.84, Ноя=0.80, Дек=0.67\n\n' +
              'Прогноз = Базовый_уровень × Коэф[месяц]'
      },
      {
        subtitle: 'Как рассчитать из данных',
        text: 'Нажмите «Рассчитать из данных» на вкладке «Настройки».\n\n' +
              'Алгоритм:\n' +
              '  1. Для каждого месяца (Янв..Дек) считается\n' +
              '     среднее по всем позициям и всем годам\n' +
              '  2. Рассчитывается общее среднее\n' +
              '  3. Коэф[мес] = Среднее[мес] / Общее_среднее\n\n' +
              'После расчёта — нажмите «Пересчитать анализ».\n' +
              'Прогноз и заказы пересчитаются с новыми коэффициентами.'
      },
    ]
  },
  {
    title: 'Сохранение и экспорт',
    color: '#475569',
    blocks: [
      {
        subtitle: 'Форматы сохранения',
        text: '.brt файл — полный проект:\n' +
              '  Все данные + настройки + версии сценариев\n' +
              '  Используйте для продолжения работы на следующий день\n\n' +
              '.json файл — только настройки:\n' +
              '  Уровень сервиса, сроки поставки, сезонность, каникулы\n' +
              '  Для переноса параметров между проектами\n\n' +
              'Версии сценариев:\n' +
              '  Сохраните текущие настройки как сценарий.\n' +
              '  Сравните: "Базовый план" vs "С учётом сезонности" vs "Оптимистичный"'
      },
      {
        subtitle: 'Excel экспорт — 5 листов',
        text: 'Лист 1 «Сводка»:\n' +
              '  Все позиции, ABC-XYZ класс, нормативы склада\n\n' +
              'Лист 2 «Матрица заказов»:\n' +
              '  Позиции × Месяцы = Заказ (шт)\n' +
              '  Зелёные ячейки = факт, белые = план\n\n' +
              'Лист 3 «Прогноз (факт)»:\n' +
              '  Факт отгрузок для прошедших месяцев\n' +
              '  Прогноз для будущих месяцев\n\n' +
              'Лист 4 «Детальный план»:\n' +
              '  Спрос + Заказ + Склад для каждого месяца\n\n' +
              'Лист 5 «Справочник ТМЦ» (если загружен)'
      },
    ]
  },
]

// ─── Компонент Guide Modal ────────────────────────────────────────────────────
function GuideModal({ onClose }: { onClose: () => void }) {
  const [activeSection, setActiveSection] = useState(0)
  const section = GUIDE[activeSection]

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 760, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 40px rgba(0,0,0,0.15)' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid #e2e8f0' }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>Руководство пользователя</div>
          <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: 20, cursor: 'pointer', color: '#94a3b8', lineHeight: 1, padding: '0 4px' }}>×</button>
        </div>

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Sidebar */}
          <div style={{ width: 200, borderRight: '1px solid #e2e8f0', overflowY: 'auto', padding: '8px 0', flexShrink: 0 }}>
            {GUIDE.map((s, i) => (
              <button key={i} onClick={() => setActiveSection(i)} style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '8px 16px', border: 'none', cursor: 'pointer',
                fontSize: 12, fontWeight: activeSection === i ? 600 : 400,
                background: activeSection === i ? '#eff6ff' : 'transparent',
                color: activeSection === i ? '#1e40af' : '#475569',
                borderLeft: `3px solid ${activeSection === i ? s.color : 'transparent'}`,
                lineHeight: 1.4,
              }}>
                {s.title}
              </button>
            ))}
          </div>

          {/* Content */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: section.color, marginBottom: 14, paddingBottom: 8, borderBottom: `2px solid ${section.color}20` }}>
              {section.title}
            </div>

            {section.steps && section.steps.map((step, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                <div style={{ flexShrink: 0, width: 24, height: 24, borderRadius: '50%', background: section.color, color: '#fff', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
                  {step.num}
                </div>
                <div style={{ flex: 1, background: '#f8fafc', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#374151', whiteSpace: 'pre-line', lineHeight: 1.7, borderLeft: `3px solid ${section.color}40` }}>
                  {step.text}
                </div>
              </div>
            ))}

            {section.blocks && section.blocks.map((block, i) => (
              <div key={i} style={{ marginBottom: 12, background: '#f8fafc', borderRadius: 8, padding: '10px 14px', borderLeft: `3px solid ${section.color}` }}>
                <div style={{ fontWeight: 600, fontSize: 12, color: section.color, marginBottom: 6 }}>{block.subtitle}</div>
                <div style={{ fontSize: 12, color: '#374151', whiteSpace: 'pre-line', lineHeight: 1.75, fontFamily: "'SF Mono','Fira Code','Consolas',monospace" }}>{block.text}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 20px', borderTop: '1px solid #e2e8f0' }}>
          <button
            onClick={() => setActiveSection(i => Math.max(0, i - 1))}
            disabled={activeSection === 0}
            style={{ padding: '5px 14px', border: '1px solid #e2e8f0', borderRadius: 6, cursor: activeSection === 0 ? 'default' : 'pointer', fontSize: 12, background: '#fff', color: activeSection === 0 ? '#cbd5e1' : '#374151' }}
          >
            ← Назад
          </button>
          <span style={{ fontSize: 11, color: '#94a3b8' }}>{activeSection + 1} / {GUIDE.length}</span>
          <button
            onClick={() => setActiveSection(i => Math.min(GUIDE.length - 1, i + 1))}
            disabled={activeSection === GUIDE.length - 1}
            style={{ padding: '5px 14px', border: 'none', borderRadius: 6, cursor: activeSection === GUIDE.length - 1 ? 'default' : 'pointer', fontSize: 12, background: activeSection === GUIDE.length - 1 ? '#e2e8f0' : '#1e40af', color: activeSection === GUIDE.length - 1 ? '#94a3b8' : '#fff', fontWeight: 600 }}
          >
            Далее →
          </button>
        </div>
      </div>
    </div>
  )
}

const BTN: React.CSSProperties = { padding: '6px 12px', border: '1px solid #e2e8f0', borderRadius: 6, cursor: 'pointer', fontSize: 13, background: '#fff', color: '#374151' }
const BTN_PRIMARY: React.CSSProperties = { ...BTN, background: '#1e40af', color: '#fff', border: 'none', fontWeight: 600 }

export default function App() {
  const {
    activeTab, setActiveTab,
    rawData, stockData, salesPlan, catalog, catalogWarnings,
    results, settings, seasonality, versions,
    loading, dataRestored,
    setRawData, setStockData, setSalesPlan, setCatalog, setResults,
    setLoading, setDataRestored, setVersions,
    setSettings, setSeasonality,
  } = useAppStore()

  const { runAnalysis, runAnalysisWithData } = useAnalysis()
  const { exportExcel } = useExport()

  const [showVersions, setShowVersions] = useState(false)
  const [showGuide, setShowGuide] = useState(false)
  const [versionName, setVersionName] = useState('')
  const [versionDesc, setVersionDesc] = useState('')

  const lastShipmentDate = rawData.length
    ? rawData.reduce((max, r) => (r.date > max ? r.date : max), rawData[0].date)
    : null
  const activeFiscalYear = autoDetectFiscalYear(lastShipmentDate, settings.fiscalStart)

  useEffect(() => {
    try {
      const saved = localStorage.getItem('brt_lastdata')
      if (!saved) return
      const parsed = JSON.parse(saved)
      const restoredRaw: RawRow[] = parsed.rawData?.length
        ? parsed.rawData.map((r: RawRow & { date: string }) => ({ ...r, date: new Date(r.date), code: normCode(r.code) }))
        : []
      const restoredStock: StockRow[] = parsed.stockData?.length
        ? parsed.stockData.map((s: StockRow & { date?: string }) => ({ ...s, code: normCode(s.code), date: s.date ? new Date(s.date) : undefined }))
        : []
      const restoredSales: SalesPlanRow[] = parsed.salesPlan?.length
        ? parsed.salesPlan.map((sp: SalesPlanRow) => ({ ...sp, code: normCode(sp.code) }))
        : []
      if (restoredRaw.length > 0) {
        setRawData(restoredRaw); setStockData(restoredStock); setSalesPlan(restoredSales)
        if (parsed.catalog?.length) setCatalog(parsed.catalog)
        setDataRestored(true)
        setLoading(true)
        setTimeout(() => {
          import('./engine').then(({ runAnalysis: doAnalysis }) => {
            const autoFY = (d: Date, fs: number) => { const m = d.getMonth()+1; const y = d.getFullYear(); return m >= fs ? y : y-1 }
            try {
              const fMonths = Array.from({ length: 12 }, (_, i) => (settings.fiscalStart - 1 + i) % 12)
              const lastDate = restoredRaw.reduce((max, r) => (r.date > max ? r.date : max), restoredRaw[0].date)
              const fyear = autoFY(lastDate, settings.fiscalStart)
              const res = doAnalysis(restoredRaw, restoredStock, restoredSales, parsed.catalog || [], { ...settings, fiscalYear: fyear }, seasonality, fMonths)
              setResults(res)
            } catch (err) { console.error('Ошибка авто-анализа:', err) }
            finally { setLoading(false) }
          })
        }, 300)
      }
    } catch (e) { console.error('Ошибка восстановления:', e) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!rawData.length) return
    try { localStorage.setItem('brt_lastdata', JSON.stringify({ rawData: rawData.slice(0, 50000), stockData, salesPlan, catalog })) }
    catch { /* storage full */ }
  }, [rawData, stockData, salesPlan, catalog])

  const saveVersion = useCallback(() => {
    if (!versionName.trim()) return
    setVersions(prev => [...prev, { id: Date.now().toString(), name: versionName.trim(), desc: versionDesc, date: new Date().toLocaleString('ru'), settings, seasonality }])
    setVersionName(''); setVersionDesc('')
  }, [versionName, versionDesc, settings, seasonality, setVersions])

  const loadVersion = useCallback((v: (typeof versions)[0]) => {
    setSettings(v.settings); setSeasonality(v.seasonality); setShowVersions(false)
  }, [setSettings, setSeasonality])

  useEffect(() => {
    (window as unknown as Record<string, unknown>).__brtRunAnalysis = runAnalysisWithData
  }, [runAnalysisWithData])

  const TABS = [
    { id: 'upload',         label: 'Загрузка' },
    { id: 'demand',         label: 'Отгрузки' },
    { id: 'classification', label: 'Классификация' },
    { id: 'outliers',       label: 'Выбросы', badge: results.filter(r => r.outlierCount > 0).length },
    { id: 'stock',          label: 'Склад' },
    { id: 'production',     label: 'Производство' },
    { id: 'settings',       label: 'Настройки' },
    { id: 'catalog',        label: 'Справочник', badge: catalogWarnings.length },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#f8fafc', fontFamily: "'Inter','Segoe UI',system-ui,sans-serif", overflow: 'hidden', fontSize: 14 }}>

      {/* HEADER */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '8px 20px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a', letterSpacing: '-0.3px' }}>Заказ расходных материалов</div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>
            {rawData.length ? `${rawData.length.toLocaleString()} записей · ${results.length} SKU` : 'Загрузите данные'}
            {dataRestored && <span style={{ marginLeft: 8, color: '#10b981' }}>· восстановлено</span>}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {rawData.length > 0 && (
            <div style={{ fontSize: 11, color: '#64748b', background: '#f1f5f9', borderRadius: 6, padding: '3px 8px' }}>
              ФГ {MONTHS_RU[settings.fiscalStart - 1]} {activeFiscalYear} – {MONTHS_RU[(settings.fiscalStart - 2 + 12) % 12]} {activeFiscalYear + 1}
              {lastShipmentDate && <span style={{ marginLeft: 6, color: '#94a3b8' }}>· до {lastShipmentDate.toLocaleDateString('ru', { month: 'short', year: 'numeric' })}</span>}
            </div>
          )}

          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#64748b' }}>
              <span style={{ display: 'inline-block', width: 12, height: 12, border: '2px solid #e2e8f0', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              Анализ...
            </div>
          )}

          {!loading && results.length > 0 && (
            <button onClick={runAnalysis} style={BTN_PRIMARY}>Пересчитать</button>
          )}

          <button onClick={() => setShowVersions(true)} style={BTN}>
            Версии {versions.length > 0 && <span style={{ marginLeft: 4, background: '#1e40af', color: '#fff', borderRadius: 10, padding: '1px 5px', fontSize: 10 }}>{versions.length}</span>}
          </button>

          <button onClick={exportExcel} disabled={!results.length} style={{ ...BTN, opacity: results.length ? 1 : 0.4, cursor: results.length ? 'pointer' : 'default' }}>Экспорт</button>

          <button onClick={() => setShowGuide(true)} style={{ ...BTN, width: 32, padding: 0, textAlign: 'center', color: '#64748b' }}>?</button>
        </div>
      </div>

      {/* TABS */}
      <div style={{ display: 'flex', background: '#fff', borderBottom: '1px solid #e2e8f0', overflowX: 'auto', flexShrink: 0 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
            padding: '8px 16px', border: 'none', background: 'none', cursor: 'pointer',
            fontSize: 13, fontWeight: activeTab === t.id ? 600 : 400,
            color: activeTab === t.id ? '#1e40af' : '#64748b',
            borderBottom: `2px solid ${activeTab === t.id ? '#1e40af' : 'transparent'}`,
            whiteSpace: 'nowrap', transition: 'all 0.1s',
          }}>
            {t.label}
            {(t.badge ?? 0) > 0 && (
              <span style={{ marginLeft: 4, background: '#f59e0b', color: '#fff', borderRadius: 8, padding: '0 4px', fontSize: 10 }}>{t.badge}</span>
            )}
          </button>
        ))}
      </div>

      {/* CONTENT */}
      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        <Suspense fallback={<PageLoader />}>
          <SectionErrorBoundary name={TABS.find(t => t.id === activeTab)?.label}>
            {activeTab === 'upload'         && <UploadPage />}
            {activeTab === 'demand'         && <DemandPage />}
            {activeTab === 'classification' && <ClassificationPage />}
            {activeTab === 'outliers'       && <OutliersTab results={results} rawData={rawData} settings={settings} />}
            {activeTab === 'stock'          && <StockPage />}
            {activeTab === 'production'     && <ProductionPage />}
            {activeTab === 'settings'       && <SettingsPage />}
            {activeTab === 'catalog'        && <CatalogPage />}
          </SectionErrorBoundary>
        </Suspense>
      </div>

      {/* VERSIONS MODAL */}
      {showVersions && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 10, padding: 20, width: 480, maxHeight: '80vh', overflow: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>Версии сценариев</div>
              <button onClick={() => setShowVersions(false)} style={{ border: 'none', background: 'none', fontSize: 18, cursor: 'pointer', color: '#94a3b8', lineHeight: 1 }}>×</button>
            </div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
              <input value={versionName} onChange={e => setVersionName(e.target.value)} placeholder="Название" style={{ flex: 1, padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 12, outline: 'none' }} />
              <input value={versionDesc} onChange={e => setVersionDesc(e.target.value)} placeholder="Описание" style={{ flex: 1, padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 12, outline: 'none' }} />
              <button onClick={saveVersion} style={{ ...BTN_PRIMARY, fontSize: 12 }}>Сохранить</button>
            </div>
            {versions.length === 0 && <div style={{ color: '#94a3b8', textAlign: 'center', padding: 24, fontSize: 12 }}>Нет сохранённых версий</div>}
            {versions.map(v => (
              <div key={v.id} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 12px', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 12, color: '#0f172a' }}>{v.name}</div>
                  <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>{v.date}{v.desc && ` · ${v.desc}`}</div>
                </div>
                <button onClick={() => loadVersion(v)} style={{ ...BTN_PRIMARY, fontSize: 11, padding: '3px 10px' }}>Загрузить</button>
                <button onClick={() => setVersions(prev => prev.filter(x => x.id !== v.id))} style={{ ...BTN, fontSize: 11, padding: '3px 8px', color: '#ef4444', borderColor: '#fecaca' }}>×</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* GUIDE MODAL */}
      {showGuide && <GuideModal onClose={() => setShowGuide(false)} />}

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
