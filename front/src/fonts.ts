/**
 * As três fontes da identidade, servidas do próprio bundle.
 *
 * `docs/design/identity.md` § 4 exige `@fontsource/*` e proíbe
 * `fonts.googleapis.com`: o evento roda na rede da universidade, e uma fonte
 * que depende de um terceiro é uma tela sem tipografia na hora da competição.
 * Os pacotes trazem os `.woff2` e os referenciam por caminho relativo, então o
 * Vite os resolve para `dist/assets/` — nenhuma requisição externa.
 *
 * Cada import é um peso, e um peso só: `@fontsource/barlow` inteiro traria os
 * nove, em todos os subsets, para o bundle. Os papéis abaixo são os da tabela
 * de § 4.
 */

// Barlow — o corpo da interface (--font-sans).
import '@fontsource/barlow/400.css' // corpo, small
import '@fontsource/barlow/500.css' // UI: botões, rótulos, navegação
import '@fontsource/barlow/600.css' // ênfase dentro do corpo (sem papel próprio na tabela)

// Barlow Condensed — títulos, stats e eyebrows (--font-display).
import '@fontsource/barlow-condensed/500.css' // reserva de peso do display (sem papel próprio na tabela)
import '@fontsource/barlow-condensed/600.css' // H2, H3, eyebrow, timer do chip ao vivo
import '@fontsource/barlow-condensed/700.css' // H1 de página, stat
import '@fontsource/barlow-condensed/800.css' // título e contagem do telão

// JetBrains Mono — JSON, casos de teste, códigos de evento (--font-mono).
import '@fontsource/jetbrains-mono/400.css' // mono, corpo
import '@fontsource/jetbrains-mono/500.css' // ênfase no mono (sem papel próprio na tabela)
