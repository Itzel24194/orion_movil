// config/collections.js

// ================================================================
// Mapa de nombres de colección.
// Si en tu MongoDB se llaman distinto, cámbialos aquí.
// ================================================================
module.exports = {
  usuarios: 'usuarios',
  productos: 'productos',
  categorias: 'categorias',
  marcas: 'marcas',
  pedidos: 'pedidos',
  carritos: 'carritos',
  cupones: 'cupones',
  promociones: 'promociones',
  resenas: 'resenas',
  combos: 'combos',
  atributos: 'atributos',
  temporadas: 'temporadas',
  monederos: 'monederos',
  monedero_movimientos: 'monedero_movimientos',
  vendedores: 'vendedores',          // solicitudes/tiendas del marketplace
  mesas_regalos: 'mesas_regalos',
  chat_sesiones: 'chat_sesiones',
  chat_mensajes: 'chat_mensajes',
  newsletter: 'newsletter',
  contactos: 'contactos',
  puntos_movimientos: 'puntos_movimientos',
};

// ================================================================
// Campos del usuario que, si están activos, indican que tiene 2FA.
// La API NO implementa 2FA: si alguno es true se bloquea el login
// por API (seguridad).
// ================================================================
module.exports.TWO_FA_FLAGS = [
  'two_factor_enabled',
  'totp_enabled',
  '2fa_enabled',
  'dos_pasos_activo',
  'verificacion_dos_pasos',
];

// ================================================================
// Dónde guarda Flask los datos de 2FA.
// La API lee de TODOS estos campos y escribe en los "write*".
// Si en tu base se llaman distinto, agrégalos aquí.
// ================================================================
module.exports.TWO_FA = {
  enabled: module.exports.TWO_FA_FLAGS,
  secret: ['two_factor_secret', 'totp_secret', 'secret_2fa', 'otp_secret'],
  backup: ['codigos_respaldo', 'backup_codes'],
  writeEnabled: 'two_factor_enabled',
  writeSecret: 'two_factor_secret',
  writeBackup: 'codigos_respaldo',
};

// ================================================================
// ⭐ Campos sensibles que NUNCA se devuelven al cliente.
//
// ⚠️ IMPORTANTE: NO incluir aquí:
//   - fecha_nacimiento
//   - direcciones
//   - complexion
//   - intereses
//   - preferencias_comunicacion
//   - preferencias_idioma
//   - genero
//   - sexo
//
// Esos campos SÍ deben viajar al cliente (los usa el móvil y la web).
// ================================================================
module.exports.SENSITIVE = [
  'password',
  'password_hash',
  'contrasena',
  'totp_secret',
  'two_factor_secret',
  'codigos_respaldo',
  'backup_codes',
  'token_confirmacion',
  'token_reset',
  'reset_token',
  'secret_2fa',
  'otp_secret',
  'two_factor_pending',
  'password_reset',
];