// src/screens/OrderDetailScreen.js
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '../i18n/ui';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import {
  cancelOrder,
  fetchOrder,
  resolveProductPhoto,
} from '../services/api';
import { usePreferences } from '../context/PreferencesContext';

// ⭐ Descarga de PDFs (voucher y factura) desde Express con JWT
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { API_URL } from '../config/api';
import { loadSession } from '../services/api';

// ================================================================
// ⭐ INTERNACIONALIZACIÓN (ES/EN)
// ================================================================
const T = {
  es: {
    headerTitle: 'Detalle del pedido',
    back: 'Atrás',
    loading: 'Cargando pedido...',

    notFoundTitle: 'Pedido no encontrado',
    notFoundSub: 'No se recibió la información del pedido.',
    volver: 'Volver',
    reintentar: 'Reintentar',

    fechaNoDisponible: 'Fecha no disponible',

    estados: {
      pendiente: {
        title: 'Pedido pendiente de confirmación',
        sub: 'Estamos procesando tu pedido. Te notificaremos pronto.',
      },
      confirmado: {
        title: '¡Tu pedido fue confirmado!',
        sub: 'Estamos preparando todo para el envío.',
      },
      preparando: {
        title: 'Preparando tu pedido',
        sub: 'Estamos empacando tus productos.',
      },
      enviado: {
        title: 'Tu pedido está en camino',
        sub: 'Llegará en la fecha estimada.',
      },
      entregado: {
        title: 'Pedido entregado',
        sub: '¡Gracias por tu compra!',
      },
      cancelado: {
        title: 'Pedido cancelado',
        sub: 'Este pedido ya no está activo.',
      },
    },

    statusLabels: {
      pendiente: 'PENDIENTE',
      confirmado: 'CONFIRMADO',
      preparando: 'PREPARANDO',
      enviado: 'ENVIADO',
      entregado: 'ENTREGADO',
      cancelado: 'CANCELADO',
    },

    paymentLabels: {
      pagado: 'Pagado',
      pendiente: 'Pago pendiente',
      rechazado: 'Pago rechazado',
      reembolsado: 'Reembolsado',
      cancelado: 'Pago cancelado',
      '': 'Sin pago registrado',
    },

    oxxo: {
      title: 'Pago en OXXO',
      instructions:
        'Presenta esta referencia en cualquier tienda OXXO. El pago se reflejará automáticamente.',
      reference: 'REFERENCIA',
      loadingRef: 'Cargando referencia...',
      noRefTitle: '⚠️ Referencia no disponible',
      noRefSub:
        'El servidor aún no la ha generado. Desliza hacia abajo para refrescar o intenta en unos segundos.',
      expires: 'VENCE',
      amount: 'MONTO A PAGAR',
      downloadVoucher: 'Descargar voucher',
      downloading: 'Descargando...',
      invoice: 'Factura PDF',
      oxxoDownloadErrTitle: 'No se pudo descargar el voucher',
      invoiceErrTitle: 'No se pudo descargar la factura',
      retryLater: 'Intenta de nuevo más tarde.',
      voucherOk: 'Voucher descargado',
      invoiceOk: 'Factura descargada',
    },

    paymentStatus: 'Estado del pago',
    metodo: 'Método',
    noEspecificado: 'No especificado',
    waitingOxxo:
      '⏳ Esperando confirmación de pago en OXXO. Esto puede tardar hasta 24 horas hábiles.',

    products: 'Productos',
    sinArticulos: 'Sin artículos registrados.',
    articulo: 'Artículo',
    talla: 'Talla',
    color: 'Color',

    summaryTitle: 'Resumen',
    subtotal: 'Subtotal',
    envio: 'Envío',
    iva: 'IVA (16%)',
    total: 'Total',

    infoTitle: 'Información',
    pedido: 'Pedido',
    creado: 'Creado',
    envioLabel: 'Envío',
    clickCollect: 'Click & Collect',
    aDomicilio: 'A domicilio',

    cancelar: 'Cancelar pedido',
    cancelarTitle: '¿Cancelar pedido?',
    cancelarSub:
      '¿Estás seguro de que deseas cancelar este pedido? Esta acción no se puede deshacer.',
    noVolver: 'No, volver',
    siCancelar: 'Sí, cancelar',
    canceladoTitle: 'Pedido cancelado',
    canceladoSub: 'El pedido fue cancelado correctamente.',
    cancelErrTitle: 'Error',
    cancelErrSub: 'No se pudo cancelar el pedido. Intenta de nuevo.',
    refreshErrTitle: 'No se pudo actualizar',
    refreshErrSub: 'Verifica tu conexión e intenta de nuevo.',
  },
  en: {
    headerTitle: 'Order details',
    back: 'Back',
    loading: 'Loading order...',

    notFoundTitle: 'Order not found',
    notFoundSub: 'Order information was not received.',
    volver: 'Back',
    reintentar: 'Retry',

    fechaNoDisponible: 'Date not available',

    estados: {
      pendiente: {
        title: 'Order pending confirmation',
        sub: 'We are processing your order. We will notify you soon.',
      },
      confirmado: {
        title: 'Your order was confirmed!',
        sub: 'We are getting everything ready for shipment.',
      },
      preparando: {
        title: 'Preparing your order',
        sub: 'We are packing your items.',
      },
      enviado: {
        title: 'Your order is on its way',
        sub: 'It will arrive on the estimated date.',
      },
      entregado: {
        title: 'Order delivered',
        sub: 'Thank you for your purchase!',
      },
      cancelado: {
        title: 'Order cancelled',
        sub: 'This order is no longer active.',
      },
    },

    statusLabels: {
      pendiente: 'PENDING',
      confirmado: 'CONFIRMED',
      preparando: 'PREPARING',
      enviado: 'SHIPPED',
      entregado: 'DELIVERED',
      cancelado: 'CANCELLED',
    },

    paymentLabels: {
      pagado: 'Paid',
      pendiente: 'Payment pending',
      rechazado: 'Payment rejected',
      reembolsado: 'Refunded',
      cancelado: 'Payment cancelled',
      '': 'No payment registered',
    },

    oxxo: {
      title: 'OXXO payment',
      instructions:
        'Show this reference at any OXXO store. Payment will be reflected automatically.',
      reference: 'REFERENCE',
      loadingRef: 'Loading reference...',
      noRefTitle: '⚠️ Reference not available',
      noRefSub:
        'The server has not generated it yet. Pull down to refresh or try again in a few seconds.',
      expires: 'EXPIRES',
      amount: 'AMOUNT TO PAY',
      downloadVoucher: 'Download voucher',
      downloading: 'Downloading...',
      invoice: 'Invoice PDF',
      oxxoDownloadErrTitle: 'Could not download voucher',
      invoiceErrTitle: 'Could not download invoice',
      retryLater: 'Please try again later.',
      voucherOk: 'Voucher downloaded',
      invoiceOk: 'Invoice downloaded',
    },

    paymentStatus: 'Payment status',
    metodo: 'Method',
    noEspecificado: 'Not specified',
    waitingOxxo:
      '⏳ Waiting for OXXO payment confirmation. This may take up to 24 business hours.',

    products: 'Products',
    sinArticulos: 'No items registered.',
    articulo: 'Item',
    talla: 'Size',
    color: 'Color',

    summaryTitle: 'Summary',
    subtotal: 'Subtotal',
    envio: 'Shipping',
    iva: 'VAT (16%)',
    total: 'Total',

    infoTitle: 'Information',
    pedido: 'Order',
    creado: 'Created',
    envioLabel: 'Shipping',
    clickCollect: 'Click & Collect',
    aDomicilio: 'Home delivery',

    cancelar: 'Cancel order',
    cancelarTitle: 'Cancel order?',
    cancelarSub:
      'Are you sure you want to cancel this order? This action cannot be undone.',
    noVolver: 'No, go back',
    siCancelar: 'Yes, cancel',
    canceladoTitle: 'Order cancelled',
    canceladoSub: 'The order was cancelled successfully.',
    cancelErrTitle: 'Error',
    cancelErrSub: 'Could not cancel the order. Please try again.',
    refreshErrTitle: 'Could not refresh',
    refreshErrSub: 'Check your connection and try again.',
  },
};

