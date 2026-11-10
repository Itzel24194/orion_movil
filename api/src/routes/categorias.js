// src/routes/categorias.js
const express = require('express');
const publicRouter = express.Router();
const adminRouter = express.Router();

const { col } = require('../config/db');
const { ah, idFilter } = require('../utils/helpers');
const { auth, requireRole } = require('../middleware/auth');

// ================================================================
// Helpers locales
// ================================================================
const normId = (v) => (v ? String(v) : null);

/** idFilter seguro: devuelve null si el id es inválido en lugar de tirar */
const safeIdFilter = (id) => {
  try {
    return idFilter(id);
  } catch {
    return null;
  }
};

/** Serializa una categoría del shape Mongo → JSON que consume el cliente */
const serialize = (c) => ({
  id: String(c._id),
  nombre: c.nombre,
  nivel: Number(c.nivel || 1),
  padre_id: normId(c.padre_id),
  padre_nombre: c.padre_nombre || null,
  imagen: c.imagen || '',
  icono: c.icono || '',
  color: c.color || '',
  destacada: !!c.destacada,
  orden: Number(c.orden || 0),
  activo: c.activo !== false,
});

/** Construye el árbol jerárquico desde una lista plana */
const buildTree = (lista) => {
  const byId = {};
  const raices = [];

  lista.forEach((c) => {
    byId[String(c._id)] = { ...serialize(c), hijos: [] };
  });

  Object.values(byId).forEach((c) => {
    if (c.padre_id && byId[c.padre_id]) byId[c.padre_id].hijos.push(c);
    else raices.push(c);
  });

  const ordenar = (arr) => {
    arr.sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre));
    arr.forEach((c) => ordenar(c.hijos));
    return arr;
  };
  return ordenar(raices);
};

/** Verifica si `candidato` es descendiente de `raizId` (evita ciclos al reasignar padre) */
const esDescendiente = async (raizId, candidatoId) => {
  let actual = String(candidatoId);
  const visitados = new Set();
  while (actual) {
    if (visitados.has(actual)) return true;
    visitados.add(actual);
    if (actual === String(raizId)) return true;

    const filtro = safeIdFilter(actual);
    if (!filtro) return false;
    const nodo = await col('categorias').findOne(filtro, { projection: { padre_id: 1 } });
    if (!nodo || !nodo.padre_id) return false;
    actual = String(nodo.padre_id);
  }
  return false;
};

/** Altura del subárbol (0 si no tiene hijos) */
async function alturaSubarbol(id) {
  const hijos = await col('categorias')
    .find({ padre_id: String(id) }, { projection: { _id: 1 } })
    .toArray();

  if (hijos.length === 0) return 0;

  let max = 0;
  for (const h of hijos) {
    const sub = await alturaSubarbol(h._id);
    if (sub > max) max = sub;
  }
  return 1 + max;
}

// ================================================================
// PUBLIC ROUTER — se monta en /api/v1/categorias
// ================================================================

// GET /api/v1/categorias
// GET /api/v1/categorias?nivel=1
// GET /api/v1/categorias?padre_id=xxx
// GET /api/v1/categorias?destacada=true
// GET /api/v1/categorias?incluir_inactivos=true
publicRouter.get('/', ah(async (req, res) => {
  const { nivel, padre_id, destacada, incluir_inactivos } = req.query;
  const filtro = {};

  if (incluir_inactivos !== 'true') filtro.activo = { $ne: false };
  if (nivel) filtro.nivel = Number(nivel);
  if (padre_id) filtro.padre_id = String(padre_id);
  if (destacada === 'true') filtro.destacada = true;

  const lista = await col('categorias')
    .find(filtro)
    .sort({ nivel: 1, orden: 1, nombre: 1 })
    .toArray();

  res.json({
    ok: true,
    data: lista.map(serialize),
    meta: { total: lista.length },
  });
}));

