// src/screens/GenerateCouponsScreen.js
// ============================================================
// Pantalla de generación automática de cupones por segmento
// - Corrige import de ActivityIndicator
// - Fallback si el backend aún no tiene /api/v1/admin/segmentos
// - Sin variables no declaradas (evita "Property 's' doesn't exist")
// ============================================================
import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,   // ⭐ NECESARIO
  RefreshControl,
  Text as RNText,
  Alert as RNAlert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

// ⭐ Intentar usar Text/Alert traducidos; si fallan, usar los nativos
let Text = RNText;
let Alert = RNAlert;
try {
  const i18nUI = require("../i18n/ui");
  if (i18nUI?.Text) Text = i18nUI.Text;
  if (i18nUI?.Alert) Alert = i18nUI.Alert;
} catch {
  // usa los nativos
}

// ⭐ Servicios de la API con fallbacks defensivos
import * as api from "../services/api";

const _request =
  api.request ||
  (async (path, opts = {}) => {
    throw new Error("request() no está exportado en services/api.js");
  });

const fetchSegmentos =
  api.fetchSegmentos ||
  (async () => {
    const data = await _request("/api/v1/admin/segmentos");
    return Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
  });

const previewSegmento =
  api.previewSegmento ||
  (async (id) => {
    const data = await _request(`/api/v1/admin/segmentos/${id}/preview`, {
      method: "POST",
    });
    return data?.data || data;
  });

const generarCuponesAutomaticos =
  api.generarCuponesAutomaticos ||
  (async (opts = {}) => {
    const body =
      Array.isArray(opts.segmentos) && opts.segmentos.length
        ? { segmentos: opts.segmentos }
        : {};
    const data = await _request("/api/v1/admin/cupones/generar-automatico", {
      method: "POST",
      body,
    });
    return Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
  });

