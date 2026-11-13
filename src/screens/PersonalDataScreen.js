// src/screens/PersonalDataScreen.js
import React, { useCallback, useEffect, useState, useRef } from "react";
import {
  ActivityIndicator,
  Animated,
  LayoutAnimation,
  Modal,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { usePreferences } from "../context/PreferencesContext";
import { Text } from "../i18n/ui";
import { fetchPerfil, guardarPerfil } from "../services/api";

// ================================================================
// ⭐ INTERNACIONALIZACIÓN (ES/EN)
// ================================================================
const T = {
  es: {
    headerTitle: "Datos Personales",
    back: "Atrás",
    loading: "Cargando datos...",

    intro:
      "Actualiza tu nombre, correo y teléfono. Estos datos se usan para tus pedidos y notificaciones.",

    summaryTitle: "Tu información",
    summarySub: "Revisa tus datos. Pulsa Editar para modificarlos.",
    editBtn: "Editar datos",
    sinDato: "Sin registrar",

    labelNombre: "Nombre",
    labelApPaterno: "Apellido paterno",
    labelApMaterno: "Apellido materno",
    labelEmail: "Correo electrónico",
    labelTelefono: "Teléfono",
    labelFecha: "Fecha de nacimiento",
    labelGenero: "Género",

    phNombre: "Daniel",
    phApPaterno: "Hernández",
    phApMaterno: "García",
    phEmail: "correo@ejemplo.com",
    phTelefono: "55 1234 5678",
    phFecha: "YYYY-MM-DD",

    generos: [
      { value: "masculino", label: "Masculino" },
      { value: "femenino", label: "Femenino" },
      { value: "indefinido", label: "Indefinido" },
    ],

    btnGuardar: "Guardar cambios",
    btnCancelar: "Cancelar",

    errNombreApellido: "Nombre y apellido paterno son obligatorios",
    errEmail: "Correo inválido",
    errFechaInvalida: "Fecha inválida. Debe ser YYYY-MM-DD y una fecha real.",
    errCargar: "No se pudo cargar la información.",
    errGuardar: "No se pudo guardar",
    errConexion: "Error de conexión",
    okGuardar: "Datos personales actualizados",

    alertOk: "Listo",
    alertError: "Atención",
    btnAceptar: "Aceptar",
  },
  en: {
    headerTitle: "Personal Data",
    back: "Back",
    loading: "Loading data...",

    intro:
      "Update your name, email and phone. This data is used for your orders and notifications.",

    summaryTitle: "Your information",
    summarySub: "Review your data. Tap Edit to modify it.",
    editBtn: "Edit data",
    sinDato: "Not set",

    labelNombre: "First name",
    labelApPaterno: "Last name (paternal)",
    labelApMaterno: "Last name (maternal)",
    labelEmail: "Email",
    labelTelefono: "Phone",
    labelFecha: "Date of birth",
    labelGenero: "Gender",

    phNombre: "Daniel",
    phApPaterno: "Hernández",
    phApMaterno: "García",
    phEmail: "email@example.com",
    phTelefono: "55 1234 5678",
    phFecha: "YYYY-MM-DD",

    generos: [
      { value: "masculino", label: "Male" },
      { value: "femenino", label: "Female" },
      { value: "indefinido", label: "Prefer not to say" },
    ],

    btnGuardar: "Save changes",
    btnCancelar: "Cancel",

    errNombreApellido: "First name and last name are required",
    errEmail: "Invalid email",
    errFechaInvalida: "Invalid date. Must be YYYY-MM-DD and a real date.",
    errCargar: "Could not load the information.",
    errGuardar: "Could not save",
    errConexion: "Connection error",
    okGuardar: "Personal data updated",

    alertOk: "Done",
    alertError: "Attention",
    btnAceptar: "OK",
  },
};

const getLang = (language) => {
  const l = String(language || "es").toLowerCase();
  return l.startsWith("en") ? "en" : "es";
};

// ================================================================
// ⭐ HELPERS DE FECHA
// ================================================================

// Auto-formato mientras escribe: solo dígitos, inserta guiones
const formatearFechaInput = (v) => {
  const digits = String(v || "").replace(/\D/g, "").slice(0, 8);
  let out = "";
  if (digits.length > 0) out = digits.slice(0, 4);
  if (digits.length > 4) out += "-" + digits.slice(4, 6);
  if (digits.length > 6) out += "-" + digits.slice(6, 8);
  return out;
};

// Validación real: YYYY-MM-DD y que exista (no 31 de febrero, etc.)
const esFechaValida = (iso) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso || ""))) return false;
  const [y, m, d] = String(iso).split("-").map(Number);
  const anioActual = new Date().getFullYear();
  if (y < 1900 || y > anioActual) return false;
  if (m < 1 || m > 12) return false;
  if (d < 1 || d > 31) return false;
  const dt = new Date(`${iso}T12:00:00`);
  return (
    dt.getFullYear() === y &&
    dt.getMonth() + 1 === m &&
    dt.getDate() === d
  );
};

