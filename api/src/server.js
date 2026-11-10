const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']); // evita querySrv ECONNREFUSED con MongoDB Atlas

require('dotenv').config();
const os = require('os');
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { connect, getDb, col } = require('./config/db');

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 16) {
  console.error('✖ Define JWT_SECRET (mínimo 16 caracteres) en tu archivo .env');
  process.exit(1);
}

const app = express();
app.set('trust proxy', 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
const origins = (process.env.CORS_ORIGINS || '*').split(',').map((s) => s.trim()).filter(Boolean);
app.use(cors({ origin: origins.includes('*') ? true : origins, methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'], allowedHeaders: ['Content-Type', 'Authorization'] }));
app.use(express.json({ limit: '2mb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// ================================================================
// ⭐ SERVIR ARCHIVOS ESTÁTICOS (fotos de usuarios, productos, reseñas)
// ================================================================
// Estructura:
//   orion-api1/src/server.js        ← este archivo (__dirname = .../src)
//   orion-api1/static/uploads/      ← fotos copiadas
// Por eso subimos UN nivel con '..' desde __dirname.
const staticPath = path.join(__dirname, '..', 'static');

app.use('/static', express.static(staticPath, {
  maxAge: '1h',
  etag: true,
  fallthrough: true,
}));

console.log('✅ /static sirviendo archivos desde:', staticPath);
console.log('   → Prueba: http://localhost:' + (process.env.PORT || 4000) + '/static/uploads/12.png');
// ================================================================

app.use('/api/v1', rateLimit({ windowMs: 15 * 60 * 1000, max: 600, standardHeaders: true, legacyHeaders: false }));
app.use('/api/v1/auth/login', rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: { ok: false, error: 'Demasiados intentos, espera unos minutos' } }));
app.use('/api/v1/auth/register', rateLimit({ windowMs: 60 * 60 * 1000, max: 20, message: { ok: false, error: 'Demasiados registros desde esta red' } }));

const estricto = (max, msg) => rateLimit({ windowMs: 15 * 60 * 1000, max, message: { ok: false, error: msg } });
app.use('/api/v1/auth/2fa', estricto(15, 'Demasiados intentos de verificación, espera unos minutos'));
app.use('/api/v1/auth/recuperar', estricto(6, 'Demasiadas solicitudes, intenta más tarde'));
app.use('/api/v1/auth/resetear', estricto(10, 'Demasiados intentos, intenta más tarde'));

app.get('/health', async (_req, res) => {
  try { await getDb().command({ ping: 1 }); res.json({ ok: true, db: 'conectada', hora: new Date().toISOString() }); }
  catch (_) { res.status(503).json({ ok: false, db: 'sin conexión' }); }
});

// ================================================================
// ⚠️ ENDPOINTS DE DEBUG — SOLO DESARROLLO
// ⚠️ BORRAR ANTES DE SUBIR A PRODUCCIÓN (Azure)
// ================================================================

// Lista de usuarios sin contraseñas:
//   http://localhost:4000/debug/usuarios
app.get('/debug/usuarios', async (_req, res) => {
  try {
    const usuarios = await col('usuarios')
      .find({}, {
        projection: {
          password: 0, password_hash: 0, contrasena: 0,
          two_factor_secret: 0, totp_secret: 0, secret_2fa: 0,
          otp_secret: 0, two_factor_pending: 0, password_reset: 0,
        },
      })
      .limit(200)
      .toArray();
    res.json({ ok: true, total: usuarios.length, data: usuarios });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Un usuario por email:
//   http://localhost:4000/debug/usuario/itzelnonato2004@gmail.com
app.get('/debug/usuario/:email', async (req, res) => {
  try {
    const u = await col('usuarios').findOne(
      { email: req.params.email },
      { projection: { password: 0, password_hash: 0, contrasena: 0 } }
    );
    if (!u) return res.status(404).json({ ok: false, error: 'Usuario no encontrado' });
    res.json({ ok: true, data: u });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Todas las colecciones y su conteo:
//   http://localhost:4000/debug/colecciones
app.get('/debug/colecciones', async (_req, res) => {
  try {
    const db = getDb();
    const cols = await db.listCollections().toArray();
    const conteo = {};
    for (const c of cols) {
      conteo[c.name] = await db.collection(c.name).countDocuments();
    }
    res.json({ ok: true, colecciones: conteo });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Ver cualquier colección:  http://localhost:4000/debug/col/productos
app.get('/debug/col/:name', async (req, res) => {
  try {
    const items = await col(req.params.name).find({}).limit(200).toArray();
    res.json({ ok: true, coleccion: req.params.name, total: items.length, data: items });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ================================================================
// ⚠️ FIN DE LOS ENDPOINTS DE DEBUG
// ================================================================

// ================================================================
// 🆕 CATEGORÍAS — ADMIN (montado ANTES del router general)
//   POST   /api/v1/admin/categorias
//   PUT    /api/v1/admin/categorias/:id
//   DELETE /api/v1/admin/categorias/:id
//   POST   /api/v1/admin/categorias/seed
// ================================================================
const categoriasRoutes = require('./routes/categorias');
app.use('/api/v1/categorias', categoriasRoutes.publicRouter);
app.use('/api/v1/admin/categorias', categoriasRoutes.adminRouter);

console.log('✅ /api/v1/categorias        → publicRouter');
console.log('✅ /api/v1/admin/categorias  → adminRouter');

// ================================================================
// 🆕 MARCAS (montado ANTES del catch-all /api/v1)
//   GET    /api/v1/marcas
//   GET    /api/v1/marcas/_debug
//   GET    /api/v1/marcas/:id
//   POST   /api/v1/admin/marcas
//   PUT    /api/v1/admin/marcas/:id
//   POST   /api/v1/admin/marcas/:id/aprobar
//   POST   /api/v1/admin/marcas/:id/negar
//   DELETE /api/v1/admin/marcas/:id
// ================================================================
const marcasRoutes = require('./routes/marcas');
app.use('/api/v1/marcas', marcasRoutes.publicRouter);
app.use('/api/v1/admin/marcas', marcasRoutes.adminRouter);

console.log('✅ /api/v1/marcas        → publicRouter');
console.log('✅ /api/v1/admin/marcas  → adminRouter');

// ================================================================
// Router general (resto de endpoints) — SIEMPRE AL FINAL
// ================================================================
app.use('/api/v1', require('./routes'));

app.use((req, res) => res.status(404).json({ ok: false, error: `Ruta no encontrada: ${req.method} ${req.originalUrl}` }));
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ ok: false, error: process.env.NODE_ENV === 'production' ? 'Error interno del servidor' : err.message });
});

const PORT = process.env.PORT || 4000;
connect().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`✔ ORION API lista en el puerto ${PORT}`);
    console.log(`  → Usuarios:    http://localhost:${PORT}/debug/usuarios`);
    console.log(`  → Colecciones: http://localhost:${PORT}/debug/colecciones`);
    console.log(`  → Estáticos:   http://localhost:${PORT}/static/uploads/12.png`);
    Object.values(os.networkInterfaces()).flat().filter((i) => i && i.family === 'IPv4' && !i.internal)
      .forEach((i) => console.log(`  → App móvil: http://${i.address}:${PORT}/api/v1`));
  });
}).catch((e) => { console.error('✖ No se pudo conectar a MongoDB:', e.message); process.exit(1); });