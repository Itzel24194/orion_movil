# ORION API (Express + MongoDB)

API REST independiente para **la app móvil (Expo)** y para **la web**. Se conecta a la **misma base MongoDB** que tu proyecto Flask, así que:

- La app móvil funciona **aunque la web (Flask) esté apagada**. Solo necesitas MongoDB + esta API.
- Flask no se toca: sigue funcionando con sus rutas HTML. Ambos leen/escriben los mismos datos.
- Las contraseñas existentes (werkzeug pbkdf2/scrypt o bcrypt) siguen funcionando en el login.

## 1. Instalar y encender

```bash
cd orion-api
npm install
copy .env.example .env      # (Linux/Mac: cp .env.example .env)
# Edita .env: MONGO_URI, DB_NAME y un JWT_SECRET largo
npm start
```

Al arrancar verás las URLs listas para el celular, por ejemplo:
`http://192.168.100.53:4000/api/v1`

En Expo, en tu `.env`:
```
EXPO_PUBLIC_API_URL=http://192.168.100.53:4000/api/v1
```
(No uses `localhost`: el celular no lo entiende. PC y celular deben estar en la misma red.)

Prueba rápida: abre `http://TU_IP:4000/health` en el navegador.

## 2. Formato de respuestas

- Éxito: `{ "ok": true, "data": ..., "meta": { page, limit, total, pages } }`
- Error: `{ "ok": false, "error": "mensaje" }`
- Login/registro: `{ ok, access_token, token, refresh_token, user }`
- Autenticación: header `Authorization: Bearer <access_token>`
- Paginación: `?page=1&limit=20`

## 3. Endpoints (prefijo `/api/v1`)

