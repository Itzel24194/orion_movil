// src/screens/LoyaltyScreen.js
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { fetchLealtad } from "../services/api";
import { usePreferences } from "../context/PreferencesContext";

// ⭐ Intentar importar LinearGradient (opcional, con fallback)
let LinearGradient = null;
try {
  LinearGradient = require("expo-linear-gradient").LinearGradient;
} catch {}

// ================================================================
// ⭐ INTERNACIONALIZACIÓN (ES/EN)
// ================================================================
const T = {
  es: {
    headerTitle: "Cliente Consentido",
    back: "Atrás",
    loading: "Cargando lealtad...",

    // Nivel
    levelBannerLabel: "Nivel actual",
    pointsShort: "pts",

    // Bonificación mesas
    mesasTitle: "Bonificación por Mesas",
    mesasSub: "Ganaste un 10% extra",

    // Stats
    puntos: "Puntos",
    cupones: "Cupones",

    // Progreso
    progresoTitle: "Progreso al siguiente nivel",
    falta: (x) => `Te faltan $${x} para subir de nivel`,
    nivelMax: "¡Estás en el nivel máximo!",

    // Empty / error
    errorTitle: "No se pudo cargar tu información de lealtad.",
    errorSub: "Verifica tu conexión e intenta de nuevo.",
    retry: "Reintentar",
  },
  en: {
    headerTitle: "Preferred Customer",
    back: "Back",
    loading: "Loading loyalty...",

    levelBannerLabel: "Current level",
    pointsShort: "pts",

    mesasTitle: "Tables bonus",
    mesasSub: "You earned an extra 10%",

    puntos: "Points",
    cupones: "Coupons",

    progresoTitle: "Progress to next level",
    falta: (x) => `$${x} more to level up`,
    nivelMax: "You're at the highest level!",

    errorTitle: "Could not load your loyalty information.",
    errorSub: "Check your connection and try again.",
    retry: "Retry",
  },
};

const getLang = (language) => {
  const l = String(language || "es").toLowerCase();
  return l.startsWith("en") ? "en" : "es";
};

