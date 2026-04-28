import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const publicDir = join(root, "public");
const port = Number(process.env.PORT || 3050);
const host = process.env.MARKETS_DASHBOARD_HOST || (process.env.RENDER ? "0.0.0.0" : "127.0.0.1");
const version = "0.1.0";
const cache = new Map();
const cacheTtlMs = 2 * 60 * 1000;

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

const baseGroups = {
  indices: [
    ["S&P 500", "^spx", "US", "AMERICAS"],
    ["Nasdaq 100", "^ndq", "US", "AMERICAS"],
    ["Dow Jones", "^dji", "US", "AMERICAS"],
    ["FTSE 100", "^ukx", "UK", "EMEA"],
    ["DAX", "^dax", "DE", "EMEA"],
    ["CAC 40", "^cac", "FR", "EMEA"],
    ["Nikkei 225", "^nkx", "JP", "APAC"],
    ["Hang Seng", "^hsi", "HK", "APAC"]
  ],
  stocks: [
    ["Apple", "aapl.us", "Mega-cap", "AMERICAS"],
    ["Microsoft", "msft.us", "Mega-cap", "AMERICAS"],
    ["Nvidia", "nvda.us", "Mega-cap", "AMERICAS"],
    ["Alphabet", "googl.us", "Mega-cap", "AMERICAS"],
    ["Amazon", "amzn.us", "Mega-cap", "AMERICAS"],
    ["Meta", "meta.us", "Mega-cap", "AMERICAS"],
    ["Tesla", "tsla.us", "Mega-cap", "AMERICAS"],
    ["Broadcom", "avgo.us", "Mega-cap", "AMERICAS"]
  ],
  macro: [
    ["EUR/USD", "eurusd", "FX", "EMEA"],
    ["GBP/USD", "gbpusd", "FX", "EMEA"],
    ["USD/JPY", "usdjpy", "FX", "APAC"],
    ["Gold", "xauusd", "Commodity", "GLOBAL"],
    ["Bitcoin", "btcusd", "Crypto", "GLOBAL"]
  ]
};

