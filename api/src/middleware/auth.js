const jwt = require('jsonwebtoken');
const { col } = require('../config/db');
const { idFilter } = require('../utils/helpers');

const SECRET = () => process.env.JWT_SECRET;

// ================================================================
// Normaliza cualquier variante de rol al estándar en inglés
// ================================================================
function normalizarRol(raw) {
  const r = String(raw || '').toLowerCase().trim();
  if (['admin', 'administrador', 'administrator', 'superadmin', 'root'].includes(r)) return 'admin';
  if (['vendedor', 'seller', 'vendor'].includes(r)) return 'vendedor';
  if (['cliente', 'client', 'customer', 'user', 'usuario'].includes(r)) return 'cliente';
  return r || 'cliente';
}

// ================================================================
// ⭐ Normaliza cualquier variante de género al estándar
//    (el mismo que usa el panel web Flask)
// ================================================================
function normalizarGenero(raw) {
  if (!raw) return 'Indefinido';
  const v = String(raw).trim().toLowerCase();
  if (['masculino', 'hombre', 'm', 'male', 'man'].includes(v)) return 'Masculino';
  if (['femenino', 'mujer', 'f', 'female', 'woman'].includes(v)) return 'Femenino';
  return 'Indefinido';
}

// ================================================================
// Firma de tokens
// ================================================================
function signTokens(user) {
  const base = {
    sub: String(user._id),
    rol: normalizarRol(user.rol || user.role),
  };
  return {
    access_token: jwt.sign(
      { ...base, type: 'access' },
      SECRET(),
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    ),
    refresh_token: jwt.sign(
      { ...base, type: 'refresh' },
      SECRET(),
      { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d' }
    ),
  };
}

const signTemp = (user) =>
  jwt.sign({ sub: String(user._id), type: 'twofa' }, SECRET(), { expiresIn: '5m' });

// ================================================================
// Carga el usuario a partir del token
// ================================================================
async function load(req) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return null;

  const p = jwt.verify(token, SECRET());
  if (p.type !== 'access') return null;

  const user = await col('usuarios').findOne(idFilter(p.sub));
  if (!user || user.activo === false) return null;

  // Normalizamos el rol siempre
  user.rol = normalizarRol(user.rol || user.role);

  // ⭐ Garantizamos que el usuario en `req` traiga SIEMPRE el género
  //    normalizado, sin importar si en Mongo está como `sexo` o `genero`.
  const generoRaw = user.genero ?? user.sexo ?? '';
  user.genero = normalizarGenero(generoRaw);
  user.sexo = user.genero; // espejo para compatibilidad

  return user;
}

// ================================================================
// Middlewares
// ================================================================
async function auth(req, res, next) {
  try {
    const user = await load(req);
    if (!user) return res.status(401).json({ ok: false, error: 'No autenticado' });
    req.user = user;
    req.userId = String(user._id);
    next();
  } catch (e) {
    console.log('🔍 [auth] Error verificando token:', e.message);
    res.status(401).json({ ok: false, error: 'Token inválido o expirado' });
  }
}

async function optionalAuth(req, _res, next) {
  try {
    const u = await load(req);
    if (u) {
      req.user = u;
      req.userId = String(u._id);
    }
  } catch (_) {}
  next();
}

// ================================================================
// requireRole
// ================================================================
const requireRole = (...roles) => (req, res, next) => {
  if (roles.includes(req.user?.rol)) return next();
  return res.status(403).json({ ok: false, error: 'Acceso denegado' });
};

module.exports = {
  auth,
  optionalAuth,
  signTokens,
  signTemp,
  requireRole,
  normalizarRol,
  normalizarGenero,   // ⭐ exportado para que lo uses en los controladores
  admin: [auth, requireRole('admin')],
  vendedor: [auth, requireRole('vendedor', 'admin')],
  cliente: [auth, requireRole('cliente', 'vendedor', 'admin')],
};