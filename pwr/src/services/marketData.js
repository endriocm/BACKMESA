const CACHE_TTL = 5 * 60 * 1000
const marketCache = new Map()

const cacheKey = (symbol, start, end) => `${symbol}:${start}:${end}`

const getCached = (key) => {
  const item = marketCache.get(key)
  if (!item) return null
  if (Date.now() - item.timestamp > CACHE_TTL) {
    marketCache.delete(key)
    return null
  }
  return item.data
}

const setCached = (key, data) => {
  marketCache.set(key, { data, timestamp: Date.now() })
  return data
}

export const normalizeYahooSymbol = (ticker) => {
  if (!ticker) return ''
  if (ticker.includes('.')) return ticker
  if (/^[A-Z]{4}\d$/.test(ticker)) return `${ticker}.SA`
  return ticker
}

const fetchYahooViaApi = async ({ symbol, startDate, endDate, start, end }) => {
  const params = new URLSearchParams({
    symbol,
  })
  if (startDate) params.set('startDate', startDate)
  if (endDate) params.set('endDate', endDate)
  if (start != null) params.set('start', String(start))
  if (end != null) params.set('end', String(end))

  const response = await fetch(`/api/quotes?${params.toString()}`)
  if (!response.ok) {
    throw new Error('Falha ao buscar cotacao')
  }
  return response.json()
}

export const fetchYahooMarketData = async ({ symbol, startDate, endDate }) => {
  const normalized = normalizeYahooSymbol(symbol)
  const start = Math.floor(new Date(startDate).getTime() / 1000)
  const end = Math.floor(new Date(endDate).getTime() / 1000) + 86400
  const key = cacheKey(normalized, start, end)
  const cached = getCached(key)
  if (cached) return { ...cached, cached: true }

  const data = await fetchYahooViaApi({
    symbol: normalized,
    startDate,
    endDate,
    start,
    end,
  })
  return setCached(key, { ...data, cached: false })
}
