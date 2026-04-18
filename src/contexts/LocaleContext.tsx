import { useEffect, useMemo, useState, type PropsWithChildren } from 'react'
import { translate } from '../i18n/messages'
import { detectLocaleByConnection } from '../lib/localeApi'
import { getLocaleTag, guessLocaleFromBrowser, type AppLocale } from '../lib/locale'
import { LocaleContext, type LocaleContextValue } from './localeContext'
const LOCALE_STORAGE_KEY = 'stratforge-locale-auto'

function readStoredLocale(): AppLocale | null {
  if (typeof window === 'undefined') return null

  const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY)
  return stored === 'ru' || stored === 'en' ? stored : null
}

export function LocaleProvider({ children }: PropsWithChildren) {
  const [locale, setLocale] = useState<AppLocale>(() => readStoredLocale() ?? guessLocaleFromBrowser())
  const [country, setCountry] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    void detectLocaleByConnection()
      .then((result) => {
        if (!active) return
        setLocale(result.locale)
        setCountry(result.country)
        window.localStorage.setItem(LOCALE_STORAGE_KEY, result.locale)
      })
      .finally(() => {
        if (active) {
          setLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    document.documentElement.lang = locale === 'ru' ? 'ru' : 'en'
  }, [locale])

  const value = useMemo<LocaleContextValue>(() => {
    const localeTag = getLocaleTag(locale)

    return {
      locale,
      country,
      loading,
      t: (key, values) => translate(locale, key, values),
      formatDate: (input, options) =>
        new Intl.DateTimeFormat(localeTag, options ?? {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        }).format(new Date(input)),
      formatDateTime: (input, options) =>
        new Intl.DateTimeFormat(localeTag, options ?? {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }).format(new Date(input)),
    }
  }, [country, loading, locale])

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}
