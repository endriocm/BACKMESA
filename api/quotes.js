const normalizeYahooSymbol = (ticker) => {
  if (!ticker) return ''
  if (ticker.includes('.')) return ticker
  if (/^[A-Z]{4}\d$/.test(ticker)) return `${ticker}.SA`
  return ticker
}

const normalizeBrapiSymbol = (ticker) => {
  if (!ticker) return ''
  const raw = String(ticker).toUpperCase()
  if (raw.endsWith('.SA')) return raw.replace('.SA', '')
  return raw
}

const isBrazilianSymbol = (ticker) => /^[A-Z]{4}\d$/.test(ticker) || String(ticker || '').toUpperCase().endsWith('.SA')

const lastValid = (values) => {
  if (!Array.isArray(values)) return null
  for (let i = values.length - 1; i >= 0; i -= 1) {
    const value = values[i]
    if (value != null) return value
  }
  return null
}

const getRangeStats = (values) => {
  if (!Array.isArray(values)) return { min: null, max: null }
  const filtered = values.filter((value) => value != null)
  if (!filtered.length) return { min: null, max: null }
  return {
    min: Math.min(...filtered),
    max: Math.max(...filtered),
  }
}

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Metodo nao permitido.' })
    return
  }

  const { symbol, startDate, endDate, start, end } = req.query || {}
  if (!symbol || (!startDate && !start) || (!endDate && !end)) {
    res.status(400).json({ error: 'Parametros invalidos.' })
    return
  }

  const normalized = normalizeYahooSymbol(symbol)
  const startSec = start ? Number(start) : Math.floor(new Date(startDate).getTime() / 1000)
  const endSec = end ? Number(end) : Math.floor(new Date(endDate).getTime() / 1000) + 86400

  try {
    if (isBrazilianSymbol(symbol)) {
      const brapiSymbol = normalizeBrapiSymbol(symbol)
      const brapiUrl = `https://brapi.dev/api/quote/${encodeURIComponent(brapiSymbol)}`
      const brapiHeaders = {}
      if (process.env.BRAPI_API_KEY) {
        brapiHeaders.Authorization = `Bearer ${process.env.BRAPI_API_KEY}`
      }
      const brapiResponse = await fetch(brapiUrl, { headers: brapiHeaders })
      if (brapiResponse.ok) {
        const brapiPayload = await brapiResponse.json()
        const result = brapiPayload?.results?.[0]
        if (result?.regularMarketPrice != null) {
          res.status(200).json({
            symbol: result.symbol || brapiSymbol,
            close: result.regularMarketPrice,
            high: result.regularMarketDayHigh ?? null,
            low: result.regularMarketDayLow ?? null,
            dividendsTotal: 0,
            source: 'brapi',
            lastUpdate: Date.now(),
          })
          return
        }
      }
    }
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(normalized)}?period1=${startSec}&period2=${endSec}&interval=1d&events=div`
    const response = await fetch(url)
    if (!response.ok) {
      res.status(502).json({ error: 'Falha ao buscar cotacao.' })
      return
    }
    const payload = await response.json()
    const result = payload?.chart?.result?.[0]
    const quote = result?.indicators?.quote?.[0]
    const close = lastValid(quote?.close)
    const highs = getRangeStats(quote?.high)
    const lows = getRangeStats(quote?.low)

    const dividendsObj = result?.events?.dividends || {}
    const dividends = Object.values(dividendsObj)
    const dividendTotal = dividends.reduce((sum, item) => sum + (item?.amount || 0), 0)

    res.status(200).json({
      symbol: normalized,
      close,
      high: highs.max,
      low: lows.min,
      dividendsTotal: dividendTotal,
      source: 'yahoo',
      lastUpdate: Date.now(),
    })
  } catch {
    res.status(500).json({ error: 'Erro ao consultar Yahoo.' })
  }
}
