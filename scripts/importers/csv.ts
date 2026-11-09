/** Minimal RFC 4180 CSV reader (quoted fields, escaped quotes, CRLF). Returns objects keyed by header. */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.some((v) => v !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((v) => v !== '')) rows.push(row);
  const [header, ...data] = rows;
  if (!header) return [];
  const bom = String.fromCharCode(0xfeff);
  const keys = header.map((h) => (h.startsWith(bom) ? h.slice(1) : h).trim());
  return data.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? '').trim()])));
}

export function splitAliases(value: string | undefined, lang: 'es' | 'en' = 'es'): { alias: string; lang: 'es' | 'en' }[] {
  return (value ?? '')
    .split('|')
    .map((a) => a.trim())
    .filter(Boolean)
    .map((alias) => ({ alias, lang }));
}

export function numOrNull(value: string | undefined): number | null {
  if (value === undefined || value.trim() === '') return null;
  const n = Number(value.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}