const currency = (n, lang = "es") =>
  `$${Number(n || 0).toLocaleString(lang === "en" ? "en-US" : "es-MX", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

// ⭐ Colores por nivel
const NIVEL_COLORS = {
  Bronce: { start: "#B45309", end: "#F59E0B", icon: "medal" },
  Plata: { start: "#64748B", end: "#CBD5E1", icon: "medal" },
  Oro: { start: "#B7791F", end: "#FDE68A", icon: "trophy" },
  Diamante: { start: "#6D28D9", end: "#A78BFA", icon: "diamond" },
};
const nivelColor = (nivel) =>
  NIVEL_COLORS[nivel] || NIVEL_COLORS.Bronce;

export default function LoyaltyScreen({ navigation }) {
  const prefs = usePreferences() || {};
  const palette = prefs.palette;
  const lang = getLang(prefs.language);
  const t = T[lang];

  const p = palette || {
    background: "#0F172A",
    surface: "#1E293B",
    text: "#FFF",
    primary: "#6366F1",
    subtle: "#94A3B8",
    border: "#334155",
  };

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const cargar = () => {
    setError(false);
    setLoading(true);
    fetchLealtad()
      .then((d) => {
        setData(d);
        setError(false);
      })
      .catch(() => {
        setError(true);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    cargar();
  }, []);

  if (loading) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: p.background }]}
      >
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={[
              styles.iconBtn,
              { backgroundColor: p.surface, borderColor: p.border },
            ]}
            accessibilityLabel={t.back}
          >
            <Ionicons name="arrow-back" size={20} color={p.text} />
          </TouchableOpacity>
          <Text
            style={[styles.title, { color: p.text }]}
            numberOfLines={1}
          >
            {t.headerTitle}
          </Text>
          <View style={{ width: 38 }} />
        </View>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={p.primary} />
          <Text style={{ color: p.subtle, marginTop: 12 }}>
            {t.loading}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const nivel = data?.nivel || "Bronce";
  const colors = nivelColor(nivel);
  const puntos = Number(data?.puntos || 0);
  const cupones = Array.isArray(data?.cupones) ? data.cupones : [];
  const bonificacion = Number(data?.bonificacionMesas || 0);

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: p.background }]}
    >
      <View style={[styles.header, { borderBottomColor: p.border }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={[
            styles.iconBtn,
            { backgroundColor: p.surface, borderColor: p.border },
          ]}
          accessibilityLabel={t.back}
        >
          <Ionicons name="arrow-back" size={20} color={p.text} />
        </TouchableOpacity>
        <Text
          style={[styles.title, { color: p.text }]}
          numberOfLines={1}
        >
          {t.headerTitle}
        </Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {error ? (
          <View style={styles.center}>
            <Ionicons
              name="alert-circle-outline"
              size={48}
              color={p.subtle}
            />
            <Text style={[styles.errorTitle, { color: p.text }]}>
              {t.errorTitle}
            </Text>
            <Text style={[styles.errorSub, { color: p.subtle }]}>
              {t.errorSub}
            </Text>
            <TouchableOpacity
              onPress={cargar}
              style={[
                styles.primaryBtn,
                { backgroundColor: p.primary },
              ]}
              activeOpacity={0.85}
            >
              <Ionicons name="refresh" size={16} color="#FFF" />
              <Text style={styles.primaryBtnText}>{t.retry}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* ⭐ Banner de nivel */}
            {LinearGradient ? (
              <LinearGradient
                colors={[colors.start, colors.end]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.levelBanner}
              >
                <View style={styles.levelBannerIconWrap}>
                  <Ionicons
                    name={colors.icon}
                    size={36}
                    color="#FFF"
                  />
                </View>
                <Text style={styles.levelBannerTitle}>{nivel}</Text>
                <Text style={styles.levelBannerLabel}>
                  {t.levelBannerLabel}
                </Text>
                <View style={styles.levelPill}>
                  <Ionicons name="star" size={12} color="#FFF" />
                  <Text style={styles.levelPillText}>
                    {puntos} {t.pointsShort}
                  </Text>
                </View>
              </LinearGradient>
            ) : (
              <View
                style={[
                  styles.levelBanner,
                  { backgroundColor: colors.start },
                ]}
              >
                <View style={styles.levelBannerIconWrap}>
                  <Ionicons
                    name={colors.icon}
                    size={36}
                    color="#FFF"
                  />
                </View>
                <Text style={styles.levelBannerTitle}>{nivel}</Text>
                <Text style={styles.levelBannerLabel}>
                  {t.levelBannerLabel}
                </Text>
                <View style={styles.levelPill}>
                  <Ionicons name="star" size={12} color="#FFF" />
                  <Text style={styles.levelPillText}>
                    {puntos} {t.pointsShort}
                  </Text>
                </View>
              </View>
            )}

            {/* ⭐ Bonificación por Mesas */}
            {bonificacion > 0 ? (
              <View
                style={[
                  styles.mesasBanner,
                  {
                    backgroundColor: p.surface,
                    borderColor: "#10B98155",
                  },
                ]}
              >
                <View
                  style={[
                    styles.mesasIconWrap,
                    { backgroundColor: "#10B98118" },
                  ]}
                >
                  <Ionicons name="gift" size={22} color="#10B981" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      color: "#10B981",
                      fontWeight: "800",
                      fontSize: 14,
                    }}
                  >
                    {t.mesasTitle}
                  </Text>
                  <Text
                    style={{
                      color: p.subtle,
                      fontSize: 12,
                      marginTop: 2,
                    }}
                  >
                    {t.mesasSub}
                  </Text>
                </View>
                <Text
                  style={{
                    color: "#10B981",
                    fontSize: 18,
                    fontWeight: "900",
                  }}
                >
                  +{currency(bonificacion, lang)}
                </Text>
              </View>
            ) : null}

            {/* ⭐ Stats */}
            <View style={styles.statsRow}>
              <View
                style={[
                  styles.statCard,
                  { backgroundColor: p.surface, borderColor: p.border },
                ]}
              >
                <View
                  style={[
                    styles.statIconWrap,
                    { backgroundColor: `${p.primary}22` },
                  ]}
                >
                  <Ionicons name="star" size={18} color={p.primary} />
                </View>
                <Text style={[styles.statLabel, { color: p.subtle }]}>
                  {t.puntos}
                </Text>
                <Text style={[styles.statValue, { color: p.text }]}>
                  {puntos}
                </Text>
              </View>

              <View
                style={[
                  styles.statCard,
                  { backgroundColor: p.surface, borderColor: p.border },
                ]}
              >
                <View
                  style={[
                    styles.statIconWrap,
                    { backgroundColor: "#F59E0B22" },
                  ]}
                >
                  <Ionicons name="ticket" size={18} color="#F59E0B" />
                </View>
                <Text style={[styles.statLabel, { color: p.subtle }]}>
                  {t.cupones}
                </Text>
                <Text style={[styles.statValue, { color: p.text }]}>
                  {cupones.length}
                </Text>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    flexShrink: 1,
    textAlign: "center",
    letterSpacing: -0.3,
  },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 30,
    gap: 10,
  },

  // ⭐ Banner de nivel
  levelBanner: {
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    marginBottom: 18,
    minHeight: 200,
    justifyContent: "center",
    overflow: "hidden",
  },
  levelBannerIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  levelBannerTitle: {
    color: "#FFF",
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  levelBannerLabel: {
    color: "#FFF",
    opacity: 0.9,
    fontSize: 13,
    fontWeight: "600",
    marginTop: 2,
  },
  levelPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(0,0,0,0.22)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    marginTop: 12,
  },
  levelPillText: {
    color: "#FFF",
    fontWeight: "800",
    fontSize: 12,
    letterSpacing: 0.3,
  },

  // ⭐ Bonificación mesas
  mesasBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
  },
  mesasIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  // ⭐ Stats
  statsRow: { flexDirection: "row", gap: 12 },
  statCard: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "flex-start",
  },
  statIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  statValue: {
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: -0.4,
  },

  // Empty / error
  errorTitle: {
    fontSize: 16,
    fontWeight: "900",
    textAlign: "center",
    marginTop: 6,
  },
  errorSub: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 19,
    marginBottom: 8,
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 999,
    marginTop: 12,
  },
  primaryBtnText: { color: "#FFF", fontSize: 14, fontWeight: "900" },
});