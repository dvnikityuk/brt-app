/**
 * Button — переиспользуемая кнопка
 */
import React, { memo } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  icon?: React.ReactNode
  loading?: boolean
}

const VARIANTS: Record<ButtonVariant, React.CSSProperties> = {
  primary: {
    background: '#2563eb',
    color: '#fff',
    border: 'none'
  },
  secondary: {
    background: '#f1f5f9',
    color: '#374151',
    border: '1px solid #e2e8f0'
  },
  danger: {
    background: '#fef2f2',
    color: '#ef4444',
    border: '1px solid #fecaca'
  },
  ghost: {
    background: 'transparent',
    color: '#64748b',
    border: '1px solid #e2e8f0'
  }
}

const SIZES: Record<ButtonSize, React.CSSProperties> = {
  sm: { padding: '4px 10px', fontSize: 11 },
  md: { padding: '6px 14px', fontSize: 12 },
  lg: { padding: '8px 18px', fontSize: 13 }
}

export const Button = memo(function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  loading,
  disabled,
  children,
  style,
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      style={{
        ...VARIANTS[variant],
        ...SIZES[size],
        borderRadius: 8,
        cursor: disabled || loading ? 'default' : 'pointer',
        fontWeight: 600,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        opacity: disabled ? 0.5 : 1,
        transition: 'opacity 0.15s',
        ...style
      }}
      {...props}
    >
      {loading && <span>⏳</span>}
      {icon && !loading && icon}
      {children}
    </button>
  )
})
