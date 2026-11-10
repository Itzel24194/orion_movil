// src/routes/pedidos.js
const router = require('express').Router();
const { col } = require('../config/db');
const { cliente, optionalAuth } = require('../middleware/auth');
const { ah, idFilter, ser, num, round2, esc, paginate, meta } = require('../utils/helpers');
const cupones = require('../services/cupones');
const carrito = require('./carrito');
const crypto = require('crypto');
const promos = require('../services/promociones');

const numeroPedido = () =>
  'ORD-' +
  Date.now().toString(36).toUpperCase() +
  Math.random().toString(36).slice(2, 5).toUpperCase();

async function restaurarStock(items) {
  for (const it of items || []) {
    await col('productos')
      .updateOne(idFilter(it.producto_id), {
        $inc: { stock: num(it.cantidad), vendidos: -num(it.cantidad) },
      })
      .catch(() => {});
  }
}

// Seguimiento público
router.get('/rastrear', ah(async (req, res) => {
  const { numero, email } = req.query;
  if (!numero || !email)
    return res.status(400).json({ ok: false, error: 'numero y email son obligatorios' });
  const p = await col('pedidos').findOne({ numero_pedido: numero });
  const u = p && (await col('usuarios').findOne(idFilter(p.usuario_id)));
  if (!p || !u || String(u.email).toLowerCase() !== String(email).toLowerCase())
    return res.status(404).json({ ok: false, error: 'Pedido no encontrado' });
  res.json({
    ok: true,
    data: ser({
      numero_pedido: p.numero_pedido,
      estado: p.estado,
      fecha: p.fecha,
      historial_estados: p.historial_estados,
      guia: p.guia || null,
    }),
  });
}));

router.use(...cliente);

// ================================================================
// GET /api/v1/pedidos — Listar pedidos del usuario
// ================================================================
router.get('/', ah(async (req, res) => {
  const { page, limit, skip } = paginate(req.query);
  const f = { usuario_id: req.userId };
  if (req.query.estado) f.estado = req.query.estado;
  const [items, total] = await Promise.all([
    col('pedidos').find(f).sort({ fecha: -1 }).skip(skip).limit(limit).toArray(),
    col('pedidos').countDocuments(f),
  ]);
  res.json({ ok: true, data: ser(items), meta: meta(page, limit, total) });
}));

// ================================================================
// GET /api/v1/pedidos/:id — Detalle
// ================================================================
router.get('/:id', ah(async (req, res) => {
  const p = await col('pedidos').findOne({
    $or: [idFilter(req.params.id), { numero_pedido: req.params.id }],
    usuario_id: req.userId,
  });
  if (!p) return res.status(404).json({ ok: false, error: 'Pedido no encontrado' });
  res.json({ ok: true, data: ser(p) });
}));

