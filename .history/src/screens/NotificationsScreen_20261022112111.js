// src/screens/NotificationsScreen.js
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
import { useFocusEffect } from '@react-navigation/native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { Text } from '../i18n/ui';
import { usePreferences } from '../context/PreferencesContext';
import {
  request,
  loadSession,
  fetchMe,
  isAdmin,
} from '../services/api';

const API_PREFIX = '/api/v1';
const CUENTA_BASE = `${API_PREFIX}/cuenta`;

// ================================================================
// ⭐ INTERNACIONALIZACIÓN (ES/EN)
// ================================================================
const T = {
  es: {
    title: 'Notificaciones',
    subtitleOne: 'notificación',
    subtitleMany: 'notificaciones',
    loading: 'Cargando notificaciones...',

    filtros: {
      todas: 'Todas',
      no_leidas: 'No leídas',
      leidas: 'Leídas',
    },

    markAllTitle: 'Marcar todas como leídas',
    markAllSub: (n) => `¿Marcar las ${n} notificaciones como leídas?`,
    markAllCancel: 'Cancelar',
    markAllConfirm: 'Marcar todas',
    markAllBtn: 'Marcar todas',

    // Fechas relativas
    ahora: 'Ahora',
    haceMin: (n) => `Hace ${n} min`,
    haceH: (n) => `Hace ${n} h`,
    haceDia: (n) => `Hace ${n} día`,
    haceDias: (n) => `Hace ${n} días`,
    // Formato absoluto
    locale: 'es-MX',

    // Defaults
    defaultTitulo: 'Notificación',

    // Empty states
    errorTitle: 'No se pudieron cargar las notificaciones.',
    errorSub: 'Verifica tu conexión e intenta de nuevo.',
    emptySinLeer: 'No tienes notificaciones sin leer.',
    emptyLeidas: 'Aún no has leído ninguna notificación.',
    emptyTodas: 'Aún no tienes notificaciones.',
    emptySubGeneral:
      'Aquí verás novedades de tus pedidos, pagos y promociones.',
    actualizar: 'Actualizar',

    back: 'Atrás',
    refresh: 'Refrescar',
  },
  en: {
    title: 'Notifications',
    subtitleOne: 'notification',
    subtitleMany: 'notifications',
    loading: 'Loading notifications...',

    filtros: {
      todas: 'All',
      no_leidas: 'Unread',
      leidas: 'Read',
    },

    markAllTitle: 'Mark all as read',
    markAllSub: (n) => `Mark ${n} notifications as read?`,
    markAllCancel: 'Cancel',
    markAllConfirm: 'Mark all',
    markAllBtn: 'Mark all',

    ahora: 'Now',
    haceMin: (n) => `${n} min ago`,
    haceH: (n) => `${n} h ago`,
    haceDia: (n) => `${n} day ago`,
    haceDias: (n) => `${n} days ago`,
    locale: 'en-US',

    defaultTitulo: 'Notification',

    errorTitle: 'Could not load notifications.',
    errorSub: 'Check your connection and try again.',
    emptySinLeer: 'You have no unread notifications.',
    emptyLeidas: 'You have not read any notification yet.',
    emptyTodas: 'You have no notifications yet.',
    emptySubGeneral:
      'You will see updates about your orders, payments and promotions here.',
    actualizar: 'Refresh',

    back: 'Back',
    refresh: 'Refresh',
  },
};

const getLang = (language) => {
  const l = String(language || 'es').toLowerCase();
  return l.startsWith('en') ? 'en' : 'es';
};

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
const fechaRelativa = (iso, t) => {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const now = Date.now();
    const diffMs = now - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffH = Math.floor(diffMs / 3600000);
    const diffD = Math.floor(diffMs / 86400000);

    if (diffMin < 1) return t.ahora;
    if (diffMin < 60) return t.haceMin(diffMin);
    if (diffH < 24) return t.haceH(diffH);
    if (diffD < 7) return diffD === 1 ? t.haceDia(1) : t.haceDias(diffD);
    return d.toLocaleDateString(t.locale, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '';
  }
};

