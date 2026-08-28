// jsdom's default navigator.language ('en-US') would flow through the
// browser-language detector (#56) and make every test that just imports
// '@/i18n' resolve to English instead of PT. Pin it to a pt-BR locale so
// existing PT-language assertions keep working; tests that exercise
// detection itself stub navigator.language explicitly.
Object.defineProperty(window.navigator, 'language', { value: 'pt-BR', configurable: true })
Object.defineProperty(window.navigator, 'languages', { value: ['pt-BR'], configurable: true })
