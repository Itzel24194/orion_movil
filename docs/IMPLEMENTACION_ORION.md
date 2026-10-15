# ORION · mejoras de prototipo · Expo SDK 54

## Resumen de lo entregado

- Se conservó `App.js`, `src/screens`, `src/context`, `src/navigation` y la conexión al backend.
- **Espejo virtual**: reutiliza `expo-camera` y gestos; incorpora captura, superposición sobre foto, exportación de la **composición**, compartirla, guardar el look privado localmente, historial para compartir/borrar y variantes de *tinte ilustrativo*. Además tiene un **modo automático**: detección de pose en tiempo real (MediaPipe PoseLandmarker en un WebView, compatible con Expo Go), recorte de fondo de la imagen del producto, selector de talla y uso de las medidas de la cuenta (`GET /api/complexion` y `/api/complexion/obtener`, ver `COMPLEXION_PATHS` en `src/services/api.js`). No es una simulación 3D: la prenda es una imagen 2D que se ajusta a hombros, cadera, cabeza, muñeca o pies según el tipo de producto.
- **Multimedia**: reemplaza tarjetas que fingían ser videos por una galería identificada como imágenes y un reproductor real con `expo-video` cuando el producto tiene `videoUrl` HTTPS de un `.mp4`. Se permite compartir el nombre del producto.
- **Internacionalización**: `src/context/PreferencesContext.js` y `src/i18n/translations.js`; el dispositivo determina idioma por defecto (es/en). Se proporcionan catálogos `.po` de referencia en `locales/`; los módulos que se actualizaron usan `t(key)`. Todas las pantallas se traducen (es/en) con los componentes `Text`, `TextInput` y `Alert` de `src/i18n/ui.js`, que consultan el diccionario `src/i18n/phrases.en.js`. Para agregar texto nuevo, añade la frase en español como clave y su traducción en inglés.
- **UX**: Home, detalle y checkout rediseñados, cambio de tema persistente desde Perfil → Configuración; microinteracciones hápticas, animación al agregar al carrito, skeleton en imágenes remotas durante carga.
- **Pedidos**: checkout usa el carrito real y crea **solicitudes pendientes**, autenticadas, en el backend (MongoDB); historial de solicitudes por usuario. **No cobra, reserva stock, valida precios en servidor ni realiza envíos**.

## Prerrequisitos

1. Node.js soportado por Expo 54 (>= 20.19.x) y Expo Go compatible con SDK 54 en Android, o una development build de iOS.
2. Desde la carpeta `ORIONSTOREE`: `npm install` (regenera package-lock.json) y `npx expo start -c`.
3. Para iOS, el Expo Go más reciente puede ser incompatible con SDK 54; usar development build o simulador con versión adecuada, o migrar SDK en proyecto separado.
4. Las nuevas dependencias de Expo 54 se declaran en `package.json` (localization, video, sharing, file-system y view-shot). No se instalaron en este entorno por falta de acceso a npm; instálalas en un equipo con internet.
5. Verificar que el backend web esté corriendo y que `EXPO_PUBLIC_API_URL` apunte a él antes de probar solicitudes.

## Archivos principales modificados

- `App.js`: PreferencesProvider sobre el existente ProductProvider.
- `src/screens/{TryOnScreen,TryOnHistoryScreen,HomeScreen,ProductDetailScreen,VideosScreen,CheckoutScreen,OrdersScreen}.js`
- `src/context/{ProductContext,PreferencesContext}.js`
- `src/components/SmartImage.js` y `src/services/tryOnHistory.js`
- `src/navigation/AppNavigator.js` (ruta de historial)
- `src/screens/ProfileScreen.js` (Selector de tema e idioma)
- `src/screens/CrudScreen.js` (Campo videoUrl)
- `src/screens/CartScreen.js` (Identificación talla/color)

## Backend (Flask + MongoDB) y solicitudes

La aplicación se autentica con JWT (`/api/v1/auth/login`) contra el backend web, que guarda los datos en MongoDB. La autorización de acciones administrativas debe validarse en el backend.

Ejemplo **parcial** (fusionar con las reglas actuales; no sobrescribir todo sin revisarlas):

```text
match /solicitudes_pedido/{solicitudId} {
  allow create: if request.auth != null
    && request.resource.data.userId == request.auth.uid
    && request.resource.data.status == 'pendiente'
    && request.resource.data.paymentStatus == 'no_pagado'
    && request.resource.data.keys().hasOnly([
      'userId', 'items', 'name', 'address', 'phone', 'notes',
      'subtotalEstimado', 'envioEstimado', 'totalEstimado',
      'status', 'paymentStatus', 'createdAt'
    ])
    && request.resource.data.items is list
    && request.resource.data.items.size() > 0
    && request.resource.data.items.size() <= 40
    && request.resource.data.createdAt == request.time;
  allow get, list: if request.auth != null && resource.data.userId == request.auth.uid;
  allow update, delete: if false;
}
```

