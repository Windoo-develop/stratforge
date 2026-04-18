import { createContext } from 'react'
import type { MessageKey } from '../i18n/messages'
import type { AppLocale } from '../lib/locale'

export type LocaleContextValue = {
  locale: AppLocale
  country: string | null
  loading: boolean
  t: (key: MessageKey, values?: Record<string, string | number>) => string
  formatDate: (value: string | number | Date, options?: Intl.DateTimeFormatOptions) => string
  formatDateTime: (value: string | number | Date, options?: Intl.DateTimeFormatOptions) => string
}

export const LocaleContext = createContext<LocaleContextValue | null>(null)
