const router = require('express').Router();
const { col } = require('../config/db');
const { cliente } = require('../middleware/auth');
const { ah, ser, num, round2 } = require('../utils/helpers');

router.use(...cliente);
const NIVELES = [{ nombre: 'Bronce', desde: 0 }, { nombre: 'Plata', desde: 500 }, { nombre: 'Oro', desde: 2000 }, { nombre: 'Platino', desde: 5000 }];
const nivelDe = (p) => [...NIVELES].reverse().find((n) => p >= n.desde);

router.get('/mi-info', ah(async (req, res) => {
  const puntos = num(req.user.puntos_lealtad);
  const nivel = nivelDe(puntos); const sig = NIVELES.find((n) => n.desde > puntos);
  res.json({ ok: true, data: { puntos, nivel: nivel.nombre, siguiente_nivel: sig ? { nombre: sig.nombre, faltan: sig.desde - puntos } : null, valor_punto: num(process.env.LEALTAD_VALOR_PUNTO, 0.1) } });
}));
router.get('/historial', ah(async (req, res) =>
  res.json({ ok: true, data: ser(await col('puntos_movimientos').find({ usuario_id: req.userId }).sort({ fecha: -1 }).limit(50).toArray()) })));
// Canjear puntos → saldo en el monedero
router.post('/canjear', ah(async (req, res) => {
  const puntos = Math.floor(num(req.body?.puntos));
  if (puntos <= 0) return res.status(400).json({ ok: false, error: 'Puntos inválidos' });
  const r = await col('usuarios').updateOne({ _id: req.user._id, puntos_lealtad: { $gte: puntos } }, { $inc: { puntos_lealtad: -puntos } });
  if (!r.matchedCount) return res.status(402).json({ ok: false, error: 'Puntos insuficientes' });
  const monto = round2(puntos * num(process.env.LEALTAD_VALOR_PUNTO, 0.1));
  await col('monederos').updateOne({ usuario_id: req.userId }, { $inc: { saldo: monto }, $setOnInsert: { usuario_id: req.userId, activo: true, creado: new Date() } }, { upsert: true });
  await col('monedero_movimientos').insertOne({ usuario_id: req.userId, tipo: 'canje_puntos', monto, concepto: `Canje de ${puntos} puntos`, fecha: new Date() });
  await col('puntos_movimientos').insertOne({ usuario_id: req.userId, puntos: -puntos, tipo: 'canje', fecha: new Date() });
  res.json({ ok: true, monto_abonado: monto });
}));

module.exports = router;
