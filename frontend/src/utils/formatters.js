/**
 * Number and text formatters for the Market Panic UI.
 */

export function formatPrice(num) {
  return `$${Number(num).toFixed(2)}`
}

export function formatChange(pct) {
  const sign = pct >= 0 ? '+' : ''
  return `${sign}${Number(pct).toFixed(2)}%`
}

export function formatCash(num) {
  return `$${Number(num).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export function shortNumber(num) {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`
  return num.toString()
}

export function categoryIcon(category) {
  const icons = {
    earnings: '📊',
    scandal: '💥',
    rumor: '👀',
    regulation: '⚖️',
    partnership: '🤝',
    panic: '🔥',
    recovery: '📈',
  }
  return icons[category] || '📰'
}
