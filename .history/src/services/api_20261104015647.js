// services/api.js
import { API_URL, REQUEST_TIMEOUT_MS } from '../config/api';
import { Platform } from 'react-native';

const TOKEN_KEY = '@orion/auth/token';
const USER_KEY = '@orion/auth/user';
const LANG_KEY = '@orion/auth/language';

const _rawApi = API_URL.replace(/\/+$/, '');
const SECURE_API_URL =
  _rawApi.includes('localhost') || _rawApi.includes('192.168.')
    ? _rawApi
    : _rawApi.replace(/^http:/i, 'https:');

const _rawMedia = (process.env.EXPO_PUBLIC_MEDIA_URL || '').replace(/\/+$/, '');
const MEDIA_BASE = _rawMedia.replace(/\/static\/uploads\/?$/i, '');

const DEBUG = __DEV__;

if (DEBUG && !MEDIA_BASE) {
  console.warn('⚠️ [api.js] EXPO_PUBLIC_MEDIA_URL NO está configurado. Las fotos no se verán.');
} else if (DEBUG) {
  console.log('✅ [api.js] MEDIA_BASE =', MEDIA_BASE);
}

const API_PREFIX = '/api/v1';
const CUENTA_BASE = `${API_PREFIX}/cuenta`;
const CUPONES_BASE = `${API_PREFIX}/admin`;
const CHAT_CLIENT = `${API_PREFIX}/chat`;
const CHAT_VEND = `${API_PREFIX}/vendedor/chat`;
const CHAT_ADMIN = `${API_PREFIX}/admin/chat`;

// ⭐ NUEVO: base de solicitudes (consistente con API_PREFIX)
const SOLICITUDES_BASE = `${API_PREFIX}/solicitudes`;

let memToken = null;
let memUser = null;
let memLang = 'es';

let _AsyncStorage = null;
function getAsyncStorage() {
  if (_AsyncStorage) return _AsyncStorage;
  const mod = require('@react-native-async-storage/async-storage');
  _AsyncStorage = mod?.default || mod;
  if (!_AsyncStorage || typeof _AsyncStorage.getItem !== 'function') {
    console.warn('⚠️ AsyncStorage no está disponible. Instala @react-native-async-storage/async-storage');
  }
  return _AsyncStorage;
}

export const normalizarGenero = (valor) => {
  if (!valor) return 'Indefinido';
  const v = String(valor).trim().toLowerCase();
  if (['masculino', 'hombre', 'm', 'male', 'man'].includes(v)) return 'Masculino';
  if (['femenino', 'mujer', 'f', 'female', 'woman'].includes(v)) return 'Femenino';
  return 'Indefinido';
};

const normalizarLang = (v) => {
  const s = String(v || '').trim().toLowerCase();
  return s.startsWith('en') ? 'en' : 'es';
};

export async function loadSession() {
  const AsyncStorage = getAsyncStorage();
  if (memToken === null) memToken = (await AsyncStorage.getItem(TOKEN_KEY)) || '';
  if (memUser === null) {
    try {
      memUser = JSON.parse((await AsyncStorage.getItem(USER_KEY)) || 'null');
    } catch {
      memUser = null;
    }
  }
  try {
    const storedLang = (await AsyncStorage.getItem(LANG_KEY)) || '';
    if (storedLang) {
      memLang = normalizarLang(storedLang);
    } else if (memUser?.language) {
      memLang = normalizarLang(memUser.language);
    } else if (memUser?.idioma) {
      memLang = normalizarLang(memUser.idioma);
    }
  } catch {}
  return { token: memToken, user: memUser, lang: memLang };
}

export async function saveSession(token, user) {
  const AsyncStorage = getAsyncStorage();
  memToken = token || '';
  memUser = user || null;
  if (memUser?.language) {
    memLang = normalizarLang(memUser.language);
  }
  await AsyncStorage.setItem(TOKEN_KEY, memToken);
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(memUser));
  try {
    await AsyncStorage.setItem(LANG_KEY, memLang);
  } catch {}
}

export async function clearSession() {
  const AsyncStorage = getAsyncStorage();
  memToken = '';
  memUser = null;
  memLang = 'es';
  await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY, LANG_KEY]);
}

export async function getCurrentUser() {
  const { token, user } = await loadSession();
  return token ? user : null;
}

export async function setLanguageLocal(lang) {
  const l = normalizarLang(lang);
  memLang = l;
  try {
    const AsyncStorage = getAsyncStorage();
    await AsyncStorage.setItem(LANG_KEY, l);
    if (memUser) {
      memUser = { ...memUser, language: l };
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(memUser));
    }
  } catch {}
  return l;
}

// ================================================================
// HELPERS DE IMÁGENES
// ================================================================
const esDataUriImagen = (s) => typeof s === 'string' && /^data:image\//i.test(s);
const esUrlAbsoluta = (s) => typeof s === 'string' && /^(https?:|file:)/i.test(s);

const esFotoAceptable = (f) => {
  if (!f || typeof f !== 'string') return false;
  const s = f.trim();
  if (!s) return false;
  if (/^(https?:|file:|data:)/i.test(s)) return true;
  if (s.toUpperCase() === 'Z') return false;
  if (s.length < 3) return false;
  return true;
};

export function resolveUrl(value) {
  if (!value) return null;
  if (/^(https?:|file:|data:)/i.test(value)) return value;
  return `${API_URL}${value.startsWith('/') ? '' : '/'}${value}`;
}

export function resolveUserPhoto(foto) {
  if (!foto) return null;
  if (typeof foto === 'object') foto = foto.url || foto.path || foto.filename || foto.nombre || '';
  if (typeof foto !== 'string') return null;
  const clean = foto.trim();
  if (!clean || !esFotoAceptable(clean)) return null;
  if (/^(https?:|file:|data:)/i.test(clean)) return clean;
  if (!MEDIA_BASE) return null;
  if (/^(static|uploads)\//i.test(clean) || clean.startsWith('/')) {
    return `${MEDIA_BASE}/${clean.replace(/^\/+/, '')}`;
  }
  return `${MEDIA_BASE}/static/uploads/${clean}`;
}

export function resolveProductPhoto(foto) {
  if (!foto) return null;
  if (typeof foto === 'object') foto = foto.url || foto.nombre || foto.path || foto.filename || '';
  if (typeof foto !== 'string') return null;
  const clean = foto.trim();
  if (!clean || !esFotoAceptable(clean)) return null;

  if (esDataUriImagen(clean)) return clean;
  if (/^(https?:|file:)/i.test(clean)) return clean;

  if (!MEDIA_BASE) return null;
  if (/^(static|uploads)\//i.test(clean) || clean.startsWith('/')) {
    return `${MEDIA_BASE}/${clean.replace(/^\/+/, '')}`;
  }
  if (clean.includes('/')) {
    return `${MEDIA_BASE}/static/${clean.replace(/^\/+/, '')}`;
  }
  return `${MEDIA_BASE}/static/uploads/productos/${clean}`;
}

export function resolveCleanPhoto(foto) {
  if (!foto) return null;
  if (typeof foto === 'object') foto = foto.url || foto.nombre || foto.path || foto.filename || '';
  if (typeof foto !== 'string') return null;
  const clean = foto.trim();
  if (!clean || !esFotoAceptable(clean)) return null;
  if (esDataUriImagen(clean)) return clean;
  if (/^(https?:|file:|data:)/i.test(clean)) return clean;
  if (!MEDIA_BASE) return null;
  const nombreBase = String(clean).split('/').pop().replace(/\.[^.]+$/, '');
  return `${MEDIA_BASE}/static/uploads/productos_clean/${nombreBase}.png`;
}

export function extraerPrimeraFotoValida(item = {}) {
  const cleanArr = Array.isArray(item.fotos_clean) ? item.fotos_clean.filter(Boolean) : [];
  for (const raw of cleanArr) {
    if (typeof raw === 'string' && /^https?:/i.test(raw)) return raw;
    const url = resolveCleanPhoto(raw);
    if (url) return url;
  }
  const fotos = Array.isArray(item.fotos) ? item.fotos.filter(Boolean) : [];
  for (const raw of fotos) {
    if (typeof raw === 'string') {
      if (/^https?:/i.test(raw) || esDataUriImagen(raw)) return raw;
      const url = resolveProductPhoto(raw);
      if (url) return url;
    } else if (raw && typeof raw === 'object' && raw.url) {
      if (/^https?:/i.test(raw.url) || esDataUriImagen(raw.url)) return raw.url;
      const url = resolveProductPhoto(raw.url);
      if (url) return url;
    }
  }
  const imagenes = Array.isArray(item.imagenes) ? item.imagenes.filter(Boolean) : [];
  for (const raw of imagenes) {
    if (typeof raw === 'string') {
      if (/^https?:/i.test(raw) || esDataUriImagen(raw)) return raw;
      const url = resolveProductPhoto(raw);
      if (url) return url;
    }
  }
  for (const campo of ['imagen', 'imagen_url', 'image', 'foto']) {
    const raw = item[campo];
    if (!raw) continue;
    if (typeof raw === 'string') {
      if (/^https?:/i.test(raw) || esDataUriImagen(raw)) return raw;
      const url = resolveProductPhoto(raw);
      if (url) return url;
    } else if (typeof raw === 'object' && raw.url) {
      if (/^https?:/i.test(raw.url) || esDataUriImagen(raw.url)) return raw.url;
      const url = resolveProductPhoto(raw.url);
      if (url) return url;
    }
  }
  return null;
}

export function normalizeProduct(p = {}) {
  const imgs = Array.isArray(p.imagenes) ? p.imagenes : Array.isArray(p.images) ? p.images : [];
  const image = p.image || p.imagen || p.imagen_url || imgs[0];
  const activo = p.activo !== false && p.estado !== 'inactivo';
  return {
    id: String(p.id || p._id || ''),
    name: p.name || p.nombre || '',
    price: String(p.price ?? p.precio ?? 0),
    image: resolveUrl(typeof image === 'string' ? image : image?.url) || null,
    description: p.description || p.descripcion || '',
    category: p.category || p.categoria_nombre || p.categoria || '',
    stock: Number(p.stock ?? p.existencias ?? 0),
    status: p.status || (!activo ? 'Inactivo' : Number(p.stock ?? 1) === 0 ? 'Agotado' : 'Activo'),
    videoUrl: p.videoUrl || p.video_url || '',
  };
}

// ================================================================
// normalizeOrder
// ================================================================
const _primer = (obj, ...keys) => {
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return null;
};

const _normalizarDireccionOrder = (raw) => {
  if (!raw) return null;
  if (typeof raw === 'string') return { raw };
  if (typeof raw !== 'object') return null;
  return {
    calle: raw.calle || raw.street || '',
    numero: raw.numero || raw.numero_exterior || raw.number || '',
    numero_int: raw.numero_interior || '',
    colonia: raw.colonia || raw.barrio || '',
    ciudad: raw.ciudad || raw.city || '',
    estado: raw.estado || raw.state || '',
    cp: String(raw.cp ?? raw.codigo_postal ?? raw.zip ?? '').replace(/\D/g, ''),
    pais: raw.pais || raw.country || 'México',
    referencias: raw.referencias || raw.references || '',
    telefono: raw.telefono || raw.phone || '',
  };
};

const _normalizarItemOrder = (x = {}) => {
  const imagen = x.imagen || x.foto || x.image || x.foto_url || null;
  const atributosRaw = x.atributos && typeof x.atributos === 'object' ? x.atributos : {};
  const color = x.color || atributosRaw.color || null;
  const tamano = x.size || x.talla || x.tamano || atributosRaw.tamano || atributosRaw.talla || null;
  return {
    productId: String(x.productId || x.producto_id || x.id || ''),
    name: x.name || x.nombre || 'Artículo',
    quantity: Number(x.quantity ?? x.cantidad ?? 1),
    unitPrice: Number(x.unitPrice ?? x.precio ?? x.precio_unitario ?? 0),
    size: tamano || null,
    color: color || null,
    sku: x.sku || '',
    image: imagen,
    atributos: atributosRaw,
  };
};

const _normalizarPaymentStatus = (o = {}) => {
  const raw = _primer(o, 'paymentStatus', 'payment_status', 'estado_pago', 'pago_estado');
  if (raw !== null && raw !== undefined && raw !== '') {
    const v = String(raw).toLowerCase().trim();
    if (['pagado', 'aprobado', 'completado', 'paid', 'approved', 'capturado'].includes(v)) return 'pagado';
    if (['rechazado', 'fallido', 'failed', 'rejected'].includes(v)) return 'rechazado';
    if (['reembolsado', 'refunded'].includes(v)) return 'reembolsado';
    if (v === 'no_pagado' || v === 'no pagado' || v === 'unpaid') return 'pendiente';
    return v;
  }
  if (o.pagado === true) return 'pagado';
  return 'pendiente';
};

