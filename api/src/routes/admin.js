// routes/admin.js
const router = require('express').Router();
const { col } = require('../config/db');
const { admin } = require('../middleware/auth');
const {
  ah, idFilter, ser, publicUser, esc, num, round2, clean, pick, paginate, meta,
  normalizarGenero,   // ⭐ ya lo exporta helpers.js — usamos el mismo para no duplicar
} = require('../utils/helpers');
const { restaurarStock } = require('./pedidos');

router.use(...admin);

// ============================================================
// ⭐ NORMALIZACIÓN DE DIRECCIONES
// El móvil guarda numero_exterior / codigo_postal, pero el
// panel admin y Flask leen numero / cp. Expandimos ambos alias
// para que TODO el ecosistema vea los mismos campos.
// ============================================================
const expandDir = (d = {}) => ({
  ...d,
  numero: d.numero_exterior ?? d.numero ?? '',
  numero_exterior: d.numero_exterior ?? d.numero ?? '',
  cp: d.codigo_postal ?? d.cp ?? '',
  codigo_postal: d.codigo_postal ?? d.cp ?? '',
});

// ============================================================
// ⭐ EXPAND USER
// publicUser() (helpers.js) ya normaliza y espeja género,
// garantiza direcciones/complexion/intereses y serializa.
// Aquí SOLO expandimos las direcciones para compatibilidad
// total con el panel web y el móvil viejo.
// ============================================================
const expandUser = (u) => {
  if (!u) return u;
  const base = publicUser(u);
  const dirs = Array.isArray(base.direcciones) ? base.direcciones.map(expandDir) : [];
  return {
    ...base,
    direcciones: dirs,
    // por si helpers.js no lo hizo (no debería, pero defensivo)
    genero: base.genero || normalizarGenero(u.genero ?? u.sexo),
    sexo:   base.sexo   || normalizarGenero(u.genero ?? u.sexo),
  };
};

// ---------- Fábrica CRUD genérica ----------
function crud(ruta, coleccion, { buscar = ['nombre'], sort = { _id: -1 } } = {}) {
  router.get(`/${ruta}`, ah(async (req, res) => {
    const { page, limit, skip } = paginate(req.query);
    const f = {};
    if (req.query.q) f.$or = buscar.map((k) => ({ [k]: { $regex: esc(req.query.q), $options: 'i' } }));
    if (req.query.estado) f.estado = req.query.estado;
    if (req.query.activo !== undefined) f.activo = req.query.activo === 'true';
    const cursor = col(coleccion).find(f).sort(sort).skip(skip);
    const [items, total] = await Promise.all([
      (limit > 0 ? cursor.limit(limit) : cursor).toArray(),
      col(coleccion).countDocuments(f),
    ]);
    res.json({ ok: true, data: ser(items), meta: meta(page, limit, total) });
  }));
  router.get(`/${ruta}/:id`, ah(async (req, res) => {
    const d = await col(coleccion).findOne(idFilter(req.params.id));
    if (!d) return res.status(404).json({ ok: false, error: 'No encontrado' });
    res.json({ ok: true, data: ser(d) });
  }));
  router.post(`/${ruta}`, ah(async (req, res) => {
    const d = { activo: true, ...clean(req.body || {}), fecha_creacion: new Date() };
    const r = await col(coleccion).insertOne(d);
    res.status(201).json({ ok: true, data: ser({ ...d, _id: r.insertedId }) });
  }));
  router.put(`/${ruta}/:id`, ah(async (req, res) => {
    const r = await col(coleccion).updateOne(
      idFilter(req.params.id),
      { $set: { ...clean(req.body || {}), fecha_actualizacion: new Date() } }
    );
    res.status(r.matchedCount ? 200 : 404).json({ ok: r.matchedCount > 0 });
  }));
  router.post(`/${ruta}/:id/toggle`, ah(async (req, res) => {
    const d = await col(coleccion).findOne(idFilter(req.params.id));
    if (!d) return res.status(404).json({ ok: false });
    await col(coleccion).updateOne({ _id: d._id }, { $set: { activo: d.activo === false } });
    res.json({ ok: true, activo: d.activo === false });
  }));
  router.delete(`/${ruta}/:id`, ah(async (req, res) => {
    const r = await col(coleccion).deleteOne(idFilter(req.params.id));
    res.json({ ok: r.deletedCount > 0 });
  }));
}
crud('categorias', 'categorias', { sort: { orden: 1, nombre: 1 } });
crud('atributos', 'atributos');
crud('cupones', 'cupones', { buscar: ['codigo', 'descripcion'] });
crud('promociones', 'promociones', { buscar: ['nombre', 'codigo'] });
crud('combos', 'combos');
crud('temporadas', 'temporadas');
crud('marcas', 'marcas');
crud('productos', 'productos', { buscar: ['nombre', 'sku', 'marca'] });

