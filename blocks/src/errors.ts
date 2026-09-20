export type BlocksErrorCode =
  | 'malformed-workspace'
  | 'missing-root'
  | 'duplicate-root'
  | 'block-not-allowed'
  | 'field-value-not-allowed'
  | 'disabled-block'
  | 'invalid-generated-code'

/**
 * Thrown by `generateSolution`. Callers branch on `code`, never on the message
 * — the message is localized and exists for the user, the code for #20's HTTP
 * rejection mapping.
 */
export class BlocksError extends Error {
  readonly code: BlocksErrorCode
  readonly blockType: string | undefined

  constructor(
    code: BlocksErrorCode,
    message: string,
    options: { blockType?: string; cause?: unknown } = {},
  ) {
    super(message, { cause: options.cause })
    this.name = 'BlocksError'
    this.code = code
    this.blockType = options.blockType
  }
}
