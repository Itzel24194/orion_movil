// src/routes/marcas.js
const express = require('express');
const publicRouter = express.Router();
const adminRouter = express.Router();

const { col } = require('../config/db');
const { ah, idFilter } = require('../utils/helpers');
const { auth, requireRole } = require('../middleware/auth');

// ================================================================
// Helpers
// ================================================================
const safeIdFilter = (id) => {
  try { return idFilter(id); } catch { return null; }
};

const STATUS_VALIDOS = ['pendiente', 'activo', 'negado'];

const serialize = (m) => ({
  id: String(m._id),
  nombre_comercial: m.nombre_comercial || m.nombre || '',
  nombre_normalizado: m.nombre_normalizado || '',
  rfc: m.rfc || '',
  correo: m.correo || '',
  telefono: m.telefono || '',
  direccion: m.direccion || '',
  status: STATUS_VALIDOS.includes(m.status) ? m.status : 'pendiente',
  activa: m.activa !== false,
  notas_admin: m.notas_admin || '',
  datos_impi: Array.isArray(m.datos_impi) ? m.datos_impi : [],
  impi_count: Array.isArray(m.datos_impi) ? m.datos_impi.length : 0,
  createdAt: m.created_at || m.createdAt || null,
  updatedAt: m.updated_at || m.updatedAt || null,
});

// ================================================================
// PUBLIC ROUTER
// ================================================================

// DEBUG
publicRouter.get('/_debug', ah(async (_req, res) => {
  const total = await col('marcas').countDocuments();
  const docs = await col('marcas').find({}).limit(3).toArray();
  res.json({
    ok: true,
    coleccion: 'marcas',
    total,
    muestra: docs.map((d) => ({
      _id: String(d._id),
      nombre_comercial: d.nombre_comercial || d.nombre || '(sin nombre)',
      status: d.status,
      activa: d.activa,
    })),
  });
}));

// GET /api/v1/marcas
publicRouter.get('/', ah(async (req, res) => {
  const { activa, status, q } = req.query;
  const filtro = {};

  if (activa === 'true') filtro.activa = true;
  if (activa === 'false') filtro.activa = false;
  if (status && STATUS_VALIDOS.includes(status)) filtro.status = status;
  if (q) {
    filtro.$or = [
      { nombre_comercial: { $regex: q, $options: 'i' } },
      { nombre: { $regex: q, $options: 'i' } },
      { rfc: { $regex: q, $options: 'i' } },
      { correo: { $regex: q, $options: 'i' } },
    ];
  }

  const lista = await col('marcas')
    .find(filtro)
    .sort({ nombre_comercial: 1, nombre: 1 })
    .toArray();

  res.json({
    ok: true,
    data: lista.map(serialize),
    meta: { total: lista.length },
  });
}));

// GET /api/v1/marcas/:id
publicRouter.get('/:id', ah(async (req, res) => {
  const filtro = safeIdFilter(req.params.id);
  if (!filtro) return res.status(400).json({ ok: false, error: 'ID inválido' });

  const m = await col('marcas').findOne(filtro);
  if (!m) return res.status(404).json({ ok: false, error: 'Marca no encontrada' });

  res.json({ ok: true, data: serialize(m) });
}));

// ================================================================
// ADMIN ROUTER
// ================================================================

const payloadFromBody = (body = {}) => {
  const out = {};
  if (body.nombre_comercial !== undefined || body.nombre !== undefined) {
    const nombre = String(body.nombre_comercial ?? body.nombre ?? '').trim();
    out.nombre_comercial = nombre;
    out.nombre = nombre;
    out.nombre_normalizado = nombre.toUpperCase().replace(/\s+/g, '');
  }
  if (body.rfc !== undefined) out.rfc = String(body.rfc || '').toUpperCase().trim();
  if (body.correo !== undefined) out.correo = String(body.correo || '').trim();
  if (body.telefono !== undefined) out.telefono = String(body.telefono || '').trim();
  if (body.direccion !== undefined) out.direccion = String(body.direccion || '').trim();
  if (body.status !== undefined && STATUS_VALIDOS.includes(body.status)) out.status = body.status;
  if (body.activa !== undefined) out.activa = !!body.activa;
  if (body.notas_admin !== undefined) out.notas_admin = String(body.notas_admin || '').trim();
  return out;
};