**Auth** — `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `GET /auth/me`, `POST /auth/logout`
Login con 2FA: si la cuenta lo tiene activo, `POST /auth/login` responde `{ ok, requires_2fa: true, temp_token }` (sin tokens de sesión);
luego `POST /auth/2fa/verificar { temp_token, codigo }` (código de la app autenticadora o de respaldo) devuelve `access_token`/`refresh_token`.
Recuperar contraseña: `POST /auth/recuperar { email }` (envía un código de 6 dígitos por correo, vigente 15 min) y
`POST /auth/resetear { email, codigo, password_nueva }`.

**Catálogo (público)**
`GET /productos` (filtros: `q, categoria, marca, min, max, orden=precio_asc|precio_desc|nuevo|vendidos`)
`GET /productos/buscar`, `/productos/autocompletar?q=`, `/productos/mas-vendidos`, `/productos/novedades`,
`/productos/categoria/:id`, `/productos/marca/:marca`, `/productos/:id`, `/productos/:id/relacionados`, `/productos/:id/resenas`
`GET /categorias`, `/categorias/:id` · `GET /marcas`, `/marcas/buscar`, `/marcas/:id`
`GET /combos`, `/combos/:id` · `GET /promociones`, `/promociones/destacadas` · `GET /temporadas`
`POST /resenas` (cliente), `PUT /resenas/:id` (editar, vuelve a moderación), `POST /resenas/:id/util`, `POST /resenas/:id/reportar`, `DELETE /resenas/:id`

**Promociones con sesión** — `GET /promociones/carrito` (aplicada + disponibles), `GET /promociones/disponibles`, `POST /promociones/validar-codigo`,
`POST /promociones/aplicar { codigo | promocion_id }`, `POST /promociones/quitar`. El carrito aplica solo la mejor promoción automática (las que no tienen `codigo`)
y el cupón se calcula sobre el total ya con la promoción. Tipos soportados: porcentaje, monto fijo y envío gratis (otros, como 2x1, devuelven "no soportado").

**Complexión y talla (cliente)** — `GET|POST|PUT|DELETE /complexion` (medidas: `altura_cm, peso_kg, pecho_cm, cintura_cm, cadera_cm, hombros_cm, pie_cm, genero, complexion, preferencia_ajuste`),
`GET /complexion/recomendar-talla?producto_id=&tipo=superior|inferior|calzado` (usa las tallas del producto si las tiene). También responde en `/complexion/obtener`, `/complexion/guardar`, `/complexion/limpiar`.

**Carrito (cliente)** — `GET /carrito` (con `?cupon=CODIGO`), `POST /carrito/items`, `PUT /carrito/items/:productoId`, `DELETE /carrito/items/:productoId`, `DELETE /carrito` (vaciar).
También acepta `POST/PUT/DELETE /carrito` (compatibilidad con tu ruta `/api/v1/carrito`).

**Pedidos (cliente)** — `GET /pedidos`, `GET /pedidos/:id`, `POST /pedidos` (checkout desde el carrito),
`POST /pedidos/:id/cancelar`, `POST /pedidos/:id/confirmar`, `POST /pedidos/:id/recoger` (código de recogida de 6 caracteres, vigente 72 h), `GET /pedidos/rastrear?numero=&email=` (público)

**Cuenta (cliente)** — `GET|PUT /cuenta`, `PUT /cuenta/password`, `DELETE /cuenta`, `GET /cuenta/datos`,
`/cuenta/direcciones` (GET, POST, PUT /:id, POST /:id/predeterminada, DELETE /:id),
`/cuenta/favoritos` (GET, POST /toggle, POST /:id, DELETE /:id), `/cuenta/intereses`,
`/cuenta/preferencias`, `/cuenta/privacidad`, `/cuenta/idioma`, `/cuenta/facturacion`,
`/cuenta/metodos-pago`, `/cuenta/2fa/{estado,iniciar,confirmar,desactivar,regenerar-codigos}`, `GET /cuenta/cupones`, `POST /cuenta/cupones/validar`

**Monedero** — `GET /monedero/resumen`, `/monedero/movimientos`, `POST /monedero/transferir`, `POST /monedero/recargar`
**Lealtad** — `GET /lealtad/mi-info`, `/lealtad/historial`, `POST /lealtad/canjear`
**Mesa de regalos** — `GET /mesa-regalos/mias`, `POST /mesa-regalos`, `GET /mesa-regalos/:slug`, `POST /:id/reservar`, `POST /:id/contribuir`, `DELETE /:id`
**Marketplace** — público: `/marketplace/vendedores`, `/vendedores/:id`, `/tienda/:slug` · `POST /marketplace/registro`, `GET /marketplace/estado`
Panel vendedor (rol vendedor): `/marketplace/panel/stats|productos|pedidos|resenas` (CRUD de productos, estados, respuestas)
**Otros** — `POST /newsletter/suscribir|cancelar`, `POST /contacto`, `GET /config/tienda`, `POST /chat/sesion`, `GET|POST /chat/mensajes`

**Admin (rol admin)** — `/admin/dashboard`; CRUD completo en `/admin/{productos,categorias,atributos,cupones,promociones,combos,temporadas,marcas}`
(GET lista, GET /:id, POST, PUT /:id, POST /:id/toggle, DELETE /:id); `/admin/usuarios` (+ `/:id/rol`, `/:id/toggle`);
`/admin/pedidos` (+ `/:id/estado`, `POST /admin/pedidos/recogida/verificar { codigo }` para entregar en tienda); `/admin/resenas` (aprobar/rechazar/responder); `/admin/marketplace/vendedores` (estado, comisión);
`/admin/monedero/*`, `/admin/lealtad/ajustar-puntos`, `/admin/contactos`, `/admin/newsletter`.

## 4. Ajustes que probablemente necesites (5 minutos)

La API **no conoce tus documentos exactos**; asume nombres de campos comunes. Revisa:

1. **Nombres de colecciones** → `src/config/collections.js` (ej. si tu carrito vive en otra colección).
2. **Campos de producto**: `nombre, precio, precio_oferta, stock, categoria_id, marca, imagenes, activo, vendidos`.
   Si tu stock es por talla/variante, ajusta la reserva de stock en `src/routes/pedidos.js` (POST `/`).
3. **Campos de usuario**: `email, password|password_hash, rol (cliente|admin|vendedor), activo, direcciones[], favoritos[]`.
4. **Campos de 2FA** → objeto `TWO_FA` en `src/config/collections.js`. La API lee el secreto de `two_factor_secret | totp_secret | secret_2fa | otp_secret`
   y los códigos de respaldo de `codigos_respaldo | backup_codes` (texto plano, sha256 o bcrypt). El TOTP es estándar (SHA1, 6 dígitos, 30 s), igual que pyotp.
   Si Flask usa otros nombres, agrégalos ahí; si un usuario con 2FA no tiene secreto reconocible, el login responde con un error claro en vez de dejarlo pasar.
5. **Cupones**: `codigo, tipo (porcentaje|monto), valor, activo, fecha_inicio, fecha_fin, minimo_compra, usos_max, usos`.

## 5. Lo que NO incluye (sigue en Flask)

Entrenamiento/predicción de ML (K-Means, regresión logística), NLP/IA del chatbot, generación de PDF/CSV y facturas,
subida de imágenes, scraping IMPI, probador virtual, Meses Sin Intereses (Conekta, pendiente) y webhooks de pago.
Para esas funciones, deja Flask encendido; la app móvil no las necesita para comprar y navegar.

## 6. Variables de entorno nuevas

`MAIL_*` (las mismas de Flask, para el correo de recuperación), `RESET_CODIGO_MINUTOS=15`, `TWOFA_ISSUER=ORION`, `RECOGIDA_HORAS=72`.
Tras actualizar, ejecuta `npm install` otra vez (se agregó `nodemailer`).
Sin `MAIL_USERNAME`/`MAIL_PASSWORD` la API no envía correos; en desarrollo imprime el código de recuperación en la consola.

## 7. Seguridad

- Usa un `JWT_SECRET` largo y aleatorio; en producción limita `CORS_ORIGINS` y usa HTTPS.
- `MONEDERO_RECARGA_DIRECTA` debe seguir en `false` salvo pruebas: una recarga real debe confirmarse con la pasarela de pago.
- Métodos de pago: la API solo guarda marca, últimos 4 dígitos y token; rechaza números completos.
- Login con límite de intentos (20 / 15 min por IP); 2FA, recuperar y resetear tienen límites propios más estrictos.
- Recuperar contraseña siempre responde lo mismo exista o no el correo, con un máximo de 5 intentos por código.
- El código de recuperación se guarda con hash; los códigos de respaldo de 2FA nuevos, también.
