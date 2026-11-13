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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, Ionicons } from '@expo/vector-icons';
import {
  fetchSolicitudesAdmin,
  fetchRespuestasRapidas,
  responderSolicitud,
  eliminarSolicitud, // ⭐ NUEVA
} from '../services/api';
import { mensajeSeguro } from '../services/errorHandler';
import { usePreferences } from '../context/PreferencesContext';

const FILTROS_ESTADO = [
  { key: 'todas', label: 'Todas', icon: 'inbox' },
  { key: 'pendiente', label: 'Pendientes', icon: 'clock' },
  { key: 'en_revision', label: 'En revisión', icon: 'eye' },
  { key: 'aprobada', label: 'Aprobadas', icon: 'check-circle' },
  { key: 'rechazada', label: 'Rechazadas', icon: 'x-circle' },
];

const ESTADO_CONFIG = {
  pendiente: { color: '#F59E0B', bg: '#FEF3C7', icon: 'clock', label: 'Pendiente' },
  en_revision: { color: '#3B82F6', bg: '#DBEAFE', icon: 'eye', label: 'En revisión' },
  aprobada: { color: '#10B981', bg: '#D1FAE5', icon: 'check-circle', label: 'Aprobada' },
  rechazada: { color: '#EF4444', bg: '#FEE2E2', icon: 'x-circle', label: 'Rechazada' },
};

const TIPO_LABEL = {
  devolucion: 'Devolución',
  garantia: 'Garantía',
  producto_defectuoso: 'Producto defectuoso',
  otro: 'Otro',
};