router.post('/productos/:id/baja', ah(async (req, res) => {
  const r = await col('productos').updateOne(idFilter(req.params.id), { $set: { activo: false, estado: 'baja' } });
  res.json({ ok: r.matchedCount > 0 });
}));
router.post('/marcas/:id/aprobar', ah(async (req, res) => { await col('marcas').updateOne(idFilter(req.params.id), { $set: { estado: 'aprobada', activo: true } }); res.json({ ok: true }); }));
router.post('/marcas/:id/negar', ah(async (req, res) => { await col('marcas').updateOne(idFilter(req.params.id), { $set: { estado: 'rechazada', motivo: req.body?.motivo || '' } }); res.json({ ok: true }); }));

// ---------- Dashboard ----------
router.get('/dashboard', ah(async (_req, res) => {
  const hace30 = new Date(Date.now() - 30 * 864e5);
  const [usuarios, productos, pedidos, porEstado, ventas, serie, top, bajoStock] = await Promise.all([
    col('usuarios').countDocuments({ rol: 'cliente' }), col('productos').countDocuments({}), col('pedidos').countDocuments({}),
    col('pedidos').aggregate([{ $group: { _id: '$estado', total: { $sum: 1 } } }]).toArray(),
    col('pedidos').aggregate([{ $match: { estado: { $ne: 'cancelado' } } }, { $group: { _id: null, total: { $sum: '$total' } } }]).toArray(),
    col('pedidos').aggregate([{ $match: { fecha: { $gte: hace30 }, estado: { $ne: 'cancelado' } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$fecha' } }, ventas: { $sum: '$total' }, pedidos: { $sum: 1 } } }, { $sort: { _id: 1 } }]).toArray(),
    col('productos').find({}).sort({ vendidos: -1 }).limit(5).project({ nombre: 1, vendidos: 1, precio: 1 }).toArray(),
    col('productos').find({ stock: { $lte: 5, $ne: null } }).limit(10).project({ nombre: 1, stock: 1 }).toArray()
  ]);
  res.json({ ok: true, data: ser({ usuarios, productos, pedidos, ventas_totales: round2(ventas[0]?.total || 0),
    pedidos_por_estado: Object.fromEntries(porEstado.map((e) => [e._id || 'sin_estado', e.total])), ventas_30_dias: serie.map((s) => ({ fecha: s._id, ventas: round2(s.ventas), pedidos: s.pedidos })),
    top_productos: top, bajo_stock: bajoStock }) });
}));

// ---------- Usuarios ----------
router.get('/usuarios', ah(async (req, res) => {
  const { page, limit, skip } = paginate(req.query);
  const f = {};
  if (req.query.rol) f.rol = req.query.rol;
  if (req.query.q) f.$or = ['nombre', 'apellido', 'apellido_paterno', 'email'].map((k) => ({ [k]: { $regex: esc(req.query.q), $options: 'i' } }));
  const cursor = col('usuarios').find(f).sort({ _id: -1 }).skip(skip);
  const [items, total] = await Promise.all([
    (limit > 0 ? cursor.limit(limit) : cursor).toArray(),
    col('usuarios').countDocuments(f),
  ]);
  // ⭐ expandUser → incluye genero + sexo normalizados, direcciones expandidas,
  //   complexion, intereses, preferencias_* (garantizadas por helpers.publicUser)
  res.json({ ok: true, data: items.map(expandUser), meta: meta(page, limit, total) });
}));

router.get('/usuarios/:id', ah(async (req, res) => {
  const u = await col('usuarios').findOne(idFilter(req.params.id));
  if (!u) return res.status(404).json({ ok: false, error: 'Usuario no encontrado' });
  const id = String(u._id);
  const [pedidos, monedero] = await Promise.all([
    col('pedidos').find({ usuario_id: id }).sort({ fecha: -1 }).limit(20).toArray(),
    col('monederos').findOne({ usuario_id: id }),
  ]);
  res.json({
    ok: true,
    data: {
      usuario: expandUser(u),
      pedidos: ser(pedidos),
      monedero: ser(monedero),
    },
  });
}));

// ============================================================
// ⭐⭐ PUT /usuarios/:id — CORREGIDO
// Acepta TODOS los campos que el móvil y el panel web necesitan:
//   - datos básicos (nombre, apellidos, email, telefono, fecha_nacimiento)
//   - género normalizado + espejo (genero ↔ sexo)
//   - activo
//   - password (opcional, si viene)
//   - direcciones (opcional, reemplaza el array completo)
//   - complexion (opcional, reemplaza el objeto)
//   - intereses (opcional, reemplaza el objeto)
//   - preferencias_comunicacion / preferencias_idioma (opcionales)
// ============================================================
router.put('/usuarios/:id', ah(async (req, res) => {
  const body = req.body || {};

  // 1) Whitelist de campos básicos
  const update = pick(body, [
    'nombre',
    'apellido',
    'apellido_paterno',
    'apellido_materno',
    'telefono',
    'email',
    'fecha_nacimiento',
  ]);

  // 2) ⭐ Género: aceptar `genero` o `sexo`, normalizar y espejar
  const generoRaw = body.genero ?? body.sexo;
  if (generoRaw !== undefined && generoRaw !== null && generoRaw !== '') {
    const g = normalizarGenero(generoRaw);
    update.genero = g;   // app móvil / Express
    update.sexo   = g;   // panel web Flask
  }

  // 3) Activo: respetar boolean o string "true"/"false"
  if (body.activo !== undefined) {
    update.activo = body.activo === true || body.activo === 'true';
  }

  // 4) ⭐ Password: si viene, hashearlo (nunca guardar en claro)
  if (body.password !== undefined && body.password !== null && String(body.password).trim() !== '') {
    const pwd = String(body.password);
    if (pwd.length < 6) {
      return res.status(400).json({ ok: false, error: 'La contraseña debe tener al menos 6 caracteres' });
    }
    // Nota: aquí asumimos que tienes un módulo `pw` con `hash`.
    // Si tu proyecto usa otro, cámbialo por el import correcto.
    const pw = require('../utils/password');
    update.password = await pw.hash(pwd);
  }

  // 5) ⭐ Sub-documentos opcionales (solo si vienen en el body)
  if (Array.isArray(body.direcciones)) {
    // Normalizamos cada dirección para que guarde AMBOS alias
    // (numero + numero_exterior, cp + codigo_postal)
    update.direcciones = body.direcciones.map((d = {}) => ({
      ...d,
      numero: d.numero ?? d.numero_exterior ?? '',
      numero_exterior: d.numero_exterior ?? d.numero ?? '',
      cp: String(d.cp ?? d.codigo_postal ?? '').replace(/\D/g, ''),
      codigo_postal: String(d.codigo_postal ?? d.cp ?? '').replace(/\D/g, ''),
    }));
  }
  if (body.complexion && typeof body.complexion === 'object') {
    update.complexion = body.complexion;
  }
  if (body.intereses && typeof body.intereses === 'object') {
    update.intereses = body.intereses;
  }
  if (body.preferencias_comunicacion && typeof body.preferencias_comunicacion === 'object') {
    update.preferencias_comunicacion = body.preferencias_comunicacion;
  }
  if (body.preferencias_idioma && typeof body.preferencias_idioma === 'object') {
    update.preferencias_idioma = body.preferencias_idioma;
  }

  // 6) Timestamps de auditoría
  update.updated_at = new Date();
  update.fecha_actualizacion = new Date();

  if (Object.keys(update).length <= 2) {  // solo timestamps
    return res.status(400).json({ ok: false, error: 'Nada que actualizar' });
  }

  const r = await col('usuarios').updateOne(idFilter(req.params.id), { $set: update });

  if (!r.matchedCount) {
    return res.status(404).json({ ok: false, error: 'Usuario no encontrado' });
  }

  // 7) ⭐ Devolver el usuario actualizado (con género normalizado y todo expandido)
  const fresh = await col('usuarios').findOne(idFilter(req.params.id));
  res.json({ ok: true, data: expandUser(fresh), usuario: expandUser(fresh) });
}));

router.post('/usuarios/:id/rol', ah(async (req, res) => {
  if (!['cliente', 'vendedor', 'admin'].includes(req.body?.rol)) return res.status(400).json({ ok: false, error: 'Rol inválido' });
  if (String(req.user._id) === req.params.id) return res.status(400).json({ ok: false, error: 'No puedes cambiar tu propio rol' });
  await col('usuarios').updateOne(idFilter(req.params.id), { $set: { rol: req.body.rol, updated_at: new Date() } });
  res.json({ ok: true });
}));
router.post('/usuarios/:id/toggle', ah(async (req, res) => {
  if (String(req.user._id) === req.params.id) return res.status(400).json({ ok: false, error: 'No puedes desactivarte a ti mismo' });
  const u = await col('usuarios').findOne(idFilter(req.params.id));
  if (!u) return res.status(404).json({ ok: false });
  await col('usuarios').updateOne({ _id: u._id }, { $set: { activo: u.activo === false, updated_at: new Date() } });
  res.json({ ok: true, activo: u.activo === false });
}));
router.delete('/usuarios/:id', ah(async (req, res) => {
  if (String(req.user._id) === req.params.id) return res.status(400).json({ ok: false, error: 'No puedes eliminarte a ti mismo' });
  const r = await col('usuarios').deleteOne(idFilter(req.params.id));
  res.json({ ok: r.deletedCount > 0 });
}));

// ---------- Pedidos ----------
const ESTADOS = ['pendiente', 'procesando', 'enviado', 'entregado', 'cancelado'];
router.get('/pedidos', ah(async (req, res) => {
  const { page, limit, skip } = paginate(req.query);
  const f = {};
  if (req.query.estado) f.estado = req.query.estado;
  if (req.query.q) f.numero_pedido = { $regex: esc(req.query.q), $options: 'i' };
  const cursor = col('pedidos').find(f).sort({ fecha: -1 }).skip(skip);
  const [items, total] = await Promise.all([
    (limit > 0 ? cursor.limit(limit) : cursor).toArray(),
    col('pedidos').countDocuments(f),
  ]);
  res.json({ ok: true, data: ser(items), meta: meta(page, limit, total) });
}));
router.get('/pedidos/:id', ah(async (req, res) => {
  const p = await col('pedidos').findOne({ $or: [idFilter(req.params.id), { numero_pedido: req.params.id }] });
  if (!p) return res.status(404).json({ ok: false, error: 'Pedido no encontrado' });
  res.json({ ok: true, data: ser(p) });
}));
router.post('/pedidos/:id/estado', ah(async (req, res) => {
  const { estado, guia } = req.body || {};
  if (!ESTADOS.includes(estado)) return res.status(400).json({ ok: false, error: `Estado válido: ${ESTADOS.join(', ')}` });
  const p = await col('pedidos').findOne(idFilter(req.params.id));
  if (!p) return res.status(404).json({ ok: false });
  if (estado === 'cancelado' && p.estado !== 'cancelado') await restaurarStock(p.items);
  await col('pedidos').updateOne(
    { _id: p._id },
    { $set: { estado, ...(guia ? { guia } : {}) }, $push: { historial_estados: { estado, fecha: new Date(), por: String(req.user._id) } } }
  );
  res.json({ ok: true });
}));

// Entrega en tienda: valida el código de recogida y marca el pedido como entregado
router.post('/pedidos/recogida/verificar', ah(async (req, res) => {
  const codigo = String(req.body?.codigo || '').trim().toUpperCase();
  if (!codigo) return res.status(400).json({ ok: false, error: 'codigo es obligatorio' });
  const f = { 'codigo_recogida.codigo': codigo, 'codigo_recogida.usado': false, estado: { $nin: ['cancelado', 'entregado'] } };
  if (req.body?.numero_pedido) f.numero_pedido = req.body.numero_pedido;
  const p = await col('pedidos').findOne(f);
  if (!p || new Date(p.codigo_recogida.expira) < new Date()) return res.status(404).json({ ok: false, error: 'Código inválido, usado o vencido' });
  await col('pedidos').updateOne(
    { _id: p._id },
    {
      $set: { estado: 'entregado', 'codigo_recogida.usado': true, 'codigo_recogida.usado_en': new Date() },
      $push: { historial_estados: { estado: 'entregado', fecha: new Date(), por: String(req.user._id), via: 'recogida' } },
    }
  );
  res.json({ ok: true, data: ser({ numero_pedido: p.numero_pedido, total: p.total, items: p.items }) });
}));

// ---------- Reseñas ----------
router.get('/resenas', ah(async (req, res) => {
  const f = req.query.estado ? { estado: req.query.estado } : {};
  res.json({ ok: true, data: ser(await col('resenas').find(f).sort({ fecha: -1 }).limit(200).toArray()) });
}));
router.post('/resenas/:id/aprobar', ah(async (req, res) => { await col('resenas').updateOne(idFilter(req.params.id), { $set: { estado: 'aprobada' } }); res.json({ ok: true }); }));
router.post('/resenas/:id/rechazar', ah(async (req, res) => { await col('resenas').updateOne(idFilter(req.params.id), { $set: { estado: 'rechazada' } }); res.json({ ok: true }); }));
router.post('/resenas/:id/responder', ah(async (req, res) => {
  await col('resenas').updateOne(idFilter(req.params.id), { $set: { respuesta: { texto: String(req.body?.texto || '').slice(0, 1000), fecha: new Date() } } });
  res.json({ ok: true });
}));
router.delete('/resenas/:id', ah(async (req, res) => { const r = await col('resenas').deleteOne(idFilter(req.params.id)); res.json({ ok: r.deletedCount > 0 }); }));

// ---------- Marketplace ----------
router.get('/marketplace/vendedores', ah(async (req, res) => {
  const f = req.query.estado ? { estado: req.query.estado } : {};
  res.json({ ok: true, data: ser(await col('vendedores').find(f).sort({ _id: -1 }).toArray()) });
}));
router.get('/marketplace/vendedores/:id', ah(async (req, res) => {
  const v = await col('vendedores').findOne(idFilter(req.params.id));
  if (!v) return res.status(404).json({ ok: false });
  const uid = v.user_id || v.usuario_id;
  res.json({ ok: true, data: ser(v), productos: await col('productos').countDocuments({ vendedor_id: uid }) });
}));
router.post('/marketplace/vendedores/:id/estado', ah(async (req, res) => {
  const { estado, motivo = '' } = req.body || {};
  if (!['aprobado', 'rechazado', 'pendiente', 'suspendido'].includes(estado)) return res.status(400).json({ ok: false, error: 'Estado inválido' });
  const v = await col('vendedores').findOne(idFilter(req.params.id));
  if (!v) return res.status(404).json({ ok: false });
  await col('vendedores').updateOne({ _id: v._id }, { $set: { estado, motivo } });
  const uid = v.user_id || v.usuario_id;
  if (estado === 'aprobado') await col('usuarios').updateOne({ ...idFilter(uid), rol: { $ne: 'admin' } }, { $set: { rol: 'vendedor' } });
  if (['rechazado', 'suspendido'].includes(estado)) await col('usuarios').updateOne({ ...idFilter(uid), rol: 'vendedor' }, { $set: { rol: 'cliente' } });
  res.json({ ok: true });
}));
router.post('/marketplace/vendedores/:id/comision', ah(async (req, res) => {
  const c = num(req.body?.comision, -1);
  if (c < 0 || c > 100) return res.status(400).json({ ok: false, error: 'Comisión entre 0 y 100' });
  await col('vendedores').updateOne(idFilter(req.params.id), { $set: { comision: c } });
  res.json({ ok: true });
}));
router.delete('/marketplace/vendedores/:id', ah(async (req, res) => { const r = await col('vendedores').deleteOne(idFilter(req.params.id)); res.json({ ok: r.deletedCount > 0 }); }));

// ---------- Monedero ----------
router.get('/monedero/stats', ah(async (_req, res) => {
  const [t] = await col('monederos').aggregate([{ $group: { _id: null, saldo_total: { $sum: '$saldo' }, cuentas: { $sum: 1 } } }]).toArray();
  res.json({ ok: true, data: { saldo_total: round2(t?.saldo_total || 0), cuentas: t?.cuentas || 0 } });
}));
router.get('/monedero/top', ah(async (_req, res) => res.json({ ok: true, data: ser(await col('monederos').find({}).sort({ saldo: -1 }).limit(10).toArray()) })));
router.post('/monedero/:usuarioId/ajustar', ah(async (req, res) => {
  const monto = round2(num(req.body?.monto));
  if (!monto) return res.status(400).json({ ok: false, error: 'Monto inválido' });
  const f = monto < 0 ? { usuario_id: req.params.usuarioId, saldo: { $gte: -monto } } : { usuario_id: req.params.usuarioId };
  const r = await col('monederos').updateOne(f, { $inc: { saldo: monto }, $setOnInsert: { activo: true, creado: new Date() } }, { upsert: monto > 0 });
  if (!r.matchedCount && !r.upsertedCount) return res.status(409).json({ ok: false, error: 'Saldo insuficiente' });
  await col('monedero_movimientos').insertOne({ usuario_id: req.params.usuarioId, tipo: 'ajuste_admin', monto, concepto: req.body?.motivo || 'Ajuste administrativo', por: String(req.user._id), fecha: new Date() });
  res.json({ ok: true });
}));
router.post('/monedero/:usuarioId/toggle', ah(async (req, res) => {
  const m = await col('monederos').findOne({ usuario_id: req.params.usuarioId });
  if (!m) return res.status(404).json({ ok: false });
  await col('monederos').updateOne({ _id: m._id }, { $set: { activo: m.activo === false } });
  res.json({ ok: true, activo: m.activo === false });
}));

// ---------- Lealtad ----------
router.post('/lealtad/ajustar-puntos', ah(async (req, res) => {
  const puntos = Math.floor(num(req.body?.puntos));
  if (!puntos || !req.body?.usuario_id) return res.status(400).json({ ok: false, error: 'usuario_id y puntos son obligatorios' });
  await col('usuarios').updateOne(idFilter(req.body.usuario_id), { $inc: { puntos_lealtad: puntos } });
  await col('puntos_movimientos').insertOne({ usuario_id: String(req.body.usuario_id), puntos, tipo: 'ajuste_admin', fecha: new Date() });
  res.json({ ok: true });
}));

// ---------- Contactos / newsletter ----------
router.get('/contactos', ah(async (_req, res) => res.json({ ok: true, data: ser(await col('contactos').find({}).sort({ fecha: -1 }).limit(100).toArray()) })));
router.get('/newsletter', ah(async (_req, res) => res.json({ ok: true, data: ser(await col('newsletter').find({ activo: true }).toArray()) })));

module.exports = router;