export type BlockLocale = 'pt' | 'es' | 'en'

export const DEFAULT_LOCALE: BlockLocale = 'pt'

/**
 * Every string the package puts in front of a user: block labels, toolbox
 * category names and the `BlocksError` texts. It lives here and not in the
 * front's i18n catalogs because the back generates code headless and still
 * needs the error messages.
 */
export type BlockMessages = {
  solveTitle: string
  solveReturn: string
  solveTooltip: string
  inputTitle: string
  inputTooltip: string
  categoryLogic: string
  categoryLoops: string
  categoryMath: string
  categoryText: string
  categoryLists: string
  categoryVariables: string
  /** Label of the "new variable" button in the Variables flyout. */
  categoryVariablesNew: string
  errorMalformedWorkspace: string
  errorMissingRoot: string
  errorDuplicateRoot: string
  /** Carries `{type}`, replaced with the offending block type. */
  errorBlockNotAllowed: string
}

export const messages: Record<BlockLocale, BlockMessages> = {
  pt: {
    solveTitle: 'resolver',
    solveReturn: 'retornar',
    solveTooltip: 'Bloco principal: o corpo roda e o valor de "retornar" é a resposta.',
    inputTitle: 'entrada',
    inputTooltip: 'O valor que o problema entrega para a sua solução.',
    categoryLogic: 'Lógica',
    categoryLoops: 'Laços',
    categoryMath: 'Matemática',
    categoryText: 'Texto',
    categoryLists: 'Listas',
    categoryVariables: 'Variáveis',
    categoryVariablesNew: 'Criar variável...',
    errorMalformedWorkspace: 'A área de blocos não pôde ser lida.',
    errorMissingRoot: 'A solução precisa do bloco "resolver".',
    errorDuplicateRoot: 'A solução só pode ter um bloco "resolver".',
    errorBlockNotAllowed: 'O bloco "{type}" não é permitido nesta solução.',
  },
  es: {
    solveTitle: 'resolver',
    solveReturn: 'devolver',
    solveTooltip:
      'Bloque principal: el cuerpo se ejecuta y el valor de "devolver" es la respuesta.',
    inputTitle: 'entrada',
    inputTooltip: 'El valor que el problema entrega a tu solución.',
    categoryLogic: 'Lógica',
    categoryLoops: 'Bucles',
    categoryMath: 'Matemáticas',
    categoryText: 'Texto',
    categoryLists: 'Listas',
    categoryVariables: 'Variables',
    categoryVariablesNew: 'Crear variable...',
    errorMalformedWorkspace: 'El área de bloques no se pudo leer.',
    errorMissingRoot: 'La solución necesita el bloque "resolver".',
    errorDuplicateRoot: 'La solución solo puede tener un bloque "resolver".',
    errorBlockNotAllowed: 'El bloque "{type}" no está permitido en esta solución.',
  },
  en: {
    solveTitle: 'solve',
    solveReturn: 'return',
    solveTooltip: 'Main block: the body runs and the value of "return" is the answer.',
    inputTitle: 'input',
    inputTooltip: 'The value the problem hands to your solution.',
    categoryLogic: 'Logic',
    categoryLoops: 'Loops',
    categoryMath: 'Math',
    categoryText: 'Text',
    categoryLists: 'Lists',
    categoryVariables: 'Variables',
    categoryVariablesNew: 'Create variable...',
    errorMalformedWorkspace: 'The block workspace could not be read.',
    errorMissingRoot: 'The solution needs the "solve" block.',
    errorDuplicateRoot: 'The solution can only have one "solve" block.',
    errorBlockNotAllowed: 'The "{type}" block is not allowed in this solution.',
  },
}

export function messagesFor(locale: BlockLocale = DEFAULT_LOCALE): BlockMessages {
  return messages[locale]
}