export function normalizeOrder(o = {}) {
  const rawItems = Array.isArray(o.items) ? o.items : Array.isArray(o.productos) ? o.productos : [];
  const items = rawItems.map(_normalizarItemOrder);

  const status = String(o.status || o.estado || 'pendiente').toLowerCase();
  const paymentStatus = _normalizarPaymentStatus(o);

  const createdAt =
    o.createdAt || o.created_at || o.fecha || o.fecha_creacion ||
    o.creado_en || o.fecha_pedido || o.timestamp || o.date || null;

  const fechaEntregaEstimada = _primer(o, 'fecha_entrega_estimada', 'fechaEntregaEstimada', 'entrega_estimada');
  const fechaEntregaReal = _primer(o, 'fecha_entrega_real', 'fechaEntregaReal', 'entrega_real');

  return {
    id: String(o.id || o._id || o.numero_pedido || ''),
    numero_pedido: String(_primer(o, 'numero_pedido', 'numeroPedido', 'numero', 'folio') || o.id || o._id || ''),
    items,
    status,
    paymentStatus,
    totalEstimado: Number(o.totalEstimado ?? o.total ?? 0),
    subtotalEstimado: Number(o.subtotalEstimado ?? o.subtotal ?? 0),
    envioEstimado: Number(o.envioEstimado ?? o.envio ?? 0),
    iva: Number(o.iva ?? o.tax ?? 0),
    descuento_total: Number(_primer(o, 'descuento_total', 'descuento') ?? 0),
    porcentaje_descuento: Number(o.porcentaje_descuento ?? 0),
    total_unidades: Number(_primer(o, 'total_unidades', 'unidades') ?? 0),
    es_mayorista: !!o.es_mayorista,
    metodo_pago: String(_primer(o, 'metodo_pago', 'metodoPago', 'metodo') || ''),
    tipo_envio: String(_primer(o, 'tipo_envio', 'tipoEnvio') || '').toLowerCase(),
    tienda_recogida: _primer(o, 'tienda_recogida', 'tiendaRecogida') || '',
    codigo_recogida: _primer(o, 'codigo_recogida', 'codigoRecogida') || '',
    oxxo_referencia: _primer(o, 'oxxo_referencia', 'oxxoReferencia') || null,
    oxxo_vence: _primer(o, 'oxxo_vence', 'oxxoVence') || null,
    oxxo_voucher_url: _primer(o, 'oxxo_voucher_url', 'oxxoVoucherUrl') || null,
    fecha_entrega_estimada: fechaEntregaEstimada,
    fecha_entrega_real: fechaEntregaReal,
    address: _normalizarDireccionOrder(o.address || o.direccion),
    phone: _primer(o, 'phone', 'telefono') || '',
    notas: _primer(o, 'notas', 'nota', 'comentarios') || '',
    nivel_lealtad: _primer(o, 'nivel_lealtad', 'nivel') || '',
    puntos_ganados: Number(o.puntos_ganados ?? 0),
    puntos_multiplicador: Number(o.puntos_multiplicador ?? 1),
    cashback_ganado: Number(o.cashback_ganado ?? 0),
    createdAt,
  };
}

export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

