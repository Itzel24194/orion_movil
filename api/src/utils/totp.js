// TOTP (RFC 6238) sin dependencias. Compatible con pyotp (SHA1, 6 dígitos, 30 s) y Google Authenticator.
const crypto = require('crypto');
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(buf) {
  let bits = 0, val = 0, out = '';
  for (const b of buf) { val = ((val << 8) | b) & 0xffffff; bits += 8; while (bits >= 5) { out += B32[(val >>> (bits - 5)) & 31]; bits -= 5; } }
  if (bits > 0) out += B32[(val << (5 - bits)) & 31];
  return out;
}
function base32Decode(str) {
  const s = String(str).replace(/=+$/, '').replace(/\s+/g, '').toUpperCase();
  let bits = 0, val = 0; const out = [];
  for (const c of s) {
    const i = B32.indexOf(c); if (i < 0) throw new Error('Secreto base32 inválido');
    val = ((val << 5) | i) & 0xffffff; bits += 5;
    if (bits >= 8) { out.push((val >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(out);
}
function hotp(secretBuf, counter, digits = 6) {
  const msg = Buffer.alloc(8); msg.writeBigUInt64BE(BigInt(counter));
  const h = crypto.createHmac('sha1', secretBuf).update(msg).digest();
  const o = h[h.length - 1] & 0xf;
  const code = (((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3]) % 10 ** digits;
  return String(code).padStart(digits, '0');
}
function totp(secret, { now = Date.now(), step = 30, digits = 6 } = {}) {
  return hotp(base32Decode(secret), Math.floor(now / 1000 / step), digits);
}
function verify(secret, token, { window = 1, now = Date.now(), step = 30, digits = 6 } = {}) {
  const t = String(token || '').replace(/\s+/g, '');
  if (!new RegExp(`^\\d{${digits}}$`).test(t)) return false;
  let key; try { key = base32Decode(secret); } catch (_) { return false; }
  const c = Math.floor(now / 1000 / step);
  for (let i = -window; i <= window; i++) {
    const exp = Buffer.from(hotp(key, c + i, digits));
    if (crypto.timingSafeEqual(exp, Buffer.from(t))) return true;
  }
  return false;
}
const generateSecret = () => base32Encode(crypto.randomBytes(20));
const otpauthUrl = (secret, email, issuer = 'ORION') =>
  `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(email)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;

module.exports = { base32Encode, base32Decode, hotp, totp, verify, generateSecret, otpauthUrl };
