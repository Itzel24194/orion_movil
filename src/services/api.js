// services/api.js
import { API_URL, REQUEST_TIMEOUT_MS } from '../config/api';

const TOKEN_KEY = '@orion/auth/token';
const USER_KEY = '@orion/auth/user';

const _rawMedia = (process.env.EXPO_PUBLIC_MEDIA_URL || '').replace(/\/+$/, '');
const MEDIA_BASE = _rawMedia.replace(/\/static\/uploads\/?$/i, '');

const DEBUG = __DEV__;

if (DEBUG && !MEDIA_BASE) {
  console.warn('⚠️ [api.js] EXPO_PUBLIC_MEDIA_URL NO está configurado. Las fotos no se verán.');
} else if (DEBUG) {
  console.log('🖼️ [api.js] MEDIA_BASE =', MEDIA_BASE);
}

// ⭐ Prefijo único de API — todo pasa por aquí
const API_PREFIX = '/api/v1';

let memToken = null;
let memUser = null;

// ⭐ AsyncStorage con require diferido para evitar require cycles.
let _AsyncStorage = null;
function getAsyncStorage() {
  if (_AsyncStorage) return _AsyncStorage;
  // eslint-disable-next-line global-require
  const mod = require('@react-native-async-storage/async-storage');
  _AsyncStorage = mod?.default || mod;
  if (!_AsyncStorage || typeof _AsyncStorage.getItem !== 'function') {
    console.warn('⚠️ AsyncStorage no está disponible. Instala @react-native-async-storage/async-storage');
  }
  return _AsyncStorage;
}

// ================================================================
// NORMALIZACIÓN DE GÉNERO
// ================================================================
export const normalizarGenero = (valor) => {
  if (!valor) return 'Indefinido';
  const v = String(valor).trim().toLowerCase();
  if (['masculino', 'hombre', 'm', 'male', 'man'].includes(v)) return 'Masculino';
  if (['femenino', 'mujer', 'f', 'female', 'woman'].includes(v)) return 'Femenino';
  return 'Indefinido';
};

// ---------- Sesión ----------
export async function loadSession() {
  const AsyncStorage = getAsyncStorage();
  if (memToken === null) memToken = (await AsyncStorage.getItem(TOKEN_KEY)) || '';
  if (memUser === null) {
    try { memUser = JSON.parse((await AsyncStorage.getItem(USER_KEY)) || 'null'); } catch { memUser = null; }
  }
  return { token: memToken, user: memUser };
}

export async function saveSession(token, user) {
  const AsyncStorage = getAsyncStorage();
  memToken = token || '';
  memUser = user || null;
  await AsyncStorage.setItem(TOKEN_KEY, memToken);
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(memUser));
}

export async function clearSession() {
  const AsyncStorage = getAsyncStorage();
  memToken = '';
  memUser = null;
  await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
}

export async function getCurrentUser() {
  const { token, user } = await loadSession();
  return token ? user : null;
}

// ---------- Normalizadores ----------
export const normalizeUser = (u = {}) => {
  const genero = normalizarGenero(u.genero ?? u.sexo ?? u.gender ?? '');
  return {
    id: String(u.id || u._id || u.user_id || ''),
    name: u.name || u.nombre || u.username || '',
    email: u.email || u.correo || '',
    role: (u.role || u.rol || 'cliente') === 'admin' ? 'admin' : (u.role || u.rol || 'cliente'),
    genero,
    sexo: genero,
  };
};

export const isAdmin = (user) => !!user && user.role === 'admin';

export function resolveUrl(value) {
  if (!value) return null;
  if (/^(https?:|file:|data:)/i.test(value)) return value;
  return `${API_URL}${value.startsWith('/') ? '' : '/'}${value}`;
}

