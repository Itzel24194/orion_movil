// src/screens/SolicitudesScreen.js  (CLIENTE — versión PRO estilo Liverpool)
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  View,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons, Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { Text } from "../i18n/ui";
import { usePreferences } from "../context/PreferencesContext";
import { fetchSolicitudes } from "../services/api";

const _fetchSolicitudes = fetchSolicitudes || (async () => []);

// ============================================================
// ESTADOS — con icono Ionicons válido (NO feather "warning"/"time")
// ============================================================
const ESTADOS = {
  pendiente:   { color: "#D97706", bg: "#FEF3C7", icon: "hourglass-outline",        label: "Pendiente" },
  en_revision: { color: "#2563EB", bg: "#DBEAFE", icon: "eye-outline",              label: "En revisión" },
  aprobada:    { color: "#059669", bg: "#D1FAE5", icon: "checkmark-circle-outline",  label: "Aprobada" },
  rechazada:   { color: "#DC2626", bg: "#FEE2E2", icon: "close-circle-outline",     label: "Rechazada" },
  resuelta:    { color: "#059669", bg: "#D1FAE5", icon: "checkmark-done-outline",   label: "Resuelta" },
  cancelada:   { color: "#64748B", bg: "#F1F5F9", icon: "ban-outline",              label: "Cancelada" },
};

const TIPOS = {
  devolucion: { icon: "return-down-back-outline", label: "Devolución" },
  garantia:   { icon: "shield-checkmark-outline", label: "Garantía" },
  reporte:    { icon: "alert-circle-outline",     label: "Reporte" },
};

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
  { key: "todas",       label: "Todas",        icon: "apps-outline" },
  { key: "pendiente",   label: "Pendientes",   icon: "hourglass-outline" },
  { key: "en_revision", label: "En revisión",  icon: "eye-outline" },
  { key: "resuelta",    label: "Resueltas",    icon: "checkmark-done-outline" },
];

