import crypto from 'node:crypto';
import type { Availability, EvidenceItem } from './contracts';
import { fetchPublicUrl } from './ssrf';
import { bytesToText } from './extract';

const KRAKEN_PAIRS: Record<string, string> = {
  BTC: 'XBTUSD', XBT: 'XBTUSD', ETH: 'ETHUSD', SOL: 'SOLUSD', XRP: 'XRPUSD',
  ADA: 'ADAUSD', DOT: 'DOTUSD', LTC: 'LTCUSD', DOGE: 'DOGEUSD', LINK: 'LINKUSD'
};

type Candle = { time: number; open: number; high: number; low: number; close: number; volume: number };
export type MarketMetrics = {
  symbol: string; price: number; asOf: string; change24hPct: number; volume24h: number;
  annualizedVolatilityPct: number; support24h: number; resistance24h: number;
  sma20: number; sma50: number; trend: 'UP' | 'DOWN' | 'MIXED'; regime: string; invalidation: string;
};

function round(value: number, digits = 2): number { return Number(value.toFixed(digits)); }
function mean(values: number[]): number { return values.reduce((sum, value) => sum + value, 0) / values.length; }
function normalizeSymbol(value: string): string {
  return value.trim().toUpperCase().replace(/^\$/, '').replace(/[\s/_-]/g, '').replace(/(?:USD|USDT|EUR)$/, '');
}

export function calculateMarketMetrics(symbol: string, candles: Candle[]): MarketMetrics {
  if (candles.length < 50) throw new Error('INSUFFICIENT_MARKET_HISTORY');
  const sorted = [...candles].sort((a, b) => a.time - b.time);
  const last = sorted.at(-1)!; const prior24 = sorted.at(-25)!;
  const last24 = sorted.slice(-24); const last20 = sorted.slice(-20); const last50 = sorted.slice(-50); const last168 = sorted.slice(-168);
  const returns = last168.slice(1).map((item, index) => Math.log(item.close / last168[index].close));
  const avgReturn = mean(returns);
  const variance = returns.reduce((sum, value) => sum + (value - avgReturn) ** 2, 0) / Math.max(1, returns.length - 1);
  const volatility = Math.sqrt(variance) * Math.sqrt(24 * 365) * 100;
  const sma20 = mean(last20.map((item) => item.close)); const sma50 = mean(last50.map((item) => item.close));
  const trend = last.close > sma20 && sma20 > sma50 ? 'UP' : last.close < sma20 && sma20 < sma50 ? 'DOWN' : 'MIXED';
  const support = Math.min(...last24.map((item) => item.low)); const resistance = Math.max(...last24.map((item) => item.high));
  const volBand = volatility >= 80 ? 'HIGH VOLATILITY' : volatility <= 30 ? 'LOW VOLATILITY' : 'MODERATE VOLATILITY';
  const invalidation = trend === 'UP' ? `The observed uptrend condition is invalid below the 24h low (${round(support)} USD).` : trend === 'DOWN' ? `The observed downtrend condition is invalid above the 24h high (${round(resistance)} USD).` : `No directional condition is established; a move outside ${round(support)}–${round(resistance)} USD requires fresh evidence.`;
  return {
    symbol, price: round(last.close), asOf: new Date(last.time * 1000).toISOString(),
    change24hPct: round((last.close / prior24.close - 1) * 100), volume24h: round(last24.reduce((sum, item) => sum + item.volume, 0), 4),
    annualizedVolatilityPct: round(volatility), support24h: round(support), resistance24h: round(resistance),
    sma20: round(sma20), sma50: round(sma50), trend, regime: `${trend === 'MIXED' ? 'RANGE / MIXED' : `${trend} TREND`} · ${volBand}`, invalidation
  };
}

function unavailable(symbol: string, availability: Availability, note: string): EvidenceItem {
  return { id: `market-${crypto.randomBytes(8).toString('hex')}`, kind: 'MARKET_DATA', title: `${symbol || 'Asset'} market data`, content: `Current market data: ${availability}.`, availability, provenance: { sourceType: 'URL', sourceUrl: 'https://docs.kraken.com/api/docs/rest-api/get-ohlc-data/', retrievedAt: new Date().toISOString(), note } };
}

export async function acquireKrakenMarketEvidence(rawSymbol: string): Promise<EvidenceItem> {
  const symbol = normalizeSymbol(rawSymbol); const pair = KRAKEN_PAIRS[symbol];
  if (!pair) return unavailable(symbol, 'NON_AVAILABLE', 'This MVP currently supports public Kraken USD markets for BTC, ETH, SOL, XRP, ADA, DOT, LTC, DOGE, and LINK. No substitute price was fabricated.');
  const sourceUrl = `https://api.kraken.com/0/public/OHLC?pair=${encodeURIComponent(pair)}&interval=60`;
  try {
    const fetched = await fetchPublicUrl(sourceUrl, { accept: 'application/json' });
    const raw = bytesToText(fetched.bytes);
    const parsed = JSON.parse(raw) as { error?: unknown[]; result?: Record<string, unknown> };
    if (parsed.error?.length || !parsed.result) throw new Error('KRAKEN_RESPONSE_ERROR');
    const rows = Object.entries(parsed.result).find(([key, value]) => key !== 'last' && Array.isArray(value))?.[1];
    if (!Array.isArray(rows)) throw new Error('KRAKEN_OHLC_NON_AVAILABLE');
    const candles: Candle[] = rows.flatMap((row) => {
      if (!Array.isArray(row) || row.length < 7) return [];
      const values = row.slice(0, 7).map(Number); if (values.some((value) => !Number.isFinite(value))) return [];
      return [{ time: values[0], open: values[1], high: values[2], low: values[3], close: values[4], volume: values[6] }];
    });
    const metrics = calculateMarketMetrics(symbol === 'XBT' ? 'BTC' : symbol, candles);
    const content = [
      `Asset: ${metrics.symbol}/USD.`, `Price: ${metrics.price} USD as of ${metrics.asOf}.`,
      `24h change: ${metrics.change24hPct}%.`, `24h traded volume: ${metrics.volume24h} ${metrics.symbol}.`,
      `Annualized realized volatility: ${metrics.annualizedVolatilityPct}% from hourly log returns (up to 168 observations).`,
      `SMA20: ${metrics.sma20} USD. SMA50: ${metrics.sma50} USD. Trend: ${metrics.trend}.`,
      `24h support (lowest observed low): ${metrics.support24h} USD. 24h resistance (highest observed high): ${metrics.resistance24h} USD.`,
      `Regime: ${metrics.regime}.`, `Invalidation: ${metrics.invalidation}`,
      'These are reproducible observations from Kraken OHLC data, not a forecast, recommendation, or authorization to trade.'
    ].join('\n');
    return { id: `market-${crypto.randomBytes(8).toString('hex')}`, kind: 'MARKET_DATA', title: `${metrics.symbol}/USD · Kraken public OHLC`, content, availability: 'AVAILABLE', provenance: { sourceType: 'URL', sourceUrl, retrievedAt: new Date().toISOString(), contentType: fetched.contentType, title: 'Kraken public OHLC', note: 'Hourly OHLC; 24h change uses the close 24 observations earlier; volume sums 24 observations; volatility annualizes hourly log-return sample deviation; levels are observed 24h extremes.' }, hash: crypto.createHash('sha256').update(raw).digest('hex') };
  } catch (error: unknown) {
    return unavailable(symbol, 'SOURCE_ACCESS_FAILED', `Kraken public OHLC acquisition failed (${error instanceof Error ? error.message : 'unknown error'}). No market values were generated.`);
  }
}