// ⭐⭐⭐ FIX: resolveUserPhoto robusto
//    Acepta strings, objetos {url, path, nombre}, y reconstruye la URL
//    con MEDIA_BASE. Si ya viene con http://, la deja tal cual.
export function resolveUserPhoto(foto) {
  if (!foto) return null;

  // ⭐ Aceptar objetos {url, path, filename, nombre}
  if (typeof foto === 'object') {
    foto = foto.url || foto.path || foto.filename || foto.nombre || '';
  }

  if (typeof foto !== 'string') return null;
  const clean = foto.trim();
  if (!clean) return null;

  // ⭐ Si ya es URL absoluta, devolverla tal cual
  if (/^(https?:|file:|data:)/i.test(clean)) return clean;

  // ⭐ Si no hay MEDIA_BASE, no podemos construir la URL
  if (!MEDIA_BASE) {
    if (DEBUG) console.warn('⚠️ [resolveUserPhoto] MEDIA_BASE vacío, devolviendo null para:', clean);
    return null;
  }

  // ⭐ Si empieza con / o "static/" o "uploads/"
  if (/^(static|uploads)\//i.test(clean) || clean.startsWith('/')) {
    return `${MEDIA_BASE}/${clean.replace(/^\/+/, '')}`;
  }

  // ⭐ Default: asumir que es solo el nombre del archivo
  return `${MEDIA_BASE}/static/uploads/${clean}`;
}

export function resolveProductPhoto(foto) {
  if (!foto) return null;
  if (typeof foto === 'object') {
    foto = foto.url || foto.nombre || foto.path || foto.filename || '';
  }
  if (typeof foto !== 'string') return null;
  const clean = foto.trim();
  if (!clean) return null;
  if (/^(https?:|file:|data:)/i.test(clean)) return clean;
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
  if (typeof foto === 'object') {
    foto = foto.url || foto.nombre || foto.path || foto.filename || '';
  }
  if (typeof foto !== 'string') return null;
  const clean = foto.trim();
  if (!clean) return null;
  if (/^(https?:|file:|data:)/i.test(clean)) return clean;
  if (!MEDIA_BASE) return null;
  const filename = clean.split('/').pop().replace(/\.[^.]+$/, '');
  return `${MEDIA_BASE}/static/uploads/productos_clean/${filename}.png`;
}

export function normalizeProduct(p = {}) {
  const imgs = Array.isArray(p.imagenes) ? p.imagenes : Array.isArray(p.images) ? p.images : [];
  const image = p.image || p.imagen || p.imagen_url || imgs[0];
  const activo = p.activo !== false && p.estado !== 'inactivo';
  return {
    id: String(p.id || p._id || ''),
    name: p.name || p.nombre || '',
    price: String(p.price ?? p.precio ?? 0),
    image: resolveUrl(typeof image === 'string' ? image : image?.url) || 'https://via.placeholder.com/200',
    description: p.description || p.descripcion || '',
    category: p.category || p.categoria_nombre || p.categoria || '',
    stock: Number(p.stock ?? p.existencias ?? 0),
    status: p.status || (!activo ? 'Inactivo' : Number(p.stock ?? 1) === 0 ? 'Agotado' : 'Activo'),
    videoUrl: p.videoUrl || p.video_url || '',
  };
}

export function normalizeOrder(o = {}) {
  const items = (o.items || o.productos || []).map((x) => ({
    productId: String(x.productId || x.producto_id || x.id || ''),
    name: x.name || x.nombre || 'Artículo',
    quantity: Number(x.quantity ?? x.cantidad ?? 1),
    unitPrice: Number(x.unitPrice ?? x.precio ?? x.precio_unitario ?? 0),
    size: x.size || x.talla || null,
    color: x.color || null,
  }));
  return {
    id: String(o.id || o._id || o.numero_pedido || ''),
    items,
    status: String(o.status || o.estado || 'pendiente'),
    paymentStatus: o.paymentStatus || o.estado_pago || '',
    totalEstimado: Number(o.totalEstimado ?? o.total ?? 0),
    subtotalEstimado: Number(o.subtotalEstimado ?? o.subtotal ?? 0),
    envioEstimado: Number(o.envioEstimado ?? o.envio ?? 0),
    address: o.address || o.direccion || '',
    phone: o.phone || o.telefono || '',
    createdAt: o.createdAt || o.fecha || o.fecha_creacion || o.creado_en || null,
  };
}

// ---------- Cliente HTTP ----------
export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

