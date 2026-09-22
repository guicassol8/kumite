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

/**
 * One flat table, as the bytes the API served.
 *
 * `.blob()` rather than `.text()`, and that is not a style choice: the Encoding
 * Standard's UTF-8 decode — which `Response.text()` runs — *strips a leading
 * BOM*. Going through a string therefore threw away the very three bytes the
 * back puts there so Excel reads "Mérida" instead of "MÃ©rida", and the file an
 * organizer saved was not the file `curl` gets. Measured, not assumed: the
 * downloaded CSV started with `70 6f 73` ("pos"), never `ef bb bf`, until this
 * read stopped decoding it. Keeping the body opaque leaves the back the single
 * source of truth for the file's encoding.
 *
 * (`.json()` on this route is typed `never` by the raw() contract, so the
 * mistake this replaces could not have been a runtime SyntaxError either.)
 */
export async function fetchExportCsv(kind: ExportCsvKind): Promise<Blob> {
  const res = await api.organizer['export.csv'].$get({ query: { kind } })
  if (!res.ok) throw new Error('failed to load the export csv')
  return res.blob()
}
