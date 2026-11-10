const router = require('express').Router();
const { col } = require('../config/db');
const { cliente } = require('../middleware/auth');
const { ah, ser, num, round2, esc, paginate, meta } = require('../utils/helpers');

router.use(...cliente);

async function cartera(userId) {
  await col('monederos').updateOne({ usuario_id: userId }, { $setOnInsert: { usuario_id: userId, saldo: 0, activo: true, creado: new Date() } }, { upsert: true });
  return col('monederos').findOne({ usuario_id: userId });
}

router.get('/resumen', ah(async (req, res) => {
  const m = await cartera(req.userId);
  const ultimos = await col('monedero_movimientos').find({ usuario_id: req.userId }).sort({ fecha: -1 }).limit(5).toArray();
  res.json({ ok: true, data: ser({ saldo: num(m.saldo), activo: m.activo !== false, ultimos_movimientos: ultimos }) });
}));
router.get('/movimientos', ah(async (req, res) => {
  const { page, limit, skip } = paginate(req.query);
  const f = { usuario_id: req.userId };
  const [items, total] = await Promise.all([col('monedero_movimientos').find(f).sort({ fecha: -1 }).skip(skip).limit(limit).toArray(), col('monedero_movimientos').countDocuments(f)]);
  res.json({ ok: true, data: ser(items), meta: meta(page, limit, total) });
}));
router.post('/transferir', ah(async (req, res) => {
  const monto = round2(num(req.body?.monto));
  const email = String(req.body?.email || '').trim();
  if (monto <= 0) return res.status(400).json({ ok: false, error: 'Monto inválido' });
  const dest = await col('usuarios').findOne({ email: { $regex: `^${esc(email)}$`, $options: 'i' }, activo: { $ne: false } });
  if (!dest) return res.status(404).json({ ok: false, error: 'Destinatario no encontrado' });
  if (String(dest._id) === req.userId) return res.status(400).json({ ok: false, error: 'No puedes transferirte a ti mismo' });
  await cartera(req.userId);
  const d = await col('monederos').updateOne({ usuario_id: req.userId, activo: { $ne: false }, saldo: { $gte: monto } }, { $inc: { saldo: -monto } });
  if (!d.matchedCount) return res.status(402).json({ ok: false, error: 'Saldo insuficiente' });
  await col('monederos').updateOne({ usuario_id: String(dest._id) }, { $inc: { saldo: monto }, $setOnInsert: { usuario_id: String(dest._id), activo: true, creado: new Date() } }, { upsert: true });
  const fecha = new Date();
  await col('monedero_movimientos').insertMany([
    { usuario_id: req.userId, tipo: 'transferencia_enviada', monto: -monto, concepto: `Transferencia a ${dest.email}`, fecha },
    { usuario_id: String(dest._id), tipo: 'transferencia_recibida', monto, concepto: `Transferencia de ${req.user.email}`, fecha }]);
  res.json({ ok: true, message: 'Transferencia realizada' });
}));
router.post('/recargar', ah(async (req, res) => {
  if (process.env.MONEDERO_RECARGA_DIRECTA !== 'true')
    return res.status(501).json({ ok: false, error: 'Las recargas requieren confirmar el pago con la pasarela. Habilita MONEDERO_RECARGA_DIRECTA=true solo para pruebas.' });
  const monto = round2(num(req.body?.monto));
  if (monto <= 0 || monto > 20000) return res.status(400).json({ ok: false, error: 'Monto inválido' });
  await cartera(req.userId);
  await col('monederos').updateOne({ usuario_id: req.userId }, { $inc: { saldo: monto } });
  await col('monedero_movimientos').insertOne({ usuario_id: req.userId, tipo: 'recarga', monto, concepto: 'Recarga', fecha: new Date() });
  res.json({ ok: true });
}));

module.exports = router;