const toFormBody = (obj) =>
  Object.keys(obj)
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(obj[k] ?? '')}`)
    .join('&');

export async function request(path, { method = 'GET', body, form, auth = true, headers = {} } = {}) {
  const { token } = await loadSession();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  let finalPath = path;
  if (method === 'GET') {
    const sep = path.includes('?') ? '&' : '?';
    finalPath = `${path}${sep}_t=${Date.now()}`;
  }
  const url = `${API_URL}${finalPath}`;
  const finalHeaders = {
    Accept: 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    Pragma: 'no-cache',
    ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    ...(form !== undefined ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
    ...(auth && token ? { Authorization: `Bearer ${token}` } : {}),
    ...headers,
  };
  const finalBody =
    form !== undefined
      ? toFormBody(form)
      : body !== undefined
      ? JSON.stringify(body)
      : undefined;
  if (DEBUG) {
    console.log('🌐 →', method, url);
    if (finalBody) console.log('📤 body:', finalBody);
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
    try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }

    if (DEBUG) {
      console.log('📥 ←', res.status, url);
      console.log('📦 data:', data);
    }

    if (!res.ok) {
      const msg = (data && (data.error || data.message || data.mensaje)) || `Error ${res.status}`;
      throw new ApiError(msg, res.status, data);
    }
    return data;
  } catch (e) {
    if (e.name === 'AbortError') throw new ApiError('Tiempo de espera agotado', 0);
    if (e instanceof ApiError) throw e;
    if (DEBUG) console.log('🔥 fetch error crudo:', e);
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
// AUTH
// ================================================================
// ⭐ LOGIN SIMPLIFICADO — sin warnings ruidosos de reintentos.
//    Un solo intento JSON {email, password}.
//    Si las credenciales son incorrectas → error limpio 401.
export async function login(email, password) {
  if (DEBUG) console.log('🔐 login intento');

  const data = await request(`${API_PREFIX}/auth/login`, {
    method: 'POST',
    auth: false,
    body: { email, password },
  });

  const token = data?.token || data?.access_token || data?.jwt;
  if (!token) {
    throw new ApiError('Respuesta de login inválida (sin token)', 500, data);
  }

  const user = normalizeUser(data.user || data.usuario || {});
  if (user.role === 'administrador' || user.role === 'administrator') {
    user.role = 'admin';
  }

  await saveSession(token, user);
  if (DEBUG) console.log('✅ Login OK', user);
  return user;
}

export async function register({ name, email, password }) {
  const data = await request(`${API_PREFIX}/auth/register`, {
    method: 'POST',
    auth: false,
    body: { name, nombre: name, email, password },
  });
  const token = data.token || data.access_token || data.jwt;
  if (token) await saveSession(token, normalizeUser(data.user || data.usuario || { name, email }));
  return data;
}

export async function fetchMe() {
  const data = await request(`${API_PREFIX}/auth/me`);
  const raw = data.user || data.usuario || data;
  const user = normalizeUser(raw);

  if (user.role === 'administrador' || user.role === 'administrator') user.role = 'admin';

  user.direcciones = Array.isArray(raw.direcciones)
    ? raw.direcciones
    : Array.isArray(raw.addresses)
    ? raw.addresses
    : [];

  const { token } = await loadSession();
  await saveSession(token, user);
  return user;
}

export async function logout() {
  try { await request(`${API_PREFIX}/auth/logout`, { method: 'POST' }); } catch { /* cierre local */ }
  await clearSession();
}

export async function requestPasswordReset(email) {
  return request(`${API_PREFIX}/auth/recuperar`, { method: 'POST', auth: false, body: { email } });
}

// ================================================================
// DIRECCIONES DEL USUARIO
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

const CUENTA_BASE = `${API_PREFIX}/cuenta`;

export async function fetchDirecciones() {
  try {
    const r = await request(`${CUENTA_BASE}/direcciones`, { method: 'GET' });
    const raw =
      (Array.isArray(r?.data) && r.data) ||
      (Array.isArray(r?.direcciones) && r.direcciones) ||
      (Array.isArray(r) && r) ||
      [];
    if (raw.length || (Array.isArray(r?.data) && r.data.length === 0)) {
      return raw.map(normalizarDir);
    }
  } catch (e) {
    if (DEBUG) console.log('⚠️ GET /cuenta/direcciones falló:', e?.status, e?.message);
  }

  try {
    const u = await fetchMe();
    return Array.isArray(u?.direcciones) ? u.direcciones.map(normalizarDir) : [];
  } catch {
    return [];
  }
}

export async function guardarDirecciones(direcciones) {
  if (!Array.isArray(direcciones)) {
    throw new ApiError('direcciones debe ser un array', 400);
  }

  const payloadBackend = direcciones.map(dirToBackend);

  try {
    const r = await request(`${CUENTA_BASE}/direcciones`, {
      method: 'PUT',
      body: { direcciones: payloadBackend },
    });
    if (DEBUG) console.log('✅ Direcciones guardadas (PUT bulk)');
    return r;
  } catch (e) {
    if (DEBUG) console.log('⚠️ PUT bulk falló:', e?.status, e?.message);
  }

  try {
    let ultima = null;
    for (const d of payloadBackend) {
      ultima = await request(`${CUENTA_BASE}/direcciones`, {
        method: 'POST',
        body: d,
      });
    }
    if (DEBUG) console.log('✅ Direcciones guardadas (POST individual)');
    return ultima;
  } catch (e) {
    if (DEBUG) console.log('⚠️ POST individual falló:', e?.status, e?.message);
  }

  throw new ApiError('No se pudieron guardar las direcciones', 500);
}

// ---------- Productos (legacy) ----------
export async function fetchProducts() {
  const data = await request(`${API_PREFIX}/productos`, { auth: false });
  return listFrom(data, 'productos', 'data', 'items').map(normalizeProduct);
}

const productPayload = (p) => ({
  nombre: p.name, name: p.name,
  categoria: p.category, category: p.category,
  precio: Number(p.price), price: Number(p.price),
  stock: Number(p.stock) || 0,
  descripcion: p.description, description: p.description,
  estado: p.status, status: p.status,
  video_url: p.videoUrl, videoUrl: p.videoUrl,
  imagen: p.image, image: p.image,
});

export const createProduct = (p) => request(`${API_PREFIX}/admin/productos/agregar`, { method: 'POST', body: productPayload(p) });
export const updateProduct = (id, p) => request(`${API_PREFIX}/admin/productos/editar/${id}`, { method: 'POST', body: productPayload(p) });
export const deleteProduct = (id) => request(`${API_PREFIX}/admin/productos/borrar/${id}`, { method: 'POST' });

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

// ---------- Admin Stats ----------
export async function fetchAdminStats() {
  const out = { usersCount: 0, ordersToday: 0, pendingOrders: 0, couponsCount: 0 };

  try {
    const u = await request(`${API_PREFIX}/admin/usuarios`);
    out.usersCount = listFrom(u, 'usuarios', 'data', 'items').length;
  } catch { /* sin permisos */ }

  try {
    const orders = await request(`${API_PREFIX}/pedidos`).then((d) =>
      listFrom(d, 'pedidos', 'data', 'items').map(normalizeOrder)
    );
    const start = new Date(); start.setHours(0, 0, 0, 0);
    out.ordersToday = orders.filter((o) => o.createdAt && new Date(o.createdAt) >= start).length;
    out.pendingOrders = orders.filter((o) => /pend|prepar/i.test(o.status)).length;
  } catch { /* idem */ }

  try {
    const r = await request(`${API_PREFIX}/admin/ventas/resumen`);
    if (r && r.cupones_activos !== undefined) out.couponsCount = Number(r.cupones_activos) || 0;
  } catch { /* idem */ }

  return out;
}

// ================================================================
// ADMIN — Usuarios
// ================================================================
const mapAdminUser = (u = {}) => {
  const generoNorm = normalizarGenero(u.genero ?? u.sexo ?? u.gender ?? '');

  // ⭐ Priorizar fotoUrl si viene como URL completa
  const fotoRaw = u.foto || u.avatar || u.imagen || null;
  const fotoUrlRaw = u.fotoUrl || null;
  const fotoFinal = fotoUrlRaw || fotoRaw;

  const fotoUrlResuelta = resolveUserPhoto(fotoFinal);

  if (DEBUG && (fotoRaw || fotoUrlRaw)) {
    console.log(`🖼️ [mapAdminUser] ${u.nombre || u.email}:`, {
      foto_raw: fotoRaw,
      fotoUrl_raw: fotoUrlRaw,
      fotoUrl_resuelta: fotoUrlResuelta,
    });
  }

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
      : (Array.isArray(u.addresses) ? u.addresses.map(normalizarDir) : []),
    complexion: u.complexion && typeof u.complexion === 'object' ? u.complexion : null,
    intereses: u.intereses && typeof u.intereses === 'object' ? u.intereses : null,
    _raw: u,
  };
};

// ⭐ Detalle fresco de UN usuario.
export async function fetchAdminUserDetail(id) {
  if (id === undefined || id === null || id === '') return null;
  const idStr = String(id);

  // Intento 1: endpoint RESTful /:id
  try {
    const res = await request(`${API_PREFIX}/admin/usuarios/${idStr}`);
    const raw = res?.usuario || res?.data || res?.user || res;
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      const hasId = raw._id || raw.id || raw.email || raw.nombre;
      if (hasId) {
        if (DEBUG) console.log('🎯 [fetchAdminUserDetail] detalle OK vía /:id');
        return mapAdminUser(raw);
      }
    }
  } catch (e) {
    if (DEBUG) console.log('⚠️ [fetchAdminUserDetail] /:id falló:', e?.status, e?.message);
  }

  // Intento 2: query param ?id=
  try {
    const res = await request(`${API_PREFIX}/admin/usuarios?id=${encodeURIComponent(idStr)}`);
    const lista = listFrom(res, 'usuarios', 'data', 'items', 'results', 'users');
    const found = lista.find((u) => String(u._id || u.id || u.user_id) === idStr);
    if (found) {
      if (DEBUG) console.log('🎯 [fetchAdminUserDetail] detalle OK vía ?id=');
      return mapAdminUser(found);
    }
  } catch (e) {
    if (DEBUG) console.log('⚠️ [fetchAdminUserDetail] ?id= falló:', e?.status, e?.message);
  }

  // Intento 3: listado completo + find local
  try {
    const res = await request(`${API_PREFIX}/admin/usuarios?limit=500`);
    const lista = listFrom(res, 'usuarios', 'data', 'items', 'results', 'users');
    const found = lista.find((u) => String(u._id || u.id || u.user_id) === idStr);
    if (found) {
      if (DEBUG) console.log('🎯 [fetchAdminUserDetail] detalle OK vía listado completo');
      return mapAdminUser(found);
    }
  } catch (e) {
    if (DEBUG) console.log('⚠️ [fetchAdminUserDetail] listado completo falló:', e?.status, e?.message);
  }

  if (DEBUG) {
    console.warn(
      '❌ [fetchAdminUserDetail] No se pudo obtener el detalle para id', idStr,
    );
  }
  return null;
}

export async function fetchAdminUsers(params = {}) {
  const qs = new URLSearchParams();
  if (params.page) qs.set('page', params.page);
  if (params.limit) qs.set('limit', params.limit);
  if (params.rol && params.rol !== 'todos') qs.set('rol', params.rol);
  if (params.q) qs.set('q', params.q);
  if (params.id !== undefined && params.id !== null && params.id !== '') {
    qs.set('id', String(params.id));
  }
  const query = qs.toString();
  const path = `${API_PREFIX}/admin/usuarios${query ? `?${query}` : ''}`;
  const data = await request(path);
  if (DEBUG) {
    console.log('👥 [fetchAdminUsers] Respuesta backend:', JSON.stringify(data, null, 2));
  }
  const lista = listFrom(data, 'usuarios', 'data', 'items', 'results', 'users');
  const meta = data?.meta || data?.pagination || data?.paginacion || {};
  return {
    usuarios: lista.map(mapAdminUser),
    total: Number(meta.total ?? meta.count ?? lista.length),
    page: Number(meta.page ?? meta.current_page ?? 1),
    limit: Number(meta.limit ?? meta.per_page ?? lista.length),
    pages: Number(
      meta.pages ??
      meta.total_pages ??
      (meta.total ? Math.ceil(meta.total / (meta.limit || lista.length || 1)) : 1)
    ),
  };
}

// ================================================================
// UPDATE
// ================================================================
export async function updateAdminUser(id, data) {
  const body = { ...data };
  const generoRaw = body.genero ?? body.sexo;
  if (generoRaw !== undefined && generoRaw !== null && generoRaw !== '') {
    const genero = normalizarGenero(generoRaw);
    body.genero = genero;
    body.sexo   = genero;
  }
  const res = await request(`${API_PREFIX}/admin/usuarios/${id}`, { method: 'PUT', body });
  if (DEBUG) {
    console.log(`✅ [updateAdminUser] res:`, JSON.stringify(res, null, 2));
  }
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

// ---------- Complexión ----------
export const COMPLEXION_PATHS = [
  `${API_PREFIX}/complexion`,
  `${API_PREFIX}/complexion/obtener`,
];

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

  const query = qs.toString();
  const path = `${API_PREFIX}/categorias${query ? `?${query}` : ''}`;

  const data = await request(path, { auth: false });
  const lista = listFrom(data, 'data', 'categorias', 'items');

  return lista.map((c) => ({
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
  const tree = Array.isArray(data?.data) ? data.data : [];
  return tree;
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
const mapTemporada = (t) => ({
  id: String(t.id || t._id || ""),
  nombre: t.nombre || "",
  descripcion: t.descripcion || "",
  imagen: t.imagen ? resolveUrl(t.imagen) : null,
  imagenRaw: t.imagen || "",
  color: t.color || "#7C3AED",
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
  if (params.activa !== undefined) partes.push("activa=" + params.activa);
  if (params.incluir_inactivas) partes.push("incluir_inactivas=true");
  if (params.destacada) partes.push("destacada=true");
  const query = partes.join("&");

  const data = await request(
    `${API_PREFIX}/temporadas` + (query ? "?" + query : ""),
    { auth: false }
  );

  const lista = listFrom(data, "data", "temporadas", "items");
  return lista.map(mapTemporada);
}

export async function fetchTemporadaActiva() {
  try {
    const data = await request(`${API_PREFIX}/temporadas/activa`, { auth: false });
    if (!data || !data.data) return null;
    return mapTemporada(data.data);
  } catch (e) {
    return null;
  }
}

export async function fetchTemporada(id) {
  const data = await request(`${API_PREFIX}/temporadas/` + id, { auth: false });
  if (!data || !data.data) return null;
  return mapTemporada(data.data);
}

export async function createTemporada(payload) {
  return request(`${API_PREFIX}/admin/temporadas`, { method: "POST", body: payload });
}

export async function updateTemporada(id, payload) {
  return request(`${API_PREFIX}/admin/temporadas/` + id, { method: "PUT", body: payload });
}

export async function deleteTemporada(id) {
  return request(`${API_PREFIX}/admin/temporadas/` + id, { method: "DELETE" });
}

// ================================================================
// PRODUCTOS (ADMIN)
// ================================================================
const mapVariante = (v = {}) => ({
  sku: v.sku || '',
  color: v.color || '',
  tamano: String(v.tamano || v.talla || v.size || '')
    .replace(/\s+/g, ' ')
    .trim(),
  precio: Number(v.precio ?? v.price ?? 0),
  stock: Number(v.stock ?? v.cantidad ?? 0),
});

const mapProducto = (p = {}) => {
  const rawVars =
    Array.isArray(p.variables) && p.variables.length > 0
      ? p.variables
      : (Array.isArray(p.variantes) ? p.variantes : []);

  const variables = rawVars.map(mapVariante);
  const totalStock = variables.reduce((s, v) => s + (Number(v.stock) || 0), 0);
  const variantesCount = variables.length;

  const marcaIdRaw = p.marca_id || p.empresa_id || null;

  const fotosRaw = Array.isArray(p.fotos) ? p.fotos : [];
  const fotos = fotosRaw
    .map((f) => (typeof f === 'string' ? f : (f?.url || f?.nombre || '')))
    .filter(Boolean);

  const videosRaw = Array.isArray(p.videos) ? p.videos : [];
  const videos = videosRaw
    .map((v) => (typeof v === 'string' ? v : (v?.url || v?.nombre || '')))
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
    variantesCount,
    createdAt: p.createdAt || p.created_at || null,
    updatedAt: p.updatedAt || p.updated_at || null,
  };
};

export async function fetchProductos(params = {}) {
  const partes = [];
  if (params.categoria_id) partes.push("categoria_id=" + params.categoria_id);
  if (params.marca_id) partes.push("marca_id=" + params.marca_id);
  if (params.temporada_id) partes.push("temporada_id=" + params.temporada_id);
  if (params.estado) partes.push("estado=" + params.estado);
  if (params.q) partes.push("q=" + encodeURIComponent(params.q));
  const query = partes.join("&");

  const data = await request(
    `${API_PREFIX}/productos` + (query ? "?" + query : ""),
    { auth: false }
  );
  const lista = listFrom(data, "data", "productos", "items");
  return lista.map(mapProducto);
}

export async function fetchProducto(id) {
  const data = await request(`${API_PREFIX}/productos/` + id, { auth: false });
  return data?.data ? mapProducto(data.data) : null;
}

export async function createProducto(payload) {
  return request(`${API_PREFIX}/admin/productos`, { method: "POST", body: payload });
}

export async function updateProducto(id, payload) {
  return request(`${API_PREFIX}/admin/productos/` + id, { method: "PUT", body: payload });
}

export async function deleteProducto(id) {
  return request(`${API_PREFIX}/admin/productos/` + id, { method: "DELETE" });
}

// ================================================================
// MARCAS
// ================================================================
export async function fetchMarcas(params = {}) {
  try {
    const partes = [];
    if (params.activa !== undefined) partes.push("activa=" + params.activa);
    if (params.status) partes.push("status=" + params.status);
    if (params.q) partes.push("q=" + encodeURIComponent(params.q));
    const query = partes.join("&");

    const data = await request(
      `${API_PREFIX}/marcas` + (query ? "?" + query : ""),
      { auth: false }
    );

    const lista = listFrom(data, "data", "marcas", "items");

    return lista.map((m) => ({
      id: String(m.id || m._id || ""),
      nombre: m.nombre_comercial || m.nombre || "",
      nombre_comercial: m.nombre_comercial || m.nombre || "",
      rfc: m.rfc || "",
      correo: m.correo || "",
      telefono: m.telefono || "",
      direccion: m.direccion || "",
      status: m.status || "pendiente",
      activa: m.activa !== false,
      notas_admin: m.notas_admin || "",
      impi_count: Number(m.impi_count || (Array.isArray(m.datos_impi) ? m.datos_impi.length : 0)),
      createdAt: m.createdAt || m.created_at || null,
      updatedAt: m.updatedAt || m.updated_at || null,
    }));
  } catch (e) {
    console.log("⚠️ fetchMarcas falló:", e?.message);
    return [];
  }
}

export async function fetchMarca(id) {
  try {
    const data = await request(`${API_PREFIX}/marcas/` + id, { auth: false });
    if (!data || !data.data) return null;
    const m = data.data;
    return {
      id: String(m.id || m._id || ""),
      nombre: m.nombre_comercial || m.nombre || "",
      nombre_comercial: m.nombre_comercial || m.nombre || "",
      rfc: m.rfc || "",
      correo: m.correo || "",
      telefono: m.telefono || "",
      direccion: m.direccion || "",
      status: m.status || "pendiente",
      activa: m.activa !== false,
      notas_admin: m.notas_admin || "",
      impi_count: Number(m.impi_count || (Array.isArray(m.datos_impi) ? m.datos_impi.length : 0)),
      createdAt: m.createdAt || m.created_at || null,
      updatedAt: m.updatedAt || m.updated_at || null,
    };
  } catch (e) {
    return null;
  }
}

export async function createMarca(payload) {
  return request(`${API_PREFIX}/admin/marcas`, { method: "POST", body: payload });
}

export async function updateMarca(id, payload) {
  return request(`${API_PREFIX}/admin/marcas/` + id, { method: "PUT", body: payload });
}

export async function deleteMarca(id) {
  return request(`${API_PREFIX}/admin/marcas/` + id, { method: "DELETE" });
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