export default function AdminSolicitudesScreen({ navigation }) {
  const { palette: p, isDark } = usePreferences();

  const [solicitudes, setSolicitudes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [error, setError] = useState(null);
  const [filtro, setFiltro] = useState('todas');

  // Modal responder
  const [modalAbierto, setModalAbierto] = useState(false);
  const [solicitudActual, setSolicitudActual] = useState(null);
  const [respuestasRapidas, setRespuestasRapidas] = useState([]);
  const [loadingRespuestas, setLoadingRespuestas] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [textoLibre, setTextoLibre] = useState('');

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
    const unsubscribe = navigation.addListener('focus', () => {
      cargar(true);
    });
    return unsubscribe;
  }, [navigation, cargar]);

  // ----------------------------------------------------------------
  // Responder
  const abrirModalRespuesta = async (solicitud) => {
    setSolicitudActual(solicitud);
    setTextoLibre('');
    setModalAbierto(true);
    setLoadingRespuestas(true);
    try {
      const lista = await fetchRespuestasRapidas({ tipo: solicitud.tipo });
      setRespuestasRapidas(Array.isArray(lista) ? lista : []);
    } catch (e) {
      Alert.alert('Error', mensajeSeguro(e));
      setRespuestasRapidas([]);
    } finally {
      setLoadingRespuestas(false);
    }
  };

  const cerrarModal = () => {
    if (enviando) return;
    setModalAbierto(false);
    setSolicitudActual(null);
    setRespuestasRapidas([]);
    setTextoLibre('');
  };

  const aplicarRespuestaRapida = async (rapida) => {
    if (!solicitudActual || enviando) return;
    setEnviando(true);
    try {
      await responderSolicitud(solicitudActual.id, {
        estado: rapida.estado,
        respuesta: rapida.mensaje,
        respuesta_rapida_id: rapida.id,
      });
      setModalAbierto(false);
      setSolicitudActual(null);
      cargar(true);
      Alert.alert('✅ Listo', 'La solicitud fue respondida y el cliente fue notificado.');
    } catch (e) {
      Alert.alert('Error', mensajeSeguro(e));
    } finally {
      setEnviando(false);
    }
  };

  const enviarTextoLibre = async () => {
    if (!solicitudActual || enviando) return;
    const txt = textoLibre.trim();
    if (txt.length < 10) {
      Alert.alert('Atención', 'La respuesta debe tener al menos 10 caracteres.');
      return;
    }
    setEnviando(true);
    try {
      await responderSolicitud(solicitudActual.id, {
        estado:
          solicitudActual.estado === 'pendiente'
            ? 'en_revision'
            : solicitudActual.estado,
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
      setModalEliminar(false);
      setSolicitudAEliminar(null);
      cargar(true);
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

  const conteos = useMemo(() => {
    const c = { todas: solicitudes.length };
    solicitudes.forEach((s) => {
      const k = String(s.estado || 'pendiente').toLowerCase();
      c[k] = (c[k] || 0) + 1;
    });
    return c;
  }, [solicitudes]);

  // ----------------------------------------------------------------
  const renderItem = ({ item }) => {
    const cfg = cfgEstado(item.estado);
    const respondido = !!item.respuesta_admin;

    return (
      <View
        style={[
          styles.card,
          {
            backgroundColor: p.surface,
            borderColor: p.border,
            shadowColor: isDark ? '#000' : '#000',
            shadowOpacity: isDark ? 0.35 : 0.08,
          },
        ]}
      >
        {/* Barra lateral de color según estado */}
        <View style={[styles.cardAccent, { backgroundColor: cfg.color }]} />

        <View style={styles.cardBody}>
          {/* Cabecera: tipo + estado */}
          <View style={styles.rowBetween}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
              <View style={[styles.iconRound, { backgroundColor: cfg.color + '20' }]}>
                <Feather name={cfg.icon} size={16} color={cfg.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, { color: p.text }]} numberOfLines={1}>
                  {etiquetaTipo(item.tipo)}
                </Text>
                <Text style={[styles.cardSub, { color: p.subtle }]} numberOfLines={1}>
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

          {/* Descripción */}
          <Text style={[styles.descripcion, { color: p.text }]} numberOfLines={2}>
            {item.descripcion || ''}
          </Text>

          {/* Footer: fecha + acciones */}
          <View style={styles.cardFooter}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Feather name="clock" size={11} color={p.subtle} />
              <Text style={[styles.fecha, { color: p.subtle }]}>
                {formatearFecha(item.fecha_creacion)}
              </Text>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {/* Botón eliminar */}
              <TouchableOpacity
                onPress={() => pedirConfirmarEliminar(item)}
                style={[styles.iconBtnSmall, { backgroundColor: '#EF444415' }]}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Feather name="trash-2" size={15} color="#EF4444" />
              </TouchableOpacity>

              {/* Botón responder */}
              <TouchableOpacity
                onPress={() => abrirModalRespuesta(item)}
                style={[
                  styles.btnResponder,
                  {
                    backgroundColor: respondido ? p.surface : p.primary,
                    borderColor: respondido ? p.border : p.primary,
                  },
                ]}
                activeOpacity={0.85}
              >
                <Feather
                  name={respondido ? 'eye' : 'message-square'}
                  size={13}
                  color={respondido ? p.text : '#FFF'}
                />
                <Text
                  style={[
                    styles.btnResponderText,
                    { color: respondido ? p.text : '#FFF' },
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
  return (
    <SafeAreaView
      style={[styles.page, { backgroundColor: p.background }]}
      edges={['top', 'left', 'right']}
    >
      {/* HEADER */}
      <View style={[styles.header, { borderBottomColor: p.border }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={[styles.iconBtnHeader, { backgroundColor: p.surface }]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather name="arrow-left" color={p.text} size={22} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={[styles.headerTitle, { color: p.text }]}>
            Solicitudes de clientes
          </Text>
          <Text style={[styles.headerSub, { color: p.subtle }]}>
            {solicitudes.length}{' '}
            {solicitudes.length === 1 ? 'solicitud' : 'solicitudes'}
            {conteos.pendiente
              ? ` · ${conteos.pendiente} pendiente${
                  conteos.pendiente === 1 ? '' : 's'
                }`
              : ''}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => cargar()}
          style={[styles.iconBtnHeader, { backgroundColor: p.surface }]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather name="refresh-cw" color={p.primary} size={18} />
        </TouchableOpacity>
      </View>

      {/* FILTROS — chips compactos */}
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
                  backgroundColor: activo ? p.primary : p.surface,
                  borderColor: activo ? p.primary : p.border,
                },
              ]}
            >
              <Feather
                name={f.icon}
                size={11}
                color={activo ? '#FFF' : p.text}
              />
              <Text
                style={[styles.filtroText, { color: activo ? '#FFF' : p.text }]}
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
                        : p.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.countText,
                      { color: activo ? '#FFF' : p.text },
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
          <ActivityIndicator size="large" color={p.primary} />
          <Text style={{ color: p.subtle, marginTop: 12 }}>
            Cargando solicitudes…
          </Text>
        </View>
      ) : error && solicitudes.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
          <Text
            style={{
              color: '#EF4444',
              marginTop: 12,
              textAlign: 'center',
              paddingHorizontal: 24,
            }}
          >
            {error}
          </Text>
          <TouchableOpacity
            onPress={() => cargar()}
            style={[styles.btnRetry, { backgroundColor: p.primary }]}
          >
            <Feather name="refresh-cw" size={14} color="#FFF" />
            <Text style={styles.btnRetryText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={solicitudes}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, paddingBottom: 40, flexGrow: 1 }}
          refreshControl={
            <RefreshControl
              refreshing={refrescando}
              onRefresh={() => cargar(true)}
              tintColor={p.primary}
              colors={[p.primary]}
            />
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <View
                style={[
                  styles.emptyIcon,
                  {
                    backgroundColor: p.primary + '15',
                    borderColor: p.primary + '30',
                  },
                ]}
              >
                <Ionicons name="inbox-outline" size={48} color={p.primary} />
              </View>
              <Text
                style={{
                  color: p.text,
                  fontSize: 17,
                  fontWeight: '900',
                  marginTop: 16,
                }}
              >
                Todo tranquilo por aquí
              </Text>
              <Text
                style={{
                  color: p.subtle,
                  fontSize: 13,
                  marginTop: 8,
                  textAlign: 'center',
                  paddingHorizontal: 24,
                  lineHeight: 19,
                }}
              >
                {filtro === 'todas'
                  ? 'No hay solicitudes de clientes por ahora. Cuando envíen una, aparecerá aquí.'
                  : 'No hay solicitudes con este estado.'}
              </Text>
            </View>
          }
        />
      )}

      {/* ───────────────── MODAL RESPONDER ───────────────── */}
      <Modal
        visible={modalAbierto}
        animationType="slide"
        transparent
        onRequestClose={cerrarModal}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: p.background }]}>
            {/* Handle bar */}
            <View style={styles.modalHandleWrap}>
              <View style={[styles.modalHandle, { backgroundColor: p.border }]} />
            </View>

            <View style={[styles.modalHeader, { borderBottomColor: p.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.modalTitle, { color: p.text }]}>
                  Responder solicitud
                </Text>
                <Text style={{ color: p.subtle, fontSize: 12, marginTop: 2 }}>
                  Elige una respuesta o escribe tu propio mensaje
                </Text>
              </View>
              <TouchableOpacity
                onPress={cerrarModal}
                style={[styles.closeBtn, { backgroundColor: p.surface }]}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Feather name="x" size={20} color={p.text} />
              </TouchableOpacity>
            </View>

            {solicitudActual ? (
              <View
                style={{
                  padding: 16,
                  backgroundColor: p.surface,
                  borderBottomWidth: 1,
                  borderBottomColor: p.border,
                }}
              >
                <View
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
                >
                  <View
                    style={[
                      styles.iconRound,
                      {
                        backgroundColor:
                          cfgEstado(solicitudActual.estado).color + '20',
                      },
                    ]}
                  >
                    <Feather
                      name={cfgEstado(solicitudActual.estado).icon}
                      size={16}
                      color={cfgEstado(solicitudActual.estado).color}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        color: p.text,
                        fontSize: 13,
                        fontWeight: '800',
                      }}
                    >
                      {etiquetaTipo(solicitudActual.tipo)}
                    </Text>
                    <Text
                      style={{
                        color: p.subtle,
                        fontSize: 11,
                        marginTop: 1,
                      }}
                    >
                      {solicitudActual.usuario_email || 'Cliente'} · Pedido #
                      {solicitudActual.pedido_id || '—'}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.badge,
                      {
                        backgroundColor: cfgEstado(solicitudActual.estado).bg,
                        borderColor:
                          cfgEstado(solicitudActual.estado).color + '40',
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

                <Text
                  style={{
                    color: p.subtle,
                    fontSize: 11,
                    fontWeight: '700',
                    textTransform: 'uppercase',
                    marginTop: 12,
                  }}
                >
                  Descripción del cliente
                </Text>
                <Text
                  style={{
                    color: p.text,
                    fontSize: 13,
                    marginTop: 4,
                    lineHeight: 19,
                  }}
                >
                  {solicitudActual.descripcion || ''}
                </Text>
              </View>
            ) : null}

            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={[styles.sectionTitle, { color: p.text }]}>
                ⚡ Respuestas automáticas
              </Text>
              <Text
                style={{ color: p.subtle, fontSize: 12, marginBottom: 12 }}
              >
                Un toque y se envía al cliente + cambia el estado
              </Text>

              {loadingRespuestas ? (
                <ActivityIndicator color={p.primary} style={{ marginTop: 20 }} />
              ) : respuestasRapidas.length === 0 ? (
                <Text
                  style={{
                    color: p.subtle,
                    textAlign: 'center',
                    marginTop: 10,
                  }}
                >
                  No hay respuestas rápidas disponibles
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
                          backgroundColor: p.surface,
                          borderColor: p.border,
                          opacity: enviando ? 0.5 : 1,
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.respuestaAccent,
                          { backgroundColor: c.color },
                        ]}
                      />
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
                              {
                                backgroundColor: c.bg,
                                borderColor: c.color + '40',
                              },
                            ]}
                          >
                            <Text
                              style={[styles.badgeText, { color: c.color }]}
                            >
                              {c.label}
                            </Text>
                          </View>
                          <Text
                            style={{
                              color: p.text,
                              fontSize: 13,
                              fontWeight: '800',
                              flex: 1,
                            }}
                            numberOfLines={1}
                          >
                            {r.titulo}
                          </Text>
                        </View>
                        <Text
                          style={{
                            color: p.subtle,
                            fontSize: 12,
                            lineHeight: 17,
                          }}
                        >
                          {r.mensaje}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}

              {/* Texto libre */}
              <Text
                style={[
                  styles.sectionTitle,
                  { color: p.text, marginTop: 24 },
                ]}
              >
                ✍️ Respuesta personalizada
              </Text>
              <TextInput
                value={textoLibre}
                onChangeText={setTextoLibre}
                multiline
                numberOfLines={4}
                placeholder="Escribe aquí la respuesta para el cliente…"
                placeholderTextColor={p.subtle}
                style={[
                  styles.textarea,
                  {
                    backgroundColor: p.surface,
                    borderColor: p.border,
                    color: p.text,
                  },
                ]}
              />
              <TouchableOpacity
                onPress={enviarTextoLibre}
                disabled={enviando || textoLibre.trim().length < 10}
                style={[
                  styles.btnPrimary,
                  {
                    backgroundColor: p.primary,
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

      {/* ───────────────── MODAL ELIMINAR ───────────────── */}
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
              { backgroundColor: p.surface, borderColor: p.border },
            ]}
          >
            <View style={styles.confirmIcon}>
              <Feather name="trash-2" size={28} color="#EF4444" />
            </View>
            <Text style={[styles.confirmTitle, { color: p.text }]}>
              ¿Eliminar solicitud?
            </Text>
            <Text style={[styles.confirmMsg, { color: p.subtle }]}>
              Esta acción es permanente. La solicitud de{' '}
              <Text style={{ fontWeight: '800', color: p.text }}>
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
                style={[styles.btnSecondary, { borderColor: p.border }]}
                activeOpacity={0.85}
              >
                <Text style={[styles.btnSecondaryText, { color: p.text }]}>
                  Cancelar
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={confirmarEliminar}
                disabled={eliminando}
                style={[styles.btnDanger, { opacity: eliminando ? 0.6 : 1 }]}
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

  // ── Chips de filtro compactos ──
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

  // ── Cards ──
  card: {
    flexDirection: 'row',
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 12,
    overflow: 'hidden',
    elevation: 2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
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
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(148,163,184,0.15)',
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

  // ── Modal responder ──
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    height: '90%',
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

  respuestaCard: {
    flexDirection: 'row',
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginBottom: 10,
    overflow: 'hidden',
  },
  respuestaAccent: { width: 4, borderRadius: 2 },

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

  // ── Modal confirmar eliminar ──
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
    backgroundColor: '#EF444420',
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
    backgroundColor: '#EF4444',
    borderRadius: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  btnDangerText: { color: '#FFF', fontSize: 13, fontWeight: '900' },
});