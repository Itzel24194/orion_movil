// Cálculo puro de promociones sobre los items del carrito (sin base de datos).
const num = (v, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
const lc = (v) => String(v ?? '').trim().toLowerCase();
const lista = (v) => (Array.isArray(v) ? v.map((x) => lc(x && x._id ? x._id : x)) : []);
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

function coincide(promo, it) {
  const prods = lista(promo.productos || promo.productos_ids), cats = lista(promo.categorias || promo.categorias_ids), marcas = lista(promo.marcas);
  if (!prods.length && !cats.length && !marcas.length) return true;
  if (prods.includes(lc(it.producto_id))) return true;
  if (cats.length && (cats.includes(lc(it.categoria_id)) || cats.includes(lc(it.categoria)))) return true;
  if (marcas.length && marcas.includes(lc(it.marca))) return true;
  return false;
}

function evaluar(promo, items, subtotal) {
  const minimo = num(promo.compra_minima ?? promo.minimo_compra, 0);
  if (subtotal < minimo) return { ok: false, error: `Compra mínima: $${minimo}` };
  const base = items.filter((i) => coincide(promo, i)).reduce((a, i) => a + num(i.precio) * num(i.cantidad, 1), 0);
  if (base <= 0) return { ok: false, error: 'La promoción no aplica a los productos del carrito' };
  const tipo = lc(promo.tipo || promo.tipo_descuento || promo.tipo_promocion);
  const valor = num(promo.valor ?? promo.porcentaje ?? promo.descuento ?? promo.monto, 0);
  let descuento = 0, envio_gratis = false;
  if (tipo.includes('envio')) envio_gratis = true;
  else if (tipo.includes('porc') || tipo.includes('%') || (!tipo && promo.porcentaje != null)) descuento = base * valor / 100;
  else if (tipo.includes('monto') || tipo.includes('fijo') || (!tipo && promo.monto != null)) descuento = valor;
  else return { ok: false, error: 'Tipo de promoción no soportado en la app' };
  const tope = num(promo.descuento_maximo, 0);
  if (tope > 0) descuento = Math.min(descuento, tope);
  descuento = round2(Math.min(descuento, base));
  if (descuento <= 0 && !envio_gratis) return { ok: false, error: 'Sin descuento aplicable' };
  return { ok: true, descuento, envio_gratis };
}

const esAutomatica = (p) => p.automatica === true || lc(p.tipo_aplicacion) === 'automatica' || !p.codigo;

module.exports = { evaluar, esAutomatica, coincide };
