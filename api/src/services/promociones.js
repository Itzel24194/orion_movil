const { col } = require('../config/db');
const { esc, num, ser } = require('../utils/helpers');
const calc = require('../utils/promo-calc');

const fecha = (v) => { if (!v) return null; const d = new Date(v); return isNaN(d) ? null : d; };

async function vigentes() {
  const now = new Date();
  const todas = await col('promociones').find({ activo: { $ne: false }, estado: { $nin: ['inactiva', 'pausada', 'finalizada', 'borrador'] } }).toArray();
  return todas.filter((p) => {
    const i = fecha(p.fecha_inicio), f = fecha(p.fecha_fin);
    if (i && now < i) return false;
    if (f && now > f) return false;
    const max = num(p.usos_max ?? p.limite_usos, 0);
    return !(max > 0 && num(p.usos) >= max);
  });
}
const resumen = (p, r) => ({ id: String(p._id), nombre: p.nombre || p.titulo || p.codigo, codigo: p.codigo || null, requiere_codigo: !calc.esAutomatica(p), descuento: r.descuento, envio_gratis: !!r.envio_gratis });

async function buscarPorCodigo(codigo) {
  const c = String(codigo || '').trim();
  if (!c) return null;
  const p = await col('promociones').findOne({ codigo: { $regex: `^${esc(c)}$`, $options: 'i' } });
  if (!p) return null;
  return (await vigentes()).find((v) => String(v._id) === String(p._id)) || { ...p, _inactiva: true };
}

// Evalúa la promo elegida (si hay) o la mejor automática. Devuelve { promo, descuento, envio_gratis, disponibles, error }.
async function evaluarParaCarrito(items, subtotal, seleccionId) {
  if (!items.length) return { promo: null, descuento: 0, envio_gratis: false, disponibles: [] };
  const todas = await vigentes();
  const disponibles = [];
  let mejor = null;
  for (const p of todas) {
    const r = calc.evaluar(p, items, subtotal);
    if (!r.ok) continue;
    disponibles.push(resumen(p, r));
    if (calc.esAutomatica(p) && (!mejor || r.descuento > mejor.r.descuento)) mejor = { p, r };
  }
  if (seleccionId) {
    const p = todas.find((x) => String(x._id) === String(seleccionId));
    const r = p && calc.evaluar(p, items, subtotal);
    if (p && r.ok) return { promo: p, ...r, disponibles };
    // la promoción elegida ya no aplica: se ignora y se informa
    if (!mejor) return { promo: null, descuento: 0, envio_gratis: false, disponibles, error: r ? r.error : 'La promoción ya no está vigente' };
  }
  return mejor ? { promo: mejor.p, ...mejor.r, disponibles } : { promo: null, descuento: 0, envio_gratis: false, disponibles };
}
const registrarUso = (id) => col('promociones').updateOne({ _id: id }, { $inc: { usos: 1 } });

module.exports = { vigentes, buscarPorCodigo, evaluarParaCarrito, registrarUso, resumen };
