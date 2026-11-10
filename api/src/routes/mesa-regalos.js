const router = require('express').Router();
const { col } = require('../config/db');
const { auth, optionalAuth } = require('../middleware/auth');
const { ah, idFilter, ser, num, round2, pick } = require('../utils/helpers');

const slugify = (s) => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

router.get('/mias', auth, ah(async (req, res) => res.json({ ok: true, data: ser(await col('mesas_regalos').find({ usuario_id: req.userId }).sort({ _id: -1 }).toArray()) })));

router.post('/', auth, ah(async (req, res) => {
  const b = req.body || {};
  if (!b.titulo) return res.status(400).json({ ok: false, error: 'titulo es obligatorio' });
  const doc = { ...pick(b, ['titulo', 'descripcion', 'fecha_evento', 'tipo_evento', 'imagen', 'publica']),
    slug: `${slugify(b.titulo)}-${Math.random().toString(36).slice(2, 7)}`, usuario_id: req.userId, anfitrion: req.user.nombre,
    regalos: (Array.isArray(b.regalos) ? b.regalos : []).map((r, i) => ({ id: String(i + 1), producto_id: String(r.producto_id), cantidad: Math.max(1, num(r.cantidad, 1)), reservados: 0, reservas: [] })),
    fondo: { meta: num(b.meta_fondo), acumulado: 0, aportaciones: [] }, activa: true, creada: new Date() };
  const r = await col('mesas_regalos').insertOne(doc);
  res.status(201).json({ ok: true, data: ser({ ...doc, _id: r.insertedId }) });
}));

router.get('/:slug', ah(async (req, res) => {
  const m = await col('mesas_regalos').findOne({ slug: req.params.slug, activa: true });
  if (!m) return res.status(404).json({ ok: false, error: 'Mesa no encontrada' });
  const ids = m.regalos.map((r) => r.producto_id);
  const prods = ids.length ? await col('productos').find({ $or: ids.map(idFilter) }).toArray() : [];
  const pm = new Map(prods.map((p) => [String(p._id), p]));
  // No exponemos quién reservó (sorpresa) ni datos privados
  const regalos = m.regalos.map((r) => ({ id: r.id, cantidad: r.cantidad, reservados: r.reservados, disponible: r.cantidad - r.reservados, producto: ser(pm.get(r.producto_id) || null) }));
  res.json({ ok: true, data: ser({ _id: m._id, slug: m.slug, titulo: m.titulo, descripcion: m.descripcion, fecha_evento: m.fecha_evento, anfitrion: m.anfitrion, imagen: m.imagen, regalos, fondo: { meta: m.fondo.meta, acumulado: m.fondo.acumulado } }) });
}));

router.post('/:id/reservar', optionalAuth, ah(async (req, res) => {
  const { regalo_id, nombre } = req.body || {};
  const m = await col('mesas_regalos').findOne({ ...idFilter(req.params.id), activa: true });
  if (!m) return res.status(404).json({ ok: false, error: 'Mesa no encontrada' });
  const g = m.regalos.find((x) => x.id === String(regalo_id));
  if (!g || g.reservados >= g.cantidad) return res.status(409).json({ ok: false, error: 'Regalo no disponible' });
  const up = await col('mesas_regalos').updateOne({ _id: m._id, 'regalos.id': String(regalo_id), 'regalos.reservados': g.reservados },
    { $inc: { 'regalos.$.reservados': 1 }, $push: { 'regalos.$.reservas': { nombre: nombre || req.user?.nombre || 'Anónimo', usuario_id: req.userId || null, fecha: new Date() } } });
  if (!up.matchedCount) return res.status(409).json({ ok: false, error: 'Intenta de nuevo' });
  res.json({ ok: true });
}));

router.post('/:id/contribuir', optionalAuth, ah(async (req, res) => {
  const monto = round2(num(req.body?.monto));
  if (monto <= 0) return res.status(400).json({ ok: false, error: 'Monto inválido' });
  const r = await col('mesas_regalos').updateOne({ ...idFilter(req.params.id), activa: true },
    { $inc: { 'fondo.acumulado': monto }, $push: { 'fondo.aportaciones': { nombre: req.body?.nombre || req.user?.nombre || 'Anónimo', monto, fecha: new Date() } } });
  if (!r.matchedCount) return res.status(404).json({ ok: false, error: 'Mesa no encontrada' });
  res.json({ ok: true });
}));

router.delete('/:id', auth, ah(async (req, res) => {
  const r = await col('mesas_regalos').updateOne({ ...idFilter(req.params.id), usuario_id: req.userId }, { $set: { activa: false } });
  res.json({ ok: r.matchedCount > 0 });
}));

module.exports = router;
