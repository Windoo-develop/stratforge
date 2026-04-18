export type AppLocale = 'en' | 'ru'

export const RUSSIAN_REGION_COUNTRIES = new Set(['RU', 'KZ', 'BY', 'UA'])

const RUSSIAN_TIMEZONE_PREFIXES = [
  'Europe/Moscow',
  'Europe/Kirov',
  'Europe/Volgograd',
  'Europe/Samara',
  'Europe/Astrakhan',
  'Europe/Saratov',
  'Europe/Ulyanovsk',
  'Europe/Minsk',
  'Europe/Kyiv',
  'Europe/Kiev',
  'Europe/Uzhgorod',
  'Europe/Zaporozhye',
  'Europe/Simferopol',
  'Asia/Almaty',
  'Asia/Aqtau',
  'Asia/Aqtobe',
  'Asia/Atyrau',
  'Asia/Oral',
  'Asia/Qostanay',
  'Asia/Qyzylorda',
]

const RUSSIAN_LANGUAGE_PREFIXES = ['ru', 'uk', 'be', 'kk']

export function getLocaleForCountry(country: string | null | undefined): AppLocale {
  return country && RUSSIAN_REGION_COUNTRIES.has(country.toUpperCase()) ? 'ru' : 'en'
}

export function guessLocaleFromBrowser(): AppLocale {
  if (typeof window === 'undefined') return 'en'

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
  if (timezone && RUSSIAN_TIMEZONE_PREFIXES.some((value) => timezone.startsWith(value))) {
    return 'ru'
  }

  const languages = navigator.languages?.length ? navigator.languages : [navigator.language]
  if (languages.some((value) => RUSSIAN_LANGUAGE_PREFIXES.some((prefix) => value.toLowerCase().startsWith(prefix)))) {
    return 'ru'
  }

  return 'en'
}

export function getLocaleTag(locale: AppLocale) {
  return locale === 'ru' ? 'ru-RU' : 'en-US'
}
