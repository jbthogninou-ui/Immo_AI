import { create } from 'zustand'

export type ToastTone = 'success' | 'error' | 'info' | 'warning'

export interface Toast {
  id: string
  title: string
  description?: string
  tone: ToastTone
  duration: number
}

interface ToastState {
  toasts: Toast[]
  push: (toast: Omit<Toast, 'id' | 'duration' | 'tone'> & { tone?: ToastTone; duration?: number }) => string
  dismiss: (id: string) => void
  clear: () => void
}

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  push: ({ tone = 'info', duration = 5000, ...rest }) => {
    const id = Math.random().toString(36).slice(2)
    set({ toasts: [...get().toasts, { id, tone, duration, ...rest }] })
    if (duration > 0) {
      setTimeout(() => get().dismiss(id), duration)
    }
    return id
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((toast) => toast.id !== id) }),
  clear: () => set({ toasts: [] }),
}))

/** Raccourci : toast.success('Bien publié') */
export const toast = {
  success: (title: string, description?: string) =>
    useToastStore.getState().push({ title, description, tone: 'success' }),
  error: (title: string, description?: string) =>
    useToastStore.getState().push({ title, description, tone: 'error', duration: 7000 }),
  info: (title: string, description?: string) =>
    useToastStore.getState().push({ title, description, tone: 'info' }),
  warning: (title: string, description?: string) =>
    useToastStore.getState().push({ title, description, tone: 'warning' }),
}
