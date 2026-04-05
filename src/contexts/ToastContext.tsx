/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useMemo, useState, type PropsWithChildren } from 'react'

type ToastTone = 'success' | 'error' | 'info'

type Toast = {
  id: string
  title: string
  message?: string
  tone: ToastTone
}

type ToastContextValue = {
  pushToast: (toast: Omit<Toast, 'id'>) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: PropsWithChildren) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const pushToast = (toast: Omit<Toast, 'id'>) => {
    const nextToast = { ...toast, id: crypto.randomUUID() }
    setToasts((current) => [...current, nextToast])

    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== nextToast.id))
    }, 3200)
  }

  const value = useMemo(() => ({ pushToast }), [])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast-card ${toast.tone}`}>
            <strong>{toast.title}</strong>
            {toast.message ? <p>{toast.message}</p> : null}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within ToastProvider')
  }

  return context
}
