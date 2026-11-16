/**
 * Hand a file to the phone: the Share sheet where it can take files
 * (iPhone: Save to Files / Save Image, Mail, AirDrop), otherwise a normal
 * download. Must be called straight from a tap. Returns false if cancelled.
 */
export async function shareOrDownload(file: File, title: string): Promise<boolean> {
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title })
      return true
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return false
      // Some browsers refuse the share at the last moment; fall back to a download.
    }
  }
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = file.name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
  return true
}
