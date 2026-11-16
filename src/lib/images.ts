// Client-side photo compression so IndexedDB doesn't fill up with 12 MP originals.

export interface CompressedImage {
  blob: Blob
  thumb: Blob
  width: number
  height: number
}

function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    // <img> applies EXIF orientation, so portrait phone photos stay upright.
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not read that image.'))
    }
    img.src = url
  })
}

function render(img: HTMLImageElement, maxEdge: number, quality: number): Promise<{ blob: Blob; w: number; h: number }> {
  const scale = Math.min(1, maxEdge / Math.max(img.naturalWidth, img.naturalHeight))
  const w = Math.max(1, Math.round(img.naturalWidth * scale))
  const h = Math.max(1, Math.round(img.naturalHeight * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#fff' // JPEG has no transparency
  ctx.fillRect(0, 0, w, h)
  ctx.drawImage(img, 0, 0, w, h)
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => {
        // Free canvas memory promptly (iOS is strict about canvas memory).
        canvas.width = canvas.height = 0
        if (b) resolve({ blob: b, w, h })
        else reject(new Error('Could not compress that image.'))
      },
      'image/jpeg',
      quality,
    ),
  )
}

/** Resize to max 1600px on the long edge at JPEG 0.8, plus a 480px thumbnail. */
export async function compressImage(file: Blob, maxEdge = 1600, quality = 0.8): Promise<CompressedImage> {
  const img = await loadImage(file)
  const full = await render(img, maxEdge, quality)
  const thumb = await render(img, 480, 0.75)
  return { blob: full.blob, thumb: thumb.blob, width: full.w, height: full.h }
}
