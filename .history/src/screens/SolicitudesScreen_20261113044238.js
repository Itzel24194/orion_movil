// src/screens/SolicitudesScreen.js  (CLIENTE — SIN RESTRICCIÓN DE ADMIN)
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  View,
  Platform,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons, Feather } from "@expo/vector-icons";
import { Text } from "../i18n/ui";
import { usePreferences } from "../context/PreferencesContext";
import { fetchSolicitudes } from "../services/api";

// ⭐ Import seguro
const _fetchSolicitudes = fetchSolicitudes || (async () => []);

const ESTADOS = {
  pendiente:   { color: "#F59E0B", icon: "time",                  label: "Pendiente" },
  en_revision: { color: "#3B82F6", icon: "eye",                   label: "En revisión" },
  aprobada:    { color: "#10B981", icon: "checkmark-circle",      label: "Aprobada" },
  rechazada:   { color: "#EF4444", icon: "close-circle",          label: "Rechazada" },
  resuelta:    { color: "#10B981", icon: "checkmark-done-circle", label: "Resuelta" },
  cancelada:   { color: "#64748B", icon: "ban",                   label: "Cancelada" },
};

const TIPOS = {
  devolucion: { icon: "return-down-back",   label: "Devolución" },
  garantia:   { icon: "shield-checkmark",   label: "Garantía" },
  reporte:    { icon: "warning",            label: "Reporte" },
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

export default function SolicitudesScreen({ navigation }) {
  const prefs = usePreferences() || {};
  const p = prefs.palette || {
    background: "#0F172A", surface: "#1E293B", text: "#FFF",
    primary: "#6366F1", subtle: "#94A3B8", border: "#334155",
  };

  const [solicitudes, setSolicitudes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

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

  const renderItem = ({ item }) => {
    const tipo = TIPOS[item.tipo] || TIPOS.reporte;
    const estado = ESTADOS[item.estado] || ESTADOS.pendiente;

    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: p.surface, borderColor: p.border }]}
        onPress={() =>
          navigation.navigate("SolicitudDetalle", { id: item.id, solicitud: item })
        }
        activeOpacity={0.85}
      >
        <View style={styles.row}>
          <View
            style={[
              styles.iconWrap,
              { backgroundColor: `${estado.color}22`, borderColor: `${estado.color}55` },
            ]}
          >
            <Feather name={tipo.icon} size={18} color={estado.color} />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={[styles.cardTitle, { color: p.text }]} numberOfLines={1}>
              {tipo.label} #{item.numero}
            </Text>
            <Text style={[styles.cardSub, { color: p.subtle }]} numberOfLines={1}>
              {item.pedido ? `Pedido ${item.pedido} · ` : ""}
              {item.fechaTexto}
            </Text>
          </View>

          <View
            style={[
              styles.badge,
              { backgroundColor: `${estado.color}22`, borderColor: `${estado.color}55` },
            ]}
          >
            <Feather name={estado.icon} size={11} color={estado.color} />
            <Text style={[styles.badgeText, { color: estado.color }]}>
              {estado.label}
            </Text>
          </View>
        </View>

        {!!item.descripcion && (
          <Text style={[styles.descripcion, { color: p.subtle }]} numberOfLines={2}>
            {item.descripcion}
          </Text>
        )}

        {!!item.respuesta && (
          <View style={[styles.respuesta, { borderTopColor: p.border }]}>
            <Text style={[styles.respuestaLabel, { color: p.text }]}>
              Respuesta del equipo:
            </Text>
            <Text style={[styles.respuestaText, { color: p.subtle }]} numberOfLines={3}>
              {item.respuesta}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => {
    if (loading) return null;
    return (
      <View style={styles.center}>
        <Ionicons
          name={error ? "alert-circle-outline" : "document-text-outline"}
          size={50}
          color={p.subtle}
        />
        <Text style={[styles.emptyTitle, { color: p.text }]}>
          {error ? "No se pudieron cargar tus solicitudes" : "Aún no tienes solicitudes"}
        </Text>
        <Text style={[styles.emptySub, { color: p.subtle }]}>
          {error
            ? "Verifica tu conexión e intenta de nuevo."
            : "Puedes crear una devolución, garantía o reporte desde aquí."}
        </Text>

        {!error && (
          <TouchableOpacity
            style={[styles.btnPrimary, { backgroundColor: p.primary }]}
            onPress={() => navigation.navigate("NuevaSolicitud")}
            activeOpacity={0.85}
          >
            <Feather name="plus" size={16} color="#FFF" />
            <Text style={styles.btnPrimaryText}>Nueva solicitud</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView
      style={[styles.page, { backgroundColor: p.background }]}
      edges={["top", "left", "right"]}
    >
      <View style={[styles.header, { borderBottomColor: p.border }]}>
        <TouchableOpacity
          style={[styles.iconBtn, { backgroundColor: p.surface, borderColor: p.border }]}
          onPress={() => navigation.goBack()}
        >
          <Feather name="arrow-left" size={20} color={p.text} />
        </TouchableOpacity>

        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: p.text }]}>Mis Solicitudes</Text>
          <Text style={[styles.subtitle, { color: p.subtle }]}>
            {solicitudes.length} {solicitudes.length === 1 ? "solicitud" : "solicitudes"}
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.iconBtn, { backgroundColor: p.surface, borderColor: p.border }]}
          onPress={() => navigation.navigate("NuevaSolicitud")}
        >
          <Feather name="plus" size={20} color={p.primary} />
        </TouchableOpacity>
      </View>

      {loading && !solicitudes.length ? (
        <View style={styles.center}>
          <ActivityIndicator color={p.primary} />
          <Text style={{ color: p.subtle, marginTop: 12 }}>Cargando solicitudes…</Text>
        </View>
      ) : (
        <FlatList
          data={solicitudes}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={{
            padding: 16, paddingBottom: 30, flexGrow: 1, gap: 12,
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
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1,
  },
  iconBtn: {
    width: 38, height: 38, borderRadius: 12, borderWidth: 1,
    alignItems: "center", justifyContent: "center",
  },
  title: { fontSize: 18, fontWeight: "900" },
  subtitle: { fontSize: 12, marginTop: 2 },
  card: { borderRadius: 16, borderWidth: 1, padding: 14, gap: 10 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  iconWrap: {
    width: 42, height: 42, borderRadius: 12, borderWidth: 1,
    alignItems: "center", justifyContent: "center",
  },
  cardTitle: { fontSize: 14, fontWeight: "800" },
  cardSub: { fontSize: 11.5, marginTop: 2 },
  badge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, borderWidth: 1,
  },
  badgeText: { fontSize: 10, fontWeight: "800" },
  descripcion: { fontSize: 12.5, lineHeight: 18 },
  respuesta: { borderTopWidth: 1, paddingTop: 10, marginTop: 4, gap: 2 },
  respuestaLabel: { fontSize: 11, fontWeight: "800" },
  respuestaText: { fontSize: 12, lineHeight: 17 },
  center: {
    padding: 30, alignItems: "center", justifyContent: "center",
    flex: 1, gap: 10,
  },
  emptyTitle: { fontSize: 16, fontWeight: "900", textAlign: "center" },
  emptySub: { fontSize: 13, textAlign: "center", lineHeight: 19 },
  btnPrimary: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 12, paddingHorizontal: 22,
    borderRadius: 999, marginTop: 12,
  },
  btnPrimaryText: { color: "#FFF", fontSize: 14, fontWeight: "900" },
});