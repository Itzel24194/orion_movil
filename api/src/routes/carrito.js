const router = require('express').Router();
const { col } = require('../config/db');
const { ah, idFilter, ser, num, round2 } = require('../utils/helpers');
const { cliente } = require('../middleware/auth');
const cupones = require('../services/cupones');
const promos = require('../services/promociones');

router.use(...cliente);

const precioDe = (p) => (num(p.precio_oferta) > 0 && num(p.precio_oferta) < num(p.precio) ? num(p.precio_oferta) : num(p.precio));
const same = (a, b) => String(a.producto_id) === String(b.producto_id) && (a.talla || '') === (b.talla || '') && (a.color || '') === (b.color || '');

async function getCart(userId) {
  return (await col('carritos').findOne({ usuario_id: userId })) || { usuario_id: userId, items: [] };
}
async function render(userId, cuponCodigo) {
  const cart = await getCart(userId);
  const ids = cart.items.map((i) => i.producto_id);
  const prods = ids.length ? await col('productos').find({ $or: ids.map(idFilter) }).toArray() : [];
  const map = new Map(prods.map((p) => [String(p._id), p]));
  const items = []; let subtotal = 0;
  for (const it of cart.items) {
    const p = map.get(String(it.producto_id));
    if (!p) continue;
    const precio = precioDe(p), cantidad = num(it.cantidad, 1);
    subtotal += precio * cantidad;
    items.push({ producto_id: String(p._id), nombre: p.nombre, imagen: (p.imagenes && p.imagenes[0]) || p.imagen || null,
      categoria_id: p.categoria_id ? String(p.categoria_id) : null, categoria: p.categoria || null, marca: p.marca || null,
      precio, cantidad, talla: it.talla || null, color: it.color || null, stock: p.stock ?? null, subtotal: round2(precio * cantidad) });
  }
  subtotal = round2(subtotal);
  // 1) Promoción (elegida por el cliente o la mejor automática)
  const pr = await promos.evaluarParaCarrito(items, subtotal, cart.promocion_id);
  const descuento_promo = round2(pr.descuento || 0);
  // 2) Cupón, calculado sobre lo que queda después de la promoción
  let descuento_cupon = 0, cupon = null, cupon_error = null;
  if (cuponCodigo) {
    const v = await cupones.validar(cuponCodigo, round2(subtotal - descuento_promo), userId);
    if (v.ok) { descuento_cupon = v.descuento; cupon = cuponCodigo; } else cupon_error = v.error;
  }
  const descuento = round2(descuento_promo + descuento_cupon);
  const gratis = pr.envio_gratis || subtotal - descuento >= num(process.env.ENVIO_GRATIS_DESDE, 999);
  const envio = subtotal === 0 ? 0 : gratis ? 0 : num(process.env.ENVIO_COSTO, 99);
  return {
    items, cantidad_total: items.reduce((a, i) => a + i.cantidad, 0), subtotal,
    promocion: pr.promo ? { id: String(pr.promo._id), nombre: pr.promo.nombre || pr.promo.titulo || pr.promo.codigo, codigo: pr.promo.codigo || null, descuento: descuento_promo, envio_gratis: !!pr.envio_gratis } : null,
    promocion_error: pr.error || null, promociones_disponibles: pr.disponibles,
    descuento_promo, cupon, descuento_cupon, cupon_error, descuento, envio, total: round2(subtotal - descuento + envio)
  };
}

router.get('/', ah(async (req, res) => res.json({ ok: true, data: ser(await render(req.userId, req.query.cupon)) })));

