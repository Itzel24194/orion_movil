const router = require('express').Router();
const { col } = require('../config/db');
const { ah, idFilter, esc, ser, paginate, meta, num } = require('../utils/helpers');
const { auth, cliente } = require('../middleware/auth');

const visible = { activo: { $ne: false }, estado: { $nin: ['baja', 'inactivo', 'rechazado'] } };

function filtroProductos(q) {
  const f = { ...visible };
  const and = [];
  if (q.q) { const r = { $regex: esc(q.q), $options: 'i' }; and.push({ $or: [{ nombre: r }, { descripcion: r }, { marca: r }, { sku: r }] }); }
  if (q.categoria) and.push({ $or: [{ categoria_id: String(q.categoria) }, { categoria: q.categoria }] });
  if (q.marca) f.marca = { $regex: `^${esc(q.marca)}$`, $options: 'i' };
  if (q.min || q.max) { f.precio = {}; if (q.min) f.precio.$gte = num(q.min); if (q.max) f.precio.$lte = num(q.max); }
  if (q.vendedor) f.vendedor_id = String(q.vendedor);
  if (and.length) f.$and = and;
  return f;
}
const ORDEN = { precio_asc: { precio: 1 }, precio_desc: { precio: -1 }, nuevo: { _id: -1 }, vendidos: { vendidos: -1 }, nombre: { nombre: 1 } };

async function listar(req, res, extra = {}) {
  const { page, limit, skip } = paginate(req.query);
  const f = { ...filtroProductos({ ...req.query, ...extra }) };
  const sort = ORDEN[req.query.orden] || { _id: -1 };
  const [items, total] = await Promise.all([
    col('productos').find(f).sort(sort).skip(skip).limit(limit).toArray(), col('productos').countDocuments(f)]);
  res.json({ ok: true, data: ser(items), meta: meta(page, limit, total) });
}

// ---------- PRODUCTOS ----------
const P = require('express').Router();
P.get('/', ah((req, res) => listar(req, res)));
P.get('/buscar', ah((req, res) => listar(req, res)));
P.get('/autocompletar', ah(async (req, res) => {
  if (!req.query.q) return res.json({ ok: true, data: [] });
  const r = { $regex: esc(req.query.q), $options: 'i' };
  const items = await col('productos').find({ ...visible, nombre: r }).project({ nombre: 1, precio: 1, imagenes: 1, imagen: 1 }).limit(8).toArray();
  res.json({ ok: true, data: ser(items) });
}));
P.get('/mas-vendidos', ah(async (req, res) => {
  const items = await col('productos').find(visible).sort({ vendidos: -1, _id: -1 }).limit(Math.min(num(req.query.limit, 10), 50)).toArray();
  res.json({ ok: true, data: ser(items) });
}));
P.get('/novedades', ah(async (_req, res) => res.json({ ok: true, data: ser(await col('productos').find(visible).sort({ _id: -1 }).limit(12).toArray()) })));
P.get('/categoria/:id', ah((req, res) => listar(req, res, { categoria: req.params.id })));
P.get('/marca/:marca', ah((req, res) => listar(req, res, { marca: req.params.marca })));
P.get('/:id', ah(async (req, res) => {
  const p = await col('productos').findOne(idFilter(req.params.id));
  if (!p) return res.status(404).json({ ok: false, error: 'Producto no encontrado' });
  col('productos').updateOne({ _id: p._id }, { $inc: { vistas: 1 } }).catch(() => {});
  res.json({ ok: true, data: ser(p) });
}));
P.get('/:id/relacionados', ah(async (req, res) => {
  const p = await col('productos').findOne(idFilter(req.params.id));
  if (!p) return res.status(404).json({ ok: false, error: 'Producto no encontrado' });
  const f = { ...visible, _id: { $ne: p._id } };
  if (p.categoria_id) f.categoria_id = p.categoria_id; else if (p.categoria) f.categoria = p.categoria;
  res.json({ ok: true, data: ser(await col('productos').find(f).limit(8).toArray()) });
}));
P.get('/:id/resenas', ah(async (req, res) => {
  const items = await col('resenas').find({ producto_id: String(req.params.id), estado: 'aprobada' }).sort({ fecha: -1 }).limit(50).toArray();
  const prom = items.length ? items.reduce((a, r) => a + num(r.calificacion), 0) / items.length : 0;
  res.json({ ok: true, data: ser(items), promedio: Math.round(prom * 10) / 10, total: items.length });
}));
router.use('/productos', P);

// ---------- CATEGORIAS ----------
router.get('/categorias', ah(async (_req, res) =>
  res.json({ ok: true, data: ser(await col('categorias').find({ activo: { $ne: false } }).sort({ orden: 1, nombre: 1 }).toArray()) })));
router.get('/categorias/:id', ah(async (req, res) => {
  const c = await col('categorias').findOne(idFilter(req.params.id));
  if (!c) return res.status(404).json({ ok: false, error: 'Categoría no encontrada' });
  const total = await col('productos').countDocuments({ ...visible, $or: [{ categoria_id: String(c._id) }, { categoria: c.nombre }] });
  res.json({ ok: true, data: ser(c), total_productos: total });
}));

