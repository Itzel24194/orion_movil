// src/screens/InterestsScreen.js
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { usePreferences } from "../context/PreferencesContext";
import { Text } from "../i18n/ui";
import { fetchIntereses, guardarIntereses } from "../services/api";

// ⭐ Límite total de selecciones
const MAX_SELECCIONES = 10;

// ================================================================
// ⭐ INTERNACIONALIZACIÓN (ES/EN)
// ================================================================
const T = {
  es: {
    headerTitle: "Intereses",
    back: "Atrás",
    loading: "Cargando intereses...",
    intro:
      "Cuéntanos qué te gusta para recomendarte productos afines a tu estilo.",
    summary: (n, max) => `${n} de ${max} seleccionados`,
    maxReached: (max) => `Máximo ${max} selecciones`,
    secCategorias: "Categorías",
    secMarcas: "Marcas favoritas",
    secEstilos: "Estilos",
    secActividades: "Actividades",
    secOcasiones: "Para quién compras",
    secFrecuencia: "Frecuencia de compra",
    btnGuardar: "Guardar intereses",
    okGuardar: "Intereses guardados",
    errGuardar: "No se pudo guardar",
    errConexion: "Error de conexión",
  },
  en: {
    headerTitle: "Interests",
    back: "Back",
    loading: "Loading interests...",
    intro:
      "Tell us what you like so we can recommend products that match your style.",
    summary: (n, max) => `${n} of ${max} selected`,
    maxReached: (max) => `Maximum ${max} selections`,
    secCategorias: "Categories",
    secMarcas: "Favorite brands",
    secEstilos: "Styles",
    secActividades: "Activities",
    secOcasiones: "Who you shop for",
    secFrecuencia: "Purchase frequency",
    btnGuardar: "Save interests",
    okGuardar: "Interests saved",
    errGuardar: "Could not save",
    errConexion: "Connection error",
  },
};

const getLang = (language) => {
  const l = String(language || "es").toLowerCase();
  return l.startsWith("en") ? "en" : "es";
};

// ================================================================
// ⭐ CATÁLOGOS
// ================================================================
const CATEGORIAS = [
  { value: "ropa", label: "Ropa", labelEn: "Clothing", icon: "shirt" },
  { value: "calzado", label: "Calzado", labelEn: "Footwear", icon: "footsteps" },
  { value: "accesorios", label: "Accesorios", labelEn: "Accessories", icon: "watch" },
  { value: "belleza", label: "Belleza", labelEn: "Beauty", icon: "sparkles" },
  { value: "tecnologia", label: "Tecnología", labelEn: "Technology", icon: "hardware-chip" },
  { value: "hogar", label: "Hogar", labelEn: "Home", icon: "home" },
];

const MARCAS = [
  { value: "ORION", label: "ORION", labelEn: "ORION", icon: "star" },
  { value: "Nike", label: "Nike", labelEn: "Nike", icon: "checkmark-done" },
  { value: "Adidas", label: "Adidas", labelEn: "Adidas", icon: "footsteps" },
  { value: "Zara", label: "Zara", labelEn: "Zara", icon: "shirt" },
  { value: "H&M", label: "H&M", labelEn: "H&M", icon: "bag-handle" },
  { value: "Levi's", label: "Levi's", labelEn: "Levi's", icon: "pricetag" },
  { value: "Puma", label: "Puma", labelEn: "Puma", icon: "flash" },
];

const ESTILOS = [
  { value: "casual", label: "Casual", labelEn: "Casual", icon: "cafe" },
  { value: "formal", label: "Formal", labelEn: "Formal", icon: "business" },
  { value: "deportivo", label: "Deportivo", labelEn: "Sporty", icon: "basketball" },
  { value: "bohemio", label: "Bohemio", labelEn: "Bohemian", icon: "leaf" },
  { value: "minimalista", label: "Minimalista", labelEn: "Minimalist", icon: "remove-circle" },
  { value: "vintage", label: "Vintage", labelEn: "Vintage", icon: "time" },
  { value: "elegante", label: "Elegante", labelEn: "Elegant", icon: "diamond" },
  { value: "street", label: "Street", labelEn: "Street", icon: "walk" },
];

const ACTIVIDADES = [
  { value: "fitness", label: "Fitness", labelEn: "Fitness", icon: "barbell" },
  { value: "yoga", label: "Yoga", labelEn: "Yoga", icon: "body" },
  { value: "running", label: "Running", labelEn: "Running", icon: "walk" },
  { value: "trabajo", label: "Trabajo", labelEn: "Work", icon: "briefcase" },
  { value: "viajes", label: "Viajes", labelEn: "Travel", icon: "airplane" },
  { value: "fiesta", label: "Fiesta", labelEn: "Party", icon: "musical-notes" },
];