const lenses = {
  global: {
    label: "Global",
    regions: ["AMERICAS", "EMEA", "APAC", "GLOBAL"],
    indices: baseGroups.indices,
    stocks: baseGroups.stocks,
    macro: baseGroups.macro,
    terms: ["global", "earnings", "markets", "rates", "ai", "china", "fed", "europe"]
  },
  european: {
    label: "European",
    regions: ["EMEA", "GLOBAL", "AMERICAS", "APAC"],
    indices: [["STOXX Europe 50", "^sx5e", "Europe", "EMEA"], ["DAX", "^dax", "DE", "EMEA"], ["CAC 40", "^cac", "FR", "EMEA"], ["FTSE 100", "^ukx", "UK", "EMEA"]],
    stocks: [["ASML", "asml.us", "Semis", "EMEA"], ["SAP", "sap.de", "Software", "EMEA"], ["Shell", "shel.uk", "Energy", "EMEA"], ["AstraZeneca", "azn.uk", "Healthcare", "EMEA"], ["LVMH", "mc.fr", "Luxury", "EMEA"], ["Novo Nordisk", "novob.dk", "Healthcare", "EMEA"]],
    macro: [["EUR/USD", "eurusd", "FX", "EMEA"], ["GBP/USD", "gbpusd", "FX", "EMEA"], ["DAX", "^dax", "Index", "EMEA"], ["Gold", "xauusd", "Commodity", "GLOBAL"]],
    terms: ["europe", "european", "ecb", "euro", "dax", "ftse", "luxury", "asml", "sap", "uk", "france", "germany"]
  },
  uk: {
    label: "UK",
    regions: ["EMEA", "GLOBAL", "AMERICAS", "APAC"],
    indices: [["FTSE 100", "^ukx", "UK", "EMEA"], ["FTSE 250", "^mcx", "UK", "EMEA"], ["S&P 500", "^spx", "US comparator", "AMERICAS"], ["DAX", "^dax", "EU comparator", "EMEA"]],
    stocks: [["Shell", "shel.uk", "Energy", "EMEA"], ["AstraZeneca", "azn.uk", "Healthcare", "EMEA"], ["HSBC", "hsba.uk", "Banks", "EMEA"], ["Unilever", "ulvr.uk", "Staples", "EMEA"], ["BP", "bp.uk", "Energy", "EMEA"], ["RELX", "rel.uk", "Data", "EMEA"]],
    macro: [["GBP/USD", "gbpusd", "FX", "EMEA"], ["EUR/GBP", "eurgbp", "FX", "EMEA"], ["Gold", "xauusd", "Commodity", "GLOBAL"]],
    terms: ["uk", "britain", "ftse", "sterling", "bank of england", "london", "shell", "astrazeneca", "hsbc", "unilever"]
  },
  "emerging-market": {
    label: "Emerging Market",
    regions: ["APAC", "EMEA", "AMERICAS", "GLOBAL"],
    indices: [["Hang Seng", "^hsi", "HK/China", "APAC"], ["Bovespa", "^bvsp", "Brazil", "AMERICAS"], ["Nifty 50", "^nse50", "India", "APAC"], ["S&P 500", "^spx", "US comparator", "AMERICAS"]],
    stocks: [["Alibaba", "baba.us", "China ADR", "APAC"], ["Tencent", "0700.hk", "China", "APAC"], ["TSMC", "tsm.us", "Taiwan ADR", "APAC"], ["Vale", "vale.us", "Brazil", "AMERICAS"], ["MercadoLibre", "meli.us", "LatAm", "AMERICAS"], ["Infosys", "infy.us", "India ADR", "APAC"]],
    macro: [["USD/CNH", "usdcnh", "FX", "APAC"], ["USD/BRL", "usdbrl", "FX", "AMERICAS"], ["USD/INR", "usdinr", "FX", "APAC"], ["Gold", "xauusd", "Commodity", "GLOBAL"]],
    terms: ["emerging", "china", "india", "brazil", "tariff", "commodity", "dollar", "asia", "latam", "yuan"]
  },
  apac: {
    label: "APAC",
    regions: ["APAC", "GLOBAL", "AMERICAS", "EMEA"],
    indices: [["Nikkei 225", "^nkx", "JP", "APAC"], ["Hang Seng", "^hsi", "HK", "APAC"], ["ASX 200", "^aord", "AU", "APAC"], ["S&P 500", "^spx", "US comparator", "AMERICAS"]],
    stocks: [["Toyota", "7203.jp", "Japan", "APAC"], ["Tencent", "0700.hk", "China", "APAC"], ["Alibaba", "baba.us", "China ADR", "APAC"], ["TSMC", "tsm.us", "Taiwan ADR", "APAC"], ["Sony", "6758.jp", "Japan", "APAC"], ["Samsung Elec.", "005930.kr", "Korea", "APAC"]],
    macro: [["USD/JPY", "usdjpy", "FX", "APAC"], ["USD/CNH", "usdcnh", "FX", "APAC"], ["Bitcoin", "btcusd", "Crypto", "GLOBAL"]],
    terms: ["asia", "apac", "china", "japan", "hong kong", "taiwan", "korea", "yen", "semiconductor"]
  },
  japan: {
    label: "Japan",
    regions: ["APAC", "GLOBAL", "AMERICAS", "EMEA"],
    indices: [["Nikkei 225", "^nkx", "Japan", "APAC"], ["Topix", "^tpx", "Japan", "APAC"], ["S&P 500", "^spx", "US comparator", "AMERICAS"]],
    stocks: [["Toyota", "7203.jp", "Autos", "APAC"], ["Sony", "6758.jp", "Consumer Tech", "APAC"], ["Mitsubishi UFJ", "8306.jp", "Banks", "APAC"], ["Hitachi", "6501.jp", "Industrials", "APAC"], ["Nintendo", "7974.jp", "Gaming", "APAC"], ["Keyence", "6861.jp", "Automation", "APAC"]],
    macro: [["USD/JPY", "usdjpy", "FX", "APAC"], ["Nikkei 225", "^nkx", "Index", "APAC"], ["Gold", "xauusd", "Commodity", "GLOBAL"]],
    terms: ["japan", "nikkei", "boj", "yen", "toyota", "sony", "tokyo", "exporter"]
  },
  "us-growth": {
    label: "US Growth",
    regions: ["AMERICAS", "GLOBAL", "APAC", "EMEA"],
    indices: [["Nasdaq 100", "^ndq", "Growth", "AMERICAS"], ["S&P 500", "^spx", "Broad US", "AMERICAS"], ["Russell 1000", "^rui", "Large-cap", "AMERICAS"]],
    stocks: [["Nvidia", "nvda.us", "AI", "AMERICAS"], ["Amazon", "amzn.us", "Consumer/Cloud", "AMERICAS"], ["Tesla", "tsla.us", "EV", "AMERICAS"], ["Meta", "meta.us", "Platforms", "AMERICAS"], ["Netflix", "nflx.us", "Streaming", "AMERICAS"], ["Salesforce", "crm.us", "Software", "AMERICAS"]],
    macro: [["US Dollar", "usdidx", "FX", "AMERICAS"], ["10Y proxy", "^tnx", "Rates", "AMERICAS"], ["Bitcoin", "btcusd", "Crypto", "GLOBAL"]],
    terms: ["growth", "nasdaq", "ai", "cloud", "consumer", "software", "earnings", "multiple", "guidance"]
  },
  "us-technology": {
    label: "US Technology",
    regions: ["AMERICAS", "APAC", "GLOBAL", "EMEA"],
    indices: [["Nasdaq 100", "^ndq", "Tech", "AMERICAS"], ["S&P 500", "^spx", "US", "AMERICAS"]],
    stocks: [["Nvidia", "nvda.us", "AI chips", "AMERICAS"], ["Microsoft", "msft.us", "Cloud/AI", "AMERICAS"], ["Apple", "aapl.us", "Devices", "AMERICAS"], ["Alphabet", "googl.us", "Search/AI", "AMERICAS"], ["Meta", "meta.us", "Platforms", "AMERICAS"], ["Broadcom", "avgo.us", "Semis", "AMERICAS"], ["Oracle", "orcl.us", "Cloud", "AMERICAS"], ["AMD", "amd.us", "Semis", "AMERICAS"]],
    macro: [["USD/JPY", "usdjpy", "Supply chain FX", "APAC"], ["Bitcoin", "btcusd", "Risk appetite", "GLOBAL"]],
    terms: ["technology", "tech", "ai", "chip", "semiconductor", "cloud", "software", "data center", "nvidia", "openai"]
  },
  "us-income-value": {
    label: "US Income and Value",
    regions: ["AMERICAS", "GLOBAL", "EMEA", "APAC"],
    indices: [["Dow Jones", "^dji", "Value", "AMERICAS"], ["S&P 500", "^spx", "US", "AMERICAS"], ["Russell 1000 Value", "^ruj", "Value", "AMERICAS"]],
    stocks: [["Berkshire Hathaway", "brk-b.us", "Value", "AMERICAS"], ["JPMorgan", "jpm.us", "Banks", "AMERICAS"], ["Exxon Mobil", "xom.us", "Energy", "AMERICAS"], ["Johnson & Johnson", "jnj.us", "Healthcare", "AMERICAS"], ["Procter & Gamble", "pg.us", "Staples", "AMERICAS"], ["Coca-Cola", "ko.us", "Staples", "AMERICAS"], ["Chevron", "cvx.us", "Energy", "AMERICAS"], ["Verizon", "vz.us", "Income", "AMERICAS"]],
    macro: [["10Y proxy", "^tnx", "Rates", "AMERICAS"], ["Gold", "xauusd", "Real assets", "GLOBAL"], ["WTI Oil", "cl.f", "Energy", "GLOBAL"]],
    terms: ["dividend", "value", "income", "banks", "energy", "staples", "yield", "cash flow", "buyback"]
  }
};

