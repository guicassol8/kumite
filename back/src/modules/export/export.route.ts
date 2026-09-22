import { raw } from '@katajs-framework/core'

import { defineRoute } from '../../context'
import { requireOrganizer, requirePasswordUpToDate, requireUser } from '../../middlewares/auth'

import { EventExportSchema, ExportCsvQuerySchema, ExportCsvSchema } from './export.schema'
import { buildExportCsv, getEventExport } from './export.service'

// Two routes rather than one with `?format=json|csv`: `output` is static per
// route (an OutputSpec is resolved at type level), and a RawOutput obliges the
// handler to return a Response while a ZodTypeAny obliges it to return the
// validated value. A route that is sometimes JSON and sometimes CSV would have
// to lie in its `output` — which is precisely what kata's ADR-0024 exists to
// prevent. Two routes keep the contract honest, and keep `hc<AppType>` able to
// type `.text()` on one and `.json()` on the other.
//
// 401/403 aren't declared on either: both are middleware short-circuits, never
// these handlers' own outcomes (ADR-0011), same as every other organizer route.

export const getEventExportRoute = defineRoute({
  method: 'GET',
  path: '/organizer/export',
  use: [requireUser, requirePasswordUpToDate, requireOrganizer],
  input: {},
  output: EventExportSchema,
  handler: async (c) => getEventExport(c.get('db')),
})

export const getEventExportCsvRoute = defineRoute({
  method: 'GET',
  path: '/organizer/export.csv',
  use: [requireUser, requirePasswordUpToDate, requireOrganizer],
  input: { query: ExportCsvQuerySchema },
  output: raw('text/csv', ExportCsvSchema),
  handler: async (c) => {
    const { kind } = c.input.query
    const csv = buildExportCsv(await getEventExport(c.get('db')), kind)
    // The front builds its own filename (reading Content-Disposition from
    // another origin would need Access-Control-Expose-Headers app-wide), but
    // the header still goes out for whoever uses curl. Both derive the date
    // the same way — toISOString().slice(0, 10), UTC — so they agree.
    const date = new Date().toISOString().slice(0, 10)
    return new Response(csv, {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="kumite-${kind}-${date}.csv"`,
      },
    })
  },
})