const getLang = (language) => {
  const l = String(language || 'es').toLowerCase();
  return l.startsWith('en') ? 'en' : 'es';
};

// ================================================================
// Helpers
// ================================================================
const currency = (n, lang = 'es') =>
  `$${Number(n || 0).toLocaleString(lang === 'en' ? 'en-US' : 'es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const formatFecha = (iso, lang = 'es', placeholder = 'Fecha no disponible') => {
  if (!iso) return placeholder;
  try {
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2, '0')}/${String(
      d.getMonth() + 1
    ).padStart(2, '0')}/${d.getFullYear()} ${String(d.getHours()).padStart(
      2,
      '0'
    )}:${String(d.getMinutes()).padStart(2, '0')}`;
  } catch {
    return placeholder;
  }
};

const primeraFotoItem = (it) => {
  if (!it) return null;

  const tryValue = (raw) => {
    if (!raw) return null;

    if (typeof raw === 'string') {
      const s = raw.trim();
      if (!s) return null;
      if (/^data:image\//i.test(s)) return s;
      if (/^https?:\/\//i.test(s)) return s;
      if (s.startsWith('/')) {
        const url = resolveProductPhoto(s);
        if (url) return url;
      }
      const url = resolveProductPhoto(s);
      if (url) return url;
      return null;
    }

    if (typeof raw === 'object') {
      const u =
        raw.url ||
        raw.src ||
        raw.href ||
        raw.nombre ||
        raw.path ||
        raw.filename ||
        '';
      return tryValue(u);
    }

    return null;
  };

  const directa = tryValue(
    it.image || it.imagen || it.foto || it.foto_url || it.imagen_url
  );
  if (directa) return directa;

  if (Array.isArray(it.fotos)) {
    for (const f of it.fotos) {
      const url = tryValue(f);
      if (url) return url;
    }
  }

  if (Array.isArray(it.imagenes)) {
    for (const f of it.imagenes) {
      const url = tryValue(f);
      if (url) return url;
    }
  }

  return null;
};

const COLOR_ESTADO = {
  pendiente: { bg: '#FEF3C7', fg: '#B45309', icon: 'clock' },
  confirmado: { bg: '#DBEAFE', fg: '#1E40AF', icon: 'check-circle' },
  preparando: { bg: '#E0E7FF', fg: '#4338CA', icon: 'package' },
  enviado: { bg: '#E0F2FE', fg: '#0369A1', icon: 'truck' },
  entregado: { bg: '#D1FAE5', fg: '#065F46', icon: 'check-circle' },
  cancelado: { bg: '#FEE2E2', fg: '#991B1B', icon: 'x-circle' },
};

// ⭐ Descarga la factura fiscal en PDF desde Express y la comparte
async function descargarFacturaPDF(pedidoId, t) {
  if (!pedidoId) throw new Error('Sin pedido');

  const { token } = await loadSession();
  if (!token) throw new Error('Debes iniciar sesión');

  const apiBase = API_URL.replace(/\/+$/, '');
  const url = `${apiBase}/api/v1/cuenta/factura/${encodeURIComponent(pedidoId)}`;
  const destino = `${FileSystem.cacheDirectory}factura_${pedidoId}.pdf`;

  const result = await FileSystem.downloadAsync(url, destino, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (result.status === 404) {
    throw new Error('Pedido no encontrado');
  }
  if (result.status === 400) {
    throw new Error('Configura tus datos fiscales antes de generar la factura');
  }
  if (result.status !== 200) {
    throw new Error(`No se pudo generar la factura (${result.status})`);
  }

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(result.uri, {
      mimeType: 'application/pdf',
      dialogTitle: 'Factura',
    });
  } else {
    Alert.alert('✅', t?.oxxo?.invoiceOk || 'Factura descargada');
  }
}

// ⭐ Descarga el voucher OXXO en PDF desde Express y lo comparte
async function descargarVoucherPDF(pedidoId, t) {
  if (!pedidoId) throw new Error('Sin pedido');

  const { token } = await loadSession();
  if (!token) throw new Error('Debes iniciar sesión');

  const apiBase = API_URL.replace(/\/+$/, '');
  const url = `${apiBase}/api/v1/cuenta/voucher/${encodeURIComponent(pedidoId)}`;
  const destino = `${FileSystem.cacheDirectory}voucher_${pedidoId}.pdf`;

  const result = await FileSystem.downloadAsync(url, destino, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (result.status === 404) {
    throw new Error('Pedido no encontrado');
  }
  if (result.status === 400) {
    throw new Error('Este pedido no es de OXXO');
  }
  if (result.status !== 200) {
    throw new Error(`No se pudo generar el voucher (${result.status})`);
  }

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(result.uri, {
      mimeType: 'application/pdf',
      dialogTitle: 'Voucher OXXO',
    });
  } else {
    Alert.alert('✅', t?.oxxo?.voucherOk || 'Voucher descargado');
  }
}

export default function OrderDetailScreen({ navigation, route }) {
  const prefs = usePreferences() || {};
  const p = prefs.palette || {};
  const lang = getLang(prefs.language);
  const t = T[lang];

  // ⭐ Acepta { order } (desde OrdersScreen) o { orderId } (desde notificaciones/push)
  const pedidoIdInicial =
    route.params?.order?.id ||
    route.params?.orderId ||
    route.params?.id ||
    null;

  const [order, setOrder] = useState(route.params?.order || null);
  const [cancelando, setCancelando] = useState(false);
  const [descargandoVoucher, setDescargandoVoucher] = useState(false);
  const [descargandoFactura, setDescargandoFactura] = useState(false);
  const [recargando, setRecargando] = useState(false);
  const [cargandoInicial, setCargandoInicial] = useState(false);
  const [errorCargaInicial, setErrorCargaInicial] = useState(null);

  const pedidoId = order?.id || pedidoIdInicial;
  const esOxxo = String(order?.metodo_pago || '').toLowerCase() === 'oxxo';
  const tieneVoucher = !!order?.oxxo_voucher_url;
  const faltaReferencia = esOxxo && !order?.oxxo_referencia;

  const estado = String(order?.status || 'pendiente').toLowerCase();
  const colors = COLOR_ESTADO[estado] || COLOR_ESTADO.pendiente;
  const texto = t.estados[estado] || t.estados.pendiente;
  const labelEstado = t.statusLabels[estado] || t.statusLabels.pendiente;

  const pagoRaw = String(order?.paymentStatus || '').toLowerCase();
  const labelPago = t.paymentLabels[pagoRaw] || t.paymentLabels[''];
  const pagoEsPagado = pagoRaw === 'pagado';

  const items = useMemo(() => {
    if (!order) return [];
    return Array.isArray(order.items) ? order.items : [];
  }, [order]);

  const total = Number(order?.totalEstimado || 0);
  const subtotal = Number(order?.subtotalEstimado || 0);
  const envio = Number(order?.envioEstimado || 0);

  const iva = useMemo(() => {
    if (!subtotal) return 0;
    const computed = total - subtotal - envio;
    if (computed > 0 && Math.abs(computed - subtotal * 0.16) < 1) {
      return computed;
    }
    return subtotal * 0.16;
  }, [subtotal, total, envio]);

  const puedeCancelar = ['pendiente', 'confirmado'].includes(estado);

  // ⭐ Carga inicial si llegó solo con orderId (desde notificación)
  useEffect(() => {
    if (order || !pedidoIdInicial) return;
    let cancelado = false;
    (async () => {
      try {
        setCargandoInicial(true);
        setErrorCargaInicial(null);
        const full = await fetchOrder(pedidoIdInicial);
        if (!cancelado && full) {
          setOrder(full);
        }
      } catch (e) {
        if (!cancelado) {
          setErrorCargaInicial(
            e?.message || 'No se pudo cargar el pedido.'
          );
        }
      } finally {
        if (!cancelado) setCargandoInicial(false);
      }
    })();
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedidoIdInicial]);

  const recargarPedido = useCallback(
    async ({ silencioso = false } = {}) => {
      if (!pedidoId) return;
      try {
        if (!silencioso) setRecargando(true);
        const full = await fetchOrder(pedidoId);
        if (full) {
          setOrder((prev) => ({ ...(prev || {}), ...full }));
        }
      } catch (e) {
        if (!silencioso) {
          Alert.alert(
            t.refreshErrTitle,
            e?.message || t.refreshErrSub
          );
        }
      } finally {
        if (!silencioso) setRecargando(false);
      }
    },
    [pedidoId, t]
  );

  useEffect(() => {
    if (!faltaReferencia) return;
    recargarPedido({ silencioso: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedidoId]);

  const confirmarCancelar = () => {
    if (!pedidoId) return;
    Alert.alert(
      t.cancelarTitle,
      t.cancelarSub,
      [
        { text: t.noVolver, style: 'cancel' },
        {
          text: t.siCancelar,
          style: 'destructive',
          onPress: () => ejecutarCancelar(),
        },
      ]
    );
  };

  const ejecutarCancelar = async () => {
    try {
      setCancelando(true);
      await cancelOrder(pedidoId);
      Alert.alert(t.canceladoTitle, t.canceladoSub);
      navigation.goBack();
    } catch (e) {
      Alert.alert(
        t.cancelErrTitle,
        e?.message || t.cancelErrSub
      );
    } finally {
      setCancelando(false);
    }
  };

  // ⭐ Descarga el voucher OXXO en PDF desde Express (JWT)
  const descargarVoucher = async () => {
    if (!pedidoId) return;
    try {
      setDescargandoVoucher(true);
      await descargarVoucherPDF(pedidoId, t);
    } catch (e) {
      Alert.alert(
        t.oxxo.oxxoDownloadErrTitle,
        e?.message || t.oxxo.retryLater
      );
    } finally {
      setDescargandoVoucher(false);
    }
  };

  // ⭐ Descargar la factura fiscal en PDF
  const descargarFactura = async () => {
    if (!pedidoId) return;
    try {
      setDescargandoFactura(true);
      await descargarFacturaPDF(pedidoId, t);
    } catch (e) {
      Alert.alert(
        t.oxxo.invoiceErrTitle,
        e?.message || t.oxxo.retryLater
      );
    } finally {
      setDescargandoFactura(false);
    }
  };

  // ────────────────────────────────────────────────────────────────
  // Spinner mientras carga desde orderId (notificaciones/push)
  // ────────────────────────────────────────────────────────────────
  if ((!order || !order.id) && cargandoInicial) {
    return (
      <SafeAreaView
        style={[styles.page, { backgroundColor: p.background }]}
        edges={['top', 'left', 'right']}
      >
        <View
          style={[
            styles.header,
            { backgroundColor: p.background, borderBottomColor: p.border },
          ]}
        >
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: p.surface }]}
            onPress={() => navigation.goBack()}
          >
            <Feather name="arrow-left" size={20} color={p.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, { color: p.text }]}>
              {t.headerTitle}
            </Text>
          </View>
        </View>
        <View style={styles.center}>
          <ActivityIndicator color={p.primary} size="large" />
          <Text style={{ color: p.subtle, marginTop: 12 }}>
            {t.loading}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // ────────────────────────────────────────────────────────────────
  // Estado vacío / error
  // ────────────────────────────────────────────────────────────────
  if (!order || !order.id) {
    return (
      <SafeAreaView
        style={[styles.page, { backgroundColor: p.background }]}
        edges={['top', 'left', 'right']}
      >
        <View
          style={[
            styles.header,
            { backgroundColor: p.background, borderBottomColor: p.border },
          ]}
        >
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: p.surface }]}
            onPress={() => navigation.goBack()}
            accessibilityLabel={t.back}
          >
            <Feather name="arrow-left" size={20} color={p.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, { color: p.text }]}>
              {t.headerTitle}
            </Text>
          </View>
        </View>

        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={48} color={p.subtle} />
          <Text style={[styles.emptyTitle, { color: p.text }]}>
            {t.notFoundTitle}
          </Text>
          <Text style={[styles.emptySub, { color: p.subtle }]}>
            {errorCargaInicial || t.notFoundSub}
          </Text>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={[styles.primaryBtn, { backgroundColor: p.primary }]}
            activeOpacity={0.85}
          >
            <Feather name="arrow-left" size={16} color="#FFF" />
            <Text style={styles.primaryBtnText}>{t.volver}</Text>
          </TouchableOpacity>
          {!!pedidoIdInicial && (
            <TouchableOpacity
              onPress={() => {
                setErrorCargaInicial(null);
                (async () => {
                  try {
                    setCargandoInicial(true);
                    const full = await fetchOrder(pedidoIdInicial);
                    if (full) setOrder(full);
                  } catch (e) {
                    setErrorCargaInicial(
                      e?.message || 'No se pudo cargar el pedido.'
                    );
                  } finally {
                    setCargandoInicial(false);
                  }
                })();
              }}
              style={[
                styles.primaryBtn,
                {
                  backgroundColor: 'transparent',
                  borderWidth: 1.5,
                  borderColor: p.primary,
                },
              ]}
              activeOpacity={0.85}
            >
              <Feather name="refresh-cw" size={16} color={p.primary} />
              <Text style={[styles.primaryBtnText, { color: p.primary }]}>
                {t.reintentar}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    );
  }

  // ────────────────────────────────────────────────────────────────
  // Detalle
  // ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView
      style={[styles.page, { backgroundColor: p.background }]}
      edges={['top', 'left', 'right']}
    >
      <View
        style={[
          styles.header,
          { backgroundColor: p.background, borderBottomColor: p.border },
        ]}
      >
        <TouchableOpacity
          style={[styles.iconBtn, { backgroundColor: p.surface }]}
          onPress={() => navigation.goBack()}
        >
          <Feather name="arrow-left" size={20} color={p.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: p.text }]}>
            {t.headerTitle}
          </Text>
          <Text style={[styles.headerSub, { color: p.subtle }]}>
            #{String(pedidoId || '').slice(0, 8).toUpperCase()}
          </Text>
        </View>
        <View style={[styles.statusPillHeader, { backgroundColor: colors.bg }]}>
          <Text style={[styles.statusPillHeaderText, { color: colors.fg }]}>
            {labelEstado}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={recargando}
            onRefresh={() => recargarPedido()}
            tintColor={p.primary}
          />
        }
      >
        <View
          style={[
            styles.alert,
            { backgroundColor: colors.bg, borderColor: colors.fg },
          ]}
        >
          <Feather name={colors.icon} size={22} color={colors.fg} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.alertTitle, { color: colors.fg }]}>
              {texto.title}
            </Text>
            <Text style={[styles.alertSub, { color: colors.fg, opacity: 0.85 }]}>
              {texto.sub}
            </Text>
          </View>
        </View>

        {/* ⭐ Bloque OXXO */}
        {esOxxo && !pagoEsPagado && estado !== 'cancelado' && (
          <View
            style={[
              styles.oxxoCard,
              { backgroundColor: '#FFF7ED', borderColor: '#FDBA74' },
            ]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <MaterialCommunityIcons
                name="storefront-outline"
                size={22}
                color="#C2410C"
              />
              <Text style={{ fontSize: 14, fontWeight: '900', color: '#7C2D12' }}>
                {t.oxxo.title}
              </Text>
            </View>

            <Text
              style={{
                fontSize: 11,
                color: '#7C2D12',
                marginTop: 6,
                lineHeight: 16,
              }}
            >
              {t.oxxo.instructions}
            </Text>

            <View style={{ marginTop: 10 }}>
              <Text style={{ fontSize: 10, fontWeight: '800', color: '#9A3412' }}>
                {t.oxxo.reference}
              </Text>

              {order?.oxxo_referencia ? (
                <Text selectable style={styles.oxxoRefBig}>
                  {order.oxxo_referencia}
                </Text>
              ) : recargando ? (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    marginTop: 4,
                  }}
                >
                  <ActivityIndicator color="#C2410C" />
                  <Text style={{ fontSize: 12, color: '#9A3412' }}>
                    {t.oxxo.loadingRef}
                  </Text>
                </View>
              ) : (
                <View style={{ marginTop: 4 }}>
                  <Text
                    style={{ fontSize: 12, color: '#B45309', fontWeight: '700' }}
                  >
                    {t.oxxo.noRefTitle}
                  </Text>
                  <Text style={{ fontSize: 11, color: '#9A3412', marginTop: 2 }}>
                    {t.oxxo.noRefSub}
                  </Text>
                  <TouchableOpacity
                    onPress={() => recargarPedido()}
                    activeOpacity={0.85}
                    style={{
                      marginTop: 8,
                      alignSelf: 'flex-start',
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: 8,
                      backgroundColor: '#FFEDD5',
                      borderWidth: 1,
                      borderColor: '#FDBA74',
                    }}
                  >
                    <Feather name="refresh-cw" size={12} color="#C2410C" />
                    <Text
                      style={{
                        fontSize: 12,
                        color: '#C2410C',
                        fontWeight: '800',
                      }}
                    >
                      {t.reintentar}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {!!order?.oxxo_vence && (
              <View style={{ marginTop: 10 }}>
                <Text style={{ fontSize: 10, fontWeight: '800', color: '#9A3412' }}>
                  {t.oxxo.expires}
                </Text>
                <Text
                  style={{ fontSize: 13, fontWeight: '800', color: '#7C2D12' }}
                >
                  {new Date(order.oxxo_vence).toLocaleDateString(
                    lang === 'en' ? 'en-US' : 'es-MX',
                    {
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric',
                    }
                  )}
                </Text>
              </View>
            )}

            {Number(order?.totalEstimado || 0) > 0 && (
              <View style={{ marginTop: 10 }}>
                <Text style={{ fontSize: 10, fontWeight: '800', color: '#9A3412' }}>
                  {t.oxxo.amount}
                </Text>
                <Text
                  style={{ fontSize: 20, fontWeight: '900', color: '#B91C1C' }}
                >
                  {currency(order.totalEstimado, lang)}
                </Text>
              </View>
            )}

            {/* ⭐ Botón: Descargar voucher (solo aparece si el pedido tiene voucher) */}
            {tieneVoucher && (
              <TouchableOpacity
                onPress={descargarVoucher}
                disabled={descargandoVoucher}
                activeOpacity={0.85}
                style={[
                  styles.oxxoBtnBig,
                  {
                    marginTop: 12,
                    backgroundColor: '#C2410C',
                    opacity: descargandoVoucher ? 0.6 : 1,
                  },
                ]}
              >
                {descargandoVoucher ? (
                  <>
                    <ActivityIndicator color="#FFF" size="small" />
                    <Text style={styles.oxxoBtnBigText}>{t.oxxo.downloading}</Text>
                  </>
                ) : (
                  <>
                    <MaterialCommunityIcons
                      name="download"
                      size={18}
                      color="#FFF"
                    />
                    <Text style={styles.oxxoBtnBigText}>{t.oxxo.downloadVoucher}</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {/* ⭐ Botón: Factura PDF */}
            <TouchableOpacity
              onPress={descargarFactura}
              disabled={descargandoFactura}
              activeOpacity={0.85}
              style={[
                styles.facturaBtn,
                { opacity: descargandoFactura ? 0.6 : 1 },
              ]}
            >
              {descargandoFactura ? (
                <>
                  <ActivityIndicator color="#FFF" size="small" />
                  <Text style={styles.facturaBtnText}>{t.oxxo.downloading}</Text>
                </>
              ) : (
                <>
                  <Feather name="file-text" size={16} color="#FFF" />
                  <Text style={styles.facturaBtnText}>{t.oxxo.invoice}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Estado de pago */}
        <View
          style={[
            styles.card,
            { backgroundColor: p.surface, borderColor: p.border },
          ]}
        >
          <View style={styles.rowBetween}>
            <Text style={[styles.cardTitle, { color: p.text }]}>
              {t.paymentStatus}
            </Text>
            <View
              style={[
                styles.statusPill,
                { backgroundColor: pagoEsPagado ? '#D1FAE5' : '#FEF3C7' },
              ]}
            >
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: '900',
                  color: pagoEsPagado ? '#065F46' : '#B45309',
                }}
              >
                {labelPago.toUpperCase()}
              </Text>
            </View>
          </View>

          <Text style={{ fontSize: 12, color: p.subtle, marginTop: 8 }}>
            {t.metodo}: {order?.metodo_pago || t.noEspecificado}
          </Text>

          {!pagoEsPagado && esOxxo && (
            <Text
              style={{
                fontSize: 11,
                color: '#B45309',
                marginTop: 6,
                lineHeight: 16,
              }}
            >
              {t.waitingOxxo}
            </Text>
          )}
        </View>

        {/* Productos */}
        <View
          style={[
            styles.card,
            { backgroundColor: p.surface, borderColor: p.border },
          ]}
        >
          <Text style={[styles.cardTitle, { color: p.text }]}>
            {t.products} ({items.length})
          </Text>

          {items.length === 0 ? (
            <Text style={{ color: p.subtle, marginTop: 8, fontSize: 13 }}>
              {t.sinArticulos}
            </Text>
          ) : (
            items.map((it, idx) => {
              const img = primeraFotoItem(it);
              const talla = it?.size || it?.talla || null;
              const color = it?.color || null;
              return (
                <View key={idx} style={styles.itemRow}>
                  <View
                    style={[
                      styles.itemImgBox,
                      { backgroundColor: p.background, borderColor: p.border },
                    ]}
                  >
                    {img ? (
                      <Image
                        source={{ uri: img }}
                        style={{ width: '100%', height: '100%' }}
                        contentFit="cover"
                      />
                    ) : (
                      <Feather name="package" size={18} color={p.subtle} />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{ fontSize: 13, fontWeight: '800', color: p.text }}
                      numberOfLines={2}
                    >
                      {it?.name || t.articulo}
                    </Text>
                    <Text
                      style={{ fontSize: 11, color: p.subtle, marginTop: 2 }}
                    >
                      {it?.quantity || 1} × {currency(it?.unitPrice, lang)}
                    </Text>
                    {(talla || color) && (
                      <Text
                        style={{ fontSize: 11, color: p.subtle, marginTop: 2 }}
                      >
                        {talla ? `${t.talla}: ${talla}` : ''}
                        {talla && color ? ' · ' : ''}
                        {color ? `${t.color}: ${color}` : ''}
                      </Text>
                    )}
                  </View>
                  <Text style={{ fontSize: 13, fontWeight: '900', color: p.text }}>
                    {currency((it?.quantity || 1) * (it?.unitPrice || 0), lang)}
                  </Text>
                </View>
              );
            })
          )}
        </View>

        {/* Resumen */}
        <View
          style={[
            styles.card,
            { backgroundColor: p.surface, borderColor: p.border },
          ]}
        >
          <Text style={[styles.cardTitle, { color: p.text }]}>{t.summaryTitle}</Text>

          <View style={styles.rowBetween}>
            <Text style={{ fontSize: 13, color: p.subtle }}>{t.subtotal}</Text>
            <Text style={{ fontSize: 13, color: p.text }}>
              {currency(subtotal, lang)}
            </Text>
          </View>
          <View style={styles.rowBetween}>
            <Text style={{ fontSize: 13, color: p.subtle }}>{t.envio}</Text>
            <Text style={{ fontSize: 13, color: p.text }}>{currency(envio, lang)}</Text>
          </View>
          <View style={styles.rowBetween}>
            <Text style={{ fontSize: 13, color: p.subtle }}>{t.iva}</Text>
            <Text style={{ fontSize: 13, color: p.text }}>{currency(iva, lang)}</Text>
          </View>
          <View style={[styles.rowBetween, { marginTop: 8 }]}>
            <Text style={{ fontSize: 15, fontWeight: '900', color: p.text }}>
              {t.total}
            </Text>
            <Text style={{ fontSize: 18, fontWeight: '900', color: p.primary }}>
              {currency(total, lang)}
            </Text>
          </View>
        </View>

        {/* Info pedido */}
        <View
          style={[
            styles.card,
            { backgroundColor: p.surface, borderColor: p.border },
          ]}
        >
          <Text style={[styles.cardTitle, { color: p.text }]}>{t.infoTitle}</Text>
          <View style={[styles.rowBetween, { marginTop: 8 }]}>
            <Text style={{ fontSize: 12, color: p.subtle }}>{t.pedido}</Text>
            <Text style={{ fontSize: 12, color: p.text }}>
              #{order?.numero_pedido || pedidoId}
            </Text>
          </View>
          <View style={[styles.rowBetween, { marginTop: 4 }]}>
            <Text style={{ fontSize: 12, color: p.subtle }}>{t.creado}</Text>
            <Text style={{ fontSize: 12, color: p.text }}>
              {formatFecha(order?.createdAt, lang, t.fechaNoDisponible)}
            </Text>
          </View>
          {!!order?.tipo_envio && (
            <View style={[styles.rowBetween, { marginTop: 4 }]}>
              <Text style={{ fontSize: 12, color: p.subtle }}>{t.envioLabel}</Text>
              <Text style={{ fontSize: 12, color: p.text }}>
                {order.tipo_envio === 'click_collect'
                  ? t.clickCollect
                  : t.aDomicilio}
              </Text>
            </View>
          )}
        </View>

        {/* Acciones */}
        {puedeCancelar && (
          <TouchableOpacity
            onPress={confirmarCancelar}
            disabled={cancelando}
            activeOpacity={0.85}
            style={[styles.dangerBtn, { opacity: cancelando ? 0.6 : 1 }]}
          >
            {cancelando ? (
              <ActivityIndicator color="#991B1B" />
            ) : (
              <>
                <Feather name="x-circle" size={16} color="#991B1B" />
                <Text style={styles.dangerBtnText}>{t.cancelar}</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 16, fontWeight: '900' },
  headerSub: { fontSize: 11, marginTop: 2 },
  statusPillHeader: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  statusPillHeaderText: { fontSize: 10, fontWeight: '900' },

  scrollContent: {
    padding: 16,
    paddingBottom: 32,
    gap: 12,
  },

  alert: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  alertTitle: { fontSize: 14, fontWeight: '900' },
  alertSub: { fontSize: 12, marginTop: 2, lineHeight: 17 },

  oxxoCard: {
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 14,
  },
  oxxoRefBig: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 3,
    marginTop: 2,
    color: '#B91C1C',
    fontFamily: 'monospace',
  },
  oxxoBtnBig: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#C2410C',
  },
  oxxoBtnBigText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '900',
  },

  // ⭐ Botón de factura PDF
  facturaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginTop: 10,
    backgroundColor: '#7C2D12',
    minHeight: 46,
  },
  facturaBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '900',
  },

  card: {
    padding: 14,
    borderWidth: 1,
    borderRadius: 16,
  },
  cardTitle: { fontSize: 14, fontWeight: '900' },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },

  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
  },
  itemImgBox: {
    width: 52,
    height: 52,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },

  dangerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#FCA5A5',
    backgroundColor: '#FEE2E2',
  },
  dangerBtnText: {
    color: '#991B1B',
    fontSize: 14,
    fontWeight: '900',
  },

  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  primaryBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '900',
  },

  center: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    gap: 10,
  },
  emptyTitle: { fontSize: 17, fontWeight: '900', textAlign: 'center' },
  emptySub: { fontSize: 13, textAlign: 'center', lineHeight: 19 },
});