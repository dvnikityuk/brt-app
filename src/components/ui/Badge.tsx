/**
 * Badge — значок/метка
 */
import React, { memo } from 'react'

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'A' | 'B' | 'C'

interface BadgeProps {
  children: React.ReactNode
  variant?: BadgeVariant
  size?: 'sm' | 'md'
}

const VARIANTS: Record<BadgeVariant, { bg: string; color: string }> = {
  default: { bg: '#f1f5f9', color: '#64748b' },
  success: { bg: '#dcfce7', color: '#166534' },
  warning: { bg: '#fef9c3', color: '#854d0e' },
  danger: { bg: '#fee2e2', color: '#991b1b' },
  info: { bg: '#dbeafe', color: '#1e40af' },
  A: { bg: '#dcfce7', color: '#166534' },
  B: { bg: '#fef9c3', color: '#854d0e' },
  C: { bg: '#fee2e2', color: '#991b1b' }
}

export const Badge = memo(function Badge({
  children,
  variant = 'default',
  size = 'md'
}: BadgeProps) {
  const { bg, color } = VARIANTS[variant]
  
  return (
    <span
      style={{
        background: bg,
        color,
        padding: size === 'sm' ? '1px 5px' : '2px 8px',
        borderRadius: 8,
        fontWeight: 700,
        fontSize: size === 'sm' ? 9 : 10,
        display: 'inline-block'
      }}
    >
      {children}
    </span>
  )
})

// ─── ABC-XYZ Badge ───────────────────────────────────────────────────────────
export const ABCBadge = memo(function ABCBadge({ value }: { value: string }) {
  const abcClass = value[0] as 'A' | 'B' | 'C'
  return <Badge variant={abcClass}>{value}</Badge>
})