// ================================================================
// POST /api/v1/pedidos — CHECKOUT (web y móvil)
// ================================================================
// Acepta 2 formatos:
//   1) Web: usa el carrito del servidor (carrito.render) + direccion_envio { … }
//   2) Móvil: envía items[] + campos individuales (calle, numero, cp, ...)
// ================================================================
router.post('/', ah(async (req, res) => {
  const body = req.body || {};

  // ---------- Detectar origen ----------
  const itemsCliente = Array.isArray(body.items) ? body.items : null;
  const usaItemsDirectos = !!itemsCliente && itemsCliente.length > 0;

  // ---------- Normalizar dirección ----------
  let direccion_envio = body.direccion_envio;
  if (!direccion_envio || typeof direccion_envio !== 'object') {
    // Formato móvil: campos individuales
    direccion_envio = {
      calle: String(body.calle || '').trim(),
      numero: String(body.numero || '').trim(),
      cp: String(body.cp || '').replace(/\D/g, ''),
      colonia: String(body.colonia || '').trim(),
      ciudad: String(body.ciudad || '').trim(),
      estado: String(body.estado || '').trim(),
      pais: String(body.pais || 'México').trim(),
      referencias: String(body.referencias || '').trim(),
    };
  }

  // ---------- Normalizar tipo de envío ----------
  const tipoEnvioRaw = String(body.tipo_envio || body.metodo_envio || 'domicilio').toLowerCase();
  const tipoEnvio = tipoEnvioRaw === 'click_collect' ? 'click_collect' : 'domicilio';

  // ---------- Normalizar método de pago ----------
  const metodo_pago = String(body.metodo_pago || 'tarjeta').toLowerCase();
  const METODOS_VALIDOS = ['tarjeta', 'efectivo', 'transferencia', 'monedero', 'paypal', 'oxxo', 'msi'];
  if (!METODOS_VALIDOS.includes(metodo_pago))
    return res.status(400).json({ ok: false, error: 'Método de pago no válido' });

  // ---------- Validar según tipo de envío ----------
  if (tipoEnvio === 'domicilio') {
    if (
      direccion_envio.calle.length < 3 ||
      direccion_envio.numero.length < 1 ||
      direccion_envio.cp.length !== 5 ||
      direccion_envio.colonia.length < 3 ||
      direccion_envio.ciudad.length < 3 ||
      direccion_envio.estado.length < 3
    ) {
      return res.status(400).json({
        ok: false,
        error: 'Datos de envío incompletos o inválidos',
      });
    }
  } else {
    if (!String(body.tienda_recogida || '').trim()) {
      return res.status(400).json({
        ok: false,
        error: 'Debes seleccionar una tienda para Click & Collect',
      });
    }
  }

  // ---------- Obtener items (2 caminos) ----------
  let items = [];
  let subtotalCalculado = 0;

  if (usaItemsDirectos) {
    // ⭐ MÓVIL: validar cada item contra la BD
    const itemsValidados = [];
    const itemsConProblema = [];

    for (const it of itemsCliente) {
      const productId = String(it.productId || it.id || '').trim();
      if (!productId) continue;

      let prod = null;
      try {
        prod = await col('productos').findOne(idFilter(productId));
      } catch (e) { /* id inválido */ }

      if (!prod) {
        itemsConProblema.push({ name: it.name || productId, motivo: 'Producto no existe' });
        continue;
      }

      // Buscar variante exacta
      const vars = Array.isArray(prod.variables) ? prod.variables : [];
      const variantSku = it.variantSku || null;
      const color = it.color || null;
      const size = it.size || null;

      let variante = null;
      if (vars.length > 0) {
        variante = vars.find(
          (v) =>
            (!variantSku || v.sku === variantSku) &&
            (!color || v.color === color) &&
            (!size || v.tamano === size)
        );
        if (!variante && variantSku) {
          variante = vars.find((v) => v.sku === variantSku);
        }
      }

      const precioReal = Number(variante?.precio ?? prod.precio ?? 0);
      if (!(precioReal > 0)) {
        itemsConProblema.push({ name: prod.nombre, motivo: 'Precio inválido' });
        continue;
      }

      const stockReal = Number(variante?.stock ?? prod.stock ?? 0);
      const cantidad = Math.max(1, num(it.quantity, 1));

      if (stockReal < cantidad) {
        itemsConProblema.push({
          name: prod.nombre,
          motivo: `Stock insuficiente (disponible: ${stockReal}, pedido: ${cantidad})`,
        });
        continue;
      }

      const subtotalItem = round2(precioReal * cantidad);
      subtotalCalculado = round2(subtotalCalculado + subtotalItem);

      itemsValidados.push({
        producto_id: String(prod._id),
        nombre: prod.nombre,
        sku: variante?.sku || null,
        tamano: variante?.tamano || size || null,
        color: variante?.color || color || null,
        cantidad,
        precio_unitario: precioReal,
        precio: precioReal,
        subtotal: subtotalItem,
        imagen:
          (Array.isArray(prod.imagenes) && prod.imagenes[0]) ||
          prod.imagen ||
          null,
        vendedor_id: prod.vendedor_id || null,
      });
    }

    if (itemsConProblema.length > 0) {
      return res.status(409).json({
        ok: false,
        error: 'Algunos productos tienen problemas de stock o precio',
        items: itemsConProblema,
      });
    }

    if (itemsValidados.length === 0) {
      return res.status(400).json({ ok: false, error: 'No hay items válidos' });
    }

    items = itemsValidados;
  } else {
    // ⭐ WEB: usar el carrito del servidor
    const cart = await carrito.render(req.userId, body.cupon);
    if (!cart.items.length) {
      return res.status(400).json({ ok: false, error: 'El carrito está vacío' });
    }
    items = cart.items;
    subtotalCalculado = cart.subtotal;
  }

  // ---------- Reservar stock de forma atómica ----------
  const reservados = [];
  for (const it of items) {
    const prod = await col('productos').findOne(idFilter(it.producto_id));
    if (prod && prod.stock !== undefined && prod.stock !== null) {
      const r = await col('productos').updateOne(
        { _id: prod._id, stock: { $gte: it.cantidad } },
        { $inc: { stock: -it.cantidad, vendidos: it.cantidad } }
      );
      if (!r.matchedCount) {
        await restaurarStock(reservados);
        return res.status(409).json({ ok: false, error: `Sin stock suficiente: ${it.nombre}` });
      }
      reservados.push(it);
    }
  }

  // ---------- Calcular totales (solo móvil, web ya los tiene) ----------
  let subtotal, descuento, iva, envio, total;

  if (usaItemsDirectos) {
    subtotal = subtotalCalculado;
    const totalUnidades = items.reduce((s, x) => s + x.cantidad, 0);

    // Descuento por volumen (5% a partir de 50 u)
    descuento = totalUnidades >= 50 ? round2(subtotal * 0.05) : 0;
    const subtotalConDescuento = round2(subtotal - descuento);
    iva = round2(subtotalConDescuento * 0.16);

    if (tipoEnvio === 'click_collect') {
      envio = 0;
    } else {
      envio = totalUnidades >= 50 ? 199 : 99;
    }

    total = round2(subtotalConDescuento + iva + envio);
  } else {
    // Web: usar los valores del carrito renderizado
    subtotal = subtotalCalculado;
    descuento = 0;
    iva = 0;
    envio = 0;
    total = subtotal;
  }

  // ---------- Pago con monedero ----------
  if (metodo_pago === 'monedero') {
    const r = await col('monederos').updateOne(
      { usuario_id: req.userId, activo: { $ne: false }, saldo: { $gte: total } },
      { $inc: { saldo: -total } }
    );
    if (!r.matchedCount) {
      await restaurarStock(reservados);
      return res.status(402).json({ ok: false, error: 'Saldo insuficiente en el monedero' });
    }
    await col('monedero_movimientos').insertOne({
      usuario_id: req.userId,
      tipo: 'compra',
      monto: -total,
      concepto: 'Pago de pedido',
      fecha: new Date(),
    });
  }

  // ---------- Mapear vendedores ----------
  const vend = await col('productos')
    .find({ $or: items.map((i) => idFilter(i.producto_id)) })
    .project({ vendedor_id: 1 })
    .toArray();
  const vmap = new Map(vend.map((p) => [String(p._id), p.vendedor_id || null]));

  const ahora = new Date();
  const pedido = {
    numero_pedido: numeroPedido(),
    usuario_id: req.userId,
    usuario_email: req.user?.email || '',

    items: items.map((i) => ({
      ...i,
      vendedor_id: i.vendedor_id || vmap.get(i.producto_id) || null,
    })),

    subtotal,
    descuento,
    descuento_promo: 0,
    descuento_cupon: 0,
    promocion: null,
    cupon: body.cupon || null,
    iva,
    envio,
    total,

    metodo_pago,
    metodo_envio: tipoEnvio,
    tipo_envio: tipoEnvio,
    direccion_envio,
    tienda_recogida: tipoEnvio === 'click_collect' ? body.tienda_recogida : null,
    notas: String(body.notas || '').slice(0, 300),

    estado: metodo_pago === 'monedero' ? 'procesando' : 'pendiente',
    status: 'pendiente',
    pagado: metodo_pago === 'monedero',
    payment_status: metodo_pago === 'monedero' ? 'pagado' : 'no_pagado',

    fecha: ahora,
    fecha_creacion: ahora,
    createdAt: ahora,
    historial_estados: [{ estado: 'pendiente', fecha: ahora }],
    origen: usaItemsDirectos ? 'app' : 'api',
  };

  const r = await col('pedidos').insertOne(pedido);

  // Registrar uso de cupón / promoción (solo web)
  if (body.cupon) {
    try {
      const v = await cupones.validar(body.cupon, subtotal, req.userId);
      if (v.ok) await cupones.registrarUso(v.cupon, req.userId);
    } catch (e) { /* silent */ }
  }

  // Vaciar carrito del servidor (solo si existía)
  await col('carritos')
    .updateOne({ usuario_id: req.userId }, { $set: { items: [] }, $unset: { promocion_id: '' } })
    .catch(() => {});

  // Puntos de lealtad: 1 punto por cada $10
  const puntos = Math.floor(total / 10);
  if (puntos > 0) {
    try {
      await col('usuarios').updateOne(
        { _id: req.user._id },
        { $inc: { puntos_lealtad: puntos } }
      );
      await col('puntos_movimientos').insertOne({
        usuario_id: req.userId,
        puntos,
        tipo: 'compra',
        pedido: pedido.numero_pedido,
        fecha: ahora,
      });
    } catch (e) { /* silent */ }
  }

  res.status(201).json({
    ok: true,
    data: ser({
      ...pedido,
      _id: r.insertedId,
      pedido_id: String(r.insertedId),
      total_unidades: items.reduce((s, x) => s + x.cantidad, 0),
    }),
    puntos_ganados: puntos,
    mensaje: 'Pedido registrado correctamente. Pendiente de revisión.',
  });
}));

