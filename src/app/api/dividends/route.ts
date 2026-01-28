import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const ticker = (searchParams.get("ticker") || "").trim();
  const limitParam = (searchParams.get("limit") || "").trim();
  const limit = Number.parseInt(limitParam, 10);
  const maxItems = Number.isFinite(limit) && limit > 0 ? limit : 3;

  if (!ticker) {
    return NextResponse.json({ error: "ticker obrigatório" }, { status: 400 });
  }

  const token = process.env.BRAPI_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "BRAPI_TOKEN não configurado" }, { status: 500 });
  }

  const sanitizeDate = (value: string) => {
    const parts = value.split("/").map((part) => part.trim());
    if (parts.length !== 3) return "";
    const [day, month, year] = parts;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  };

  const parseStatusInvest = (html: string) => {
    const text = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
    const re = /\b(Dividendo|JCP|Rend\.\s*Tributado)\b\s+(\d{2}\/\d{2}\/\d{4})\s+(\d{2}\/\d{2}\/\d{4})\s+([0-9]+(?:[.,][0-9]+)*)/g;
    const rows: Array<{ type: string; com: string; pay: string; value: number }> = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      rows.push({
        type: m[1],
        com: m[2],
        pay: m[3],
        value: Number(m[4].replace(".", "").replace(",", ".")),
      });
    }
    rows.sort((a, b) => {
      const ay = sanitizeDate(a.pay);
      const by = sanitizeDate(b.pay);
      return by.localeCompare(ay);
    });
    return rows;
  };

  const fetchStatusInvest = async (symbol: string) => {
    const slug = symbol.toLowerCase();
    const html = await fetch(`https://statusinvest.com.br/acoes/${slug}`, {
      headers: { "user-agent": "Mozilla/5.0" },
      cache: "no-store",
    }).then((r) => r.text());
    return parseStatusInvest(html);
  };

  const url = new URL(`https://brapi.dev/api/quote/${encodeURIComponent(ticker)}`);
  url.searchParams.set("dividends", "true");
  url.searchParams.set("token", token);

  const r = await fetch(url.toString(), { cache: "no-store" });
  if (!r.ok) {
    if (r.status === 401 || r.status === 403) {
      const rows = await fetchStatusInvest(ticker);
      return NextResponse.json({ source: "statusinvest", limit: maxItems, rows: rows.slice(0, maxItems) });
    }
    return NextResponse.json({ error: "Erro na brapi", status: r.status }, { status: 502 });
  }

  const data = await r.json();
  const divs = data?.results?.[0]?.dividendsData?.cashDividends || [];
  const last = divs
    .map((item: any) => ({
      type: item?.label || null,
      com: item?.lastDatePrior || null,
      pay: item?.paymentDate || null,
      value: item?.rate ?? null,
    }))
    .filter((item: any) => item.com)
    .sort((a: any, b: any) => String(b.com).localeCompare(String(a.com)))
    .slice(0, maxItems);

  return NextResponse.json({ source: "brapi", limit: maxItems, last, raw: data });
}