const toFormBody = (obj) =>
  Object.keys(obj).map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(obj[k] ?? '')}`).join('&');

const esRutaAdmin = (path) => /\/admin(\/|$)/i.test(path);

async function _logSiEsUtil(status, method, path, token, auth = true) {
  if (!DEBUG) return;
  if (status === 401) {
    if (auth === false) return;
    const { user } = await loadSession().catch(() => ({ user: null }));
    if (!user) return;
    if (!token && esRutaAdmin(path) && path.includes('/chat/')) return;
    console.warn(`[api.js] ⚠️ 401 en ${method} ${path}`);
    console.warn(`         token: ${token ? token.slice(0, 25) + '...' : '(NINGUNO)'}`);
    return;
  }
  if (status === 403) {
    if (!esRutaAdmin(path)) {
      console.warn(`[api.js] ⚠️ 403 en ${method} ${path}`);
      return;
    }
    const { user } = await loadSession().catch(() => ({ user: null }));
    if (user?.role === 'admin') {
      console.warn(`[api.js] ⚠️ 403 en ${method} ${path} — el usuario es admin pero el backend lo rechaza`);
    }
  }
}

const _yaTieneLang = (path) => /[?&]lang=/i.test(path);

export async function request(path, { method = 'GET', body, form, auth = true, headers = {} } = {}) {
  const { token, lang } = await loadSession();
  const idioma = normalizarLang(lang);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);

  let finalPath = path;
  const sep = path.includes('?') ? '&' : '?';
  if (!_yaTieneLang(path)) {
    finalPath = `${path}${sep}lang=${idioma}`;
  }
  if (method === 'GET') {
    const sep2 = finalPath.includes('?') ? '&' : '?';
    finalPath = `${finalPath}${sep2}_t=${Date.now()}`;
  }
  const url = `${SECURE_API_URL}${finalPath}`;

  if (DEBUG && auth && !token) {
    const { user } = await loadSession().catch(() => ({ user: null }));
    if (user?.role === 'admin') {
      console.warn(`[api.js] ⚠️ ${method} ${path} → auth=true pero NO hay token.`);
    }
  }

  const finalHeaders = {
    Accept: 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
    'Accept-Language': idioma === 'en' ? 'en-US,en;q=0.9' : 'es-MX,es;q=0.9',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    Pragma: 'no-cache',
    'X-Content-Type-Options': 'nosniff',
    ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    ...(form !== undefined ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
    ...(auth && token ? { Authorization: `Bearer ${token}` } : {}),
    ...headers,
  };

  let finalBody;
  if (form !== undefined) {
    finalBody = toFormBody(form);
  } else if (body !== undefined) {
    if (typeof body === 'string') {
      if (DEBUG) {
        console.warn(
          `[api.js] ⚠️ body es STRING en ${method} ${path}. ` +
          `Debería ser un objeto. Enviando tal cual para evitar doble-stringify.`,
        );
        console.warn('[api.js] body recibido:', body.slice(0, 200));
      }
      finalBody = body;
    } else {
      finalBody = JSON.stringify(body);
    }
  }

  if (DEBUG && (method === 'POST' || method === 'PUT')) {
    try {
      console.log(`📤 [request] ${method} ${path}`);
      if (typeof body === 'string') {
        console.log('   BODY (string):', body);
      } else if (body !== undefined) {
        console.log('   BODY:', JSON.stringify(body, null, 2));
        if (body && typeof body === 'object') {
          console.log('   metodo_pago =>', JSON.stringify(body.metodo_pago));
        }
      } else {
        console.log('   (sin body)');
      }
    } catch {
      console.log(`📤 [request] ${method} ${path} (body no serializable)`);
    }
  }

  try {
    const res = await fetch(url, {
      method,
      signal: ctrl.signal,
      headers: finalHeaders,
      body: finalBody,
      cache: 'no-store',
    });
    let data = null;
    const text = await res.text();
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text };
    }
    if (!res.ok) {
      await _logSiEsUtil(res.status, method, path, token, auth);
      const msg = (data && (data.error || data.message || data.mensaje)) || `Error ${res.status}`;
      throw new ApiError(msg, res.status, data);
    }
    return data;
  } catch (e) {
    if (e.name === 'AbortError') throw new ApiError('Tiempo de espera agotado', 0);
    if (e instanceof ApiError) throw e;
    throw new ApiError('Sin conexión con el servidor', 0);
  } finally {
    clearTimeout(timer);
  }
}

const listFrom = (data, ...keys) => {
  if (Array.isArray(data)) return data;
  for (const k of keys) if (data && Array.isArray(data[k])) return data[k];
  return [];
};

// ================================================================
// ⭐ HELPERS DE LOGIN (buscan el token en todos los formatos posibles)
// ================================================================
const _extraerToken = (data) => {
  if (!data || typeof data !== 'object') return null;
  const candidatos = [
    data.token,
    data.access_token,
    data.accessToken,
    data.jwt,
    data.bearer,
    data.auth_token,
    data.id_token,
    data?.data?.token,
    data?.data?.access_token,
    data?.data?.accessToken,
    data?.data?.jwt,
    data?.data?.bearer,
    data?.usuario?.token,
    data?.user?.token,
  ];
  for (const c of candidatos) {
    if (typeof c === 'string' && c.trim()) return c.trim();
  }
  return null;
};

const _extraerUsuario = (data) => {
  if (!data || typeof data !== 'object') return {};
  return (
    data.usuario ||
    data.user ||
    data?.data?.usuario ||
    data?.data?.user ||
    data?.data ||
    data ||
    {}
  );
};

// ================================================================
// AUTH
// ================================================================
export async function login(email, password) {
  const data = await request(`${API_PREFIX}/auth/login`, {
    method: 'POST',
    auth: false,
    body: { email: String(email || '').trim().toLowerCase(), password: String(password || '') },
  });

  if (DEBUG) {
    console.log('📥 [login] JSON del backend:', JSON.stringify(data, null, 2).slice(0, 600));
  }

  if (data?.requires_2fa === true) {
    const tempToken =
      data?.temp_token ||
      data?.tempToken ||
      data?.two_factor_token ||
      null;

    if (!tempToken) {
      throw new ApiError(
        'El backend pidió 2FA pero no envió temp_token. Revisa auth_controller.',
        500,
        data
      );
    }

    if (DEBUG) {
      console.log('🔐 [login] 2FA requerido. temp_token:', tempToken.slice(0, 25) + '...');
    }

    return {
      requires_2fa: true,
      temp_token: tempToken,
      message: data?.message || 'Ingresa tu código de verificación',
    };
  }

  const token = _extraerToken(data);
  if (!token) {
    if (DEBUG) {
      console.error(
        '❌ [login] NO se encontró token en la respuesta. Campos disponibles:',
        data && typeof data === 'object' ? Object.keys(data) : data
      );
    }
    throw new ApiError(
      'Respuesta de login inválida (sin token). Backend devolvió: ' +
        JSON.stringify(data).slice(0, 300),
      500,
      data
    );
  }

  const rawUser = _extraerUsuario(data);
  const user = normalizeUser(rawUser);
  user.perfil_completo = !!(
    data.perfil_completo ??
    data.data?.perfil_completo ??
    rawUser.perfil_completo ??
    false
  );
  if (data.fotoUrl && !user.fotoUrl) {
    user.fotoUrl = resolveUserPhoto(data.fotoUrl);
  }

  await saveSession(token, user);

  if (DEBUG) {
    console.log('✅ [login] OK:', user.email, '| rol:', user.role);
  }

  return { ...user, requires_2fa: false };
}

export async function verify2FA(temp_token, codigo) {
  const c = String(codigo || '').replace(/\D/g, '').slice(0, 6);
  if (!temp_token) throw new ApiError('temp_token requerido', 400);
  if (c.length !== 6) throw new ApiError('Ingresa el código de 6 dígitos', 400);

  const data = await request(`${API_PREFIX}/auth/2fa/verificar`, {
    method: 'POST',
    auth: false,
    body: { temp_token, codigo: c },
  });

  if (DEBUG) {
    console.log('📥 [verify2FA] JSON del backend:', JSON.stringify(data, null, 2).slice(0, 600));
  }

  const token = _extraerToken(data);
  if (!token) {
    throw new ApiError(
      'Respuesta de verificación 2FA inválida (sin token). Backend devolvió: ' +
        JSON.stringify(data).slice(0, 300),
      500,
      data
    );
  }

  const rawUser = _extraerUsuario(data);
  const user = normalizeUser(rawUser);
  user.perfil_completo = !!(
    data.perfil_completo ??
    data.data?.perfil_completo ??
    rawUser.perfil_completo ??
    false
  );

  await saveSession(token, user);

  if (DEBUG) {
    console.log('✅ [verify2FA] login completo:', user.email, '| rol:', user.role);
  }

  return user;
}

export async function register({ name, nombre, email, password }) {
  const nombreFinal = String(nombre || name || '').trim();
  const emailFinal = String(email || '').trim().toLowerCase();

  if (!nombreFinal) throw new ApiError('El nombre es obligatorio', 400);
  if (!emailFinal) throw new ApiError('El correo es obligatorio', 400);
  if (!password) throw new ApiError('La contraseña es obligatoria', 400);

  const data = await request(`${API_PREFIX}/auth/register`, {
    method: 'POST',
    auth: false,
    body: {
      nombre: nombreFinal,
      name: nombreFinal,
      email: emailFinal,
      password: String(password),
    },
  });
  return data;
}

export async function reenviarConfirmacion(email) {
  const emailFinal = String(email || '').trim().toLowerCase();
  if (!emailFinal) throw new ApiError('email requerido', 400);

  return request(`${API_PREFIX}/auth/reenviar-confirmacion`, {
    method: 'POST',
    auth: false,
    body: { email: emailFinal },
  });
}

export async function completarPerfil({
  usuario_id,
  nombre,
  apellido_p,
  apellido_m,
  dia,
  mes,
  anio,
  genero,
}) {
  if (!usuario_id) throw new ApiError('usuario_id requerido', 400);
  if (!nombre || !apellido_p) throw new ApiError('nombre y apellido_paterno requeridos', 400);
  if (!genero) throw new ApiError('genero requerido', 400);

  const d = parseInt(dia, 10);
  const m = parseInt(mes, 10);
  const y = parseInt(anio, 10);
  if (!(d >= 1 && d <= 31 && m >= 1 && m <= 12 && y >= 1900 && y <= 2026)) {
    throw new ApiError('Fecha de nacimiento inválida', 400);
  }

  return request(`${API_PREFIX}/perfil/completar`, {
    method: 'POST',
    body: {
      usuario_id,
      nombre: String(nombre).trim(),
      apellido_p: String(apellido_p).trim(),
      apellido_m: String(apellido_m || '').trim(),
      dia: d,
      mes: m,
      anio: y,
      genero: String(genero).trim().toLowerCase(),
    },
  });
}

export async function fetchPerfilEstado() {
  try {
    const data = await request(`${API_PREFIX}/auth/me`);
    const raw = data.user || data.usuario || data;
    return {
      email_confirmado: raw.email_confirmado !== false,
      perfil_completo: !!raw.perfil_completo,
    };
  } catch {
    return { email_confirmado: false, perfil_completo: false };
  }
}

export const normalizeUser = (u = {}) => {
  const genero = normalizarGenero(u.genero ?? u.sexo ?? u.gender ?? '');
  const rolRaw = String(u.role || u.rol || 'cliente').toLowerCase().trim();
  let role = 'cliente';
  if (['admin', 'administrador', 'administrator', 'superadmin', 'root'].includes(rolRaw)) role = 'admin';
  else if (['vendedor', 'seller', 'vendor'].includes(rolRaw)) role = 'vendedor';
  else role = rolRaw || 'cliente';

  const fotoRaw =
    u.foto ?? u.avatar ?? u.imagen ?? u.photo ?? u.profile_picture ?? u.picture ?? null;
  const fotoUrlDirecta =
    u.fotoUrl ?? u.foto_url ?? u.avatarUrl ?? u.avatar_url ?? null;

  const fotoResuelta =
    resolveUserPhoto(fotoUrlDirecta) || resolveUserPhoto(fotoRaw) || null;

  const langRaw =
    u.language ??
    u.idioma ??
    u.preferencias_idioma?.idioma ??
    u.preferencias?.idioma ??
    '';

  return {
    id: String(u.id || u._id || u.user_id || ''),
    name: u.name || u.nombre || u.username || '',
    email: u.email || u.correo || '',
    role,
    genero,
    sexo: genero,
    language: normalizarLang(langRaw),
    favoritos: Array.isArray(u.favoritos) ? u.favoritos.map(String) : [],
    perfil_completo: !!u.perfil_completo,
    foto: fotoRaw,
    fotoUrl: fotoResuelta,
  };
};

export const isAdmin = (user) => !!user && user.role === 'admin';

export async function fetchMe() {
  const data = await request(`${API_PREFIX}/auth/me`);
  const raw = data.user || data.usuario || data;
  const user = normalizeUser(raw);
  user.direcciones = Array.isArray(raw.direcciones)
    ? raw.direcciones
    : Array.isArray(raw.addresses)
    ? raw.addresses
    : [];
  user.favoritos = Array.isArray(raw.favoritos) ? raw.favoritos.map(String) : [];
  user.perfil_completo = !!raw.perfil_completo;
  const { token } = await loadSession();
  await saveSession(token, user);
  return user;
}

export async function logout() {
  try {
    await request(`${API_PREFIX}/auth/logout`, { method: 'POST' });
  } catch {}
  await clearSession();
}

export async function requestPasswordReset(email) {
  const emailFinal = String(email || '').trim().toLowerCase();
  if (!emailFinal) throw new ApiError('email requerido', 400);

  return request(`${API_PREFIX}/auth/recuperar`, {
    method: 'POST',
    auth: false,
    body: { email: emailFinal },
  });
}

// ================================================================
// DIRECCIONES
// ================================================================
const normalizarDir = (d = {}) => ({
  id: d.id ?? d._id ?? null,
  nombre: d.alias || d.nombre || `Dirección ${d.id ?? ''}`.trim(),
  calle: d.calle || '',
  numero: String(d.numero ?? d.numero_exterior ?? '').trim(),
  numero_interior: d.numero_interior || '',
  cp: String(d.cp ?? d.codigo_postal ?? '').replace(/\D/g, ''),
  colonia: d.colonia || '',
  ciudad: d.ciudad || '',
  estado: d.estado || '',
  pais: d.pais || 'México',
  referencias: d.referencias || '',
  telefono: d.telefono || '',
  predeterminada: !!d.predeterminada,
});

const dirToBackend = (d = {}) => ({
  alias: d.nombre || d.alias || 'Mi dirección',
  nombre: d.nombre || d.alias || '',
  telefono: d.telefono || '',
  calle: d.calle || '',
  numero_exterior: String(d.numero ?? d.numero_exterior ?? '').trim(),
  numero_interior: d.numero_interior || '',
  colonia: d.colonia || '',
  ciudad: d.ciudad || '',
  estado: d.estado || '',
  codigo_postal: String(d.cp ?? d.codigo_postal ?? '').replace(/\D/g, ''),
  pais: d.pais || 'México',
  referencias: d.referencias || '',
  predeterminada: !!d.predeterminada,
});

export async function fetchDirecciones() {
  try {
    const r = await request(`${CUENTA_BASE}/direcciones`, { method: 'GET' });
    const raw =
      (Array.isArray(r?.data) && r.data) ||
      (Array.isArray(r?.direcciones) && r.direcciones) ||
      (Array.isArray(r) && r) ||
      [];
    if (raw.length || (Array.isArray(r?.data) && r.data.length === 0)) return raw.map(normalizarDir);
  } catch {}
  try {
    const u = await fetchMe();
    return Array.isArray(u?.direcciones) ? u.direcciones.map(normalizarDir) : [];
  } catch {
    return [];
  }
}

export async function guardarDirecciones(direcciones) {
  if (!Array.isArray(direcciones)) throw new ApiError('direcciones debe ser un array', 400);
  const payloadBackend = direcciones.map(dirToBackend);
  try {
    const r = await request(`${CUENTA_BASE}/direcciones`, {
      method: 'PUT',
      body: { direcciones: payloadBackend },
    });
    return r;
  } catch {}
  try {
    let ultima = null;
    for (const d of payloadBackend) {
      ultima = await request(`${CUENTA_BASE}/direcciones`, { method: 'POST', body: d });
    }
    return ultima;
  } catch {}
  throw new ApiError('No se pudieron guardar las direcciones', 500);
}

const _aplicarPredeterminadaUnica = (dirs) => {
  const idxPred = dirs.findIndex((x) => x.predeterminada);
  if (idxPred === -1 && dirs.length > 0) {
    dirs[0].predeterminada = true;
  } else {
    dirs.forEach((x, i) => {
      x.predeterminada = i === idxPred;
    });
  }
  return dirs;
};

const _siguienteId = (dirs) =>
  dirs.reduce((m, x) => Math.max(m, Number(x.id) || 0), 0) + 1;

export async function crearDireccion(dir) {
  const actuales = await fetchDirecciones();
  const nueva = {
    id: _siguienteId(actuales),
    nombre: dir.nombre || dir.alias || '',
    calle: dir.calle || '',
    numero: String(dir.numero ?? dir.numero_exterior ?? '').trim(),
    numero_interior: dir.numero_interior || '',
    cp: String(dir.cp ?? dir.codigo_postal ?? '').replace(/\D/g, ''),
    colonia: dir.colonia || '',
    ciudad: dir.ciudad || '',
    estado: dir.estado || '',
    pais: dir.pais || 'México',
    referencias: dir.referencias || '',
    telefono: dir.telefono || '',
    predeterminada: !!dir.predeterminada,
  };
  if (nueva.predeterminada) {
    actuales.forEach((x) => (x.predeterminada = false));
  } else if (actuales.length === 0) {
    nueva.predeterminada = true;
  }
  const todas = [...actuales, nueva];
  await guardarDirecciones(todas);
  return todas;
}

export async function actualizarDireccion(id, dir) {
  const actuales = await fetchDirecciones();
  const idx = actuales.findIndex((x) => String(x.id) === String(id));
  if (idx < 0) throw new ApiError('Dirección no encontrada', 404);

  const actualizada = {
    ...actuales[idx],
    nombre: dir.nombre || dir.alias || '',
    calle: dir.calle || '',
    numero: String(dir.numero ?? dir.numero_exterior ?? '').trim(),
    numero_interior: dir.numero_interior || '',
    cp: String(dir.cp ?? dir.codigo_postal ?? '').replace(/\D/g, ''),
    colonia: dir.colonia || '',
    ciudad: dir.ciudad || '',
    estado: dir.estado || '',
    pais: dir.pais || 'México',
    referencias: dir.referencias || '',
    telefono: dir.telefono || '',
    predeterminada: !!dir.predeterminada,
  };
  actuales[idx] = actualizada;

  if (actualizada.predeterminada) {
    actuales.forEach((d, i) => {
      if (i !== idx) d.predeterminada = false;
    });
  } else {
    _aplicarPredeterminadaUnica(actuales);
  }
  await guardarDirecciones(actuales);
  return actuales;
}

export async function eliminarDireccion(id) {
  const actuales = await fetchDirecciones();
  const idx = actuales.findIndex((x) => String(x.id) === String(id));
  if (idx < 0) throw new ApiError('Dirección no encontrada', 404);

  const eraPred = actuales[idx].predeterminada;
  const restantes = actuales.filter((_, i) => i !== idx);
  if (eraPred && restantes.length > 0) restantes[0].predeterminada = true;

  await guardarDirecciones(restantes);
  return restantes;
}

export async function marcarDireccionPredeterminada(id) {
  const actuales = await fetchDirecciones();
  let encontrada = false;
  actuales.forEach((d) => {
    if (String(d.id) === String(id)) {
      d.predeterminada = true;
      encontrada = true;
    } else {
      d.predeterminada = false;
    }
  });
  if (!encontrada) throw new ApiError('Dirección no encontrada', 404);
  await guardarDirecciones(actuales);
  return actuales;
}

// ================================================================
// FAVORITOS — CLIENTE
// ================================================================
const _primeraFotoResuelta = (p = {}) => {
  const candidatos = [];
  if (Array.isArray(p.fotos)) candidatos.push(...p.fotos);
  if (Array.isArray(p.imagenes)) candidatos.push(...p.imagenes);
  if (p.imagen) candidatos.push(p.imagen);
  if (p.imagen_url) candidatos.push(p.imagen_url);
  if (p.image) candidatos.push(p.image);
  if (p.foto) candidatos.push(p.foto);

  for (const raw of candidatos) {
    if (!raw) continue;

    if (typeof raw === 'string') {
      if (esDataUriImagen(raw)) return raw;
      if (esUrlAbsoluta(raw)) return raw;
      const url = resolveProductPhoto(raw);
      if (url) return url;
    } else if (typeof raw === 'object') {
      const u = raw.url || raw.src || raw.href || raw.nombre || raw.path || raw.filename || '';
      if (!u) continue;
      if (esDataUriImagen(u)) return u;
      if (esUrlAbsoluta(u)) return u;
      const url = resolveProductPhoto(u);
      if (url) return url;
    }
  }
  return null;
};

const _mapFavoritoProducto = (p = {}) => {
  const variables = Array.isArray(p.variables)
    ? p.variables
    : Array.isArray(p.variantes)
    ? p.variantes
    : [];

  const precio = variables.length
    ? Number(variables[0].precio ?? 0)
    : Number(p.precio ?? p.price ?? 0);

  const fotos = Array.isArray(p.fotos) ? p.fotos.filter(Boolean) : [];
  const imagen = _primeraFotoResuelta(p);

  if (DEBUG && !imagen && (p.nombre || p.id || p._id)) {
    console.warn('[favoritos] producto sin foto válida:', p.id || p._id, p.nombre);
  }

  return {
    id: String(p.id || p._id || ''),
    nombre: p.nombre || p.name || '',
    descripcion: p.descripcion || p.description || '',
    precio,
    fotos,
    imagen,
    categoria_nombre: p.categoria_nombre || p.categoria || '',
    marca_nombre: p.marca_nombre || '',
    variables,
  };
};

const _normalizarIdsFavoritos = (raw) => {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((x) => {
      if (!x) return '';
      if (typeof x === 'string') return x;
      if (typeof x === 'number') return String(x);
      return String(x.producto_id || x.productoId || x._id || x.id || '');
    })
    .filter(Boolean);
};

export async function fetchFavoritosIds() {
  try {
    const data = await request(`${CUENTA_BASE}/favoritos`);
    if (Array.isArray(data?.ids)) return _normalizarIdsFavoritos(data.ids);
    if (Array.isArray(data?.favoritos)) return _normalizarIdsFavoritos(data.favoritos);
    const productos =
      (Array.isArray(data?.productos) && data.productos) ||
      (Array.isArray(data?.data) && data.data) ||
      (Array.isArray(data) && data) ||
      [];
    return productos.map((p) => String(p.id || p._id || '')).filter(Boolean);
  } catch {}

  try {
    const me = await request(`${API_PREFIX}/auth/me`);
    const rawUser = me?.user || me?.usuario || me || {};
    const idsRaw =
      rawUser.favoritos ||
      rawUser.favorites ||
      rawUser.productos_favoritos ||
      [];
    return _normalizarIdsFavoritos(idsRaw);
  } catch {
    return [];
  }
}

export async function fetchFavoritos() {
  try {
    const data = await request(`${CUENTA_BASE}/favoritos`);
    const raw =
      (Array.isArray(data?.productos) && data.productos) ||
      (Array.isArray(data?.data) && data.data) ||
      (Array.isArray(data?.favoritos) && data.favoritos) ||
      (Array.isArray(data) && data) ||
      [];

    if (Array.isArray(data?.productos)) {
      if (DEBUG) console.log('[favoritos] endpoint dedicado →', raw.length, 'productos');
      return raw.map(_mapFavoritoProducto);
    }
    if (raw.length > 0) {
      if (DEBUG) console.log('[favoritos] endpoint dedicado (data) →', raw.length, 'productos');
      return raw.map(_mapFavoritoProducto);
    }
  } catch (e) {
    if (DEBUG) console.warn('[favoritos] endpoint dedicado falló:', e?.status, e?.message);
  }

  try {
    const me = await request(`${API_PREFIX}/auth/me`);
    const rawUser = me?.user || me?.usuario || me || {};
    const idsRaw =
      rawUser.favoritos ||
      rawUser.favorites ||
      rawUser.productos_favoritos ||
      [];
    const ids = _normalizarIdsFavoritos(idsRaw);
    if (DEBUG) console.log('[favoritos] fallback /auth/me ids:', ids.length);
    if (ids.length === 0) return [];

    const productos = [];
    for (const id of ids) {
      try {
        const r = await request(`${API_PREFIX}/productos/${id}`, { auth: false });
        const raw = r?.data || r;
        if (raw && (raw._id || raw.id || raw.nombre)) {
          productos.push(_mapFavoritoProducto(raw));
        }
      } catch {}
    }
    if (DEBUG) console.log('[favoritos] fallback hidratados:', productos.length);
    return productos;
  } catch {
    return [];
  }
}

export async function agregarFavorito(productoId) {
  if (!productoId) throw new ApiError('productoId requerido', 400);
  const id = String(productoId);

  try {
    return await request(`${CUENTA_BASE}/favoritos/${encodeURIComponent(id)}`, {
      method: 'POST',
    });
  } catch {}

  try {
    const ids = await fetchFavoritosIds();
    if (ids.includes(id)) return { ok: true, ya_estaba: true };
    return await request(`${CUENTA_BASE}/favoritos/toggle`, {
      method: 'POST',
      body: { producto_id: id },
    });
  } catch {}

  try {
    return await request(`/favoritos/agregar/${encodeURIComponent(id)}`, {
      method: 'POST',
    });
  } catch {}

  try {
    return await request(`/api/favoritos/agregar/${encodeURIComponent(id)}`, {
      method: 'POST',
    });
  } catch {}

  throw new ApiError('No se pudo agregar a favoritos', 500);
}

export async function quitarFavorito(productoId) {
  if (!productoId) throw new ApiError('productoId requerido', 400);
  const id = String(productoId);

  try {
    return await request(`${CUENTA_BASE}/favoritos/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  } catch {}

  try {
    const ids = await fetchFavoritosIds();
    if (!ids.includes(id)) return { ok: true, ya_no_estaba: true };
    return await request(`${CUENTA_BASE}/favoritos/toggle`, {
      method: 'POST',
      body: { producto_id: id },
    });
  } catch {}

  try {
    return await request(`/favoritos/eliminar/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  } catch {}

  try {
    return await request(`/api/favoritos/eliminar/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  } catch {}

  throw new ApiError('No se pudo quitar de favoritos', 500);
}

