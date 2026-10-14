export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result)
    r.onerror = reject
    r.readAsDataURL(file)
  })
}

// Shrinks a photo so it fits in browser storage. Returns a JPEG data URL, or null.
export async function resizeImage(file, max = 700, quality = 0.75) {
  const url = await fileToDataUrl(file)
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height))
      const c = document.createElement('canvas')
      c.width = Math.round(img.width * k)
      c.height = Math.round(img.height * k)
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
      resolve(c.toDataURL('image/jpeg', quality))
    }
    img.onerror = () => resolve(null)
    img.src = url
  })
}

export function timeAgo(t) {
  const m = Math.round((Date.now() - t) / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return m + ' min ago'
  const h = Math.round(m / 60)
  if (h < 24) return h + ' h ago'
  return Math.round(h / 24) + ' d ago'
}

// Saves rows (array of arrays) as a CSV file that opens in Excel.
export function downloadCsv(name, rows) {
  const esc = (v) => {
    const t = String(v ?? '')
    return /[",\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t
  }
  const blob = new Blob(['\ufeff' + rows.map((r) => r.map(esc).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

export const isToday = (t) => new Date(t).toDateString() === new Date().toDateString()

// Calls a serverless function in /api. Returns null if it is not available (for example on npm run dev).
export async function askAI(path, body) {
  try {
    const r = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!r.ok) return null
    return await r.json()
  } catch {
    return null
  }
}