// ================================================================
// POST /api/v1/pedidos/:id/cancelar
// ================================================================
router.post('/:id/cancelar', ah(async (req, res) => {
  const p = await col('pedidos').findOne({
    ...idFilter(req.params.id),
    usuario_id: req.userId,
  });
  if (!p) return res.status(404).json({ ok: false, error: 'Pedido no encontrado' });
  if (!['pendiente', 'procesando'].includes(p.estado))
    return res.status(409).json({ ok: false, error: 'Este pedido ya no se puede cancelar' });
  await col('pedidos').updateOne(
    { _id: p._id },
    {
      $set: { estado: 'cancelado' },
      $push: { historial_estados: { estado: 'cancelado', fecha: new Date() } },
    }
  );
  await restaurarStock(p.items);
  if (p.metodo_pago === 'monedero' && p.pagado) {
    await col('monederos').updateOne(
      { usuario_id: req.userId },
      { $inc: { saldo: p.total } }
    );
    await col('monedero_movimientos').insertOne({
      usuario_id: req.userId,
      tipo: 'reembolso',
      monto: p.total,
      concepto: 'Reembolso de ' + p.numero_pedido,
      fecha: new Date(),
    });
  }
  res.json({ ok: true, message: 'Pedido cancelado' });
}));

// ================================================================
// POST /api/v1/pedidos/:id/confirmar
// ================================================================
router.post('/:id/confirmar', ah(async (req, res) => {
  const p = await col('pedidos').findOne({
    ...idFilter(req.params.id),
    usuario_id: req.userId,
  });
  if (!p) return res.status(404).json({ ok: false, error: 'Pedido no encontrado' });
  if (p.estado !== 'enviado')
    return res.status(409).json({ ok: false, error: 'Solo puedes confirmar pedidos enviados' });
  await col('pedidos').updateOne(
    { _id: p._id },
    {
      $set: { estado: 'entregado' },
      $push: { historial_estados: { estado: 'entregado', fecha: new Date() } },
    }
  );
  res.json({ ok: true });
}));

