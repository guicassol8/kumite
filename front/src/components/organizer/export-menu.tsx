import { Download } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { downloadFile, exportFilename } from '@/lib/download'
import { type ExportCsvKind, fetchEventExport, fetchExportCsv } from '@/lib/export-query'

// The event's results, out of the database and into a file (#278). Lives in
// components/, not in the route file: a route module that exports anything
// besides `Route` turns off the router plugin's autoCodeSplitting.

type MenuKind = 'json' | ExportCsvKind

const CSV_MIME = 'text/csv;charset=utf-8'

// The three CSVs, in the order the menu lists them, each with its i18n key
// and its own test id.
const CSV_ITEMS: { kind: ExportCsvKind; labelKey: string; testId: string }[] = [
  { kind: 'ranking', labelKey: 'csvRanking', testId: 'export-menu-csv-ranking' },
  { kind: 'teams', labelKey: 'csvTeams', testId: 'export-menu-csv-teams' },
  { kind: 'submissions', labelKey: 'csvSubmissions', testId: 'export-menu-csv-submissions' },
]

export function ExportMenu() {
  const { t } = useTranslation()
  const [pending, setPending] = useState<MenuKind | null>(null)
  const [failed, setFailed] = useState(false)

  async function download(kind: MenuKind) {
    setPending(kind)
    setFailed(false)
    try {
      if (kind === 'json') {
        const data = await fetchEventExport()
        downloadFile(
          exportFilename('export', 'json'),
          JSON.stringify(data, null, 2),
          'application/json',
        )
      } else {
        // The body already carries the back's UTF-8 BOM — adding another here
        // would put a stray U+FEFF inside the first cell.
        downloadFile(exportFilename(kind, 'csv'), await fetchExportCsv(kind), CSV_MIME)
      }
    } catch {
      // Nothing is downloaded on failure, and the message says so: a silently
      // empty file would be worse than no file at all.
      setFailed(true)
    } finally {
      setPending(null)
    }
  }

  const busy = pending !== null

  return (
    <div className="flex flex-col items-end gap-1">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline" size="sm" data-testid="export-menu-trigger">
            <Download aria-hidden="true" className="size-4" />
            {busy ? t('organizer.overview.export.pending') : t('organizer.overview.export.button')}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            disabled={busy}
            data-testid="export-menu-json"
            onSelect={() => download('json')}
          >
            {t('organizer.overview.export.json')}
          </DropdownMenuItem>
          {CSV_ITEMS.map((item) => (
            <DropdownMenuItem
              key={item.kind}
              disabled={busy}
              data-testid={item.testId}
              onSelect={() => download(item.kind)}
            >
              {t(`organizer.overview.export.${item.labelKey}`)}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {failed && (
        <p className="text-destructive text-sm" data-testid="export-menu-error">
          {t('organizer.overview.export.error')}
        </p>
      )}
    </div>
  )
}
