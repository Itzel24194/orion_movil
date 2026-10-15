// screens/CheckoutScreen.js
import React, { useContext, useEffect, useMemo, useState } from 'react';
import {ActivityIndicator,KeyboardAvoidingView,Platform,ScrollView,StatusBar,StyleSheet,TouchableOpacity,View,} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Text, TextInput, Alert } from '../i18n/ui';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import {getCurrentUser,createOrder,fetchMe,resolveProductPhoto,resolveCleanPhoto,request,} from '../services/api';
import { ProductContext } from '../context/ProductContext';
import { usePreferences } from '../context/PreferencesContext';

// ================================================================
// HELPERS GENERALES
// ================================================================
const peso = (v) =>
  `$${Number(v || 0).toLocaleString('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const getNombre = (item) => item.nombre || item.name || 'Producto';
const getId = (item) =>
  String(item.id || item._id || item.productId || item.producto_id || '');

const getPrecio = (item) => {
  if (item.unitPrice != null) return Number(item.unitPrice);
  if (item.precio != null) return Number(item.precio);
  if (item.price != null) return Number(item.price);
  const vars = Array.isArray(item.variables) ? item.variables : [];
  return vars.length > 0 ? Number(vars[0].precio) || 0 : 0;
};

const getFoto = (item) => {
  const cleanArr = Array.isArray(item.fotos_clean) ? item.fotos_clean : [];
  if (cleanArr.length > 0) {
    const u = resolveCleanPhoto(cleanArr[0]);
    if (u) return u;
  }
  const fotos = Array.isArray(item.fotos) ? item.fotos.filter(Boolean) : [];
  if (fotos.length > 0) {
    const u = resolveProductPhoto(fotos[0]);
    if (u) return u;
  }
  if (item.imagen) return resolveProductPhoto(item.imagen);
  if (item.image) return item.image;
  return null;
};

const getVarianteLabel = (item) => {
  const partes = [];
  if (item.selectedSize) partes.push(`Talla ${item.selectedSize}`);
  if (item.selectedColor) partes.push(item.selectedColor);
  return partes.join(' · ');
};

const getStockDisponible = (item) => {
  if (item.selectedStock != null) return Number(item.selectedStock);
  const vars = Array.isArray(item.variables) ? item.variables : [];
  if (vars.length > 0) {
    const m = vars.find((v) =>
      (!item.variantSku || v.sku === item.variantSku) &&
      (!item.selectedColor || v.color === item.selectedColor) &&
      (!item.selectedSize || v.tamano === item.selectedSize)
    );
    if (m) return Number(m.stock) || 0;
    return vars.reduce((s, v) => s + (Number(v.stock) || 0), 0);
  }
  return Number(item.stock ?? 0);
};

const mismaDireccion = (a, b) =>
  (a.calle || '').trim().toLowerCase() === (b.calle || '').trim().toLowerCase() &&
  String(a.numero || '') === String(b.numero || '') &&
  String(a.cp || '') === String(b.cp || '');

// ================================================================
// VALIDACIÓN REFORZADA
// Evita XSS almacenado en el panel admin y datos basura en Mongo.
// ================================================================
const SOLO_TEXTO_SEGURO = /[^\p{L}\p{N}\s.,#\-\/áéíóúÁÉÍÓÚñÑüÜ()]/gu;

/** Limpia un string: quita <, >, comillas raras, emojis y caracteres de control. */
const sanitize = (v, max = 120) =>
  String(v ?? '')
    .normalize('NFC')
    .replace(/[\u0000-\u001F\u007F]/g, '') // control chars
    .replace(SOLO_TEXTO_SEGURO, '')
    .trim()
    .slice(0, max);

/** CP de México: 5 dígitos, rango 01000–99999 (excluye 00000). */
const esCPValido = (cp) => {
  const s = String(cp || '').replace(/\D/g, '');
  if (!/^\d{5}$/.test(s)) return false;
  const n = parseInt(s, 10);
  return n >= 1000 && n <= 99999;
};

/** Número de casa: dígitos + letras (ej. "123-A", "S/N", "12 Bis"). */
const esNumeroValido = (n) => {
  const s = String(n || '').trim();
  if (!s) return false;
  return /^[A-Za-z0-9\-\s/]{1,10}$/.test(s);
};

/** Calle/colonia/ciudad: al menos 3 caracteres alfanuméricos. */
const esTextoValido = (t, min = 3) => {
  const s = String(t || '').trim();
  if (s.length < min) return false;
  return /[\p{L}]/u.test(s); // debe contener al menos una letra
};

// ================================================================
// NORMALIZACIÓN DE DIRECCIONES
// ================================================================
const dirFromBackend = (d = {}) => ({
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
  alias: sanitize(d.nombre || d.alias || 'Mi dirección', 60),
  nombre: sanitize(d.nombre || d.alias || '', 60),
  telefono: String(d.telefono || '').replace(/\D/g, '').slice(0, 15),
  calle: sanitize(d.calle, 80),
  numero_exterior: sanitize(d.numero ?? d.numero_exterior ?? '', 10),
  numero_interior: sanitize(d.numero_interior || '', 10),
  colonia: sanitize(d.colonia, 80),
  ciudad: sanitize(d.ciudad, 60),
  estado: sanitize(d.estado, 60),
  codigo_postal: String(d.cp ?? d.codigo_postal ?? '').replace(/\D/g, '').slice(0, 5),
  pais: sanitize(d.pais || 'México', 40),
  referencias: sanitize(d.referencias || '', 200),
  predeterminada: !!d.predeterminada,
});

// ================================================================
// CONSTANTES COMERCIALES
// ================================================================
const IVA_PORCENTAJE = 0.16;
const ENVIO_NORMAL = 99;
const ENVIO_PRIORITARIO = 199;
const UMBRAL_PRIORITARIO = 50;
const UMBRAL_DESCUENTO_VOLUMEN = 50;
const DESCUENTO_VOLUMEN_PORCENTAJE = 0.05;

// Tolerancia de discrepancia entre total del cliente y del servidor.
const TOLERANCIA_TOTAL_MXN = 1.0;
const BASES_USUARIO = ['/api/v1/cuenta', '/api/v1/usuarios'];
let BASE_ACTIVA = null;
const urlConBase = (base, path) => `${base}${path}`;
const descubrirBase = async () => {
  if (BASE_ACTIVA) return BASE_ACTIVA;
  for (const base of BASES_USUARIO) {
    try {
      await request(urlConBase(base, '/direcciones'), { method: 'GET' });
      BASE_ACTIVA = base;
      console.log(`✅ Base de cuenta detectada: ${base}`);
      return base;
    } catch (e) {
      if (e?.status === 401 || e?.status === 403) {
        BASE_ACTIVA = base;
        console.log(`✅ Base de cuenta detectada (auth pendiente): ${base}`);
        return base;
      }
      console.log(`⚠️ ${base} no responde:`, e?.status, e?.message);
    }
  }
  console.log('❌ Ninguna base respondió, usando fallback');
  BASE_ACTIVA = BASES_USUARIO[0];
  return BASE_ACTIVA;
};

// ================================================================
// Field
// ================================================================
const Field = ({ label, value, onChange, palette, ...props }) => (
  <View style={{ marginBottom: 12 }}>
    <Text style={[styles.label, { color: palette.text }]}>{label}</Text>
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder={label}
      placeholderTextColor={palette.subtle}
      style={[
        styles.field,
        {
          color: palette.text,
          backgroundColor: palette.input,
          borderColor: palette.border,
        },
      ]}
      {...props}
    />
  </View>
);

// ================================================================
// COMPONENTE
// ================================================================
export default function CheckoutScreen({ navigation }) {
  const { cart, clearCart } = useContext(ProductContext);
  const { palette: p, isDark } = usePreferences();

  const [calle, setCalle] = useState('');
  const [numero, setNumero] = useState('');
  const [cp, setCp] = useState('');
  const [colonia, setColonia] = useState('');
  const [ciudad, setCiudad] = useState('');
  const [estado, setEstado] = useState('');
  const [pais, setPais] = useState('México');
  const [referencias, setReferencias] = useState('');
  const [nombreDireccion, setNombreDireccion] = useState('');

  const [metodoPago, setMetodoPago] = useState('tarjeta');
  const [notas, setNotas] = useState('');

  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [user, setUser] = useState(null);
  const [direcciones, setDirecciones] = useState([]);
  const [savedAddressId, setSavedAddressId] = useState(null);

  // EGURIDAD: opt-in explícito. El usuario decide guardar su dirección.
  const [guardarDireccion, setGuardarDireccion] = useState(false);

  // ================================================================
  // CARGA INICIAL
  // ================================================================
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const u = await getCurrentUser();
        if (!alive) return;
        setUser(u);

        const base = await descubrirBase();

        let lista = [];
        try {
          const r = await request(urlConBase(base, '/direcciones'), { method: 'GET' });
          const raw = Array.isArray(r?.data)
            ? r.data
            : Array.isArray(r?.direcciones)
            ? r.direcciones
            : Array.isArray(r)
            ? r
            : [];
          lista = raw.map(dirFromBackend);
        } catch (e) {
          console.log('⚠️ GET /direcciones falló:', e?.status, e?.message);
        }

        if (!lista.length) {
          try {
            const me = await fetchMe();
            const raw =
              me?.direcciones ||
              me?.user?.direcciones ||
              me?.data?.direcciones ||
              [];
            if (Array.isArray(raw) && raw.length) {
              lista = raw.map(dirFromBackend);
            }
          } catch (e) {}
        }

        if (!lista.length) {
          try {
            let r = null;
            try {
              r = await request('/api/v1/pedidos/mis-pedidos', { method: 'GET' });
            } catch {
              r = await request('/api/v1/pedidos', { method: 'GET' }).catch(() => null);
            }
            const pedidos = Array.isArray(r) ? r : r?.pedidos || r?.data || [];
            const vistos = new Map();
            for (const ped of pedidos) {
              const d = ped.direccion_envio || ped.direccion || ped.shipping_address;
              if (!d?.calle) continue;
              const k = `${(d.calle || '').toLowerCase()}|${d.numero_exterior || d.numero || ''}|${d.codigo_postal || d.cp || ''}`;
              if (!vistos.has(k)) {
                vistos.set(
                  k,
                  dirFromBackend({
                    ...d,
                    id: `pedido_${ped._id || ped.id}`,
                    predeterminada: vistos.size === 0,
                  })
                );
              }
            }
            lista = Array.from(vistos.values());
          } catch (e) {}
        }

        if (!alive) return;
        setDirecciones(lista);

        const pred = lista.find((d) => d.predeterminada) || lista[0] || null;
        if (pred) {
          setCalle(pred.calle);
          setNumero(pred.numero);
          setCp(pred.cp);
          setColonia(pred.colonia);
          setCiudad(pred.ciudad);
          setEstado(pred.estado);
          setPais(pred.pais);
          setReferencias(pred.referencias);
          setNombreDireccion(pred.nombre);
          setSavedAddressId(pred.id ?? null);
        }
      } finally {
        if (alive) setLoadingData(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const seleccionarDireccion = (dir) => {
    const d = dirFromBackend(dir);
    setCalle(d.calle);
    setNumero(d.numero);
    setCp(d.cp);
    setColonia(d.colonia);
    setCiudad(d.ciudad);
    setEstado(d.estado);
    setPais(d.pais);
    setReferencias(d.referencias);
    setNombreDireccion(d.nombre);
    setSavedAddressId(d.id ?? null);
    // El usuario ya tenía esta dirección guardada, no hace falta re-guardarla.
    setGuardarDireccion(false);
  };

  const limpiarDireccion = () => {
    setCalle('');
    setNumero('');
    setCp('');
    setColonia('');
    setCiudad('');
    setEstado('');
    setPais('México');
    setReferencias('');
    setNombreDireccion('');
    setSavedAddressId(null);
    setGuardarDireccion(true);
  };

  // ================================================================
  // CÁLCULOS
  // ================================================================
  const totalUnidades = useMemo(
    () => cart.reduce((s, it) => s + (it.quantity || 1), 0),
    [cart]
  );

  const subtotal = useMemo(
    () => cart.reduce((s, it) => s + getPrecio(it) * (it.quantity || 1), 0),
    [cart]
  );

  const aplicaDescuento = totalUnidades >= UMBRAL_DESCUENTO_VOLUMEN;
  const descuentoVolumen = aplicaDescuento
    ? subtotal * DESCUENTO_VOLUMEN_PORCENTAJE
    : 0;

  const subtotalConDescuento = subtotal - descuentoVolumen;
  const iva = subtotalConDescuento * IVA_PORCENTAJE;
  const envio = totalUnidades >= UMBRAL_PRIORITARIO ? ENVIO_PRIORITARIO : ENVIO_NORMAL;
  const esPrioritario = totalUnidades >= UMBRAL_PRIORITARIO;
  const total = subtotalConDescuento + iva + envio;

  // VALIDACIÓN REFORZADA (formato + no vacío + rangos reales)
  const datosCompletos =
    esTextoValido(calle, 3) &&
    esNumeroValido(numero) &&
    esCPValido(cp) &&
    esTextoValido(colonia, 3) &&
    esTextoValido(ciudad, 3) &&
    esTextoValido(estado, 3);

  // ================================================================
  // SYNC CARRITO
  // ================================================================
  const syncCarritoToServer = async () => {
    if (!cart.length) return false;

    const items = cart.map((x) => ({
      producto_id: getId(x),
      productId: getId(x),
      id: getId(x),
      cantidad: x.quantity || 1,
      quantity: x.quantity || 1,
      // El backend DEBE recalcular el precio. Lo mandamos solo como referencia.
      precio_referencia: Number(getPrecio(x)),
      sku: x.variantSku || null,
      variantSku: x.variantSku || null,
      talla: x.selectedSize || null,
      size: x.selectedSize || null,
      color: x.selectedColor || null,
    }));

    const intentos = [
      () => request('/api/v1/carrito', { method: 'PUT', body: { items } }),
      () => request('/api/v1/carrito/sync', { method: 'POST', body: { items } }),
      () => request('/api/v1/carrito/items', { method: 'POST', body: { items } }),
      () => request('/api/v1/carrito', { method: 'POST', body: { items } }),
      async () => {
        await request('/api/v1/carrito', { method: 'DELETE' }).catch(() => {});
        for (const it of items) {
          await request('/api/v1/carrito/items', { method: 'POST', body: it }).catch(() => {});
        }
      },
    ];

    for (let i = 0; i < intentos.length; i++) {
      try {
        await intentos[i]();
        console.log(` Carrito sincronizado (intento ${i + 1})`);
        return true;
      } catch (e) {
        console.log(`⚠️ Sync carrito intento ${i + 1} falló:`, e?.status, e?.message);
      }
    }
    console.log('⚠️ No se pudo sincronizar el carrito');
    return false;
  };

  // ================================================================
  // GUARDAR DIRECCIÓN
  // ================================================================
  const persistirDireccionEnUsuario = async (nueva) => {
    if (!user) return { ok: false, motivo: 'sin-usuario' };

    const base = await descubrirBase();
    const body = dirToBackend({ ...nueva, predeterminada: true });
    let guardada = null;
    let endpointUsado = null;

    if (savedAddressId) {
      try {
        const r = await request(
          urlConBase(base, `/direcciones/${savedAddressId}`),
          { method: 'PUT', body }
        );
        const lista = Array.isArray(r?.data) ? r.data : [];
        guardada = lista.map(dirFromBackend);
        endpointUsado = `PUT ${base}/direcciones/${savedAddressId}`;
      } catch (e) {
        console.log('⚠️ PUT /direcciones/:id falló:', e?.status, e?.message);
      }
    }

    if (!guardada) {
      try {
        const r = await request(urlConBase(base, '/direcciones'), {
          method: 'POST',
          body,
        });
        const lista = Array.isArray(r?.data) ? r.data : [];
        guardada = lista.map(dirFromBackend);
        endpointUsado = `POST ${base}/direcciones`;
      } catch (e) {
        console.log('❌ POST /direcciones falló:', e?.status, e?.message);
        return { ok: false, motivo: 'post-falló', error: e };
      }
    }

    try {
      const nuevaGuardada = guardada.find(
        (d) =>
          (d.calle || '').toLowerCase() === (body.calle || '').toLowerCase() &&
          String(d.numero) === String(body.numero_exterior) &&
          String(d.cp) === String(body.codigo_postal)
      );
      if (nuevaGuardada && !nuevaGuardada.predeterminada && nuevaGuardada.id) {
        const r = await request(
          urlConBase(base, `/direcciones/${nuevaGuardada.id}/predeterminada`),
          { method: 'POST' }
        );
        const lista = Array.isArray(r?.data) ? r.data : [];
        guardada = lista.map(dirFromBackend);
      }
    } catch (e) {
      console.log('⚠️ Marcar predeterminada falló:', e?.status, e?.message);
    }

    setDirecciones(guardada);
    setUser({ ...user, direcciones: guardada });
    const principal = guardada.find((d) => d.predeterminada) || guardada[0];
    if (principal?.id) setSavedAddressId(principal.id);

    return { ok: true, lista: guardada, endpoint: endpointUsado };
  };

  // ================================================================
  // VALIDACIONES
  // ================================================================
  const validar = () => {
    if (!cart.length) {
      Alert.alert('Carrito vacío', 'Agrega productos antes de continuar.');
      return false;
    }

    const sinStock = cart.filter(
      (item) => getStockDisponible(item) < (item.quantity || 1)
    );
    if (sinStock.length > 0) {
      const nombres = sinStock.map((x) => `• ${getNombre(x)}`).join('\n');
      Alert.alert(
        'Sin stock suficiente',
        `Ajusta estos productos antes de continuar:\n\n${nombres}`
      );
      return false;
    }

    if (!datosCompletos) {
      Alert.alert(
        'Revisa tus datos',
        'Completa correctamente todos los campos. El CP debe ser de 5 dígitos (1000–99999) y el número debe ser válido.'
      );
      return false;
    }
    return true;
  };

  // ================================================================
  // SUBMIT
  // ================================================================
  const submit = async () => {
    if (loading) return;
    if (!validar()) return;

    if (!user) {
      return Alert.alert(
        'Inicia sesión',
        'Necesitas iniciar sesión para registrar tu pedido.',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Ir a ingresar', onPress: () => navigation.navigate('Login') },
        ]
      );
    }

    setLoading(true);
    try {
      await syncCarritoToServer();

      //Validacion antes de enviar (defensa en profundidad).
      const direccionObj = {
        calle: sanitize(calle, 80),
        numero: sanitize(numero, 10),
        numero_exterior: sanitize(numero, 10),
        cp: String(cp).replace(/\D/g, '').slice(0, 5),
        codigo_postal: String(cp).replace(/\D/g, '').slice(0, 5),
        colonia: sanitize(colonia, 80),
        ciudad: sanitize(ciudad, 60),
        estado: sanitize(estado, 60),
        pais: sanitize(pais || 'México', 40),
        referencias: sanitize(referencias, 200),
      };

      if (guardarDireccion) {
        const res = await persistirDireccionEnUsuario({
          id: savedAddressId || undefined,
          nombre: sanitize(nombreDireccion || 'Mi dirección', 60),
          ...direccionObj,
          predeterminada: true,
        });
        if (!res.ok) {
          console.log('⚠️ No se guardó la dirección en el perfil:', res.motivo);
        }
      }

      const itemsPayload = cart.map((x) => ({
        productId: getId(x),
        producto_id: getId(x),
        id: getId(x),
        variantSku: x.variantSku || null,
        sku: x.variantSku || null,
        name: sanitize(getNombre(x), 120),
        nombre: sanitize(getNombre(x), 120),
        size: sanitize(x.selectedSize || '', 20) || null,
        talla: sanitize(x.selectedSize || '', 20) || null,
        color: sanitize(x.selectedColor || '', 40) || null,
        quantity: x.quantity || 1,
        cantidad: x.quantity || 1,
        // ⚠️ El backend recalcula unitPrice. Lo enviamos como referencia.
        precio_referencia: Number(getPrecio(x)),
      }));

      //Renombre los totales del cliente.
      // Los llamamos *Cliente para que el backend NUNCA los use como autoritativos.
      // El backend debe recalcular y comparar contra estos.
      const payload = {
        userId: user.id,
        direccion_envio: direccionObj,
        tipo_envio: 'domicilio',
        metodo_envio: 'estandar',
        calle: direccionObj.calle,
        numero: direccionObj.numero,
        cp: direccionObj.cp,
        colonia: direccionObj.colonia,
        ciudad: direccionObj.ciudad,
        estado: direccionObj.estado,
        pais: direccionObj.pais,
        referencias: direccionObj.referencias,
        metodo_pago: metodoPago,
        notas: sanitize(notas, 300),
        items: itemsPayload,
        productos: itemsPayload,
        carrito_items: itemsPayload,
        // Solo validación cruzada. El backend los compara y rechaza si difieren.
        subtotalCliente: Math.round(subtotal * 100) / 100,
        descuentoCliente: Math.round(descuentoVolumen * 100) / 100,
        ivaCliente: Math.round(iva * 100) / 100,
        envioCliente: envio,
        totalCliente: Math.round(total * 100) / 100,
        totalUnidades,
      };

      if (__DEV__) console.log('📤 Enviando pedido al backend');

      const resp = await createOrder(payload);

      //si el backend devuelve un total distinto, avisar al usuario.
      const totalServidor = Number(
        resp?.total ?? resp?.data?.total ?? resp?.pedido?.total ?? 0
      );
      if (totalServidor > 0 && Math.abs(totalServidor - total) > TOLERANCIA_TOTAL_MXN) {
        clearCart();
        return Alert.alert(
          'El precio cambió',
          `El total del pedido es ${peso(totalServidor)} (antes ${peso(total)}). El vendedor validará el precio final antes de cobrar.`,
          [{ text: 'Ver mis pedidos', onPress: () => navigation.replace('Orders') }]
        );
      }

      clearCart();
      Alert.alert(
        'Pedido registrado',
        'Tu pedido quedó pendiente de revisión. No se realizó ningún cobro todavía.',
        [{ text: 'Ver mis pedidos', onPress: () => navigation.replace('Orders') }]
      );
    } catch (error) {
      console.log('❌ Error al crear pedido:', error?.status, error?.message);
      const detalle =
        error?.data?.error ||
        error?.data?.message ||
        error?.message ||
        'Error desconocido del servidor';
      Alert.alert(
        'No se pudo registrar',
        `${detalle}\n\nRevisa tu conexión. No se realizó ningún cobro.`
      );
    } finally {
      setLoading(false);
    }
  };

  // ================================================================
  // RENDER
  // ================================================================
  return (
    <SafeAreaView style={[styles.page, { backgroundColor: p.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <View style={styles.top}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={[styles.back, { backgroundColor: p.surface }]}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Feather name="arrow-left" color={p.text} size={22} />
        </TouchableOpacity>
        <Text style={[styles.heading, { color: p.text }]}>Finalizar compra</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="always"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 30 }}
        >
          <View style={[styles.warning, { backgroundColor: p.soft }]}>
            <Ionicons name="information-circle-outline" color={p.primary} size={22} />
            <Text style={[styles.warningText, { color: p.text }]}>
              Esta es una solicitud de compra. No se solicitan datos de tarjeta en la app.
            </Text>
          </View>

          {/* 1. DATOS DE ENVÍO */}
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons name="truck-outline" size={20} color={p.primary} />
            <Text style={[styles.sectionTitle, { color: p.text }]}>Datos de envío</Text>
            {loadingData && (
              <ActivityIndicator size="small" color={p.primary} style={{ marginLeft: 6 }} />
            )}
          </View>

          <View style={[styles.panel, { backgroundColor: p.surface, borderColor: p.border }]}>
            {direcciones.length > 0 && (
              <View style={{ marginBottom: 14 }}>
                <Text style={[styles.label, { color: p.text }]}>Direcciones guardadas</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
                >
                  {direcciones.map((dir, i) => {
                    const dirId = dir.id ?? `dir-${i}`;
                    const activa =
                      savedAddressId != null &&
                      String(savedAddressId) === String(dirId);
                    return (
                      <TouchableOpacity
                        key={dirId}
                        onPress={() => seleccionarDireccion(dir)}
                        activeOpacity={0.8}
                        style={[
                          styles.dirChip,
                          {
                            backgroundColor: activa ? p.primary + '18' : p.background,
                            borderColor: activa ? p.primary : p.border,
                          },
                        ]}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                          <Ionicons
                            name={dir.predeterminada ? 'star' : 'location-outline'}
                            size={12}
                            color={activa ? p.primary : p.subtle}
                          />
                          <Text
                            style={[styles.dirChipTitle, { color: activa ? p.primary : p.text }]}
                            numberOfLines={1}
                          >
                            {dir.nombre || `Dirección ${i + 1}`}
                          </Text>
                        </View>
                        <Text
                          style={[styles.dirChipSub, { color: activa ? p.primary + 'CC' : p.subtle }]}
                          numberOfLines={1}
                        >
                          {[dir.calle, dir.numero].filter(Boolean).join(' ')}
                          {dir.colonia ? ` · ${dir.colonia}` : ''}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}

                  <TouchableOpacity
                    onPress={limpiarDireccion}
                    activeOpacity={0.8}
                    style={[
                      styles.dirChip,
                      styles.dirChipNew,
                      { backgroundColor: 'transparent', borderColor: p.border },
                    ]}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                      <Feather name="plus" size={12} color={p.subtle} />
                      <Text style={[styles.dirChipTitle, { color: p.subtle }]} numberOfLines={1}>
                        Nueva dirección
                      </Text>
                    </View>
                  </TouchableOpacity>
                </ScrollView>

                <View style={[styles.rule, { backgroundColor: p.border, marginVertical: 10 }]} />
              </View>
            )}

            {savedAddressId && (
              <View
                style={[
                  styles.savedBanner,
                  { backgroundColor: p.primary + '10', borderColor: p.primary + '30' },
                ]}
              >
                <Ionicons name="checkmark-circle" size={14} color={p.primary} />
                <Text style={{ color: p.primary, fontSize: 11, fontWeight: '700', flex: 1 }}>
                  Dirección seleccionada · Puedes editarla o cambiarla
                </Text>
              </View>
            )}

            <Field
              label="Nombre de la dirección (opcional)"
              value={nombreDireccion}
              onChange={setNombreDireccion}
              palette={p}
              maxLength={60}
            />
            <Field label="Calle" value={calle} onChange={setCalle} palette={p} maxLength={80} />
            <View style={styles.rowTwo}>
              <View style={{ flex: 1 }}>
                <Field
                  label="Número"
                  value={numero}
                  onChange={setNumero}
                  palette={p}
                  keyboardType="default"
                  maxLength={10}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Field
                  label="C.P. (5 dígitos)"
                  value={cp}
                  onChange={(v) => setCp(v.replace(/\D/g, '').slice(0, 5))}
                  palette={p}
                  keyboardType="number-pad"
                  maxLength={5}
                />
              </View>
            </View>
            <Field label="Colonia" value={colonia} onChange={setColonia} palette={p} maxLength={80} />
            <View style={styles.rowTwo}>
              <View style={{ flex: 1 }}>
                <Field label="Ciudad" value={ciudad} onChange={setCiudad} palette={p} maxLength={60} />
              </View>
              <View style={{ flex: 1 }}>
                <Field label="Estado" value={estado} onChange={setEstado} palette={p} maxLength={60} />
              </View>
            </View>
            <Field label="País" value={pais} onChange={setPais} palette={p} maxLength={40} />
            <Field
              label="Referencias (opcional)"
              value={referencias}
              onChange={setReferencias}
              palette={p}
              maxLength={200}
              multiline
            />

            <TouchableOpacity
              onPress={() => setGuardarDireccion((v) => !v)}
              activeOpacity={0.75}
              style={[
                styles.saveToggle,
                {
                  backgroundColor: guardarDireccion ? p.primary + '10' : p.background,
                  borderColor: guardarDireccion ? p.primary + '30' : p.border,
                },
              ]}
            >
              <View
                style={[
                  styles.checkbox,
                  {
                    backgroundColor: guardarDireccion ? p.primary : 'transparent',
                    borderColor: guardarDireccion ? p.primary : p.subtle,
                  },
                ]}
              >
                {guardarDireccion && <Ionicons name="checkmark" size={12} color="#FFF" />}
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    color: guardarDireccion ? p.primary : p.text,
                    fontSize: 12,
                    fontWeight: '700',
                  }}
                >
                  {savedAddressId
                    ? 'Actualizar esta dirección en mi perfil'
                    : 'Guardar esta dirección en mi perfil'}
                </Text>
                <Text style={{ color: p.subtle, fontSize: 10, marginTop: 2 }}>
                  Se sincronizará con tu cuenta de usuario
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* 2. MÉTODO DE PAGO */}
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons name="credit-card-outline" size={20} color={p.primary} />
            <Text style={[styles.sectionTitle, { color: p.text }]}>Método de pago</Text>
          </View>

          <View style={[styles.panel, { backgroundColor: p.surface, borderColor: p.border }]}>
            <View style={styles.radioRow}>
              <TouchableOpacity
                style={[
                  styles.radioBtn,
                  {
                    backgroundColor: metodoPago === 'tarjeta' ? p.primary + '18' : 'transparent',
                    borderColor: metodoPago === 'tarjeta' ? p.primary : p.border,
                  },
                ]}
                onPress={() => setMetodoPago('tarjeta')}
                activeOpacity={0.8}
              >
                <View
                  style={[
                    styles.radioDot,
                    { borderColor: metodoPago === 'tarjeta' ? p.primary : p.subtle },
                  ]}
                >
                  {metodoPago === 'tarjeta' && (
                    <View style={[styles.radioDotInner, { backgroundColor: p.primary }]} />
                  )}
                </View>
                <Feather
                  name="credit-card"
                  size={16}
                  color={metodoPago === 'tarjeta' ? p.primary : p.subtle}
                />
                <Text
                  style={[
                    styles.radioLabel,
                    { color: metodoPago === 'tarjeta' ? p.primary : p.text },
                  ]}
                >
                  Tarjeta
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.radioBtn,
                  {
                    backgroundColor: metodoPago === 'paypal' ? p.primary + '18' : 'transparent',
                    borderColor: metodoPago === 'paypal' ? p.primary : p.border,
                  },
                ]}
                onPress={() => setMetodoPago('paypal')}
                activeOpacity={0.8}
              >
                <View
                  style={[
                    styles.radioDot,
                    { borderColor: metodoPago === 'paypal' ? p.primary : p.subtle },
                  ]}
                >
                  {metodoPago === 'paypal' && (
                    <View style={[styles.radioDotInner, { backgroundColor: p.primary }]} />
                  )}
                </View>
                <Ionicons
                  name="logo-paypal"
                  size={16}
                  color={metodoPago === 'paypal' ? p.primary : p.subtle}
                />
                <Text
                  style={[
                    styles.radioLabel,
                    { color: metodoPago === 'paypal' ? p.primary : p.text },
                  ]}
                >
                  PayPal
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={[styles.helperText, { color: p.subtle }]}>
              La pasarela de pago se abrirá por separado. Aquí solo registramos tu pedido.
            </Text>
          </View>

          {/* 3. NOTAS */}
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons name="pencil-outline" size={20} color={p.primary} />
            <Text style={[styles.sectionTitle, { color: p.text }]}>Notas adicionales</Text>
          </View>

          <View style={[styles.panel, { backgroundColor: p.surface, borderColor: p.border }]}>
            <TextInput
              value={notas}
              onChangeText={setNotas}
              placeholder="Algún comentario sobre tu pedido..."
              placeholderTextColor={p.subtle}
              style={[
                styles.field,
                styles.textArea,
                { color: p.text, backgroundColor: p.input, borderColor: p.border },
              ]}
              multiline
              maxLength={300}
            />
          </View>

          {/* 4. RESUMEN */}
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons name="package-variant-closed" size={20} color={p.primary} />
            <Text style={[styles.sectionTitle, { color: p.text }]}>Resumen del pedido</Text>
            <View style={[styles.itemsBadge, { backgroundColor: p.primary + '22' }]}>
              <Text style={[styles.itemsBadgeText, { color: p.primary }]}>
                {totalUnidades} u.
              </Text>
            </View>
          </View>

          <View style={[styles.panel, { backgroundColor: p.surface, borderColor: p.border }]}>
            {cart.length === 0 ? (
              <Text style={{ color: p.subtle }}>Tu carrito está vacío.</Text>
            ) : (
              cart.map((item, index) => {
                const foto = getFoto(item);
                const precio = getPrecio(item);
                const cantidad = item.quantity || 1;
                const varianteLabel = getVarianteLabel(item);
                const stock = getStockDisponible(item);
                const stockBajo = stock > 0 && stock < 10;

                return (
                  <View
                    key={item.cartKey || `${getId(item)}-${index}`}
                    style={[
                      styles.itemCard,
                      { borderColor: p.border, backgroundColor: p.background },
                    ]}
                  >
                    <View style={[styles.thumbWrap, { backgroundColor: p.soft }]}>
                      {foto ? (
                        <Image
                          source={{ uri: foto }}
                          style={styles.thumb}
                          contentFit="contain"
                          transition={150}
                          cachePolicy="memory-disk"
                        />
                      ) : (
                        <View style={[styles.thumb, styles.thumbPlaceholder]}>
                          <Feather name="image" size={22} color={p.subtle} />
                        </View>
                      )}
                      {cantidad > 1 && (
                        <View style={styles.qtyBadge}>
                          <Text style={styles.qtyBadgeText}>×{cantidad}</Text>
                        </View>
                      )}
                    </View>

                    <View style={styles.itemInfo}>
                      <Text style={[styles.itemName, { color: p.text }]} numberOfLines={2}>
                        {getNombre(item)}
                      </Text>

                      {(item.categoria_nombre || item.marca_nombre) && (
                        <Text style={[styles.itemMeta, { color: p.subtle }]} numberOfLines={1}>
                          {item.categoria_nombre || 'Sin categoría'}
                          {item.marca_nombre ? ` · ${item.marca_nombre}` : ''}
                        </Text>
                      )}

                      {!!varianteLabel && (
                        <View style={[styles.variantePill, { backgroundColor: p.primary + '18' }]}>
                          <Feather name="tag" size={9} color={p.primary} />
                          <Text style={[styles.varianteText, { color: p.primary }]} numberOfLines={1}>
                            {varianteLabel}
                          </Text>
                        </View>
                      )}

                      {(item.variantSku || item.sku) && (
                        <Text style={[styles.itemSku, { color: p.subtle }]} numberOfLines={1}>
                          SKU: {item.variantSku || item.sku}
                        </Text>
                      )}

                      <View style={styles.priceRow}>
                        <Text style={[styles.itemPrice, { color: p.text }]}>
                          {peso(precio)}
                          <Text style={[styles.itemPriceUnit, { color: p.subtle }]}> c/u</Text>
                        </Text>
                        <Text style={[styles.itemSubtotal, { color: p.primary }]}>
                          {peso(precio * cantidad)}
                        </Text>
                      </View>

                      {stockBajo && (
                        <View style={[styles.stockPill, { backgroundColor: '#FEF3C7' }]}>
                          <Feather name="alert-triangle" size={9} color="#B45309" />
                          <Text style={[styles.stockPillText, { color: '#B45309' }]}>
                            Solo {stock} disponibles
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                );
              })
            )}

            <View style={[styles.rule, { backgroundColor: p.border, marginTop: 6 }]} />

            <View style={styles.totalLine}>
              <Text style={{ color: p.subtle, fontSize: 13 }}>Subtotal</Text>
              <Text style={{ color: p.text, fontWeight: '700', fontSize: 14 }}>
                {peso(subtotal)}
              </Text>
            </View>

            {aplicaDescuento && (
              <View style={styles.totalLine}>
                <Text style={{ color: '#059669', fontSize: 13, fontWeight: '600' }}>
                  Descuento ({DESCUENTO_VOLUMEN_PORCENTAJE * 100}%)
                </Text>
                <Text style={{ color: '#059669', fontWeight: '700', fontSize: 14 }}>
                  -{peso(descuentoVolumen)}
                </Text>
              </View>
            )}

            <View style={styles.totalLine}>
              <Text style={{ color: p.subtle, fontSize: 13 }}>IVA (16%)</Text>
              <Text style={{ color: p.text, fontWeight: '700', fontSize: 14 }}>
                {peso(iva)}
              </Text>
            </View>

            <View style={styles.totalLine}>
              <Text style={{ color: p.subtle, fontSize: 13 }}>Envío</Text>
              <Text style={{ color: p.text, fontWeight: '700', fontSize: 14 }}>
                {peso(envio)}
              </Text>
            </View>

            {esPrioritario && (
              <View style={[styles.priorityBox, { backgroundColor: '#CCE5FF' }]}>
                <Feather name="clock" size={12} color="#1E40AF" />
                <Text style={{ color: '#1E40AF', fontSize: 11, fontWeight: '700' }}>
                  Envío prioritario · entrega en 1 día hábil
                </Text>
              </View>
            )}

            <View style={[styles.rule, { backgroundColor: p.border, marginVertical: 10 }]} />

            <View style={styles.totalLine}>
              <Text style={{ color: p.text, fontWeight: '900', fontSize: 16 }}>Total</Text>
              <Text style={{ color: p.primary, fontWeight: '900', fontSize: 20 }}>
                {peso(total)}
              </Text>
            </View>

            <Text style={[styles.estimate, { color: p.subtle }]}>
              Precios y envío estimados. El vendedor validará disponibilidad y método de pago.
            </Text>
          </View>

          <View style={styles.security}>
            <Ionicons name="shield-checkmark-outline" color="#059669" size={18} />
            <Text style={{ color: p.subtle, flex: 1, fontSize: 11.5 }}>
              Los datos se envían cifrados al servidor de ORION y quedan asociados a tu cuenta.
            </Text>
          </View>
        </ScrollView>

        <View style={[styles.footer, { backgroundColor: p.surface, borderColor: p.border }]}>
          <View>
            <Text style={{ color: p.subtle, fontSize: 11 }}>Total estimado</Text>
            <Text style={[styles.sum, { color: p.text }]}>{peso(total)}</Text>
          </View>
          <TouchableOpacity
            disabled={loading || !cart.length}
            onPress={submit}
            style={[
              styles.submit,
              {
                backgroundColor: p.primary,
                opacity: loading || !cart.length ? 0.5 : 1,
              },
            ]}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <>
                <Text style={styles.submitText}>Realizar pedido</Text>
                <Ionicons name="arrow-forward" size={18} color="white" />
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ================================================================
// ESTILOS
// ================================================================
const styles = StyleSheet.create({
  page: { flex: 1 },
  top: { paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { borderRadius: 12, padding: 9 },
  heading: { fontSize: 18, fontWeight: '900' },
  warning: { flexDirection: 'row', padding: 12, borderRadius: 14, gap: 10, marginTop: 6, marginBottom: 8, alignItems: 'center' },
  warningText: { flex: 1, fontSize: 11.5, lineHeight: 17 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 20, marginBottom: 10 },
  sectionTitle: { fontSize: 15, fontWeight: '900', flex: 1 },
  itemsBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
  itemsBadgeText: { fontSize: 11, fontWeight: '800' },
  panel: { padding: 14, borderRadius: 18, borderWidth: 1 },
  dirChip: { minWidth: 150, maxWidth: 220, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 12, borderWidth: 1.5 },
  dirChipNew: { borderStyle: 'dashed' },
  dirChipTitle: { fontSize: 12, fontWeight: '800' },
  dirChipSub: { fontSize: 10, marginTop: 3, fontWeight: '500' },
  savedBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, borderWidth: 1, marginBottom: 12 },
  saveToggle: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12, borderWidth: 1, marginTop: 8 },
  checkbox: { width: 20, height: 20, borderRadius: 6, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
  label: { fontWeight: '700', fontSize: 11.5, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.3 },
  field: { paddingHorizontal: 12, paddingVertical: 11, borderRadius: 11, borderWidth: 1, fontSize: 14, minHeight: 44 },
  textArea: { minHeight: 70, textAlignVertical: 'top' },
  rowTwo: { flexDirection: 'row', gap: 10 },
  radioRow: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  radioBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 11, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1.5 },
  radioDot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
  radioDotInner: { width: 8, height: 8, borderRadius: 4 },
  radioLabel: { fontSize: 12.5, fontWeight: '700', flex: 1 },
  helperText: { fontSize: 11, marginTop: 10, lineHeight: 15, fontStyle: 'italic' },
  itemCard: { flexDirection: 'row', padding: 10, borderRadius: 14, borderWidth: 1, marginBottom: 10, gap: 10 },
  thumbWrap: { width: 68, height: 68, borderRadius: 12, padding: 3, position: 'relative', justifyContent: 'center', alignItems: 'center' },
  thumb: { width: '100%', height: '100%', borderRadius: 9 },
  thumbPlaceholder: { justifyContent: 'center', alignItems: 'center' },
  qtyBadge: { position: 'absolute', top: -4, right: -4, backgroundColor: '#6366F1', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 8, borderWidth: 2, borderColor: '#FFF' },
  qtyBadgeText: { color: '#FFF', fontSize: 10, fontWeight: '900' },
  itemInfo: { flex: 1, minWidth: 0 },
  itemName: { fontSize: 13, fontWeight: '800', lineHeight: 17 },
  itemMeta: { fontSize: 10.5, marginTop: 2, fontWeight: '500' },
  variantePill: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8, marginTop: 5 },
  varianteText: { fontSize: 10, fontWeight: '700' },
  itemSku: { fontSize: 9.5, marginTop: 4, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  priceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  itemPrice: { fontSize: 12, fontWeight: '700' },
  itemPriceUnit: { fontSize: 9.5, fontWeight: '500' },
  itemSubtotal: { fontSize: 14, fontWeight: '900' },
  stockPill: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8, marginTop: 5 },
  stockPillText: { fontSize: 9.5, fontWeight: '700' },
  rule: { height: 1, marginVertical: 10 },
  totalLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  priorityBox: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 8, borderRadius: 8, marginTop: 6 },
  estimate: { fontSize: 10.5, lineHeight: 15, marginTop: 12, fontStyle: 'italic' },
  security: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 18 },
  footer: { borderTopWidth: 1, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 14 },
  sum: { fontSize: 18, fontWeight: '900' },
  submit: { flex: 1, flexDirection: 'row', gap: 8, borderRadius: 14, padding: 15, justifyContent: 'center', alignItems: 'center' },
  submitText: { color: 'white', fontSize: 14, fontWeight: '800' },
});