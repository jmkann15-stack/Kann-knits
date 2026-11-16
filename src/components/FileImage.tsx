import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { useObjectUrl } from '../lib/device'

// Thumbnails are small and photos never change after saving, so their object
// URLs are kept for the session: revisiting a screen shows them instantly.
const thumbUrls = new Map<string, string>()

/** Renders a stored photo by id. Uses the small thumbnail unless `full` is set. */
export function FileImage({
  fileId,
  full = false,
  className = '',
  alt = '',
}: {
  fileId?: string
  full?: boolean
  className?: string
  alt?: string
}) {
  const cached = !full && fileId ? thumbUrls.get(fileId) : undefined
  const file = useLiveQuery(() => (fileId && !cached ? db.files.get(fileId) : undefined), [fileId, cached])
  const [thumbUrl, setThumbUrl] = useState(cached)

  useEffect(() => {
    if (full || !fileId) return
    const known = thumbUrls.get(fileId)
    if (known) {
      setThumbUrl(known)
      return
    }
    if (!file) return
    const u = URL.createObjectURL(file.thumb ?? file.blob)
    thumbUrls.set(fileId, u)
    setThumbUrl(u)
  }, [file, fileId, full])

  const fullUrl = useObjectUrl(full && file ? file.blob : null)
  const url = full ? fullUrl : (cached ?? thumbUrl)
  if (!url) return <div className={`bg-oat ${className}`} />
  return <img src={url} alt={alt} className={`object-cover ${className}`} draggable={false} />
}