export async function toggleFavorito(productoId) {
  if (!productoId) throw new ApiError('productoId requerido', 400);
  const id = String(productoId);

  const intentos = [
    `${CUENTA_BASE}/favoritos/toggle`,
    `/api/favoritos/toggle`,
    `/favoritos/toggle`,
  ];

  for (const url of intentos) {
    try {
      const r = await request(url, {
        method: 'POST',
        body: { producto_id: id },
      });
      const on =
        r?.favorito ??
        r?.es_favorito ??
        r?.data?.favorito ??
        r?.data?.es_favorito ??
        null;
      return { ok: true, favorito: typeof on === 'boolean' ? on : null, raw: r };
    } catch (e) {
      if (DEBUG) console.warn('[favoritos] toggle', url, 'falló:', e?.status);
    }
  }

  try {
    const ids = await fetchFavoritosIds();
    const estaba = ids.includes(id);
    if (estaba) {
      await quitarFavorito(id);
      return { ok: true, favorito: false };
    }
    await agregarFavorito(id);
    return { ok: true, favorito: true };
  } catch (e) {
    throw new ApiError(
      e?.message || 'No se pudo actualizar el favorito',
      e?.status || 500
    );
  }
}

export async function esFavorito(productoId) {
  if (!productoId) return false;
  const id = String(productoId);

  try {
    const { user } = await loadSession();
    const arr = Array.isArray(user?.favoritos) ? user.favoritos : [];
    const idsLocal = _normalizarIdsFavoritos(arr);
    if (idsLocal.includes(id)) return true;
  } catch {}

  try {
    const idsRemotos = await fetchFavoritosIds();
    const esta = idsRemotos.includes(id);

    try {
      const { token, user } = await loadSession();
      if (token && user) {
        const actualizado = {
          ...user,
          favoritos: idsRemotos,
        };
        await saveSession(token, actualizado);
      }
    } catch {}

    return esta;
  } catch {}

  return false;
}

// ================================================================
// PRODUCTOS
// ================================================================
export async function fetchProducts() {
  const data = await request(`${API_PREFIX}/productos`, { auth: false });
  return listFrom(data, 'productos', 'data', 'items').map(normalizeProduct);
}

const productPayload = (p) => ({
  nombre: p.name,
  name: p.name,
  categoria: p.category,
  category: p.category,
  precio: Number(p.price),
  price: Number(p.price),
  stock: Number(p.stock) || 0,
  descripcion: p.description,
  description: p.description,
  estado: p.status,
  status: p.status,
  video_url: p.videoUrl,
  videoUrl: p.videoUrl,
  imagen: p.image,
  image: p.image,
});

export const createProduct = (p) =>
  request(`${API_PREFIX}/admin/productos/agregar`, { method: 'POST', body: productPayload(p) });
export const updateProduct = (id, p) =>
  request(`${API_PREFIX}/admin/productos/editar/${id}`, { method: 'POST', body: productPayload(p) });
export const deleteProduct = (id) =>
  request(`${API_PREFIX}/admin/productos/borrar/${id}`, { method: 'POST' });

// ================================================================
// PEDIDOS
// ================================================================
export async function fetchOrders() {
  const data = await request(`${API_PREFIX}/pedidos`);
  return listFrom(data, 'pedidos', 'data', 'items').map(normalizeOrder);
}

export const createOrder = (payload) =>
  request(`${API_PREFIX}/pedidos`, { method: 'POST', body: payload });

export async function fetchOrder(id) {
  const data = await request(`${API_PREFIX}/pedidos/${id}`);
  return normalizeOrder(data?.data || data);
}

export async function cancelOrder(id) {
  return request(`${API_PREFIX}/pedidos/${id}/cancelar`, { method: 'POST' });
}

export async function marcarPedidoPagado(
  pedidoId,
  { estado = 'pagado', referencia = null, monto = null } = {}
) {
  if (!pedidoId) throw new ApiError('pedidoId requerido', 400);
  const body = { estado };
  if (referencia !== null) body.referencia = referencia;
  if (monto !== null) body.monto = Number(monto);

  return request(
    `${API_PREFIX}/admin/pedidos/${encodeURIComponent(String(pedidoId))}/pago`,
    { method: 'POST', body }
  );
}

export function getVoucherOxxoUrl(voucherRelativo) {
  if (!voucherRelativo) return null;
  if (/^https?:/i.test(voucherRelativo)) return voucherRelativo;
  return `${SECURE_API_URL}${voucherRelativo.startsWith('/') ? '' : '/'}${voucherRelativo}`;
}

export async function abrirVoucherOxxo(pedidoId) {
  if (!pedidoId) throw new ApiError('pedidoId requerido', 400);
  const data = await request(`${API_PREFIX}/pedidos/${pedidoId}`);
  const pedido = data?.data || data;
  const voucherUrl = pedido?.oxxo_voucher_url;

  if (!voucherUrl) throw new ApiError('Este pedido no tiene voucher OXXO', 404);

  return getVoucherOxxoUrl(voucherUrl);
}

export async function descargarVoucherOxxo(pedidoId) {
  if (!pedidoId) throw new ApiError('pedidoId requerido', 400);

  const url = await abrirVoucherOxxo(pedidoId);

  let FileSystem;
  try {
    FileSystem = require('expo-file-system/legacy');
  } catch {
    FileSystem = require('expo-file-system');
  }
  if (!FileSystem || typeof FileSystem.downloadAsync !== 'function') {
    throw new ApiError('expo-file-system no disponible para descargar', 0);
  }

  const ext = /\.pdf(\?|$)/i.test(url) ? 'pdf' : 'html';
  const nombreArchivo = `voucher-oxxo-${pedidoId}.${ext}`;
  const dirDestino = FileSystem.cacheDirectory || FileSystem.documentDirectory;
  if (!dirDestino) throw new ApiError('No hay directorio de caché disponible', 0);

  const destino = `${dirDestino}${nombreArchivo}`;

  try {
    const { uri } = await FileSystem.downloadAsync(url, destino);
    return uri;
  } catch (e) {
    throw new ApiError(e?.message || 'No se pudo descargar el voucher', 0);
  }
}

// ================================================================
// ADMIN STATS
// ================================================================
const _pickArray = (data, ...keys) => {
  if (Array.isArray(data)) return data;
  for (const k of keys) {
    if (data && Array.isArray(data[k])) return data[k];
  }
  return [];
};

const _toDate = (v) => {
  if (!v) return null;
  if (v instanceof Date) return isNaN(v) ? null : v;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
};

const _extractCreatedAt = (o = {}) =>
  o.createdAt || o.created_at || o.fecha || o.fecha_creacion ||
  o.creado_en || o.fecha_pedido || o.timestamp || o.date || null;

async function _esAdminActual() {
  try {
    const { user } = await loadSession();
    return user?.role === 'admin';
  } catch {
    return false;
  }
}

export async function fetchAdminStats() {
  const out = { usersCount: 0, ordersToday: 0, pendingOrders: 0, couponsCount: 0 };

  const { token } = await loadSession();
  if (!token) {
    if (DEBUG) console.log('[stats] sin sesión — no se consultan endpoints admin');
    return out;
  }

  const esAdmin = await _esAdminActual();
  const logear = DEBUG && esAdmin;

  try {
    const u = await request(`${API_PREFIX}/admin/usuarios`);
    out.usersCount = _pickArray(u, 'usuarios', 'data', 'items', 'users').length;
  } catch (e) {
    if (logear) console.log('[stats] usuarios:', e.message);
  }

  const endpointsPedidos = [
    `${API_PREFIX}/admin/pedidos`,
    `${API_PREFIX}/pedidos`,
    `${API_PREFIX}/admin/orders`,
  ];
  let orders = [];
  for (const ep of endpointsPedidos) {
    try {
      const res = await request(ep);
      const rawList = _pickArray(res, 'pedidos', 'data', 'items', 'orders', 'results');
      if (rawList.length > 0 || Array.isArray(res?.data) || Array.isArray(res)) {
        orders = rawList.map((o) => {
          const norm = normalizeOrder(o);
          if (!norm.createdAt) norm.createdAt = _extractCreatedAt(o);
          norm.status = String(norm.status || '').toLowerCase();
          return norm;
        });
        if (logear) console.log(`[stats] pedidos desde ${ep}:`, orders.length);
        break;
      }
    } catch (e) {
      if (logear) console.log(`[stats] ${ep} falló:`, e.status, e.message);
    }
  }

  const start = new Date();
  start.setHours(0, 0, 0, 0);

  out.ordersToday = orders.filter((o) => {
    const d = _toDate(o.createdAt);
    if (!d) return false;
    return d >= start;
  }).length;

  out.pendingOrders = orders.filter((o) => /pend|prepar|nuevo|proces|por_|espera/i.test(o.status)).length;

  try {
    const resCoupons = await request(`${CUPONES_BASE}/cupones`);
    out.couponsCount = _pickArray(resCoupons, 'cupones', 'data', 'items').length;
  } catch (e) {
    if (logear) console.log('[stats] cupones:', e.message);
  }

  return out;
}

const mapAdminUser = (u = {}) => {
  const generoNorm = normalizarGenero(u.genero ?? u.sexo ?? u.gender ?? '');
  const fotoRaw = u.foto || u.avatar || u.imagen || null;
  const fotoUrlResuelta = resolveUserPhoto(fotoRaw);

  return {
    id: String(u._id || u.id || u.user_id || ''),
    _id: String(u._id || u.id || u.user_id || ''),
    nombre: u.nombre || u.name || '',
    apellido_paterno: u.apellido_paterno || u.apellidoPaterno || u.paterno || '',
    apellido_materno: u.apellido_materno || u.apellidoMaterno || u.materno || '',
    email: u.email || u.correo || '',
    telefono: u.telefono || u.phone || u.tel || '',
    genero: generoNorm,
    sexo: generoNorm,
    gender: generoNorm,
    fecha_nacimiento: u.fecha_nacimiento || u.fechaNacimiento || u.birthdate || null,
    rol: (() => {
      const x = String(u.rol || u.role || '').toLowerCase().trim();
      if (['admin', 'administrador', 'administrator', 'superadmin', 'root'].includes(x)) return 'admin';
      if (['vendedor', 'seller', 'vendor'].includes(x)) return 'vendedor';
      return 'cliente';
    })(),
    activo: u.activo !== false && u.estado !== 'inactivo',
    email_confirmado: u.email_confirmado !== false,
    fecha_registro: u.fecha_registro || u.created_at || u.creado_en || u.createdAt || null,
    ultimo_acceso: u.ultimo_acceso || u.last_login || u.ultimoLogin || null,
    foto: fotoRaw,
    fotoUrl: fotoUrlResuelta,
    direcciones: Array.isArray(u.direcciones)
      ? u.direcciones.map(normalizarDir)
      : Array.isArray(u.addresses)
      ? u.addresses.map(normalizarDir)
      : [],
    complexion: u.complexion && typeof u.complexion === 'object' ? u.complexion : null,
    intereses: u.intereses && typeof u.intereses === 'object' ? u.intereses : null,
    _raw: u,
  };
};

export async function fetchAdminUserDetail(id) {
  if (id === undefined || id === null || id === '') return null;
  const idStr = String(id);
  try {
    const res = await request(`${API_PREFIX}/admin/usuarios/${idStr}`);
    const raw = res?.usuario || res?.data || res?.user || res;
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      if (raw._id || raw.id || raw.email || raw.nombre) return mapAdminUser(raw);
    }
  } catch {}
  try {
    const res = await request(`${API_PREFIX}/admin/usuarios?id=${encodeURIComponent(idStr)}`);
    const found = listFrom(res, 'usuarios', 'data', 'items', 'results', 'users').find(
      (u) => String(u._id || u.id || u.user_id) === idStr
    );
    if (found) return mapAdminUser(found);
  } catch {}
  return null;
}

export async function fetchAdminUsers(params = {}) {
  const qs = new URLSearchParams();
  if (params.page) qs.set('page', params.page);
  if (params.limit) qs.set('limit', params.limit);
  if (params.rol && params.rol !== 'todos') qs.set('rol', params.rol);
  if (params.q) qs.set('q', params.q);
  if (params.id !== undefined && params.id !== null && params.id !== '') qs.set('id', String(params.id));

  const data = await request(`${API_PREFIX}/admin/usuarios${qs.toString() ? `?${qs.toString()}` : ''}`);
  const lista = listFrom(data, 'usuarios', 'data', 'items', 'results', 'users');
  const meta = data?.meta || data?.pagination || data?.paginacion || {};
  return {
    usuarios: lista.map(mapAdminUser),
    total: Number(meta.total ?? meta.count ?? lista.length),
    page: Number(meta.page ?? meta.current_page ?? 1),
    limit: Number(meta.limit ?? meta.per_page ?? lista.length),
    pages: Number(meta.pages ?? meta.total_pages ?? (meta.total ? Math.ceil(meta.total / (meta.limit || lista.length || 1)) : 1)),
  };
}

export async function updateAdminUser(id, data) {
  const body = { ...data };
  const generoRaw = body.genero ?? body.sexo;
  if (generoRaw !== undefined && generoRaw !== null && generoRaw !== '') {
    const genero = normalizarGenero(generoRaw);
    body.genero = genero;
    body.sexo = genero;
  }
  const res = await request(`${API_PREFIX}/admin/usuarios/${id}`, { method: 'PUT', body });
  const raw = res?.data || res?.usuario || res?.user || null;
  const usuario = raw ? mapAdminUser(raw) : null;
  return { ok: res?.ok !== false, usuario, data: usuario, raw: res };
}

export async function changeUserRole(id, rol) {
  return request(`${API_PREFIX}/admin/usuarios/${id}/rol`, { method: 'POST', body: { rol } });
}
export async function toggleAdminUser(id) {
  return request(`${API_PREFIX}/admin/usuarios/${id}/toggle`, { method: 'POST' });
}
export async function deleteAdminUser(id) {
  return request(`${API_PREFIX}/admin/usuarios/${id}`, { method: 'DELETE' });
}