const stockDirectory = [
  ["Apple", "aapl.us", "AMERICAS", ["aapl", "apple"]],
  ["Microsoft", "msft.us", "AMERICAS", ["msft", "microsoft"]],
  ["Nvidia", "nvda.us", "AMERICAS", ["nvda", "nvidia"]],
  ["Alphabet", "googl.us", "AMERICAS", ["googl", "google", "alphabet"]],
  ["Amazon", "amzn.us", "AMERICAS", ["amzn", "amazon"]],
  ["Meta", "meta.us", "AMERICAS", ["meta", "facebook"]],
  ["Tesla", "tsla.us", "AMERICAS", ["tsla", "tesla"]],
  ["Broadcom", "avgo.us", "AMERICAS", ["avgo", "broadcom"]],
  ["Taiwan Semiconductor", "tsm.us", "APAC", ["tsm", "tsmc", "taiwan semiconductor"]],
  ["Toyota", "7203.jp", "APAC", ["toyota", "7203"]],
  ["Tencent", "0700.hk", "APAC", ["tencent", "0700"]],
  ["Alibaba", "baba.us", "APAC", ["baba", "alibaba"]],
  ["ASML", "asml.us", "EMEA", ["asml"]],
  ["SAP", "sap.de", "EMEA", ["sap"]],
  ["Shell", "shel.uk", "EMEA", ["shell", "shel"]],
  ["AstraZeneca", "azn.uk", "EMEA", ["astrazeneca", "azn"]]
];

