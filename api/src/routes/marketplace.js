const router = require('express').Router();
const { col } = require('../config/db');
const { auth, vendedor } = require('../middleware/auth');
const { ah, idFilter, ser, num, esc, pick, clean, paginate, meta } = require('../utils/helpers');
const { restaurarStock } = require('./pedidos');

const slugify = (s) => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const aprobado = { estado: { $in: ['aprobado', 'aprobada', 'activo', 'activa'] }, activo: { $ne: false } };
const PUBLICOS = { nombre_tienda: 1, slug: 1, descripcion: 1, logo: 1, banner: 1, categoria: 1, destacado: 1, ciudad: 1, usuario_id: 1 };

// ---------- PÚBLICO ----------
router.get('/vendedores', ah(async (req, res) => {
  const f = { ...aprobado };
  if (req.query.categoria) f.categoria = req.query.categoria;
  if (req.query.destacados === '1') f.destacado = true;
  const items = await col('vendedores').find(f).project(PUBLICOS).limit(Math.min(num(req.query.limite, 24), 100)).toArray();
  res.json({ ok: true, data: ser(items) });
}));
router.get('/vendedores/:id', ah(async (req, res) => {
  const v = await col('vendedores').findOne({ ...idFilter(req.params.id), ...aprobado }, { projection: PUBLICOS });
  if (!v) return res.status(404).json({ ok: false, error: 'Vendedor no encontrado' });
  res.json({ ok: true, data: ser(v) });
}));
router.get('/tienda/:slug', ah(async (req, res) => {
  const v = await col('vendedores').findOne({ slug: req.params.slug, ...aprobado }, { projection: PUBLICOS });
  if (!v) return res.status(404).json({ ok: false, error: 'Tienda no encontrada' });
  const { page, limit, skip } = paginate(req.query);
  const f = { vendedor_id: v.usuario_id, activo: { $ne: false } };
  const [productos, total] = await Promise.all([col('productos').find(f).sort({ _id: -1 }).skip(skip).limit(limit).toArray(), col('productos').countDocuments(f)]);
  res.json({ ok: true, data: { vendedor: ser(v), productos: ser(productos) }, meta: meta(page, limit, total) });
}));

// ---------- SOLICITUD ----------
router.post('/registro', auth, ah(async (req, res) => {
  const b = req.body || {};
  if (!b.nombre_tienda) return res.status(400).json({ ok: false, error: 'nombre_tienda es obligatorio' });
  if (await col('vendedores').findOne({ usuario_id: req.userId })) return res.status(409).json({ ok: false, error: 'Ya tienes una solicitud' });
  const doc = { ...pick(b, ['nombre_tienda', 'descripcion', 'categoria', 'telefono', 'rfc', 'ciudad', 'logo', 'banner']),
    slug: `${slugify(b.nombre_tienda)}-${Math.random().toString(36).slice(2, 8)}`, usuario_id: req.userId, email: req.user.email,
    estado: 'pendiente', comision: 10, activo: true, fecha_solicitud: new Date() };
  await col('vendedores').insertOne(doc);
  res.status(201).json({ ok: true, message: 'Solicitud enviada', data: ser(doc) });
}));
router.get('/estado', auth, ah(async (req, res) => {
  const v = await col('vendedores').findOne({ usuario_id: req.userId });
  res.json({ ok: true, data: v ? ser({ estado: v.estado, nombre_tienda: v.nombre_tienda, slug: v.slug, motivo: v.motivo || null }) : null });
}));

// ---------- PANEL DEL VENDEDOR (rol vendedor) ----------
const V = [...vendedor];
const PROD = ['nombre', 'descripcion', 'precio', 'precio_oferta', 'stock', 'categoria_id', 'categoria', 'marca', 'imagenes', 'tallas', 'colores', 'sku', 'atributos'];
const mio = (req, id) => ({ ...idFilter(id), vendedor_id: req.userId });