// GET /api/v1/categorias/tree
publicRouter.get('/tree', ah(async (req, res) => {
  const { incluir_inactivos } = req.query;
  const filtro = incluir_inactivos === 'true' ? {} : { activo: { $ne: false } };

  const lista = await col('categorias')
    .find(filtro)
    .sort({ nivel: 1, orden: 1, nombre: 1 })
    .toArray();

  const tree = buildTree(lista);
  res.json({ ok: true, data: tree, meta: { total: lista.length } });
}));

// GET /api/v1/categorias/destacadas
publicRouter.get('/destacadas', ah(async (_req, res) => {
  const lista = await col('categorias')
    .find({ activo: { $ne: false }, destacada: true, nivel: 1 })
    .sort({ orden: 1, nombre: 1 })
    .limit(12)
    .toArray();

  res.json({
    ok: true,
    data: lista.map((c) => ({
      id: String(c._id),
      nombre: c.nombre,
      icono: c.icono || '',
      imagen: c.imagen || '',
      color: c.color || '',
      orden: Number(c.orden || 0),
    })),
  });
}));

// GET /api/v1/categorias/stats
publicRouter.get('/stats', ah(async (_req, res) => {
  const c = col('categorias');
  const [total, activas, destacadas, n1, n2, n3] = await Promise.all([
    c.countDocuments({}),
    c.countDocuments({ activo: { $ne: false } }),
    c.countDocuments({ destacada: true }),
    c.countDocuments({ nivel: 1 }),
    c.countDocuments({ nivel: 2 }),
    c.countDocuments({ nivel: 3 }),
  ]);
  res.json({
    ok: true,
    data: { total, activas, destacadas, nivel_1: n1, nivel_2: n2, nivel_3: n3 },
  });
}));

// GET /api/v1/categorias/:id  (con hijos)
publicRouter.get('/:id', ah(async (req, res) => {
  const filtro = safeIdFilter(req.params.id);
  if (!filtro) return res.status(400).json({ ok: false, error: 'ID inválido' });

  const cat = await col('categorias').findOne(filtro);
  if (!cat) return res.status(404).json({ ok: false, error: 'Categoría no encontrada' });

  const hijos = await col('categorias')
    .find({ padre_id: String(cat._id), activo: { $ne: false } })
    .sort({ orden: 1, nombre: 1 })
    .toArray();

  res.json({
    ok: true,
    data: {
      ...serialize(cat),
      hijos: hijos.map((h) => ({
        id: String(h._id),
        nombre: h.nombre,
        nivel: Number(h.nivel || 1),
        imagen: h.imagen || '',
        icono: h.icono || '',
        orden: Number(h.orden || 0),
      })),
    },
  });
}));

// ================================================================
// ADMIN ROUTER — se monta en /api/v1/admin/categorias
// ================================================================

