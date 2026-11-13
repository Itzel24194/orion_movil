// screens/ManageChatScreen.js
import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text, Alert } from "../i18n/ui";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

import {
  adminListarSesiones,
  adminObtenerMensajes,
  adminEnviarMensaje,
  adminGenerarIA,
  adminArchivarSesion,
  adminAnonimizarSesion,
  adminAsignarVendedor,
  adminListarVendedores,
  adminRespuestasRapidas,
  adminAuditoria,
  adminRetencionPrevisualizar,
  adminRetencionEjecutar,
  getCurrentUser,
  isAdmin,
} from "../services/api";

/* ============================================================
   NORMALIZADORES
   ============================================================ */

const normalizarSesion = (s) => {
  if (!s) return null;
  const id = s._id || s.id || s._id_str || s.sesion_id;
  if (!id) return null;

  const ultimo =
    s.ultimo_mensaje?.texto ||
    s.ultimo_mensaje ||
    s.ultimoMensaje ||
    s.preview ||
    "";

  return {
    id: String(id),
    nombre: s.nombre_usuario || s.nombre || s.email_usuario || s.email || "Invitado",
    email: s.email_usuario || s.email || null,
    ultimoMensaje: typeof ultimo === "string" ? ultimo : ultimo?.texto || "",
    noLeidos: Number(s.no_leidos ?? s.noLeidos ?? 0),
    archivada: !!(s.archivada ?? s.estado === "archivado"),
    asignada: !!(s.asignada ?? s.vendedor_id),
    vendedorId: s.vendedor_id || null,
    anonimizada: !!s.anonimizada,
    fecha: s.fecha_ultimo || s.updated_at || s.created_at || null,
    _raw: s,
  };
};

const normalizarMensaje = (m, idx = 0) => {
  if (!m) return null;

  const de = m.de || m.from || (m.es_admin ? (m.es_ia ? "bot" : "admin") : "cliente");
  const esCliente = de === "cliente" || de === "user";
  const esIA = m.es_ia === true || m.esIA === true || de === "bot";

  return {
    id: m._id || m.id || `msg-${idx}-${m.fecha || Date.now()}`,
    from: esCliente ? "user" : "admin",
    de,
    esIA,
    esAdmin: !esCliente,
    text: m.texto || m.text || m.mensaje || "",
    adminNombre: m.admin_nombre || m.adminNombre || null,
    time: m.fecha || m.time
      ? new Date(m.fecha || m.time).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "",
    fechaRaw: m.fecha || m.time || null,
    _raw: m,
  };
};