const feeds = [
  { name: "FT", url: "https://www.ft.com/?format=rss" },
  { name: "BBC Business", url: "https://feeds.bbci.co.uk/news/business/rss.xml" },
  { name: "Investing.com Markets", url: "https://www.investing.com/rss/news_25.rss" }
];

function json(res, status, body) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  res.end(JSON.stringify(body, null, 2));
}

function n(value) {
  return Number.isFinite(Number(value)) ? Number(value) : null;
}

function decodeXml(value = "") {
  return String(value)
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function strip(value = "", max = 220) {
  const cleaned = decodeXml(value);
  return cleaned.length > max ? `${cleaned.slice(0, max - 1).trim()}...` : cleaned;
}

function formatDate(value) {
  const time = Date.parse(value || "");
  if (!Number.isFinite(time)) return "n/a";
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short" }).format(new Date(time));
}

function daysSince(value) {
  const time = Date.parse(value || "");
  if (!Number.isFinite(time)) return null;
  return Math.max(0, Math.floor((Date.now() - time) / 86_400_000));
}

function compactNumber(value) {
  if (!Number.isFinite(value)) return "n/a";
  if (Math.abs(value) >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}bn`;
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}m`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return String(Math.round(value));
}

const yahooSymbols = {
  "^spx": "^GSPC",
  "^ndq": "^NDX",
  "^dji": "^DJI",
  "^ukx": "^FTSE",
  "^dax": "^GDAXI",
  "^cac": "^FCHI",
  "^nkx": "^N225",
  "^hsi": "^HSI",
  "^sx5e": "^STOXX50E",
  "^mcx": "^FTMC",
  "^bvsp": "^BVSP",
  "^nse50": "^NSEI",
  "^aord": "^AORD",
  "^tpx": "^TOPX",
  "^rui": "^RUI",
  "^ruj": "^RUJ",
  "^tnx": "^TNX",
  "eurusd": "EURUSD=X",
  "gbpusd": "GBPUSD=X",
  "usdjpy": "JPY=X",
  "eurgbp": "EURGBP=X",
  "usdcnh": "CNH=X",
  "usdbrl": "BRL=X",
  "usdinr": "INR=X",
  "usdidx": "DX-Y.NYB",
  "xauusd": "GC=F",
  "btcusd": "BTC-USD",
  "cl.f": "CL=F",
  "0700.hk": "0700.HK",
  "005930.kr": "005930.KS",
  "brk-b.us": "BRK-B"
};

function yahooSymbolFor(symbol) {
  const s = String(symbol || "").toLowerCase();
  if (yahooSymbols[s]) return yahooSymbols[s];
  if (s.endsWith(".us")) return s.replace(".us", "").toUpperCase();
  if (s.endsWith(".uk")) return `${s.replace(".uk", "").toUpperCase()}.L`;
  if (s.endsWith(".de")) return `${s.replace(".de", "").toUpperCase()}.DE`;
  if (s.endsWith(".fr")) return `${s.replace(".fr", "").toUpperCase()}.PA`;
  if (s.endsWith(".dk")) return `${s.replace(".dk", "").toUpperCase()}.CO`;
  if (s.endsWith(".jp")) return `${s.replace(".jp", "")}.T`;
  if (s.endsWith(".hk")) return `${s.replace(".hk", "").padStart(4, "0")}.HK`;
  if (s.endsWith(".kr")) return `${s.replace(".kr", "")}.KS`;
  return symbol;
}

async function fetchText(url, timeoutMs = 8000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "accept": "application/rss+xml,application/xml,text/csv,text/html,text/plain,*/*",
        "user-agent": "Mozilla/5.0 markets-news-dashboard/0.1"
      }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

function parseCsvLine(line) {
  const cells = [];
  let value = "";
  let quoted = false;
  for (const char of line) {
    if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) {
      cells.push(value);
      value = "";
    } else value += char;
  }
  cells.push(value);
  return cells;
}

