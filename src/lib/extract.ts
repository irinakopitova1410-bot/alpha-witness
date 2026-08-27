export function htmlToText(html: string): string {
  return html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ').replace(/<!--([\s\S]*?)-->/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&#39;/g, "'").replace(/&quot;/gi, '"').replace(/\s+/g, ' ').trim().slice(0, 200_000);
}
export function htmlTitle(html: string): string | undefined { const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i); return match ? htmlToText(match[1]).slice(0, 200) : undefined; }
export function bytesToText(bytes: Uint8Array): string { return new TextDecoder().decode(bytes).replace(/\0/g, '').slice(0, 200_000); }

export async function pdfToText(bytes: Uint8Array): Promise<{ text: string; totalPages: number }> {
  const { extractText } = await import('unpdf');
  const extracted = await extractText(bytes, { mergePages: false });
  const pages = Array.isArray(extracted.text) ? extracted.text : [extracted.text];
  let text = '';
  for (let index = 0; index < pages.length; index++) {
    const page = String(pages[index] || '').replace(/\0/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
    if (!page) continue;
    const block = `[PAGE ${index + 1}]\n${page}\n`;
    if (text.length + block.length > 200_000) { text += '\n[EXTRACTION TRUNCATED AT 200000 CHARACTERS]'; break; }
    text += block;
  }
  return { text: text.trim(), totalPages: extracted.totalPages };
}
