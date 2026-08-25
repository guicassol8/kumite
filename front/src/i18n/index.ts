import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import en from './en.json'
import es from './es.json'
import pt from './pt.json'

// PT is the default; ES and EN are first-class (PUCRS × Mérida event).
// Language detection/persistence arrives with its own task.
i18n.use(initReactI18next).init({
  resources: {
    pt: { translation: pt },
    es: { translation: es },
    en: { translation: en },
  },
  lng: 'pt',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
})

export default i18n
