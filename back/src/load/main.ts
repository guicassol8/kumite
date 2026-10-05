import { execFileSync } from 'node:child_process'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { assertTargetAllowed, parseLoadConfig, readEnvFile, USAGE, wantsHelp } from './config'
import { renderMarkdown, writeReport } from './report'
import { exitCodeFor, runScenario } from './scenarios'
import { newRunId } from './world'

// `pnpm load <baseline|smoke> [flags]` (#136). Exit codes: 0 passed, 1 the
// run had failures (the report lists them), 2 configuration error.

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url))
const argv = process.argv.slice(2)

if (wantsHelp(argv)) {
  console.log(USAGE)
  process.exit(0)
}

const parsed = parseLoadConfig({
  argv,
  env: process.env,
  envFile: readEnvFile(new URL('../../.env', import.meta.url)),
  defaultOut: join(repoRoot, 'load-results'),
})
if (!parsed.ok) {
  console.error(`load: ${parsed.message}\n\n${USAGE}`)
  process.exit(2)
}
const { config } = parsed

const refusal = assertTargetAllowed(config.url, config.allowRemote)
if (refusal) {
  console.error(`load: ${refusal}`)
  process.exit(2)
}

function currentCommit(): string | null {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: repoRoot })
      .toString()
      .trim()
  } catch {
    return null
  }
}

// First Ctrl-C: stop scheduling, close the streams, write the partial report.
// Second: leave now.
const controller = new AbortController()
process.on('SIGINT', () => {
  if (controller.signal.aborted) process.exit(130)
  console.error('\nload: aborting — writing the partial report (Ctrl-C again to quit now)')
  controller.abort()
})

const runId = newRunId()
const report = await runScenario({
  config,
  runId,
  signal: controller.signal,
  commit: currentCommit(),
  log: (message) => console.error(`load: ${message}`),
})
// A relative --out is relative to where `pnpm load` was typed (INIT_CWD),
// not to back/, where pnpm --filter runs the script.
const outDir = resolve(process.env['INIT_CWD'] ?? process.cwd(), config.out)
const dir = await writeReport(report, join(outDir, `${config.scenario}-${runId}`))

console.log(renderMarkdown(report))
console.error(`load: ${report.status} — report written to ${dir}`)
process.exitCode = exitCodeFor(report)
