// src/screens/SolicitudesScreen.js  (CLIENTE — PRO + theme-aware)
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  View,
  TextInput,
  Platform,
  useColorScheme,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Text } from "../i18n/ui";
import { usePreferences } from "../context/PreferencesContext";
import { fetchSolicitudes } from "../services/api";

const _fetchSolicitudes = fetchSolicitudes || (async () => []);

// ============================================================
// PALETAS — light / dark
// ============================================================
const PALETTES = {
  light: {
    background: "#F5F6FA",
    surface: "#FFFFFF",
    surfaceAlt: "#F8FAFC",
    text: "#0F172A",
    textSecondary: "#334155",
    subtle: "#64748B",
    muted: "#94A3B8",
    border: "#EEF0F4",
    divider: "#E5E7EB",
    primary: "#E91E63",
    primarySoft: "#FCE7F3",
    chipBg: "#FFFFFF",
    chipBorder: "#E5E7EB",
    searchBg: "#F5F6FA",
    iconBg: "#F1F5F9",
    pedidoChipBg: "#F8FAFC",
    respuestaBg: "#F8FAFC",
    emptyIconBg: "#F1F5F9",
    shadow: "#0F172A",
  },
  dark: {
    background: "#0B1220",
    surface: "#111A2E",
    surfaceAlt: "#16213B",
    text: "#F8FAFC",
    textSecondary: "#E2E8F0",
    subtle: "#94A3B8",
    muted: "#64748B",
    border: "#1E293B",
    divider: "#1E293B",
    primary: "#F472B6",
    primarySoft: "rgba(244,114,182,0.15)",
    chipBg: "#111A2E",
    chipBorder: "#1E293B",
    searchBg: "#111A2E",
    iconBg: "#1E293B",
    pedidoChipBg: "#16213B",
    respuestaBg: "#16213B",
    emptyIconBg: "#1E293B",
    shadow: "#000000",
  },
};

// ============================================================
// ESTADOS — colores + icono Ionicons válido
// ============================================================
const getEstadoStyles = (isDark) => ({
  pendiente: {
    color: isDark ? "#FBBF24" : "#D97706",
    bg: isDark ? "rgba(251,191,36,0.15)" : "#FEF3C7",
    icon: "hourglass-outline",
    label: "Pendiente",
  },
  en_revision: {
    color: isDark ? "#60A5FA" : "#2563EB",
    bg: isDark ? "rgba(96,165,250,0.15)" : "#DBEAFE",
    icon: "eye-outline",
    label: "En revisión",
  },
  aprobada: {
    color: isDark ? "#34D399" : "#059669",
    bg: isDark ? "rgba(52,211,153,0.15)" : "#D1FAE5",
    icon: "checkmark-circle-outline",
    label: "Aprobada",
  },
  rechazada: {
    color: isDark ? "#F87171" : "#DC2626",
    bg: isDark ? "rgba(248,113,113,0.15)" : "#FEE2E2",
    icon: "close-circle-outline",
    label: "Rechazada",
  },
  resuelta: {
    color: isDark ? "#34D399" : "#059669",
    bg: isDark ? "rgba(52,211,153,0.15)" : "#D1FAE5",
    icon: "checkmark-done-outline",
    label: "Resuelta",
  },
  cancelada: {
    color: isDark ? "#94A3B8" : "#64748B",
    bg: isDark ? "rgba(148,163,184,0.15)" : "#F1F5F9",
    icon: "ban-outline",
    label: "Cancelada",
  },
});

const getTipoStyles = (isDark) => ({
  devolucion: {
    icon: "return-down-back-outline",
    label: "Devolución",
    color: isDark ? "#F472B6" : "#DB2777",
    bg: isDark ? "rgba(244,114,182,0.15)" : "#FCE7F3",
  },
  garantia: {
    icon: "shield-checkmark-outline",
    label: "Garantía",
    color: isDark ? "#60A5FA" : "#2563EB",
    bg: isDark ? "rgba(96,165,250,0.15)" : "#DBEAFE",
  },
  reporte: {
    icon: "alert-circle-outline",
    label: "Reporte",
    color: isDark ? "#FBBF24" : "#D97706",
    bg: isDark ? "rgba(251,191,36,0.15)" : "#FEF3C7",
  },
});

