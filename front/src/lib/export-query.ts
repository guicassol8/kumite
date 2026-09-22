import { api } from './api'

// The CSV kinds are read off the typed client, never re-declared here: change
// the enum in back/src/modules/export/export.schema.ts and this type follows,
// which is the whole point of hc<AppType> (front/AGENTS.md).
type ExportCsvGetArgs = Parameters<(typeof api.organizer)['export.csv']['$get']>[0]
export type ExportCsvKind = NonNullable<ExportCsvGetArgs>['query']['kind']

/** The full JSON bundle: rankings, rounds, teams, submissions and the removed
 * teams the CSVs deliberately leave out. */
export async function fetchEventExport() {
  const res = await api.organizer.export.$get()
  if (!res.ok) throw new Error('failed to load the event export')
  return res.json()
}

/** One flat table as text. The route answers `text/csv`, so the body is read
 * with `.text()` — `.json()` on it is typed `never` by the raw() contract,
 * not a runtime SyntaxError waiting to happen. The BOM comes from the back;
 * the front must not add a second one. */
export async function fetchExportCsv(kind: ExportCsvKind): Promise<string> {
  const res = await api.organizer['export.csv'].$get({ query: { kind } })
  if (!res.ok) throw new Error('failed to load the export csv')
  return res.text()
}
