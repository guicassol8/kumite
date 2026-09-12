import i18n from 'i18next'
import LanguageDetector, { type CustomDetector } from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'

import en from './en.json'
import es from './es.json'
import pt from './pt.json'

const STORAGE_KEY = 'kumite-lang'

// i18next-browser-languagedetector's own 'localStorage' detector lets a
// throwing window.localStorage accessor crash init. This wraps every access
// in try/catch so language detection still works when storage is unavailable.
const localStorageSafe: CustomDetector = {
  name: 'localStorageSafe',
  lookup() {
    try {
      return window.localStorage.getItem(STORAGE_KEY) ?? undefined
    } catch {
      return undefined
    }
  },
  cacheUserLanguage(lng) {
    try {
      window.localStorage.setItem(STORAGE_KEY, lng)
    } catch {
      // storage unavailable: detection still works, it just won't persist.
    }
  },
}

const languageDetector = new LanguageDetector()
languageDetector.addDetector(localStorageSafe)

// PT is the default/fallback (PUCRS × Mérida event). `load: 'languageOnly'`
// turns es-MX/en-US into es/en; anything else falls back to PT.
i18n
  .use(languageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      pt: { translation: pt },
      es: { translation: es },
      en: { translation: en },
    },
    fallbackLng: 'pt',
    supportedLngs: ['pt', 'es', 'en'],
    load: 'languageOnly',
    detection: {
      order: ['localStorageSafe', 'navigator'],
      caches: ['localStorageSafe'],
    },
    interpolation: { escapeValue: false },
  })

// #230: index.html ships a static lang="pt" as the starting guess (it has to
// pick something before any module runs); this is what keeps it honest once
// i18n resolves — here, not in a component, because it has to run before
// React mounts and doesn't depend on any tree being alive.
function syncHtmlLang(language: string) {
  document.documentElement.lang = language
}
i18n.on('languageChanged', syncHtmlLang)
syncHtmlLang(i18n.resolvedLanguage ?? 'pt')

export default i18n
