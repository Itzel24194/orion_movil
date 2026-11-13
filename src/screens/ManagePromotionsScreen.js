// src/screens/ManagePromotionsScreen.js
// ============================================================
// Gestión de Promociones — Admin (estilo ManageOrdersScreen)
// ============================================================
import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Modal,
  FlatList,
  RefreshControl,
  Text as RNText,
  Alert as RNAlert,
  Platform,
  Keyboard,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

// ⭐ Text/Alert con fallback defensivo
let Text = RNText;
let Alert = RNAlert;
try {
  const i18nUI = require("../i18n/ui");
  if (i18nUI && i18nUI.Text) Text = i18nUI.Text;
  if (i18nUI && i18nUI.Alert) Alert = i18nUI.Alert;
} catch (e) {
  // usa nativos
}

// ⭐ Servicios de la API
import { request } from "../services/api";

// ============================================================
// ENDPOINTS
// ============================================================
const EP_PROMOS = "/api/v1/admin/promociones";
const EP_PROMO = (id) => `/api/v1/admin/promociones/${id}`;
const EP_TOGGLE = (id) => `/api/v1/admin/promociones/${id}/toggle`;

async function fetchPromociones() {
  const data = await request(EP_PROMOS);
  return Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
}
async function createPromo(payload) {
  return request(EP_PROMOS, { method: "POST", body: payload });
}
async function updatePromo(id, payload) {
  return request(EP_PROMO(id), { method: "PUT", body: payload });
}
async function deletePromo(id) {
  return request(EP_PROMO(id), { method: "DELETE" });
}
async function togglePromo(id) {
  return request(EP_TOGGLE(id), { method: "POST" });
}

