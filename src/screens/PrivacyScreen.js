// src/screens/PrivacyScreen.js
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  ScrollView,
  StyleSheet,
  Switch,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { usePreferences } from "../context/PreferencesContext";
import { Text } from "../i18n/ui";
import { fetchPrivacidad, guardarPrivacidad } from "../services/api";

// ================================================================
// ⭐ INTERNACIONALIZACIÓN (ES/EN)
// ================================================================
const T = {
  es: {
    headerTitle: "Privacidad",
    back: "Atrás",
    loading: "Cargando privacidad...",
    intro:
      "Controla cómo usamos tu información. Estos ajustes afectan las recomendaciones que ves y la personalización de tu cuenta.",

    labelPersonalizacion: "Personalización",
    descPersonalizacion:
      "Recomendaciones basadas en tus compras y favoritos.",

    labelAnaliticas: "Análisis de uso",
    descAnaliticas:
      "Permite mejorar la app usando datos anónimos.",

    labelSocios: "Compartir con socios",
    descSocios:
      "Compartir información con marcas aliadas.",

    noteTitle: "Tus datos están protegidos",
    noteText:
      "Puedes descargar o eliminar tu cuenta desde \"Descargar mis datos\" y \"Eliminar cuenta\" en el menú de Mi Cuenta.",

    btnGuardar: "Guardar preferencias",
    okGuardar: "Preferencias de privacidad guardadas",
    errGuardar: "No se pudo guardar",
    errCargar: "No se pudieron cargar tus preferencias",
    errConexion: "Error de conexión",
  },
  en: {
    headerTitle: "Privacy",
    back: "Back",
    loading: "Loading privacy...",
    intro:
      "Control how we use your information. These settings affect the recommendations you see and your account personalization.",

    labelPersonalizacion: "Personalization",
    descPersonalizacion:
      "Recommendations based on your purchases and favorites.",

    labelAnaliticas: "Usage analytics",
    descAnaliticas:
      "Help us improve the app using anonymous data.",

    labelSocios: "Share with partners",
    descSocios:
      "Share information with partner brands.",

    noteTitle: "Your data is protected",
    noteText:
      "You can download or delete your account from \"Download my data\" and \"Delete account\" in the My Account menu.",

    btnGuardar: "Save preferences",
    okGuardar: "Privacy preferences saved",
    errGuardar: "Could not save",
    errCargar: "Could not load your preferences",
    errConexion: "Connection error",
  },
};

const getLang = (language) => {
  const l = String(language || "es").toLowerCase();
  return l.startsWith("en") ? "en" : "es";
};