// ---------- MARCAS ----------
// ⚠️ MOVIDO: los endpoints de marcas ahora viven en src/routes/marcas.js
// y se montan en src/server.js ANTES del catch-all. No duplicar aquí.
// router.get('/marcas', ...);
// router.get('/marcas/buscar', ...);
// router.get('/marcas/:id', ...);

// ---------- COMBOS / PROMOCIONES / TEMPORADAS ----------
router.get('/combos', ah(async (_req, res) => res.json({ ok: true, data: ser(await col('combos').find({ activo: { $ne: false } }).toArray()) })));
router.get('/combos/:id', ah(async (req, res) => {
  const c = await col('combos').findOne(idFilter(req.params.id));
  if (!c) return res.status(404).json({ ok: false, error: 'Combo no encontrado' });
  res.json({ ok: true, data: ser(c) });
}));
async function promosVigentes() {
  const now = new Date();
  const all = await col('promociones').find({ activo: { $ne: false }, estado: { $nin: ['inactiva', 'pausada', 'finalizada'] } }).toArray();
  return all.filter((p) => {
    const i = p.fecha_inicio && new Date(p.fecha_inicio), f = p.fecha_fin && new Date(p.fecha_fin);
    return !(i && !isNaN(i) && now < i) && !(f && !isNaN(f) && now > f);
  });
}
router.get('/promociones', ah(async (_req, res) => res.json({ ok: true, data: ser(await promosVigentes()) })));
router.get('/promociones/destacadas', ah(async (_req, res) =>
  res.json({ ok: true, data: ser((await promosVigentes()).filter((p) => p.destacada !== false).slice(0, 6)) })));
router.get('/temporadas', ah(async (_req, res) => res.json({ ok: true, data: ser(await col('temporadas').find({ activo: { $ne: false } }).toArray()) })));

// ---------- RESEÑAS (cliente) ----------
router.post('/resenas', ...cliente, ah(async (req, res) => {
  const { producto_id, calificacion, comentario = '', titulo = '' } = req.body || {};
  const cal = num(calificacion);
  if (!producto_id || cal < 1 || cal > 5) return res.status(400).json({ ok: false, error: 'producto_id y calificacion (1-5) son obligatorios' });
  const prod = await col('productos').findOne(idFilter(producto_id));
  if (!prod) return res.status(404).json({ ok: false, error: 'Producto no encontrado' });
  if (await col('resenas').findOne({ producto_id: String(prod._id), usuario_id: req.userId }))
    return res.status(409).json({ ok: false, error: 'Ya opinaste sobre este producto' });
  const doc = { producto_id: String(prod._id), usuario_id: req.userId, usuario_nombre: req.user.nombre, calificacion: cal,
    titulo, comentario, estado: 'pendiente', utiles: 0, fecha: new Date() };
  await col('resenas').insertOne(doc);
  res.status(201).json({ ok: true, message: 'Gracias, tu reseña será revisada' });
}));
router.post('/resenas/:id/util', auth, ah(async (req, res) => {
  await col('resenas').updateOne(idFilter(req.params.id), { $inc: { utiles: 1 } });
  res.json({ ok: true });
}));
router.delete('/resenas/:id', auth, ah(async (req, res) => {
  const r = await col('resenas').deleteOne({ ...idFilter(req.params.id), usuario_id: req.userId });
  res.json({ ok: r.deletedCount > 0 });
}));

router.put('/resenas/:id', ...cliente, ah(async (req, res) => {
  const set = { estado: 'pendiente', editada: true, fecha_edicion: new Date() };
  if (req.body?.calificacion !== undefined) { const c = num(req.body.calificacion); if (c < 1 || c > 5) return res.status(400).json({ ok: false, error: 'calificacion debe ser 1-5' }); set.calificacion = c; }
  if (req.body?.comentario !== undefined) set.comentario = String(req.body.comentario).slice(0, 2000);
  if (req.body?.titulo !== undefined) set.titulo = String(req.body.titulo).slice(0, 150);
  const r = await col('resenas').updateOne({ ...idFilter(req.params.id), usuario_id: req.userId }, { $set: set });
  res.status(r.matchedCount ? 200 : 404).json({ ok: r.matchedCount > 0, message: r.matchedCount ? 'Reseña actualizada; será revisada de nuevo' : 'Reseña no encontrada' });
}));
router.post('/resenas/:id/reportar', ...cliente, ah(async (req, res) => {
  const r = await col('resenas').updateOne({ ...idFilter(req.params.id), 'reportes.usuario_id': { $ne: req.userId } },
    { $push: { reportes: { usuario_id: req.userId, motivo: String(req.body?.motivo || '').slice(0, 300), fecha: new Date() } } });
  res.json({ ok: true, message: r.modifiedCount ? 'Gracias, revisaremos la reseña' : 'Ya reportaste esta reseña' });
}));

module.exports = router;