export default function SolicitudesScreen({ navigation }) {
  const prefs = usePreferences() || {};
  const p = prefs.palette || {
    background: "#F5F6FA", surface: "#FFFFFF", text: "#0F172A",
    primary: "#E91E63", subtle: "#64748B", border: "#E5E7EB",
  };

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

  // ─── Filtro + búsqueda
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
          { backgroundColor: p.surface, borderColor: p.border },
        ]}
        onPress={() =>
          navigation.navigate("SolicitudDetalle", { id: item.id, solicitud: item })
        }
        activeOpacity={0.85}
      >
        {/* Header de la tarjeta */}
        <View style={styles.cardTop}>
          <View style={styles.cardTopLeft}>
            <View style={[styles.tipoIconWrap, { backgroundColor: "#EFF6FF" }]}>
              <Ionicons name={tipo.icon} size={18} color="#2563EB" />
            </View>
            <View>
              <Text style={[styles.cardTipo, { color: p.text }]}>{tipo.label}</Text>
              <Text style={[styles.cardNumero, { color: p.subtle }]}>
                #{item.numero} · {item.fechaTexto}
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.estadoPill,
              { backgroundColor: estado.bg },
            ]}
          >
            <Ionicons name={estado.icon} size={11} color={estado.color} />
            <Text style={[styles.estadoText, { color: estado.color }]}>
              {estado.label}
            </Text>
          </View>
        </View>

        {/* Pedido asociado */}
        {!!item.pedido && (
          <View style={[styles.pedidoChip, { backgroundColor: "#F8FAFC" }]}>
            <Ionicons name="cube-outline" size={12} color={p.subtle} />
            <Text style={[styles.pedidoChipText, { color: p.subtle }]}>
              Pedido {item.pedido}
            </Text>
          </View>
        )}

        {/* Descripción */}
        {!!item.descripcion && (
          <Text
            style={[styles.descripcion, { color: p.text }]}
            numberOfLines={2}
          >
            {item.descripcion}
          </Text>
        )}

        {/* Respuesta */}
        {!!item.respuesta && (
          <View
            style={[
              styles.respuestaBox,
              { borderTopColor: p.border, backgroundColor: "#F8FAFC" },
            ]}
          >
            <View style={styles.respuestaHeader}>
              <Ionicons name="chatbubble-ellipses-outline" size={13} color="#2563EB" />
              <Text style={[styles.respuestaLabel, { color: "#2563EB" }]}>
                Respuesta del equipo
              </Text>
            </View>
            <Text
              style={[styles.respuestaText, { color: p.subtle }]}
              numberOfLines={3}
            >
              {item.respuesta}
            </Text>
          </View>
        )}

        {/* CTA */}
        <View style={styles.cardFooter}>
          <Text style={[styles.verDetalle, { color: p.primary }]}>
            Ver detalle
          </Text>
          <Ionicons name="arrow-forward" size={14} color={p.primary} />
        </View>
      </TouchableOpacity>
    );
  };

  // ─── Estado vacío
  const renderEmpty = () => {
    if (loading) return null;
    return (
      <View style={styles.emptyWrap}>
        <View style={styles.emptyIconWrap}>
          <MaterialCommunityIcons
            name={error ? "alert-circle-outline" : "clipboard-text-outline"}
            size={56}
            color="#CBD5E1"
          />
        </View>
        <Text style={styles.emptyTitle}>
          {error ? "No se pudieron cargar tus solicitudes" : "Aún no tienes solicitudes"}
        </Text>
        <Text style={styles.emptySub}>
          {error
            ? "Verifica tu conexión e intenta de nuevo."
            : "Crea una devolución, garantía o reporte y aparecerá aquí."}
        </Text>

        {!error && (
          <TouchableOpacity
            style={styles.emptyBtn}
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

  // ─── Header (top bar Liverpool-style)
  const Header = () => (
    <View style={styles.headerWrap}>
      <View style={styles.headerTop}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={22} color="#0F172A" />
        </TouchableOpacity>

        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={styles.headerTitle}>Mis Solicitudes</Text>
          <Text style={styles.headerSub}>
            {solicitudes.length}{" "}
            {solicitudes.length === 1 ? "solicitud" : "solicitudes"}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.newBtn}
          onPress={() => navigation.navigate("NuevaSolicitud")}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={22} color="#FFF" />
        </TouchableOpacity>
      </View>

      {/* Buscador */}
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color="#94A3B8" />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por folio, pedido o tipo..."
          placeholderTextColor="#94A3B8"
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch("")}>
            <Ionicons name="close-circle" size={18} color="#94A3B8" />
          </TouchableOpacity>
        )}
      </View>

      {/* Chips de filtro */}
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
                activo
                  ? { backgroundColor: p.primary, borderColor: p.primary }
                  : { backgroundColor: "#FFF", borderColor: "#E5E7EB" },
              ]}
            >
              <Ionicons
                name={item.icon}
                size={14}
                color={activo ? "#FFF" : "#64748B"}
              />
              <Text
                style={[
                  styles.chipText,
                  { color: activo ? "#FFF" : "#64748B" },
                ]}
              >
                {item.label}
              </Text>
              {count > 0 && (
                <View
                  style={[
                    styles.chipCount,
                    {
                      backgroundColor: activo ? "rgba(255,255,255,0.25)" : "#F1F5F9",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.chipCountText,
                      { color: activo ? "#FFF" : "#64748B" },
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
    <SafeAreaView style={styles.page} edges={["top", "left", "right"]}>
      <Header />

      {loading && !solicitudes.length ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={p.primary} />
          <Text style={{ color: "#94A3B8", marginTop: 12 }}>
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
              tintColor={p.primary}
              colors={[p.primary]}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

// ============================================================
// ESTILOS — estilo Liverpool: fondo claro, tarjetas con sombra suave
// ============================================================
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#F5F6FA" },

  // Header
  headerWrap: {
    backgroundColor: "#FFF",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#EEF0F4",
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
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#0F172A",
    letterSpacing: -0.3,
  },
  headerSub: {
    fontSize: 11,
    color: "#94A3B8",
    marginTop: 2,
    fontWeight: "600",
  },
  newBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#E91E63",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#E91E63",
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },

  // Buscador
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F5F6FA",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
    marginTop: 6,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#EEF0F4",
  },
  searchInput: {
    flex: 1,
    fontSize: 13.5,
    color: "#0F172A",
    paddingVertical: 0,
  },

  // Chips
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

  // Lista
  listContent: {
    padding: 14,
    paddingBottom: 30,
    flexGrow: 1,
    gap: 12,
  },

  // Tarjeta
  card: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 10,
    // sombra suave Liverpool
    shadowColor: "#0F172A",
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

  descripcion: {
    fontSize: 12.5,
    lineHeight: 18,
    fontWeight: "500",
  },

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

  // Empty
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
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#0F172A",
    textAlign: "center",
    marginTop: 6,
  },
  emptySub: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 19,
    paddingHorizontal: 16,
  },
  emptyBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#E91E63",
    paddingVertical: 13,
    paddingHorizontal: 22,
    borderRadius: 999,
    marginTop: 14,
    shadowColor: "#E91E63",
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  emptyBtnText: { color: "#FFF", fontSize: 14, fontWeight: "900" },

  // Center (loading)
  center: {
    padding: 30,
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    gap: 10,
  },
});