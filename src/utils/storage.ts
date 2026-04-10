// ═══════════════════════════════════════════════════════════════════════════
// BRT Storage - Утилиты хранения (заглушки для web)
// ═══════════════════════════════════════════════════════════════════════════

export const isElectron = false

export async function saveFile(_filename: string, _data: ArrayBuffer): Promise<void> {
  // no-op in web
}

export async function openDataFile(): Promise<{ type: string; data: string | ArrayBuffer; name: string } | null> {
  return null
}

// ═══════════════════════════════════════════════════════════════════════════
// LocalStorage утилиты с обработкой ошибок
// ═══════════════════════════════════════════════════════════════════════════

const STORAGE_PREFIX = 'brt_'

export function getFromStorage<T>(key: string, defaultValue?: T): T | null {
  try {
    const item = localStorage.getItem(key.startsWith(STORAGE_PREFIX) ? key : STORAGE_PREFIX + key)
    if (item) return JSON.parse(item)
    return defaultValue ?? null
  } catch {
    return defaultValue ?? null
  }
}

export function setToStorage<T>(key: string, value: T): boolean {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

export function removeFromStorage(key: string): void {
  try {
    localStorage.removeItem(STORAGE_PREFIX + key)
  } catch {
    // ignore
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Debounce для оптимизации сохранения
// ═══════════════════════════════════════════════════════════════════════════

export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  
  return (...args: Parameters<T>) => {
    if (timeoutId) clearTimeout(timeoutId)
    timeoutId = setTimeout(() => fn(...args), delay)
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Throttle для оптимизации событий
// ═══════════════════════════════════════════════════════════════════════════

export function throttle<T extends (...args: unknown[]) => unknown>(
  fn: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      fn(...args)
      inThrottle = true
      setTimeout(() => { inThrottle = false }, limit)
    }
  }
}
