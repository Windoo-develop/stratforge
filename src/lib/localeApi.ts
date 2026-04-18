import { getLocaleForCountry, guessLocaleFromBrowser, type AppLocale } from './locale'

export type LocaleDetectionResult = {
  locale: AppLocale
  country: string | null
  source: 'edge' | 'browser'
}

export async function detectLocaleByConnection(): Promise<LocaleDetectionResult> {
  try {
    const response = await fetch('/api/locale', {
      method: 'GET',
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`Locale endpoint failed with status ${response.status}`)
    }

    const payload = (await response.json()) as Partial<{ locale: AppLocale; country: string | null }>
    const country = typeof payload.country === 'string' ? payload.country.toUpperCase() : null
    const locale = payload.locale === 'ru' || payload.locale === 'en'
      ? payload.locale
      : getLocaleForCountry(country)

    return {
      locale,
      country,
      source: 'edge',
    }
  } catch {
    return {
      locale: guessLocaleFromBrowser(),
      country: null,
      source: 'browser',
    }
  }
}