function lastFinite(values = []) {
  return [...values].reverse().find((value) => Number.isFinite(value)) ?? null;
}

async function fetchStooqQuote([name, symbol, tag, region = "GLOBAL"]) {
  const url = `https://stooq.com/q/l/?s=${encodeURIComponent(symbol)}&f=sd2t2ohlcv&h&e=csv`;
  const csv = await fetchText(url, process.env.RENDER ? 3200 : 7000);
  const lines = csv.trim().split(/\r?\n/);
  if (lines.length < 2) throw new Error("No quote row");
  const headers = parseCsvLine(lines[0]).map((header) => header.toLowerCase());
  const values = parseCsvLine(lines[1]);
  const row = Object.fromEntries(headers.map((header, index) => [header, values[index]]));
  if (!row.close || row.close === "N/D") throw new Error("No quote available");
  const open = n(row.open);
  const close = n(row.close);
  const change = close != null && open != null ? close - open : null;
  const changePct = close != null && open ? (change / open) * 100 : null;
  return {
    name,
    symbol: row.symbol || symbol.toUpperCase(),
    tag,
    region,
    price: close,
    open,
    high: n(row.high),
    low: n(row.low),
    volume: n(row.volume),
    change,
    changePct,
    timestamp: row.date && row.time && row.date !== "N/D" && row.time !== "N/D" ? new Date(`${row.date}T${row.time}Z`).toISOString() : null,
    source: "Stooq"
  };
}

