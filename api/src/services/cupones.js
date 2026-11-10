const { col } = require('../config/db');
const { esc, round2, num } = require('../utils/helpers');

const validDate = (v) => { if (!v) return null; const d = new Date(v); return isNaN(d) ? null : d; };

async function validar(codigo, subtotal, userId) {
  if (!codigo) return { ok: false, error: 'Código requerido' };
  const c = await col('cupones').findOne({ codigo: { $regex: `^${esc(String(codigo).trim())}$`, $options: 'i' } });
  if (!c) return { ok: false, error: 'El cupón no existe' };
  if (c.activo === false || c.estado === 'inactivo') return { ok: false, error: 'Cupón inactivo' };
  const now = new Date();
  const ini = validDate(c.fecha_inicio), fin = validDate(c.fecha_fin || c.fecha_expiracion);
  if (ini && now < ini) return { ok: false, error: 'Cupón aún no vigente' };
  if (fin && now > fin) return { ok: false, error: 'Cupón expirado' };
  const max = num(c.usos_max ?? c.limite_usos, 0);
  if (max > 0 && num(c.usos) >= max) return { ok: false, error: 'Cupón agotado' };
  if (userId && Array.isArray(c.usuarios_usaron) && c.usuarios_usaron.map(String).includes(String(userId)))
    return { ok: false, error: 'Ya usaste este cupón' };
  const minimo = num(c.minimo_compra ?? c.compra_minima, 0);
  if (subtotal < minimo) return { ok: false, error: `Compra mínima: $${minimo}` };
  const tipo = String(c.tipo || c.tipo_descuento || '').toLowerCase();
  const valor = num(c.valor ?? c.descuento, 0);
  let d = tipo.includes('porc') || tipo.includes('%') ? subtotal * valor / 100 : valor;
  const tope = num(c.descuento_maximo, 0);
  if (tope > 0) d = Math.min(d, tope);
  d = round2(Math.min(d, subtotal));
  return { ok: true, cupon: c, descuento: d };
}
const registrarUso = (c, userId) =>
  col('cupones').updateOne({ _id: c._id }, { $inc: { usos: 1 }, $addToSet: { usuarios_usaron: String(userId) } });

module.exports = { validar, registrarUso };
