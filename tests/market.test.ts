import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateMarketMetrics } from '../src/lib/market';

test('market metrics are reproducible from ordered hourly candles', () => {
  const start = 1_700_000_000;
  const candles = Array.from({ length: 60 }, (_, index) => {
    const close = 100 + index;
    return { time: start + index * 3600, open: close - 0.5, high: close + 1, low: close - 1, close, volume: 2 };
  });
  const result = calculateMarketMetrics('BTC', candles);
  assert.equal(result.price, 159);
  assert.equal(result.volume24h, 48);
  assert.equal(result.support24h, 135);
  assert.equal(result.resistance24h, 160);
  assert.equal(result.trend, 'UP');
  assert.match(result.invalidation, /135 USD/);
  assert.ok(result.change24hPct > 17 && result.change24hPct < 18);
});

test('market metrics reject insufficient history', () => {
  assert.throws(() => calculateMarketMetrics('BTC', []), /INSUFFICIENT_MARKET_HISTORY/);
});
