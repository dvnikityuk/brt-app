// ═══════════════════════════════════════════════════════════════════════════
// Toast Component - Оптимизированная система уведомлений
// ═══════════════════════════════════════════════════════════════════════════

import React, { createContext, useContext, useState, useCallback, useEffect, memo } from 'react'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface Toast {
  id: string
  type: ToastType
  title: string
  message?: string
  duration?: number
}

interface ToastContextValue {
  toasts: Toast[]
  addToast: (t: Omit<Toast, 'id'>) => void
  removeToast: (id: string) => void
  success: (title: string, message?: string) => void
  error: (title: string, message?: string) => void
  warning: (title: string, message?: string) => void
  info: (title: string, message?: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

// ─── Константы ───────────────────────────────────────────────────────────────
const ICONS: Readonly<Record<ToastType, string>> = {
  success: '✅',
  error: '❌',
  warning: '⚠️',
  info: 'ℹ️'
}

const COLORS: Readonly<Record<ToastType, { bg: string; border: string; title: string; bar: string }>> = {
  success: { bg: '#f0fdf4', border: '#86efac', title: '#166534', bar: '#22c55e' },
  error: { bg: '#fef2f2', border: '#fca5a5', title: '#991b1b', bar: '#ef4444' },
  warning: { bg: '#fefce8', border: '#fcd34d', title: '#854d0e', bar: '#f59e0b' },
  info: { bg: '#eff6ff', border: '#93c5fd', title: '#1e40af', bar: '#3b82f6' },
}

const DURATIONS: Readonly<Record<ToastType, number>> = {
  success: 4000,
  error: 6000,
  warning: 5000,
  info: 4000,
}

// ─── ToastItem ───────────────────────────────────────────────────────────────
interface ToastItemProps {
  toast: Toast
  onRemove: (id: string) => void
}

const ToastItem = memo(function ToastItem({ toast, onRemove }: ToastItemProps) {
  const [visible, setVisible] = useState(false)
  const c = COLORS[toast.type]

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 10)
    return () => clearTimeout(t)
  }, [])

  const handleRemove = useCallback(() => {
    onRemove(toast.id)
  }, [onRemove, toast.id])

  return (
    <div
      style={{
        position: 'relative',
        overflow: 'hidden',
        background: c.bg,
        border: `1px solid ${c.border}`,
        borderRadius: 10,
        padding: '10px 14px',
        paddingRight: 36,
        minWidth: 280,
        maxWidth: 400,
        boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
        transform: visible ? 'translateX(0)' : 'translateX(120%)',
        opacity: visible ? 1 : 0,
        transition: 'transform 0.3s cubic-bezier(.22,.68,0,1.2), opacity 0.3s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <span style={{ fontSize: 16, flexShrink: 0 }}>{ICONS[toast.type]}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 12, color: c.title }}>{toast.title}</div>
          {toast.message && (
            <div style={{ fontSize: 11, color: '#475569', marginTop: 2, lineHeight: 1.5 }}>
              {toast.message}
            </div>
          )}
        </div>
      </div>
      <button
        onClick={handleRemove}
        style={{
          position: 'absolute',
          top: 6,
          right: 6,
          border: 'none',
          background: 'none',
          cursor: 'pointer',
          color: '#94a3b8',
          fontSize: 14,
          lineHeight: 1,
          padding: '2px 4px',
        }}
      >
        ✕
      </button>
      {toast.duration && toast.duration > 0 && (
        <>
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              height: 3,
              background: c.bar,
              borderRadius: '0 0 10px 10px',
              animation: `toastBar ${toast.duration}ms linear forwards`,
            }}
          />
          <style>{`@keyframes toastBar { from { width: 100% } to { width: 0% } }`}</style>
        </>
      )}
    </div>
  )
})

// ─── ToastContainer ──────────────────────────────────────────────────────────
interface ToastContainerProps {
  toasts: Toast[]
  onRemove: (id: string) => void
}

const ToastContainer = memo(function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  if (!toasts.length) return null
  
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 20,
        right: 20,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        pointerEvents: 'none',
      }}
    >
      {toasts.map(t => (
        <div key={t.id} style={{ pointerEvents: 'all' }}>
          <ToastItem toast={t} onRemove={onRemove} />
        </div>
      ))}
    </div>
  )
})

// ─── ToastProvider ───────────────────────────────────────────────────────────
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const addToast = useCallback((t: Omit<Toast, 'id'>) => {
    const id = Date.now().toString() + Math.random().toString(36).slice(2)
    const duration = t.duration ?? DURATIONS[t.type]
    const toast: Toast = { ...t, id, duration }
    
    setToasts(prev => [...prev.slice(-4), toast])
    
    if (duration > 0) {
      setTimeout(() => removeToast(id), duration)
    }
  }, [removeToast])

  const success = useCallback((title: string, message?: string) => 
    addToast({ type: 'success', title, message }), [addToast])
  
  const error = useCallback((title: string, message?: string) => 
    addToast({ type: 'error', title, message }), [addToast])
  
  const warning = useCallback((title: string, message?: string) => 
    addToast({ type: 'warning', title, message }), [addToast])
  
  const info = useCallback((title: string, message?: string) => 
    addToast({ type: 'info', title, message }), [addToast])

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast, success, error, warning, info }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  )
}

// ─── Hook ────────────────────────────────────────────────────────────────────
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be inside ToastProvider')
  return ctx
}