// ============================================================
export default function GenerateCouponsScreen({ navigation }) {
  const [segmentos, setSegmentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [generando, setGenerando] = useState(false);
  const [preview, setPreview] = useState({});
  const [resultados, setResultados] = useState(null);

  const cargarSegmentos = useCallback(async () => {
    try {
      const lista = await fetchSegmentos();
      setSegmentos(Array.isArray(lista) ? lista : []);
    } catch (e) {
      console.log("⚠️ Error cargando segmentos:", e?.message);
      if (e?.status === 404) {
        setSegmentos([]);
      } else {
        Alert.alert("Error", e?.message || "No se pudieron cargar los segmentos.");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    cargarSegmentos();
  }, [cargarSegmentos]);

  const onRefresh = () => {
    setRefreshing(true);
    setPreview({});
    setResultados(null);
    cargarSegmentos();
  };

  const previsualizar = async (seg) => {
    try {
      const p = await previewSegmento(seg.id);
      setPreview((prev) => ({ ...prev, [seg.id]: p }));
    } catch (e) {
      console.log("⚠️ Error preview:", e?.message);
      Alert.alert("Error", e?.message || "No se pudo previsualizar el segmento.");
    }
  };

  const generar = (solo) => {
    const msg = solo
      ? `Se generará el cupón del segmento "${solo.nombre}". ¿Continuar?`
      : "Se generarán cupones para TODOS los segmentos configurados. ¿Continuar?";

    Alert.alert("Generar cupones", msg, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Generar",
        onPress: async () => {
          setGenerando(true);
          setResultados(null);
          try {
            const res = await generarCuponesAutomaticos(
              solo ? { segmentos: [solo.id] } : {}
            );
            setResultados(Array.isArray(res) ? res : []);
            Alert.alert("Éxito", "Proceso completado.");
          } catch (e) {
            console.log("⚠️ Error generando:", e?.message);
            Alert.alert("Error", e?.message || "No se pudieron generar los cupones.");
          } finally {
            setGenerando(false);
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#7C3AED" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.headerTitle}>Generación Automática</Text>
          <Text style={styles.headerSubtitle}>
            Cupones por segmentos de cliente
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#7C3AED"
          />
        }
      >
        {/* INFO */}
        <View style={styles.infoBox}>
          <MaterialCommunityIcons name="robot" size={26} color="#7C3AED" />
          <Text style={styles.infoText}>
            Crea cupones personalizados según el comportamiento de compra de
            tus clientes. Previsualiza cuántos usuarios caen en cada segmento
            antes de generar.
          </Text>
        </View>

        {/* BOTÓN GLOBAL */}
        <TouchableOpacity
          style={[styles.generateAllBtn, generando && { opacity: 0.6 }]}
          onPress={() => generar(null)}
          disabled={generando}
        >
          {generando ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <>
              <MaterialCommunityIcons
                name="lightning-bolt"
                size={20}
                color="#FFF"
              />
              <Text style={styles.generateAllText}>
                Generar TODOS los segmentos
              </Text>
            </>
          )}
        </TouchableOpacity>

        {/* LISTA DE SEGMENTOS */}
        <Text style={styles.sectionTitle}>Segmentos Configurados</Text>
        {segmentos.length === 0 && (
          <View style={styles.emptySeg}>
            <MaterialCommunityIcons
              name="robot-off"
              size={48}
              color="#334155"
            />
            <Text style={styles.emptySegText}>
              No hay segmentos configurados en el backend.
            </Text>
            <Text style={[styles.emptySegText, { marginTop: 4, fontSize: 11 }]}>
              Verifica que Flask esté corriendo con las rutas /api/v1/admin/segmentos.
            </Text>
          </View>
        )}

        {segmentos.map((seg) => {
          const p = preview[seg.id];
          return (
            <View key={seg.id} style={styles.segmentCard}>
              <View style={styles.segmentHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.segmentName}>{seg.nombre}</Text>
                  <View style={styles.segmentBadge}>
                    <Text style={styles.segmentBadgeText}>{seg.id}</Text>
                  </View>
                </View>
                <View style={styles.cuponPreviewBox}>
                  <Ionicons name="ticket" size={16} color="#f59e0b" />
                  <Text style={styles.cuponPreviewText}>
                    {seg.cupon?.tipo === "porcentaje"
                      ? `${seg.cupon?.valor}%`
                      : seg.cupon?.tipo === "envio_gratis"
                      ? "Envío"
                      : `$${seg.cupon?.valor ?? 0}`}
                  </Text>
                </View>
              </View>

              <Text style={styles.segmentDesc}>{seg.descripcion}</Text>

              {p && (
                <View style={styles.previewBox}>
                  <Ionicons name="people" size={16} color="#10b981" />
                  <Text style={styles.previewText}>
                    {p.total} usuario(s) en este segmento
                  </Text>
                  {p.muestra?.length > 0 && (
                    <Text style={styles.previewMuestra} numberOfLines={2}>
                      Ej:{" "}
                      {p.muestra
                        .map(
                          (m) =>
                            m.nombre ||
                            [m.apellido, m.apellido_paterno]
                              .filter(Boolean)
                              .join(" ") ||
                            m.email ||
                            "—"
                        )
                        .join(", ")}
                    </Text>
                  )}
                </View>
              )}

              <View style={styles.rowBtns}>
                <TouchableOpacity
                  style={styles.previewBtn}
                  onPress={() => previsualizar(seg)}
                >
                  <Ionicons name="eye-outline" size={16} color="#7C3AED" />
                  <Text style={styles.previewBtnText}>Previsualizar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.genOneBtn}
                  onPress={() => generar(seg)}
                  disabled={generando}
                >
                  <Ionicons name="flash" size={16} color="#FFF" />
                  <Text style={styles.genOneText}>Generar</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}

        {/* RESULTADOS */}
        {resultados && (
          <View style={styles.resultsContainer}>
            <Text style={styles.sectionTitle}>Resultados</Text>
            {resultados.length === 0 && (
              <Text style={styles.resultWarn}>No se generó ningún cupón.</Text>
            )}
            {resultados.map((r, idx) => (
              <View key={idx} style={styles.resultItem}>
                <Text style={styles.resultName}>{r.segmento}</Text>
                {r.error ? (
                  <Text style={styles.resultError}>⚠️ {r.error}</Text>
                ) : r.creados > 0 ? (
                  <Text style={styles.resultSuccess}>
                    ✅ Código: {r.codigo} — {r.usuarios_beneficiados} usuario(s)
                  </Text>
                ) : (
                  <Text style={styles.resultWarn}>
                    ⚠️ {r.mensaje || "Sin usuarios"}
                  </Text>
                )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ============================================================
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#020617", paddingHorizontal: 16 },
  center: { justifyContent: "center", alignItems: "center" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
  },
  headerTitle: { color: "#FFF", fontSize: 18, fontWeight: "bold" },
  headerSubtitle: { color: "#64748B", fontSize: 12, marginTop: 2 },

  infoBox: {
    flexDirection: "row",
    backgroundColor: "#0f172a",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#1e293b",
    gap: 12,
    alignItems: "center",
    marginBottom: 16,
  },
  infoText: { color: "#94A3B8", flex: 1, fontSize: 13 },

  generateAllBtn: {
    flexDirection: "row",
    backgroundColor: "#7C3AED",
    padding: 14,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    marginBottom: 20,
  },
  generateAllText: { color: "#FFF", fontWeight: "bold", fontSize: 15 },

  sectionTitle: {
    color: "#94A3B8",
    fontSize: 13,
    fontWeight: "bold",
    textTransform: "uppercase",
    marginTop: 10,
    marginBottom: 12,
    letterSpacing: 1,
  },

  emptySeg: {
    alignItems: "center",
    paddingVertical: 30,
    backgroundColor: "#0f172a",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#1e293b",
    marginBottom: 12,
  },
  emptySegText: { color: "#64748B", fontSize: 13, marginTop: 8 },

  segmentCard: {
    backgroundColor: "#0f172a",
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#1e293b",
  },
  segmentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
  },
  segmentName: { color: "#FFF", fontSize: 15, fontWeight: "bold" },
  segmentBadge: {
    backgroundColor: "#7C3AED20",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: "flex-start",
    marginTop: 6,
  },
  segmentBadgeText: { color: "#7C3AED", fontSize: 10, fontWeight: "bold" },
  segmentDesc: {
    color: "#64748B",
    fontSize: 12,
    marginTop: 8,
    marginBottom: 10,
  },

  cuponPreviewBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#f59e0b15",
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
  },
  cuponPreviewText: { color: "#f59e0b", fontWeight: "bold", fontSize: 12 },

  previewBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#10b98115",
    padding: 8,
    borderRadius: 8,
    marginBottom: 10,
    flexWrap: "wrap",
  },
  previewText: { color: "#10b981", fontWeight: "600", fontSize: 12 },
  previewMuestra: { color: "#94A3B8", fontSize: 11, flexBasis: "100%" },

  rowBtns: { flexDirection: "row", gap: 8 },
  previewBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#7C3AED",
  },
  previewBtnText: { color: "#7C3AED", fontWeight: "600", fontSize: 13 },
  genOneBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#7C3AED",
  },
  genOneText: { color: "#FFF", fontWeight: "700", fontSize: 13 },

  resultsContainer: {
    backgroundColor: "#0f172a",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#1e293b",
    marginTop: 10,
  },
  resultItem: {
    marginBottom: 12,
    borderBottomWidth: 1,
    borderColor: "#1e293b",
    paddingBottom: 8,
  },
  resultName: { color: "#FFF", fontWeight: "600", fontSize: 14 },
  resultSuccess: { color: "#10b981", fontSize: 12, marginTop: 4 },
  resultError: { color: "#ef4444", fontSize: 12, marginTop: 4 },
  resultWarn: { color: "#f59e0b", fontSize: 12, marginTop: 4 },
});