const OCASIONES = [
  { value: "mi", label: "Para mí", labelEn: "For me", icon: "person" },
  { value: "pareja", label: "Mi pareja", labelEn: "My partner", icon: "heart" },
  { value: "hijos", label: "Mis hijos", labelEn: "My kids", icon: "happy" },
  { value: "familia", label: "Familia", labelEn: "Family", icon: "people" },
  { value: "regalos", label: "Regalos", labelEn: "Gifts", icon: "gift" },
  { value: "amigos", label: "Amigos", labelEn: "Friends", icon: "beer" },
];

const FRECUENCIAS = [
  { value: "semanal", label: "Semanal", labelEn: "Weekly", icon: "calendar" },
  { value: "quincenal", label: "Quincenal", labelEn: "Biweekly", icon: "calendar-outline" },
  { value: "mensual", label: "Mensual", labelEn: "Monthly", icon: "calendar-number" },
  { value: "ocasional", label: "Ocasional", labelEn: "Occasionally", icon: "time-outline" },
];

const asArray = (v) => (Array.isArray(v) ? v : []);

// ================================================================
// ⭐ META POR SECCIÓN
// ================================================================
const SECTION_META = {
  categorias: { color: "#EC4899", icon: "grid" },
  marcas: { color: "#8B5CF6", icon: "pricetags" },
  estilos: { color: "#6366F1", icon: "color-palette" },
  actividades: { color: "#10B981", icon: "fitness" },
  ocasiones: { color: "#F59E0B", icon: "gift" },
  frecuencia: { color: "#0EA5E9", icon: "repeat" },
};

