const router = require('express').Router();
const jwt = require('jsonwebtoken');
const { col } = require('../config/db');
const crypto = require('crypto');
const { auth, signTokens, signTemp, normalizarGenero } = require('../middleware/auth');
const twofa = require('../services/twofa');
const mail = require('../services/mail');
const { ah, esc, publicUser, idFilter } = require('../utils/helpers');
const pw = require('../utils/password');

const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ⭐ Añade el género normalizado al user que se devuelve al cliente
//    sin tocar `publicUser` directamente (por si lo usan otros endpoints).
const userConGenero = (u) => {
  const base = publicUser(u);
  const generoRaw = u?.genero ?? u?.sexo ?? '';
  const genero = normalizarGenero(generoRaw);
  return {
    ...base,
    genero,        // ⭐ siempre presente
    sexo: genero,  // espejo por compatibilidad con el panel web Flask
  };
};

// ================================================================
// REGISTER
// ================================================================
router.post('/register', ah(async (req, res) => {
  const {
    nombre,
    apellido = '',
    apellido_paterno = '',
    apellido_materno = '',
    email,
    password,
    telefono = '',
    genero = '',      // ⭐ aceptamos género
    sexo = '',        // ⭐ o sexo (compatibilidad con el móvil viejo)
  } = req.body || {};

  if (!nombre || !email || !password)
    return res.status(400).json({ ok: false, error: 'nombre, email y password son obligatorios' });

  if (!emailRx.test(email))
    return res.status(400).json({ ok: false, error: 'Email inválido' });

  if (String(password).length < 8)
    return res.status(400).json({ ok: false, error: 'La contraseña debe tener al menos 8 caracteres' });

  const mailAddr = String(email).trim().toLowerCase();

  if (await col('usuarios').findOne({ email: { $regex: `^${esc(mailAddr)}$`, $options: 'i' } }))
    return res.status(409).json({ ok: false, error: 'Ya existe una cuenta con ese email' });

  // ⭐ Normalizamos género al estándar del backend (Masculino/Femenino/Indefinido)
  const generoNorm = normalizarGenero(genero || sexo);

  const doc = {
    nombre: String(nombre).trim(),

    // Compatibilidad: guardamos los tres campos
    apellido: String(apellido).trim(),
    apellido_paterno: String(apellido_paterno || apellido).trim(),
    apellido_materno: String(apellido_materno).trim(),

    email: mailAddr,
    telefono,
    password: await pw.hash(password),
    rol: 'cliente',
    activo: true,
    email_confirmado: true,
    direcciones: [],
    favoritos: [],
    intereses: [],

    // ⭐ Género normalizado + espejo
    genero: generoNorm,
    sexo: generoNorm,

    fecha_registro: new Date(),
    origen: 'api',
  };

  const r = await col('usuarios').insertOne(doc);
  const user = { ...doc, _id: r.insertedId };
  const t = signTokens(user);

  res.status(201).json({
    ok: true,
    ...t,
    token: t.access_token,
    user: userConGenero(user),  // ⭐ incluye genero + sexo
  });
}));

// ================================================================
// LOGIN
// ================================================================
router.post('/login', ah(async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password)
    return res.status(400).json({ ok: false, error: 'email y password son obligatorios' });

  const emailLimpio = String(email).trim();
  console.log('🔍 [login] email recibido:', JSON.stringify(emailLimpio));

  const user = await col('usuarios').findOne({
    email: { $regex: `^${esc(emailLimpio)}$`, $options: 'i' },
  });

  if (!user) {
    console.log('❌ [login] Usuario NO encontrado en la colección "usuarios"');
    return res.status(401).json({ ok: false, error: 'Credenciales incorrectas' });
  }

  console.log('✅ [login] Usuario encontrado:', String(user._id), user.email);

  let ok = false;
  try {
    ok = await pw.verify(password, pw.storedHash(user));
  } catch (e) {
    console.log('❌ [login] pw.verify lanzó excepción:', e.message);
  }

  console.log('🔍 [login] pw.verify resultado =', ok);

  if (!ok) {
    console.log('❌ [login] Contraseña NO coincide para', user.email);
    return res.status(401).json({ ok: false, error: 'Credenciales incorrectas' });
  }

  if (user.activo === false) {
    console.log('❌ [login] Usuario inactivo');
    return res.status(403).json({ ok: false, error: 'Cuenta desactivada' });
  }

  if (process.env.REQUIRE_EMAIL_CONFIRMED === 'true' && user.email_confirmado === false)
    return res.status(403).json({ ok: false, error: 'Confirma tu correo antes de iniciar sesión' });

  if (twofa.tiene2FA(user)) {
    if (!twofa.secretDe(user))
      return res.status(500).json({
        ok: false,
        error: 'Tu cuenta tiene 2FA pero no se encontró su secreto. Revisa TWO_FA.secret en src/config/collections.js',
      });
    return res.json({
      ok: true,
      requires_2fa: true,
      temp_token: signTemp(user),
      message: 'Ingresa tu código de verificación',
    });
  }

  const t = signTokens(user);
  col('usuarios').updateOne(
    { _id: user._id },
    { $set: { ultimo_acceso: new Date() } }
  ).catch(() => {});

  console.log('✅ [login] OK. rol =', user.rol || user.role);

  res.json({
    ok: true,
    ...t,
    token: t.access_token,
    user: userConGenero(user),   // ⭐ incluye genero + sexo
  });
}));

