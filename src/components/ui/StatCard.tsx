/**
 * StatCard — карточка статистики
 */
import { memo } from 'react'

interface StatCardProps {
  label: string
  value: string | number
  color?: string
  icon?: string
}

export const StatCard = memo(function StatCard({
  label,
  value,
  color = '#3b82f6',
  icon
}: StatCardProps) {
  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: 8,
        padding: '8px 16px',
        textAlign: 'center',
        minWidth: 80
      }}
    >
      <div style={{ fontSize: 18, fontWeight: 700, color }}>
        {icon && <span style={{ marginRight: 4 }}>{icon}</span>}
        {value}
      </div>
      <div style={{ fontSize: 11, color: '#64748b' }}>{label}</div>
    </div>
  )
})

// ─── Stat Row — горизонтальный ряд карточек ──────────────────────────────────
interface StatRowProps {
  stats: Array<{
    label: string
    value: string | number
    color?: string
  }>
}

export const StatRow = memo(function StatRow({ stats }: StatRowProps) {
  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
      {stats.map((s) => (
        <StatCard key={s.label} {...s} />
      ))}
    </div>
  )
})
