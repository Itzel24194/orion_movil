const router = require('express').Router();
const { col } = require('../config/db');
const { cliente } = require('../middleware/auth');
const { ah, idFilter, ser, publicUser, num, pick, clean } = require('../utils/helpers');
const pw = require('../utils/password');
const totp = require('../utils/totp');
const twofa = require('../services/twofa');
const { TWO_FA } = require('../config/collections');

router.use(...cliente);
const U = (req) => ({ _id: req.user._id });

// ============================================================
// DIRECCIONES — helpers de normalización / expansión
// ⚠️ CRÍTICO: Flask guarda "numero"/"cp" en Mongo. Express
// debe guardar IGUAL para que la web vea lo que guarda el móvil.
// ============================================================
const DIR = [
  'alias', 'nombre', 'telefono',
  'calle', 'numero', 'numero_interior',
  'colonia', 'ciudad', 'estado', 'cp', 'pais', 'referencias',
];

// La app móvil manda numero_exterior/codigo_postal.
// Los traducimos a los nombres canónicos (numero/cp).
const DIR_IN_ALIASES = {
  numero_exterior: 'numero',
  numero_ext: 'numero',
  num_ext: 'numero',
  codigo_postal: 'cp',
  codigoPostal: 'cp',
  zip: 'cp',
};

const normalizeDir = (raw) => {
  const out = {};
  for (const [k, v] of Object.entries(raw || {})) {
    const key = DIR_IN_ALIASES[k] || k;
    if (DIR.includes(key) && v !== undefined && v !== null && v !== '') out[key] = v;
  }
  return out;
};

// Al DEVOLVER, añadimos ambos alias para que cualquier front
// (app móvil o web admin) lo lea sin importar qué nombre usa.
const expandDir = (d) => ({
  ...d,
  numero: d.numero ?? d.numero_exterior ?? '',
  cp: d.cp ?? d.codigo_postal ?? '',
  numero_exterior: d.numero ?? d.numero_exterior ?? '',
  codigo_postal: d.cp ?? d.codigo_postal ?? '',
});

// ============================================================
// PERFIL
// ============================================================
router.get('/', (req, res) => res.json({ ok: true, user: publicUser(req.user) }));

router.put('/', ah(async (req, res) => {
  const set = pick(req.body || {}, ['nombre', 'apellido', 'telefono', 'fecha_nacimiento', 'genero', 'avatar']);
  if (!Object.keys(set).length) return res.status(400).json({ ok: false, error: 'Nada que actualizar' });
  await col('usuarios').updateOne(U(req), { $set: set });
  res.json({ ok: true, user: publicUser(await col('usuarios').findOne(U(req))) });
}));

router.put('/password', ah(async (req, res) => {
  const { password_actual, password_nueva } = req.body || {};
  if (!(await pw.verify(password_actual, pw.storedHash(req.user)))) return res.status(401).json({ ok: false, error: 'La contraseña actual es incorrecta' });
  if (!password_nueva || String(password_nueva).length < 8) return res.status(400).json({ ok: false, error: 'La nueva contraseña debe tener al menos 8 caracteres' });
  await col('usuarios').updateOne(U(req), { $set: { password: await pw.hash(password_nueva) }, $unset: { password_hash: '', contrasena: '' } });
  res.json({ ok: true });
}));

router.delete('/', ah(async (req, res) => {
  if (!(await pw.verify(req.body?.password, pw.storedHash(req.user)))) return res.status(401).json({ ok: false, error: 'Contraseña incorrecta' });
  await col('usuarios').updateOne(U(req), { $set: { activo: false, eliminado_en: new Date() } });
  res.json({ ok: true, message: 'Cuenta desactivada' });
}));

router.get('/datos', ah(async (req, res) => {
  const [pedidos, resenas] = await Promise.all([
    col('pedidos').find({ usuario_id: req.userId }).toArray(),
    col('resenas').find({ usuario_id: req.userId }).toArray(),
  ]);
  res.json({ ok: true, data: ser({ usuario: publicUser(req.user), pedidos, resenas, exportado_en: new Date() }) });
}));

// ============================================================
// DIRECCIONES
// ============================================================
router.get('/direcciones', (req, res) => {
  const dirs = (req.user.direcciones || []).map(expandDir);
  res.json({ ok: true, data: ser(dirs), direcciones: ser(dirs) });
});