// ================================================================
// SEGUNDO PASO 2FA
// ================================================================
router.post('/2fa/verificar', ah(async (req, res) => {
  let p;
  try {
    p = jwt.verify(req.body?.temp_token || '', process.env.JWT_SECRET);
    if (p.type !== 'twofa') throw new Error();
  } catch (_) {
    return res.status(401).json({ ok: false, error: 'La verificación expiró. Inicia sesión de nuevo.' });
  }

  const user = await col('usuarios').findOne(idFilter(p.sub));
  if (!user || user.activo === false)
    return res.status(401).json({ ok: false, error: 'Usuario no disponible' });

  const r = await twofa.verificarCodigo(user, req.body?.codigo);
  if (!r.ok)
    return res.status(401).json({ ok: false, error: 'Código incorrecto' });

  const t = signTokens(user);
  col('usuarios').updateOne(
    { _id: user._id },
    { $set: { ultimo_acceso: new Date() } }
  ).catch(() => {});

  res.json({
    ok: true,
    ...t,
    token: t.access_token,
    user: userConGenero(user),
    codigo_respaldo_usado: !!r.respaldo,
    codigos_respaldo_restantes: r.restantes,
  });
}));

// ================================================================
// RECUPERAR CONTRASEÑA
// ================================================================
const hashCodigo = (codigo, id) =>
  crypto.createHash('sha256').update(`${codigo}:${id}:${process.env.JWT_SECRET}`).digest('hex');

router.post('/recuperar', ah(async (req, res) => {
  const generica = {
    ok: true,
    message: 'Si el correo está registrado, te enviamos un código para restablecer tu contraseña.',
  };

  const email = String(req.body?.email || '').trim();
  if (!emailRx.test(email))
    return res.status(400).json({ ok: false, error: 'Email inválido' });

  const user = await col('usuarios').findOne({
    email: { $regex: `^${esc(email)}$`, $options: 'i' },
  });

  if (!user || user.activo === false) return res.json(generica);

  const prev = user.password_reset;
  if (prev && Date.now() - new Date(prev.creado).getTime() < 60000) return res.json(generica);

  const codigo = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  const minutos = Number(process.env.RESET_CODIGO_MINUTOS || 15);

  await col('usuarios').updateOne(
    { _id: user._id },
    {
      $set: {
        password_reset: {
          hash: hashCodigo(codigo, String(user._id)),
          expira: new Date(Date.now() + minutos * 60000),
          intentos: 0,
          creado: new Date(),
        },
      },
    }
  );

  if (process.env.NODE_ENV !== 'production')
    console.log(`[dev] Código de recuperación para ${user.email}: ${codigo}`);

  mail.enviar({
    to: user.email,
    subject: 'Tu código para restablecer la contraseña - ORION',
    text: `Tu código es ${codigo}. Vence en ${minutos} minutos. Si no lo solicitaste, ignora este correo.`,
    html: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto"><h2>Restablecer contraseña</h2><p>Usa este código en la app:</p><p style="font-size:32px;letter-spacing:6px;font-weight:bold">${codigo}</p><p>Vence en ${minutos} minutos. Si no lo solicitaste, ignora este correo.</p></div>`,
  }).catch((e) => console.error('[mail] Error al enviar:', e.message));

  res.json(generica);
}));

router.post('/resetear', ah(async (req, res) => {
  const { email, codigo, password_nueva } = req.body || {};
  const mal = () => res.status(400).json({ ok: false, error: 'Código inválido o vencido' });

  if (!email || !codigo)
    return res.status(400).json({ ok: false, error: 'email y codigo son obligatorios' });

  if (!password_nueva || String(password_nueva).length < 8)
    return res.status(400).json({ ok: false, error: 'La contraseña debe tener al menos 8 caracteres' });

  const user = await col('usuarios').findOne({
    email: { $regex: `^${esc(String(email).trim())}$`, $options: 'i' },
  });

  const pr = user && user.password_reset;
  if (!pr || new Date(pr.expira) < new Date() || (pr.intentos || 0) >= 5) return mal();

  const a = Buffer.from(hashCodigo(String(codigo).trim(), String(user._id)));
  const b = Buffer.from(pr.hash);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    await col('usuarios').updateOne(
      { _id: user._id },
      { $inc: { 'password_reset.intentos': 1 } }
    );
    return mal();
  }

  await col('usuarios').updateOne(
    { _id: user._id },
    {
      $set: { password: await pw.hash(password_nueva) },
      $unset: {
        password_reset: '',
        password_hash: '',
        contrasena: '',
        token_reset: '',
        reset_token: '',
      },
    }
  );

  res.json({ ok: true, message: 'Contraseña actualizada. Ya puedes iniciar sesión.' });
}));

// ================================================================
// REFRESH
// ================================================================
router.post('/refresh', ah(async (req, res) => {
  try {
    const p = jwt.verify(req.body?.refresh_token || '', process.env.JWT_SECRET);
    if (p.type !== 'refresh') throw new Error();
    const user = await col('usuarios').findOne(idFilter(p.sub));
    if (!user || user.activo === false) throw new Error();
    const t = signTokens(user);
    res.json({ ok: true, ...t, token: t.access_token });
  } catch (_) {
    res.status(401).json({ ok: false, error: 'Refresh token inválido' });
  }
}));

// ================================================================
// ME / LOGOUT / VERIFICAR
// ================================================================
router.get('/me', auth, (req, res) => {
  res.json({ ok: true, user: userConGenero(req.user) });   // ⭐ con género
});

router.post('/logout', (_req, res) =>
  res.json({ ok: true, message: 'Sesión cerrada en el cliente' })
);

router.get('/verificar', auth, (req, res) =>
  res.json({ ok: true, autenticado: true, rol: req.user.rol })
);

module.exports = router;