// POST /api/v1/admin/categorias/seed
// Body: { force?: boolean }
adminRouter.post('/seed', auth, requireRole('admin'), ah(async (req, res) => {
  const existentes = await col('categorias').countDocuments();
  if (existentes > 0 && !req.body?.force) {
    return res.status(400).json({
      ok: false,
      error: `Ya hay ${existentes} categorías. Envía { "force": true } para forzar la recarga.`,
    });
  }

  const TREE = {
    "Mujer": {
      "Ropa": ["Blusas", "Vestidos", "Playeras y Tops", "Pantalones", "Jeans", "Faldas", "Chamarras y Abrigos", "Suéteres y Cárdigans", "Sacos y Blazers", "Shorts", "Conjuntos"],
      "Calzado": ["Tenis", "Sandalias", "Botas", "Tacones", "Flats", "Mocasines"],
      "Bolsos y Carteras": ["Bolsos", "Carteras", "Mochilas", "Clutches"],
      "Joyería y Relojes": ["Anillos", "Collares", "Aretes", "Pulseras", "Relojes"],
      "Belleza": ["Maquillaje", "Cuidado de la piel", "Fragancias", "Cuidado del cabello"],
      "Accesorios": ["Cinturones", "Lentes", "Sombreros", "Bufandas"],
    },
    "Hombre": {
      "Ropa": ["Camisas", "Playeras", "Pantalones", "Jeans", "Sacos y Blazers", "Chamarras", "Suéteres", "Shorts"],
      "Calzado": ["Tenis", "Zapatos casuales", "Zapatos formales", "Botas", "Sandalias"],
      "Accesorios": ["Cinturones", "Carteras", "Mochilas", "Lentes", "Corbatas"],
      "Relojes": ["Casuales", "Deportivos", "Formales"],
      "Belleza": ["Fragancias", "Cuidado personal"],
    },
    "Niños": {
      "Niña": ["Ropa", "Calzado", "Accesorios"],
      "Niño": ["Ropa", "Calzado", "Accesorios"],
      "Bebé": ["Ropa", "Calzado", "Accesorios"],
    },
    "Electrónica": {
      "TV y Video": ["Smart TV", "Barras de sonido", "Proyectores"],
      "Audio": ["Bocinas", "Audífonos", "Equipos de sonido"],
      "Computación": ["Laptops", "Tablets", "Monitores", "Accesorios"],
      "Celulares": ["Smartphones", "Fundas", "Cargadores"],
      "Videojuegos": ["Consolas", "Juegos", "Accesorios"],
    },
    "Hogar": {
      "Muebles": ["Salas", "Recámaras", "Comedores", "Oficina"],
      "Blancos": ["Sábanas", "Cobijas", "Toallas", "Almohadas"],
      "Cocina": ["Ollas", "Vajillas", "Utensilios", "Electrodomésticos"],
      "Decoración": ["Cuadros", "Lámparas", "Alfombras", "Espejos"],
      "Baño": ["Accesorios", "Toallas", "Organizadores"],
    },
    "Deportes": {
      "Ropa deportiva": ["Playeras", "Shorts", "Pants", "Sudaderas"],
      "Calzado deportivo": ["Running", "Training", "Fútbol", "Basketball"],
      "Equipo": ["Balones", "Pesas", "Yoga"],
      "Accesorios": ["Botellas", "Mochilas", "Bandas"],
    },
    "Belleza": {
      "Maquillaje": ["Rostro", "Ojos", "Labios", "Uñas"],
      "Cuidado de la piel": ["Limpieza", "Hidratación", "Protección solar", "Tratamientos"],
      "Fragancias": ["Perfumes mujer", "Perfumes hombre", "Unisex"],
      "Cabello": ["Shampoo", "Acondicionador", "Tratamientos", "Styling"],
    },
    "Juguetes": {
      "Niñas": [], "Niños": [], "Educativos": [], "Juegos de mesa": [], "Aire libre": [],
    },
  };

  const COLORES = {
    Mujer: "#e10098", Hombre: "#2563eb", Niños: "#f59e0b",
    Electrónica: "#0ea5e9", Hogar: "#10b981", Deportes: "#ef4444",
    Belleza: "#a855f7", Juguetes: "#f97316",
  };

  // Íconos válidos de Feather en el frontend
  const ICONOS = {
    Mujer: "user", Hombre: "users", Niños: "smile",
    Electrónica: "smartphone", Hogar: "home",
    Deportes: "activity", Belleza: "star", Juguetes: "box",
  };

  if (req.body?.force) {
    await col('categorias').deleteMany({});
  }

  let insertados = 0;
  const idsN1 = {};

  // Nivel 1
  for (const nombre of Object.keys(TREE)) {
    const doc = {
      nombre, nivel: 1, padre_id: null, padre_nombre: null,
      imagen: "", icono: ICONOS[nombre] || "", color: COLORES[nombre] || "#8B5CF6",
      destacada: true, orden: Object.keys(TREE).indexOf(nombre) + 1,
      activo: true, created_at: new Date(), updated_at: new Date(),
    };
    const r = await col('categorias').insertOne(doc);
    idsN1[nombre] = r.insertedId;
    insertados++;
  }

  // Nivel 2
  const idsN2 = {};
  for (const [n1, subcats] of Object.entries(TREE)) {
    let orden = 0;
    for (const nombre of Object.keys(subcats)) {
      const doc = {
        nombre, nivel: 2, padre_id: String(idsN1[n1]), padre_nombre: n1,
        imagen: "", icono: "", color: COLORES[n1] || "#8B5CF6",
        destacada: false, orden: ++orden,
        activo: true, created_at: new Date(), updated_at: new Date(),
      };
      const r = await col('categorias').insertOne(doc);
      idsN2[`${n1}|${nombre}`] = r.insertedId;
      insertados++;
    }
  }

  // Nivel 3
  for (const [n1, subcats] of Object.entries(TREE)) {
    for (const [n2, subsubcats] of Object.entries(subcats)) {
      let orden = 0;
      for (const nombre of subsubcats) {
        await col('categorias').insertOne({
          nombre, nivel: 3, padre_id: String(idsN2[`${n1}|${n2}`]), padre_nombre: n2,
          imagen: "", icono: "", color: COLORES[n1] || "#8B5CF6",
          destacada: false, orden: ++orden,
          activo: true, created_at: new Date(), updated_at: new Date(),
        });
        insertados++;
      }
    }
  }

  res.json({ ok: true, message: `Seed completado: ${insertados} categorías insertadas` });
}));

