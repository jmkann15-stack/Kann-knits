import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { useObjectUrl } from '../lib/device'

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
  const file = useLiveQuery(() => (fileId ? db.files.get(fileId) : undefined), [fileId])
  const url = useObjectUrl(file ? (full ? file.blob : (file.thumb ?? file.blob)) : null)
  if (!url) return <div className={`bg-oat ${className}`} />
  return <img src={url} alt={alt} className={`object-cover ${className}`} draggable={false} />
}
