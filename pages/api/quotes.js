import axios from "axios";

export default async function handler(req, res) {
  const symbol = String(req.query.symbol || "").trim();
  if (!symbol) return res.status(400).json({ ok: false, error: "missing symbol" });

  const normalized = symbol.toUpperCase();
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(normalized)}?interval=1d&range=5d`;

  try {
    const r = await axios.get(url, {
      headers: { "User-Agent": "Mozilla/5.0", "Accept": "application/json" },
      timeout: 15000,
    });

    const result = r.data?.chart?.result?.[0];
    if (!result) return res.status(502).json({ ok: false, error: "invalid yahoo response" });

    const meta = result.meta || {};
    const closeArr = result.indicators?.quote?.[0]?.close || [];
    const lastClose = closeArr.length ? closeArr[closeArr.length - 1] : null;

    return res.json({
      ok: true,
      symbol: normalized,
      spot: meta.regularMarketPrice ?? lastClose,
      lastClose,
      currency: meta.currency,
    });
  } catch (err) {
    return res.status(err?.response?.status || 500).json({
      ok: false,
      error: "yahoo_fetch_failed",
      details: err?.response?.data || err.message,
    });
  }
}