// POST /api/v1/admin/categorias
adminRouter.post('/', auth, requireRole('admin'), ah(async (req, res) => {
  const {
    nombre,
    padre_id = null,
    imagen = '',
    icono = '',
    color = '',
    destacada = false,
    orden = 0,
  } = req.body || {};

  if (!nombre || !String(nombre).trim()) {
    return res.status(400).json({ ok: false, error: 'El nombre es obligatorio' });
  }

  const nombreLimpio = String(nombre).trim();
  let nivel = 1;
  let padre_nombre = null;
  let padreIdStr = null;

  if (padre_id) {
    const filtroPadre = safeIdFilter(padre_id);
    if (!filtroPadre) {
      return res.status(400).json({ ok: false, error: 'ID de padre inválido' });
    }
    const padre = await col('categorias').findOne(filtroPadre);
    if (!padre) {
      return res.status(400).json({ ok: false, error: 'Categoría padre no encontrada' });
    }
    nivel = Number(padre.nivel || 1) + 1;
    if (nivel > 3) {
      return res.status(400).json({ ok: false, error: 'Solo se permiten 3 niveles' });
    }
    padre_nombre = padre.nombre;
    padreIdStr = String(padre._id);

    const dup = await col('categorias').findOne({
      padre_id: padreIdStr,
      nombre: { $regex: `^${nombreLimpio.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
    });
    if (dup) {
      return res.status(400).json({
        ok: false,
        error: `Ya existe "${nombreLimpio}" como subcategoría de "${padre_nombre}"`,
      });
    }
  } else {
    const dup = await col('categorias').findOne({
      padre_id: null,
      nombre: { $regex: `^${nombreLimpio.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
    });
    if (dup) {
      return res.status(400).json({
        ok: false,
        error: `Ya existe una categoría raíz llamada "${nombreLimpio}"`,
      });
    }
  }

  const doc = {
    nombre: nombreLimpio,
    nivel,
    padre_id: padreIdStr,
    padre_nombre,
    imagen: String(imagen || '').trim(),
    icono: String(icono || '').trim(),
    color: String(color || '').trim(),
    destacada: !!destacada,
    orden: Number(orden) || 0,
    activo: true,
    created_at: new Date(),
    updated_at: new Date(),
  };

  const r = await col('categorias').insertOne(doc);
  res.status(201).json({
    ok: true,
    data: { id: String(r.insertedId), ...doc },
  });
}));

// PUT /api/v1/admin/categorias/:id
adminRouter.put('/:id', auth, requireRole('admin'), ah(async (req, res) => {
  const filtroCat = safeIdFilter(req.params.id);
  if (!filtroCat) return res.status(400).json({ ok: false, error: 'ID inválido' });

  const cat = await col('categorias').findOne(filtroCat);
  if (!cat) return res.status(404).json({ ok: false, error: 'Categoría no encontrada' });

  const { nombre, padre_id, imagen, icono, color, destacada, orden, activo } = req.body || {};
  const set = { updated_at: new Date() };

  if (nombre !== undefined) {
    const n = String(nombre).trim();
    if (!n) return res.status(400).json({ ok: false, error: 'El nombre no puede estar vacío' });
    set.nombre = n;
  }
  if (imagen !== undefined) set.imagen = String(imagen || '').trim();
  if (icono !== undefined) set.icono = String(icono || '').trim();
  if (color !== undefined) set.color = String(color || '').trim();
  if (destacada !== undefined) set.destacada = !!destacada;
  if (orden !== undefined) set.orden = Number(orden) || 0;
  if (activo !== undefined) set.activo = !!activo;

  if (padre_id !== undefined) {
    if (padre_id === null || padre_id === '') {
      set.padre_id = null;
      set.padre_nombre = null;
      set.nivel = 1;
    } else {
      if (String(padre_id) === String(cat._id)) {
        return res.status(400).json({ ok: false, error: 'Una categoría no puede ser su propio padre' });
      }

      const esCiclo = await esDescendiente(cat._id, padre_id);
      if (esCiclo) {
        return res.status(400).json({
          ok: false,
          error: 'No puedes asignar como padre a una de sus propias subcategorías (crearía un ciclo)',
        });
      }

      const filtroPadre = safeIdFilter(padre_id);
      if (!filtroPadre) return res.status(400).json({ ok: false, error: 'ID de padre inválido' });

      const padre = await col('categorias').findOne(filtroPadre);
      if (!padre) return res.status(400).json({ ok: false, error: 'Categoría padre no encontrada' });

      const nuevoNivel = Number(padre.nivel || 1) + 1;
      if (nuevoNivel > 3) {
        return res.status(400).json({ ok: false, error: 'Solo se permiten 3 niveles' });
      }

      const alturaSub = await alturaSubarbol(cat._id);
      if (nuevoNivel + alturaSub > 3) {
        return res.status(400).json({
          ok: false,
          error: `Mover esta categoría excedería el nivel 3 (arrastra ${alturaSub} nivel(es) de hijos)`,
        });
      }

      set.padre_id = String(padre._id);
      set.padre_nombre = padre.nombre;
      set.nivel = nuevoNivel;
    }
  }

  await col('categorias').updateOne({ _id: cat._id }, { $set: set });

  if (set.nombre && set.nombre !== cat.nombre) {
    await col('categorias').updateMany(
      { padre_id: String(cat._id) },
      { $set: { padre_nombre: set.nombre, updated_at: new Date() } }
    );
  }

  const actualizada = await col('categorias').findOne({ _id: cat._id });
  res.json({ ok: true, data: serialize(actualizada) });
}));

// DELETE /api/v1/admin/categorias/:id
adminRouter.delete('/:id', auth, requireRole('admin'), ah(async (req, res) => {
  const filtroCat = safeIdFilter(req.params.id);
  if (!filtroCat) return res.status(400).json({ ok: false, error: 'ID inválido' });

  const cat = await col('categorias').findOne(filtroCat);
  if (!cat) return res.status(404).json({ ok: false, error: 'Categoría no encontrada' });

  const hijos = await col('categorias').countDocuments({ padre_id: String(cat._id) });
  if (hijos > 0) {
    return res.status(400).json({
      ok: false,
      error: `No puedes eliminar "${cat.nombre}" porque tiene ${hijos} subcategoría(s). Elimina primero las hijas.`,
    });
  }

  await col('categorias').deleteOne({ _id: cat._id });
  res.json({ ok: true, message: `Categoría "${cat.nombre}" eliminada` });
}));

// ================================================================
// EXPORTS
// ================================================================
module.exports = {
  publicRouter,
  adminRouter,
};