// Label & style helpers — dipakai di banyak komponen

export const STATUS_LABELS = {
  todo:     'Belum Mulai',
  progress: 'Sedang Jalan',
  done:     'Selesai',
  paused:   'Ditunda'
}

export const STATUS_BADGE = {
  todo:     'badge-todo',
  progress: 'badge-progress',
  done:     'badge-done',
  paused:   'badge-paused'
}

export const CAT_LABELS = {
  dev:      '💻 Dev',
  belajar:  '📚 Belajar',
  infra:    '🖥️ Infra',
  content:  '📝 Content',
  personal: '👤 Personal',
  other:    '📌 Lainnya'
}

export const CAT_BADGE = {
  dev:      'cat-dev',
  belajar:  'cat-belajar',
  infra:    'cat-infra',
  content:  'cat-content',
  personal: 'cat-personal',
  other:    'cat-other'
}

export const PRIORITY_LABELS = { high: 'Tinggi', med: 'Sedang', low: 'Rendah' }
export const PRIORITY_DOT    = { high: 'dot-high', med: 'dot-med', low: 'dot-low' }

export function progressFillClass(pct) {
  if (pct >= 80) return 'fill-high'
  if (pct >= 40) return 'fill-mid'
  return 'fill-low'
}

export function deadlineDiff(targetDate) {
  if (!targetDate) return null
  const d = new Date(targetDate); d.setHours(0,0,0,0)
  const today = new Date(); today.setHours(0,0,0,0)
  return Math.ceil((d - today) / 86_400_000)
}

export function deadlineBadge(diff) {
  if (diff === null) return null
  if (diff < 0)  return { cls: 'badge-urgent', text: `Lewat ${Math.abs(diff)}h` }
  if (diff === 0) return { cls: 'badge-urgent', text: 'HARI INI' }
  if (diff <= 3)  return { cls: 'badge-soon',   text: `H-${diff}` }
  return { cls: 'badge-ok', text: `H-${diff}` }
}
