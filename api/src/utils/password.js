// Verifica contraseñas guardadas por Flask (werkzeug: pbkdf2 / scrypt / hmac) y por bcrypt.
// Las contraseñas nuevas creadas desde la API se guardan con bcrypt.
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const eq = (a, b) => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && crypto.timingSafeEqual(x, y); };

async function verify(password, stored) {
  if (!password || !stored || typeof stored !== 'string') return false;
  try {
    if (/^\$2[aby]\$/.test(stored)) return await bcrypt.compare(password, stored);
    const parts = stored.split('$');
    if (stored.startsWith('pbkdf2:')) {
      const [method, salt, hash] = parts; const [, alg, iter] = method.split(':');
      const d = crypto.pbkdf2Sync(password, salt, parseInt(iter || '260000', 10), Buffer.from(hash, 'hex').length, alg);
      return eq(d.toString('hex'), hash);
    }
    if (stored.startsWith('scrypt:')) {
      const [method, salt, hash] = parts; const [, n, r, p] = method.split(':');
      const d = crypto.scryptSync(password, salt, Buffer.from(hash, 'hex').length, { N: +n, r: +r, p: +p, maxmem: 256 * 1024 * 1024 });
      return eq(d.toString('hex'), hash);
    }
    if (parts.length === 3 && ['sha256', 'sha1', 'sha512', 'md5'].includes(parts[0])) {
      const d = crypto.createHmac(parts[0], parts[1]).update(password).digest('hex');
      return eq(d, parts[2]);
    }
  } catch (_) { /* formato desconocido */ }
  return false;
}
const hash = (password) => bcrypt.hash(password, 10);
const storedHash = (u) => u.password || u.password_hash || u.contrasena;

module.exports = { verify, hash, storedHash };
