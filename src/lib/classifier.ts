import type { CaseClassification } from './contracts';

export function classifyInput(value: string, hint?: string): CaseClassification {
  const text = `${hint ?? ''} ${value}`.trim();
  if (/^https?:\/\/\S+$/i.test(value.trim())) {
    try {
      const url = new URL(value);
      if (/(youtube\.com|youtu\.be)$/i.test(url.hostname) || /youtube\.com/i.test(url.hostname)) return 'VIDEO';
      if (/\.(pdf)(?:$|[?#])/i.test(url.pathname)) return 'PAPER';
      if (/(arxiv\.org|doi\.org|ssrn\.com|researchgate\.)/i.test(url.hostname)) return 'PAPER';
      if (/(news|article|post|blog)/i.test(url.pathname)) return 'NEWS_POST';
      return 'UNKNOWN';
    } catch { return 'UNKNOWN'; }
  }
  if (/\b(youtube|video|watch|transcript|episode)\b/i.test(text)) return 'VIDEO';
  if (/\b(arxiv|doi|paper|whitepaper|research|journal|study|pdf)\b/i.test(text)) return 'PAPER';
  if (/\b(news|article|post|headline|press release|substack|medium)\b/i.test(text)) return 'NEWS_POST';
  if (/\b(trader|investor|analyst|person|profile|creator|coach)\b/i.test(text)) return 'TRADER_PERSONA';
  if (/\b(asset|ticker|stock|token|coin|forex|btc|eth|aapl|spy|nasdaq)\b/i.test(text) || /^[A-Z]{1,6}(?:\.[A-Z])?$/.test(value.trim())) return 'ASSET';
  return 'UNKNOWN';
}
