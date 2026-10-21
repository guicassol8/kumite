import { somaDosPares, type WorkspaceState } from '@kumite/blocks'

// Reference solutions of the competition seed (#483), keyed by pt title — the
// seed's own identity (seed.ts). Test fixtures only: seed-solutions.test.ts runs
// each one in the judge sandbox against its problem's cases, which is the proof
// that every seed problem is solvable with the curated toolbox (no list append,
// no character access, 1-based list positions). Nothing here is served.
//
// Written through the small builders below instead of raw serialized JSON
// (compare @kumite/blocks' fixtures): a median by hand would be ~400 lines.

type Block = { type: string; [key: string]: unknown }
type Input = { block: Block }

const plug = (block: Block): Input => ({ block })
const variable = (name: string) => ({ VAR: { id: name } })

/** Links statements through `next`, the way Blockly serializes a stack. */
function stack(statements: Block[]): Input {
  const [first, ...rest] = statements
  if (!first) throw new Error('expected at least one statement')
  return plug(rest.length === 0 ? first : { ...first, next: stack(rest) })
}

// --- Values ---
const input = (): Block => ({ type: 'kumite_input' })
const num = (value: number): Block => ({ type: 'math_number', fields: { NUM: value } })
const text = (value: string): Block => ({ type: 'text', fields: { TEXT: value } })
const bool = (value: boolean): Block => ({
  type: 'logic_boolean',
  fields: { BOOL: value ? 'TRUE' : 'FALSE' },
})
const get = (name: string): Block => ({ type: 'variables_get', fields: variable(name) })

type ArithmeticOp = 'ADD' | 'MINUS' | 'MULTIPLY' | 'DIVIDE'
const arithmetic = (op: ArithmeticOp, a: Block, b: Block): Block => ({
  type: 'math_arithmetic',
  fields: { OP: op },
  inputs: { A: plug(a), B: plug(b) },
})
const add = (a: Block, b: Block) => arithmetic('ADD', a, b)
const remainder = (dividend: Block, divisor: Block): Block => ({
  type: 'math_modulo',
  inputs: { DIVIDEND: plug(dividend), DIVISOR: plug(divisor) },
})
const round = (op: 'ROUND' | 'ROUNDDOWN', value: Block): Block => ({
  type: 'math_round',
  fields: { OP: op },
  inputs: { NUM: plug(value) },
})

type CompareOp = 'EQ' | 'NEQ' | 'LT' | 'LTE' | 'GT' | 'GTE'
const compare = (op: CompareOp, a: Block, b: Block): Block => ({
  type: 'logic_compare',
  fields: { OP: op },
  inputs: { A: plug(a), B: plug(b) },
})
const logic = (op: 'AND' | 'OR', a: Block, b: Block): Block => ({
  type: 'logic_operation',
  fields: { OP: op },
  inputs: { A: plug(a), B: plug(b) },
})
const not = (value: Block): Block => ({ type: 'logic_negate', inputs: { BOOL: plug(value) } })

const length = (list: Block): Block => ({ type: 'lists_length', inputs: { VALUE: plug(list) } })
/** `em lista obter # position`, counted from 1 like the editor shows it. */
const itemAt = (list: Block, position: Block): Block => ({
  type: 'lists_getIndex',
  fields: { MODE: 'GET', WHERE: 'FROM_START' },
  inputs: { VALUE: plug(list), AT: plug(position) },
})
const join = (a: Block, b: Block): Block => ({
  type: 'text_join',
  extraState: { itemCount: 2 },
  inputs: { ADD0: plug(a), ADD1: plug(b) },
})

// --- Statements ---
const set = (name: string, value: Block): Block => ({
  type: 'variables_set',
  fields: variable(name),
  inputs: { VALUE: plug(value) },
})
const increment = (name: string) => set(name, add(get(name), num(1)))
const ifThen = (condition: Block, ...body: Block[]): Block => ({
  type: 'controls_if',
  inputs: { IF0: plug(condition), DO0: stack(body) },
})
const forEach = (name: string, list: Block, ...body: Block[]): Block => ({
  type: 'controls_forEach',
  fields: variable(name),
  inputs: { LIST: plug(list), DO: stack(body) },
})
const whileTrue = (condition: Block, ...body: Block[]): Block => ({
  type: 'controls_whileUntil',
  fields: { MODE: 'WHILE' },
  inputs: { BOOL: plug(condition), DO: stack(body) },
})
const repeat = (times: Block, ...body: Block[]): Block => ({
  type: 'controls_repeat_ext',
  inputs: { TIMES: plug(times), DO: stack(body) },
})

