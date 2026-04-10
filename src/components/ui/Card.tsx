/**
 * Card — контейнер с рамкой и тенью
 */
import React, { memo } from 'react'

interface CardProps {
  children: React.ReactNode
  title?: string
  subtitle?: string
  actions?: React.ReactNode
  variant?: 'default' | 'highlight' | 'warning' | 'success'
  className?: string
  style?: React.CSSProperties
}

const VARIANTS: Record<string, React.CSSProperties> = {
  default: {
    background: '#fff',
    border: '1px solid #e2e8f0'
  },
  highlight: {
    background: '#fff',
    border: '2px solid #3b82f6'
  },
  warning: {
    background: '#fefce8',
    border: '1px solid #fcd34d'
  },
  success: {
    background: '#f0fdf4',
    border: '1px solid #86efac'
  }
}

export const Card = memo(function Card({
  children,
  title,
  subtitle,
  actions,
  variant = 'default',
  style
}: CardProps) {
  return (
    <div
      style={{
        ...VARIANTS[variant],
        borderRadius: 10,
        padding: 12,
        ...style
      }}
    >
      {(title || actions) && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: title || subtitle ? 10 : 0,
            gap: 10
          }}
        >
          <div>
            {title && (
              <div style={{ fontWeight: 600, fontSize: 13, color: '#374151' }}>
                {title}
              </div>
            )}
            {subtitle && (
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                {subtitle}
              </div>
            )}
          </div>
          {actions && <div style={{ display: 'flex', gap: 6 }}>{actions}</div>}
        </div>
      )}
      {children}
    </div>
  )
})
