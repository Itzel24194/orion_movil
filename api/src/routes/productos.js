// src/routes/productos.js
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

const normalizeVariante = (v = {}) => ({
  sku: String(v.sku || '').trim(),
  color: String(v.color || '').trim(),
  tamano: String(v.tamano || v.talla || '').trim(),
  precio: Number(v.precio || 0),
  stock: Number(v.stock || 0),
});

const serialize = (p) => {
  const variables = Array.isArray(p.variables)
    ? p.variables.map(normalizeVariante)
    : [];

  const totalStock = variables.reduce((s, v) => s + (Number(v.stock) || 0), 0);

  return {
    id: String(p._id),
    nombre: p.nombre || '',
    descripcion: p.descripcion || '',
    categoria_id: p.categoria_id ? String(p.categoria_id) : null,
    categoria_nombre: p.categoria_nombre || null,
    marca_id: p.marca_id ? String(p.marca_id) : null,
    marca_nombre: p.marca_nombre || null,
    temporada_id: p.temporada_id ? String(p.temporada_id) : null,
    temporada_nombre: p.temporada_nombre || null,
    estado: p.estado === 'inactivo' ? 'inactivo' : 'activo',
    activo: p.activo !== false,
    fotos: Array.isArray(p.fotos) ? p.fotos : [],
    videos: Array.isArray(p.videos) ? p.videos : [],
    variables,
    totalStock,
    variantesCount: variables.length,
    createdAt: p.created_at || p.createdAt || null,
    updatedAt: p.updated_at || p.updatedAt || null,
  };
};

// ================================================================
// PUBLIC ROUTER — /api/v1/productos
// ================================================================

// GET /api/v1/productos?categoria_id=&marca_id=&temporada_id=&estado=&q=
publicRouter.get('/', ah(async (req, res) => {
  const { categoria_id, marca_id, temporada_id, estado, q } = req.query;
  const filtro = {};

  if (categoria_id) filtro.categoria_id = String(categoria_id);
  if (marca_id) filtro.marca_id = String(marca_id);
  if (temporada_id) filtro.temporada_id = String(temporada_id);
  if (estado) filtro.estado = estado;
  if (q) {
    filtro.$or = [
      { nombre: { $regex: q, $options: 'i' } },
      { descripcion: { $regex: q, $options: 'i' } },
    ];
  }

  const lista = await col('productos')
    .find(filtro)
    .sort({ created_at: -1, nombre: 1 })
    .toArray();

  res.json({
    ok: true,
    data: lista.map(serialize),
    meta: { total: lista.length },
  });
}));

// GET /api/v1/productos/:id
publicRouter.get('/:id', ah(async (req, res) => {
  const filtro = safeIdFilter(req.params.id);
  if (!filtro) return res.status(400).json({ ok: false, error: 'ID inválido' });

  const p = await col('productos').findOne(filtro);
  if (!p) return res.status(404).json({ ok: false, error: 'Producto no encontrado' });

  res.json({ ok: true, data: serialize(p) });
}));

// ================================================================
// ADMIN ROUTER — /api/v1/admin/productos
// ================================================================

const payloadFromBody = (body = {}) => {
  const {
    nombre, descripcion,
    categoria_id, marca_id, temporada_id,
    estado, activo,
    fotos, videos,
    variables,
  } = body;

  const out = {};
  if (nombre !== undefined) out.nombre = String(nombre).trim();
  if (descripcion !== undefined) out.descripcion = String(descripcion || '').trim();
  if (categoria_id !== undefined) out.categoria_id = categoria_id ? String(categoria_id) : null;
  if (marca_id !== undefined) out.marca_id = marca_id ? String(marca_id) : null;
  if (temporada_id !== undefined) out.temporada_id = temporada_id ? String(temporada_id) : null;
  if (estado !== undefined) out.estado = estado === 'inactivo' ? 'inactivo' : 'activo';
  if (activo !== undefined) out.activo = !!activo;

  if (Array.isArray(fotos)) out.fotos = fotos.map((f) => String(f || '').trim()).filter(Boolean);
  if (Array.isArray(videos)) out.videos = videos.map((v) => String(v || '').trim()).filter(Boolean);

  if (Array.isArray(variables)) {
    out.variables = variables
      .map(normalizeVariante)
      .filter((v) => v.sku || v.color || v.tamano);
  }

  return out;
};

