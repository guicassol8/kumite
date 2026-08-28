import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import ts from 'typescript'

// worker_threads loads a Worker's entry point through Node's own module
// resolution, bypassing whatever transform tsx/vitest apply to the parent
// process — that only runs a bare .ts file unaided on Node >=23.6. The
// pinned CI runner (and, per package.json's `start` script, prod) is on
// Node 20, where neither `execArgv: ['--import', 'tsx/esm']` nor tsx's own
// worker-thread patching apply their loader hooks to the Worker's entry
// module (confirmed against a real Node 20.19.5 binary). Pre-compiling to
// plain JS sidesteps the whole problem.
const root = path.dirname(fileURLToPath(import.meta.url))
const srcPath = path.join(root, '..', 'src', 'sandbox-engine.worker.ts')
const outPath = path.join(root, '..', 'dist', 'sandbox-engine.worker.js')

const source = readFileSync(srcPath, 'utf8')
const { outputText } = ts.transpileModule(source, {
  fileName: srcPath,
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    verbatimModuleSyntax: true,
  },
})

mkdirSync(path.dirname(outPath), { recursive: true })
writeFileSync(outPath, outputText)
