import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './en'
import es from './es'

const KEY = 'haber:lang'

export type Lang = 'es' | 'en'

function initialLang(): Lang {
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'es' || v === 'en') return v
  } catch {
    /* private mode */
  }
  // Built for an Argentine user: Spanish unless the browser clearly prefers English.
  return typeof navigator !== 'undefined' && navigator.language?.startsWith('en') ? 'en' : 'es'
}

i18n.use(initReactI18next).init({
  resources: { es: { translation: es }, en: { translation: en } },
  lng: initialLang(),
  fallbackLng: 'es',
  interpolation: { escapeValue: false },
  returnObjects: true,
})

export function setLang(l: Lang) {
  try {
    localStorage.setItem(KEY, l)
  } catch {
    /* ignore */
  }
  void i18n.changeLanguage(l)
  document.documentElement.lang = l
}

if (typeof document !== 'undefined') document.documentElement.lang = i18n.language

export default i18n
