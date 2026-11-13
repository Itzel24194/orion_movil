// src/screens/OrdersScreen.js
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '../i18n/ui';
import { useFocusEffect } from '@react-navigation/native';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { getCurrentUser, fetchOrders } from '../services/api';
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
    title: 'Mis solicitudes',
    subtitleOne: 'solicitud',
    subtitleMany: 'solicitudes',
    loading: 'Cargando solicitudes...',
    refresh: 'Refrescar',
    back: 'Atrás',

    filtros: {
      todos: 'Todos',
      pendiente: 'Pendientes',
      confirmado: 'Confirmados',
      enviado: 'Enviados',
      entregado: 'Entregados',
      cancelado: 'Cancelados',
    },

    paymentLabels: {
      pagado: 'Pagado',
      pendiente: 'Pago pendiente',
      rechazado: 'Pago rechazado',
      reembolsado: 'Reembolsado',
      cancelado: 'Pago cancelado',
      '': 'Sin pago registrado',
    },

    statusLabels: {
      pendiente: 'PENDIENTE',
      confirmado: 'CONFIRMADO',
      preparando: 'PREPARANDO',
      enviado: 'ENVIADO',
      entregado: 'ENTREGADO',
      cancelado: 'CANCELADO',
    },

    orderId: 'Pedido',
    fechaPendiente: 'Fecha pendiente',
    sinArticulos: 'Sin artículos',
    importeEstimado: 'Importe estimado',
    verDetalle: 'Ver detalle',

    oxxoTitle: 'Referencia OXXO',
    oxxoGenerating: 'Generando...',
    oxxoVence: 'Vence',
    oxxoDescargar: 'Descargar voucher',
    oxxoDescargando: 'Descargando...',
    facturaPDF: 'Factura PDF',
    facturaDescargando: 'Descargando...',

    errorTitle: 'No se pudo consultar el servidor.',
    errorSub: 'Verifica tu conexión e inicia sesión de nuevo.',
    emptyTitle: 'Aún no hay solicitudes.',
    emptySub: 'Podrás consultarlas después de registrar una solicitud.',

    noVoucherTitle: 'No se pudo descargar el voucher',
    noFacturaTitle: 'No se pudo descargar la factura',
    retryLater: 'Intenta de nuevo más tarde.',
    downloadOk: 'Voucher descargado',
    invoiceOk: 'Factura descargada',
  },
  en: {
    title: 'My orders',
    subtitleOne: 'order',
    subtitleMany: 'orders',
    loading: 'Loading orders...',
    refresh: 'Refresh',
    back: 'Back',

    filtros: {
      todos: 'All',
      pendiente: 'Pending',
      confirmado: 'Confirmed',
      enviado: 'Shipped',
      entregado: 'Delivered',
      cancelado: 'Cancelled',
    },

    paymentLabels: {
      pagado: 'Paid',
      pendiente: 'Payment pending',
      rechazado: 'Payment rejected',
      reembolsado: 'Refunded',
      cancelado: 'Payment cancelled',
      '': 'No payment registered',
    },

    statusLabels: {
      pendiente: 'PENDING',
      confirmado: 'CONFIRMED',
      preparando: 'PREPARING',
      enviado: 'SHIPPED',
      entregado: 'DELIVERED',
      cancelado: 'CANCELLED',
    },

    orderId: 'Order',
    fechaPendiente: 'Date pending',
    sinArticulos: 'No items',
    importeEstimado: 'Estimated total',
    verDetalle: 'View details',

    oxxoTitle: 'OXXO reference',
    oxxoGenerating: 'Generating...',
    oxxoVence: 'Expires',
    oxxoDescargar: 'Download voucher',
    oxxoDescargando: 'Downloading...',
    facturaPDF: 'Invoice PDF',
    facturaDescargando: 'Downloading...',

    errorTitle: 'Could not reach the server.',
    errorSub: 'Check your connection and sign in again.',
    emptyTitle: 'No orders yet.',
    emptySub: 'You will see them here after placing an order.',

    noVoucherTitle: 'Could not download voucher',
    noFacturaTitle: 'Could not download invoice',
    retryLater: 'Please try again later.',
    downloadOk: 'Voucher downloaded',
    invoiceOk: 'Invoice downloaded',
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

const formatFecha = (iso, lang = 'es', fechaPendiente = 'Fecha pendiente') => {
  if (!iso) return fechaPendiente;
  try {
    return new Date(iso).toLocaleDateString(lang === 'en' ? 'en-US' : 'es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return fechaPendiente;
  }
};

const COLOR_ESTADO = {
  pendiente: { bg: '#FEF3C7', fg: '#B45309' },
  confirmado: { bg: '#DBEAFE', fg: '#1E40AF' },
  preparando: { bg: '#E0E7FF', fg: '#4338CA' },
  enviado: { bg: '#E0F2FE', fg: '#0369A1' },
  entregado: { bg: '#D1FAE5', fg: '#065F46' },
  cancelado: { bg: '#FEE2E2', fg: '#991B1B' },
};

const ICONO_ESTADO = {
  pendiente: 'clock',
  confirmado: 'check-circle',
  preparando: 'package',
  enviado: 'truck',
  entregado: 'check-circle',
  cancelado: 'x-circle',
};

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

  if (result.status === 404) throw new Error('Pedido no encontrado');
  if (result.status === 400) throw new Error('Este pedido no es de OXXO');
  if (result.status !== 200) {
    throw new Error(`No se pudo generar el voucher (${result.status})`);
  }

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(result.uri, {
      mimeType: 'application/pdf',
      dialogTitle: 'Voucher OXXO',
    });
  } else {
    Alert.alert('✅', t?.downloadOk || 'Voucher descargado');
  }
}

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

  if (result.status === 404) throw new Error('Pedido no encontrado');
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
    Alert.alert('✅', t?.invoiceOk || 'Factura descargada');
  }
}

