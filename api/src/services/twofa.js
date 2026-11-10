const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { col } = require('../config/db');
const { TWO_FA } = require('../config/collections');
const totp = require('../utils/totp');

const tiene2FA = (u) => TWO_FA.enabled.some((f) => u[f] === true);
const secretDe = (u) => { for (const f of TWO_FA.secret) if (u[f] && typeof u[f] === 'string') return u[f]; return null; };
const backupCampo = (u) => TWO_FA.backup.find((f) => Array.isArray(u[f])) || TWO_FA.writeBackup;
const norm = (c) => String(c || '').toUpperCase().replace(/[\s-]/g, '');
const sha = (c) => crypto.createHash('sha256').update(norm(c)).digest('hex');

function generarCodigosRespaldo(n = 8) {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const plano = Array.from({ length: n }, () => {
    const s = Array.from({ length: 8 }, () => A[crypto.randomInt(A.length)]).join('');
    return `${s.slice(0, 4)}-${s.slice(4)}`;
  });
  return { plano, hash: plano.map(sha) };
}

// Acepta código TOTP de 6 dígitos o un código de respaldo (texto plano, sha256 o bcrypt).
async function verificarCodigo(user, codigo) {
  const secret = secretDe(user);
  const c = String(codigo || '').trim();
  if (!c) return { ok: false };
  if (/^\d{6}$/.test(c.replace(/\s/g, ''))) return { ok: !!secret && totp.verify(secret, c) };
  const campo = backupCampo(user);
  const lista = user[campo] || [];
  for (let i = 0; i < lista.length; i++) {
    const g = lista[i]; const valor = typeof g === 'object' && g ? (g.hash || g.codigo || g.code) : g;
    if (!valor || (typeof g === 'object' && g && g.usado)) continue;
    let coincide = false;
    if (/^\$2[aby]\$/.test(valor)) coincide = await bcrypt.compare(norm(c), valor).catch(() => false);
    else coincide = valor === c || norm(valor) === norm(c) || valor === sha(c);
    if (coincide) {
      const restantes = lista.filter((_, j) => j !== i);
      await col('usuarios').updateOne({ _id: user._id }, { $set: { [campo]: restantes } });
      return { ok: true, respaldo: true, restantes: restantes.length };
    }
  }
  return { ok: false };
}

module.exports = { tiene2FA, secretDe, verificarCodigo, generarCodigosRespaldo, sha };