// POST /api/v1/admin/productos
adminRouter.post('/', auth, requireRole('admin'), ah(async (req, res) => {
  const payload = payloadFromBody(req.body);

  if (!payload.nombre) {
    return res.status(400).json({ ok: false, error: 'El nombre es obligatorio' });
  }
  if (!payload.categoria_id) {
    return res.status(400).json({ ok: false, error: 'La categoría es obligatoria' });
  }
  if (!payload.marca_id) {
    return res.status(400).json({ ok: false, error: 'La marca es obligatoria' });
  }

  // Enriquecer con nombres (para listar sin joins)
  if (payload.categoria_id) {
    const cat = await col('categorias').findOne(safeIdFilter(payload.categoria_id));
    if (cat) payload.categoria_nombre = cat.nombre;
  }
  if (payload.marca_id) {
    const marca = await col('marcas').findOne(safeIdFilter(payload.marca_id));
    if (marca) payload.marca_nombre = marca.nombre_comercial || marca.nombre;
  }
  if (payload.temporada_id) {
    const temp = await col('temporadas').findOne(safeIdFilter(payload.temporada_id));
    if (temp) payload.temporada_nombre = temp.nombre;
  }

  const doc = {
    ...payload,
    activo: payload.activo !== false,
    created_at: new Date(),
    updated_at: new Date(),
  };

  const r = await col('productos').insertOne(doc);
  res.status(201).json({ ok: true, data: serialize({ ...doc, _id: r.insertedId }) });
}));

// PUT /api/v1/admin/productos/:id
adminRouter.put('/:id', auth, requireRole('admin'), ah(async (req, res) => {
  const filtro = safeIdFilter(req.params.id);
  if (!filtro) return res.status(400).json({ ok: false, error: 'ID inválido' });

  const existente = await col('productos').findOne(filtro);
  if (!existente) return res.status(404).json({ ok: false, error: 'Producto no encontrado' });

  const payload = payloadFromBody(req.body);
  payload.updated_at = new Date();

  if (payload.categoria_id) {
    const cat = await col('categorias').findOne(safeIdFilter(payload.categoria_id));
    if (cat) payload.categoria_nombre = cat.nombre;
  }
  if (payload.marca_id) {
    const marca = await col('marcas').findOne(safeIdFilter(payload.marca_id));
    if (marca) payload.marca_nombre = marca.nombre_comercial || marca.nombre;
  }
  if (payload.temporada_id !== undefined) {
    if (payload.temporada_id) {
      const temp = await col('temporadas').findOne(safeIdFilter(payload.temporada_id));
      if (temp) payload.temporada_nombre = temp.nombre;
    } else {
      payload.temporada_nombre = null;
    }
  }

  await col('productos').updateOne({ _id: existente._id }, { $set: payload });
  const actualizado = await col('productos').findOne({ _id: existente._id });
  res.json({ ok: true, data: serialize(actualizado) });
}));

// DELETE /api/v1/admin/productos/:id
adminRouter.delete('/:id', auth, requireRole('admin'), ah(async (req, res) => {
  const filtro = safeIdFilter(req.params.id);
  if (!filtro) return res.status(400).json({ ok: false, error: 'ID inválido' });

  const p = await col('productos').findOne(filtro);
  if (!p) return res.status(404).json({ ok: false, error: 'Producto no encontrado' });

  await col('productos').deleteOne({ _id: p._id });
  res.json({ ok: true, message: `Producto "${p.nombre}" eliminado` });
}));

module.exports = { publicRouter, adminRouter };