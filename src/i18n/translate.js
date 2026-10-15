// Traducción pura es -> en (sin React).
import { phrasesEn, patternsEn } from './phrases.en';

const norm = s => s.replace(/\s+/g, ' ').trim();
const cache = new Map();
// Frases de 8+ caracteres, de la más larga a la más corta, para textos mezclados ("12/05/2026 · Sin pago procesado").
const parts = Object.keys(phrasesEn).filter(k => k.length >= 8 && !k.includes('\n')).sort((a, b) => b.length - a.length);

export function translateText(value, language) {
  if (language !== 'en' || typeof value !== 'string' || !value.trim()) return value;
  const lead = value.match(/^\s*/)[0];
  const tail = value.match(/\s*$/)[0];
  const core = value.trim();
  const rec = s => translateCore(s);
  function translateCore(s) {
    const exact = phrasesEn[s] ?? phrasesEn[norm(s)];
    if (exact !== undefined) return exact;
    for (const [re, fn] of patternsEn) {
      const m = s.match(re);
      if (m) return fn(m, rec);
    }
    if (s.includes('\n') === false) {
      let out = s, changed = false;
      for (const k of parts) {
        if (out.includes(k)) { out = out.split(k).join(phrasesEn[k]); changed = true; }
      }
      if (changed) return out;
    }
    // Textos con varias líneas: se traduce línea por línea.
    if (s.includes('\n')) return s.split('\n').map(l => (l.trim() ? rec(l) : l)).join('\n');
    return s;
  }
  let out = cache.get(core);
  if (out === undefined) { out = translateCore(core); if (cache.size < 2000) cache.set(core, out); }
  return out === core ? value : lead + out + tail;
}