const normalize = (s = {}) => ({
  id: String(s.id || s._id || ""),
  numero: s.numero || s.folio || (s._id ? s._id.slice(-6).toUpperCase() : ""),
  tipo: String(s.tipo || "reporte").toLowerCase(),
  estado: String(s.estado || "pendiente").toLowerCase(),
  descripcion: s.descripcion || "",
  respuesta: s.respuesta || "",
  pedido: s.pedido_id || s.pedido?.numero_pedido || "",
  fecha: s.createdAt || s.created_at || s.fecha || null,
  fechaTexto: (() => {
    const f = s.createdAt || s.created_at || s.fecha;
    if (!f) return "";
    try {
      return new Date(f).toLocaleDateString("es-MX", {
        day: "2-digit", month: "short", year: "numeric",
      });
    } catch { return ""; }
  })(),
});

const FILTROS = [
  { key: "todas",       label: "Todas",       icon: "apps-outline" },
  { key: "pendiente",   label: "Pendientes",  icon: "hourglass-outline" },
  { key: "en_revision", label: "En revisión", icon: "eye-outline" },
  { key: "resuelta",    label: "Resueltas",   icon: "checkmark-done-outline" },
];

export default function SolicitudesScreen({ navigation }) {
  const prefs = usePreferences() || {};
  const mode = prefs.mode || "system";
  const systemScheme = useColorScheme();

  const resolvedMode =
    mode === "system" ? (systemScheme === "dark" ? "dark" : "light") : mode;

  const theme = useMemo(
    () => PALETTES[resolvedMode] || PALETTES.light,
    [resolvedMode]
  );
  const isDark = resolvedMode === "dark";

  const ESTADOS = useMemo(() => getEstadoStyles(isDark), [isDark]);
  const TIPOS = useMemo(() => getTipoStyles(isDark), [isDark]);

  const [solicitudes, setSolicitudes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [filtro, setFiltro] = useState("todas");
  const [search, setSearch] = useState("");

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(false);
    try {
      const raw = await _fetchSolicitudes();
      const list = Array.isArray(raw)
        ? raw
        : Array.isArray(raw?.solicitudes)
        ? raw.solicitudes
        : Array.isArray(raw?.data)
        ? raw.data
        : [];
      setSolicitudes(list.map(normalize));
    } catch (e) {
      console.warn("[SolicitudesScreen] load:", e?.message || e);
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = () => {
    setRefreshing(true);
    load(true);
  };

  const filtradas = solicitudes.filter((s) => {
    if (filtro !== "todas" && s.estado !== filtro) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        s.numero.toLowerCase().includes(q) ||
        s.descripcion.toLowerCase().includes(q) ||
        s.tipo.toLowerCase().includes(q) ||
        String(s.pedido).toLowerCase().includes(q)
      );
    }
    return true;
  });

  const counts = {
    todas: solicitudes.length,
    pendiente: solicitudes.filter((s) => s.estado === "pendiente").length,
    en_revision: solicitudes.filter((s) => s.estado === "en_revision").length,
    resuelta: solicitudes.filter((s) => s.estado === "resuelta").length,
  };

  // ─── Tarjeta
  const renderItem = ({ item }) => {
    const tipo = TIPOS[item.tipo] || TIPOS.reporte;
    const estado = ESTADOS[item.estado] || ESTADOS.pendiente;

    return (
      <TouchableOpacity
        style={[
          styles.card,
          {
            backgroundColor: theme.surface,
            borderColor: theme.border,
            shadowColor: theme.shadow,
          },
        ]}
        onPress={() =>
          navigation.navigate("SolicitudDetalle", { id: item.id, solicitud: item })
        }
        activeOpacity={0.85}
      >
        <View style={styles.cardTop}>
          <View style={styles.cardTopLeft}>
            <View
              style={[styles.tipoIconWrap, { backgroundColor: tipo.bg }]}
            >
              <Ionicons name={tipo.icon} size={18} color={tipo.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTipo, { color: theme.text }]}>
                {tipo.label}
              </Text>
              <Text style={[styles.cardNumero, { color: theme.subtle }]}>
                #{item.numero} · {item.fechaTexto}
              </Text>
            </View>
          </View>

          <View style={[styles.estadoPill, { backgroundColor: estado.bg }]}>
            <Ionicons name={estado.icon} size={11} color={estado.color} />
            <Text style={[styles.estadoText, { color: estado.color }]}>
              {estado.label}
            </Text>
          </View>
        </View>

        {!!item.pedido && (
          <View
            style={[styles.pedidoChip, { backgroundColor: theme.pedidoChipBg }]}
          >
            <Ionicons name="cube-outline" size={12} color={theme.subtle} />
            <Text style={[styles.pedidoChipText, { color: theme.subtle }]}>
              Pedido {item.pedido}
            </Text>
          </View>
        )}

        {!!item.descripcion && (
          <Text
            style={[styles.descripcion, { color: theme.textSecondary }]}
            numberOfLines={2}
          >
            {item.descripcion}
          </Text>
        )}

        {!!item.respuesta && (
          <View
            style={[
              styles.respuestaBox,
              {
                borderTopColor: theme.border,
                backgroundColor: theme.respuestaBg,
              },
            ]}
          >
            <View style={styles.respuestaHeader}>
              <Ionicons
                name="chatbubble-ellipses-outline"
                size={13}
                color={isDark ? "#60A5FA" : "#2563EB"}
              />
              <Text
                style={[
                  styles.respuestaLabel,
                  { color: isDark ? "#60A5FA" : "#2563EB" },
                ]}
              >
                Respuesta del equipo
              </Text>
            </View>
            <Text
              style={[styles.respuestaText, { color: theme.subtle }]}
              numberOfLines={3}
            >
              {item.respuesta}
            </Text>
          </View>
        )}

        <View style={styles.cardFooter}>
          <Text style={[styles.verDetalle, { color: theme.primary }]}>
            Ver detalle
          </Text>
          <Ionicons name="arrow-forward" size={14} color={theme.primary} />
        </View>
      </TouchableOpacity>
    );
  };

  // ─── Empty state
  const renderEmpty = () => {
    if (loading) return null;
    return (
      <View style={styles.emptyWrap}>
        <View
          style={[styles.emptyIconWrap, { backgroundColor: theme.emptyIconBg }]}
        >
          <MaterialCommunityIcons
            name={error ? "alert-circle-outline" : "clipboard-text-outline"}
            size={56}
            color={theme.muted}
          />
        </View>
        <Text style={[styles.emptyTitle, { color: theme.text }]}>
          {error
            ? "No se pudieron cargar tus solicitudes"
            : "Aún no tienes solicitudes"}
        </Text>
        <Text style={[styles.emptySub, { color: theme.subtle }]}>
          {error
            ? "Verifica tu conexión e intenta de nuevo."
            : "Crea una devolución, garantía o reporte y aparecerá aquí."}
        </Text>

        {!error && (
          <TouchableOpacity
            style={[
              styles.emptyBtn,
              {
                backgroundColor: theme.primary,
                shadowColor: theme.primary,
              },
            ]}
            onPress={() => navigation.navigate("NuevaSolicitud")}
            activeOpacity={0.85}
          >
            <Ionicons name="add-circle-outline" size={18} color="#FFF" />
            <Text style={styles.emptyBtnText}>Crear mi primera solicitud</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // ─── Header
  const Header = () => (
    <View
      style={[
        styles.headerWrap,
        {
          backgroundColor: theme.surface,
          borderBottomColor: theme.border,
        },
      ]}
    >
      <View style={styles.headerTop}>
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: theme.iconBg }]}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={22} color={theme.text} />
        </TouchableOpacity>

        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>
            Mis Solicitudes
          </Text>
          <Text style={[styles.headerSub, { color: theme.muted }]}>
            {solicitudes.length}{" "}
            {solicitudes.length === 1 ? "solicitud" : "solicitudes"}
          </Text>
        </View>

        <TouchableOpacity
          style={[
            styles.newBtn,
            {
              backgroundColor: theme.primary,
              shadowColor: theme.primary,
            },
          ]}
          onPress={() => navigation.navigate("NuevaSolicitud")}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={22} color="#FFF" />
        </TouchableOpacity>
      </View>

      <View
        style={[
          styles.searchWrap,
          { backgroundColor: theme.searchBg, borderColor: theme.border },
        ]}
      >
        <Ionicons name="search" size={18} color={theme.muted} />
        <TextInput
          style={[styles.searchInput, { color: theme.text }]}
          placeholder="Buscar por folio, pedido o tipo..."
          placeholderTextColor={theme.muted}
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch("")}>
            <Ionicons name="close-circle" size={18} color={theme.muted} />
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        horizontal
        data={FILTROS}
        keyExtractor={(f) => f.key}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsRow}
        renderItem={({ item }) => {
          const activo = filtro === item.key;
          const count = counts[item.key] ?? 0;
          return (
            <TouchableOpacity
              onPress={() => setFiltro(item.key)}
              activeOpacity={0.85}
              style={[
                styles.chip,
                {
                  backgroundColor: activo
                    ? theme.primary
                    : theme.chipBg,
                  borderColor: activo
                    ? theme.primary
                    : theme.chipBorder,
                },
              ]}
            >
              <Ionicons
                name={item.icon}
                size={14}
                color={activo ? "#FFF" : theme.subtle}
              />
              <Text
                style={[
                  styles.chipText,
                  { color: activo ? "#FFF" : theme.subtle },
                ]}
              >
                {item.label}
              </Text>
              {count > 0 && (
                <View
                  style={[
                    styles.chipCount,
                    {
                      backgroundColor: activo
                        ? "rgba(255,255,255,0.25)"
                        : theme.iconBg,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.chipCountText,
                      { color: activo ? "#FFF" : theme.subtle },
                    ]}
                  >
                    {count}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );

  return (
    <SafeAreaView
      style={[styles.page, { backgroundColor: theme.background }]}
      edges={["top", "left", "right"]}
    >
      <Header />

      {loading && !solicitudes.length ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={{ color: theme.muted, marginTop: 12 }}>
            Cargando solicitudes…
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtradas}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={renderEmpty}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.primary}
              colors={[theme.primary]}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

// ============================================================
// ESTILOS (solo layout; colores vienen del theme)
// ============================================================
const styles = StyleSheet.create({
  page: { flex: 1 },

  headerWrap: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: -0.3,
  },
  headerSub: {
    fontSize: 11,
    marginTop: 2,
    fontWeight: "600",
  },
  newBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },

  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
    marginTop: 6,
    marginBottom: 10,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 13.5,
    paddingVertical: 0,
  },

  chipsRow: {
    gap: 8,
    paddingVertical: 4,
    paddingBottom: 6,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipText: { fontSize: 12, fontWeight: "800" },
  chipCount: {
    minWidth: 20,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 999,
    alignItems: "center",
  },
  chipCountText: { fontSize: 10, fontWeight: "900" },

  listContent: {
    padding: 14,
    paddingBottom: 30,
    flexGrow: 1,
    gap: 12,
  },

  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 10,
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  cardTopLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  tipoIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTipo: { fontSize: 14.5, fontWeight: "900", letterSpacing: -0.2 },
  cardNumero: { fontSize: 11.5, marginTop: 2, fontWeight: "600" },

  estadoPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
  },
  estadoText: { fontSize: 10.5, fontWeight: "900" },

  pedidoChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  pedidoChipText: { fontSize: 11, fontWeight: "700" },

  descripcion: { fontSize: 12.5, lineHeight: 18, fontWeight: "500" },

  respuestaBox: {
    borderRadius: 12,
    borderTopWidth: 1,
    paddingTop: 10,
    paddingBottom: 10,
    paddingHorizontal: 12,
    gap: 4,
  },
  respuestaHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 2,
  },
  respuestaLabel: { fontSize: 11, fontWeight: "900" },
  respuestaText: { fontSize: 12, lineHeight: 17 },

  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 6,
    marginTop: 2,
  },
  verDetalle: { fontSize: 12, fontWeight: "900" },

  emptyWrap: {
    padding: 30,
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    gap: 8,
  },
  emptyIconWrap: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "900",
    textAlign: "center",
    marginTop: 6,
  },
  emptySub: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 19,
    paddingHorizontal: 16,
  },
  emptyBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 13,
    paddingHorizontal: 22,
    borderRadius: 999,
    marginTop: 14,
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  emptyBtnText: { color: "#FFF", fontSize: 14, fontWeight: "900" },

  center: {
    padding: 30,
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    gap: 10,
  },
});