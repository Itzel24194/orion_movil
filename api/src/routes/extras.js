const router = require('express').Router();
const { col } = require('../config/db');
const { optionalAuth, auth } = require('../middleware/auth');
const { ah, ser, idFilter, esc } = require('../utils/helpers');
const rx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post('/newsletter/suscribir', ah(async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!rx.test(email)) return res.status(400).json({ ok: false, error: 'Email inválido' });
  await col('newsletter').updateOne({ email }, { $set: { activo: true, actualizado: new Date() }, $setOnInsert: { email, fecha: new Date() } }, { upsert: true });
  res.json({ ok: true, message: 'Suscripción exitosa' });
}));
router.post('/newsletter/cancelar', ah(async (req, res) => {
  await col('newsletter').updateOne({ email: String(req.body?.email || '').trim().toLowerCase() }, { $set: { activo: false, actualizado: new Date() } });
  res.json({ ok: true });
}));
router.post('/contacto', ah(async (req, res) => {
  const { nombre, email, mensaje, asunto = '' } = req.body || {};
  if (!nombre || !rx.test(email || '') || !mensaje) return res.status(400).json({ ok: false, error: 'nombre, email y mensaje son obligatorios' });
  await col('contactos').insertOne({ nombre: String(nombre).slice(0, 100), email, asunto: String(asunto).slice(0, 150), mensaje: String(mensaje).slice(0, 3000), fecha: new Date(), leido: false });
  res.status(201).json({ ok: true, message: 'Mensaje recibido' });
}));
router.get('/config/tienda', ah(async (_req, res) => res.json({ ok: true, data: {
  envio_costo: Number(process.env.ENVIO_COSTO || 99), envio_gratis_desde: Number(process.env.ENVIO_GRATIS_DESDE || 999), moneda: 'MXN' } })));

// ---------- CHAT (sesiones y mensajes; la respuesta de IA/NLP sigue en el proyecto Flask) ----------
router.post('/chat/sesion', optionalAuth, ah(async (req, res) => {
  const doc = { usuario_id: req.userId || null, nombre: req.user?.nombre || req.body?.nombre || 'Invitado', estado: 'activa', creada: new Date() };
  const r = await col('chat_sesiones').insertOne(doc);
  res.status(201).json({ ok: true, sesion_id: String(r.insertedId) });
}));
router.post('/chat/mensajes', optionalAuth, ah(async (req, res) => {
  const { sesion_id, texto } = req.body || {};
  const s = sesion_id && (await col('chat_sesiones').findOne(idFilter(sesion_id)));
  if (!s || !texto) return res.status(400).json({ ok: false, error: 'sesion_id y texto son obligatorios' });
  if (s.usuario_id && s.usuario_id !== req.userId) return res.status(403).json({ ok: false, error: 'Sesión ajena' });
  await col('chat_mensajes').insertOne({ sesion_id: String(s._id), de: 'cliente', texto: String(texto).slice(0, 2000), fecha: new Date() });
  res.status(201).json({ ok: true });
}));
router.get('/chat/mensajes', optionalAuth, ah(async (req, res) => {
  const s = req.query.sesion_id && (await col('chat_sesiones').findOne(idFilter(req.query.sesion_id)));
  if (!s || (s.usuario_id && s.usuario_id !== req.userId)) return res.status(404).json({ ok: false, error: 'Sesión no encontrada' });
  const f = { sesion_id: String(s._id) };
  res.json({ ok: true, data: ser(await col('chat_mensajes').find(f).sort({ fecha: 1 }).toArray()) });
}));

module.exports = router;
