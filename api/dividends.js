const { normalizeTicker, normalizeDateKey, normalizeType, sumDividendsInRange } = require('./lib/dividends')

const CACHE_TTL = 6 * 60 * 60 * 1000
const cache = new Map()

const cacheGet = (key) => {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    cache.delete(key)
    return null
  }
  return entry
}

const cacheSet = (key, value) => {
  cache.set(key, { ...value, timestamp: Date.now() })
  return value
}

const readJsonBody = (req) => new Promise((resolve, reject) => {
  let raw = ''
  req.on('data', (chunk) => {
    raw += chunk
  })
  req.on('end', () => {
    if (!raw) {
      resolve({})
      return
    }
    try {
      resolve(JSON.parse(raw))
    } catch (error) {
      reject(error)
    }
  })
  req.on('error', reject)
})

const mapWithConcurrency = async (items, limit, mapper) => {
  const results = new Array(items.length)
  let index = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const current = index
      index += 1
      if (current >= items.length) break
      results[current] = await mapper(items[current], current)
    }
  })
  await Promise.all(workers)
  return results
}

const normalizeBrapiSymbol = (ticker) => {
  if (!ticker) return ''
  const raw = String(ticker).trim().toUpperCase()
  if (raw.endsWith('.SA')) return raw.replace('.SA', '')
  return raw
}

const isBrazilianSymbol = (ticker) => {
  const raw = String(ticker || '').trim().toUpperCase()
  return /^[A-Z]{4,6}\d{1,2}[A-Z]?$/.test(raw) || raw.endsWith('.SA')
}

const getBrapiToken = () => process.env.BRAPI_TOKEN || process.env.brapi_token || process.env.BRAPI_API_KEY

const fetchBrapiEvents = async ({ ticker }) => {
  const symbol = normalizeBrapiSymbol(ticker)
  if (!symbol) return null
  const brapiHeaders = {}
  const brapiToken = getBrapiToken()
  if (brapiToken) {
    brapiHeaders.Authorization = `Bearer ${brapiToken}`
  }
  const url = `https://brapi.dev/api/quote/${encodeURIComponent(symbol)}?dividends=true`
  const response = await fetch(url, { headers: brapiHeaders })
  if (!response.ok) return null
  const payload = await response.json()
  const result = payload?.results?.[0]
  const cashDividends = result?.dividendsData?.cashDividends || []
  const events = cashDividends
    .map((item) => {
      const amount = Number(item?.rate || 0)
      return {
        type: normalizeType(item?.label),
        dataCom: normalizeDateKey(item?.lastDatePrior),
        amount,
        paymentDate: item?.paymentDate || null,
        approvedOn: item?.approvedOn || null,
      }
    })
    .filter((event) => event.dataCom && Number.isFinite(event.amount))
  return {
    events,
    currency: result?.currency || 'BRL',
    source: 'brapi',
  }
}

const getEventsByTicker = async (ticker) => {
  const key = `events:${normalizeTicker(ticker)}`
  const cached = cacheGet(key)
  if (cached) {
    return { ticker: normalizeTicker(ticker), ...cached, cached: true }
  }
  let result = null
  if (isBrazilianSymbol(ticker)) {
    result = await fetchBrapiEvents({ ticker })
  }
  const payload = result || { events: [], currency: null, source: 'none' }
  cacheSet(key, payload)
  return { ticker: normalizeTicker(ticker), ...payload, cached: false }
}

const buildResult = (request, eventPayload) => {
  const normalized = normalizeTicker(request?.ticker)
  const from = request?.from
  const to = request?.to
  const key = `${normalized}|${normalizeDateKey(from)}|${normalizeDateKey(to)}`
  const total = sumDividendsInRange(eventPayload?.events || [], from, to)
  return {
    key,
    ticker: normalized,
    from,
    to,
    total,
    currency: eventPayload?.currency || null,
    source: eventPayload?.source || 'none',
    cached: eventPayload?.cached || false,
  }
}

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    res.status(204).end()
    return
  }

  res.setHeader('Access-Control-Allow-Origin', '*')

  if (req.method === 'GET') {
    const { ticker, from, to } = req.query || {}
    if (!ticker || !from || !to) {
      res.status(400).json({ error: 'Parametros invalidos.' })
      return
    }
    try {
      const eventsPayload = await getEventsByTicker(ticker)
      const result = buildResult({ ticker, from, to }, eventsPayload)
      res.status(200).json(result)
    } catch {
      res.status(500).json({ error: 'Falha ao buscar dividendos.' })
    }
    return
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Metodo nao permitido.' })
    return
  }

  try {
    const body = await readJsonBody(req)
    const requests = Array.isArray(body?.requests) ? body.requests : []
    if (!requests.length) {
      res.status(400).json({ error: 'Lista vazia.' })
      return
    }
    const validTickers = Array.from(new Set(
      requests
        .filter((request) => request?.ticker)
        .map((request) => normalizeTicker(request.ticker))
        .filter(Boolean),
    ))
    const payloads = await mapWithConcurrency(validTickers, 4, async (ticker) => [ticker, await getEventsByTicker(ticker)])
    const payloadMap = new Map(payloads)
    const results = requests.map((request) => {
      if (!request?.ticker || !request?.from || !request?.to) {
        return {
          key: `${normalizeTicker(request?.ticker)}|${normalizeDateKey(request?.from)}|${normalizeDateKey(request?.to)}`,
          ticker: normalizeTicker(request?.ticker),
          from: request?.from,
          to: request?.to,
          total: 0,
          source: 'invalid',
          cached: false,
        }
      }
      const payload = payloadMap.get(normalizeTicker(request.ticker)) || { events: [], currency: null, source: 'none', cached: false }
      return buildResult(request, payload)
    })
    res.status(200).json({ results })
  } catch {
    res.status(500).json({ error: 'Falha ao processar dividendos.' })
  }
}