export default function ManageChatScreen({ navigation }) {
  const scrollRef = useRef();

  // ⭐ Guard: si no es admin, no se renderiza ni carga nada
  const [autorizado, setAutorizado] = useState(false);
  const [verificando, setVerificando] = useState(true);

  const [filtro, setFiltro] = useState("activas");
  const [sesiones, setSesiones] = useState([]);
  const [loadingSesiones, setLoadingSesiones] = useState(true);
  const [sesionActiva, setSesionActiva] = useState(null);
  const [mensajes, setMensajes] = useState([]);
  const [loadingMensajes, setLoadingMensajes] = useState(false);
  const [input, setInput] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [respuestasRapidas, setRespuestasRapidas] = useState([]);
  const [errorMsg, setErrorMsg] = useState(null);

  // Modales
  const [modalVendedores, setModalVendedores] = useState(false);
  const [vendedores, setVendedores] = useState([]);
  const [modalAuditoria, setModalAuditoria] = useState(false);
  const [auditoria, setAuditoria] = useState([]);

  // ⭐ GUARD: verificar rol ANTES de cualquier carga
  useEffect(() => {
    let alive = true;
    (async () => {
      const user = await getCurrentUser();
      if (!isAdmin(user)) {
        if (!alive) return;
        setVerificando(false);
        Alert.alert(
          "Acceso restringido",
          "Solo administradores pueden ver esta pantalla.",
          [{ text: "OK", onPress: () => navigation.replace("Home") }]
        );
        return;
      }
      if (alive) {
        setAutorizado(true);
        setVerificando(false);
      }
    })();
    return () => { alive = false; };
  }, [navigation]);

  const cargarSesiones = useCallback(async (f = filtro) => {
    if (!autorizado) return;
    setLoadingSesiones(true);
    setErrorMsg(null);
    try {
      const resp = await adminListarSesiones({ filtro: f });
      const crudo = Array.isArray(resp)
        ? resp
        : resp?.sesiones || resp?.data || resp?.sessions || [];
      const lista = crudo.map(normalizarSesion).filter(Boolean);
      setSesiones(lista);
      if (lista.length === 0) {
        setErrorMsg(
          f === "activas"
            ? "No hay conversaciones activas. Prueba la pestaña Archivadas."
            : "No hay conversaciones archivadas."
        );
      }
    } catch (e) {
      console.log("[ManageChat] Error sesiones:", e.message);
      setSesiones([]);
      setErrorMsg(e.message || "Error al cargar sesiones");
    } finally {
      setLoadingSesiones(false);
    }
  }, [filtro, autorizado]);

  const cargarMensajes = useCallback(async (sesionId) => {
    if (!sesionId || !autorizado) return;
    setLoadingMensajes(true);
    try {
      const resp = await adminObtenerMensajes({ sesion_id: sesionId });
      const crudo = Array.isArray(resp)
        ? resp
        : resp?.mensajes || resp?.data || resp?.messages || [];
      const lista = crudo.map(normalizarMensaje).filter(Boolean);
      lista.sort((a, b) => {
        const ta = a.fechaRaw ? new Date(a.fechaRaw).getTime() : 0;
        const tb = b.fechaRaw ? new Date(b.fechaRaw).getTime() : 0;
        return ta - tb;
      });
      setMensajes(lista);
    } catch (e) {
      console.log("[ManageChat] Error mensajes:", e.message);
      setMensajes([]);
    } finally {
      setLoadingMensajes(false);
    }
  }, [autorizado]);

  const cargarRespuestasRapidas = useCallback(async () => {
    if (!autorizado) return;
    try {
      const resp = await adminRespuestasRapidas();
      const lista = Array.isArray(resp) ? resp : resp?.respuestas || [];
      setRespuestasRapidas(lista);
    } catch {
      setRespuestasRapidas([]);
    }
  }, [autorizado]);

  // ⭐ Solo carga cuando el guard ya autorizó
  useEffect(() => {
    if (!autorizado) return;
    cargarSesiones(filtro);
    cargarRespuestasRapidas();
  }, [filtro, autorizado, cargarSesiones, cargarRespuestasRapidas]);

  useEffect(() => {
    if (!autorizado) return;
    if (sesionActiva) cargarMensajes(sesionActiva.id);
    else setMensajes([]);
  }, [sesionActiva, autorizado, cargarMensajes]);

  // Polling cada 15s (solo si autorizado y hay sesión activa)
  useEffect(() => {
    if (!autorizado || !sesionActiva) return;
    const t = setInterval(() => cargarMensajes(sesionActiva.id), 15000);
    return () => clearInterval(t);
  }, [sesionActiva, autorizado, cargarMensajes]);

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [mensajes]);

  const enviar = async (textoCrudo) => {
    const texto = (textoCrudo ?? "").trim();
    if (!texto || !sesionActiva || enviando) return;

    setEnviando(true);
    setInput("");
    try {
      await adminEnviarMensaje({ session_id: sesionActiva.id, mensaje: texto });
      await cargarMensajes(sesionActiva.id);
      cargarSesiones(filtro);
    } catch (e) {
      Alert.alert("Error", e.message || "No se pudo enviar el mensaje");
    } finally {
      setEnviando(false);
    }
  };

  const generarIA = async () => {
    if (!sesionActiva) return;
    try {
      const r = await adminGenerarIA({ session_id: sesionActiva.id });
      if (r?.respuesta) setInput(r.respuesta);
    } catch (e) {
      Alert.alert("Error IA", e.message || "No se pudo generar");
    }
  };

  const archivar = () => {
    if (!sesionActiva) return;
    Alert.alert(
      "Archivar conversación",
      "¿Seguro que quieres archivar esta sesión?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Archivar",
          style: "destructive",
          onPress: async () => {
            try {
              await adminArchivarSesion(sesionActiva.id);
              setSesionActiva(null);
              setMensajes([]);
              cargarSesiones(filtro);
            } catch (e) {
              Alert.alert("Error", e.message);
            }
          },
        },
      ]
    );
  };

  const anonimizar = () => {
    if (!sesionActiva) return;
    Alert.alert(
      "Anonimizar datos",
      "Se reemplazarán nombre y email del cliente. Los mensajes se conservan.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Anonimizar",
          style: "destructive",
          onPress: async () => {
            try {
              await adminAnonimizarSesion(sesionActiva.id);
              cargarSesiones(filtro);
              Alert.alert("Listo", "Conversación anonimizada");
            } catch (e) {
              Alert.alert("Error", e.message);
            }
          },
        },
      ]
    );
  };

  const abrirAsignarVendedor = async () => {
    if (!sesionActiva) return;
    try {
      const resp = await adminListarVendedores();
      const lista = Array.isArray(resp) ? resp : resp?.vendedores || [];
      setVendedores(
        lista.map((v) => ({
          id: String(v._id || v.id),
          nombre: v.nombre || v.email || "Vendedor",
          email: v.email || null,
        }))
      );
      setModalVendedores(true);
    } catch (e) {
      Alert.alert("Error", e.message);
    }
  };

  const asignar = async (vendedorId) => {
    try {
      await adminAsignarVendedor({
        session_id: sesionActiva.id,
        vendedor_id: vendedorId,
      });
      setModalVendedores(false);
      cargarSesiones(filtro);
      Alert.alert("Listo", vendedorId ? "Sesión asignada" : "Sesión desasignada");
    } catch (e) {
      Alert.alert("Error", e.message);
    }
  };

  const abrirAuditoria = async () => {
    try {
      const resp = await adminAuditoria({ limite: 50 });
      const lista = Array.isArray(resp) ? resp : resp?.registros || [];
      setAuditoria(lista);
      setModalAuditoria(true);
    } catch (e) {
      Alert.alert("Error", e.message);
    }
  };

  const ejecutarRetencion = async () => {
    try {
      const preview = await adminRetencionPrevisualizar();
      Alert.alert(
        "Retención",
        `Se eliminarán ${preview.total_a_eliminar ?? 0} sesiones archivadas más antiguas que ${preview.dias_retencion ?? 180} días. ¿Ejecutar?`,
        [
          { text: "Cancelar", style: "cancel" },
          {
            text: "Ejecutar",
            style: "destructive",
            onPress: async () => {
              try {
                const r = await adminRetencionEjecutar();
                Alert.alert("Listo", `Eliminadas: ${r.eliminadas || 0}`);
                cargarSesiones(filtro);
              } catch (e) {
                Alert.alert("Error", e.message);
              }
            },
          },
        ]
      );
    } catch (e) {
      Alert.alert("Error", e.message);
    }
  };

  // ⭐ Mientras verifica el rol, muestra loader (no dispara peticiones)
  if (verificando) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color="#7C3AED" />
        </View>
      </SafeAreaView>
    );
  }

  // Si no está autorizado (el guard ya hizo navigation.replace), no renderiza nada
  if (!autorizado) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <Text style={{ color: "#64748B" }}>Acceso restringido</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#FFF" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Soporte / Chat</Text>
          <Text style={styles.headerSubtitle}>
            {sesiones.length} sesiones · {sesionActiva?.nombre || "Selecciona una"}
          </Text>
        </View>
        <TouchableOpacity style={styles.iconBtn} onPress={abrirAuditoria}>
          <Ionicons name="shield-checkmark" size={20} color="#7C3AED" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconBtn} onPress={ejecutarRetencion}>
          <Ionicons name="trash" size={20} color="#ef4444" />
        </TouchableOpacity>
      </View>

      {/* FILTROS */}
      <View style={styles.filtros}>
        <TouchableOpacity
          style={[styles.filtroBtn, filtro === "activas" && styles.filtroBtnActivo]}
          onPress={() => { setFiltro("activas"); setSesionActiva(null); setMensajes([]); }}
        >
          <Text style={[styles.filtroText, filtro === "activas" && styles.filtroTextActivo]}>
            Activas
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filtroBtn, filtro === "archivadas" && styles.filtroBtnActivo]}
          onPress={() => { setFiltro("archivadas"); setSesionActiva(null); setMensajes([]); }}
        >
          <Text style={[styles.filtroText, filtro === "archivadas" && styles.filtroTextActivo]}>
            Archivadas
          </Text>
        </TouchableOpacity>
      </View>

      {/* LISTA DE SESIONES */}
      <View style={styles.sesionesBox}>
        {loadingSesiones ? (
          <ActivityIndicator color="#7C3AED" style={{ marginTop: 20 }} />
        ) : sesiones.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>{errorMsg || "Sin sesiones"}</Text>
            <TouchableOpacity
              style={styles.retryBtn}
              onPress={() => cargarSesiones(filtro)}
            >
              <Ionicons name="refresh" size={14} color="#FFF" />
              <Text style={styles.retryText}>Reintentar</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={sesiones}
            keyExtractor={(s) => s.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 10 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.sesionCard,
                  sesionActiva?.id === item.id && styles.sesionCardActiva,
                ]}
                onPress={() => setSesionActiva(item)}
              >
                <View style={styles.sesionAvatar}>
                  <Text style={styles.sesionAvatarText}>
                    {(item.nombre || "?")[0].toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.sesionNombre} numberOfLines={1}>
                  {item.nombre}
                </Text>
                <Text style={styles.sesionPreview} numberOfLines={1}>
                  {item.ultimoMensaje || "Sin mensajes"}
                </Text>
                {item.noLeidos > 0 && (
                  <View style={styles.badgeUnread}>
                    <Text style={styles.badgeUnreadText}>{item.noLeidos}</Text>
                  </View>
                )}
                {item.anonimizada && (
                  <View style={styles.badgeAnon}>
                    <Ionicons name="eye-off" size={9} color="#FFF" />
                  </View>
                )}
              </TouchableOpacity>
            )}
          />
        )}
      </View>

      {/* CONVERSACIÓN */}
      <View style={styles.convBox}>
        {!sesionActiva ? (
          <View style={styles.emptyConv}>
            <MaterialCommunityIcons name="message-text-outline" size={40} color="#334155" />
            <Text style={styles.emptyConvText}>Selecciona una conversación</Text>
            {errorMsg && <Text style={styles.emptyConvSub}>{errorMsg}</Text>}
          </View>
        ) : (
          <>
            <View style={styles.acciones}>
              <TouchableOpacity style={styles.accionBtn} onPress={generarIA}>
                <Ionicons name="sparkles" size={14} color="#FFF" />
                <Text style={styles.accionText}>IA</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.accionBtn} onPress={abrirAsignarVendedor}>
                <Ionicons name="person-add" size={14} color="#FFF" />
                <Text style={styles.accionText}>Asignar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.accionBtn} onPress={archivar}>
                <Ionicons name="archive" size={14} color="#FFF" />
                <Text style={styles.accionText}>Archivar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.accionBtn} onPress={anonimizar}>
                <Ionicons name="eye-off" size={14} color="#FFF" />
                <Text style={styles.accionText}>Anon.</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              ref={scrollRef}
              style={styles.mensajesArea}
              contentContainerStyle={{ padding: 12 }}
            >
              {loadingMensajes ? (
                <ActivityIndicator color="#7C3AED" />
              ) : mensajes.length === 0 ? (
                <Text style={styles.emptyText}>Sin mensajes aún</Text>
              ) : (
                mensajes.map((m) => {
                  const esCliente = m.from === "user";
                  const esIA = m.esIA;
                  return (
                    <View
                      key={m.id}
                      style={[
                        styles.msgRow,
                        esCliente ? styles.msgLeft : styles.msgRight,
                      ]}
                    >
                      <View
                        style={[
                          styles.msgBubble,
                          esCliente ? styles.msgCliente : esIA ? styles.msgIA : styles.msgAdmin,
                        ]}
                      >
                        <Text style={styles.msgRemitente}>
                          {esCliente
                            ? "Cliente"
                            : esIA
                            ? "Nova IA"
                            : m.adminNombre || "Admin"}
                        </Text>
                        <Text style={styles.msgTexto}>{m.text}</Text>
                        <Text style={styles.msgHora}>{m.time}</Text>
                      </View>
                    </View>
                  );
                })
              )}
            </ScrollView>

            <FlatList
              data={respuestasRapidas}
              keyExtractor={(r, i) => `rr-${i}`}
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.rapidas}
              contentContainerStyle={{ paddingHorizontal: 8 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.rapidaChip}
                  onPress={() => setInput(item)}
                >
                  <Text style={styles.rapidaText}>{item}</Text>
                </TouchableOpacity>
              )}
            />

            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : undefined}
            >
              <View style={styles.inputRow}>
                <TextInput
                  value={input}
                  onChangeText={setInput}
                  placeholder="Responder al cliente..."
                  placeholderTextColor="#64748B"
                  style={styles.input}
                  onSubmitEditing={() => enviar(input)}
                  returnKeyType="send"
                />
                <TouchableOpacity
                  style={[styles.sendBtn, (!input.trim() || enviando) && styles.sendBtnOff]}
                  onPress={() => enviar(input)}
                  disabled={!input.trim() || enviando}
                >
                  <Ionicons name="send" size={18} color="#FFF" />
                </TouchableOpacity>
              </View>
            </KeyboardAvoidingView>
          </>
        )}
      </View>

      {/* MODAL VENDEDORES */}
      <Modal visible={modalVendedores} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Asignar a vendedor</Text>
            <ScrollView style={{ maxHeight: 300 }}>
              <TouchableOpacity
                style={styles.modalItem}
                onPress={() => asignar(null)}
              >
                <Text style={styles.modalItemText}>Sin asignar</Text>
              </TouchableOpacity>
              {vendedores.length === 0 ? (
                <Text style={styles.emptyText}>Sin vendedores disponibles</Text>
              ) : (
                vendedores.map((v) => (
                  <TouchableOpacity
                    key={v.id}
                    style={styles.modalItem}
                    onPress={() => asignar(v.id)}
                  >
                    <Text style={styles.modalItemText}>{v.nombre}</Text>
                    {v.email && <Text style={styles.modalItemSub}>{v.email}</Text>}
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
            <TouchableOpacity
              style={styles.modalClose}
              onPress={() => setModalVendedores(false)}
            >
              <Text style={styles.modalCloseText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL AUDITORÍA */}
      <Modal visible={modalAuditoria} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Auditoría (últimos 50)</Text>
            <ScrollView style={{ maxHeight: 400 }}>
              {auditoria.length === 0 ? (
                <Text style={styles.emptyText}>Sin registros</Text>
              ) : (
                auditoria.map((r, i) => (
                  <View key={i} style={styles.auditItem}>
                    <Text style={styles.auditAccion}>
                      {r.accion_label || r.accion || "—"}
                    </Text>
                    <Text style={styles.auditMeta}>
                      {r.usuario_nombre || "—"} · {r.ip || "—"}
                    </Text>
                    <Text style={styles.auditFecha}>
                      {r.fecha ? new Date(r.fecha).toLocaleString() : ""}
                    </Text>
                  </View>
                ))
              )}
            </ScrollView>
            <TouchableOpacity
              style={styles.modalClose}
              onPress={() => setModalAuditoria(false)}
            >
              <Text style={styles.modalCloseText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#020617" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 50,
    paddingBottom: 14,
    paddingHorizontal: 16,
    backgroundColor: "#0f172a",
    borderBottomWidth: 1,
    borderColor: "#1e293b",
    gap: 8,
  },
  backBtn: { padding: 4, marginRight: 6 },
  headerTitle: { color: "#FFF", fontSize: 17, fontWeight: "bold" },
  headerSubtitle: { color: "#64748B", fontSize: 12, marginTop: 2 },
  iconBtn: {
    padding: 8,
    backgroundColor: "#7C3AED15",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#7C3AED30",
  },

  filtros: {
    flexDirection: "row",
    padding: 10,
    gap: 8,
    backgroundColor: "#0f172a",
    borderBottomWidth: 1,
    borderColor: "#1e293b",
  },
  filtroBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#1e293b",
    alignItems: "center",
  },
  filtroBtnActivo: { backgroundColor: "#7C3AED" },
  filtroText: { color: "#94A3B8", fontSize: 12, fontWeight: "600" },
  filtroTextActivo: { color: "#FFF" },

  sesionesBox: { height: 140, backgroundColor: "#0b1220" },
  sesionCard: {
    width: 130,
    marginVertical: 10,
    marginRight: 8,
    padding: 10,
    borderRadius: 12,
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#1e293b",
  },
  sesionCardActiva: { borderColor: "#7C3AED", backgroundColor: "#1e1b3a" },
  sesionAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#7C3AED",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 6,
  },
  sesionAvatarText: { color: "#FFF", fontWeight: "bold" },
  sesionNombre: { color: "#FFF", fontSize: 12, fontWeight: "700" },
  sesionPreview: { color: "#64748B", fontSize: 10, marginTop: 2 },
  badgeUnread: {
    position: "absolute",
    top: 6,
    right: 6,
    backgroundColor: "#dc3545",
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  badgeUnreadText: { color: "#FFF", fontSize: 9, fontWeight: "bold" },
  badgeAnon: {
    position: "absolute",
    bottom: 6,
    right: 6,
    backgroundColor: "#334155",
    borderRadius: 8,
    padding: 3,
  },

  emptyBox: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#7C3AED",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  retryText: { color: "#FFF", fontSize: 12, fontWeight: "700" },

  convBox: { flex: 1 },
  emptyConv: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8, padding: 24 },
  emptyConvText: { color: "#64748B", fontSize: 14 },
  emptyConvSub: { color: "#475569", fontSize: 12, textAlign: "center", marginTop: 6 },
  emptyText: { color: "#64748B", fontSize: 13, textAlign: "center", padding: 16 },

  acciones: {
    flexDirection: "row",
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 6,
    backgroundColor: "#0f172a",
    borderBottomWidth: 1,
    borderColor: "#1e293b",
  },
  accionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#7C3AED",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  accionText: { color: "#FFF", fontSize: 11, fontWeight: "700" },

  mensajesArea: { flex: 1, backgroundColor: "#020617" },
  msgRow: { marginBottom: 10, flexDirection: "row" },
  msgLeft: { justifyContent: "flex-start" },
  msgRight: { justifyContent: "flex-end" },
  msgBubble: {
    maxWidth: "80%",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
  },
  msgCliente: {
    backgroundColor: "#1e293b",
    borderTopLeftRadius: 2,
  },
  msgAdmin: {
    backgroundColor: "#7C3AED",
    borderTopRightRadius: 2,
  },
  msgIA: {
    backgroundColor: "#6c5ce7",
    borderTopRightRadius: 2,
  },
  msgRemitente: { fontSize: 10, fontWeight: "700", color: "#FFF", marginBottom: 3, opacity: 0.8 },
  msgTexto: { color: "#FFF", fontSize: 13, lineHeight: 18 },
  msgHora: { color: "rgba(255,255,255,0.6)", fontSize: 9, marginTop: 4, alignSelf: "flex-end" },

  rapidas: {
    backgroundColor: "#0f172a",
    maxHeight: 40,
    borderTopWidth: 1,
    borderColor: "#1e293b",
  },
  rapidaChip: {
    backgroundColor: "#1e293b",
    borderWidth: 1,
    borderColor: "#334155",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginRight: 6,
    marginVertical: 6,
  },
  rapidaText: { color: "#F1F5F9", fontSize: 11 },

  inputRow: {
    flexDirection: "row",
    padding: 10,
    gap: 8,
    backgroundColor: "#0f172a",
    borderTopWidth: 1,
    borderColor: "#1e293b",
  },
  input: {
    flex: 1,
    backgroundColor: "#0b1220",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    color: "#E2E8F0",
    fontSize: 13,
    borderWidth: 1,
    borderColor: "#1e293b",
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#7C3AED",
    justifyContent: "center",
    alignItems: "center",
  },
  sendBtnOff: { backgroundColor: "#1e293b", opacity: 0.6 },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalBox: {
    width: "100%",
    backgroundColor: "#0f172a",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#1e293b",
  },
  modalTitle: { color: "#FFF", fontSize: 15, fontWeight: "bold", marginBottom: 12 },
  modalItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderColor: "#1e293b",
  },
  modalItemText: { color: "#FFF", fontSize: 13, fontWeight: "600" },
  modalItemSub: { color: "#64748B", fontSize: 11, marginTop: 2 },
  modalClose: {
    marginTop: 12,
    backgroundColor: "#1e293b",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  modalCloseText: { color: "#FFF", fontWeight: "600" },

  auditItem: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderColor: "#1e293b",
  },
  auditAccion: { color: "#7C3AED", fontSize: 12, fontWeight: "700" },
  auditMeta: { color: "#94A3B8", fontSize: 11, marginTop: 2 },
  auditFecha: { color: "#64748B", fontSize: 10, marginTop: 2 },
});