// POST /api/v1/admin/marcas
adminRouter.post('/', auth, requireRole('admin'), ah(async (req, res) => {
  const payload = payloadFromBody(req.body);
  if (!payload.nombre_comercial) {
    return res.status(400).json({ ok: false, error: 'El nombre comercial es obligatorio' });
  }

  const dup = await col('marcas').findOne({ nombre_normalizado: payload.nombre_normalizado });
  if (dup) {
    return res.status(400).json({ ok: false, error: `Ya existe una marca "${payload.nombre_comercial}"` });
  }

  const doc = {
    ...payload,
    status: payload.status || 'pendiente',
    activa: payload.activa !== false,
    datos_impi: [],
    notas_admin: payload.notas_admin || '',
    created_at: new Date(),
    updated_at: new Date(),
  };

  const r = await col('marcas').insertOne(doc);
  res.status(201).json({ ok: true, data: serialize({ ...doc, _id: r.insertedId }) });
}));

// PUT /api/v1/admin/marcas/:id
adminRouter.put('/:id', auth, requireRole('admin'), ah(async (req, res) => {
  const filtro = safeIdFilter(req.params.id);
  if (!filtro) return res.status(400).json({ ok: false, error: 'ID inválido' });

  const existente = await col('marcas').findOne(filtro);
  if (!existente) return res.status(404).json({ ok: false, error: 'Marca no encontrada' });

  const payload = payloadFromBody(req.body);
  payload.updated_at = new Date();

  if (payload.nombre_normalizado && payload.nombre_normalizado !== existente.nombre_normalizado) {
    const dup = await col('marcas').findOne({
      nombre_normalizado: payload.nombre_normalizado,
      _id: { $ne: existente._id },
    });
    if (dup) {
      return res.status(400).json({ ok: false, error: `Ya existe otra marca "${payload.nombre_comercial}"` });
    }
  }

  await col('marcas').updateOne({ _id: existente._id }, { $set: payload });
  const actualizada = await col('marcas').findOne({ _id: existente._id });
  res.json({ ok: true, data: serialize(actualizada) });
}));

// POST /api/v1/admin/marcas/:id/aprobar
adminRouter.post('/:id/aprobar', auth, requireRole('admin'), ah(async (req, res) => {
  const filtro = safeIdFilter(req.params.id);
  if (!filtro) return res.status(400).json({ ok: false, error: 'ID inválido' });

  const m = await col('marcas').findOne(filtro);
  if (!m) return res.status(404).json({ ok: false, error: 'Marca no encontrada' });

  await col('marcas').updateOne(
    { _id: m._id },
    { $set: { status: 'activo', activa: true, updated_at: new Date() } }
  );
  const actualizada = await col('marcas').findOne({ _id: m._id });
  res.json({ ok: true, data: serialize(actualizada) });
}));

// POST /api/v1/admin/marcas/:id/negar
adminRouter.post('/:id/negar', auth, requireRole('admin'), ah(async (req, res) => {
  const filtro = safeIdFilter(req.params.id);
  if (!filtro) return res.status(400).json({ ok: false, error: 'ID inválido' });

  const m = await col('marcas').findOne(filtro);
  if (!m) return res.status(404).json({ ok: false, error: 'Marca no encontrada' });

  const motivo = String(req.body?.motivo || '').trim() || 'Sin motivo especificado';
  const notaActual = m.notas_admin ? `${m.notas_admin}\n` : '';
  const nuevaNota = `${notaActual}Negada: ${motivo}`;

  await col('marcas').updateOne(
    { _id: m._id },
    { $set: { status: 'negado', activa: false, notas_admin: nuevaNota, updated_at: new Date() } }
  );
  const actualizada = await col('marcas').findOne({ _id: m._id });
  res.json({ ok: true, data: serialize(actualizada) });
}));

// DELETE /api/v1/admin/marcas/:id
adminRouter.delete('/:id', auth, requireRole('admin'), ah(async (req, res) => {
  const filtro = safeIdFilter(req.params.id);
  if (!filtro) return res.status(400).json({ ok: false, error: 'ID inválido' });

  const m = await col('marcas').findOne(filtro);
  if (!m) return res.status(404).json({ ok: false, error: 'Marca no encontrada' });

  const productosCount = await col('productos').countDocuments({
    $or: [{ marca_id: String(m._id) }, { empresa_id: String(m._id) }],
  });
  if (productosCount > 0) {
    return res.status(400).json({
      ok: false,
      error: `No puedes eliminar "${m.nombre_comercial || m.nombre}" porque tiene ${productosCount} producto(s) asociado(s).`,
    });
  }

  await col('marcas').deleteOne({ _id: m._id });
  res.json({ ok: true, message: 'Marca eliminada' });
}));

module.exports = { publicRouter, adminRouter };