/** A whole workspace: `resolver` running `body`, returning `result`. */
function solve(variables: string[], body: Block[], result: Block): WorkspaceState {
  return {
    blocks: {
      languageVersion: 0,
      blocks: [
        {
          type: 'kumite_solve',
          x: 40,
          y: 40,
          inputs: { BODY: stack(body), RETURN: plug(result) },
        },
      ],
    },
    variables: variables.map((name) => ({ name, id: name })),
  }
}

const maiorValor = solve(
  ['maior', 'numero'],
  [
    set('maior', itemAt(input(), num(1))),
    forEach(
      'numero',
      input(),
      ifThen(compare('GT', get('numero'), get('maior')), set('maior', get('numero'))),
    ),
  ],
  get('maior'),
)

const contarNegativos = solve(
  ['total', 'numero'],
  [
    set('total', num(0)),
    forEach('numero', input(), ifThen(compare('LT', get('numero'), num(0)), increment('total'))),
  ],
  get('total'),
)

const mediaArredondada = solve(
  ['total', 'numero'],
  [
    set('total', num(0)),
    forEach('numero', input(), set('total', add(get('total'), get('numero')))),
  ],
  round('ROUND', arithmetic('DIVIDE', get('total'), length(input()))),
)

/** Trial division up to √n, with `d × d ≤ n` — `<` would call 49 prime. */
function primeTest(divisorBound: CompareOp): WorkspaceState {
  return solve(
    ['primo', 'divisor'],
    [
      set('primo', compare('GTE', input(), num(2))),
      set('divisor', num(2)),
      whileTrue(
        logic(
          'AND',
          get('primo'),
          compare(divisorBound, arithmetic('MULTIPLY', get('divisor'), get('divisor')), input()),
        ),
        ifThen(
          compare('EQ', remainder(input(), get('divisor')), num(0)),
          set('primo', bool(false)),
        ),
        increment('divisor'),
      ),
    ],
    get('primo'),
  )
}

/** Fibonacci: the ways to reach a stair are those of the two below it. */
const escadariaDoDojo = solve(
  ['anterior', 'atual', 'proximo'],
  [
    set('anterior', num(1)),
    set('atual', num(1)),
    repeat(
      input(),
      set('proximo', add(get('anterior'), get('atual'))),
      set('anterior', get('atual')),
      set('atual', get('proximo')),
    ),
  ],
  get('anterior'),
)

const maximumOfInput = (name: string) => [
  set(name, itemAt(input(), num(1))),
  forEach(
    'numero',
    input(),
    ifThen(compare('GT', get('numero'), get(name)), set(name, get('numero'))),
  ),
]

/** Gold first, then the largest score below it; `achou` covers negatives. */
const medalhaDePrata = solve(
  ['ouro', 'prata', 'achou', 'numero'],
  [
    ...maximumOfInput('ouro'),
    set('achou', bool(false)),
    forEach(
      'numero',
      input(),
      ifThen(
        logic(
          'AND',
          compare('NEQ', get('numero'), get('ouro')),
          logic('OR', not(get('achou')), compare('GT', get('numero'), get('prata'))),
        ),
        set('prata', get('numero')),
        set('achou', bool(true)),
      ),
    ),
  ],
  get('prata'),
)

/** Kadane, starting from the first item so an all-negative list still works. */
function bestCombo(start: Block): WorkspaceState {
  return solve(
    ['melhor', 'atual', 'golpe'],
    [
      set('melhor', start),
      set('atual', num(0)),
      forEach(
        'golpe',
        input(),
        set('atual', add(get('atual'), get('golpe'))),
        ifThen(compare('GT', get('atual'), get('melhor')), set('melhor', get('atual'))),
        ifThen(compare('LT', get('atual'), num(0)), set('atual', num(0))),
      ),
    ],
    get('melhor'),
  )
}