router.get('/panel/stats', ...V, ah(async (req, res) => {
  const [productos, pedidos] = await Promise.all([col('productos').countDocuments({ vendedor_id: req.userId }), col('pedidos').find({ 'items.vendedor_id': req.userId, estado: { $ne: 'cancelado' } }).toArray()]);
  let ventas = 0, unidades = 0;
  pedidos.forEach((p) => p.items.filter((i) => i.vendedor_id === req.userId).forEach((i) => { ventas += num(i.precio) * num(i.cantidad); unidades += num(i.cantidad); }));
  res.json({ ok: true, data: { productos, pedidos: pedidos.length, ventas: Math.round(ventas * 100) / 100, unidades } });
}));
router.get('/panel/productos', ...V, ah(async (req, res) =>
  res.json({ ok: true, data: ser(await col('productos').find({ vendedor_id: req.userId }).sort({ _id: -1 }).toArray()) })));
router.post('/panel/productos', ...V, ah(async (req, res) => {
  const d = { ...pick(req.body || {}, PROD), vendedor_id: req.userId, activo: true, vendidos: 0, fecha_creacion: new Date() };
  if (!d.nombre || num(d.precio) <= 0) return res.status(400).json({ ok: false, error: 'nombre y precio son obligatorios' });
  d.precio = num(d.precio);
  const r = await col('productos').insertOne(d);
  res.status(201).json({ ok: true, data: ser({ ...d, _id: r.insertedId }) });
}));
router.put('/panel/productos/:id', ...V, ah(async (req, res) => {
  const r = await col('productos').updateOne(mio(req, req.params.id), { $set: pick(req.body || {}, PROD) });
  res.status(r.matchedCount ? 200 : 404).json({ ok: r.matchedCount > 0 });
}));
router.post('/panel/productos/:id/toggle', ...V, ah(async (req, res) => {
  const p = await col('productos').findOne(mio(req, req.params.id));
  if (!p) return res.status(404).json({ ok: false });
  await col('productos').updateOne({ _id: p._id }, { $set: { activo: p.activo === false } });
  res.json({ ok: true, activo: p.activo === false });
}));
router.delete('/panel/productos/:id', ...V, ah(async (req, res) => {
  const r = await col('productos').deleteOne(mio(req, req.params.id));
  res.json({ ok: r.deletedCount > 0 });
}));
router.get('/panel/pedidos', ...V, ah(async (req, res) => {
  const pedidos = await col('pedidos').find({ 'items.vendedor_id': req.userId }).sort({ fecha: -1 }).limit(100).toArray();
  res.json({ ok: true, data: ser(pedidos.map((p) => ({ ...p, items: p.items.filter((i) => i.vendedor_id === req.userId), direccion_envio: p.direccion_envio }))) });
}));
router.get('/panel/pedidos/:id', ...V, ah(async (req, res) => {
  const p = await col('pedidos').findOne({ ...idFilter(req.params.id), 'items.vendedor_id': req.userId });
  if (!p) return res.status(404).json({ ok: false, error: 'Pedido no encontrado' });
  res.json({ ok: true, data: ser({ ...p, items: p.items.filter((i) => i.vendedor_id === req.userId) }) });
}));
router.post('/panel/pedidos/:id/estado', ...V, ah(async (req, res) => {
  const estado = req.body?.estado;
  if (!['procesando', 'enviado'].includes(estado)) return res.status(400).json({ ok: false, error: 'Estado permitido: procesando | enviado' });
  const r = await col('pedidos').updateOne({ ...idFilter(req.params.id), 'items.vendedor_id': req.userId }, { $set: { estado, guia: req.body?.guia || null }, $push: { historial_estados: { estado, fecha: new Date(), por: req.userId } } });
  res.json({ ok: r.matchedCount > 0 });
}));
router.get('/panel/resenas', ...V, ah(async (req, res) => {
  const ids = (await col('productos').find({ vendedor_id: req.userId }).project({ _id: 1 }).toArray()).map((p) => String(p._id));
  res.json({ ok: true, data: ser(await col('resenas').find({ producto_id: { $in: ids }, estado: 'aprobada' }).sort({ fecha: -1 }).limit(100).toArray()) });
}));
router.post('/panel/resenas/:id/responder', ...V, ah(async (req, res) => {
  const r = await col('resenas').findOne(idFilter(req.params.id));
  const p = r && (await col('productos').findOne({ ...idFilter(r.producto_id), vendedor_id: req.userId }));
  if (!p) return res.status(404).json({ ok: false, error: 'Reseña no encontrada' });
  await col('resenas').updateOne({ _id: r._id }, { $set: { respuesta: { texto: String(req.body?.texto || '').slice(0, 1000), fecha: new Date() } } });
  res.json({ ok: true });
}));

module.exports = router;