const _normalizarNotificacion = (n = {}, idx = 0, t) => {
  const fecha =
    n.fecha || n.createdAt || n.created_at || n.timestamp || null;

  const leida = !!(n.leida ?? n.read ?? n.vista ?? false);

  const tipoRaw = String(n.tipo || n.type || 'sistema').toLowerCase();
  let tipo = 'sistema';
  if (['pedido', 'order', 'compra', 'purchase'].includes(tipoRaw)) tipo = 'pedido';
  else if (['pago', 'payment', 'cobro'].includes(tipoRaw)) tipo = 'pago';
  else if (['promo', 'promocion', 'promoción', 'oferta', 'descuento'].includes(tipoRaw)) tipo = 'promo';
  else if (['sistema', 'system', 'info'].includes(tipoRaw)) tipo = 'sistema';
  else tipo = tipoRaw;

  return {
    id: String(n.id || n._id || n.notif_id || `notif-${idx}`),
    titulo: n.titulo || n.title || n.asunto || (t?.defaultTitulo || 'Notificación'),
    mensaje: n.mensaje || n.message || n.body || n.descripcion || n.texto || '',
    tipo,
    leida,
    fecha,
    fechaTexto: fechaRelativa(fecha, t),
    link: n.link || n.url || n.action_url || null,
    data: n.data || {},
  };
};

const ICONO_TIPO = {
  pedido: { icon: 'package', bg: '#DBEAFE', fg: '#1E40AF' },
  pago: { icon: 'credit-card', bg: '#D1FAE5', fg: '#065F46' },
  promo: { icon: 'tag', bg: '#FEF3C7', fg: '#B45309' },
  sistema: { icon: 'bell', bg: '#E0E7FF', fg: '#4338CA' },
};

// ─────────────────────────────────────────────────────────────
// API
// ─────────────────────────────────────────────────────────────
async function fetchNotificaciones(t) {
  // 1) Endpoint dedicado
  try {
    const data = await request(`${CUENTA_BASE}/notificaciones`);
    const raw =
      (Array.isArray(data?.notificaciones) && data.notificaciones) ||
      (Array.isArray(data?.data) && data.data) ||
      (Array.isArray(data) && data) ||
      [];
    return raw.map((n, i) => _normalizarNotificacion(n, i, t));
  } catch {}

  // 2) Fallback: user.notificaciones desde /auth/me
  try {
    const me = await fetchMe();
    const arr = Array.isArray(me?.notificaciones) ? me.notificaciones : [];
    return arr.map((n, i) => _normalizarNotificacion(n, i, t));
  } catch {
    return [];
  }
}

async function marcarLeidaAPI(id) {
  if (!id) return;
  try {
    await request(`${CUENTA_BASE}/notificaciones/${encodeURIComponent(id)}/leida`, {
      method: 'POST',
    });
  } catch {}
}

async function marcarTodasLeidasAPI() {
  try {
    await request(`${CUENTA_BASE}/notificaciones/marcar-todas`, {
      method: 'POST',
    });
  } catch {}
}