// PUT /direcciones — reemplazo masivo
router.put('/direcciones', ah(async (req, res) => {
  const incoming = Array.isArray(req.body?.direcciones)
    ? req.body.direcciones
    : Array.isArray(req.body)
      ? req.body
      : null;
  if (!incoming) return res.status(400).json({ ok: false, error: 'Envía { direcciones: [...] }' });

  let n = 0;
  const dirs = incoming.map((raw) => {
    const d = normalizeDir(raw);
    const id = Number(raw?.id);
    return {
      ...d,
      id: Number.isFinite(id) && id > 0 ? id : ++n,
      predeterminada: !!raw?.predeterminada,
    };
  });

  // Solo una predeterminada
  const firstPred = dirs.findIndex((x) => x.predeterminada);
  if (firstPred === -1 && dirs.length) dirs[0].predeterminada = true;
  else dirs.forEach((x, i) => { if (i !== firstPred) x.predeterminada = false; });

  await col('usuarios').updateOne(U(req), { $set: { direcciones: dirs } });
  res.json({ ok: true, data: ser(dirs.map(expandDir)), direcciones: ser(dirs.map(expandDir)) });
}));

// POST /direcciones — crear una nueva
router.post('/direcciones', ah(async (req, res) => {
  const dirs = req.user.direcciones || [];
  const body = normalizeDir(req.body || {});
  if (!body.calle || !body.cp) {
    return res.status(400).json({ ok: false, error: 'calle y cp son obligatorios' });
  }
  const now = new Date();
  const d = {
    ...body,
    id: dirs.reduce((m, x) => Math.max(m, num(x.id)), 0) + 1,
    predeterminada: dirs.length === 0 || !!req.body.predeterminada,
    created_at: now,
    updated_at: now,
  };
  if (d.predeterminada) dirs.forEach((x) => (x.predeterminada = false));
  dirs.push(d);
  await col('usuarios').updateOne(U(req), { $set: { direcciones: dirs } });
  res.status(201).json({ ok: true, data: ser(dirs.map(expandDir)), direcciones: ser(dirs.map(expandDir)) });
}));

// PUT /direcciones/:id — editar existente
router.put('/direcciones/:id', ah(async (req, res) => {
  const dirs = req.user.direcciones || [];
  const d = dirs.find((x) => String(x.id) === req.params.id);
  if (!d) return res.status(404).json({ ok: false, error: 'Dirección no encontrada' });
  Object.assign(d, normalizeDir(req.body || {}), { updated_at: new Date() });
  if (req.body?.predeterminada === true) {
    dirs.forEach((x) => (x.predeterminada = String(x.id) === req.params.id));
  }
  await col('usuarios').updateOne(U(req), { $set: { direcciones: dirs } });
  res.json({ ok: true, data: ser(dirs.map(expandDir)), direcciones: ser(dirs.map(expandDir)) });
}));

// POST /direcciones/:id/predeterminada — marcar como principal
router.post('/direcciones/:id/predeterminada', ah(async (req, res) => {
  const dirs = req.user.direcciones || [];
  if (!dirs.some((x) => String(x.id) === req.params.id)) {
    return res.status(404).json({ ok: false, error: 'Dirección no encontrada' });
  }
  dirs.forEach((x) => (x.predeterminada = String(x.id) === req.params.id));
  await col('usuarios').updateOne(U(req), { $set: { direcciones: dirs } });
  res.json({ ok: true, data: ser(dirs.map(expandDir)), direcciones: ser(dirs.map(expandDir)) });
}));

// DELETE /direcciones/:id
router.delete('/direcciones/:id', ah(async (req, res) => {
  let dirs = (req.user.direcciones || []).filter((x) => String(x.id) !== req.params.id);
  if (dirs.length && !dirs.some((x) => x.predeterminada)) dirs[0].predeterminada = true;
  await col('usuarios').updateOne(U(req), { $set: { direcciones: dirs } });
  res.json({ ok: true, data: ser(dirs.map(expandDir)), direcciones: ser(dirs.map(expandDir)) });
}));