/** Prepends `n mod 2` while halving n; 0 never enters the loop. */
function binary(handlesZero: boolean): WorkspaceState {
  return solve(
    ['resultado', 'resto'],
    [
      set('resultado', text('')),
      set('resto', input()),
      whileTrue(
        compare('GT', get('resto'), num(0)),
        set('resultado', join(remainder(get('resto'), num(2)), get('resultado'))),
        set('resto', round('ROUNDDOWN', arithmetic('DIVIDE', get('resto'), num(2)))),
      ),
      ...(handlesZero ? [ifThen(compare('EQ', input(), num(0)), set('resultado', text('0')))] : []),
    ],
    get('resultado'),
  )
}

/** Row i holds tiles i and n − i + 1; the centre only once when they meet. */
const xDoTatame = solve(
  ['tamanho', 'linha', 'posicao', 'espelho', 'total'],
  [
    set('tamanho', length(input())),
    set('posicao', num(1)),
    set('total', num(0)),
    whileTrue(
      compare('LTE', get('posicao'), get('tamanho')),
      set('linha', itemAt(input(), get('posicao'))),
      set('total', add(get('total'), itemAt(get('linha'), get('posicao')))),
      set('espelho', add(arithmetic('MINUS', get('tamanho'), get('posicao')), num(1))),
      ifThen(
        compare('NEQ', get('espelho'), get('posicao')),
        set('total', add(get('total'), itemAt(get('linha'), get('espelho')))),
      ),
      increment('posicao'),
    ),
  ],
  get('total'),
)

/** No sorting: the median is the value whose rank range covers the middle. */
const lutadorDoMeio = solve(
  ['meio', 'peso', 'outro', 'menores', 'iguais', 'mediana'],
  [
    set('meio', arithmetic('DIVIDE', add(length(input()), num(1)), num(2))),
    forEach(
      'peso',
      input(),
      set('menores', num(0)),
      set('iguais', num(0)),
      forEach(
        'outro',
        input(),
        ifThen(compare('LT', get('outro'), get('peso')), increment('menores')),
        ifThen(compare('EQ', get('outro'), get('peso')), increment('iguais')),
      ),
      ifThen(
        logic(
          'AND',
          compare('LT', get('menores'), get('meio')),
          compare('GTE', add(get('menores'), get('iguais')), get('meio')),
        ),
        set('mediana', get('peso')),
      ),
    ),
  ],
  get('mediana'),
)

export const SEED_SOLUTIONS: Record<string, WorkspaceState> = {
  'Soma dos Pares': somaDosPares,
  'Maior Valor da Lista': maiorValor,
  'Contar Números Negativos': contarNegativos,
  'Média Arredondada': mediaArredondada,
  'Inscritos Primos': primeTest('LTE'),
  'Escadaria do Dojo': escadariaDoDojo,
  'Medalha de Prata': medalhaDePrata,
  'Melhor Sequência de Golpes': bestCombo(itemAt(input(), num(1))),
  'Placar em Binário': binary(true),
  'O X do Tatame': xDoTatame,
  'O Lutador do Meio': lutadorDoMeio,
}

/** Naive prata: starts at 0 instead of tracking "found one yet". */
const prataComecandoEmZero = solve(
  ['ouro', 'prata', 'numero'],
  [
    ...maximumOfInput('ouro'),
    set('prata', num(0)),
    forEach(
      'numero',
      input(),
      ifThen(
        logic(
          'AND',
          compare('NEQ', get('numero'), get('ouro')),
          compare('GT', get('numero'), get('prata')),
        ),
        set('prata', get('numero')),
      ),
    ),
  ],
  get('prata'),
)

// The classic wrong answers (#483): each passes every visible case and must
// fail at least one hidden one — the proof that the hidden cases are what
// makes these problems hard, not the statement alone.
export const SEED_TRAPS: Record<string, WorkspaceState> = {
  'Inscritos Primos': primeTest('LT'),
  'Medalha de Prata': prataComecandoEmZero,
  'Melhor Sequência de Golpes': bestCombo(num(0)),
  'Placar em Binário': binary(false),
}
