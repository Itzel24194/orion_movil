// src/screens/WalletScreen.js
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
import { fetchMonedero } from "../services/api";
import { usePreferences } from "../context/PreferencesContext";

// ================================================================
// ⭐ INTERNACIONALIZACIÓN (ES/EN)
// ================================================================
const T = {
  es: {
    headerTitle: "Mi Cartera",
    back: "Atrás",
    loading: "Cargando monedero...",

    cardLabel: "MONEDERO DIGITAL",
    cardBrand: "ORION",
    cardCVV: "CVV •••",

    saldoTitle: "Saldo monedero digital",
    saldoPropio: "Saldo propio:",
    bonificacionMesas: "🎁 Bonificación Mesas:",

    recargar: "Recargar mi monedero",

    errTitle: "Error",
    errLoad: "No se pudo cargar el monedero.",
  },
  en: {
    headerTitle: "My Wallet",
    back: "Back",
    loading: "Loading wallet...",

    cardLabel: "DIGITAL WALLET",
    cardBrand: "ORION",
    cardCVV: "CVV •••",

    saldoTitle: "Digital wallet balance",
    saldoPropio: "Own balance:",
    bonificacionMesas: "🎁 Tables bonus:",

    recargar: "Top up my wallet",

    errTitle: "Error",
    errLoad: "Could not load the wallet.",
  },
};

const getLang = (language) => {
  const l = String(language || "es").toLowerCase();
  return l.startsWith("en") ? "en" : "es";
};

// ⭐ Formato de moneda respetando el idioma
const currency = (n, lang = "es") =>
  `$${Number(n || 0).toLocaleString(lang === "en" ? "en-US" : "es-MX", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export default function WalletScreen({ navigation }) {
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
  };

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMonedero()
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading)
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: p.background }]}
      >
        <ActivityIndicator size="large" color={p.primary} />
      </SafeAreaView>
    );

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: p.background }]}
    >
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          accessibilityLabel={t.back}
        >
          <Ionicons name="arrow-back" size={24} color={p.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: p.text }]}>
          {t.headerTitle}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <View style={[styles.card, { backgroundColor: p.primary }]}>
          <Text style={styles.cardLabel}>{t.cardLabel}</Text>
          <Text style={styles.cardNumber}>
            {data?.numeroTarjeta || "**** **** **** 0000"}
          </Text>
          <View style={styles.cardBottom}>
            <Text style={styles.cardBrand}>{t.cardBrand}</Text>
            <Text style={styles.cardCVV}>{t.cardCVV}</Text>
          </View>
        </View>

        <View style={[styles.saldoBox, { backgroundColor: p.surface }]}>
          <Text style={{ color: p.subtle, fontSize: 14 }}>
            {t.saldoTitle}
          </Text>
          <Text
            style={{
              color: p.text,
              fontSize: 32,
              fontWeight: "bold",
              marginVertical: 8,
            }}
          >
            {currency(data?.saldoTotal, lang)}
          </Text>

          <View style={styles.divider} />

          <View style={styles.row}>
            <Text style={{ color: p.subtle }}>{t.saldoPropio}</Text>
            <Text style={{ color: p.text, fontWeight: "600" }}>
              {currency(data?.saldo, lang)}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={{ color: "#e10098" }}>
              {t.bonificacionMesas}
            </Text>
            <Text style={{ color: "#e10098", fontWeight: "bold" }}>
              +{currency(data?.bonificacionMesas, lang)}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.btnRecargar, { backgroundColor: p.primary }]}
        >
          <Text style={{ color: "#FFF", fontWeight: "bold" }}>
            {t.recargar}
          </Text>
        </TouchableOpacity>
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
    padding: 20,
  },
  title: { fontSize: 18, fontWeight: "bold" },
  card: {
    borderRadius: 16,
    padding: 20,
    height: 180,
    justifyContent: "space-between",
    marginBottom: 20,
  },
  cardLabel: { color: "#FFF", fontSize: 12, letterSpacing: 2 },
  cardNumber: {
    color: "#FFF",
    fontSize: 22,
    fontWeight: "bold",
    letterSpacing: 2,
  },
  cardBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  cardBrand: { color: "#FFF", fontSize: 20, fontWeight: "900" },
  cardCVV: { color: "#FFF", fontSize: 12 },
  saldoBox: { borderRadius: 16, padding: 20, marginBottom: 20 },
  divider: {
    height: 1,
    backgroundColor: "#334155",
    marginVertical: 12,
    borderStyle: "dashed",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: 4,
  },
  btnRecargar: { padding: 16, borderRadius: 12, alignItems: "center" },
});