// ================================================================
// POST /api/v1/pedidos/:id/recoger
// ================================================================
router.post('/:id/recoger', ah(async (req, res) => {
  const p = await col('pedidos').findOne({
    ...idFilter(req.params.id),
    usuario_id: req.userId,
  });
  if (!p) return res.status(404).json({ ok: false, error: 'Pedido no encontrado' });
  if (['cancelado', 'entregado'].includes(p.estado))
    return res.status(409).json({ ok: false, error: 'Este pedido ya no admite código de recogida' });

  const ahora = new Date();
  let cr = p.codigo_recogida;
  if (!cr || cr.usado || new Date(cr.expira) < ahora) {
    const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    cr = {
      codigo: Array.from({ length: 6 }, () => A[crypto.randomInt(A.length)]).join(''),
      generado: ahora,
      expira: new Date(ahora.getTime() + num(process.env.RECOGIDA_HORAS, 72) * 3600e3),
      usado: false,
    };
    await col('pedidos').updateOne({ _id: p._id }, { $set: { codigo_recogida: cr } });
  }
  res.json({
    ok: true,
    data: ser({ numero_pedido: p.numero_pedido, codigo: cr.codigo, expira: cr.expira }),
  });
}));

module.exports = router;
module.exports.restaurarStock = restaurarStock;