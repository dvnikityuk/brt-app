import React from 'react'

interface Props {
  children: React.ReactNode
  fallback?: React.ReactNode
}

interface State {
  hasError:   boolean
  error:      Error | null
  errorInfo:  React.ErrorInfo | null
}

/**
 * ErrorBoundary — перехватывает ошибки в дочерних компонентах.
 * Вместо белого экрана показывает понятное сообщение с возможностью восстановления.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ errorInfo })
    console.error('[ErrorBoundary] Ошибка компонента:', error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
  }

  handleReload = () => {
    window.location.reload()
  }

  handleClearStorage = () => {
    try {
      localStorage.removeItem('brt-storage')
      localStorage.removeItem('brt-seasonality')
      localStorage.removeItem('brt-holidays')
      localStorage.removeItem('brt_lastdata')
    } catch { /* ignore */ }
    window.location.reload()
  }

  render() {
    if (!this.state.hasError) return this.props.children

    if (this.props.fallback) return this.props.fallback

    return (
      <div style={{
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        justifyContent: 'center',
        minHeight:      '100vh',
        padding:        24,
        background:     '#f8fafc',
        fontFamily:     "'Segoe UI', system-ui, sans-serif",
      }}>
        <div style={{
          maxWidth:     480,
          width:        '100%',
          background:   '#fff',
          border:       '1px solid #e2e8f0',
          borderRadius: 12,
          padding:      32,
          boxShadow:    '0 4px 24px rgba(0,0,0,0.08)',
        }}>
          {/* Иконка */}
          <div style={{
            width:        48,
            height:       48,
            borderRadius: '50%',
            background:   '#fef2f2',
            border:       '1px solid #fecaca',
            display:      'flex',
            alignItems:   'center',
            justifyContent: 'center',
            marginBottom: 16,
          }}>
            <span style={{ fontSize: 22 }}>⚠</span>
          </div>

          {/* Заголовок */}
          <div style={{ fontSize: 18, fontWeight: 700, color: '#1e293b', marginBottom: 8 }}>
            Произошла ошибка
          </div>

          {/* Описание */}
          <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.6, marginBottom: 20 }}>
            В компоненте возникла неожиданная ошибка. Попробуйте восстановить работу или перезагрузите страницу.
          </div>

          {/* Детали ошибки */}
          {this.state.error && (
            <div style={{
              background:   '#f8fafc',
              border:       '1px solid #e2e8f0',
              borderRadius: 8,
              padding:      12,
              marginBottom: 20,
              fontSize:     11,
              fontFamily:   'monospace',
              color:        '#dc2626',
              wordBreak:    'break-word',
              maxHeight:    120,
              overflow:     'auto',
            }}>
              {this.state.error.message}
            </div>
          )}

          {/* Кнопки восстановления */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button
              onClick={this.handleReset}
              style={{
                padding:      '10px 16px',
                background:   '#2563eb',
                color:        '#fff',
                border:       'none',
                borderRadius: 8,
                cursor:       'pointer',
                fontSize:     13,
                fontWeight:   600,
              }}
            >
              Попробовать снова
            </button>

            <button
              onClick={this.handleReload}
              style={{
                padding:      '10px 16px',
                background:   '#f1f5f9',
                color:        '#374151',
                border:       '1px solid #e2e8f0',
                borderRadius: 8,
                cursor:       'pointer',
                fontSize:     13,
              }}
            >
              Перезагрузить страницу
            </button>

            <button
              onClick={this.handleClearStorage}
              style={{
                padding:      '10px 16px',
                background:   '#fef2f2',
                color:        '#dc2626',
                border:       '1px solid #fecaca',
                borderRadius: 8,
                cursor:       'pointer',
                fontSize:     13,
              }}
            >
              Очистить кэш и перезагрузить
            </button>
          </div>

          {/* Подсказка */}
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 16, lineHeight: 1.5 }}>
            Если ошибка повторяется — очистите кэш браузера (Ctrl+Shift+Del) или удалите сохранённые данные.
          </div>
        </div>
      </div>
    )
  }
}

/**
 * Обёртка для отдельных секций (страниц, вкладок).
 * При ошибке показывает компактное сообщение.
 */
export function SectionErrorBoundary({ children, name }: { children: React.ReactNode; name?: string }) {
  return (
    <ErrorBoundary
      fallback={
        <div style={{
          padding:      20,
          background:   '#fef2f2',
          border:       '1px solid #fecaca',
          borderRadius: 8,
          color:        '#dc2626',
          fontSize:     13,
        }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>
            Ошибка в разделе {name ? `"${name}"` : ''}
          </div>
          <div style={{ fontSize: 12, color: '#64748b' }}>
            Перейдите на другую вкладку или перезагрузите страницу.
          </div>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  )
}