// ─────────────────────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────────────────────
export default function NotificationsScreen({ navigation }) {
  const prefs = usePreferences() || {};
  const p = prefs.palette || {};
  const lang = getLang(prefs.language);
  const t = T[lang];

  const [notifs, setNotifs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [filtro, setFiltro] = useState('todas');
  const [marcandoTodas, setMarcandoTodas] = useState(false);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      setError(false);
      try {
        const list = await fetchNotificaciones(t);
        const ordenadas = [...list].sort(
          (a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0)
        );
        setNotifs(ordenadas);
      } catch (e) {
        console.warn('[Notificaciones] load:', e?.message);
        setError(true);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [t]
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = () => {
    setRefreshing(true);
    load(true);
  };

  const noLeidas = useMemo(
    () => notifs.filter((n) => !n.leida).length,
    [notifs]
  );

  const filtradas = useMemo(() => {
    if (filtro === 'no_leidas') return notifs.filter((n) => !n.leida);
    if (filtro === 'leidas') return notifs.filter((n) => n.leida);
    return notifs;
  }, [notifs, filtro]);

  const filtros = useMemo(
    () => [
      { key: 'todas', label: t.filtros.todas },
      { key: 'no_leidas', label: t.filtros.no_leidas },
      { key: 'leidas', label: t.filtros.leidas },
    ],
    [t]
  );

  const abrir = async (n) => {
    if (!n.leida) {
      setNotifs((prev) =>
        prev.map((x) => (x.id === n.id ? { ...x, leida: true } : x))
      );
      marcarLeidaAPI(n.id);
    }

    // Si trae link, navega (ajusta según tus rutas)
    if (n.link) {
      try {
        if (n.link.startsWith('/pedido/')) {
          const orderId = n.link.replace('/pedido/', '');
          navigation.navigate('OrderDetail', { orderId });
        } else if (n.link.startsWith('/producto/')) {
          const prodId = n.link.replace('/producto/', '');
          navigation.navigate('ProductDetail', { id: prodId });
        } else if (n.link === '/carrito') {
          navigation.navigate('Cart');
        } else if (n.link === '/favoritos') {
          navigation.navigate('Favorites');
        }
      } catch (e) {
        console.warn('[Notificaciones] navegar:', e?.message);
      }
    }
  };

  const marcarTodas = () => {
    if (noLeidas === 0 || marcandoTodas) return;

    Alert.alert(
      t.markAllTitle,
      t.markAllSub(noLeidas),
      [
        { text: t.markAllCancel, style: 'cancel' },
        {
          text: t.markAllConfirm,
          onPress: async () => {
            setMarcandoTodas(true);
            setNotifs((prev) => prev.map((n) => ({ ...n, leida: true })));
            await marcarTodasLeidasAPI();
            setMarcandoTodas(false);
          },
        },
      ]
    );
  };

  const renderItem = ({ item }) => {
    const meta = ICONO_TIPO[item.tipo] || ICONO_TIPO.sistema;
    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => abrir(item)}
        style={[
          styles.card,
          {
            backgroundColor: item.leida ? p.surface : `${p.primary}08`,
            borderColor: item.leida ? p.border : `${p.primary}40`,
            borderWidth: item.leida ? 1 : 1.5,
          },
        ]}
      >
        <View style={[styles.iconWrap, { backgroundColor: meta.bg }]}>
          <Feather name={meta.icon} size={18} color={meta.fg} />
        </View>

        <View style={{ flex: 1 }}>
          <View style={styles.rowBetween}>
            <Text
              style={[
                styles.titulo,
                { color: p.text, fontWeight: item.leida ? '700' : '900' },
              ]}
              numberOfLines={2}
            >
              {item.titulo}
            </Text>
            {!item.leida && (
              <View style={[styles.dot, { backgroundColor: p.primary }]} />
            )}
          </View>

          {!!item.mensaje && (
            <Text
              style={[styles.mensaje, { color: p.subtle }]}
              numberOfLines={3}
            >
              {item.mensaje}
            </Text>
          )}

          {!!item.fechaTexto && (
            <Text style={[styles.fecha, { color: p.subtle }]}>
              <Feather name="clock" size={11} color={p.subtle} />{' '}
              {item.fechaTexto}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => {
    if (loading) return null;

    let titulo = t.emptyTodas;
    if (error) titulo = t.errorTitle;
    else if (filtro === 'no_leidas') titulo = t.emptySinLeer;
    else if (filtro === 'leidas') titulo = t.emptyLeidas;

    return (
      <View style={styles.center}>
        <Ionicons
          name={error ? 'alert-circle-outline' : 'notifications-outline'}
          size={46}
          color={p.subtle}
        />
        <Text style={[styles.emptyTitle, { color: p.text }]}>
          {titulo}
        </Text>
        <Text style={[styles.emptySub, { color: p.subtle }]}>
          {error ? t.errorSub : t.emptySubGeneral}
        </Text>

        {!error && noLeidas === 0 && notifs.length > 0 && (
          <TouchableOpacity
            style={[styles.btnPrimary, { backgroundColor: p.primary }]}
            onPress={onRefresh}
            activeOpacity={0.85}
          >
            <Feather name="refresh-cw" size={16} color="#FFF" />
            <Text style={styles.btnPrimaryText}>{t.actualizar}</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView
      style={[styles.page, { backgroundColor: p.background }]}
      edges={['top', 'left', 'right']}
    >
      {/* Header */}
      <View
        style={[
          styles.header,
          { backgroundColor: p.background, borderBottomColor: p.border },
        ]}
      >
        <TouchableOpacity
          style={[styles.iconBtn, { backgroundColor: p.surface, borderColor: p.border }]}
          onPress={() => navigation.goBack()}
          accessibilityLabel={t.back}
        >
          <Feather name="arrow-left" size={20} color={p.text} />
        </TouchableOpacity>

        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={[styles.title, { color: p.text }]}>{t.title}</Text>
            {noLeidas > 0 && (
              <View style={[styles.badge, { backgroundColor: p.primary }]}>
                <Text style={styles.badgeText}>
                  {noLeidas > 99 ? '99+' : noLeidas}
                </Text>
              </View>
            )}
          </View>
          <Text style={[styles.subtitle, { color: p.subtle }]}>
            {notifs.length}{' '}
            {notifs.length === 1 ? t.subtitleOne : t.subtitleMany}
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.iconBtn, { backgroundColor: p.surface, borderColor: p.border }]}
          onPress={onRefresh}
          accessibilityLabel={t.refresh}
        >
          <Ionicons name="refresh" size={20} color={p.primary} />
        </TouchableOpacity>
      </View>

      {/* Filtros + acción "Marcar todas" */}
      <View
        style={[
          styles.filtrosBar,
          { backgroundColor: p.background, borderBottomColor: p.border },
        ]}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingRight: 8, flexGrow: 1 }}
        >
          {filtros.map((f) => {
            const activo = filtro === f.key;
            const count =
              f.key === 'no_leidas'
                ? noLeidas
                : f.key === 'leidas'
                ? notifs.length - noLeidas
                : notifs.length;

            return (
              <TouchableOpacity
                key={f.key}
                onPress={() => setFiltro(f.key)}
                activeOpacity={0.85}
                style={[
                  styles.chip,
                  {
                    backgroundColor: activo ? p.primary : p.surface,
                    borderColor: activo ? p.primary : p.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    { color: activo ? '#FFF' : p.text },
                  ]}
                >
                  {f.label}
                </Text>
                <View
                  style={[
                    styles.chipCount,
                    {
                      backgroundColor: activo ? 'rgba(255,255,255,0.28)' : p.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.chipCountText,
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

        {noLeidas > 0 && (
          <TouchableOpacity
            onPress={marcarTodas}
            disabled={marcandoTodas}
            style={[styles.markAllBtn, { opacity: marcandoTodas ? 0.6 : 1 }]}
          >
            {marcandoTodas ? (
              <ActivityIndicator size="small" color={p.primary} />
            ) : (
              <>
                <Feather name="check-circle" size={13} color={p.primary} />
                <Text style={[styles.markAllText, { color: p.primary }]}>
                  {t.markAllBtn}
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Lista */}
      {loading && !notifs.length ? (
        <View style={styles.center}>
          <ActivityIndicator color={p.primary} />
          <Text style={{ color: p.subtle, marginTop: 12 }}>
            {t.loading}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtradas}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: 30,
            flexGrow: 1,
            gap: 10,
          }}
          ListEmptyComponent={renderEmpty}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
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
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 18, fontWeight: '900' },
  subtitle: { fontSize: 12, marginTop: 2 },
  badge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    minWidth: 22,
    alignItems: 'center',
  },
  badgeText: { color: '#FFF', fontSize: 10, fontWeight: '900' },

  filtrosBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1.5,
  },
  chipText: { fontSize: 12, fontWeight: '800' },
  chipCount: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 999,
    minWidth: 20,
    alignItems: 'center',
  },
  chipCountText: { fontSize: 10, fontWeight: '900' },

  markAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  markAllText: { fontSize: 11, fontWeight: '800' },

  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
    borderRadius: 16,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  titulo: { fontSize: 14, lineHeight: 19, flex: 1 },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
    flexShrink: 0,
  },
  mensaje: { fontSize: 12, lineHeight: 17, marginTop: 4 },
  fecha: { fontSize: 11, marginTop: 6 },

  center: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    gap: 10,
  },
  emptyTitle: { fontSize: 16, fontWeight: '900', textAlign: 'center' },
  emptySub: { fontSize: 13, textAlign: 'center', lineHeight: 19 },

  btnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 999,
    marginTop: 12,
  },
  btnPrimaryText: { color: '#FFF', fontSize: 14, fontWeight: '900' },
});