**Precaución:** el cliente envía importes estimados modificables. **Nunca** despachar productos ni reconocer pagos basándose en esa colección sin verificar catálogo, stock, precios y pagos en backend confiable (Cloud Functions, servidor propio y proveedor de pagos). No recopilar PAN/CVV directamente en React Native: integrar Stripe/MP con tokenización certificada si se habilitan pagos en el futuro.

## Catálogo y videos

El Home consulta `/api/v1/productos` del backend. Si hay productos activos, utiliza esos productos; si está vacía o falla la lectura, muestra la demostración local que ya existía. Esto permite probar ORION sin crear productos manualmente. En Admin, el campo `videoUrl` opcional debe apuntar a un `.mp4` HTTPS válido y accesible. No se suben automáticamente videos ni fotografías: el archivo de video se hospeda por separado y la URL queda guardada en la ficha.

**Limitación conocida original:** el CRUD existente guarda algunas fotos como `file://...` local en la base de datos, que NO es una URL accesible desde otros teléfonos. Subir esas fotos al backend (con autorización y límites de tamaño) y guardar su URL HTTPS o storage path es un trabajo pendiente antes de producción.

## Espejo: precisión y privacidad

- El modo automático corre MediaPipe en un WebView: el modelo (~6 MB) se descarga de internet la primera vez y el video **se procesa en el dispositivo**; no se sube ninguna foto. Requiere `react-native-webview`. El recorte de fondo funciona con fondos lisos (blanco/gris); con fondos complejos conviene usar PNG con transparencia.
- La mayoría de imágenes de prendas del ZIP tienen fondo opaco: conviene sustituirlas por PNG/WebP **con transparencia real**, vista frontal, para que la superposición parezca una prenda.
- Los tintes mediante `tintColor` son una aproximación visual y reemplazan los colores de la textura; no equivalen a variantes fotográficas verdaderas.
- Las composiciones se guardan en `FileSystem.documentDirectory` y el índice en AsyncStorage. No se suben retratos a la nube. El historial se pierde al desinstalar la aplicación. Compartir exporta el archivo solo cuando el usuario solicita compartir.
- `react-native-view-shot` captura el resultado **después** de tomar la foto; no se captura directamente una textura de `CameraView` en vivo.
- Comprobar permisos de cámara en dispositivo Android/iOS y revisar la composición en modelos de pantalla distintos.

## Estado por requisito de la imagen

| Requisito | Estado |
|---|---|
| Cámara en vivo | Funciona en proyecto original y se conserva |
| Superposición y escalado manual | Mejorado; pendiente comprobar en dispositivo |
| IA de pose + escalado automático | Implementado (WebView + MediaPipe); pendiente comprobar en dispositivo |
| Colores en vivo | Tinte ilustrativo agregado; no variantes reales |
| Captura + compartir + historial | Implementado localmente; requiere prueba en dispositivo |
| Videos multimedia | Reproductor listo; requiere URLs `.mp4` reales |
| Archivos `.po`, Intl | Catálogos `.po` de referencia; localización parcial |
| Emails | Restablecimiento de contraseña vía `/recuperar-password` del backend; correos transaccionales de pedidos **pendientes** por falta de backend |
| Base de datos | MongoDB (vía backend Flask) |
| Detección (multimedia) | **Pendiente**, requiere especificar objeto/modelo de detección |
| Home, ficha, checkout | Rediseñados |
| Microinteracciones, dark mode, skeleton | Implementadas en pantallas actualizadas; resto de pantallas aún estático |

## Pruebas manuales sugeridas

1. Registrarse/iniciar sesión con el backend; abrir Home; navegar a producto; variar talla y color; agregar dos unidades; comprobar cantidades y total del carrito.
2. Ir a Checkout: dejar dirección vacía (debe bloquear); probar teléfono no válido (bloquear); enviar solicitud; verificar el pedido en MongoDB y abrir «Mis solicitudes». Confirmar que NO pide PAN/CVV ni dice «pagado».
3. Abrir Espejo; conceder permiso; mover/escalar; tomar foto; ajustar; guardar; abrir Historial; compartir/borrar.
4. Perfil → Configuración → Tema oscuro; volver a Home/Producto/Checkout. Repetir con inglés; pantallas modernizadas traducen su terminología.
5. Admin: editar producto para agregar `videoUrl` HTTPS .mp4; abrir Multimedia, reproducir, entrar al producto. Sin URL deberá aparecer la galería de fotos, **no un falso video**.
6. Probar Android real Expo SDK 54. Para iOS usar un entorno compatible; probar Expo Sharing solo en móvil.

## Siguientes integraciones de backend necesarias

1. IA de pose con seguimiento en tiempo real y superposición de ropa sin fondo.
2. Backend para precios/pagos verificados, gestión de stock y correo transaccional (una vez confirmado el pedido por servidor).
3. Almacenamiento de multimedia en el backend con metadatos y eliminación.
4. Internacionalizar todas las pantallas antiguas y pipeline de traducciones `.po`.
5. Revisión de permisos, roles admin y reglas de productos (no auditoría completa incluida).