// Normaliza lo que venga del backend a YYYY-MM-DD
const normalizarFechaBackend = (raw) => {
  if (raw === null || raw === undefined) return "";
  if (raw instanceof Date) {
    return isNaN(raw.getTime()) ? "" : raw.toISOString().slice(0, 10);
  }
  const s = String(raw).trim();
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return s.slice(0, 10);
  if (/^\d{8}$/.test(s)) {
    return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  }
  const m1 = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m1) {
    const [, dd, mm, yy] = m1;
    return `${yy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
  }
  const m2 = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (m2) {
    const [, yy, mm, dd] = m2;
    return `${yy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
  }
  try {
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  } catch {}
  return "";
};

// Formato visual para la tarjeta resumen (mediodía para evitar desfase TZ)
const formatFecha = (iso, lang = "es") => {
  if (!iso) return "";
  try {
    const d = new Date(`${iso}T12:00:00`);
    if (isNaN(d.getTime())) return String(iso);
    return d.toLocaleDateString(lang === "en" ? "en-US" : "es-MX", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  } catch {
    return String(iso);
  }
};

export default function PersonalDataScreen({ navigation }) {
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
  const [editando, setEditando] = useState(false);
  const [datos, setDatos] = useState({
    nombre: "",
    apellido_paterno: "",
    apellido_materno: "",
    email: "",
    telefono: "",
    fecha_nacimiento: "",
    genero: "",
  });
  const [error, setError] = useState("");

  const [toast, setToast] = useState(null);
  const [modal, setModal] = useState(null);
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTranslateY = useRef(new Animated.Value(-20)).current;
  const toastTimer = useRef(null);

  const generos = t.generos;

  // ⭐ Validación en vivo de la fecha (solo si el usuario ya escribió algo)
  const fechaInvalida =
    editando &&
    !!datos.fecha_nacimiento &&
    !esFechaValida(datos.fecha_nacimiento);

  const cargarPerfil = useCallback(async () => {
    try {
      const data = await fetchPerfil();
      setDatos({
        nombre: data.nombre || "",
        apellido_paterno: data.apellido_paterno || "",
        apellido_materno: data.apellido_materno || "",
        email: data.email || "",
        telefono: data.telefono || "",
        // ⭐ Normalizar lo que venga del backend
        fecha_nacimiento: normalizarFechaBackend(data.fecha_nacimiento),
        genero: data.genero || "",
      });
    } catch (e) {
      console.warn("[PersonalData] error cargando:", e?.message);
      setError(t.errCargar);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    cargarPerfil();
  }, [cargarPerfil]);

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

  const closeModal = useCallback(() => setModal(null), []);

  const guardar = async () => {
    setError("");
    const email = (datos.email || "").trim().toLowerCase();
    const nombre = (datos.nombre || "").trim();
    const apellido = (datos.apellido_paterno || "").trim();
    const fecha = (datos.fecha_nacimiento || "").trim();

    if (!nombre || !apellido) {
      setError(t.errNombreApellido);
      return;
    }
    if (!email.includes("@")) {
      setError(t.errEmail);
      return;
    }
    // ⭐ Validar fecha antes de enviar
    if (fecha && !esFechaValida(fecha)) {
      setError(t.errFechaInvalida);
      return;
    }

    setSaving(true);
    try {
      const res = await guardarPerfil({
        nombre,
        apellido_paterno: apellido,
        apellido_materno: (datos.apellido_materno || "").trim(),
        email,
        telefono: (datos.telefono || "").trim(),
        fecha_nacimiento: fecha,
        genero: (datos.genero || "").trim(),
      });

      if (res?.ok || res?.success) {
        LayoutAnimation.configureNext(
          LayoutAnimation.Presets.easeInEaseOut
        );
        setEditando(false);
        showToast(t.okGuardar);
        // ⭐ Recargar para que la fecha mostrada venga normalizada del backend
        cargarPerfil();
      } else {
        setError(res?.message || res?.error || t.errGuardar);
      }
    } catch (e) {
      setError(e?.message || t.errConexion);
    } finally {
      setSaving(false);
    }
  };

  const abrirEdicion = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setError("");
    setEditando(true);
  };

  const cancelarEdicion = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setEditando(false);
    setError("");
    cargarPerfil();
  };

  const set = (k, v) => setDatos((prev) => ({ ...prev, [k]: v }));

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

  const nombreCompleto = [
    datos.nombre,
    datos.apellido_paterno,
    datos.apellido_materno,
  ]
    .filter(Boolean)
    .join(" ");

  const generoLabel =
    generos.find((g) => g.value === datos.genero)?.label ||
    datos.genero ||
    "";

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
        <Text style={[styles.subtitle, { color: p.subtle }]}>
          {t.intro}
        </Text>

        {!editando ? (
          <View
            style={[
              styles.summaryCard,
              { backgroundColor: p.surface, borderColor: p.border },
            ]}
          >
            <View style={styles.summaryHeader}>
              <View
                style={[
                  styles.summaryIconWrap,
                  { backgroundColor: `${p.primary}22` },
                ]}
              >
                <Ionicons
                  name="person-circle"
                  size={26}
                  color={p.primary}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.summaryTitle, { color: p.text }]}>
                  {nombreCompleto || t.sinDato}
                </Text>
                <Text style={[styles.summarySub, { color: p.subtle }]}>
                  {datos.email || t.sinDato}
                </Text>
              </View>
            </View>

            <View style={[styles.divider, { backgroundColor: p.border }]} />

            <SummaryRow
              icon="mail-outline"
              label={t.labelEmail}
              value={datos.email}
              p={p}
              fallback={t.sinDato}
            />
            <SummaryRow
              icon="call-outline"
              label={t.labelTelefono}
              value={datos.telefono}
              p={p}
              fallback={t.sinDato}
            />
            <SummaryRow
              icon="calendar-outline"
              label={t.labelFecha}
              value={formatFecha(datos.fecha_nacimiento, lang)}
              p={p}
              fallback={t.sinDato}
            />
            <SummaryRow
              icon="male-female-outline"
              label={t.labelGenero}
              value={generoLabel}
              p={p}
              fallback={t.sinDato}
              last
            />

            <TouchableOpacity
              onPress={abrirEdicion}
              style={[
                styles.editBtn,
                { backgroundColor: p.primary, marginTop: 16 },
              ]}
              activeOpacity={0.85}
            >
              <Ionicons name="create-outline" size={18} color="#FFF" />
              <Text style={styles.editBtnText}>{t.editBtn}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View
            style={[
              styles.formCard,
              { backgroundColor: p.surface, borderColor: p.border },
            ]}
          >
            <View style={styles.formHeader}>
              <Text style={[styles.formTitle, { color: p.text }]}>
                {t.summaryTitle}
              </Text>
              <TouchableOpacity
                onPress={cancelarEdicion}
                accessibilityLabel={t.btnCancelar}
              >
                <Ionicons name="close" size={22} color={p.subtle} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.formSub, { color: p.subtle }]}>
              {t.summarySub}
            </Text>

            <View style={styles.rowGap}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.label, { color: p.subtle }]}>
                  {t.labelNombre}
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      color: p.text,
                      borderColor: p.border,
                      backgroundColor: p.background,
                    },
                  ]}
                  value={datos.nombre}
                  onChangeText={(v) => set("nombre", v)}
                  placeholder={t.phNombre}
                  placeholderTextColor={p.subtle}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.label, { color: p.subtle }]}>
                  {t.labelApPaterno}
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      color: p.text,
                      borderColor: p.border,
                      backgroundColor: p.background,
                    },
                  ]}
                  value={datos.apellido_paterno}
                  onChangeText={(v) => set("apellido_paterno", v)}
                  placeholder={t.phApPaterno}
                  placeholderTextColor={p.subtle}
                />
              </View>
            </View>

            <View style={{ marginTop: 12 }}>
              <Text style={[styles.label, { color: p.subtle }]}>
                {t.labelApMaterno}
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    color: p.text,
                    borderColor: p.border,
                    backgroundColor: p.background,
                  },
                ]}
                value={datos.apellido_materno}
                onChangeText={(v) => set("apellido_materno", v)}
                placeholder={t.phApMaterno}
                placeholderTextColor={p.subtle}
              />
            </View>

            <View style={styles.rowGap}>
              <View style={{ flex: 1.3 }}>
                <Text style={[styles.label, { color: p.subtle }]}>
                  {t.labelEmail}
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      color: p.text,
                      borderColor: p.border,
                      backgroundColor: p.background,
                    },
                  ]}
                  value={datos.email}
                  onChangeText={(v) => set("email", v.toLowerCase())}
                  placeholder={t.phEmail}
                  placeholderTextColor={p.subtle}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.label, { color: p.subtle }]}>
                  {t.labelTelefono}
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      color: p.text,
                      borderColor: p.border,
                      backgroundColor: p.background,
                    },
                  ]}
                  value={datos.telefono}
                  onChangeText={(v) => set("telefono", v)}
                  placeholder={t.phTelefono}
                  placeholderTextColor={p.subtle}
                  keyboardType="phone-pad"
                />
              </View>
            </View>

            {/* ⭐ Fecha con formato automático y validación en vivo */}
            <View style={{ marginTop: 12 }}>
              <Text style={[styles.label, { color: p.subtle }]}>
                {t.labelFecha}
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    color: p.text,
                    borderColor: fechaInvalida ? "#EF4444" : p.border,
                    backgroundColor: p.background,
                  },
                ]}
                value={datos.fecha_nacimiento}
                onChangeText={(v) =>
                  set("fecha_nacimiento", formatearFechaInput(v))
                }
                placeholder={t.phFecha}
                placeholderTextColor={p.subtle}
                keyboardType="number-pad"
                maxLength={10}
                autoCorrect={false}
              />
              {fechaInvalida && (
                <Text
                  style={{
                    color: "#EF4444",
                    fontSize: 11,
                    marginTop: 4,
                    fontWeight: "600",
                  }}
                >
                  {t.errFechaInvalida}
                </Text>
              )}
            </View>

            <Text style={[styles.label, { color: p.subtle, marginTop: 12 }]}>
              {t.labelGenero}
            </Text>
            <View style={styles.chipsRow}>
              {generos.map((g) => {
                const activo = datos.genero === g.value;
                return (
                  <TouchableOpacity
                    key={g.value}
                    style={[
                      styles.chip,
                      {
                        borderColor: activo ? p.primary : p.border,
                        backgroundColor: activo
                          ? `${p.primary}22`
                          : p.background,
                      },
                    ]}
                    onPress={() => set("genero", g.value)}
                    activeOpacity={0.85}
                  >
                    {activo && (
                      <Ionicons
                        name="checkmark-circle"
                        size={14}
                        color={p.primary}
                      />
                    )}
                    <Text
                      style={[
                        styles.chipText,
                        { color: activo ? p.primary : p.text },
                      ]}
                    >
                      {g.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <View style={styles.formActions}>
              <TouchableOpacity
                onPress={cancelarEdicion}
                style={[styles.btnCancel, { borderColor: p.border }]}
                activeOpacity={0.85}
                disabled={saving}
              >
                <Text style={[styles.btnCancelText, { color: p.text }]}>
                  {t.btnCancelar}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={guardar}
                style={[
                  styles.btnGuardar,
                  {
                    backgroundColor: p.primary,
                    opacity: saving ? 0.7 : 1,
                    flex: 1,
                  },
                ]}
                disabled={saving}
                activeOpacity={0.85}
              >
                {saving ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <>
                    <Ionicons
                      name="checkmark-circle"
                      size={18}
                      color="#FFF"
                    />
                    <Text style={styles.btnText}>{t.btnGuardar}</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

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

      <Modal
        visible={!!modal}
        transparent
        animationType="fade"
        onRequestClose={closeModal}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalCard,
              { backgroundColor: p.surface, borderColor: p.border },
            ]}
          >
            <View
              style={[
                styles.modalIconWrap,
                { backgroundColor: "#EF444418" },
              ]}
            >
              <Ionicons name="close-circle" size={34} color="#EF4444" />
            </View>
            <Text style={[styles.modalTitle, { color: p.text }]}>
              {modal?.title}
            </Text>
            <Text style={[styles.modalMessage, { color: p.subtle }]}>
              {modal?.message}
            </Text>
            <TouchableOpacity
              onPress={closeModal}
              style={[styles.modalBtn, { backgroundColor: "#EF4444" }]}
              activeOpacity={0.85}
            >
              <Text style={styles.modalBtnText}>{t.btnAceptar}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function SummaryRow({ icon, label, value, p, fallback, last }) {
  return (
    <View
      style={[
        styles.summaryRow,
        !last && { borderBottomWidth: 1, borderBottomColor: p.border },
      ]}
    >
      <View style={styles.summaryRowLeft}>
        <Ionicons name={icon} size={16} color={p.subtle} />
        <Text style={[styles.summaryRowLabel, { color: p.subtle }]}>
          {label}
        </Text>
      </View>
      <Text
        style={[styles.summaryRowValue, { color: p.text }]}
        numberOfLines={1}
      >
        {value || fallback}
      </Text>
    </View>
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

  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  subtitle: {
    fontSize: 13,
    marginBottom: 16,
    lineHeight: 20,
  },

  summaryCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
  },
  summaryHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  summaryIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: -0.2,
  },
  summarySub: { fontSize: 12.5, marginTop: 2 },

  divider: { height: 1, marginVertical: 14 },

  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 12,
  },
  summaryRowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  summaryRowLabel: { fontSize: 12.5, fontWeight: "600" },
  summaryRowValue: {
    fontSize: 13.5,
    fontWeight: "700",
    flexShrink: 1,
    textAlign: "right",
  },

  editBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 13,
    borderRadius: 12,
    minHeight: 46,
  },
  editBtnText: { color: "#FFF", fontWeight: "800", fontSize: 14 },

  formCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
  },
  formHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  formTitle: { fontSize: 16, fontWeight: "900", letterSpacing: -0.2 },
  formSub: { fontSize: 12, marginBottom: 12, lineHeight: 17 },

  rowGap: { flexDirection: "row", gap: 10, marginTop: 12 },
  label: {
    fontSize: 11,
    marginBottom: 6,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    borderWidth: 1.2,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    minHeight: 46,
  },

  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1.4,
  },
  chipText: { fontSize: 12.5, fontWeight: "700" },

  error: {
    color: "#EF4444",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 12,
  },

  formActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
  },
  btnCancel: {
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1.4,
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
  },
  btnCancelText: { fontSize: 14, fontWeight: "800" },
  btnGuardar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 13,
    paddingHorizontal: 20,
    borderRadius: 12,
    minHeight: 46,
  },
  btnText: { color: "#FFF", fontWeight: "800", fontSize: 14 },

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
  toastText: { color: "#FFF", fontSize: 13, fontWeight: "800", flex: 1 },

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.55)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalCard: {
    width: "100%",
    maxWidth: 380,
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    alignItems: "center",
  },
  modalIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "900",
    textAlign: "center",
    letterSpacing: -0.2,
    marginBottom: 6,
  },
  modalMessage: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
    marginBottom: 18,
  },
  modalBtn: {
    width: "100%",
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 46,
  },
  modalBtnText: { color: "#FFF", fontWeight: "800", fontSize: 15 },
});