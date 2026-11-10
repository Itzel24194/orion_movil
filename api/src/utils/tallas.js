// Recomendación de talla a partir de medidas corporales (cm / kg). Funciones puras.
const ORDEN = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL'];
const num = (v) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : null; };

const SUP_PECHO = [[0, 86, 'XS'], [86, 94, 'S'], [94, 102, 'M'], [102, 110, 'L'], [110, 118, 'XL'], [118, 126, 'XXL'], [126, 999, '3XL']];
const INF_CINTURA = [[0, 66, 'XS'], [66, 74, 'S'], [74, 82, 'M'], [82, 90, 'L'], [90, 98, 'XL'], [98, 106, 'XXL'], [106, 999, '3XL']];
const INF_CADERA = [[0, 90, 'XS'], [90, 98, 'S'], [98, 106, 'M'], [106, 114, 'L'], [114, 122, 'XL'], [122, 130, 'XXL'], [130, 999, '3XL']];
const buscar = (tabla, v) => tabla.find(([a, b]) => v >= a && v < b)[2];
const mayor = (a, b) => (ORDEN.indexOf(a) >= ORDEN.indexOf(b) ? a : b);
const mover = (talla, n) => ORDEN[Math.min(ORDEN.length - 1, Math.max(0, ORDEN.indexOf(talla) + n))];

function tipoDe(producto = {}, forzado) {
  if (['superior', 'inferior', 'calzado'].includes(forzado)) return forzado;
  const t = `${producto.tipo_prenda || ''} ${producto.categoria || ''} ${producto.nombre || ''}`.toLowerCase();
  if (/calzado|zapato|tenis|bota|sandalia|zapatilla/.test(t)) return 'calzado';
  if (/pantal|jean|short|falda|legging|bermuda|jogger|inferior/.test(t)) return 'inferior';
  return 'superior';
}

function porIMC(m) {
  const alt = num(m.altura_cm), peso = num(m.peso_kg);
  if (!alt || !peso) return null;
  const imc = peso / ((alt / 100) ** 2);
  return imc < 18.5 ? 'XS' : imc < 22 ? 'S' : imc < 25 ? 'M' : imc < 28 ? 'L' : imc < 31 ? 'XL' : imc < 35 ? 'XXL' : '3XL';
}

function recomendar(tipo, m = {}, { ajuste } = {}) {
  const notas = [];
  if (tipo === 'calzado') {
    const pie = num(m.pie_cm);
    if (!pie) return null;
    const mx = Math.round(pie * 2) / 2;
    return { tipo, talla: String(mx), talla_mx: mx, talla_eu: Math.round(pie * 1.5 + 2), confianza: 'alta', base: 'pie_cm', notas: ['Talla MX = largo del pie en cm.'] };
  }
  let talla = null, base = null, confianza = 'alta';
  if (tipo === 'inferior') {
    const c = num(m.cintura_cm), k = num(m.cadera_cm);
    if (c) { talla = buscar(INF_CINTURA, c); base = 'cintura_cm'; }
    if (k) { const t2 = buscar(INF_CADERA, k); if (!talla) { talla = t2; base = 'cadera_cm'; } else if (t2 !== talla) { talla = mayor(talla, t2); base = 'cintura_cm+cadera_cm'; notas.push('Se eligió la talla mayor entre cintura y cadera.'); } }
  } else {
    const p = num(m.pecho_cm);
    if (p) { talla = buscar(SUP_PECHO, p); base = 'pecho_cm'; }
  }
  if (!talla) { talla = porIMC(m); base = 'altura_cm+peso_kg'; confianza = 'baja'; if (talla) notas.push('Estimación aproximada. Agrega tus medidas para mayor precisión.'); }
  if (!talla) return null;
  if (ajuste === 'holgado') { talla = mover(talla, 1); notas.push('Ajustada para un calce holgado.'); }
  const out = { tipo, talla, confianza, base, notas };
  if (tipo === 'inferior' && num(m.cintura_cm)) out.talla_numerica = String(Math.round(num(m.cintura_cm) / 2.54 / 2) * 2);
  return out;
}

function ajustarADisponibles(rec, disponibles) {
  const lista = (disponibles || []).map((t) => String((t && typeof t === 'object') ? (t.talla || t.nombre || '') : t).trim().toUpperCase()).filter(Boolean);
  if (!lista.length) return { disponible: null, tallas_disponibles: [] };
  if (rec.tipo === 'calzado') {
    const objetivo = rec.talla_mx;
    const nums = lista.map(Number).filter(Number.isFinite);
    if (!nums.length) return { disponible: null, tallas_disponibles: lista };
    const cerca = nums.reduce((a, b) => (Math.abs(b - objetivo) < Math.abs(a - objetivo) ? b : a));
    return { disponible: cerca === objetivo, mas_cercana: String(cerca), tallas_disponibles: lista };
  }
  const idx = ORDEN.indexOf(rec.talla);
  if (lista.includes(rec.talla)) return { disponible: true, tallas_disponibles: lista };
  const letras = lista.filter((t) => ORDEN.includes(t));
  if (!letras.length) return { disponible: null, tallas_disponibles: lista };
  const dist = (t) => Math.abs(ORDEN.indexOf(t) - idx);
  const mas = letras.reduce((a, b) => (dist(b) < dist(a) || (dist(b) === dist(a) && ORDEN.indexOf(b) > ORDEN.indexOf(a)) ? b : a)); // en empate, la mayor
  return { disponible: false, mas_cercana: mas, tallas_disponibles: lista };
}

module.exports = { tipoDe, recomendar, ajustarADisponibles, ORDEN };