export default function PrivacyScreen({ navigation }) {
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

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [datos, setDatos] = useState({
    personalizacion: true,
    analiticas: true,
    compartir_socios: false,
  });

  // ⭐ Toast
  const [toast, setToast] = useState(null);
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTranslateY = useRef(new Animated.Value(-20)).current;
  const toastTimer = useRef(null);

  const cargar = useCallback(async () => {
    try {
      const data = await fetchPrivacidad();
      setDatos({
        personalizacion: data?.personalizacion !== false,
        analiticas: data?.analiticas !== false,
        compartir_socios: data?.compartir_socios === true,
      });
    } catch (e) {
      console.warn("[Privacy] error cargando:", e?.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  const showToast = useCallback(
    (message) => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
      setToast({ message });
      Animated.parallel([
        Animated.timing(toastOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(toastTranslateY, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
      toastTimer.current = setTimeout(() => {
        Animated.parallel([
          Animated.timing(toastOpacity, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(toastTranslateY, {
            toValue: -20,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start(() => setToast(null));
      }, 2400);
    },
    [toastOpacity, toastTranslateY]
  );

  const guardar = async () => {
    setSaving(true);
    try {
      const res = await guardarPrivacidad({
        personalizacion: !!datos.personalizacion,
        analiticas: !!datos.analiticas,
        compartir_socios: !!datos.compartir_socios,
      });

      if (res?.ok || res?.success) {
        showToast(t.okGuardar);
      } else {
        showToast(res?.message || res?.error || t.errGuardar);
      }
    } catch (e) {
      showToast(e?.message || t.errConexion);
    } finally {
      setSaving(false);
    }
  };

  const set = (k, v) => setDatos((prev) => ({ ...prev, [k]: v }));

  if (loading) {
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
          <Text style={[styles.title, { color: p.text }]} numberOfLines={1}>
            {t.headerTitle}
          </Text>
          <View style={{ width: 38 }} />
        </View>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={p.primary} />
          <Text style={{ color: p.subtle, marginTop: 12 }}>{t.loading}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const renderSwitch = (icon, label, desc, key) => {
    const activo = !!datos[key];
    return (
      <View
        style={[
          styles.row,
          { backgroundColor: p.surface, borderColor: p.border },
        ]}
      >
        <View
          style={[
            styles.iconWrap,
            { backgroundColor: activo ? `${p.primary}22` : p.background },
          ]}
        >
          <Ionicons
            name={icon}
            size={18}
            color={activo ? p.primary : p.subtle}
          />
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={[styles.rowTitle, { color: p.text }]}>{label}</Text>
          <Text style={[styles.rowDesc, { color: p.subtle }]}>{desc}</Text>
        </View>
        <Switch
          value={activo}
          onValueChange={(v) => set(key, v)}
          trackColor={{ false: p.border, true: `${p.primary}88` }}
          thumbColor={activo ? p.primary : p.subtle}
          ios_backgroundColor={p.border}
        />
      </View>
    );
  };

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
        <Text style={[styles.title, { color: p.text }]} numberOfLines={1}>
          {t.headerTitle}
        </Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.subtitle, { color: p.subtle }]}>
          {t.intro}
        </Text>

        <View style={{ gap: 10, marginTop: 4 }}>
          {renderSwitch(
            "sparkles",
            t.labelPersonalizacion,
            t.descPersonalizacion,
            "personalizacion"
          )}
          {renderSwitch(
            "analytics",
            t.labelAnaliticas,
            t.descAnaliticas,
            "analiticas"
          )}
          {renderSwitch(
            "share-social",
            t.labelSocios,
            t.descSocios,
            "compartir_socios"
          )}
        </View>

        <View
          style={[
            styles.note,
            {
              backgroundColor: `${p.primary}15`,
              borderColor: `${p.primary}55`,
            },
          ]}
        >
          <View
            style={[
              styles.noteIconWrap,
              { backgroundColor: `${p.primary}22` },
            ]}
          >
            <Ionicons
              name="information-circle"
              size={18}
              color={p.primary}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.noteTitle, { color: p.text }]}>
              {t.noteTitle}
            </Text>
            <Text style={[styles.noteText, { color: p.subtle }]}>
              {t.noteText}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[
            styles.btnGuardar,
            {
              backgroundColor: p.primary,
              opacity: saving ? 0.7 : 1,
            },
          ]}
          onPress={guardar}
          disabled={saving}
          activeOpacity={0.85}
        >
          {saving ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <>
              <Ionicons name="save" size={18} color="#FFF" />
              <Text style={styles.btnText}>{t.btnGuardar}</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

      {toast ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.toast,
            {
              opacity: toastOpacity,
              transform: [{ translateY: toastTranslateY }],
            },
          ]}
        >
          <Ionicons name="checkmark-circle" size={18} color="#FFF" />
          <Text style={styles.toastText} numberOfLines={2}>
            {toast.message}
          </Text>
        </Animated.View>
      ) : null}
    </SafeAreaView>
  );
}

// ================================================================
// ⭐ ESTILOS
// ================================================================
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
    lineHeight: 22,
  },

  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  subtitle: {
    fontSize: 13,
    marginBottom: 16,
    lineHeight: 20,
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.2,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 18,
    letterSpacing: -0.1,
  },
  rowDesc: {
    fontSize: 11.5,
    marginTop: 3,
    lineHeight: 16,
  },

  note: {
    flexDirection: "row",
    gap: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 18,
    alignItems: "flex-start",
  },
  noteIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  noteTitle: {
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 17,
    marginBottom: 2,
    letterSpacing: -0.1,
  },
  noteText: {
    fontSize: 12,
    lineHeight: 17,
    flex: 1,
  },

  btnGuardar: {
    marginTop: 22,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 48,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  btnText: {
    color: "#FFF",
    fontWeight: "800",
    fontSize: 15,
    lineHeight: 19,
  },

  toast: {
    position: "absolute",
    top: 70,
    left: 20,
    right: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: "#059669",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  toastText: {
    color: "#FFF",
    fontSize: 13,
    fontWeight: "800",
    flex: 1,
    lineHeight: 17,
  },
});