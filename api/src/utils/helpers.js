// utils/helpers.js
const { ObjectId } = require('mongodb');
const { SENSITIVE } = require('../config/collections');

const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const oid = (id) => (ObjectId.isValid(id) ? new ObjectId(String(id)) : null);
const idFilter = (id) => { const o = oid(id); return { _id: o ? { $in: [o, String(id)] } : String(id) }; };
const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const num = (v, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d; };

function ser(v) {
  if (v instanceof ObjectId) return v.toString();
  if (v instanceof Date) return v.toISOString();
  if (Array.isArray(v)) return v.map(ser);
  if (v && typeof v === 'object') {
    if (v._bsontype === 'Decimal128' || v._bsontype === 'Long') return Number(v.toString());
    const o = {};
    for (const k of Object.keys(v)) o[k] = ser(v[k]);
    return o;
  }
  return v;
}

// ================================================================
// ⭐ NORMALIZACIÓN DE GÉNERO
// ================================================================
// Acepta cualquier variante (Masculino/hombre/M/male/masculino...)
// y devuelve SIEMPRE: "Masculino" | "Femenino" | "Indefinido".
// Local para no depender de `middleware/auth` y evitar ciclos de require.
function normalizarGenero(valor) {
  if (!valor) return 'Indefinido';
  const v = String(valor).trim().toLowerCase();
  if (['masculino', 'hombre', 'm', 'male', 'man'].includes(v)) return 'Masculino';
  if (['femenino', 'mujer', 'f', 'female', 'woman'].includes(v)) return 'Femenino';
  return 'Indefinido';
}

// ================================================================
// ⭐ PUBLIC USER
// ================================================================
// Devuelve el usuario listo para el cliente:
//   - Borra campos sensibles (SENSITIVE)
//   - Serializa ObjectId / Date / Decimal128 / Long
//   - Normaliza y espeja `genero` ↔ `sexo`
//   - Garantiza que SIEMPRE estén presentes:
//       fecha_nacimiento, direcciones, complexion, intereses,
//       preferencias_comunicacion, preferencias_idioma
//     para que el móvil no tenga que hacer fetch de detalle aparte.
function publicUser(u) {
  if (!u) return null;

  // 1) Copia limpia y borra sensibles
  const o = { ...u };
  SENSITIVE.forEach((k) => delete o[k]);

  // 2) Serializa (ObjectId, Date, etc.)
  const s = ser(o);

  // 3) ⭐ Normaliza género + espejo
  const generoNorm = normalizarGenero(s.genero ?? s.sexo ?? '');
  s.genero = generoNorm;
  s.sexo   = generoNorm;

  // 4) ⭐ Asegura TODOS los campos que el móvil espera (nunca undefined)
  //    — Fecha de nacimiento: null si no existe (antes faltaba y por eso
  //      el móvil mostraba una fecha vieja cacheada).
  if (s.fecha_nacimiento === undefined) s.fecha_nacimiento = null;

  //    — Direcciones: siempre array
  if (!Array.isArray(s.direcciones)) s.direcciones = [];

  //    — Complexión: objeto o null (nunca undefined)
  if (s.complexion === undefined)   s.complexion = null;

  //    — Intereses: objeto o null (nunca undefined, nunca array vacío
  //      porque el móvil espera `item.intereses.categorias`, etc.)
  if (s.intereses === undefined)    s.intereses = null;
  if (Array.isArray(s.intereses))   s.intereses = null;   // ⭐ normaliza si era []

  //    — Preferencias
  if (s.preferencias_comunicacion === undefined) s.preferencias_comunicacion = null;
  if (s.preferencias_idioma === undefined)       s.preferencias_idioma = null;

  // 5) ⭐ Compatibilidad de nombres de campos (viejo ↔ nuevo)
  //    El móvil espera `id` y algunos `*_url` además del campo original.
  if (s._id && !s.id) s.id = String(s._id);
  if (s.foto && !s.fotoUrl)      s.fotoUrl = s.foto;
  if (s.fotoUrl && !s.foto)      s.foto = s.fotoUrl;

  // 6) ⭐ Fechas: si no vienen explícitas, derivarlas del ObjectId
  if (!s.fecha_registro && !s.created_at) {
    const idStr = String(s._id || '');
    if (idStr.length >= 8) {
      const hex = idStr.substring(0, 8);
      if (/^[0-9a-f]{8}$/i.test(hex)) {
        const ts = parseInt(hex, 16);
        if (!isNaN(ts)) {
          const d = new Date(ts * 1000);
          const y = d.getFullYear();
          if (y > 2000 && y < 2100) {
            s.fecha_registro = d.toISOString();
            s.created_at     = d.toISOString();
          }
        }
      }
    }
  }
  if (s.created_at && !s.fecha_registro) s.fecha_registro = s.created_at;
  if (s.fecha_registro && !s.created_at) s.created_at     = s.fecha_registro;

  return s;
}

// ⭐ SIN LÍMITE: si no mandan limit, devuelve TODOS.
// Si mandan limit, respeta el valor tal cual (sin tope).
function paginate(q) {
  const page = Math.max(1, parseInt(q.page, 10) || 1);
  const rawLimit = parseInt(q.limit, 10);

  // Sin limit → 0 significa "sin límite" (MongoDB lo interpreta como "todos")
  // Con limit → respeta el valor exacto
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : 0;

  return { page, limit, skip: limit > 0 ? (page - 1) * limit : 0 };
}

const meta = (page, limit, total) => ({
  page,
  limit: limit || total,   // si es 0 (sin límite), reporta el total real
  total,
  pages: limit > 0 ? Math.ceil(total / limit) : 1,
});

const pick = (obj, keys) => keys.reduce((a, k) => (obj[k] !== undefined ? (a[k] = obj[k], a) : a), {});
const clean = (body) => { const b = { ...body }; delete b._id; return b; };

module.exports = {
  ah, oid, idFilter, esc, round2, num, ser, publicUser, paginate, meta, pick, clean,
  // ⭐ Exportamos también la normalización para que otros módulos la reusen
  normalizarGenero,
};