const add = ah(async (req, res) => {
  const { producto_id, cantidad = 1, talla = '', color = '' } = req.body || {};
  const qty = Math.max(1, Math.floor(num(cantidad, 1)));
  const p = producto_id && (await col('productos').findOne(idFilter(producto_id)));
  if (!p || p.activo === false) return res.status(404).json({ ok: false, error: 'Producto no disponible' });
  const cart = await getCart(req.userId);
  const item = { producto_id: String(p._id), talla, color };
  const ex = cart.items.find((i) => same(i, item));
  const nueva = (ex ? num(ex.cantidad) : 0) + qty;
  if (p.stock !== undefined && p.stock !== null && nueva > num(p.stock)) return res.status(409).json({ ok: false, error: `Solo hay ${p.stock} en stock` });
  if (ex) ex.cantidad = nueva; else cart.items.push({ ...item, cantidad: qty });
  await col('carritos').updateOne({ usuario_id: req.userId }, { $set: { items: cart.items, actualizado: new Date() } }, { upsert: true });
  res.status(201).json({ ok: true, data: ser(await render(req.userId)) });
});
const update = ah(async (req, res) => {
  const pid = req.params.productoId || req.body.producto_id;
  const talla = req.body.talla ?? req.query.talla ?? '', color = req.body.color ?? req.query.color ?? '';
  const qty = Math.floor(num(req.body.cantidad, 0));
  const cart = await getCart(req.userId);
  const idx = cart.items.findIndex((i) => same(i, { producto_id: pid, talla, color }));
  if (idx < 0) return res.status(404).json({ ok: false, error: 'El producto no está en el carrito' });
  if (qty <= 0) cart.items.splice(idx, 1);
  else {
    const p = await col('productos').findOne(idFilter(pid));
    if (p && p.stock !== undefined && p.stock !== null && qty > num(p.stock)) return res.status(409).json({ ok: false, error: `Solo hay ${p.stock} en stock` });
    cart.items[idx].cantidad = qty;
  }
  await col('carritos').updateOne({ usuario_id: req.userId }, { $set: { items: cart.items, actualizado: new Date() } }, { upsert: true });
  res.json({ ok: true, data: ser(await render(req.userId)) });
});
const remove = ah(async (req, res) => {
  const pid = req.params.productoId || req.body?.producto_id || req.query.producto_id;
  if (!pid) { await col('carritos').updateOne({ usuario_id: req.userId }, { $set: { items: [] } }, { upsert: true }); return res.json({ ok: true, data: ser(await render(req.userId)) }); }
  const talla = req.query.talla ?? req.body?.talla ?? '', color = req.query.color ?? req.body?.color ?? '';
  const cart = await getCart(req.userId);
  cart.items = cart.items.filter((i) => !same(i, { producto_id: pid, talla, color }));
  await col('carritos').updateOne({ usuario_id: req.userId }, { $set: { items: cart.items } }, { upsert: true });
  res.json({ ok: true, data: ser(await render(req.userId)) });
});

router.post('/items', add);           router.post('/', add);
router.put('/items/:productoId', update); router.put('/', update);
router.delete('/items/:productoId', remove);
router.delete('/', remove);

// ---- Promoción elegida manualmente (por código o por id) ----
router.post('/promocion', ah(async (req, res) => {
  const { codigo, promocion_id } = req.body || {};
  let promo;
  if (codigo) { promo = await promos.buscarPorCodigo(codigo); if (!promo) return res.status(404).json({ ok: false, error: 'La promoción no existe' }); if (promo._inactiva) return res.status(400).json({ ok: false, error: 'La promoción no está vigente' }); }
  else if (promocion_id) promo = (await promos.vigentes()).find((p) => String(p._id) === String(promocion_id));
  if (!promo) return res.status(404).json({ ok: false, error: 'Promoción no disponible' });
  const antes = await render(req.userId);
  const r = require('../utils/promo-calc').evaluar(promo, antes.items, antes.subtotal);
  if (!r.ok) return res.status(400).json({ ok: false, error: r.error });
  await col('carritos').updateOne({ usuario_id: req.userId }, { $set: { promocion_id: String(promo._id) } }, { upsert: true });
  res.json({ ok: true, data: ser(await render(req.userId, req.body?.cupon)) });
}));
router.delete('/promocion', ah(async (req, res) => {
  await col('carritos').updateOne({ usuario_id: req.userId }, { $unset: { promocion_id: '' } });
  res.json({ ok: true, data: ser(await render(req.userId)) });
}));

module.exports = router;
module.exports.render = render;
module.exports.precioDe = precioDe;