// ============================================================
// FAVORITOS
// ============================================================
const favs = (req) => (req.user.favoritos || []).map(String);
router.get('/favoritos', ah(async (req, res) => {
  const ids = favs(req);
  const items = ids.length ? await col('productos').find({ $or: ids.map(idFilter) }).toArray() : [];
  res.json({ ok: true, data: ser(items), ids });
}));
router.post('/favoritos/toggle', ah(async (req, res) => {
  const id = String(req.body?.producto_id || '');
  if (!id) return res.status(400).json({ ok: false, error: 'producto_id requerido' });
  const on = favs(req).includes(id);
  await col('usuarios').updateOne(U(req), on ? { $pull: { favoritos: { $in: [id] } } } : { $addToSet: { favoritos: id } });
  res.json({ ok: true, favorito: !on });
}));
router.post('/favoritos/:id', ah(async (req, res) => { await col('usuarios').updateOne(U(req), { $addToSet: { favoritos: req.params.id } }); res.status(201).json({ ok: true, favorito: true }); }));
router.delete('/favoritos/:id', ah(async (req, res) => { await col('usuarios').updateOne(U(req), { $pull: { favoritos: req.params.id } }); res.json({ ok: true, favorito: false }); }));

// ============================================================
// INTERESES
// ============================================================
router.get('/intereses', (req, res) => res.json({ ok: true, data: req.user.intereses || [] }));
router.post('/intereses', ah(async (req, res) => {
  const lista = Array.isArray(req.body?.intereses) ? req.body.intereses.map(String).slice(0, 50) : [];
  await col('usuarios').updateOne(U(req), { $set: { intereses: lista } });
  res.json({ ok: true, data: lista });
}));
router.delete('/intereses', ah(async (req, res) => { await col('usuarios').updateOne(U(req), { $set: { intereses: [] } }); res.json({ ok: true }); }));

// ============================================================
// SUBDOCUMENTOS
// ============================================================
const sub = (ruta, campo, permitidos) => {
  router.get(ruta, (req, res) => res.json({ ok: true, data: ser(req.user[campo] || {}) }));
  router.put(ruta, ah(async (req, res) => {
    const data = permitidos ? pick(req.body || {}, permitidos) : clean(req.body || {});
    await col('usuarios').updateOne(U(req), { $set: { [campo]: { ...(req.user[campo] || {}), ...data } } });
    res.json({ ok: true, data });
  }));
};
sub('/preferencias', 'preferencias_comunicacion');
sub('/privacidad', 'privacidad');
sub('/idioma', 'idioma_region', ['idioma', 'region', 'moneda', 'zona_horaria']);
sub('/facturacion', 'facturacion', ['rfc', 'razon_social', 'regimen_fiscal', 'uso_cfdi', 'codigo_postal', 'email_facturacion']);

// ============================================================
// MÉTODOS DE PAGO
// ============================================================
router.get('/metodos-pago', (req, res) => res.json({ ok: true, data: ser(req.user.metodos_pago || []) }));
router.post('/metodos-pago', ah(async (req, res) => {
  const { marca, ultimos4, titular, vence, token } = req.body || {};
  if (!/^\d{4}$/.test(String(ultimos4 || ''))) return res.status(400).json({ ok: false, error: 'Envía solo los últimos 4 dígitos. Nunca envíes el número completo.' });
  const lista = req.user.metodos_pago || [];
  const m = { id: String(Date.now()), marca: marca || 'tarjeta', ultimos4: String(ultimos4), titular: titular || '', vence: vence || '', token: token || null, predeterminado: lista.length === 0 };
  lista.push(m);
  await col('usuarios').updateOne(U(req), { $set: { metodos_pago: lista } });
  res.status(201).json({ ok: true, data: lista });
}));
router.post('/metodos-pago/:id/predeterminado', ah(async (req, res) => {
  const lista = (req.user.metodos_pago || []).map((m) => ({ ...m, predeterminado: m.id === req.params.id }));
  await col('usuarios').updateOne(U(req), { $set: { metodos_pago: lista } });
  res.json({ ok: true, data: lista });
}));
router.delete('/metodos-pago/:id', ah(async (req, res) => {
  let lista = (req.user.metodos_pago || []).filter((m) => m.id !== req.params.id);
  if (lista.length && !lista.some((m) => m.predeterminado)) lista[0].predeterminado = true;
  await col('usuarios').updateOne(U(req), { $set: { metodos_pago: lista } });
  res.json({ ok: true, data: lista });
}));

