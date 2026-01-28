const normalizeTicker = (ticker) => String(ticker || '').trim().toUpperCase()

export const buildDividendKey = (ticker, from, to) => `${normalizeTicker(ticker)}|${from || ''}|${to || ''}`

export const fetchDividendsBatch = async (requests) => {
  if (!Array.isArray(requests) || !requests.length) return []
  const response = await fetch('/api/dividends', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requests }),
  })
  if (!response.ok) {
    throw new Error('dividends-batch-failed')
  }
  const payload = await response.json()
  return payload?.results || []
}

export const fetchDividend = async ({ ticker, from, to }) => {
  if (!ticker || !from || !to) return null
  const params = new URLSearchParams({
    ticker,
    from,
    to,
  })
  const response = await fetch(`/api/dividends?${params.toString()}`)
  if (!response.ok) throw new Error('dividends-fetch-failed')
  return response.json()
}