// ============================================================
// HELPERS
// ============================================================
const formatFecha = (v) => {
  if (!v) return "—";
  const d = new Date(v);
  if (isNaN(d)) return "—";
  return d.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const valorFormateado = (p) => {
  if (!p) return "—";
  if (p.tipo === "porcentaje") return `${p.valor}%`;
  if (p.tipo === "envio_gratis") return "Envío Gratis";
  return `$${Number(p.valor || 0).toFixed(2)}`;
};

const parseFecha = (s) => {
  if (!s) return null;
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return isNaN(d.getTime()) ? null : d;
};

const fechaEnRango = (fecha, desde, hasta) => {
  if (!fecha) return false;
  const d = fecha instanceof Date ? fecha : new Date(fecha);
  if (isNaN(d.getTime())) return false;
  if (desde && d < desde) return false;
  if (hasta && d > hasta) return false;
  return true;
};

const normalizar = (s) =>
  String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const PAGE_SIZES = [10, 25, 50, 0];
const MAX_PAGE_BUTTONS = 5;

const calcularPaginas = (current, total) => {
  if (total <= MAX_PAGE_BUTTONS + 2) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const pages = new Set([1, total]);
  pages.add(current);
  for (let i = 1; i <= 2; i++) {
    if (current - i > 1) pages.add(current - i);
    if (current + i < total) pages.add(current + i);
  }
  const sorted = Array.from(pages).sort((a, b) => a - b);
  const out = [];
  let prev = 0;
  for (const p of sorted) {
    if (p - prev > 1) out.push("…");
    out.push(p);
    prev = p;
  }
  return out;
};

// ============================================================
// COMPONENTE
// ============================================================
export default function ManagePromotionsScreen({ navigation }) {
  const [promos, setPromos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [busqueda, setBusqueda] = useState("");
  const [busquedaDebounced, setBusquedaDebounced] = useState("");
  const debounceRef = useRef(null);

  const [filtroTipo, setFiltroTipo] = useState(null);
  const [filtroEstado, setFiltroEstado] = useState(null);
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [mostrarFechas, setMostrarFechas] = useState(false);

  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const listRef = useRef(null);

  const [modalVisible, setModalVisible] = useState(false);
  const [editando, setEditando] = useState(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    codigo: "",
    nombre: "",
    tipo: "porcentaje",
    valor: "",
    fecha_inicio: "",
    fecha_fin: "",
    minimo_compra: "",
    uso_maximo: "",
    descuento_maximo: "",
    activo: true,
  });

  // ------------------------------------------------------------
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setBusquedaDebounced(busqueda);
    }, 150);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [busqueda]);

  const loadPromos = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      const data = await fetchPromociones();
      setPromos(Array.isArray(data) ? data : []);
    } catch (error) {
      console.log("⚠️ Error cargando promociones:", error && error.message);
      Alert.alert("Error", "No se pudieron cargar las promociones.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadPromos();
  }, [loadPromos]);

  useEffect(() => {
    const unsub = navigation.addListener("focus", () => {
      loadPromos(false);
    });
    return unsub;
  }, [navigation, loadPromos]);

  const onRefresh = () => {
    setRefreshing(true);
    setPage(1);
    loadPromos(false);
  };

  useEffect(() => {
    setPage(1);
    if (listRef.current && listRef.current.scrollToOffset) {
      listRef.current.scrollToOffset({ offset: 0, animated: false });
    }
  }, [
    busquedaDebounced,
    filtroTipo,
    filtroEstado,
    fechaDesde,
    fechaHasta,
    pageSize,
  ]);

  const stats = useMemo(() => {
    let activas = 0;
    let proximas = 0;
    let expiradas = 0;
    const now = new Date();
    const en7dias = new Date(now.getTime() + 7 * 864e5);

    promos.forEach((p) => {
      if (!p) return;
      if (p.estado === "activa" || p.estado === "programada") {
        activas++;
        const fin = p.fecha_fin ? new Date(p.fecha_fin) : null;
        if (fin && fin <= en7dias) proximas++;
      }
      if (p.estado === "finalizada" || p.estado === "expirada") expiradas++;
    });

    return { total: promos.length, activas, proximas, expiradas };
  }, [promos]);

  const promosFiltradas = useMemo(() => {
    const txt = normalizar(busquedaDebounced.trim());
    const desde = parseFecha(fechaDesde);
    const hasta = parseFecha(fechaHasta);

    return promos.filter((p) => {
      if (!p) return false;

      if (txt) {
        const campos = [
          p.codigo,
          p.nombre,
          p.descripcion,
          p.tipo,
          p.estado,
          p.segmento,
        ];
        if (!campos.some((v) => normalizar(v).includes(txt))) return false;
      }

      if (filtroTipo && p.tipo !== filtroTipo) return false;
      if (filtroEstado && p.estado !== filtroEstado) return false;

      if (desde || hasta) {
        const fi = p.fecha_inicio ? new Date(p.fecha_inicio) : null;
        if (!fi || isNaN(fi.getTime())) return false;
        if (!fechaEnRango(fi, desde, hasta)) return false;
      }

      return true;
    });
  }, [
    promos,
    busquedaDebounced,
    filtroTipo,
    filtroEstado,
    fechaDesde,
    fechaHasta,
  ]);

  const totalPaginas = useMemo(() => {
    if (pageSize === 0) return 1;
    return Math.max(1, Math.ceil(promosFiltradas.length / pageSize));
  }, [promosFiltradas.length, pageSize]);

  const pageSegura = Math.min(page, totalPaginas);

  const promosVisibles = useMemo(() => {
    if (pageSize === 0) return promosFiltradas;
    const start = (pageSegura - 1) * pageSize;
    return promosFiltradas.slice(start, start + pageSize);
  }, [promosFiltradas, pageSize, pageSegura]);

  const irAPagina = (n) => {
    const p = Math.max(1, Math.min(n, totalPaginas));
    setPage(p);
    if (listRef.current && listRef.current.scrollToOffset) {
      listRef.current.scrollToOffset({ offset: 0, animated: true });
    }
  };

  const abrirCrear = () => {
    setEditando(null);
    setForm({
      codigo: "",
      nombre: "",
      tipo: "porcentaje",
      valor: "",
      fecha_inicio: "",
      fecha_fin: "",
      minimo_compra: "",
      uso_maximo: "",
      descuento_maximo: "",
      activo: true,
    });
    setModalVisible(true);
  };

  const abrirEditar = (promo) => {
    setEditando(promo);
    setForm({
      codigo: promo.codigo || "",
      nombre: promo.nombre || "",
      tipo: promo.tipo || "porcentaje",
      valor: String(promo.valor ?? ""),
      fecha_inicio: (promo.fecha_inicio || "").slice(0, 10),
      fecha_fin: (promo.fecha_fin || "").slice(0, 10),
      minimo_compra: String(promo.minimo_compra ?? ""),
      uso_maximo: String(promo.usos_max ?? ""),
      descuento_maximo: String(promo.descuento_maximo ?? ""),
      activo: promo.activo !== false,
    });
    setModalVisible(true);
  };

  const guardar = async () => {
    if (!form.nombre.trim()) {
      Alert.alert("Campos requeridos", "El nombre es obligatorio.");
      return;
    }
    if (!form.valor || isNaN(Number(form.valor))) {
      Alert.alert("Valor inválido", "Ingresa un valor numérico.");
      return;
    }

    const payload = {
      codigo: form.codigo.trim() ? form.codigo.trim().toUpperCase() : null,
      nombre: form.nombre.trim(),
      tipo: form.tipo,
      valor: Number(form.valor),
      fecha_inicio: form.fecha_inicio || null,
      fecha_fin: form.fecha_fin || null,
      minimo_compra: form.minimo_compra ? Number(form.minimo_compra) : 0,
      usos_max: form.uso_maximo ? Number(form.uso_maximo) : 0,
      descuento_maximo: form.descuento_maximo
        ? Number(form.descuento_maximo)
        : 0,
      activo: form.activo,
    };

    setSaving(true);
    try {
      if (editando) {
        await updatePromo(editando._id, payload);
        Alert.alert("Éxito", "Promoción actualizada correctamente.");
      } else {
        await createPromo(payload);
        Alert.alert("Éxito", "Promoción creada correctamente.");
      }
      setModalVisible(false);
      loadPromos(false);
    } catch (error) {
      console.log("⚠️ Error guardando promoción:", error && error.message);
      Alert.alert(
        "Error",
        (error && error.message) || "No se pudo guardar la promoción."
      );
    } finally {
      setSaving(false);
    }
  };

  const eliminar = (promo) => {
    Alert.alert(
      "Eliminar promoción",
      `¿Eliminar "${promo.codigo || promo.nombre}"? Esta acción no se puede deshacer.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            try {
              await deletePromo(promo._id);
              Alert.alert("Éxito", "Promoción eliminada.");
              loadPromos(false);
            } catch (error) {
              console.log("⚠️ Error eliminando:", error && error.message);
              Alert.alert("Error", "No se pudo eliminar la promoción.");
            }
          },
        },
      ]
    );
  };

  const toggleEstado = async (promo) => {
    try {
      await togglePromo(promo._id);
      loadPromos(false);
    } catch (error) {
      console.log("⚠️ Error cambiando estado:", error && error.message);
      Alert.alert("Error", "No se pudo cambiar el estado.");
    }
  };

  const limpiarFiltros = () => {
    setBusqueda("");
    setBusquedaDebounced("");
    setFiltroTipo(null);
    setFiltroEstado(null);
    setFechaDesde("");
    setFechaHasta("");
    setMostrarFechas(false);
    setPage(1);
  };

  const badgeEstado = (p) => {
    const map = {
      activa: { bg: "#10b98120", color: "#10b981", label: "Activa" },
      inactiva: { bg: "#ef444420", color: "#ef4444", label: "Inactiva" },
      finalizada: { bg: "#f59e0b20", color: "#f59e0b", label: "Finalizada" },
      expirada: { bg: "#f59e0b20", color: "#f59e0b", label: "Expirada" },
      programada: { bg: "#3b82f620", color: "#3b82f6", label: "Programada" },
    };
    const m = map[p.estado] || map.inactiva;
    return (
      <View style={[styles.badge, { backgroundColor: m.bg }]}>
        <Text style={[styles.badgeText, { color: m.color }]}>{m.label}</Text>
      </View>
    );
  };

  const badgeTipo = (p) => {
    const map = {
      porcentaje: { color: "#3b82f6", label: "% Descuento" },
      monto_fijo: { color: "#10b981", label: "Monto Fijo" },
      envio_gratis: { color: "#06b6d4", label: "Envío Gratis" },
    };
    const m = map[p.tipo] || map.monto_fijo;
    return (
      <View style={[styles.badge, { backgroundColor: `${m.color}20` }]}>
        <Text style={[styles.badgeText, { color: m.color }]}>{m.label}</Text>
      </View>
    );
  };

  const renderPromo = ({ item }) => {
    if (!item) return null;
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <View style={styles.cardTitleRow}>
              <Text style={styles.codigo}>{item.codigo || "—"}</Text>
              {badgeEstado(item)}
            </View>
            <Text style={styles.nombre} numberOfLines={1}>
              {item.nombre || "Sin nombre"}
            </Text>
          </View>
          <View style={styles.valorBox}>
            <MaterialCommunityIcons
              name="ticket-percent"
              size={20}
              color="#f59e0b"
            />
            <Text style={styles.valorText}>{valorFormateado(item)}</Text>
          </View>
        </View>

        <View style={styles.infoRow}>
          <View style={styles.infoItem}>
            <Ionicons name="calendar-outline" size={14} color="#64748B" />
            <Text style={styles.infoText}>
              {formatFecha(item.fecha_inicio)} → {formatFecha(item.fecha_fin)}
            </Text>
          </View>
          <View style={styles.infoItem}>
            <Ionicons name="repeat-outline" size={14} color="#64748B" />
            <Text style={styles.infoText}>
              {item.usos ?? 0} / {item.usos_max || "∞"}
            </Text>
          </View>
        </View>

        <View style={styles.infoRow}>
          <View style={styles.infoItem}>
            <Ionicons name="cart-outline" size={14} color="#64748B" />
            <Text style={styles.infoText}>
              Mín: ${Number(item.minimo_compra || 0).toFixed(2)}
            </Text>
          </View>
          {badgeTipo(item)}
        </View>

        {item.creado_automaticamente && (
          <View style={styles.autoRow}>
            <MaterialCommunityIcons name="robot" size={14} color="#a855f7" />
            <Text style={styles.autoText}>
              Automático · Segmento: {item.segmento || "—"}
              {(item.total_asignados || 0) > 0
                ? ` · ${item.total_asignados} usuarios`
                : ""}
            </Text>
          </View>
        )}

        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => abrirEditar(item)}
          >
            <Ionicons name="create-outline" size={16} color="#7C3AED" />
            <Text style={[styles.actionText, { color: "#7C3AED" }]}>
              Editar
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => toggleEstado(item)}
          >
            <Ionicons
              name={
                item.activo === false
                  ? "checkmark-circle-outline"
                  : "ban-outline"
              }
              size={16}
              color="#f59e0b"
            />
            <Text style={[styles.actionText, { color: "#f59e0b" }]}>
              {item.activo === false ? "Activar" : "Inactivar"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => eliminar(item)}
          >
            <Ionicons name="trash-outline" size={16} color="#ef4444" />
            <Text style={[styles.actionText, { color: "#ef4444" }]}>
              Eliminar
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderPaginationBar = () => {
    if (promosFiltradas.length === 0) return null;
    if (pageSize === 0) return null;
    if (totalPaginas <= 1) return null;

    const botones = calcularPaginas(pageSegura, totalPaginas);

    return (
      <View style={styles.paginationWrapper}>
        <TouchableOpacity
          style={[
            styles.pageArrowBtn,
            pageSegura === 1 && styles.pageArrowBtnDisabled,
          ]}
          onPress={() => irAPagina(pageSegura - 1)}
          disabled={pageSegura === 1}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons
            name="chevron-back"
            size={16}
            color={pageSegura === 1 ? "#475569" : "#FFF"}
          />
        </TouchableOpacity>

        {botones.map((b, i) =>
          b === "…" ? (
            <View key={`elip-${i}`} style={styles.pageEllipsis}>
              <Text style={styles.pageEllipsisText}>…</Text>
            </View>
          ) : (
            <TouchableOpacity
              key={`page-${b}`}
              style={[
                styles.pageNumBtn,
                b === pageSegura && styles.pageNumBtnActive,
              ]}
              onPress={() => irAPagina(b)}
              hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
            >
              <Text
                style={[
                  styles.pageNumText,
                  b === pageSegura && styles.pageNumTextActive,
                ]}
              >
                {b}
              </Text>
            </TouchableOpacity>
          )
        )}

        <TouchableOpacity
          style={[
            styles.pageArrowBtn,
            pageSegura === totalPaginas && styles.pageArrowBtnDisabled,
          ]}
          onPress={() => irAPagina(pageSegura + 1)}
          disabled={pageSegura === totalPaginas}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons
            name="chevron-forward"
            size={16}
            color={pageSegura === totalPaginas ? "#475569" : "#FFF"}
          />
        </TouchableOpacity>
      </View>
    );
  };

  const renderModal = () => (
    <Modal
      visible={modalVisible}
      animationType="slide"
      transparent
      onRequestClose={() => setModalVisible(false)}
    >
      <View style={styles.modalBackdrop}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {editando ? "Editar Promoción" : "Nueva Promoción"}
            </Text>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Ionicons name="close" size={24} color="#FFF" />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.label}>Código (opcional)</Text>
            <TextInput
              style={styles.input}
              value={form.codigo}
              onChangeText={(v) =>
                setForm({ ...form, codigo: v.toUpperCase() })
              }
              placeholder="PROMO-XXXX"
              placeholderTextColor="#475569"
              autoCapitalize="characters"
              autoCorrect={false}
            />

            <Text style={styles.label}>Nombre *</Text>
            <TextInput
              style={styles.input}
              value={form.nombre}
              onChangeText={(v) => setForm({ ...form, nombre: v })}
              placeholder="Ej: Promo Verano 2024"
              placeholderTextColor="#475569"
            />

            <Text style={styles.label}>Tipo</Text>
            <View style={styles.segmentedRow}>
              {["porcentaje", "monto_fijo", "envio_gratis"].map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[
                    styles.segment,
                    form.tipo === t && styles.segmentActive,
                  ]}
                  onPress={() => setForm({ ...form, tipo: t })}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      form.tipo === t && styles.segmentTextActive,
                    ]}
                  >
                    {t === "porcentaje"
                      ? "%"
                      : t === "monto_fijo"
                      ? "$"
                      : "Envío"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>
              Valor * {form.tipo === "porcentaje" ? "(%)" : "($)"}
            </Text>
            <TextInput
              style={styles.input}
              value={form.valor}
              onChangeText={(v) => setForm({ ...form, valor: v })}
              keyboardType="numeric"
              placeholder="20"
              placeholderTextColor="#475569"
            />

            <Text style={styles.label}>Fecha inicio (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.input}
              value={form.fecha_inicio}
              onChangeText={(v) => setForm({ ...form, fecha_inicio: v })}
              placeholder="2025-01-01"
              placeholderTextColor="#475569"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Text style={styles.label}>Fecha fin (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.input}
              value={form.fecha_fin}
              onChangeText={(v) => setForm({ ...form, fecha_fin: v })}
              placeholder="2025-12-31"
              placeholderTextColor="#475569"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Text style={styles.label}>Compra mínima ($)</Text>
            <TextInput
              style={styles.input}
              value={form.minimo_compra}
              onChangeText={(v) => setForm({ ...form, minimo_compra: v })}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor="#475569"
            />

            <Text style={styles.label}>Usos máximos (vacío = ilimitado)</Text>
            <TextInput
              style={styles.input}
              value={form.uso_maximo}
              onChangeText={(v) => setForm({ ...form, uso_maximo: v })}
              keyboardType="numeric"
              placeholder="100"
              placeholderTextColor="#475569"
            />

            <Text style={styles.label}>Descuento máximo ($, opcional)</Text>
            <TextInput
              style={styles.input}
              value={form.descuento_maximo}
              onChangeText={(v) => setForm({ ...form, descuento_maximo: v })}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor="#475569"
            />

            <TouchableOpacity
              style={styles.switchRow}
              onPress={() => setForm({ ...form, activo: !form.activo })}
            >
              <Ionicons
                name={form.activo ? "checkbox" : "square-outline"}
                size={22}
                color="#10b981"
              />
              <Text style={styles.switchText}>
                {form.activo ? "Activa" : "Inactiva"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.saveBtn, saving && { opacity: 0.6 }]}
              onPress={guardar}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.saveBtnText}>
                  {editando ? "Guardar Cambios" : "Crear Promoción"}
                </Text>
              )}
            </TouchableOpacity>

            <View style={{ height: 30 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  if (loading) {
    return (
      <SafeAreaView
        edges={["top", "left", "right"]}
        style={[styles.container, styles.loadingContainer]}
      >
        <ActivityIndicator size="large" color="#7C3AED" />
      </SafeAreaView>
    );
  }

  const hayFiltrosActivos =
    busquedaDebounced.length > 0 ||
    !!filtroTipo ||
    !!filtroEstado ||
    !!fechaDesde ||
    !!fechaHasta;

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.container}>
      {/* ==================== TOP BAR ==================== */}
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
          <Ionicons name="arrow-back" size={22} color="#FFF" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Gestión de Promociones</Text>
          <Text style={styles.subtitle}>
            {promos.length} promociones registradas
          </Text>
        </View>

        {/* ⭐ BOTÓN 🤖 — CORREGIDO: "GeneratePromotions" (con t) */}
        <TouchableOpacity
          style={[styles.iconBtn, { marginRight: 8 }]}
          onPress={() => navigation.navigate("GeneratePromotions")}
        >
          <MaterialCommunityIcons name="robot" size={20} color="#a855f7" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.iconBtn} onPress={abrirCrear}>
          <Ionicons name="add" size={20} color="#7C3AED" />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onRefresh}
          style={[styles.iconBtn, { marginLeft: 8 }]}
        >
          <Ionicons name="refresh" size={20} color="#7C3AED" />
        </TouchableOpacity>
      </View>

      {/* ==================== SELECTOR DE TAMAÑO ==================== */}
      <View style={styles.pageSizeRow}>
        <Text style={styles.pageSizeLabel}>Mostrar:</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingRight: 8 }}
        >
          {PAGE_SIZES.map((n) => {
            const activo = pageSize === n;
            return (
              <TouchableOpacity
                key={`size-${n}`}
                style={[
                  styles.pageSizeChip,
                  activo && styles.pageSizeChipActive,
                ]}
                onPress={() => setPageSize(n)}
                hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
              >
                <Text
                  style={[
                    styles.pageSizeChipText,
                    activo && styles.pageSizeChipTextActive,
                  ]}
                >
                  {n === 0 ? "Todo" : n}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ==================== STATS ==================== */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={[styles.statNum, { color: "#7C3AED" }]}>
            {stats.total}
          </Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statNum, { color: "#10b981" }]}>
            {stats.activas}
          </Text>
          <Text style={styles.statLabel}>Activas</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statNum, { color: "#f59e0b" }]}>
            {stats.proximas}
          </Text>
          <Text style={styles.statLabel}>Próx. vencer</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statNum, { color: "#ef4444" }]}>
            {stats.expiradas}
          </Text>
          <Text style={styles.statLabel}>Expiradas</Text>
        </View>
      </View>

      {/* ==================== BUSCADOR ==================== */}
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color="#64748B" />
          <TextInput
            style={styles.searchInput}
            value={busqueda}
            onChangeText={setBusqueda}
            placeholder="Código, nombre, descripción, tipo…"
            placeholderTextColor="#64748B"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={() => {
              setBusquedaDebounced(busqueda);
              Keyboard.dismiss();
            }}
          />
          {busqueda.length > 0 && (
            <TouchableOpacity
              onPress={() => setBusqueda("")}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close-circle" size={18} color="#64748B" />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={[
            styles.dateToggleBtn,
            mostrarFechas && styles.dateToggleBtnActive,
          ]}
          onPress={() => setMostrarFechas((v) => !v)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons
            name="calendar"
            size={18}
            color={mostrarFechas ? "#FFF" : "#94A3B8"}
          />
        </TouchableOpacity>

        {hayFiltrosActivos && (
          <TouchableOpacity
            style={styles.clearFiltersBtn}
            onPress={limpiarFiltros}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="refresh" size={16} color="#ef4444" />
          </TouchableOpacity>
        )}
      </View>

      {/* ==================== RANGO DE FECHAS ==================== */}
      {mostrarFechas && (
        <View style={styles.fechasRow}>
          <View style={styles.fechaBox}>
            <Text style={styles.fechaLabel}>Desde</Text>
            <TextInput
              style={styles.fechaInput}
              value={fechaDesde}
              onChangeText={setFechaDesde}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#475569"
              keyboardType={
                Platform.OS === "ios" ? "numbers-and-punctuation" : "default"
              }
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={10}
            />
          </View>
          <View style={styles.fechaBox}>
            <Text style={styles.fechaLabel}>Hasta</Text>
            <TextInput
              style={styles.fechaInput}
              value={fechaHasta}
              onChangeText={setFechaHasta}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#475569"
              keyboardType={
                Platform.OS === "ios" ? "numbers-and-punctuation" : "default"
              }
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={10}
            />
          </View>
        </View>
      )}

      {/* ==================== FILTRO ESTADO ==================== */}
      <View style={styles.filtersRow}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingRight: 8, gap: 8 }}
        >
          {[
            { key: null, label: "Todos" },
            { key: "activa", label: "Activas" },
            { key: "inactiva", label: "Inactivas" },
            { key: "programada", label: "Programadas" },
            { key: "finalizada", label: "Finalizadas" },
          ].map((f) => (
            <TouchableOpacity
              key={`est-${String(f.key)}`}
              style={[
                styles.filterChip,
                filtroEstado === f.key && styles.filterChipActive,
              ]}
              onPress={() => setFiltroEstado(f.key)}
              hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
            >
              <Text
                style={[
                  styles.filterChipText,
                  filtroEstado === f.key && styles.filterChipTextActive,
                ]}
              >
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* ==================== FILTRO TIPO ==================== */}
      <View style={styles.filtersRow}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingRight: 8, gap: 8 }}
        >
          {[
            { key: null, label: "Todos los tipos" },
            { key: "porcentaje", label: "% Descuento" },
            { key: "monto_fijo", label: "Monto Fijo" },
            { key: "envio_gratis", label: "Envío Gratis" },
          ].map((f) => (
            <TouchableOpacity
              key={`tipo-${String(f.key)}`}
              style={[
                styles.filterChip,
                filtroTipo === f.key && styles.filterChipActive,
              ]}
              onPress={() => setFiltroTipo(f.key)}
              hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
            >
              <Text
                style={[
                  styles.filterChipText,
                  filtroTipo === f.key && styles.filterChipTextActive,
                ]}
              >
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* ==================== CONTADOR ==================== */}
      {hayFiltrosActivos && (
        <Text style={styles.resultadosCount}>
          {promosFiltradas.length} resultado(s)
        </Text>
      )}

      {/* ==================== LISTA ==================== */}
      <View style={{ flex: 1 }}>
        <FlatList
          ref={listRef}
          data={promosVisibles}
          keyExtractor={(item) => String(item._id || item.codigo || "")}
          renderItem={renderPromo}
          contentContainerStyle={{ paddingTop: 4, paddingBottom: 20 }}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#7C3AED"
            />
          }
          onScroll={(e) => {
            const y = e.nativeEvent.contentOffset.y;
            setShowScrollTop(y > 300);
          }}
          scrollEventThrottle={100}
          ListEmptyComponent={
            <View style={styles.empty}>
              <MaterialCommunityIcons
                name="ticket-percent-outline"
                size={60}
                color="#334155"
              />
              <Text style={styles.emptyTitle}>No hay promociones</Text>
              <Text style={styles.emptySub}>
                {promos.length === 0
                  ? "Crea tu primera promoción para comenzar."
                  : "Ninguna promoción coincide con los filtros."}
              </Text>
              {promos.length === 0 && (
                <TouchableOpacity style={styles.emptyBtn} onPress={abrirCrear}>
                  <Ionicons name="add" size={18} color="#FFF" />
                  <Text style={styles.emptyBtnText}>Crear promoción</Text>
                </TouchableOpacity>
              )}
              {promos.length > 0 && hayFiltrosActivos && (
                <TouchableOpacity
                  style={[styles.emptyBtn, { backgroundColor: "#ef4444" }]}
                  onPress={limpiarFiltros}
                >
                  <Ionicons name="refresh" size={18} color="#FFF" />
                  <Text style={styles.emptyBtnText}>Limpiar filtros</Text>
                </TouchableOpacity>
              )}
            </View>
          }
        />
      </View>

      {/* ==================== PAGINACIÓN FIJA ABAJO ==================== */}
      {renderPaginationBar()}

      {/* ==================== VOLVER ARRIBA ==================== */}
      {showScrollTop && (
        <TouchableOpacity
          style={styles.scrollTopBtn}
          onPress={() => {
            if (listRef.current && listRef.current.scrollToOffset) {
              listRef.current.scrollToOffset({ offset: 0, animated: true });
            }
          }}
        >
          <Ionicons name="arrow-up" size={20} color="#FFF" />
        </TouchableOpacity>
      )}

      {renderModal()}
    </SafeAreaView>
  );
}

// ============================================================
// ESTILOS
// ============================================================
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#020617" },
  loadingContainer: { justifyContent: "center", alignItems: "center" },

  // ===== TOP BAR =====
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "android" ? 40 : 10,
    paddingBottom: 15,
    backgroundColor: "#0f172a",
    borderBottomWidth: 1,
    borderColor: "#1e293b",
  },
  backBtn: { padding: 6 },
  iconBtn: {
    padding: 8,
    backgroundColor: "#7C3AED15",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#7C3AED30",
  },
  title: { color: "#FFF", fontSize: 18, fontWeight: "bold" },
  subtitle: { color: "#64748B", fontSize: 12, marginTop: 2 },

  // ===== SELECTOR DE TAMAÑO =====
  pageSizeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    marginTop: 16,
    marginBottom: 16,
  },
  pageSizeLabel: { color: "#64748B", fontSize: 11 },
  pageSizeChip: {
    paddingHorizontal: 12,
    height: 28,
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#1e293b",
  },
  pageSizeChipActive: {
    backgroundColor: "#7C3AED30",
    borderColor: "#7C3AED",
  },
  pageSizeChipText: { color: "#94A3B8", fontSize: 11 },
  pageSizeChipTextActive: { color: "#7C3AED", fontWeight: "700" },

  // ===== STATS =====
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#1e293b",
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 6,
    alignItems: "center",
  },
  statNum: { fontSize: 16, fontWeight: "bold" },
  statLabel: { color: "#64748B", fontSize: 10, marginTop: 2 },

  // ===== BUSCADOR =====
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 20,
    marginBottom: 14,
  },
  searchBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#1e293b",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: "#FFF",
    fontSize: 13,
    paddingVertical: 0,
    paddingHorizontal: 0,
    height: 44,
    textAlignVertical: "center",
  },
  dateToggleBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#1e293b",
    justifyContent: "center",
    alignItems: "center",
  },
  dateToggleBtnActive: {
    backgroundColor: "#7C3AED",
    borderColor: "#7C3AED",
  },
  clearFiltersBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#ef444415",
    borderWidth: 1,
    borderColor: "#ef444440",
    justifyContent: "center",
    alignItems: "center",
  },

  // ===== RANGO DE FECHAS =====
  fechasRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 20,
    marginBottom: 14,
  },
  fechaBox: {
    flex: 1,
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#1e293b",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  fechaLabel: { color: "#64748B", fontSize: 10, marginBottom: 4 },
  fechaInput: {
    color: "#FFF",
    fontSize: 13,
    paddingVertical: 4,
    paddingHorizontal: 0,
    height: 28,
    textAlignVertical: "center",
  },

  // ===== FILTROS =====
  filtersRow: { paddingHorizontal: 20, marginBottom: 10 },
  filterChip: {
    paddingHorizontal: 14,
    height: 32,
    justifyContent: "center",
    borderRadius: 16,
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#1e293b",
  },
  filterChipActive: { backgroundColor: "#7C3AED", borderColor: "#7C3AED" },
  filterChipText: { color: "#94A3B8", fontSize: 12 },
  filterChipTextActive: { color: "#FFF", fontWeight: "600" },

  resultadosCount: {
    color: "#64748B",
    fontSize: 11,
    marginBottom: 8,
    paddingHorizontal: 20,
  },

  // ===== CARD =====
  card: {
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#1e293b",
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 14,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
    gap: 8,
  },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  codigo: { color: "#7C3AED", fontSize: 16, fontWeight: "bold" },
  nombre: { color: "#FFF", fontSize: 13, marginTop: 4 },
  valorBox: {
    alignItems: "center",
    backgroundColor: "#f59e0b15",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  valorText: {
    color: "#f59e0b",
    fontSize: 12,
    fontWeight: "bold",
    marginTop: 2,
  },

  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
    flexWrap: "wrap",
    gap: 6,
  },
  infoItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  infoText: { color: "#94A3B8", fontSize: 11 },

  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  badgeText: { fontSize: 10, fontWeight: "bold" },

  autoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
    backgroundColor: "#a855f715",
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 8,
  },
  autoText: { color: "#a855f7", fontSize: 11, fontWeight: "600" },

  actionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: "#1e293b",
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 8,
    minHeight: 32,
  },
  actionText: { fontSize: 12, fontWeight: "600" },

  // ===== PAGINACIÓN =====
  paginationWrapper: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 20,
    backgroundColor: "#020617",
    borderTopWidth: 1,
    borderTopColor: "#1e293b",
  },
  pageArrowBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: "#7C3AED",
    justifyContent: "center",
    alignItems: "center",
  },
  pageArrowBtnDisabled: { backgroundColor: "#111827" },
  pageNumBtn: {
    minWidth: 34,
    height: 34,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: "#111827",
    justifyContent: "center",
    alignItems: "center",
  },
  pageNumBtnActive: { backgroundColor: "#7C3AED" },
  pageNumText: { color: "#CBD5E1", fontSize: 12, fontWeight: "700" },
  pageNumTextActive: { color: "#FFF", fontWeight: "800" },
  pageEllipsis: {
    minWidth: 24,
    height: 34,
    justifyContent: "center",
    alignItems: "center",
  },
  pageEllipsisText: { color: "#64748B", fontSize: 14, fontWeight: "700" },

  // ===== EMPTY =====
  empty: { alignItems: "center", paddingVertical: 60, paddingHorizontal: 20 },
  emptyTitle: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "bold",
    marginTop: 12,
  },
  emptySub: {
    color: "#64748B",
    fontSize: 13,
    marginTop: 4,
    textAlign: "center",
  },
  emptyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#7C3AED",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 50,
    marginTop: 16,
  },
  emptyBtnText: { color: "#FFF", fontWeight: "bold", fontSize: 13 },

  // ===== SCROLL TOP =====
  scrollTopBtn: {
    position: "absolute",
    right: 20,
    bottom: 90,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#7C3AED",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 6,
  },

  // ===== MODAL =====
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    backgroundColor: "#0f172a",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: "90%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: { color: "#FFF", fontSize: 18, fontWeight: "bold" },
  label: {
    color: "#94A3B8",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 12,
    marginBottom: 6,
  },
  input: {
    backgroundColor: "#020617",
    borderWidth: 1,
    borderColor: "#1e293b",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#FFF",
    fontSize: 14,
    height: 44,
  },
  segmentedRow: { flexDirection: "row", gap: 8 },
  segment: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    backgroundColor: "#020617",
    borderWidth: 1,
    borderColor: "#1e293b",
    alignItems: "center",
    justifyContent: "center",
  },
  segmentActive: { backgroundColor: "#7C3AED", borderColor: "#7C3AED" },
  segmentText: { color: "#94A3B8", fontWeight: "600" },
  segmentTextActive: { color: "#FFF" },

  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 16,
    padding: 12,
    backgroundColor: "#020617",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#1e293b",
  },
  switchText: { color: "#FFF", fontSize: 14, fontWeight: "600" },

  saveBtn: {
    backgroundColor: "#7C3AED",
    borderRadius: 12,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
  },
  saveBtnText: { color: "#FFF", fontSize: 15, fontWeight: "bold" },
});