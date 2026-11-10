// src/routes/temporadas.js
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

const parseFecha = (v) => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

const serialize = (t) => ({
  id: String(t._id),
  nombre: t.nombre || '',
  descripcion: t.descripcion || '',
  imagen: t.imagen || '',
  color: t.color || '#7C3AED',
  destacada: !!t.destacada,
  fecha_inicio: t.fecha_inicio ? new Date(t.fecha_inicio).toISOString() : null,
  fecha_fin: t.fecha_fin ? new Date(t.fecha_fin).toISOString() : null,
  activa: t.activa !== false,
  productosCount: Number(t.productosCount || 0),
  createdAt: t.created_at || t.createdAt || null,
  updatedAt: t.updated_at || t.updatedAt || null,
});

// ================================================================
// PUBLIC ROUTER — /api/v1/temporadas
// ================================================================

// GET /api/v1/temporadas
publicRouter.get('/', ah(async (req, res) => {
  const { activa, incluir_inactivas, destacada } = req.query;
  const filtro = {};

  if (incluir_inactivas !== 'true') filtro.activa = { $ne: false };
  if (activa === 'true') filtro.activa = true;
  if (activa === 'false') filtro.activa = false;
  if (destacada === 'true') filtro.destacada = true;

  const lista = await col('temporadas')
    .find(filtro)
    .sort({ fecha_inicio: -1, nombre: 1 })
    .toArray();

  const conConteo = await Promise.all(
    lista.map(async (t) => {
      const productosCount = await col('productos').countDocuments({
        temporada_id: String(t._id),
      });
      return { ...t, productosCount };
    })
  );

  res.json({
    ok: true,
    data: conConteo.map(serialize),
    meta: { total: lista.length },
  });
}));

// GET /api/v1/temporadas/activa
publicRouter.get('/activa', ah(async (_req, res) => {
  const hoy = new Date();
  const t = await col('temporadas').findOne({
    activa: true,
    fecha_inicio: { $lte: hoy },
    fecha_fin: { $gte: hoy },
  });
  if (!t) return res.status(404).json({ ok: false, error: 'No hay temporada activa' });
  res.json({ ok: true, data: serialize(t) });
}));

// GET /api/v1/temporadas/:id
publicRouter.get('/:id', ah(async (req, res) => {
  const filtro = safeIdFilter(req.params.id);
  if (!filtro) return res.status(400).json({ ok: false, error: 'ID inválido' });

  const t = await col('temporadas').findOne(filtro);
  if (!t) return res.status(404).json({ ok: false, error: 'Temporada no encontrada' });

  const productosCount = await col('productos').countDocuments({ temporada_id: String(t._id) });
  res.json({ ok: true, data: serialize({ ...t, productosCount }) });
}));

// ================================================================
// ADMIN ROUTER — /api/v1/admin/temporadas
// ================================================================

// POST /api/v1/admin/temporadas
adminRouter.post('/', auth, requireRole('admin'), ah(async (req, res) => {
  const {
    nombre,
    descripcion = '',
    imagen = '',
    color = '#7C3AED',
    destacada = false,
    fecha_inicio,
    fecha_fin,
    activa = true,
  } = req.body || {};

  if (!nombre || !String(nombre).trim()) {
    return res.status(400).json({ ok: false, error: 'El nombre es obligatorio' });
  }

  const fi = parseFecha(fecha_inicio);
  const ff = parseFecha(fecha_fin);

  if (!fi || !ff) {
    return res.status(400).json({ ok: false, error: 'Fechas inválidas' });
  }
  if (fi > ff) {
    return res.status(400).json({
      ok: false,
      error: 'La fecha de inicio no puede ser mayor que la de fin',
    });
  }

  const nombreLimpio = String(nombre).trim();
  const dup = await col('temporadas').findOne({
    nombre: {
      $regex: `^${nombreLimpio.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
      $options: 'i',
    },
  });
  if (dup) {
    return res.status(400).json({ ok: false, error: `Ya existe una temporada "${nombreLimpio}"` });
  }

  const doc = {
    nombre: nombreLimpio,
    descripcion: String(descripcion || '').trim(),
    imagen: String(imagen || '').trim(),
    color: String(color || '#7C3AED').trim(),
    destacada: !!destacada,
    fecha_inicio: fi,
    fecha_fin: ff,
    activa: !!activa,
    created_at: new Date(),
    updated_at: new Date(),
  };

  const r = await col('temporadas').insertOne(doc);
  res.status(201).json({ ok: true, data: serialize({ ...doc, _id: r.insertedId }) });
}));

// PUT /api/v1/admin/temporadas/:id
adminRouter.put('/:id', auth, requireRole('admin'), ah(async (req, res) => {
  const filtro = safeIdFilter(req.params.id);
  if (!filtro) return res.status(400).json({ ok: false, error: 'ID inválido' });

  const t = await col('temporadas').findOne(filtro);
  if (!t) return res.status(404).json({ ok: false, error: 'Temporada no encontrada' });

  const {
    nombre, descripcion, imagen, color, destacada,
    fecha_inicio, fecha_fin, activa,
  } = req.body || {};

  const set = { updated_at: new Date() };

  if (nombre !== undefined) {
    const n = String(nombre).trim();
    if (!n) return res.status(400).json({ ok: false, error: 'El nombre no puede estar vacío' });
    set.nombre = n;
  }
  if (descripcion !== undefined) set.descripcion = String(descripcion || '').trim();
  if (imagen !== undefined) set.imagen = String(imagen || '').trim();
  if (color !== undefined) set.color = String(color || '#7C3AED').trim();
  if (destacada !== undefined) set.destacada = !!destacada;
  if (activa !== undefined) set.activa = !!activa;

  let fi = t.fecha_inicio;
  let ff = t.fecha_fin;
  if (fecha_inicio !== undefined) {
    const d = parseFecha(fecha_inicio);
    if (!d) return res.status(400).json({ ok: false, error: 'Fecha de inicio inválida' });
    fi = d;
    set.fecha_inicio = d;
  }
  if (fecha_fin !== undefined) {
    const d = parseFecha(fecha_fin);
    if (!d) return res.status(400).json({ ok: false, error: 'Fecha de fin inválida' });
    ff = d;
    set.fecha_fin = d;
  }

  if (fi > ff) {
    return res.status(400).json({
      ok: false,
      error: 'La fecha de inicio no puede ser mayor que la de fin',
    });
  }

  await col('temporadas').updateOne({ _id: t._id }, { $set: set });
  const actualizada = await col('temporadas').findOne({ _id: t._id });
  res.json({ ok: true, data: serialize(actualizada) });
}));

// DELETE /api/v1/admin/temporadas/:id
adminRouter.delete('/:id', auth, requireRole('admin'), ah(async (req, res) => {
  const filtro = safeIdFilter(req.params.id);
  if (!filtro) return res.status(400).json({ ok: false, error: 'ID inválido' });

  const t = await col('temporadas').findOne(filtro);
  if (!t) return res.status(404).json({ ok: false, error: 'Temporada no encontrada' });

  const productosCount = await col('productos').countDocuments({ temporada_id: String(t._id) });
  if (productosCount > 0) {
    return res.status(400).json({
      ok: false,
      error: `No puedes eliminar "${t.nombre}" porque tiene ${productosCount} producto(s) asociado(s).`,
    });
  }

  await col('temporadas').deleteOne({ _id: t._id });
  res.json({ ok: true, message: `Temporada "${t.nombre}" eliminada` });
}));

module.exports = { publicRouter, adminRouter };