// ================================================================
// ⭐ Tile — colores de palette + estado "disabled"
// ================================================================
function Tile({ item, label, active, disabled, color, p, onPress }) {
  const scale = useRef(new Animated.Value(1)).current;
  const onIn = () => {
    if (disabled) return;
    Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, speed: 30 }).start();
  };
  const onOut = () => {
    if (disabled) return;
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30 }).start();
  };

  const bg = active ? `${color}22` : p.surface;
  const border = active ? color : p.border;
  const textColor = active ? color : p.text;
  const iconColor = active ? color : p.subtle;
  const iconBg = active ? `${color}33` : p.background;

  return (
    <TouchableOpacity
      onPress={onPress}
      onPressIn={onIn}
      onPressOut={onOut}
      activeOpacity={disabled ? 1 : 0.85}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected: active, disabled }}
      style={[styles.tileWrap, disabled && { opacity: 0.4 }]}
    >
      <Animated.View
        style={[
          styles.tile,
          {
            transform: [{ scale }],
            backgroundColor: bg,
            borderColor: border,
          },
        ]}
      >
        <View style={[styles.tileIconWrap, { backgroundColor: iconBg }]}>
          <Ionicons name={item.icon || "ellipse"} size={18} color={iconColor} />
        </View>
        <Text style={[styles.tileText, { color: textColor }]} numberOfLines={2}>
          {label}
        </Text>
        {active && (
          <View style={[styles.tileCheck, { backgroundColor: color }]}>
            <Ionicons name="checkmark" size={11} color="#FFF" />
          </View>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
}

// ================================================================
// ⭐ Pantalla
// ================================================================
export default function InterestsScreen({ navigation }) {
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
  const [categorias, setCategorias] = useState([]);
  const [marcas, setMarcas] = useState([]);
  const [estilos, setEstilos] = useState([]);
  const [actividades, setActividades] = useState([]);
  const [ocasiones, setOcasiones] = useState([]);
  const [frecuencia, setFrecuencia] = useState("");

  const [toast, setToast] = useState(null);
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTranslateY = useRef(new Animated.Value(-20)).current;
  const toastTimer = useRef(null);

  const cargar = useCallback(async () => {
    try {
      const data = await fetchIntereses();
      setCategorias(asArray(data?.categorias));
      setMarcas(asArray(data?.marcas));
      setEstilos(asArray(data?.estilos));
      setActividades(asArray(data?.actividades));
      setOcasiones(asArray(data?.ocasiones));
      setFrecuencia(typeof data?.frecuencia === "string" ? data.frecuencia : "");
    } catch (e) {
      console.warn("[Interests] error cargando:", e?.message);
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
        Animated.timing(toastOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(toastTranslateY, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
      toastTimer.current = setTimeout(() => {
        Animated.parallel([
          Animated.timing(toastOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
          Animated.timing(toastTranslateY, { toValue: -20, duration: 200, useNativeDriver: true }),
        ]).start(() => setToast(null));
      }, 2400);
    },
    [toastOpacity, toastTranslateY]
  );

  // ⭐ Total de selecciones actuales
  const totalSeleccionados =
    asArray(categorias).length +
    asArray(marcas).length +
    asArray(estilos).length +
    asArray(actividades).length +
    asArray(ocasiones).length +
    (frecuencia ? 1 : 0);

  const limiteAlcanzado = totalSeleccionados >= MAX_SELECCIONES;

  // ⭐ Toggle con límite: si ya hay 12 y el item no está seleccionado → aviso
  const toggleConLimite = (arr, setArr, value) => {
    const lista = Array.isArray(arr) ? arr : [];
    const yaSeleccionado = lista.includes(value);

    if (yaSeleccionado) {
      setArr(lista.filter((x) => x !== value));
      return;
    }
    if (totalSeleccionados >= MAX_SELECCIONES) {
      showToast(t.maxReached(MAX_SELECCIONES));
      return;
    }
    setArr([...lista, value]);
  };

  // ⭐ Toggle para frecuencia (única, también cuenta el límite)
  const toggleFrecuencia = (value) => {
    const activo = frecuencia === value;
    if (activo) {
      setFrecuencia("");
      return;
    }
    if (totalSeleccionados >= MAX_SELECCIONES) {
      showToast(t.maxReached(MAX_SELECCIONES));
      return;
    }
    setFrecuencia(value);
  };

  const guardar = async () => {
    setSaving(true);
    try {
      const res = await guardarIntereses({
        categorias: asArray(categorias),
        marcas: asArray(marcas),
        estilos: asArray(estilos),
        actividades: asArray(actividades),
        ocasiones: asArray(ocasiones),
        frecuencia: typeof frecuencia === "string" ? frecuencia : "",
      });
      if (res?.ok || res?.success) showToast(t.okGuardar);
      else showToast(res?.message || res?.error || t.errGuardar);
    } catch (e) {
      showToast(e?.message || t.errConexion);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: p.background }]}>
        <View style={[styles.header, { borderBottomColor: p.border }]}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={[styles.iconBtn, { backgroundColor: p.surface, borderColor: p.border }]}
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

  const renderTiles = (items, seleccionados, setSeleccionados, colorBase) => {
    const lista = Array.isArray(seleccionados) ? seleccionados : [];
    return (
      <View style={styles.gridRow}>
        {items.map((it) => {
          const label = lang === "en" ? it.labelEn || it.label : it.label;
          const activo = lista.includes(it.value);
          // ⭐ Deshabilitado si llegó al límite y este no está seleccionado
          const disabled = limiteAlcanzado && !activo;
          return (
            <Tile
              key={it.value}
              item={it}
              label={label}
              active={activo}
              disabled={disabled}
              color={colorBase}
              p={p}
              onPress={() => toggleConLimite(lista, setSeleccionados, it.value)}
            />
          );
        })}
      </View>
    );
  };

  const renderSection = (titulo, meta, items, seleccionados, setSeleccionados) => {
    const { color, icon } = meta;
    const lista = Array.isArray(seleccionados) ? seleccionados : [];
    return (
      <View
        style={[
          styles.card,
          { backgroundColor: p.surface, borderColor: p.border },
        ]}
      >
        <View style={styles.cardHeader}>
          <View style={[styles.sectionIconWrap, { backgroundColor: `${color}22` }]}>
            <Ionicons name={icon} size={14} color={color} />
          </View>
          <Text style={[styles.section, { color: p.text }]}>{titulo}</Text>
          <View
            style={[
              styles.countPill,
              {
                backgroundColor: lista.length > 0 ? `${color}22` : p.background,
                borderColor: lista.length > 0 ? color : p.border,
              },
            ]}
          >
            <Text
              style={[
                styles.countPillText,
                { color: lista.length > 0 ? color : p.subtle },
              ]}
            >
              {lista.length}
            </Text>
          </View>
        </View>
        {renderTiles(items, lista, setSeleccionados, color)}
      </View>
    );
  };

  const freqLabel = (f) => (lang === "en" ? f.labelEn || f.label : f.label);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: p.background }]}>
      <View style={[styles.header, { borderBottomColor: p.border }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={[styles.iconBtn, { backgroundColor: p.surface, borderColor: p.border }]}
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
        <Text style={[styles.subtitle, { color: p.subtle }]}>{t.intro}</Text>

        {/* ⭐ Resumen con barra de progreso hasta 12 */}
        <View
          style={[
            styles.summaryBar,
            { backgroundColor: `${p.primary}18`, borderColor: p.primary },
          ]}
        >
          <Ionicons
            name={limiteAlcanzado ? "lock-closed" : "sparkles"}
            size={16}
            color={p.primary}
          />
          <View style={{ flex: 1 }}>
            <Text style={[styles.summaryText, { color: p.primary }]}>
              {t.summary(totalSeleccionados, MAX_SELECCIONES)}
            </Text>
            <View
              style={[
                styles.progressTrack,
                { backgroundColor: `${p.primary}22`, marginTop: 6 },
              ]}
            >
              <View
                style={[
                  styles.progressFill,
                  {
                    backgroundColor: p.primary,
                    width: `${Math.min(
                      100,
                      (totalSeleccionados / MAX_SELECCIONES) * 100
                    )}%`,
                  },
                ]}
              />
            </View>
          </View>
        </View>

        {renderSection(
          t.secCategorias,
          SECTION_META.categorias,
          CATEGORIAS,
          asArray(categorias),
          setCategorias
        )}

        {renderSection(
          t.secMarcas,
          SECTION_META.marcas,
          MARCAS,
          asArray(marcas),
          setMarcas
        )}

        {renderSection(
          t.secEstilos,
          SECTION_META.estilos,
          ESTILOS,
          asArray(estilos),
          setEstilos
        )}

        {renderSection(
          t.secActividades,
          SECTION_META.actividades,
          ACTIVIDADES,
          asArray(actividades),
          setActividades
        )}

        {renderSection(
          t.secOcasiones,
          SECTION_META.ocasiones,
          OCASIONES,
          asArray(ocasiones),
          setOcasiones
        )}

        {/* Frecuencia — también cuenta para el límite */}
        <View
          style={[
            styles.card,
            { backgroundColor: p.surface, borderColor: p.border },
          ]}
        >
          <View style={styles.cardHeader}>
            <View
              style={[
                styles.sectionIconWrap,
                { backgroundColor: `${SECTION_META.frecuencia.color}22` },
              ]}
            >
              <Ionicons
                name={SECTION_META.frecuencia.icon}
                size={14}
                color={SECTION_META.frecuencia.color}
              />
            </View>
            <Text style={[styles.section, { color: p.text }]}>
              {t.secFrecuencia}
            </Text>
            <View
              style={[
                styles.countPill,
                {
                  backgroundColor: frecuencia
                    ? `${SECTION_META.frecuencia.color}22`
                    : p.background,
                  borderColor: frecuencia
                    ? SECTION_META.frecuencia.color
                    : p.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.countPillText,
                  {
                    color: frecuencia
                      ? SECTION_META.frecuencia.color
                      : p.subtle,
                  },
                ]}
              >
                {frecuencia ? "1" : "0"}
              </Text>
            </View>
          </View>
          <View style={styles.gridRow}>
            {FRECUENCIAS.map((f) => {
              const activo = frecuencia === f.value;
              const disabled = limiteAlcanzado && !activo;
              return (
                <Tile
                  key={f.value}
                  item={f}
                  label={freqLabel(f)}
                  active={activo}
                  disabled={disabled}
                  color={SECTION_META.frecuencia.color}
                  p={p}
                  onPress={() => toggleFrecuencia(f.value)}
                />
              );
            })}
          </View>
        </View>

        <TouchableOpacity
          style={[
            styles.btnGuardar,
            { backgroundColor: p.primary, opacity: saving ? 0.7 : 1 },
          ]}
          onPress={guardar}
          disabled={saving}
          activeOpacity={0.85}
        >
          {saving ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={18} color="#FFF" />
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

  summaryBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  summaryText: {
    fontSize: 12.5,
    fontWeight: "800",
    lineHeight: 16,
  },
  progressTrack: {
    height: 6,
    borderRadius: 999,
    overflow: "hidden",
  },
  progressFill: {
    height: 6,
    borderRadius: 999,
  },

  card: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    marginBottom: 14,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
  },
  sectionIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  section: {
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: -0.2,
    lineHeight: 20,
    flex: 1,
  },
  countPill: {
    minWidth: 28,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  countPillText: {
    fontSize: 11,
    fontWeight: "900",
    lineHeight: 14,
  },

  gridRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 10,
  },
  tileWrap: { width: "48.5%" },
  tile: {
    borderRadius: 14,
    borderWidth: 1.4,
    paddingVertical: 12,
    paddingHorizontal: 10,
    minHeight: 78,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  tileIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  tileText: {
    fontSize: 12.5,
    fontWeight: "800",
    textAlign: "center",
    lineHeight: 17,
    letterSpacing: -0.1,
  },
  tileCheck: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 18,
    height: 18,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },

  btnGuardar: {
    marginTop: 8,
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