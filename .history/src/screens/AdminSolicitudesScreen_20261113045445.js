// screens/AdminSolicitudesScreen.js
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
  Modal,
  ScrollView,
  Alert,
  TextInput,
  Platform,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import {
  fetchSolicitudesAdmin,
  fetchRespuestasRapidas,
  responderSolicitud,
  eliminarSolicitud,
  request,
} from '../services/api';
import { mensajeSeguro } from '../services/errorHandler';
import { usePreferences } from '../context/PreferencesContext';

// ============================================================
// CONFIG
// ============================================================
const SOLICITUDES_BASE = '/api/v1/solicitudes';
const PER_PAGE = 6;

const FILTROS_ESTADO = [
  { key: 'todas', label: 'Todas', icon: 'inbox' },
  { key: 'pendiente', label: 'Pendientes', icon: 'clock' },
  { key: 'en_revision', label: 'En revisión', icon: 'eye' },
  { key: 'aprobada', label: 'Aprobadas', icon: 'check-circle' },
  { key: 'rechazada', label: 'Rechazadas', icon: 'x-circle' },
];

const ESTADO_CONFIG = {
  pendiente:   { color: '#D97706', bg: '#FEF3C7', icon: 'clock',  label: 'Pendiente' },
  en_revision: { color: '#2563EB', bg: '#DBEAFE', icon: 'eye',    label: 'En revisión' },
  aprobada:    { color: '#059669', bg: '#D1FAE5', icon: 'check-circle', label: 'Aprobada' },
  rechazada:   { color: '#DC2626', bg: '#FEE2E2', icon: 'x-circle', label: 'Rechazada' },
  resuelta:    { color: '#059669', bg: '#D1FAE5', icon: 'check-circle', label: 'Resuelta' },
  cancelada:   { color: '#64748B', bg: '#F1F5F9', icon: 'slash',    label: 'Cancelada' },
};

const TIPO_LABEL = {
  devolucion: 'Devolución',
  garantia: 'Garantía',
  producto_defectuoso: 'Producto defectuoso',
  otro: 'Otro',
};

// ============================================================
// PALETAS — light / dark (lila)
// ============================================================
const PALETTES = {
  light: {
    background: '#F8FAFC',
    surface: '#FFFFFF',
    surfaceAlt: '#F8FAFC',
    text: '#0F172A',
    textSecondary: '#334155',
    subtle: '#64748B',
    muted: '#94A3B8',
    border: '#EEF0F4',
    primary: '#6366F1',
    primarySoft: 'rgba(99,102,241,0.12)',
    chipBg: '#FFFFFF',
    chipBorder: '#E2E8F0',
    iconBg: '#F1F5F9',
    danger: '#DC2626',
    dangerSoft: 'rgba(220,38,38,0.08)',
    success: '#059669',
    shadow: '#0F172A',
  },
  dark: {
    background: '#0B1220',
    surface: '#111A2E',
    surfaceAlt: '#16213B',
    text: '#F8FAFC',
    textSecondary: '#E2E8F0',
    subtle: '#94A3B8',
    muted: '#64748B',
    border: '#1E293B',
    primary: '#818CF8',
    primarySoft: 'rgba(129,140,248,0.15)',
    chipBg: '#111A2E',
    chipBorder: '#1E293B',
    iconBg: '#1E293B',
    danger: '#F87171',
    dangerSoft: 'rgba(248,113,113,0.12)',
    success: '#34D399',
    shadow: '#000000',
  },
};

// ⭐ IA fallback (si el backend no da IA, generamos mensaje)
const generarRespuestaIA = (solicitud, plantillas) => {
  const txt = `${solicitud.tipo} ${solicitud.descripcion || ''}`.toLowerCase();
  const matchEstado = plantillas.filter((p) => p.estado === solicitud.estado);
  const pool = matchEstado.length > 0 ? matchEstado : plantillas;
  const pick = (id) => pool.find((p) => p.id === id) || pool[0];

  if (/foto|imagen|evidencia|adjunt/.test(txt)) return pick('pedir_fotos');
  if (/defect|roto|dañ|falla|no funciona/.test(txt)) return pick('rechazar_defecto');
  if (/devol/.test(txt)) return pick('aprobar_devolucion');
  if (/garant/.test(txt)) return pick('aprobar_garantia');
  if (/gracias|resuelt|listo/.test(txt)) return pick('resolver_cancelar');
  return pick('pedir_info_pedido') || pool[0];
};

