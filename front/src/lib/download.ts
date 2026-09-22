// Saving a string the browser never navigated to (#278): the export arrives
// as a response body, so there is no URL to point an <a download> at. A Blob
// URL is that missing URL, and it must be revoked or the blob stays alive for
// the life of the document.

/** Hands `content` to the browser as a file named `filename`. */
export function downloadFile(filename: string, content: string, mimeType: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: mimeType }))
  try {
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    anchor.rel = 'noopener'
    // Appended before the click: a detached anchor's click is ignored by
    // Firefox, and removing it immediately after keeps the DOM as it was.
    document.body.append(anchor)
    anchor.click()
    anchor.remove()
  } finally {
    // In `finally`, not after the click: a throw between createObjectURL and
    // the click would otherwise leak the blob for good.
    URL.revokeObjectURL(url)
  }
}

/** `kumite-<kind>-<YYYY-MM-DD>.<extension>`, the name the issue asks for.
 * The date is UTC, derived exactly like the Content-Disposition the back
 * sends, so the two never disagree by a day. */
export function exportFilename(kind: string, extension: string): string {
  const date = new Date().toISOString().slice(0, 10)
  return `kumite-${kind}-${date}.${extension}`
}