async function fetchYahooQuote([name, symbol, tag, region = "GLOBAL"]) {
  const yahooSymbol = yahooSymbolFor(symbol);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?range=1d&interval=5m`;
  const body = await fetchText(url, 4500);
  const data = JSON.parse(body);
  const result = data.chart?.result?.[0];
  if (!result) throw new Error("No Yahoo quote available");
  const meta = result.meta || {};
  const quote = result.indicators?.quote?.[0] || {};
  const closes = (quote.close || []).map(n).filter(Number.isFinite);
  const opens = (quote.open || []).map(n).filter(Number.isFinite);
  const highs = (quote.high || []).map(n).filter(Number.isFinite);
  const lows = (quote.low || []).map(n).filter(Number.isFinite);
  const volumes = (quote.volume || []).map(n).filter(Number.isFinite);
  const price = n(meta.regularMarketPrice) ?? lastFinite(closes);
  const open = n(meta.regularMarketOpen) ?? opens[0] ?? n(meta.previousClose) ?? null;
  if (!Number.isFinite(price)) throw new Error("No Yahoo price available");
  const change = Number.isFinite(open) ? price - open : null;
  const changePct = Number.isFinite(change) && open ? (change / open) * 100 : null;
  return {
    name,
    symbol: String(symbol).toUpperCase(),
    tag,
    region,
    price,
    open,
    high: highs.length ? Math.max(...highs) : n(meta.regularMarketDayHigh),
    low: lows.length ? Math.min(...lows) : n(meta.regularMarketDayLow),
    volume: volumes.length ? volumes.reduce((sum, value) => sum + value, 0) : n(meta.regularMarketVolume),
    change,
    changePct,
    timestamp: meta.regularMarketTime ? new Date(meta.regularMarketTime * 1000).toISOString() : new Date().toISOString(),
    source: "Yahoo Finance"
  };
}

async function fetchQuote(item) {
  const sources = process.env.RENDER
    ? [fetchYahooQuote, fetchStooqQuote]
    : [fetchStooqQuote, fetchYahooQuote];
  let lastError;
  for (const source of sources) {
    try {
      return await source(item);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("No quote available");
}

function getLens(value) {
  return lenses[value] ? value : "global";
}

function lensConfig(value) {
  return lenses[getLens(value)];
}

async function fetchQuoteGroup(items) {
  const failures = [];
  const quotes = [];
  for (const item of items) {
    const [name, symbol, tag, region = "GLOBAL"] = item;
    try {
      quotes.push(await fetchQuote(item));
    } catch {
      failures.push({ name, symbol, tag, region });
    }
    await new Promise((resolve) => setTimeout(resolve, 90));
  }
  return { quotes, failures };
}

function parseRss(xml, source) {
  return (xml.match(/<item\b[\s\S]*?<\/item>/gi) || []).slice(0, 12).map((block) => {
    const read = (tag) => block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"))?.[1] || "";
    return {
      title: strip(read("title"), 150),
      link: strip(read("link"), 500),
      description: strip(read("description"), 190),
      published: strip(read("pubDate") || read("dc:date"), 120),
      source,
      category: classifyNews(`${read("title")} ${read("description")}`),
      region: classifyRegion(`${read("title")} ${read("description")}`)
    };
  }).filter((item) => item.title && item.link);
}

function classifyNews(text) {
  const lower = decodeXml(text).toLowerCase();
  if (/\b(ai|artificial intelligence|chip|semiconductor|nvidia|openai|data center|technology|tech)\b/.test(lower)) return "Tech";
  if (/\b(war|sanction|tariff|election|defence|defense|china|russia|ukraine|middle east|geopolitical|trump|biden|eu)\b/.test(lower)) return "Geopolitics";
  if (/\b(rate|fed|ecb|bank of england|inflation|bond|yield|central bank)\b/.test(lower)) return "Macro";
  if (/\b(oil|gas|gold|copper|commodity|energy)\b/.test(lower)) return "Commodities";
  return "Markets";
}

function classifyRegion(text) {
  const lower = decodeXml(text).toLowerCase();
  if (/\b(china|japan|india|asia|hong kong|taiwan|korea|australia|singapore|yen|nikkei|hang seng|beijing|tokyo)\b/.test(lower)) return "APAC";
  if (/\b(europe|uk|britain|london|germany|france|eu|ecb|euro|sterling|dax|ftse|middle east|russia|ukraine)\b/.test(lower)) return "EMEA";
  if (/\b(us|u\.s\.|america|wall street|fed|treasury|dollar|nasdaq|s&p|dow|trump|canada|mexico)\b/.test(lower)) return "AMERICAS";
  return "GLOBAL";
}

function scoreNewsForLens(item, config) {
  const text = `${item.title} ${item.description} ${item.category} ${item.region}`.toLowerCase();
  let score = Date.parse(item.published || 0) || 0;
  if (config.regions.includes(item.region)) score += 10_000_000_000;
  if (item.region === config.regions[0]) score += 10_000_000_000;
  for (const term of config.terms || []) {
    if (text.includes(term.toLowerCase())) score += 5_000_000_000;
  }
  if (/\b(earnings|guidance|margin|revenue|profit|cash flow|valuation|multiple|dividend|buyback|demand|pricing)\b/.test(text)) {
    score += 3_000_000_000;
  }
  return score;
}

async function fetchNews(config = lenses.global) {
  const settled = await Promise.allSettled(feeds.map(async (feed) => parseRss(await fetchText(feed.url), feed.name)));
  return settled
    .flatMap((result) => (result.status === "fulfilled" ? result.value : []))
    .sort((a, b) => scoreNewsForLens(b, config) - scoreNewsForLens(a, config))
    .slice(0, 18);
}

function eventRadar(news) {
  const buckets = ["Geopolitics", "Tech", "Macro", "Commodities", "Markets"];
  return buckets.map((bucket) => {
    const items = news.filter((item) => item.category === bucket).slice(0, 3);
    const regions = [...new Set(items.map((item) => item.region).filter(Boolean))].slice(0, 2);
    const signal = items.length
      ? `${regions.join("/") || "Global"}: ${items[0].title}`
      : "No clear fresh signal in current feeds";
    return {
      category: bucket,
      count: news.filter((item) => item.category === bucket).length,
      signal,
      headline: items[0]?.title || "No major fresh signal",
      items
    };
  }).filter((item) => item.count > 0);
}

function regionBuckets(items) {
  return ["AMERICAS", "EMEA", "APAC", "GLOBAL"].map((region) => ({
    region,
    items: items.filter((item) => item.region === region)
  })).filter((bucket) => bucket.items.length);
}

function movers(quotes) {
  const valid = quotes.filter((item) => Number.isFinite(item.changePct));
  return {
    winners: [...valid].sort((a, b) => b.changePct - a.changePct).slice(0, 5),
    losers: [...valid].sort((a, b) => a.changePct - b.changePct).slice(0, 5)
  };
}

function marketSummary(indices, stocks, macro, news) {
  const allQuotes = [...indices, ...stocks, ...macro].filter((item) => Number.isFinite(item.changePct));
  const avg = allQuotes.length ? allQuotes.reduce((sum, item) => sum + item.changePct, 0) / allQuotes.length : 0;
  const disrupted = allQuotes.filter((item) => Math.abs(item.changePct) >= 1.5).length;
  const topCategory = eventRadar(news).sort((a, b) => b.count - a.count)[0];
  return {
    tone: avg > 0.25 ? "Risk-on" : avg < -0.25 ? "Risk-off" : "Mixed",
    averageMovePct: avg,
    notableMoves: disrupted,
    topNewsTheme: topCategory?.category || "Markets",
    topNewsHeadline: topCategory?.headline || "No major fresh signal"
  };
}

function cleanQuery(value) {
  return String(value || "").replace(/[^\p{L}\p{N}.\- ]/gu, "").replace(/\s+/g, " ").trim().slice(0, 80);
}

function factorTable(quote, relatedNews) {
  const rangePct = quote.high && quote.low && quote.open ? ((quote.high - quote.low) / quote.open) * 100 : null;
  const latest = relatedNews.find((item) => {
    const age = daysSince(item.published);
    return age != null && age <= 30;
  });
  const liquidity = !Number.isFinite(quote.volume)
    ? "n/a"
    : quote.volume >= 20_000_000
      ? "High"
      : quote.volume >= 3_000_000
        ? "Moderate"
        : "Thin";
  return [
    { label: "Current price", value: Number.isFinite(quote.price) ? quote.price.toLocaleString("en-GB", { maximumFractionDigits: 2 }) : "n/a", note: quote.source },
    { label: "Session move", value: Number.isFinite(quote.changePct) ? `${quote.changePct >= 0 ? "+" : ""}${quote.changePct.toFixed(2)}%` : "n/a", note: "vs open" },
    { label: "Intraday range", value: Number.isFinite(rangePct) ? `${rangePct.toFixed(2)}%` : "n/a", note: "high-low/open" },
    { label: "Volume", value: compactNumber(quote.volume), note: `${liquidity} liquidity proxy` },
    { label: "Market cap", value: "n/a", note: "not available from public quote feed" },
    { label: "3m ADV", value: "n/a", note: "not available from public quote feed" },
    { label: "Region", value: quote.region, note: quote.symbol },
    { label: "Latest headline", value: latest?.title || "No matching 30-day headline", note: latest ? `${latest.source} · ${formatDate(latest.published)}` : "current feeds only" }
  ];
}

function resolveStock(query) {
  const q = cleanQuery(query).toLowerCase();
  if (!q) return null;
  const scored = stockDirectory.map(([name, symbol, region, aliases]) => {
    const haystack = [name, symbol, ...aliases].join(" ").toLowerCase();
    let score = 0;
    if (aliases.some((alias) => alias === q) || symbol.split(".")[0] === q) score += 100;
    if (name.toLowerCase() === q) score += 90;
    if (haystack.includes(q)) score += 40;
    q.split(" ").forEach((token) => {
      if (token.length > 1 && haystack.includes(token)) score += 8;
    });
    return { name, symbol, region, aliases, score };
  }).sort((a, b) => b.score - a.score);
  return scored[0]?.score ? scored[0] : null;
}

async function stockLookup(query, lens = "global") {
  const config = lensConfig(lens);
  const resolved = resolveStock(query);
  const news = await fetchNews(config);
  if (!resolved) {
    return {
      query: cleanQuery(query),
      selected: null,
      relatedNews: [],
      message: "No supported match found. Try a ticker or large-cap name such as NVDA, Apple, ASML, Toyota, Tencent, Shell."
    };
  }

  const quote = await fetchQuote([resolved.name, resolved.symbol, "Lookup", resolved.region]);
  const terms = [resolved.name, resolved.symbol.split(".")[0], ...resolved.aliases].map((term) => term.toLowerCase());
  const relatedNews = news.filter((item) => {
    const text = `${item.title} ${item.description}`.toLowerCase();
    return terms.some((term) => term.length > 2 && text.includes(term));
  }).slice(0, 5);
  return {
    query: cleanQuery(query),
    selected: quote,
    factors: factorTable(quote, relatedNews),
    relatedNews,
    message: relatedNews.length ? "Matched current quote and related newsflow." : "Matched current quote; no directly related headline found in current feeds."
  };
}

async function dashboard(forceRefresh = false, lens = "global") {
  const lensKey = getLens(lens);
  const config = lensConfig(lensKey);
  const cacheKey = `dashboard:${lensKey}`;
  const cached = cache.get(cacheKey);
  if (!forceRefresh && cached && Date.now() - cached.savedAt < cacheTtlMs) return { ...cached.data, cached: true };

  const newsPromise = fetchNews(config);
  const indicesResult = await fetchQuoteGroup(config.indices);
  const stocksResult = await fetchQuoteGroup(config.stocks);
  const macroResult = await fetchQuoteGroup(config.macro);
  const news = await newsPromise;

  const indices = indicesResult.quotes;
  const stocks = stocksResult.quotes;
  const macro = macroResult.quotes;
  const failures = [
    ...indicesResult.failures.map((item) => ({ ...item, group: "indices" })),
    ...stocksResult.failures.map((item) => ({ ...item, group: "stocks" })),
    ...macroResult.failures.map((item) => ({ ...item, group: "macro" }))
  ];
  const allQuotes = [...indices, ...stocks, ...macro];
  const quoteSources = allQuotes.reduce((counts, item) => {
    counts[item.source] = (counts[item.source] || 0) + 1;
    return counts;
  }, {});
  const data = {
    version,
    generatedAt: new Date().toISOString(),
    refreshed: forceRefresh,
    lens: { key: lensKey, label: config.label },
    summary: marketSummary(indices, stocks, macro, news),
    indices,
    stocks,
    macro,
    movers: movers(allQuotes),
    eventRadar: eventRadar(news),
    news,
    regionalNews: regionBuckets(news),
    dataQuality: {
      quoteFailures: failures,
      quoteFailureCount: failures.length,
      quoteSuccessCount: allQuotes.length,
      quoteSources
    },
    sourceNotes: [
      "Market prices: Stooq public quote CSV with Yahoo Finance chart fallback; change is calculated from session open to latest/close where prior close is unavailable.",
      failures.length ? `${failures.length} quote(s) were unavailable and hidden from the widgets: ${failures.map((item) => item.name).join(", ")}.` : "All configured market quotes loaded successfully.",
      "Newsflow: FT, BBC Business, and Investing.com RSS.",
      "Public sources can be delayed, rate-limited, incomplete, or unavailable."
    ]
  };
  cache.set(cacheKey, { savedAt: Date.now(), data });
  return data;
}

async function serveStatic(req, res, pathname) {
  const safePath = normalize(pathname === "/" ? "/index.html" : pathname).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(publicDir, safePath);
  if (!filePath.startsWith(publicDir)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  try {
    const data = await readFile(filePath);
    res.writeHead(200, { "content-type": mimeTypes[extname(filePath)] || "application/octet-stream" });
    res.end(data);
  } catch {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname === "/health") {
    json(res, 200, { ok: true, service: "markets-news-dashboard", version, time: new Date().toISOString() });
    return;
  }
  if (url.pathname === "/api/dashboard") {
    try {
      json(res, 200, await dashboard(url.searchParams.get("refresh") === "1", url.searchParams.get("lens")));
    } catch (error) {
      json(res, 500, { error: error.message || "Dashboard failed" });
    }
    return;
  }
  if (url.pathname === "/api/stock-lookup") {
    try {
      const query = cleanQuery(url.searchParams.get("q"));
      if (!query) {
        json(res, 400, { error: "Enter a ticker or stock name." });
        return;
      }
      json(res, 200, await stockLookup(query, url.searchParams.get("lens")));
    } catch (error) {
      json(res, 500, { error: error.message || "Lookup failed" });
    }
    return;
  }
  await serveStatic(req, res, url.pathname);
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`Port ${port} is already in use. Try: PORT=${port + 1} node server.js`);
    process.exit(1);
  }
  throw error;
});

server.listen(port, host, () => {
  const displayHost = host === "0.0.0.0" ? "127.0.0.1" : host;
  console.log(`Markets dashboard running at http://${displayHost}:${port}`);
});