// ================================================================
// COMPLEXION
// ================================================================
export const COMPLEXION_PATHS = [`${API_PREFIX}/complexion`, `${API_PREFIX}/complexion/obtener`];
const num = (v) => {
  const n = parseFloat(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
};

export function normalizeComplexion(raw) {
  if (!raw || typeof raw !== 'object' || raw.success === false) return null;
  const d = raw.complexion && typeof raw.complexion === 'object' ? raw.complexion : raw.medidas || null;
  if (!d) return null;
  const m = d.medidas && typeof d.medidas === 'object' ? d.medidas : {};
  const out = {
    height: num(d.altura_cm ?? d.altura),
    weight: num(d.peso_kg ?? d.peso),
    chest: num(m.pecho_cm),
    waist: num(m.cintura_cm),
    hips: num(m.cadera_cm),
    build: typeof d.complexion === 'string' ? d.complexion : null,
    size: String(d.talla_camisa || '').toUpperCase().trim() || null,
    pantSize: d.talla_pantalon || null,
    shoeSize: d.talla_calzado || null,
  };
  const has = out.height || out.weight || out.chest || out.waist || out.hips || out.build || out.size;
  return has ? out : null;
}

export async function fetchComplexion() {
  const { token } = await loadSession();
  if (!token) return null;
  let found = null;
  for (const path of COMPLEXION_PATHS) {
    try {
      const c = normalizeComplexion(await request(path));
      if (c) found = found ? { ...c, ...Object.fromEntries(Object.entries(found).filter(([, v]) => v)) } : c;
    } catch (e) {
      if (e.status === 0) break;
    }
  }
  return found;
}

// ================================================================
// CATEGORÍAS
// ================================================================
export async function fetchCategorias(params = {}) {
  const qs = new URLSearchParams();
  if (params.nivel) qs.set('nivel', params.nivel);
  if (params.padre_id) qs.set('padre_id', params.padre_id);
  if (params.destacada) qs.set('destacada', 'true');
  const data = await request(
    `${API_PREFIX}/categorias${qs.toString() ? `?${qs.toString()}` : ''}`,
    { auth: false }
  );
  return listFrom(data, 'data', 'categorias', 'items').map((c) => ({
    id: String(c._id || c.id || ''),
    nombre: c.nombre || c.name || '',
    nivel: Number(c.nivel || 1),
    padre_id: c.padre_id ? String(c.padre_id) : null,
    padre_nombre: c.padre_nombre || null,
    imagen: c.imagen || '',
    icono: c.icono || '',
    color: c.color || '',
    destacada: !!c.destacada,
    orden: Number(c.orden || 0),
    activo: c.activo !== false,
  }));
}

export async function fetchCategoriasTree() {
  const data = await request(`${API_PREFIX}/categorias/tree`, { auth: false });
  return Array.isArray(data?.data) ? data.data : [];
}

export async function fetchCategoriasDestacadas() {
  const data = await request(`${API_PREFIX}/categorias/destacadas`, { auth: false });
  const lista = listFrom(data, 'data', 'categorias', 'items');
  return lista.map((c) => ({
    id: String(c._id || c.id || ''),
    nombre: c.nombre || '',
    icono: c.icono || '',
    imagen: c.imagen || '',
    color: c.color || '',
    orden: Number(c.orden || 0),
  }));
}

export async function fetchCategoria(id) {
  const data = await request(`${API_PREFIX}/categorias/${id}`, { auth: false });
  return data?.data || null;
}

export async function createCategoria(payload) {
  return request(`${API_PREFIX}/admin/categorias`, { method: 'POST', body: payload });
}
export async function updateCategoria(id, payload) {
  return request(`${API_PREFIX}/admin/categorias/${id}`, { method: 'PUT', body: payload });
}
export async function deleteCategoria(id) {
  return request(`${API_PREFIX}/admin/categorias/${id}`, { method: 'DELETE' });
}
export async function seedCategorias(force = false) {
  return request(`${API_PREFIX}/admin/categorias/seed`, { method: 'POST', body: { force } });
}

// ================================================================
// TEMPORADAS
// ================================================================
export const mapTemporada = (t) => ({
  id: String(t.id || t._id || ''),
  nombre: t.nombre || '',
  descripcion: t.descripcion || '',
  imagen: t.imagen ? resolveUrl(t.imagen) : null,
  imagenRaw: t.imagen || '',
  color: t.color || '#7C3AED',
  destacada: !!t.destacada,
  fecha_inicio: t.fecha_inicio || null,
  fecha_fin: t.fecha_fin || null,
  activa: t.activa !== false,
  productosCount: Number(t.productosCount || 0),
  createdAt: t.createdAt || t.created_at || null,
  updatedAt: t.updatedAt || t.updated_at || null,
});

export async function fetchTemporadas(params = {}) {
  const partes = [];
  if (params.activa !== undefined) partes.push('activa=' + params.activa);
  if (params.incluir_inactivas) partes.push('incluir_inactivas=true');
  if (params.destacada) partes.push('destacada=true');
  const query = partes.join('&');
  const data = await request(
    `${API_PREFIX}/temporadas` + (query ? '?' + query : ''),
    { auth: false }
  );
  return listFrom(data, 'data', 'temporadas', 'items').map(mapTemporada);
}

export async function fetchTemporadaActiva() {
  try {
    const data = await request(`${API_PREFIX}/temporadas/activa`, { auth: false });
    if (!data || !data.data) return null;
    return mapTemporada(data.data);
  } catch {
    return null;
  }
}

export async function fetchTemporada(id) {
  const data = await request(`${API_PREFIX}/temporadas/` + id, { auth: false });
  if (!data || !data.data) return null;
  return mapTemporada(data.data);
}

export async function createTemporada(payload) {
  return request(`${API_PREFIX}/admin/temporadas`, { method: 'POST', body: payload });
}
export async function updateTemporada(id, payload) {
  return request(`${API_PREFIX}/admin/temporadas/` + id, { method: 'PUT', body: payload });
}
export async function deleteTemporada(id) {
  return request(`${API_PREFIX}/admin/temporadas/` + id, { method: 'DELETE' });
}

// ================================================================
// PRODUCTOS (normalización)
// ================================================================
const mapVariante = (v = {}) => ({
  sku: v.sku || '',
  color: v.color || '',
  tamano: String(v.tamano || v.talla || v.size || '').replace(/\s+/g, ' ').trim(),
  precio: Number(v.precio ?? v.price ?? 0),
  stock: Number(v.stock ?? v.cantidad ?? 0),
});

const filtrarFotosValidas = (fotosArr) => {
  if (!Array.isArray(fotosArr)) return [];
  return fotosArr
    .map((f) => {
      if (typeof f === 'string') return f;
      if (typeof f === 'object' && f) return f.url || f.nombre || f.path || '';
      return '';
    })
    .filter(esFotoAceptable);
};

const extraerFotoFallback = (p = {}) => {
  const fuentes = [
    p.fotos,
    p.imagenes,
    p.images,
    p.fotos_clean,
    p.imagen ? [p.imagen] : null,
    p.imagen_url ? [p.imagen_url] : null,
    p.image ? [p.image] : null,
    p.foto ? [p.foto] : null,
  ];
  for (const arr of fuentes) {
    if (!Array.isArray(arr) || arr.length === 0) continue;
    const limpio = filtrarFotosValidas(arr);
    if (limpio.length > 0) return limpio[0];
  }
  return null;
};

const mapProducto = (p = {}) => {
  const rawVars =
    Array.isArray(p.variables) && p.variables.length > 0
      ? p.variables
      : Array.isArray(p.variantes)
      ? p.variantes
      : [];
  const variables = rawVars.map(mapVariante);
  const totalStock = variables.reduce((s, v) => s + (Number(v.stock) || 0), 0);
  const marcaIdRaw = p.marca_id || p.empresa_id || null;

  const fotosRaw = Array.isArray(p.fotos) ? p.fotos : [];
  let fotos = filtrarFotosValidas(fotosRaw);
  if (fotos.length === 0) {
    const fallback = extraerFotoFallback(p);
    if (fallback) fotos = [fallback];
  }

  const videosRaw = Array.isArray(p.videos) ? p.videos : [];
  const videos = videosRaw
    .map((v) => (typeof v === 'string' ? v : v?.url || v?.nombre || ''))
    .filter(Boolean);

  return {
    id: String(p.id || p._id || ''),
    nombre: p.nombre || '',
    descripcion: p.descripcion || '',
    categoria_id: p.categoria_id ? String(p.categoria_id) : null,
    categoria_nombre: p.categoria_nombre || null,
    marca_id: marcaIdRaw ? String(marcaIdRaw) : null,
    marca_nombre: p.marca_nombre || null,
    temporada_id: p.temporada_id ? String(p.temporada_id) : null,
    temporada_nombre: p.temporada_nombre || null,
    estado: p.estado === 'inactivo' ? 'inactivo' : 'activo',
    activo: p.activo !== false,
    fotos,
    videos,
    variables,
    totalStock,
    variantesCount: variables.length,
    createdAt: p.createdAt || p.created_at || null,
    updatedAt: p.updatedAt || p.updated_at || null,
  };
};

export async function fetchProductos(params = {}) {
  const partes = [];
  if (params.categoria_id) partes.push('categoria_id=' + params.categoria_id);
  if (params.marca_id) partes.push('marca_id=' + params.marca_id);
  if (params.temporada_id) partes.push('temporada_id=' + params.temporada_id);
  if (params.estado) partes.push('estado=' + params.estado);
  if (params.q) partes.push('q=' + encodeURIComponent(params.q));
  const query = partes.join('&');

  const data = await request(
    `${API_PREFIX}/productos` + (query ? '?' + query : ''),
    { auth: false }
  );
  return listFrom(data, 'data', 'productos', 'items').map(mapProducto);
}

export async function fetchProducto(id) {
  const data = await request(`${API_PREFIX}/productos/` + id, { auth: false });
  return data?.data ? mapProducto(data.data) : null;
}

const normalizeFotoForPayload = (f) => {
  if (!f) return null;
  if (typeof f === 'string') return f;
  if (typeof f === 'object') {
    if (f.url) return f.url;
    if (f.base64 && f.mime) return `data:${f.mime};base64,${f.base64}`;
    if (f.base64) return `data:image/jpeg;base64,${f.base64}`;
  }
  return null;
};

export async function createProducto(payload) {
  const body = {
    ...payload,
    fotos: (payload.fotos || []).map(normalizeFotoForPayload).filter(Boolean),
    videos: (payload.videos || []).map(normalizeFotoForPayload).filter(Boolean),
  };
  return request(`${API_PREFIX}/admin/productos`, { method: 'POST', body });
}

export async function updateProducto(id, payload) {
  const body = {
    ...payload,
    fotos: (payload.fotos || []).map(normalizeFotoForPayload).filter(Boolean),
    videos: (payload.videos || []).map(normalizeFotoForPayload).filter(Boolean),
  };
  return request(`${API_PREFIX}/admin/productos/` + id, { method: 'PUT', body });
}

export async function deleteProducto(id) {
  return request(`${API_PREFIX}/admin/productos/` + id, { method: 'DELETE' });
}

// ================================================================
// UPLOAD / ARCHIVOS
// ================================================================
const MIME_BY_EXT = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
  gif: 'image/gif',
  bmp: 'image/bmp',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  m4v: 'video/x-m4v',
  webm: 'video/webm',
  '3gp': 'video/3gpp',
};

const inferExtFromUri = (uri) => {
  const m = String(uri).match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
  return m ? m[1].toLowerCase() : '';
};

const safeFileName = (name, fallbackExt) => {
  const base = String(name || `upload_${Date.now()}`)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_+|_+$/g, '');
  return /\.[a-zA-Z0-9]+$/.test(base) ? base : `${base}.${fallbackExt || 'jpg'}`;
};

const normalizeAndroidUri = (uri) => {
  if (!uri) return uri;
  if (Platform.OS !== 'android') return uri;
  if (/^(file:|content:|https?:)/i.test(uri)) return uri;
  return `file://${uri}`;
};

async function _readAsBase64(uri) {
  let FileSystem;
  try {
    FileSystem = require('expo-file-system/legacy');
  } catch {
    FileSystem = require('expo-file-system');
  }
  if (!FileSystem || typeof FileSystem.readAsStringAsync !== 'function') {
    throw new Error('expo-file-system no disponible para leer base64');
  }
  return FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
}

export async function fileToBase64(uri, { nombre, tipo = 'foto' } = {}) {
  if (!uri) throw new ApiError('uri inválido para base64', 400);
  const extFromName = inferExtFromUri(nombre);
  const extFromUri = inferExtFromUri(uri);
  const fallbackExt = tipo === 'video' ? 'mp4' : 'jpg';
  const ext = (extFromName || extFromUri || fallbackExt).toLowerCase();
  const mime = MIME_BY_EXT[ext] || (tipo === 'video' ? 'video/mp4' : 'image/jpeg');
  const finalName = safeFileName(nombre, ext);

  const base64 = await _readAsBase64(normalizeAndroidUri(uri));
  return { base64, nombre: finalName, mime };
}