// ============================================================
// CUPONES
// ============================================================
const cup = require('../services/cupones');
router.get('/cupones', ah(async (req, res) => {
  const now = new Date();
  const todos = await col('cupones').find({ activo: { $ne: false }, $or: [{ publico: true }, { usuario_id: req.userId }, { usuarios_asignados: req.userId }] }).toArray();
  const vigentes = todos.filter((c) => { const f = c.fecha_fin || c.fecha_expiracion; const d = f && new Date(f); return !(d && !isNaN(d) && d < now); });
  res.json({ ok: true, data: ser(vigentes) });
}));
router.post('/cupones/validar', ah(async (req, res) => {
  const v = await cup.validar(req.body?.codigo, num(req.body?.subtotal), req.userId);
  if (!v.ok) return res.status(400).json(v);
  res.json({ ok: true, descuento: v.descuento, cupon: { codigo: v.cupon.codigo, tipo: v.cupon.tipo, valor: v.cupon.valor } });
}));

// ============================================================
// 2FA
// ============================================================
router.get('/2fa/estado', (req, res) => {
  const lista = req.user[TWO_FA.backup.find((f) => Array.isArray(req.user[f])) || TWO_FA.writeBackup] || [];
  res.json({ ok: true, data: { activo: twofa.tiene2FA(req.user), codigos_respaldo_restantes: lista.length } });
});
router.post('/2fa/iniciar', ah(async (req, res) => {
  if (twofa.tiene2FA(req.user)) return res.status(409).json({ ok: false, error: 'El 2FA ya está activo' });
  const secret = totp.generateSecret();
  await col('usuarios').updateOne(U(req), { $set: { two_factor_pending: { secret, expira: new Date(Date.now() + 10 * 60000) } } });
  res.json({ ok: true, data: { secret, otpauth_url: totp.otpauthUrl(secret, req.user.email, process.env.TWOFA_ISSUER || 'ORION'), expira_en_minutos: 10 } });
}));
router.post('/2fa/confirmar', ah(async (req, res) => {
  const pend = req.user.two_factor_pending;
  if (!pend || new Date(pend.expira) < new Date()) return res.status(400).json({ ok: false, error: 'Inicia la configuración de nuevo' });
  if (!totp.verify(pend.secret, req.body?.codigo)) return res.status(400).json({ ok: false, error: 'Código incorrecto' });
  const { plano, hash } = twofa.generarCodigosRespaldo();
  await col('usuarios').updateOne(U(req), { $set: { [TWO_FA.writeEnabled]: true, [TWO_FA.writeSecret]: pend.secret, [TWO_FA.writeBackup]: hash }, $unset: { two_factor_pending: '' } });
  res.json({ ok: true, message: '2FA activado', codigos_respaldo: plano, aviso: 'Guarda estos códigos: solo se muestran una vez.' });
}));
async function exigirPasswordYCodigo(req, res) {
  if (!(await pw.verify(req.body?.password, pw.storedHash(req.user)))) { res.status(401).json({ ok: false, error: 'Contraseña incorrecta' }); return false; }
  if (!twofa.tiene2FA(req.user)) { res.status(409).json({ ok: false, error: 'El 2FA no está activo' }); return false; }
  if (!(await twofa.verificarCodigo(req.user, req.body?.codigo)).ok) { res.status(401).json({ ok: false, error: 'Código de verificación incorrecto' }); return false; }
  return true;
}
router.post('/2fa/desactivar', ah(async (req, res) => {
  if (!(await exigirPasswordYCodigo(req, res))) return;
  const unset = {}; [...TWO_FA.secret, ...TWO_FA.backup].forEach((f) => (unset[f] = ''));
  const set = {}; TWO_FA.enabled.forEach((f) => { if (req.user[f] !== undefined) set[f] = false; });
  await col('usuarios').updateOne(U(req), { $set: set, $unset: unset });
  res.json({ ok: true, message: '2FA desactivado' });
}));
router.post('/2fa/regenerar-codigos', ah(async (req, res) => {
  if (!(await exigirPasswordYCodigo(req, res))) return;
  const { plano, hash } = twofa.generarCodigosRespaldo();
  await col('usuarios').updateOne(U(req), { $set: { [TWO_FA.writeBackup]: hash } });
  res.json({ ok: true, codigos_respaldo: plano });
}));

module.exports = router;