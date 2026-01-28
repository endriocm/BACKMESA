const normalizeTicker = (ticker) => String(ticker || '').trim().toUpperCase()

const normalizeDateKey = (value) => {
  if (!value) return ''
  const raw = String(value).trim()
  if (!raw) return ''
  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`
  const brMatch = raw.match(/(\d{2})[/-](\d{2})[/-](\d{4})/)
  if (brMatch) {
    const [, day, month, year] = brMatch
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  }
  return ''
}

const normalizeType = (value) => {
  const raw = String(value || '').trim().toUpperCase()
  if (!raw) return ''
  if (raw.includes('JCP')) return 'JCP'
  return 'DIVIDEND'
}

const sumDividendsInRange = (items, from, to) => {
  if (!Array.isArray(items) || !items.length) return 0
  const start = normalizeDateKey(from)
  const end = normalizeDateKey(to)
  if (!start || !end) return 0
  return items.reduce((sum, item) => {
    const date = normalizeDateKey(item?.dataCom || item?.record_date || item?.recordDate)
    if (!date) return sum
    if (date < start || date > end) return sum
    const amount = Number(item?.amount || item?.cash_amount || 0)
    if (!Number.isFinite(amount)) return sum
    const isJcp = String(item?.type || '').toUpperCase().includes('JCP')
    const netAmount = isJcp ? amount * 0.85 : amount
    return sum + netAmount
  }, 0)
}

module.exports = {
  normalizeTicker,
  normalizeDateKey,
  normalizeType,
  sumDividendsInRange,
}
