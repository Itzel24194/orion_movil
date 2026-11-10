const router = require('express').Router();
const { col } = require('../config/db');
const { cliente } = require('../middleware/auth');
const { ah, ser } = require('../utils/helpers');
const carrito = require('./carrito');
const promos = require('../services/promociones');
const calc = require('../utils/promo-calc');

// Públicas (GET /promociones y /promociones/destacadas) viven en catalogo.js; aquí van las que requieren sesión.
router.get('/carrito', ...cliente, ah(async (req, res) => {
  const c = await carrito.render(req.userId);
  res.json({ ok: true, data: ser({ aplicada: c.promocion, disponibles: c.promociones_disponibles, descuento_promo: c.descuento_promo }) });
}));
router.get('/disponibles', ...cliente, ah(async (req, res) => {
  const c = await carrito.render(req.userId);
  res.json({ ok: true, data: ser(c.promociones_disponibles) });
}));
router.post('/validar-codigo', ...cliente, ah(async (req, res) => {
  const p = await promos.buscarPorCodigo(req.body?.codigo);
  if (!p) return res.status(404).json({ ok: false, error: 'La promoción no existe' });
  if (p._inactiva) return res.status(400).json({ ok: false, error: 'La promoción no está vigente' });
  const c = await carrito.render(req.userId);
  const r = calc.evaluar(p, c.items, c.subtotal);
  if (!r.ok) return res.status(400).json({ ok: false, error: r.error });
  res.json({ ok: true, data: ser(promos.resumen(p, r)) });
}));
// Alias de las rutas de Flask: aplicar / quitar promoción del carrito
router.post('/aplicar', ...cliente, (req, res, next) => { req.url = '/promocion'; carrito(req, res, next); });
router.post('/quitar', ...cliente, ah(async (req, res) => {
  await col('carritos').updateOne({ usuario_id: req.userId }, { $unset: { promocion_id: '' } });
  res.json({ ok: true, data: ser(await carrito.render(req.userId)) });
}));

module.exports = router;