async function _uploadViaFormDataNative({ uri, name, type, campo, endpoint, token }) {
  const formData = new FormData();
  formData.append(campo, { uri, name, type });
  const url = `${SECURE_API_URL}${endpoint}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: formData,
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  return { res, data };
}

async function _uploadViaFileSystem({ uri, name, type, campo, endpoint, token }) {
  let FileSystem;
  try {
    FileSystem = require('expo-file-system/legacy');
  } catch {
    FileSystem = require('expo-file-system');
  }
  if (!FileSystem || typeof FileSystem.uploadAsync !== 'function') {
    throw new Error('expo-file-system.uploadAsync no disponible');
  }
  const url = `${SECURE_API_URL}${endpoint}`;
  const res = await FileSystem.uploadAsync(url, uri, {
    fieldName: campo,
    httpMethod: 'POST',
    uploadType: FileSystem.FileSystemUploadType.MULTIPART,
    headers: {
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    mimeType: type,
    parameters: { name },
  });
  const text = res.body || '';
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  return {
    res: { ok: res.status >= 200 && res.status < 300, status: res.status },
    data,
  };
}

const UPLOAD_ENDPOINTS = [
  `${API_PREFIX}/admin/productos/upload`,
  `${API_PREFIX}/admin/upload/producto`,
  `${API_PREFIX}/upload`,
  `${API_PREFIX}/admin/productos/imagen`,
  `${API_PREFIX}/productos/upload`,
  `${API_PREFIX}/admin/upload`,
];
let _uploadEndpointCache = null;
let _uploadUnsupported = false;

const _uploadEndpoints404 = new Set();

export function resetUploadState() {
  _uploadUnsupported = false;
  _uploadEndpointCache = null;
  _uploadEndpoints404.clear();
  if (DEBUG) console.log('🔄 [upload] estado reseteado — se reintentará con todos los endpoints');
}

export async function uploadProductFile(uri, { tipo = 'foto', nombre, campo = 'file', endpoint } = {}) {
  if (!uri) throw new ApiError('No se recibió uri del archivo', 400);

  if (!endpoint && _uploadUnsupported && _uploadEndpoints404.size >= UPLOAD_ENDPOINTS.length) {
    const err = new ApiError('El backend no tiene endpoint de subida (usa base64)', 0);
    err.code = 'NO_UPLOAD_ENDPOINT';
    throw err;
  }

  const disponibles = UPLOAD_ENDPOINTS.filter((e) => !_uploadEndpoints404.has(e));

  const { token } = await loadSession();
  const extFromName = inferExtFromUri(nombre);
  const extFromUri = inferExtFromUri(uri);
  const fallbackExt = tipo === 'video' ? 'mp4' : 'jpg';
  const ext = (extFromName || extFromUri || fallbackExt).toLowerCase();
  const mime = MIME_BY_EXT[ext] || (tipo === 'video' ? 'video/mp4' : 'image/jpeg');
  const fileName = safeFileName(nombre, ext);
  const finalUri = normalizeAndroidUri(uri);

  let endpoints;
  if (endpoint) endpoints = [endpoint];
  else if (_uploadEndpointCache)
    endpoints = [_uploadEndpointCache, ...disponibles.filter((e) => e !== _uploadEndpointCache)];
  else endpoints = disponibles;

  if (!endpoints.length) {
    _uploadUnsupported = true;
    const err = new ApiError('El backend no tiene endpoint de subida (usa base64)', 0);
    err.code = 'NO_UPLOAD_ENDPOINT';
    throw err;
  }

  let lastError = null;
  let saw404 = false;
  let saw401 = false;

  for (const ep of endpoints) {
    const strategies = [
      { name: 'A_native', fn: _uploadViaFormDataNative },
      { name: 'B_fs', fn: _uploadViaFileSystem },
    ];
    for (const strat of strategies) {
      try {
        if (DEBUG) console.log(`📤 [upload] ${strat.name} → POST ${ep}`);
        const { res, data } = await strat.fn({
          uri: finalUri,
          name: fileName,
          type: mime,
          campo,
          endpoint: ep,
          token,
        });

        if (res.status === 404) {
          _uploadEndpoints404.add(ep);
          saw404 = true;
          lastError = new ApiError(`Endpoint ${ep} no encontrado`, 404, data);
          if (DEBUG) console.warn(`⚠️ [upload] ${ep} → 404 (endpoint no existe)`);
          break;
        }

        if (!res.ok) {
          const msg =
            (data && (data.error || data.message || data.mensaje)) ||
            `Error ${res.status} al subir archivo`;
          lastError = new ApiError(msg, res.status, data);
          if (DEBUG) console.warn(`⚠️ [upload] ${ep} → ${res.status}: ${msg}`);
          if (res.status === 401 || res.status === 403) {
            saw401 = true;
            throw lastError;
          }
          break;
        }

        _uploadEndpointCache = ep;
        _uploadUnsupported = false;
        if (DEBUG) console.log(`✅ [upload] ${ep} → OK`, data?.url || data?.filename || '');
        return _extractUrl(data);
      } catch (e) {
        lastError = e;
        const isFormDataPartBug = /FormDataPart|Unsupported/i.test(e?.message || '');
        if (isFormDataPartBug && DEBUG) {
          console.warn(`⚠️ [upload] ${strat.name} falló con FormDataPart, probando siguiente estrategia`);
        }
        if (isFormDataPartBug) continue;
        if (e instanceof ApiError && e.status > 0) break;
      }
    }
  }

  if (saw404 && !saw401) {
    _uploadUnsupported = true;
  }

  const err = new ApiError(
    lastError?.message || 'El backend no tiene endpoint de subida (usa base64)',
    lastError?.status || 0
  );
  err.code = 'NO_UPLOAD_ENDPOINT';
  throw err;
}

// ⭐ IMPORTANTE: devuelve SOLO el nombre del archivo (ej. "auto_...jpeg")
// para que los 30 templates de Flask funcionen sin duplicar la ruta.
function _extractUrl(data) {
  const finalUrl =
    data?.url || data?.data?.url ||
    data?.path || data?.data?.path ||
    data?.foto || data?.data?.foto ||
    data?.imagen || data?.data?.imagen ||
    data?.filename || data?.data?.filename ||
    data?.archivo || data?.data?.archivo || null;
  if (!finalUrl) throw new ApiError('El backend no devolvió la URL del archivo subido', 500, data);
  const s = String(finalUrl);

  // data: y http: → tal cual
  if (/^data:/i.test(s)) return s;
  if (/^https?:/i.test(s)) return s;

  // /static/uploads/productos/xxx → solo "xxx"
  const m = s.match(/\/static\/uploads\/productos\/([^/?#]+)$/i);
  if (m) return m[1];

  // cualquier /static/... → solo el nombre base
  if (s.startsWith('/static/')) return s.split('/').pop();

  // otra ruta absoluta → solo el nombre base
  if (s.startsWith('/')) return s.split('/').pop();

  // ya es solo nombre de archivo
  return s;
}

// ================================================================
// MARCAS
// ================================================================
export async function fetchMarcas(params = {}) {
  try {
    const partes = [];
    if (params.activa !== undefined) partes.push('activa=' + params.activa);
    if (params.status) partes.push('status=' + params.status);
    if (params.q) partes.push('q=' + encodeURIComponent(params.q));
    const query = partes.join('&');
    const data = await request(`${API_PREFIX}/marcas` + (query ? '?' + query : ''), { auth: false });
    const lista = listFrom(data, 'data', 'marcas', 'items');
    return lista.map((m) => ({
      id: String(m.id || m._id || ''),
      nombre: m.nombre_comercial || m.nombre || '',
      nombre_comercial: m.nombre_comercial || m.nombre || '',
      rfc: m.rfc || '',
      correo: m.correo || '',
      telefono: m.telefono || '',
      direccion: m.direccion || '',
      status: m.status || 'pendiente',
      activa: m.activa !== false,
      notas_admin: m.notas_admin || '',
      impi_count: Number(m.impi_count || (Array.isArray(m.datos_impi) ? m.datos_impi.length : 0)),
      createdAt: m.createdAt || m.created_at || null,
      updatedAt: m.updatedAt || m.updated_at || null,
    }));
  } catch {
    return [];
  }
}

export async function fetchMarca(id) {
  try {
    const data = await request(`${API_PREFIX}/marcas/` + id, { auth: false });
    if (!data || !data.data) return null;
    const m = data.data;
    return {
      id: String(m.id || m._id || ''),
      nombre: m.nombre_comercial || m.nombre || '',
      nombre_comercial: m.nombre_comercial || m.nombre || '',
      rfc: m.rfc || '',
      correo: m.correo || '',
      telefono: m.telefono || '',
      direccion: m.direccion || '',
      status: m.status || 'pendiente',
      activa: m.activa !== false,
      notas_admin: m.notas_admin || '',
      impi_count: Number(m.impi_count || (Array.isArray(m.datos_impi) ? m.datos_impi.length : 0)),
      createdAt: m.createdAt || m.created_at || null,
      updatedAt: m.updatedAt || m.updated_at || null,
    };
  } catch {
    return null;
  }
}

export async function createMarca(payload) {
  return request(`${API_PREFIX}/admin/marcas`, { method: 'POST', body: payload });
}
export async function updateMarca(id, payload) {
  return request(`${API_PREFIX}/admin/marcas/` + id, { method: 'PUT', body: payload });
}
export async function deleteMarca(id) {
  return request(`${API_PREFIX}/admin/marcas/` + id, { method: 'DELETE' });
}
export async function aprobarMarca(id) {
  return request(`${API_PREFIX}/admin/marcas/${id}/aprobar`, { method: 'POST' });
}
export async function negarMarca(id, motivo) {
  return request(`${API_PREFIX}/admin/marcas/${id}/negar`, {
    method: 'POST',
    body: { motivo: motivo || 'Sin motivo especificado' },
  });
}

// ================================================================
// CUPONES
// ================================================================
const mapCupon = (c = {}) => {
  const tipoRaw = String(c.tipo || c.tipo_descuento || '').toLowerCase();
  const tipo =
    tipoRaw.includes('porc') || tipoRaw.includes('%')
      ? 'porcentaje'
      : tipoRaw.includes('envio') || tipoRaw.includes('gratis')
      ? 'envio_gratis'
      : 'monto_fijo';

  const fin = c.fecha_fin || c.fecha_expiracion || null;
  const ini = c.fecha_inicio || null;
  const now = new Date();
  const finDate = fin ? new Date(fin) : null;
  const iniDate = ini ? new Date(ini) : null;

  let estado = 'activo';
  if (c.activo === false || c.estado === 'inactivo') estado = 'inactivo';
  else if (finDate && now > finDate) estado = 'expirado';
  else if (iniDate && now < iniDate) estado = 'programado';

  return {
    id: String(c._id || c.id || ''),
    _id: String(c._id || c.id || ''),
    codigo: c.codigo || '',
    nombre: c.nombre || c.descripcion || '',
    descripcion: c.descripcion || c.nombre || '',
    tipo,
    valor: Number(c.valor ?? c.descuento ?? 0),
    minimo_compra: Number(c.minimo_compra ?? c.compra_minima ?? 0),
    compra_minima: Number(c.compra_minima ?? c.minimo_compra ?? 0),
    usos_max: Number(c.usos_max ?? c.uso_maximo ?? 0),
    uso_maximo: Number(c.uso_maximo ?? c.usos_max ?? 0),
    descuento_maximo: Number(c.descuento_maximo ?? 0),
    fecha_inicio: ini,
    fecha_fin: fin,
    fecha_expiracion: fin,
    usos: Number(c.usos ?? 0),
    activo: c.activo !== false,
    estado,
    segmento: c.segmento || null,
    creado_automaticamente: !!c.creado_automaticamente,
    usuarios_asignados: Array.isArray(c.usuarios_asignados) ? c.usuarios_asignados.map(String) : [],
    total_asignados: Number(c.total_asignados ?? (Array.isArray(c.usuarios_asignados) ? c.usuarios_asignados.length : 0)),
    creado_en: c.creado_en || c.fecha_creacion || c.createdAt || null,
  };
};

const cuponPayload = (c = {}) => ({
  codigo: String(c.codigo || '').trim().toUpperCase(),
  nombre: c.nombre || c.descripcion || '',
  descripcion: c.descripcion || c.nombre || '',
  tipo: c.tipo || 'porcentaje',
  valor: Number(c.valor ?? 0),
  minimo_compra: Number(c.minimo_compra ?? 0),
  compra_minima: Number(c.minimo_compra ?? 0),
  usos_max: Number(c.usos_max ?? c.uso_maximo ?? 0),
  uso_maximo: Number(c.usos_max ?? c.uso_maximo ?? 0),
  descuento_maximo: Number(c.descuento_maximo ?? 0),
  fecha_inicio: c.fecha_inicio || null,
  fecha_fin: c.fecha_fin || null,
  fecha_expiracion: c.fecha_fin || null,
  activo: c.activo !== false,
});

export async function fetchCupones(params = {}) {
  const qs = new URLSearchParams();
  if (params.q) qs.set('q', params.q);
  if (params.estado) qs.set('estado', params.estado);
  if (params.activo !== undefined) qs.set('activo', String(params.activo));
  if (params.page) qs.set('page', params.page);
  if (params.limit) qs.set('limit', params.limit);
  const url = `${CUPONES_BASE}/cupones${qs.toString() ? `?${qs.toString()}` : ''}`;
  const data = await request(url);
  return listFrom(data, 'data', 'cupones', 'items').map(mapCupon);
}

export async function fetchCupon(id) {
  if (!id) return null;
  try {
    const data = await request(`${CUPONES_BASE}/cupones/${id}`);
    const raw = data?.data || data?.cupon || data;
    return raw ? mapCupon(raw) : null;
  } catch {
    return null;
  }
}

export async function createCupon(payload) {
  const body = cuponPayload(payload);
  const res = await request(`${CUPONES_BASE}/cupones`, { method: 'POST', body });
  const raw = res?.data || res?.cupon || res;
  return mapCupon(raw);
}

export async function updateCupon(id, payload) {
  const body = cuponPayload(payload);
  const res = await request(`${CUPONES_BASE}/cupones/${id}`, { method: 'PUT', body });
  const raw = res?.data || res?.cupon || res;
  return raw ? mapCupon(raw) : null;
}

export async function deleteCupon(id) {
  return request(`${CUPONES_BASE}/cupones/${id}`, { method: 'DELETE' });
}

export async function toggleCupon(id) {
  return request(`${CUPONES_BASE}/cupones/${id}/toggle`, { method: 'POST' });
}

export async function fetchCuponesGenerados() {
  const data = await request(`${CUPONES_BASE}/cupones-generados`);
  return listFrom(data, 'data', 'cupones', 'items').map(mapCupon);
}

export async function fetchSegmentos() {
  const data = await request(`${CUPONES_BASE}/segmentos`);
  const lista = listFrom(data, 'data', 'segmentos', 'items');
  return lista.map((s) => ({
    id: s.id,
    nombre: s.nombre || '',
    descripcion: s.descripcion || '',
    cupon: s.cupon || {},
  }));
}

export async function previewSegmento(id) {
  if (!id) throw new ApiError('id de segmento requerido', 400);
  const data = await request(`${CUPONES_BASE}/segmentos/${id}/preview`, { method: 'POST' });
  const d = data?.data || data;
  return {
    segmento: d?.segmento || '',
    total: Number(d?.total ?? 0),
    muestra: Array.isArray(d?.muestra) ? d.muestra : [],
  };
}

export async function generarCuponesAutomaticos(opts = {}) {
  const body = Array.isArray(opts.segmentos) && opts.segmentos.length ? { segmentos: opts.segmentos } : {};
  const data = await request(`${CUPONES_BASE}/cupones/generar-automatico`, { method: 'POST', body });
  const lista = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
  return lista.map((r) => ({
    id: r.id || null,
    segmento: r.segmento || '',
    creados: Number(r.creados ?? 0),
    usuarios_beneficiados: Number(r.usuarios_beneficiados ?? 0),
    codigo: r.codigo || null,
    cupon: r.cupon || null,
    mensaje: r.mensaje || null,
    error: r.error || null,
    dryRun: !!r.dryRun,
  }));
}

// ================================================================
// CHAT — CLIENTE
// ================================================================
export const mapChatMensaje = (m = {}) => {
  const de = String(m.de || '').toLowerCase();
  const from =
    de === 'cliente' ? 'user'
    : de === 'bot' ? 'bot'
    : de === 'admin' || de === 'staff' ? 'admin'
    : m.es_admin ? 'admin' : 'bot';

  const fecha = m.fecha || m.createdAt || m.created_at || null;
  const time = fecha
    ? new Date(fecha).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';

  return {
    id: String(m._id || m.id || `msg-${Math.random().toString(36).slice(2, 8)}`),
    from,
    de,
    text: m.texto || m.text || '',
    time,
    fecha,
    intencion: m.intencion || null,
    quickReplies: Array.isArray(m.quickReplies) ? m.quickReplies : [],
    esIA: !!m.es_ia,
    esAdmin: !!m.es_admin,
    adminNombre: m.admin_nombre || null,
    adminRol: m.admin_rol || null,
  };
};

export async function crearSesionChat({ nombre } = {}) {
  return request(`${CHAT_CLIENT}/sesion`, { method: 'POST', body: { nombre }, auth: true });
}

export async function listarSesionesChat({ filtro = 'activas' } = {}) {
  const data = await request(`${CHAT_CLIENT}/sesiones?filtro=${encodeURIComponent(filtro)}`);
  const lista = listFrom(data, 'data', 'sesiones', 'items');
  return lista.map((s) => ({
    id: String(s._id || s.id || s._id_str || ''),
    nombre: s.nombre_usuario || 'Invitado',
    email: s.email_usuario || null,
    noLeidos: Number(s.no_leidos || 0),
    ultimoMensaje: s.ultimo_mensaje?.texto || s.ultimo_mensaje || null,
    fechaUltimo: s.updated_at || s.fecha_ultimo || s.creada || null,
    archivada: !!s.archivada,
    vendedorId: s.vendedor_id || null,
    asignada: !!s.vendedor_id,
  }));
}

export async function obtenerMensajesChat({ sesion_id, ultimo = null } = {}) {
  if (!sesion_id) throw new ApiError('sesion_id requerido', 400);
  let path = `${CHAT_CLIENT}/mensajes?sesion_id=${encodeURIComponent(sesion_id)}`;
  if (ultimo) path += `&ultimo=${encodeURIComponent(ultimo)}`;
  const data = await request(path);
  const lista = listFrom(data, 'data', 'mensajes', 'items');
  return lista.map(mapChatMensaje);
}

export async function enviarMensajeChat({
  sesion_id,
  texto,
  autoRespuesta = true,
  language = "es",
} = {}) {
  if (!sesion_id) throw new ApiError("sesion_id requerido", 400);
  if (!texto || !String(texto).trim()) throw new ApiError("texto requerido", 400);

  const lang = String(language || "es").toLowerCase().startsWith("en") ? "en" : "es";

  const data = await request(`${CHAT_CLIENT}/mensajes`, {
    method: "POST",
    body: {
      sesion_id,
      texto: String(texto).trim(),
      auto_respuesta: !!autoRespuesta,
      language: lang,
    },
  });

  let botMsg = null;
  if (data?.respuesta) {
    botMsg = {
      id: `bot-${Date.now()}`,
      from: 'bot',
      de: 'bot',
      text: data.respuesta.texto || data.respuesta.text || '',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      fecha: new Date().toISOString(),
      intencion: data.respuesta.intencion || null,
      quickReplies: Array.isArray(data.respuesta.quickReplies) ? data.respuesta.quickReplies : [],
      esIA: true,
      esAdmin: false,
      language: data.respuesta.language || lang,
    };
  }

  return {
    ok: !!data?.ok,
    mensaje_id: data?.mensaje_id || null,
    respuesta: botMsg,
    raw: data,
  };
}

export async function archivarSesionChat(sesion_id) {
  if (!sesion_id) throw new ApiError('sesion_id requerido', 400);
  return request(`${CHAT_CLIENT}/sesiones/${encodeURIComponent(sesion_id)}/archivar`, { method: 'POST' });
}

export async function probarNLP(mensaje) {
  if (!mensaje || !String(mensaje).trim()) throw new ApiError('mensaje requerido', 400);
  return request(`${CHAT_CLIENT}/nlp/probar`, {
    method: 'POST',
    auth: false,
    body: { mensaje: String(mensaje).trim() },
  });
}

export async function infoNLP() {
  return request(`${CHAT_CLIENT}/nlp/info`, { auth: false });
}

export async function generarRespuestaIA({ sesion_id, mensaje = null } = {}) {
  return request(`${CHAT_CLIENT}/generar-ia`, { method: 'POST', body: { sesion_id, mensaje } });
}

// ================================================================
// CHAT — VENDEDOR
// ================================================================
export async function vendedorListarSesiones({ filtro = 'activas', sinAsignar = true } = {}) {
  const qs = new URLSearchParams();
  qs.set('filtro', filtro);
  if (sinAsignar) qs.set('sin_asignar', '1');
  const data = await request(`${CHAT_VEND}/sesiones?${qs.toString()}`);
  const lista = listFrom(data, 'sesiones', 'data', 'items');
  return lista.map((s) => ({
    id: String(s._id || s._id_str || s.id || ''),
    nombre: s.nombre_usuario || 'Invitado',
    email: s.email_usuario || null,
    noLeidos: Number(s.no_leidos || 0),
    ultimoMensaje: s.ultimo_mensaje || null,
    fechaUltimo: s.fecha_ultimo || s.updated_at || null,
    archivada: !!s.archivada,
    vendedorId: s.vendedor_id || null,
    asignada: !!s.asignada,
  }));
}

export async function vendedorTomarSesion(sesion_id) {
  if (!sesion_id) throw new ApiError('sesion_id requerido', 400);
  return request(`${CHAT_VEND}/tomar/${encodeURIComponent(sesion_id)}`, { method: 'POST' });
}

export async function vendedorObtenerMensajes({ sesion_id, ultimo = null } = {}) {
  if (!sesion_id) throw new ApiError('sesion_id requerido', 400);
  let path = `${CHAT_VEND}/sesiones/${encodeURIComponent(sesion_id)}/mensajes`;
  if (ultimo) path += `?ultimo=${encodeURIComponent(ultimo)}`;
  const data = await request(path);
  return listFrom(data, 'mensajes', 'data', 'items').map(mapChatMensaje);
}

export async function vendedorEnviarMensaje({ session_id, mensaje } = {}) {
  if (!session_id) throw new ApiError('session_id requerido', 400);
  if (!mensaje || !String(mensaje).trim()) throw new ApiError('mensaje requerido', 400);
  return request(`${CHAT_VEND}/enviar`, {
    method: 'POST',
    body: { session_id, mensaje: String(mensaje).trim() },
  });
}

export async function vendedorArchivarSesion(session_id) {
  if (!session_id) throw new ApiError('session_id requerido', 400);
  return request(`${CHAT_VEND}/archivar`, { method: 'POST', body: { session_id } });
}

export async function vendedorGenerarIA({ session_id, mensaje = null } = {}) {
  return request(`${CHAT_VEND}/generar-respuesta-ia`, { method: 'POST', body: { session_id, mensaje } });
}

export async function vendedorRespuestasRapidas() {
  const data = await request(`${CHAT_VEND}/respuestas-rapidas`);
  return Array.isArray(data?.respuestas) ? data.respuestas : [];
}

// ================================================================
// CHAT — ADMIN
// ================================================================
export async function adminListarSesiones({ filtro = 'activas' } = {}) {
  const { token } = await loadSession();
  if (!token) return [];

  const data = await request(`${CHAT_ADMIN}/sesiones?filtro=${encodeURIComponent(filtro)}`);
  const lista = listFrom(data, 'sesiones', 'data', 'items');
  return lista.map((s) => ({
    id: String(s._id || s._id_str || s.id || ''),
    nombre: s.nombre_usuario || 'Invitado',
    email: s.email_usuario || null,
    noLeidos: Number(s.no_leidos || 0),
    ultimoMensaje: s.ultimo_mensaje || null,
    fechaUltimo: s.fecha_ultimo || s.updated_at || null,
    archivada: !!s.archivada,
    vendedorId: s.vendedor_id || null,
    asignada: !!s.asignada,
  }));
}

export async function adminObtenerMensajes({ sesion_id, ultimo = null } = {}) {
  if (!sesion_id) throw new ApiError('sesion_id requerido', 400);
  let path = `${CHAT_ADMIN}/sesiones/${encodeURIComponent(sesion_id)}/mensajes`;
  if (ultimo) path += `?ultimo=${encodeURIComponent(ultimo)}`;
  const data = await request(path);
  return listFrom(data, 'mensajes', 'data', 'items').map(mapChatMensaje);
}

export async function adminEnviarMensaje({ session_id, mensaje } = {}) {
  if (!session_id) throw new ApiError('session_id requerido', 400);
  if (!mensaje || !String(mensaje).trim()) throw new ApiError('mensaje requerido', 400);
  return request(`${CHAT_ADMIN}/enviar`, {
    method: 'POST',
    body: { session_id, mensaje: String(mensaje).trim() },
  });
}

export async function adminGenerarIA({ session_id, mensaje = null } = {}) {
  return request(`${CHAT_ADMIN}/generar-respuesta-ia`, { method: 'POST', body: { session_id, mensaje } });
}

export async function adminArchivarSesion(session_id) {
  if (!session_id) throw new ApiError('session_id requerido', 400);
  return request(`${CHAT_ADMIN}/archivar`, { method: 'POST', body: { session_id } });
}

export async function adminAnonimizarSesion(session_id) {
  if (!session_id) throw new ApiError('session_id requerido', 400);
  return request(`${CHAT_ADMIN}/anonimizar`, { method: 'POST', body: { session_id } });
}

export async function adminAsignarVendedor({ session_id, vendedor_id = null } = {}) {
  if (!session_id) throw new ApiError('session_id requerido', 400);
  return request(`${CHAT_ADMIN}/asignar`, { method: 'POST', body: { session_id, vendedor_id } });
}

export async function adminListarVendedores() {
  const data = await request(`${CHAT_ADMIN}/vendedores`);
  const lista = listFrom(data, 'vendedores', 'data', 'items');
  return lista.map((v) => ({
    id: String(v._id || v.id || ''),
    nombre: v.nombre || '',
    email: v.email || null,
  }));
}

export async function adminRespuestasRapidas() {
  const data = await request(`${CHAT_ADMIN}/respuestas-rapidas`);
  return Array.isArray(data?.respuestas) ? data.respuestas : [];
}

export async function adminAuditoria({ limite = 50 } = {}) {
  const data = await request(`${CHAT_ADMIN}/auditoria?limite=${Number(limite) || 50}`);
  return listFrom(data, 'registros', 'data', 'items');
}

export async function adminRetencionPrevisualizar() {
  return request(`${CHAT_ADMIN}/retencion/previsualizar`);
}

export async function adminRetencionEjecutar() {
  return request(`${CHAT_ADMIN}/retencion/ejecutar`, { method: 'POST' });
}

export async function adminExportarPDF(session_id) {
  if (!session_id) throw new ApiError('session_id requerido', 400);
  return request(`${CHAT_ADMIN}/exportar-pdf?session_id=${encodeURIComponent(session_id)}`);
}

export async function adminInfoNLP() {
  return request(`${CHAT_ADMIN}/nlp/info`);
}

export async function adminProbarNLP(mensaje) {
  if (!mensaje || !String(mensaje).trim()) throw new ApiError('mensaje requerido', 400);
  return request(`${CHAT_ADMIN}/nlp/probar`, {
    method: 'POST',
    body: { mensaje: String(mensaje).trim() },
  });
}

export async function adminEntrenarNLP() {
  return request(`${CHAT_ADMIN}/nlp/entrenar`, { method: 'POST' });
}

// ================================================================
// ⭐ FOTO DE PERFIL Y DATOS DE CUENTA
// ================================================================

export async function subirFotoPerfil(uri, { nombre = null, tipo = 'foto' } = {}) {
  if (!uri) throw new ApiError('uri de la foto requerido', 400);

  const { token } = await loadSession();
  if (!token) throw new ApiError('Debes iniciar sesión para subir una foto', 401);

  const extFromName = inferExtFromUri(nombre);
  const extFromUri = inferExtFromUri(uri);
  const fallbackExt = tipo === 'video' ? 'mp4' : 'jpg';
  const ext = (extFromName || extFromUri || fallbackExt).toLowerCase();
  const mime = MIME_BY_EXT[ext] || 'image/jpeg';
  const fileName = safeFileName(nombre, ext);
  const finalUri = normalizeAndroidUri(uri);

  const endpoint = `${CUENTA_BASE}/foto`;
  const url = `${SECURE_API_URL}${endpoint}`;

  const intentarNative = async () => {
    const formData = new FormData();
    formData.append('foto', { uri: finalUri, name: fileName, type: mime });
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    });
    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text };
    }
    return { res, data };
  };

  const intentarFileSystem = async () => {
    let FileSystem;
    try {
      FileSystem = require('expo-file-system/legacy');
    } catch {
      FileSystem = require('expo-file-system');
    }
    if (!FileSystem || typeof FileSystem.uploadAsync !== 'function') {
      throw new Error('expo-file-system.uploadAsync no disponible');
    }
    const res = await FileSystem.uploadAsync(url, finalUri, {
      fieldName: 'foto',
      httpMethod: 'POST',
      uploadType: FileSystem.FileSystemUploadType.MULTIPART,
      headers: {
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      mimeType: mime,
      parameters: { name: fileName },
    });
    const text = res.body || '';
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text };
    }
    return {
      res: { ok: res.status >= 200 && res.status < 300, status: res.status },
      data,
    };
  };

  let resultado;
  try {
    if (DEBUG) console.log('📤 [foto perfil] A_native → POST', endpoint);
    resultado = await intentarNative();
  } catch (e) {
    if (DEBUG) console.warn('⚠️ [foto perfil] A_native falló, probando B_fs:', e?.message);
    try {
      if (DEBUG) console.log('📤 [foto perfil] B_fs → POST', endpoint);
      resultado = await intentarFileSystem();
    } catch (e2) {
      throw new ApiError(e2?.message || 'No se pudo preparar la foto para subir', 0);
    }
  }

  const { res, data } = resultado;

  if (!res.ok) {
    const msg =
      (data && (data.message || data.error || data.mensaje)) ||
      `Error ${res.status} al subir la foto`;
    if (res.status === 401) throw new ApiError('Sesión expirada. Vuelve a iniciar sesión.', 401, data);
    if (res.status === 400) throw new ApiError(msg || 'Foto inválida', 400, data);
    if (res.status === 404) throw new ApiError('El servidor no tiene la ruta de subida. Contacta a soporte.', 404, data);
    throw new ApiError(msg, res.status, data);
  }

  const fotoUrl = data?.fotoUrl || data?.url || data?.usuario?.fotoUrl || null;
  return {
    success: true,
    fotoUrl,
    usuario: data?.usuario || null,
    raw: data,
  };
}

export async function eliminarFotoPerfil() {
  const { token } = await loadSession();
  if (!token) throw new ApiError('Debes iniciar sesión', 401);
  return request(`${CUENTA_BASE}/foto`, { method: 'DELETE' });
}

export async function actualizarPerfil(payload = {}) {
  if (!payload || typeof payload !== 'object') {
    throw new ApiError('payload inválido', 400);
  }
  return request(`${CUENTA_BASE}/perfil`, { method: 'PUT', body: payload });
}

// ================================================================
// ⭐ NUEVAS FUNCIONES PARA EL PERFIL EXTENDIDO (Cartera, Lealtad, etc.)
// ================================================================

export async function fetchMonedero() {
  const data = await request(`${CUENTA_BASE}/monedero`);
  return {
    saldo: Number(data.saldo || 0),
    bonificacionMesas: Number(data.bonificacion_mesas || 0),
    saldoTotal: Number(data.saldo_total || 0),
    numeroTarjeta: data.numero_tarjeta || '**** **** **** 0000',
  };
}

export async function fetchFacturacion() {
  const data = await request(`${CUENTA_BASE}/facturacion`);
  return data.datos || {};
}

export async function fetchLealtad() {
  const data = await request(`${CUENTA_BASE}/lealtad`);
  return {
    nivel: data.nivel || 'Bronce',
    puntos: Number(data.puntos || 0),
    cupones: Array.isArray(data.cupones) ? data.cupones : [],
    bonificacionMesas: Number(data.bonificacion_mesas || 0),
  };
}

// ================================================================
// ⭐ DATOS PERSONALES (PUT /perfil)
// ================================================================
export async function fetchPerfil() {
  const data = await request(`${CUENTA_BASE}/perfil`);
  const u = data?.usuario || data?.user || data || {};
  return {
    nombre: u.nombre || '',
    apellido_paterno: u.apellido_paterno || '',
    apellido_materno: u.apellido_materno || '',
    email: u.email || '',
    telefono: u.telefono || '',
    fecha_nacimiento: u.fecha_nacimiento || '',
    genero: u.genero || u.sexo || '',
    foto: u.foto || null,
    fotoUrl: resolveUserPhoto(u.fotoUrl || u.foto),
  };
}

export async function guardarPerfil(payload = {}) {
  const body = {};
  for (const campo of [
    'nombre',
    'apellido_paterno',
    'apellido_materno',
    'email',
    'telefono',
    'fecha_nacimiento',
    'genero',
  ]) {
    if (payload[campo] !== undefined && payload[campo] !== null) {
      body[campo] = String(payload[campo]).trim();
    }
  }
  return request(`${CUENTA_BASE}/perfil`, { method: 'PUT', body });
}

// ================================================================
// ⭐ INTERESES (GET/POST/DELETE /intereses)
// ================================================================
export async function fetchIntereses() {
  const data = await request(`${CUENTA_BASE}/intereses`);
  const raw = data?.intereses || data?.data || data || {};
  return {
    categorias: Array.isArray(raw.categorias) ? raw.categorias.map(String) : [],
    marcas: Array.isArray(raw.marcas) ? raw.marcas.map(String) : [],
    estilos: Array.isArray(raw.estilos) ? raw.estilos.map(String) : [],
    actividades: Array.isArray(raw.actividades) ? raw.actividades.map(String) : [],
    ocasiones: Array.isArray(raw.ocasiones) ? raw.ocasiones.map(String) : [],
    frecuencia: typeof raw.frecuencia === 'string' ? raw.frecuencia : '',
    actualizado: raw.actualizado || raw.updatedAt || null,
  };
}

export async function guardarIntereses(payload = {}) {
  const body = {
    categorias: Array.isArray(payload.categorias) ? payload.categorias.map(String) : [],
    marcas: Array.isArray(payload.marcas) ? payload.marcas.map(String) : [],
    estilos: Array.isArray(payload.estilos) ? payload.estilos.map(String) : [],
    actividades: Array.isArray(payload.actividades) ? payload.actividades.map(String) : [],
    ocasiones: Array.isArray(payload.ocasiones) ? payload.ocasiones.map(String) : [],
    frecuencia: typeof payload.frecuencia === 'string' ? payload.frecuencia : '',
  };
  const res = await request(`${CUENTA_BASE}/intereses`, { method: 'POST', body });
  if (res && typeof res === 'object' && res.ok === undefined && res.success === undefined) {
    return { ...res, ok: true };
  }
  return res;
}

export async function borrarIntereses() {
  return request(`${CUENTA_BASE}/intereses`, { method: 'DELETE' });
}

// ================================================================
// ⭐ PRIVACIDAD (GET/PUT /privacidad)
// ================================================================
export async function fetchPrivacidad() {
  const data = await request(`${CUENTA_BASE}/privacidad`);
  const raw = data?.preferencias || data?.data || data || {};
  return {
    personalizacion: raw.personalizacion !== false,
    analiticas: raw.analiticas !== false,
    compartir_socios: raw.compartir_socios === true,
  };
}

export async function guardarPrivacidad(payload = {}) {
  const body = {
    personalizacion: payload.personalizacion !== false,
    analiticas: payload.analiticas !== false,
    compartir_socios: payload.compartir_socios === true,
  };
  return request(`${CUENTA_BASE}/privacidad`, { method: 'PUT', body });
}

// ================================================================
// ⭐ IDIOMA (GET/PUT /cuenta/idioma)
// ================================================================
export async function fetchIdioma() {
  try {
    const data = await request(`${CUENTA_BASE}/idioma`);
    const p = data?.preferencias || data?.data || data || {};
    const idioma = normalizarLang(p.idioma || 'es-MX');
    const moneda = p.moneda || 'MXN';
    const region = p.region || p.pais || 'MX';
    if (idioma !== memLang) {
      await setLanguageLocal(idioma);
    }
    return { idioma, moneda, region };
  } catch {
    return { idioma: memLang, moneda: 'MXN', region: 'MX' };
  }
}

export async function guardarIdioma({ idioma, moneda, region } = {}) {
  const lang = normalizarLang(idioma || memLang);
  const body = {
    idioma: lang === 'en' ? 'en-US' : 'es-MX',
    moneda: moneda || 'MXN',
    region: region || 'MX',
  };
  const res = await request(`${CUENTA_BASE}/idioma`, {
    method: 'PUT',
    body,
  });
  await setLanguageLocal(lang);
  try {
    const { token, user } = await loadSession();
    if (token && user) {
      await saveSession(token, { ...user, language: lang });
    }
  } catch {}
  return res;
}

// ================================================================
// ⭐ SEGURIDAD Y ACCESO (contraseña, 2FA, sesiones)
// ================================================================

export async function cambiarPassword({ actual, nueva, confirmar } = {}) {
  const password_actual = String(actual || '').trim();
  const password_nuevo = String(nueva || '').trim();
  const password_confirmar = String(confirmar ?? nueva ?? '').trim();

  if (!password_actual || !password_nuevo) {
    throw new ApiError('Completa todos los campos', 400);
  }
  if (password_nuevo.length < 8) {
    throw new ApiError('La nueva contraseña debe tener al menos 8 caracteres', 400);
  }
  if (password_nuevo !== password_confirmar) {
    throw new ApiError('Las contraseñas no coinciden', 400);
  }
  if (password_nuevo === password_actual) {
    throw new ApiError('La nueva contraseña debe ser distinta a la actual', 400);
  }

  const body = { password_actual, password_nuevo, password_confirmar };

  try {
    return await request(`${CUENTA_BASE}/cambiar-password`, { method: 'POST', body });
  } catch (e) {
    if (e?.status === 404) {
      return request(`${CUENTA_BASE}/password`, {
        method: 'PUT',
        body: { password_actual, password_nueva: password_nuevo },
      });
    }
    throw e;
  }
}

export async function fetchEstado2FA() {
  const data = await request(`${CUENTA_BASE}/2fa/estado`);
  const habilitado = !!(data?.habilitado ?? data?.data?.activo ?? false);
  const restantes = Number(
    data?.codigos_respaldo_restantes ??
      data?.data?.codigos_respaldo_restantes ??
      0
  );
  return { habilitado, codigos_respaldo_restantes: restantes };
}

export async function iniciar2FA() {
  const data = await request(`${CUENTA_BASE}/2fa/iniciar`, { method: 'POST' });
  const secreto = data?.secreto || data?.data?.secret || data?.data?.secreto || '';
  const qr_base64 = data?.qr_base64 || data?.data?.qr_base64 || '';
  const otpauth_url = data?.otpauth_url || data?.data?.otpauth_url || '';
  return { secreto, qr_base64, otpauth_url };
}

export async function confirmar2FA(codigo) {
  const c = String(codigo || '').replace(/\D/g, '').slice(0, 6);
  if (c.length !== 6) throw new ApiError('Ingresa un código de 6 dígitos', 400);
  const data = await request(`${CUENTA_BASE}/2fa/confirmar`, {
    method: 'POST',
    body: { codigo: c },
  });
  const codigos_respaldo = Array.isArray(data?.codigos_respaldo)
    ? data.codigos_respaldo
    : Array.isArray(data?.data?.codigos_respaldo)
    ? data.data.codigos_respaldo
    : [];
  return { ok: data?.ok !== false, codigos_respaldo };
}

export async function desactivar2FA(password, codigo = null) {
  const pwd = String(password || '').trim();
  if (!pwd) throw new ApiError('Ingresa tu contraseña', 400);
  const body = { password: pwd };
  if (codigo) {
    const c = String(codigo).replace(/\D/g, '').slice(0, 6);
    if (c.length === 6) body.codigo = c;
  }
  return request(`${CUENTA_BASE}/2fa/desactivar`, { method: 'POST', body });
}

export async function regenerarCodigos2FA(password, codigo = null) {
  const pwd = String(password || '').trim();
  if (!pwd) throw new ApiError('Ingresa tu contraseña', 400);
  const body = { password: pwd };
  if (codigo) {
    const c = String(codigo).replace(/\D/g, '').slice(0, 6);
    if (c.length === 6) body.codigo = c;
  }
  const data = await request(`${CUENTA_BASE}/2fa/regenerar-codigos`, {
    method: 'POST',
    body,
  });
  const codigos_respaldo = Array.isArray(data?.codigos_respaldo)
    ? data.codigos_respaldo
    : [];
  return { ok: data?.ok !== false, codigos_respaldo };
}

const _mapSesion = (s = {}) => ({
  id: String(s.id || s._id || ''),
  actual: !!s.actual || !!s.current || !!s.is_current,
  dispositivo: s.dispositivo || s.device || s.device_name || 'Dispositivo desconocido',
  ip: s.ip || s.ip_address || '',
  inicio: s.creada || s.created_at || null,
  ultimaActividad: s.ultima_actividad || s.last_active || s.updated_at || s.updatedAt || null,
  raw: s,
});

export async function fetchSesiones() {
  const data = await request(`${CUENTA_BASE}/sesiones`);
  const lista =
    (Array.isArray(data?.sesiones) && data.sesiones) ||
    (Array.isArray(data?.data) && data.data) ||
    (Array.isArray(data) && data) ||
    [];
  return lista.map(_mapSesion);
}

export async function cerrarSesion(sesionId) {
  if (!sesionId) throw new ApiError('sesionId requerido', 400);
  return request(`${CUENTA_BASE}/sesiones/${encodeURIComponent(String(sesionId))}`, {
    method: 'DELETE',
  });
}

export async function cerrarTodasSesiones() {
  return request(`${CUENTA_BASE}/sesiones/cerrar-todas`, { method: 'POST' });
}

// ================================================================
// ⭐ SOLICITUDES (NUEVO — actividad de sincronización)
// ================================================================
// Todas usan SOLICITUDES_BASE = `/api/v1/solicitudes` (consistente
// con el resto del archivo). `request()` se encarga de:
//   - agregar ?lang= y ?_t=
//   - agregar Authorization: Bearer <token>
//   - lanzar ApiError con .status cuando el backend devuelve error
// → `errorHandler.js` → `mensajeSeguro(error)` lo captura y muestra
//    un mensaje limpio al usuario.

export async function fetchSolicitudes() {
  const data = await request(SOLICITUDES_BASE, { auth: true });
  return data?.solicitudes || [];
}

export async function fetchSolicitudDetalle(id) {
  if (!id) throw new ApiError('ID de solicitud requerido', 400);
  const data = await request(`${SOLICITUDES_BASE}/${encodeURIComponent(String(id))}`, {
    auth: true,
  });
  return data?.solicitud || data;
}

export async function crearSolicitud({ pedido_id, tipo, descripcion }) {
  if (!pedido_id) throw new ApiError('Selecciona un pedido', 400);
  if (!tipo) throw new ApiError('Selecciona un tipo', 400);
  if (!descripcion || String(descripcion).trim().length < 10) {
    throw new ApiError('La descripción debe tener al menos 10 caracteres', 400);
  }

  const data = await request(SOLICITUDES_BASE, {
    method: 'POST',
    auth: true,
    body: {
      pedido_id: String(pedido_id),
      tipo,
      descripcion: String(descripcion).trim(),
    },
  });
  return data?.solicitud || data;
}