export default function AdminSolicitudesScreen({ navigation }) {
  const prefs = usePreferences() || {};
  const mode = prefs.mode || 'system';
  const systemScheme = useColorScheme();
  const resolvedMode =
    mode === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : mode;
  const theme = useMemo(
    () => PALETTES[resolvedMode] || PALETTES.light,
    [resolvedMode]
  );
  const isDark = resolvedMode === 'dark';

  const [solicitudes, setSolicitudes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [error, setError] = useState(null);
  const [filtro, setFiltro] = useState('todas');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  // Modal responder
  const [modalAbierto, setModalAbierto] = useState(false);
  const [solicitudActual, setSolicitudActual] = useState(null);
  const [respuestasRapidas, setRespuestasRapidas] = useState([]);
  const [loadingRespuestas, setLoadingRespuestas] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [textoLibre, setTextoLibre] = useState('');
  const [generandoIA, setGenerandoIA] = useState(false);
  const [estadoNuevo, setEstadoNuevo] = useState('en_revision');

  // Modal eliminar
  const [modalEliminar, setModalEliminar] = useState(false);
  const [solicitudAEliminar, setSolicitudAEliminar] = useState(null);
  const [eliminando, setEliminando] = useState(false);

  // ----------------------------------------------------------------
  const cargar = useCallback(
    async (esRefresh = false) => {
      if (esRefresh) setRefrescando(true);
      else setLoading(true);
      setError(null);
      try {
        const data = await fetchSolicitudesAdmin({
          estado: filtro === 'todas' ? '' : filtro,
        });
        setSolicitudes(Array.isArray(data) ? data : []);
      } catch (e) {
        setError(mensajeSeguro(e));
      } finally {
        setLoading(false);
        setRefrescando(false);
      }
    },
    [filtro]
  );

  useEffect(() => {
    cargar();
  }, [cargar]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => cargar(true));
    return unsubscribe;
  }, [navigation, cargar]);

  // Reset page al filtrar o buscar
  useEffect(() => {
    setPage(1);
  }, [filtro, search]);

  // ----------------------------------------------------------------
  // Responder
  const abrirModalRespuesta = async (solicitud) => {
    setSolicitudActual(solicitud);
    setTextoLibre('');
    setEstadoNuevo(
      solicitud.estado === 'pendiente' ? 'en_revision' : solicitud.estado
    );
    setModalAbierto(true);
    setLoadingRespuestas(true);
    try {
      const lista = await fetchRespuestasRapidas({ tipo: solicitud.tipo });
      const arr = Array.isArray(lista) ? lista : [];
      setRespuestasRapidas(arr);
    } catch {
      setRespuestasRapidas([]);
    } finally {
      setLoadingRespuestas(false);
    }
  };

  const cerrarModal = () => {
    if (enviando || generandoIA) return;
    setModalAbierto(false);
    setSolicitudActual(null);
    setRespuestasRapidas([]);
    setTextoLibre('');
  };

  const aplicarRespuestaRapida = (rapida) => {
    setTextoLibre(rapida.mensaje || '');
    if (rapida.estado) setEstadoNuevo(rapida.estado);
  };

  // ⭐ Generar IA
  const generarConIA = async () => {
    if (!solicitudActual || generandoIA) return;
    setGenerandoIA(true);
    try {
      // 1) intenta endpoint IA del backend
      try {
        const r = await request(
          `${SOLICITUDES_BASE}/admin/${solicitudActual.id}/sugerir-respuesta`,
          { method: 'POST' }
        );
        const txt =
          r?.respuesta || r?.mensaje || r?.data?.respuesta || r?.sugerencia;
        if (txt && String(txt).trim().length > 10) {
          setTextoLibre(String(txt).trim());
          if (r?.estado) setEstadoNuevo(r.estado);
          return;
        }
      } catch {}
      // 2) fallback: plantillas locales
      const sugerida = generarRespuestaIA(solicitudActual, respuestasRapidas);
      if (sugerida) {
        setTextoLibre(sugerida.mensaje || '');
        if (sugerida.estado) setEstadoNuevo(sugerida.estado);
      } else {
        Alert.alert(
          'IA',
          'No se pudo generar una respuesta automática. Escribe una manualmente.'
        );
      }
    } finally {
      setGenerandoIA(false);
    }
  };

  const enviarRespuesta = async () => {
    if (!solicitudActual || enviando) return;
    const txt = textoLibre.trim();
    if (txt.length < 10) {
      Alert.alert('Atención', 'La respuesta debe tener al menos 10 caracteres.');
      return;
    }
    setEnviando(true);
    try {
      await responderSolicitud(solicitudActual.id, {
        estado: estadoNuevo,
        respuesta: txt,
      });
      setModalAbierto(false);
      setSolicitudActual(null);
      setTextoLibre('');
      cargar(true);
      Alert.alert('✅ Listo', 'La respuesta fue enviada al cliente.');
    } catch (e) {
      Alert.alert('Error', mensajeSeguro(e));
    } finally {
      setEnviando(false);
    }
  };

  // ----------------------------------------------------------------
  // Eliminar
  const pedirConfirmarEliminar = (solicitud) => {
    setSolicitudAEliminar(solicitud);
    setModalEliminar(true);
  };

  const confirmarEliminar = async () => {
    if (!solicitudAEliminar || eliminando) return;
    setEliminando(true);
    try {
      await eliminarSolicitud(solicitudAEliminar.id);
      setSolicitudes((prev) =>
        prev.filter((s) => String(s.id) !== String(solicitudAEliminar.id))
      );
      setModalEliminar(false);
      setSolicitudAEliminar(null);
    } catch (e) {
      Alert.alert('Error', mensajeSeguro(e));
    } finally {
      setEliminando(false);
    }
  };

  // ----------------------------------------------------------------
  const formatearFecha = (iso) => {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleString('es-MX', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  };

  const cfgEstado = (estado) =>
    ESTADO_CONFIG[String(estado || '').toLowerCase()] || ESTADO_CONFIG.pendiente;

  const etiquetaTipo = (tipo) =>
    TIPO_LABEL[String(tipo || '').toLowerCase()] || tipo || 'Solicitud';

  // Filtrado cliente-side + búsqueda
  const filtradas = useMemo(() => {
    let arr = solicitudes;
    if (filtro !== 'todas') {
      arr = arr.filter(
        (s) => String(s.estado || '').toLowerCase() === filtro
      );
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      arr = arr.filter(
        (s) =>
          (s.usuario_email || '').toLowerCase().includes(q) ||
          (s.descripcion || '').toLowerCase().includes(q) ||
          String(s.pedido_id || '').toLowerCase().includes(q) ||
          (TIPO_LABEL[String(s.tipo || '').toLowerCase()] || '')
            .toLowerCase()
            .includes(q)
      );
    }
    return arr;
  }, [solicitudes, filtro, search]);

  const conteos = useMemo(() => {
    const c = { todas: solicitudes.length };
    solicitudes.forEach((s) => {
      const k = String(s.estado || 'pendiente').toLowerCase();
      c[k] = (c[k] || 0) + 1;
    });
    return c;
  }, [solicitudes]);

  // ⭐ Paginación
  const totalPages = Math.max(1, Math.ceil(filtradas.length / PER_PAGE));
  const pageActual = Math.min(page, totalPages);
  const inicio = (pageActual - 1) * PER_PAGE;
  const paginaItems = filtradas.slice(inicio, inicio + PER_PAGE);

  const irPagina = (n) => setPage(Math.max(1, Math.min(n, totalPages)));

  // ----------------------------------------------------------------
  const renderItem = ({ item }) => {
    const cfg = cfgEstado(item.estado);
    const respondido = !!item.respuesta_admin;

    return (
      <View
        style={[
          styles.card,
          {
            backgroundColor: theme.surface,
            borderColor: theme.border,
            shadowColor: theme.shadow,
          },
        ]}
      >
        <View style={[styles.cardAccent, { backgroundColor: cfg.color }]} />

        <View style={styles.cardBody}>
          <View style={styles.rowBetween}>
            <View
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}
            >
              <View style={[styles.iconRound, { backgroundColor: cfg.color + '20' }]}>
                <Feather name={cfg.icon} size={16} color={cfg.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={[styles.cardTitle, { color: theme.text }]}
                  numberOfLines={1}
                >
                  {etiquetaTipo(item.tipo)}
                </Text>
                <Text
                  style={[styles.cardSub, { color: theme.subtle }]}
                  numberOfLines={1}
                >
                  {item.usuario_email || 'Cliente'} · #{item.pedido_id || '—'}
                </Text>
              </View>
            </View>

            <View
              style={[
                styles.badge,
                { backgroundColor: cfg.bg, borderColor: cfg.color + '40' },
              ]}
            >
              <View style={[styles.dot, { backgroundColor: cfg.color }]} />
              <Text style={[styles.badgeText, { color: cfg.color }]}>{cfg.label}</Text>
            </View>
          </View>

          <Text
            style={[styles.descripcion, { color: theme.text }]}
            numberOfLines={2}
          >
            {item.descripcion || ''}
          </Text>

          {!!item.respuesta_admin && (
            <View
              style={[
                styles.respuestaBox,
                {
                  borderTopColor: theme.border,
                  backgroundColor: theme.surfaceAlt,
                },
              ]}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons
                  name="chatbubble-ellipses-outline"
                  size={12}
                  color={theme.primary}
                />
                <Text
                  style={{
                    color: theme.primary,
                    fontSize: 11,
                    fontWeight: '900',
                  }}
                >
                  Tu respuesta
                </Text>
              </View>
              <Text
                style={{ color: theme.subtle, fontSize: 12, lineHeight: 17 }}
                numberOfLines={2}
              >
                {item.respuesta_admin}
              </Text>
            </View>
          )}

          <View style={[styles.cardFooter, { borderTopColor: theme.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Feather name="clock" size={11} color={theme.subtle} />
              <Text style={[styles.fecha, { color: theme.subtle }]}>
                {formatearFecha(item.fecha_creacion)}
              </Text>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <TouchableOpacity
                onPress={() => pedirConfirmarEliminar(item)}
                style={[styles.iconBtnSmall, { backgroundColor: theme.dangerSoft }]}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Feather name="trash-2" size={15} color={theme.danger} />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => abrirModalRespuesta(item)}
                style={[
                  styles.btnResponder,
                  {
                    backgroundColor: respondido ? theme.surfaceAlt : theme.primary,
                    borderColor: respondido ? theme.border : theme.primary,
                  },
                ]}
                activeOpacity={0.85}
              >
                <Feather
                  name={respondido ? 'eye' : 'message-square'}
                  size={13}
                  color={respondido ? theme.text : '#FFF'}
                />
                <Text
                  style={[
                    styles.btnResponderText,
                    { color: respondido ? theme.text : '#FFF' },
                  ]}
                >
                  {respondido ? 'Ver' : 'Responder'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    );
  };

  // ----------------------------------------------------------------
  const renderPaginacion = () => {
    if (totalPages <= 1) return null;
    const canPrev = pageActual > 1;
    const canNext = pageActual < totalPages;
    return (
      <View style={styles.pagination}>
        <TouchableOpacity
          onPress={() => irPagina(pageActual - 1)}
          disabled={!canPrev}
          style={[
            styles.pageBtn,
            { backgroundColor: canPrev ? theme.primary : theme.iconBg },
          ]}
        >
          <Ionicons
            name="chevron-back"
            size={18}
            color={canPrev ? '#FFF' : theme.muted}
          />
        </TouchableOpacity>

        <Text style={[styles.pageIndicator, { color: theme.subtle }]}>
          {pageActual} / {totalPages}
        </Text>

        <TouchableOpacity
          onPress={() => irPagina(pageActual + 1)}
          disabled={!canNext}
          style={[
            styles.pageBtn,
            { backgroundColor: canNext ? theme.primary : theme.iconBg },
          ]}
        >
          <Ionicons
            name="chevron-forward"
            size={18}
            color={canNext ? '#FFF' : theme.muted}
          />
        </TouchableOpacity>
      </View>
    );
  };

  // ----------------------------------------------------------------
  return (
    <SafeAreaView
      style={[styles.page, { backgroundColor: theme.background }]}
      edges={['top', 'left', 'right']}
    >
      {/* HEADER */}
      <View
        style={[styles.header, { borderBottomColor: theme.border }]}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={[styles.iconBtnHeader, { backgroundColor: theme.surface }]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather name="arrow-left" color={theme.text} size={22} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>
            Solicitudes de clientes
          </Text>
          <Text style={[styles.headerSub, { color: theme.subtle }]}>
            {solicitudes.length}{' '}
            {solicitudes.length === 1 ? 'solicitud' : 'solicitudes'}
            {conteos.pendiente
              ? ` · ${conteos.pendiente} pendiente${conteos.pendiente === 1 ? '' : 's'}`
              : ''}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => cargar()}
          style={[styles.iconBtnHeader, { backgroundColor: theme.surface }]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather name="refresh-cw" color={theme.primary} size={18} />
        </TouchableOpacity>
      </View>

      {/* Buscador */}
      <View
        style={[
          styles.searchWrap,
          {
            backgroundColor: theme.surface,
            borderColor: theme.border,
            marginHorizontal: 16,
            marginTop: 8,
          },
        ]}
      >
        <Feather name="search" size={16} color={theme.muted} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar por cliente, pedido o tipo…"
          placeholderTextColor={theme.muted}
          style={{ flex: 1, color: theme.text, fontSize: 13, paddingVertical: 0 }}
          autoCorrect={false}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color={theme.muted} />
          </TouchableOpacity>
        )}
      </View>

      {/* FILTROS */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filtrosContent}
      >
        {FILTROS_ESTADO.map((f) => {
          const activo = filtro === f.key;
          const count = conteos[f.key] || 0;
          return (
            <TouchableOpacity
              key={f.key}
              onPress={() => setFiltro(f.key)}
              activeOpacity={0.85}
              style={[
                styles.filtroChip,
                {
                  backgroundColor: activo ? theme.primary : theme.chipBg,
                  borderColor: activo ? theme.primary : theme.chipBorder,
                },
              ]}
            >
              <Feather
                name={f.icon}
                size={11}
                color={activo ? '#FFF' : theme.text}
              />
              <Text
                style={[
                  styles.filtroText,
                  { color: activo ? '#FFF' : theme.text },
                ]}
              >
                {f.label}
              </Text>
              {count > 0 && (
                <View
                  style={[
                    styles.countBadge,
                    {
                      backgroundColor: activo
                        ? 'rgba(255,255,255,0.28)'
                        : theme.iconBg,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.countText,
                      { color: activo ? '#FFF' : theme.text },
                    ]}
                  >
                    {count}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* LISTA */}
      {loading && solicitudes.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={{ color: theme.subtle, marginTop: 12 }}>
            Cargando solicitudes…
          </Text>
        </View>
      ) : error && solicitudes.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={48} color={theme.danger} />
          <Text
            style={{
              color: theme.danger,
              marginTop: 12,
              textAlign: 'center',
              paddingHorizontal: 24,
            }}
          >
            {error}
          </Text>
          <TouchableOpacity
            onPress={() => cargar()}
            style={[styles.btnRetry, { backgroundColor: theme.primary }]}
          >
            <Feather name="refresh-cw" size={14} color="#FFF" />
            <Text style={styles.btnRetryText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={paginaItems}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, paddingBottom: 20, flexGrow: 1 }}
          refreshControl={
            <RefreshControl
              refreshing={refrescando}
              onRefresh={() => cargar(true)}
              tintColor={theme.primary}
              colors={[theme.primary]}
            />
          }
          ListFooterComponent={renderPaginacion}
          ListEmptyComponent={
            <View style={styles.center}>
              <View
                style={[
                  styles.emptyIcon,
                  {
                    backgroundColor: theme.primarySoft,
                    borderColor: theme.primary + '30',
                  },
                ]}
              >
                <Ionicons name="inbox-outline" size={48} color={theme.primary} />
              </View>
              <Text
                style={{
                  color: theme.text,
                  fontSize: 17,
                  fontWeight: '900',
                  marginTop: 16,
                }}
              >
                Todo tranquilo por aquí
              </Text>
              <Text
                style={{
                  color: theme.subtle,
                  fontSize: 13,
                  marginTop: 8,
                  textAlign: 'center',
                  paddingHorizontal: 24,
                  lineHeight: 19,
                }}
              >
                {filtro === 'todas' && !search
                  ? 'No hay solicitudes de clientes por ahora. Cuando envíen una, aparecerá aquí.'
                  : 'No hay solicitudes que coincidan con tu filtro.'}
              </Text>
            </View>
          }
        />
      )}

      {/* ───────────── MODAL RESPONDER + IA ───────────── */}
      <Modal
        visible={modalAbierto}
        animationType="slide"
        transparent
        onRequestClose={cerrarModal}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.background }]}>
            <View style={styles.modalHandleWrap}>
              <View style={[styles.modalHandle, { backgroundColor: theme.border }]} />
            </View>

            <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.modalTitle, { color: theme.text }]}>
                  Responder solicitud
                </Text>
                <Text style={{ color: theme.subtle, fontSize: 12, marginTop: 2 }}>
                  Usa IA, plantillas o escribe tu propio mensaje
                </Text>
              </View>
              <TouchableOpacity
                onPress={cerrarModal}
                style={[styles.closeBtn, { backgroundColor: theme.surface }]}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Feather name="x" size={20} color={theme.text} />
              </TouchableOpacity>
            </View>

            {solicitudActual && (
              <View
                style={{
                  padding: 16,
                  backgroundColor: theme.surface,
                  borderBottomWidth: 1,
                  borderBottomColor: theme.border,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View
                    style={[
                      styles.iconRound,
                      { backgroundColor: cfgEstado(solicitudActual.estado).color + '20' },
                    ]}
                  >
                    <Feather
                      name={cfgEstado(solicitudActual.estado).icon}
                      size={16}
                      color={cfgEstado(solicitudActual.estado).color}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.text, fontSize: 13, fontWeight: '800' }}>
                      {etiquetaTipo(solicitudActual.tipo)}
                    </Text>
                    <Text style={{ color: theme.subtle, fontSize: 11, marginTop: 1 }}>
                      {solicitudActual.usuario_email || 'Cliente'} · Pedido #
                      {solicitudActual.pedido_id || '—'}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.badge,
                      {
                        backgroundColor: cfgEstado(solicitudActual.estado).bg,
                        borderColor: cfgEstado(solicitudActual.estado).color + '40',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.badgeText,
                        { color: cfgEstado(solicitudActual.estado).color },
                      ]}
                    >
                      {cfgEstado(solicitudActual.estado).label}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ padding: 16, paddingBottom: 30 }}
              keyboardShouldPersistTaps="handled"
            >
              {/* ⭐ IA */}
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                🪄 Asistente IA
              </Text>
              <Text style={{ color: theme.subtle, fontSize: 12, marginBottom: 10 }}>
                Genera una respuesta automática basada en la solicitud
              </Text>

              <TouchableOpacity
                onPress={generarConIA}
                disabled={generandoIA || enviando}
                activeOpacity={0.85}
                style={[
                  styles.btnIA,
                  {
                    backgroundColor: theme.primarySoft,
                    borderColor: theme.primary,
                    opacity: generandoIA ? 0.6 : 1,
                  },
                ]}
              >
                {generandoIA ? (
                  <ActivityIndicator size="small" color={theme.primary} />
                ) : (
                  <MaterialCommunityIcons
                    name="robot-happy-outline"
                    size={18}
                    color={theme.primary}
                  />
                )}
                <Text style={[styles.btnIAText, { color: theme.primary }]}>
                  {generandoIA ? 'Generando…' : 'Generar respuesta IA'}
                </Text>
              </TouchableOpacity>

              {/* Plantillas */}
              <Text style={[styles.sectionTitle, { color: theme.text, marginTop: 22 }]}>
                ⚡ Plantillas rápidas
              </Text>
              {loadingRespuestas ? (
                <ActivityIndicator color={theme.primary} style={{ marginTop: 20 }} />
              ) : respuestasRapidas.length === 0 ? (
                <Text style={{ color: theme.subtle, textAlign: 'center', marginTop: 10 }}>
                  No hay plantillas disponibles
                </Text>
              ) : (
                respuestasRapidas.map((r) => {
                  const c = cfgEstado(r.estado);
                  return (
                    <TouchableOpacity
                      key={r.id}
                      disabled={enviando}
                      onPress={() => aplicarRespuestaRapida(r)}
                      activeOpacity={0.75}
                      style={[
                        styles.respuestaCard,
                        {
                          backgroundColor: theme.surface,
                          borderColor: theme.border,
                          opacity: enviando ? 0.5 : 1,
                        },
                      ]}
                    >
                      <View style={[styles.respuestaAccent, { backgroundColor: c.color }]} />
                      <View style={{ flex: 1, paddingLeft: 12 }}>
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 8,
                            marginBottom: 6,
                          }}
                        >
                          <View
                            style={[
                              styles.badge,
                              { backgroundColor: c.bg, borderColor: c.color + '40' },
                            ]}
                          >
                            <Text style={[styles.badgeText, { color: c.color }]}>
                              {c.label}
                            </Text>
                          </View>
                          <Text
                            style={{
                              color: theme.text,
                              fontSize: 13,
                              fontWeight: '800',
                              flex: 1,
                            }}
                            numberOfLines={1}
                          >
                            {r.titulo}
                          </Text>
                        </View>
                        <Text style={{ color: theme.subtle, fontSize: 12, lineHeight: 17 }}>
                          {r.mensaje}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}

              {/* Estado nuevo */}
              <Text style={[styles.sectionTitle, { color: theme.text, marginTop: 22 }]}>
                📌 Nuevo estado
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {['en_revision', 'aprobada', 'rechazada', 'resuelta', 'cancelada'].map(
                  (k) => {
                    const c = cfgEstado(k);
                    const activo = estadoNuevo === k;
                    return (
                      <TouchableOpacity
                        key={k}
                        onPress={() => setEstadoNuevo(k)}
                        style={[
                          styles.estadoChip,
                          {
                            backgroundColor: activo ? c.bg : theme.surfaceAlt,
                            borderColor: activo ? c.color : theme.border,
                          },
                        ]}
                      >
                        <Feather
                          name={c.icon}
                          size={12}
                          color={activo ? c.color : theme.subtle}
                        />
                        <Text
                          style={[
                            styles.estadoChipText,
                            { color: activo ? c.color : theme.subtle },
                          ]}
                        >
                          {c.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  }
                )}
              </View>

              {/* Texto libre */}
              <Text style={[styles.sectionTitle, { color: theme.text, marginTop: 22 }]}>
                ✍️ Respuesta personalizada
              </Text>
              <TextInput
                value={textoLibre}
                onChangeText={setTextoLibre}
                multiline
                numberOfLines={5}
                placeholder="Escribe aquí la respuesta para el cliente…"
                placeholderTextColor={theme.subtle}
                style={[
                  styles.textarea,
                  {
                    backgroundColor: theme.surface,
                    borderColor: theme.border,
                    color: theme.text,
                  },
                ]}
              />

              <TouchableOpacity
                onPress={enviarRespuesta}
                disabled={enviando || textoLibre.trim().length < 10}
                style={[
                  styles.btnPrimary,
                  {
                    backgroundColor: theme.primary,
                    opacity:
                      enviando || textoLibre.trim().length < 10 ? 0.5 : 1,
                  },
                ]}
                activeOpacity={0.85}
              >
                {enviando ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <>
                    <Feather name="send" size={16} color="#FFF" />
                    <Text style={styles.btnPrimaryText}>Enviar respuesta</Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ───────────── MODAL ELIMINAR ───────────── */}
      <Modal
        visible={modalEliminar}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!eliminando) {
            setModalEliminar(false);
            setSolicitudAEliminar(null);
          }
        }}
      >
        <View style={styles.confirmBackdrop}>
          <View
            style={[
              styles.confirmCard,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <View style={[styles.confirmIcon, { backgroundColor: theme.dangerSoft }]}>
              <Feather name="trash-2" size={28} color={theme.danger} />
            </View>
            <Text style={[styles.confirmTitle, { color: theme.text }]}>
              ¿Eliminar solicitud?
            </Text>
            <Text style={[styles.confirmMsg, { color: theme.subtle }]}>
              Esta acción es permanente. La solicitud de{' '}
              <Text style={{ fontWeight: '800', color: theme.text }}>
                {solicitudAEliminar
                  ? etiquetaTipo(solicitudAEliminar.tipo)
                  : '—'}
              </Text>{' '}
              se borrará para siempre.
            </Text>
            <View style={styles.confirmBtns}>
              <TouchableOpacity
                onPress={() => {
                  if (!eliminando) {
                    setModalEliminar(false);
                    setSolicitudAEliminar(null);
                  }
                }}
                disabled={eliminando}
                style={[styles.btnSecondary, { borderColor: theme.border }]}
                activeOpacity={0.85}
              >
                <Text style={[styles.btnSecondaryText, { color: theme.text }]}>
                  Cancelar
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={confirmarEliminar}
                disabled={eliminando}
                style={[
                  styles.btnDanger,
                  {
                    backgroundColor: theme.danger,
                    opacity: eliminando ? 0.6 : 1,
                  },
                ]}
                activeOpacity={0.85}
              >
                {eliminando ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <>
                    <Feather name="trash-2" size={14} color="#FFF" />
                    <Text style={styles.btnDangerText}>Eliminar</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },

  header: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
  },
  iconBtnHeader: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '900', letterSpacing: -0.3 },
  headerSub: { fontSize: 11.5, marginTop: 2, fontWeight: '600' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },

  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 40,
    borderWidth: 1,
  },

  filtrosContent: { paddingHorizontal: 12, paddingVertical: 8, gap: 6 },
  filtroChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 18,
    borderWidth: 1,
  },
  filtroText: { fontSize: 11, fontWeight: '800' },
  countBadge: {
    paddingHorizontal: 5,
    paddingVertical: 0,
    borderRadius: 8,
    minWidth: 16,
    alignItems: 'center',
  },
  countText: { fontSize: 9, fontWeight: '900' },

  card: {
    flexDirection: 'row',
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 12,
    overflow: 'hidden',
    elevation: 2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
  },
  cardAccent: { width: 4 },
  cardBody: { flex: 1, padding: 14 },
  iconRound: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardTitle: { fontSize: 14.5, fontWeight: '800', letterSpacing: -0.2 },
  cardSub: { fontSize: 11.5, marginTop: 2, fontWeight: '500' },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 10, fontWeight: '800', textTransform: 'capitalize' },

  descripcion: { fontSize: 12.5, lineHeight: 18, marginTop: 12, marginBottom: 10 },

  respuestaBox: {
    borderRadius: 12,
    borderTopWidth: 1,
    paddingTop: 8,
    paddingBottom: 8,
    paddingHorizontal: 10,
    marginBottom: 8,
  },

  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
  },
  fecha: { fontSize: 11, fontWeight: '600' },
  iconBtnSmall: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnResponder: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  btnResponderText: { fontSize: 11.5, fontWeight: '800' },

  btnRetry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 50,
    marginTop: 16,
  },
  btnRetryText: { color: '#FFF', fontWeight: '800', fontSize: 13 },

  emptyIcon: {
    width: 100,
    height: 100,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },

  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    paddingVertical: 12,
  },
  pageBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageIndicator: {
    fontSize: 12.5,
    fontWeight: '900',
    minWidth: 50,
    textAlign: 'center',
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    height: '92%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  modalHandleWrap: { alignItems: 'center', paddingTop: 8 },
  modalHandle: { width: 40, height: 4, borderRadius: 2 },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  modalTitle: { fontSize: 17, fontWeight: '900', letterSpacing: -0.2 },
  closeBtn: { borderRadius: 12, padding: 8 },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: -0.1,
    marginBottom: 4,
  },

  btnIA: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  btnIAText: { fontSize: 13.5, fontWeight: '900' },

  respuestaCard: {
    flexDirection: 'row',
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginBottom: 10,
    overflow: 'hidden',
  },
  respuestaAccent: { width: 4, borderRadius: 2 },

  estadoChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  estadoChipText: { fontSize: 11.5, fontWeight: '800' },

  textarea: {
    minHeight: 100,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    fontSize: 13,
    textAlignVertical: 'top',
    lineHeight: 19,
  },
  btnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 12,
  },
  btnPrimaryText: { color: '#FFF', fontWeight: '900', fontSize: 14 },

  confirmBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  confirmCard: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 22,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
  },
  confirmIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  confirmTitle: { fontSize: 18, fontWeight: '900', textAlign: 'center' },
  confirmMsg: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  confirmBtns: { flexDirection: 'row', gap: 10, width: '100%' },
  btnSecondary: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  btnSecondaryText: { fontSize: 13, fontWeight: '800' },
  btnDanger: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  btnDangerText: { color: '#FFF', fontSize: 13, fontWeight: '900' },
});