export default function OrdersScreen({ navigation }) {
  const prefs = usePreferences() || {};
  const p = prefs.palette || {};
  const lang = getLang(prefs.language);
  const t = T[lang];

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [filtro, setFiltro] = useState('todos');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(5);
  const [descargandoId, setDescargandoId] = useState(null);
  const [descargandoFacturaId, setDescargandoFacturaId] = useState(null);

  const load = useCallback(async () => {
    const user = await getCurrentUser();
    if (!user) {
      setLoading(false);
      setOrders([]);
      return;
    }
    setLoading(true);
    setError(false);
    try {
      const list = await fetchOrders();
      const ordenados = [...list].sort(
        (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
      );
      setOrders(ordenados);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const conteos = useMemo(() => {
    const base = { todos: orders.length };
    orders.forEach((o) => {
      const est = String(o.status || 'pendiente').toLowerCase();
      base[est] = (base[est] || 0) + 1;
    });
    return base;
  }, [orders]);

  const filtrados = useMemo(() => {
    if (filtro === 'todos') return orders;
    return orders.filter(
      (o) => String(o.status || 'pendiente').toLowerCase() === filtro
    );
  }, [orders, filtro]);

  const total = filtrados.length;
  const totalPages =
    perPage === 0 || total === 0 ? 1 : Math.ceil(total / perPage);
  const pageActual = Math.min(page, totalPages);
  const inicio = perPage === 0 ? 0 : (pageActual - 1) * perPage;
  const fin = perPage === 0 ? total : Math.min(inicio + perPage, total);

  const paginaItems = useMemo(() => {
    if (perPage === 0) return filtrados;
    return filtrados.slice(inicio, fin);
  }, [filtrados, inicio, fin, perPage]);

  const irPagina = (n) => {
    const next = Math.max(1, Math.min(n, totalPages));
    setPage(next);
  };

  const cambiarFiltro = (key) => {
    setFiltro(key);
    setPage(1);
  };

  const abrirDetalle = (order) => {
    if (!order || !order.id) return;
    navigation.navigate('OrderDetail', { order });
  };

  // ⭐ Descargar voucher OXXO en PDF desde Express
  const descargarVoucher = async (order) => {
    try {
      setDescargandoId(order.id);
      await descargarVoucherPDF(order.id, t);
    } catch (e) {
      Alert.alert(
        t.noVoucherTitle,
        e?.message || t.retryLater
      );
    } finally {
      setDescargandoId(null);
    }
  };

  // ⭐ Descargar factura fiscal en PDF desde Express
  const descargarFactura = async (order) => {
    try {
      setDescargandoFacturaId(order.id);
      await descargarFacturaPDF(order.id, t);
    } catch (e) {
      Alert.alert(
        t.noFacturaTitle,
        e?.message || t.retryLater
      );
    } finally {
      setDescargandoFacturaId(null);
    }
  };

  const renderOrder = ({ item }) => {
    const estado = String(item.status || 'pendiente').toLowerCase();
    const colors = COLOR_ESTADO[estado] || COLOR_ESTADO.pendiente;
    const iconName = ICONO_ESTADO[estado] || 'clock';
    const labelEstado = t.statusLabels[estado] || t.statusLabels.pendiente;

    const itemsTexto =
      item.items && item.items.length
        ? item.items
            .map((x) => `${x.quantity || 1}× ${x.name || (lang === 'en' ? 'Item' : 'Artículo')}`)
            .join(', ')
        : t.sinArticulos;

    const pagoRaw = String(item.paymentStatus || '').toLowerCase();
    const labelPago = t.paymentLabels[pagoRaw] || t.paymentLabels[''];
    const pagoEsPagado = pagoRaw === 'pagado';

    const esOxxo = String(item.metodo_pago || '').toLowerCase() === 'oxxo';
    const tieneVoucher = !!item.oxxo_voucher_url;
    const mostrarOxxo = esOxxo && !pagoEsPagado && estado !== 'cancelado';
    const bajandoVoucher = descargandoId === item.id;
    const bajandoFactura = descargandoFacturaId === item.id;

    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => abrirDetalle(item)}
        style={[
          styles.card,
          { backgroundColor: p.surface, borderColor: p.border },
        ]}
      >
        <View style={styles.rowBetween}>
          <Text style={[styles.orderId, { color: p.subtle }]}>
            {t.orderId} #{String(item.id || '').slice(0, 8).toUpperCase()}
          </Text>
          <View style={[styles.statusPill, { backgroundColor: colors.bg }]}>
            <Feather name={iconName} size={11} color={colors.fg} />
            <Text style={[styles.statusPillText, { color: colors.fg }]}>
              {labelEstado}
            </Text>
          </View>
        </View>

        <Text style={[styles.itemsText, { color: p.text }]} numberOfLines={2}>
          {itemsTexto}
        </Text>

        <Text style={[styles.metaText, { color: p.subtle }]}>
          <Feather name="calendar" size={11} color={p.subtle} />{' '}
          {formatFecha(item.createdAt, lang, t.fechaPendiente)} · {labelPago}
          {pagoEsPagado ? ' ✓' : ''}
        </Text>

        <View style={[styles.rowBetween, { marginTop: 12 }]}>
          <Text style={[styles.totalLabel, { color: p.subtle }]}>
            {t.importeEstimado}
          </Text>
          <Text style={[styles.totalAmount, { color: p.text }]}>
            {currency(item.totalEstimado, lang)}
          </Text>
        </View>

        {/* ⭐ Bloque OXXO */}
        {mostrarOxxo && (
          <View
            style={[
              styles.oxxoBox,
              { backgroundColor: '#FFF7ED', borderColor: '#FDBA74' },
            ]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <MaterialCommunityIcons
                name="storefront-outline"
                size={18}
                color="#C2410C"
              />
              <Text style={{ color: '#7C2D12', fontWeight: '900', fontSize: 12 }}>
                {t.oxxoTitle}
              </Text>
            </View>
            <Text style={[styles.oxxoRef, { color: '#B91C1C' }]} numberOfLines={1}>
              {item.oxxo_referencia || t.oxxoGenerating}
            </Text>
            {!!item.oxxo_vence && (
              <Text style={{ color: '#7C2D12', fontSize: 11, marginTop: 2 }}>
                {t.oxxoVence}: {new Date(item.oxxo_vence).toLocaleDateString(lang === 'en' ? 'en-US' : 'es-MX')}
              </Text>
            )}

            {/* Botón: Descargar voucher (solo si hay voucher) */}
            {tieneVoucher && (
              <TouchableOpacity
                onPress={() => descargarVoucher(item)}
                disabled={bajandoVoucher}
                activeOpacity={0.85}
                style={[
                  styles.oxxoBtn,
                  {
                    marginTop: 8,
                    borderColor: '#C2410C',
                    backgroundColor: '#C2410C',
                    opacity: bajandoVoucher ? 0.6 : 1,
                  },
                ]}
              >
                {bajandoVoucher ? (
                  <>
                    <ActivityIndicator color="#FFF" size="small" />
                    <Text
                      style={{
                        color: '#FFF',
                        fontWeight: '900',
                        fontSize: 12,
                        marginLeft: 6,
                      }}
                    >
                      {t.oxxoDescargando}
                    </Text>
                  </>
                ) : (
                  <>
                    <MaterialCommunityIcons
                      name="download"
                      size={14}
                      color="#FFF"
                    />
                    <Text
                      style={{
                        color: '#FFF',
                        fontWeight: '900',
                        fontSize: 12,
                        marginLeft: 6,
                      }}
                    >
                      {t.oxxoDescargar}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {/* Botón: Factura PDF */}
            <TouchableOpacity
              onPress={() => descargarFactura(item)}
              disabled={bajandoFactura}
              activeOpacity={0.85}
              style={[
                styles.oxxoBtn,
                {
                  marginTop: 8,
                  borderColor: '#7C2D12',
                  backgroundColor: '#7C2D12',
                  opacity: bajandoFactura ? 0.6 : 1,
                },
              ]}
            >
              {bajandoFactura ? (
                <>
                  <ActivityIndicator color="#FFF" size="small" />
                  <Text
                    style={{
                      color: '#FFF',
                      fontWeight: '900',
                      fontSize: 12,
                      marginLeft: 6,
                    }}
                  >
                    {t.facturaDescargando}
                  </Text>
                </>
              ) : (
                <>
                  <Feather name="file-text" size={14} color="#FFF" />
                  <Text
                    style={{
                      color: '#FFF',
                      fontWeight: '900',
                      fontSize: 12,
                      marginLeft: 6,
                    }}
                  >
                    {t.facturaPDF}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.btnSecondary, { borderColor: p.border }]}
            onPress={() => abrirDetalle(item)}
            activeOpacity={0.85}
          >
            <Feather name="eye" size={14} color={p.primary} />
            <Text style={[styles.btnSecondaryText, { color: p.primary }]}>
              {t.verDetalle}
            </Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => {
    if (loading) return null;
    return (
      <View style={styles.center}>
        <Ionicons
          name={error ? 'alert-circle-outline' : 'receipt-outline'}
          size={46}
          color={p.subtle}
        />
        <Text style={[styles.emptyTitle, { color: p.text }]}>
          {error ? t.errorTitle : t.emptyTitle}
        </Text>
        <Text style={[styles.emptySub, { color: p.subtle }]}>
          {error ? t.errorSub : t.emptySub}
        </Text>
      </View>
    );
  };

  const renderPaginacion = () => {
    if (total === 0) return null;
    if (perPage === 0 || totalPages <= 1) return null;

    return (
      <View style={styles.pagination}>
        <TouchableOpacity
          onPress={() => irPagina(pageActual - 1)}
          disabled={pageActual === 1}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={{ opacity: pageActual === 1 ? 0.3 : 1 }}
        >
          <Feather name="chevron-left" size={22} color={p.text} />
        </TouchableOpacity>

        <Text style={[styles.pageIndicator, { color: p.text }]}>
          {pageActual} / {totalPages}
        </Text>

        <TouchableOpacity
          onPress={() => irPagina(pageActual + 1)}
          disabled={pageActual === totalPages}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={{ opacity: pageActual === totalPages ? 0.3 : 1 }}
        >
          <Feather name="chevron-right" size={22} color={p.text} />
        </TouchableOpacity>
      </View>
    );
  };

  const filtros = useMemo(
    () => [
      { key: 'todos', label: t.filtros.todos },
      { key: 'pendiente', label: t.filtros.pendiente },
      { key: 'confirmado', label: t.filtros.confirmado },
      { key: 'enviado', label: t.filtros.enviado },
      { key: 'entregado', label: t.filtros.entregado },
      { key: 'cancelado', label: t.filtros.cancelado },
    ],
    [t]
  );

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
          <Text style={[styles.title, { color: p.text }]}>{t.title}</Text>
          <Text style={[styles.subtitle, { color: p.subtle }]}>
            {orders.length}{' '}
            {orders.length === 1 ? t.subtitleOne : t.subtitleMany}
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.iconBtn, { backgroundColor: p.surface }]}
          onPress={load}
          accessibilityLabel={t.refresh}
        >
          <Ionicons name="refresh" size={20} color={p.primary} />
        </TouchableOpacity>
      </View>

      <View style={{ backgroundColor: p.background }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtrosContent}
        >
          {filtros.map((f) => {
            const activo = filtro === f.key;
            const count = conteos[f.key] || 0;
            return (
              <TouchableOpacity
                key={f.key}
                onPress={() => cambiarFiltro(f.key)}
                activeOpacity={0.85}
                style={[
                  styles.filtroChip,
                  {
                    backgroundColor: activo ? p.primary : p.surface,
                    borderColor: activo ? p.primary : p.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.filtroChipText,
                    { color: activo ? '#FFF' : p.text },
                  ]}
                >
                  {f.label}
                </Text>
                <View
                  style={[
                    styles.filtroCount,
                    {
                      backgroundColor: activo
                        ? 'rgba(255,255,255,0.28)'
                        : p.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.filtroCountText,
                      { color: activo ? '#FFF' : p.text },
                    ]}
                  >
                    {count}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {loading && !orders.length ? (
        <View style={styles.center}>
          <ActivityIndicator color={p.primary} />
          <Text style={{ color: p.subtle, marginTop: 12 }}>{t.loading}</Text>
        </View>
      ) : (
        <FlatList
          data={paginaItems}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderOrder}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: 24,
            flexGrow: 1,
          }}
          ListEmptyComponent={renderEmpty}
          ListFooterComponent={renderPaginacion}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={load}
              tintColor={p.primary}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
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
  title: { fontSize: 18, fontWeight: '900' },
  subtitle: { fontSize: 12, marginTop: 2 },

  filtrosContent: {
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  filtroChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1.5,
  },
  filtroChipText: { fontSize: 12, fontWeight: '800' },
  filtroCount: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 999,
    minWidth: 20,
    alignItems: 'center',
  },
  filtroCountText: { fontSize: 10, fontWeight: '900' },

  card: {
    padding: 16,
    borderWidth: 1,
    borderRadius: 18,
    marginBottom: 12,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  orderId: { fontSize: 12, fontWeight: '700' },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusPillText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.4 },

  itemsText: {
    fontSize: 14,
    fontWeight: '800',
    marginTop: 12,
    lineHeight: 20,
  },
  metaText: { fontSize: 12, marginTop: 8 },

  totalLabel: { fontSize: 12, fontWeight: '600' },
  totalAmount: { fontSize: 17, fontWeight: '900' },

  oxxoBox: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
    gap: 4,
  },
  oxxoRef: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 2,
    marginTop: 4,
    fontFamily: 'monospace',
  },
  oxxoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
  },

  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
  },
  btnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1.5,
  },
  btnSecondaryText: { fontSize: 12, fontWeight: '800' },

  center: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    gap: 10,
  },
  emptyTitle: { fontSize: 17, fontWeight: '900', textAlign: 'center' },
  emptySub: { fontSize: 13, textAlign: 'center', lineHeight: 19 },

  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 28,
    paddingVertical: 18,
  },
  pageIndicator: {
    fontSize: 14,
    fontWeight: '900',
    minWidth: 50,
    textAlign: 'center',
  },
});