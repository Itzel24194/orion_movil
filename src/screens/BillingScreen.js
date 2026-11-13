// screens/BillingScreen.js
import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Modal,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { usePreferences } from "../context/PreferencesContext";
import { request, loadSession } from "../services/api";
import { API_URL } from "../config/api";

const API_PREFIX = "/api/v1";
const CUENTA_BASE = `${API_PREFIX}/cuenta`;

// ================================================================
// ⭐ INTERNACIONALIZACIÓN (ES/EN)
// ================================================================
const T = {
  es: {
    headerTitle: "Facturación",
    back: "Atrás",
    loading: "Cargando facturación...",
    loadingFacturas: "Cargando facturas...",

    intro:
      "Aquí puedes ver y descargar las facturas de tus compras. Cada factura corresponde a uno de tus pedidos.",

    howTitle: "¿Cómo funciona?",
    how1: "Configura tus datos fiscales (RFC, razón social, etc.) una sola vez.",
    how2: 'Cada pedido que hiciste abajo tiene su botón "PDF" para descargar su factura.',
    how3: "Si aún no has hecho compras, no verás facturas disponibles.",

    fiscalTitle: "Datos fiscales",
    fiscalDesc: "Configura tu RFC y régimen fiscal para futuras facturas.",
    badgeSaved: "Guardado",
    labelRfc: "RFC",
    phRfc: "XAXX010101000",
    labelRazon: "Razón social",
    phRazon: "Nombre o empresa",
    labelRegimen: "Régimen fiscal",
    labelUsoCfdi: "Uso de CFDI",
    btnGuardar: "Guardar datos fiscales",
    updatedAt: (fecha) => `Actualizado: ${fecha}`,

    regimenes: [
      { value: "601", label: "601 - General de Ley Personas Morales" },
      { value: "605", label: "605 - Sueldos y Salarios" },
      {
        value: "612",
        label: "612 - Personas Físicas con Actividades Empresariales",
      },
      { value: "616", label: "616 - Sin obligaciones fiscales" },
    ],
    usosCfdi: [
      { value: "G03", label: "G03 - Gastos en general" },
      { value: "G01", label: "G01 - Adquisición de mercancías" },
      { value: "D01", label: "D01 - Honorarios médicos" },
    ],

    historial: "Historial de facturas",
    recargarFacturas: "Recargar facturas",
    emptyTitle: "Sin facturas disponibles",
    emptyText:
      "No tienes facturas disponibles porque aún no has realizado compras.",
    facturaPrefix: "Factura",
    facturaArticuloSingular: "artículo",
    facturaArticuloPlural: "artículos",
    estadoPendiente: "Pendiente",
    btnPDF: "PDF",

    errRfc: "El RFC debe tener 12 o 13 caracteres",
    errRazon: "La razón social es obligatoria",
    errGuardar: "No se pudieron guardar los datos",
    errConexion: "Error de conexión",
    okGuardar: "Datos fiscales guardados correctamente",

    sessionRequired: "Debes iniciar sesión",
    pdfNoPedido: "Pedido no encontrado",
    pdfNoFiscal: "Configura tus datos fiscales antes de generar la factura",
    pdfErrGenerar: (status) => `No se pudo generar la factura (${status})`,
    pdfOk: "Factura descargada",
    pdfErrTitle: "No se pudo descargar la factura",
    pdfDialog: "Factura",

    recargarOk: "Facturas recargadas",

    pageIndicator: (a, b) => `${a} / ${b}`,
    prevPage: "Página anterior",
    nextPage: "Página siguiente",

    // ⭐ UI de Alerts / Toast
    alertOk: "Listo",
    alertError: "Atención",
    alertWarning: "Aviso",
    btnAceptar: "Aceptar",
    toastOk: "Guardado",
    toastError: "Error",
  },
  en: {
    headerTitle: "Billing",
    back: "Back",
    loading: "Loading billing...",
    loadingFacturas: "Loading invoices...",

    intro:
      "Here you can view and download the invoices of your purchases. Each invoice corresponds to one of your orders.",

    howTitle: "How does it work?",
    how1: "Set up your tax data (RFC, business name, etc.) once.",
    how2: 'Every order you placed below has its "PDF" button to download its invoice.',
    how3: "If you haven't placed any orders, no invoices will be shown.",

    fiscalTitle: "Tax data",
    fiscalDesc: "Set up your RFC and tax regime for future invoices.",
    badgeSaved: "Saved",
    labelRfc: "RFC",
    phRfc: "XAXX010101000",
    labelRazon: "Business name",
    phRazon: "Name or company",
    labelRegimen: "Tax regime",
    labelUsoCfdi: "CFDI use",
    btnGuardar: "Save tax data",
    updatedAt: (fecha) => `Updated: ${fecha}`,

    regimenes: [
      { value: "601", label: "601 - General Law of Legal Entities" },
      { value: "605", label: "605 - Salaries and Wages" },
      {
        value: "612",
        label: "612 - Individuals with Business Activities",
      },
      { value: "616", label: "616 - No tax obligations" },
    ],
    usosCfdi: [
      { value: "G03", label: "G03 - General expenses" },
      { value: "G01", label: "G01 - Purchase of goods" },
      { value: "D01", label: "D01 - Medical fees" },
    ],

    historial: "Invoice history",
    recargarFacturas: "Reload invoices",
    emptyTitle: "No invoices available",
    emptyText:
      "You have no invoices available because you haven't placed any orders yet.",
    facturaPrefix: "Invoice",
    facturaArticuloSingular: "item",
    facturaArticuloPlural: "items",
    estadoPendiente: "Pending",
    btnPDF: "PDF",

    errRfc: "RFC must be 12 or 13 characters long",
    errRazon: "Business name is required",
    errGuardar: "Could not save the data",
    errConexion: "Connection error",
    okGuardar: "Tax data saved successfully",

    sessionRequired: "You must sign in",
    pdfNoPedido: "Order not found",
    pdfNoFiscal: "Set up your tax data before generating the invoice",
    pdfErrGenerar: (status) => `Could not generate the invoice (${status})`,
    pdfOk: "Invoice downloaded",
    pdfErrTitle: "Could not download the invoice",
    pdfDialog: "Invoice",

    recargarOk: "Invoices reloaded",

    pageIndicator: (a, b) => `${a} / ${b}`,
    prevPage: "Previous page",
    nextPage: "Next page",

    alertOk: "Done",
    alertError: "Attention",
    alertWarning: "Warning",
    btnAceptar: "OK",
    toastOk: "Saved",
    toastError: "Error",
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

const formatFecha = (iso, lang = "es") => {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString(lang === "en" ? "en-US" : "es-MX", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "—";
  }
};

const formatFechaHora = (iso, lang = "es") => {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleString(lang === "en" ? "en-US" : "es-MX", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
};

export default function BillingScreen({ navigation }) {
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
  const [loadingPedidos, setLoadingPedidos] = useState(false);
  const [datos, setDatos] = useState({
    rfc: "",
    razon_social: "",
    regimen_fiscal: "",
    uso_cfdi: "",
    updated_at: null,
  });
  const [pedidos, setPedidos] = useState([]);
  const [error, setError] = useState("");

  // ⭐ Paginación del historial
  const [page, setPage] = useState(1);
  const [perPage] = useState(5);

  // ⭐ Estado para UI custom de feedback
  const [toast, setToast] = useState(null); // { message, type }
  const [modal, setModal] = useState(null); // { title, message, type }

  // Refs de animación para el toast
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTranslateY = useRef(new Animated.Value(-20)).current;
  const toastTimer = useRef(null);

  const regimenes = useMemo(() => t.regimenes, [t]);
  const usosCfdi = useMemo(() => t.usosCfdi, [t]);

  // ⭐ Helpers de feedback
  const showToast = useCallback((message, type = "ok") => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, type });

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
  }, [toastOpacity, toastTranslateY]);

  const showAlert = useCallback((title, message, type = "warning") => {
    setModal({ title, message, type });
  }, []);

  const closeModal = useCallback(() => setModal(null), []);

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  // ─── Cargar datos fiscales
  const cargarFacturacion = useCallback(async () => {
    try {
      const data = await request(`${CUENTA_BASE}/facturacion`);
      if (data && data.success && data.datos) {
        setDatos({
          rfc: data.datos.rfc || "",
          razon_social: data.datos.razon_social || "",
          regimen_fiscal: data.datos.regimen_fiscal || "",
          uso_cfdi: data.datos.uso_cfdi || "",
          updated_at: data.datos.updated_at || null,
        });
      }
    } catch (e) {
      console.warn("[BillingScreen] Error cargando facturación:", e?.message);
    }
  }, []);

  // ─── Cargar pedidos
  const cargarPedidos = useCallback(async () => {
    setLoadingPedidos(true);
    try {
      const data = await request(`${API_PREFIX}/pedidos`);
      const lista = Array.isArray(data?.data)
        ? data.data
        : Array.isArray(data?.pedidos)
        ? data.pedidos
        : Array.isArray(data)
        ? data
        : [];
      setPedidos(lista);
      setPage(1);
    } catch (e) {
      console.warn("[BillingScreen] Error cargando pedidos:", e?.message);
      setPedidos([]);
      setPage(1);
    } finally {
      setLoadingPedidos(false);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      await Promise.all([cargarFacturacion(), cargarPedidos()]);
      if (alive) setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [cargarFacturacion, cargarPedidos]);

  // ─── Guardar
  const guardar = async () => {
    setError("");
    const rfc = (datos.rfc || "").trim().toUpperCase();
    const razon = (datos.razon_social || "").trim();

    if (rfc && rfc.length !== 12 && rfc.length !== 13) {
      setError(t.errRfc);
      return;
    }
    if (!razon) {
      setError(t.errRazon);
      return;
    }

    setSaving(true);
    try {
      const res = await request(`${CUENTA_BASE}/facturacion`, {
        method: "POST",
        body: {
          rfc,
          razon_social: razon,
          regimen_fiscal: datos.regimen_fiscal || "",
          uso_cfdi: datos.uso_cfdi || "",
        },
      });

      if (res && res.success) {
        setDatos((prev) => ({
          ...prev,
          rfc,
          razon_social: razon,
          updated_at: res.datos?.updated_at || prev.updated_at,
        }));
        showToast(t.okGuardar, "ok");
        cargarPedidos();
      } else {
        setError(res?.message || res?.error || t.errGuardar);
      }
    } catch (e) {
      setError(e?.message || t.errConexion);
    } finally {
      setSaving(false);
    }
  };

  // ─── Descargar factura
  const descargarFacturaPDF = async (pedidoId) => {
    if (!pedidoId) return;
    try {
      const { token } = await loadSession();
      if (!token) {
        showAlert(t.alertWarning, t.sessionRequired, "warning");
        return;
      }

      const apiBase = API_URL.replace(/\/+$/, "");
      const url = `${apiBase}/api/v1/cuenta/factura/${encodeURIComponent(pedidoId)}`;
      const destino = `${FileSystem.cacheDirectory}factura_${pedidoId}.pdf`;

      const result = await FileSystem.downloadAsync(url, destino, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (result.status === 404) {
        showAlert(t.alertWarning, t.pdfNoPedido, "warning");
        return;
      }
      if (result.status === 400) {
        showAlert(t.alertWarning, t.pdfNoFiscal, "warning");
        return;
      }
      if (result.status !== 200) {
        showAlert(t.alertError, t.pdfErrGenerar(result.status), "error");
        return;
      }

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(result.uri, {
          mimeType: "application/pdf",
          dialogTitle: t.pdfDialog,
        });
        showToast(t.pdfOk, "ok");
      } else {
        showToast(t.pdfOk, "ok");
      }
    } catch (e) {
      console.warn("[Factura] Error:", e?.message);
      showAlert(t.alertError, e?.message || t.pdfErrTitle, "error");
    }
  };

  const recargarFacturas = async () => {
    await Promise.all([cargarFacturacion(), cargarPedidos()]);
    showToast(t.recargarOk, "ok");
  };

  // ─── Paginación (solo sobre el historial)
  const totalPedidos = pedidos.length;
  const totalPages =
    perPage === 0 || totalPedidos === 0
      ? 1
      : Math.ceil(totalPedidos / perPage);
  const pageActual = Math.min(page, totalPages);
  const inicio = perPage === 0 ? 0 : (pageActual - 1) * perPage;
  const fin =
    perPage === 0 ? totalPedidos : Math.min(inicio + perPage, totalPedidos);

  const paginaItems = useMemo(
    () => pedidos.slice(inicio, fin),
    [pedidos, inicio, fin]
  );

  const irPagina = (n) => {
    const next = Math.max(1, Math.min(n, totalPages));
    setPage(next);
  };

  // ─── Loading
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
          <Text style={{ color: p.subtle, marginTop: 12 }}>{t.loading}</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ─── Render principal
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
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 12,
          paddingBottom: 40,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* ⭐ Intro */}
        <View
          style={[
            styles.introBox,
            {
              backgroundColor: `${p.primary}10`,
              borderColor: `${p.primary}33`,
            },
          ]}
        >
          <View
            style={[
              styles.introIconWrap,
              { backgroundColor: `${p.primary}22` },
            ]}
          >
            <Ionicons
              name="sparkles-outline"
              size={16}
              color={p.primary}
            />
          </View>
          <Text style={[styles.subtitle, { color: p.text }]}>
            {t.intro}
          </Text>
        </View>

        {/* ⭐ ¿Cómo funciona? */}
        <View
          style={[
            styles.infoBox,
            { backgroundColor: p.surface, borderColor: p.border },
          ]}
        >
          <View style={styles.infoHeader}>
            <Ionicons
              name="help-circle-outline"
              size={18}
              color={p.primary}
            />
            <Text style={[styles.infoTitle, { color: p.text }]}>
              {t.howTitle}
            </Text>
          </View>

          <View style={styles.infoList}>
            <View
              style={[styles.infoRow, { borderBottomColor: p.border }]}
            >
              <View
                style={[
                  styles.infoIconWrap,
                  { backgroundColor: `${p.primary}18` },
                ]}
              >
                <Ionicons
                  name="create-outline"
                  size={14}
                  color={p.primary}
                />
              </View>
              <Text style={[styles.infoItem, { color: p.text }]}>
                {t.how1}
              </Text>
            </View>
            <View
              style={[styles.infoRow, { borderBottomColor: p.border }]}
            >
              <View
                style={[
                  styles.infoIconWrap,
                  { backgroundColor: `${p.primary}18` },
                ]}
              >
                <Ionicons
                  name="document-text-outline"
                  size={14}
                  color={p.primary}
                />
              </View>
              <Text style={[styles.infoItem, { color: p.text }]}>
                {t.how2}
              </Text>
            </View>
            <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
              <View
                style={[
                  styles.infoIconWrap,
                  { backgroundColor: `${p.primary}18` },
                ]}
              >
                <Ionicons
                  name="receipt-outline"
                  size={14}
                  color={p.primary}
                />
              </View>
              <Text style={[styles.infoItem, { color: p.text }]}>
                {t.how3}
              </Text>
            </View>
          </View>
        </View>

        {/* ⭐ FORMULARIO DE DATOS FISCALES */}
        <View
          style={[
            styles.card,
            { backgroundColor: p.surface, borderColor: p.border },
          ]}
        >
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardHeaderLeft}>
              <View
                style={[
                  styles.cardIconWrap,
                  { backgroundColor: `${p.primary}22` },
                ]}
              >
                <Ionicons
                  name="document-text"
                  size={16}
                  color={p.primary}
                />
              </View>
              <Text style={[styles.cardTitle, { color: p.text }]}>
                {t.fiscalTitle}
              </Text>
            </View>
            {datos.updated_at ? (
              <View
                style={[
                  styles.savedBadge,
                  {
                    backgroundColor: "#22C55E18",
                    borderColor: "#22C55E55",
                  },
                ]}
              >
                <Ionicons
                  name="checkmark-circle"
                  size={12}
                  color="#22C55E"
                />
                <Text style={styles.savedBadgeText}>{t.badgeSaved}</Text>
              </View>
            ) : null}
          </View>
          <Text style={[styles.cardDesc, { color: p.subtle }]}>
            {t.fiscalDesc}
          </Text>

          <View style={styles.rowGap}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.label, { color: p.subtle }]}>
                {t.labelRfc}
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
                value={datos.rfc}
                onChangeText={(v) =>
                  setDatos({ ...datos, rfc: v.toUpperCase() })
                }
                placeholder={t.phRfc}
                placeholderTextColor={p.subtle}
                autoCapitalize="characters"
                maxLength={13}
              />
            </View>
            <View style={{ flex: 1.4 }}>
              <Text style={[styles.label, { color: p.subtle }]}>
                {t.labelRazon}
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
                value={datos.razon_social}
                onChangeText={(v) =>
                  setDatos({ ...datos, razon_social: v })
                }
                placeholder={t.phRazon}
                placeholderTextColor={p.subtle}
              />
            </View>
          </View>

          <Text style={[styles.label, { color: p.subtle, marginTop: 14 }]}>
            {t.labelRegimen}
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsScroll}
          >
            {regimenes.map((r) => {
              const activo = datos.regimen_fiscal === r.value;
              return (
                <TouchableOpacity
                  key={r.value}
                  style={[
                    styles.chip,
                    {
                      borderColor: activo ? p.primary : p.border,
                      backgroundColor: activo
                        ? `${p.primary}22`
                        : p.background,
                    },
                    activo && styles.chipActive,
                  ]}
                  onPress={() =>
                    setDatos({ ...datos, regimen_fiscal: r.value })
                  }
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
                    numberOfLines={1}
                  >
                    {r.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <Text style={[styles.label, { color: p.subtle, marginTop: 14 }]}>
            {t.labelUsoCfdi}
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsScroll}
          >
            {usosCfdi.map((u) => {
              const activo = datos.uso_cfdi === u.value;
              return (
                <TouchableOpacity
                  key={u.value}
                  style={[
                    styles.chip,
                    {
                      borderColor: activo ? p.primary : p.border,
                      backgroundColor: activo
                        ? `${p.primary}22`
                        : p.background,
                    },
                    activo && styles.chipActive,
                  ]}
                  onPress={() => setDatos({ ...datos, uso_cfdi: u.value })}
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
                    numberOfLines={1}
                  >
                    {u.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {error ? <Text style={styles.error}>{error}</Text> : null}

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

          {datos.updated_at ? (
            <View style={styles.updatedAtRow}>
              <Ionicons
                name="time-outline"
                size={12}
                color={p.subtle}
              />
              <Text style={[styles.updatedAt, { color: p.subtle }]}>
                {t.updatedAt(formatFechaHora(datos.updated_at, lang))}
              </Text>
            </View>
          ) : null}
        </View>

        {/* ⭐ Historial de facturas */}
        <View style={styles.historialHeader}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Text style={[styles.sectionTitle, { color: p.text }]}>
              {t.historial}
            </Text>
            {totalPedidos > 0 ? (
              <View
                style={[
                  styles.countBadge,
                  {
                    backgroundColor: `${p.primary}22`,
                    borderColor: `${p.primary}55`,
                  },
                ]}
              >
                <Text
                  style={{
                    color: p.primary,
                    fontWeight: "900",
                    fontSize: 11,
                  }}
                >
                  {totalPedidos}
                </Text>
              </View>
            ) : null}
          </View>
          <TouchableOpacity
            onPress={recargarFacturas}
            disabled={loadingPedidos}
            style={[
              styles.btnRecargar,
              {
                backgroundColor: `${p.primary}18`,
                borderColor: `${p.primary}55`,
              },
            ]}
          >
            {loadingPedidos ? (
              <ActivityIndicator size="small" color={p.primary} />
            ) : (
              <Ionicons name="refresh" size={14} color={p.primary} />
            )}
            <Text
              style={{
                color: p.primary,
                fontWeight: "800",
                fontSize: 12,
                marginLeft: 5,
              }}
            >
              {t.recargarFacturas}
            </Text>
          </TouchableOpacity>
        </View>

        {loadingPedidos ? (
          <View style={{ padding: 20, alignItems: "center" }}>
            <ActivityIndicator color={p.primary} />
            <Text style={{ color: p.subtle, marginTop: 8, fontSize: 12 }}>
              {t.loadingFacturas}
            </Text>
          </View>
        ) : pedidos.length === 0 ? (
          <View
            style={[
              styles.emptyBox,
              { backgroundColor: p.surface, borderColor: p.border },
            ]}
          >
            <View
              style={[
                styles.emptyIconWrap,
                { backgroundColor: `${p.primary}18` },
              ]}
            >
              <Ionicons
                name="receipt-outline"
                size={36}
                color={p.primary}
              />
            </View>
            <Text style={[styles.emptyTitle, { color: p.text }]}>
              {t.emptyTitle}
            </Text>
            <Text
              style={{
                color: p.subtle,
                marginTop: 6,
                textAlign: "center",
                fontSize: 13,
                lineHeight: 19,
              }}
            >
              {t.emptyText}
            </Text>
          </View>
        ) : (
          <>
            {paginaItems.map((pedido) => {
              const idPedido = pedido._id || pedido.id || "";
              const numeroPedido =
                pedido.numero_pedido || idPedido.toString().substring(0, 8);
              const fechaPedido =
                pedido.created_at || pedido.createdAt || null;
              const total = Number(
                pedido.total || pedido.totalEstimado || 0
              );
              const itemsCount = Array.isArray(pedido.items)
                ? pedido.items.length
                : Array.isArray(pedido.productos)
                ? pedido.productos.length
                : 0;
              const estado =
                pedido.estado || pedido.status || t.estadoPendiente;

              const pagado = String(
                pedido.paymentStatus || pedido.estado_pago || ""
              ).toLowerCase();
              const esPagado = pagado === "pagado" || pagado === "paid";
              const barColor = esPagado ? "#22C55E" : "#F59E0B";

              const itemsLabel =
                itemsCount === 1
                  ? `${itemsCount} ${t.facturaArticuloSingular}`
                  : `${itemsCount} ${t.facturaArticuloPlural}`;

              return (
                <View
                  key={idPedido}
                  style={[
                    styles.facturaCard,
                    {
                      backgroundColor: p.surface,
                      borderColor: p.border,
                      borderLeftColor: barColor,
                    },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.facturaId, { color: p.text }]}>
                      {t.facturaPrefix} #{numeroPedido}
                    </Text>
                    <View
                      style={{
                        flexDirection: "row",
                        flexWrap: "wrap",
                        marginTop: 6,
                        gap: 8,
                      }}
                    >
                      <View style={styles.metaRow}>
                        <Ionicons
                          name="calendar-outline"
                          size={11}
                          color={p.subtle}
                        />
                        <Text
                          style={{ color: p.subtle, fontSize: 11 }}
                        >
                          {formatFecha(fechaPedido, lang)}
                        </Text>
                      </View>
                      <View style={styles.metaRow}>
                        <Ionicons
                          name="cube-outline"
                          size={11}
                          color={p.subtle}
                        />
                        <Text
                          style={{ color: p.subtle, fontSize: 11 }}
                        >
                          {itemsLabel}
                        </Text>
                      </View>
                      <View style={styles.metaRow}>
                        <Ionicons
                          name="pricetag-outline"
                          size={11}
                          color={p.subtle}
                        />
                        <Text
                          style={{ color: p.subtle, fontSize: 11 }}
                        >
                          {estado}
                        </Text>
                      </View>
                    </View>
                  </View>
                  <View
                    style={{ alignItems: "flex-end", gap: 8 }}
                  >
                    <Text
                      style={[styles.facturaTotal, { color: p.text }]}
                    >
                      {currency(total, lang)}
                    </Text>
                    <TouchableOpacity
                      onPress={() => descargarFacturaPDF(idPedido)}
                      style={[
                        styles.btnPDF,
                        {
                          borderColor: "#EF4444",
                          backgroundColor: "#EF444412",
                        },
                      ]}
                    >
                      <Ionicons
                        name="download-outline"
                        size={13}
                        color="#EF4444"
                      />
                      <Text
                        style={{
                          color: "#EF4444",
                          fontWeight: "800",
                          fontSize: 11,
                          marginLeft: 4,
                        }}
                      >
                        {t.btnPDF}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}

            {totalPages > 1 ? (
              <View style={styles.pagination}>
                <TouchableOpacity
                  onPress={() => irPagina(pageActual - 1)}
                  disabled={pageActual === 1}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  style={[
                    styles.pageBtn,
                    {
                      backgroundColor: p.surface,
                      borderColor: p.border,
                      opacity: pageActual === 1 ? 0.4 : 1,
                    },
                  ]}
                  accessibilityLabel={t.prevPage}
                >
                  <Ionicons
                    name="chevron-back"
                    size={18}
                    color={p.text}
                  />
                </TouchableOpacity>

                <View
                  style={[
                    styles.pageIndicatorPill,
                    {
                      backgroundColor: `${p.primary}18`,
                      borderColor: `${p.primary}44`,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.pageIndicator,
                      { color: p.primary },
                    ]}
                  >
                    {t.pageIndicator(pageActual, totalPages)}
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={() => irPagina(pageActual + 1)}
                  disabled={pageActual === totalPages}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  style={[
                    styles.pageBtn,
                    {
                      backgroundColor: p.surface,
                      borderColor: p.border,
                      opacity:
                        pageActual === totalPages ? 0.4 : 1,
                    },
                  ]}
                  accessibilityLabel={t.nextPage}
                >
                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color={p.text}
                  />
                </TouchableOpacity>
              </View>
            ) : null}
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ⭐ TOAST — confirmaciones (Ok / guardado) */}
      {toast ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.toast,
            {
              backgroundColor:
                toast.type === "error" ? "#B91C1C" : "#059669",
              opacity: toastOpacity,
              transform: [{ translateY: toastTranslateY }],
            },
          ]}
        >
          <Ionicons
            name={
              toast.type === "error"
                ? "alert-circle"
                : "checkmark-circle"
            }
            size={18}
            color="#FFF"
          />
          <Text style={styles.toastText} numberOfLines={2}>
            {toast.message}
          </Text>
        </Animated.View>
      ) : null}

      {/* ⭐ MODAL — errores y avisos */}
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
                {
                  backgroundColor:
                    modal?.type === "error" ? "#EF444418" : "#F59E0B18",
                },
              ]}
            >
              <Ionicons
                name={
                  modal?.type === "error"
                    ? "close-circle"
                    : "warning"
                }
                size={34}
                color={
                  modal?.type === "error" ? "#EF4444" : "#F59E0B"
                }
              />
            </View>

            <Text style={[styles.modalTitle, { color: p.text }]}>
              {modal?.title}
            </Text>
            <Text style={[styles.modalMessage, { color: p.subtle }]}>
              {modal?.message}
            </Text>

            <TouchableOpacity
              onPress={closeModal}
              style={[
                styles.modalBtn,
                {
                  backgroundColor:
                    modal?.type === "error" ? "#EF4444" : p.primary,
                },
              ]}
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

// ────────────────────────────────────────────────────────────────
// Estilos
// ────────────────────────────────────────────────────────────────
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

  introBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 14,
  },
  introIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  subtitle: { flex: 1, fontSize: 13, lineHeight: 20 },

  infoBox: {
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  infoHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  infoTitle: { fontSize: 14, fontWeight: "800", letterSpacing: -0.2 },
  infoList: { marginTop: 0 },
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  infoIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  infoItem: { fontSize: 12.5, lineHeight: 18, flex: 1, fontWeight: "500" },

  card: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    marginBottom: 18,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  cardHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  cardIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: { fontSize: 15, fontWeight: "800", letterSpacing: -0.2 },
  cardDesc: { fontSize: 12, marginBottom: 8, lineHeight: 17 },

  savedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  savedBadgeText: {
    fontSize: 10,
    fontWeight: "900",
    color: "#22C55E",
    letterSpacing: 0.3,
  },

  rowGap: { flexDirection: "row", gap: 10, marginTop: 8 },
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

  chipsScroll: { gap: 8, paddingVertical: 4, paddingRight: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1.4,
    maxWidth: 320,
  },
  chipActive: {
    shadowColor: "#6366F1",
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  chipText: { fontSize: 12.5, fontWeight: "700" },

  btnGuardar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 20,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    minHeight: 50,
  },
  btnText: { color: "#FFF", fontWeight: "800", fontSize: 15 },
  error: {
    color: "#EF4444",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 12,
  },
  updatedAtRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    marginTop: 12,
  },
  updatedAt: { fontSize: 11, textAlign: "center" },

  historialHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: "800", letterSpacing: -0.2 },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
    minWidth: 24,
    alignItems: "center",
  },
  btnRecargar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },

  emptyBox: {
    padding: 26,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 4,
  },

  facturaCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderLeftWidth: 3,
    marginBottom: 10,
    gap: 12,
  },
  facturaId: { fontSize: 13.5, fontWeight: "800", letterSpacing: -0.1 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  facturaTotal: { fontSize: 16, fontWeight: "900", letterSpacing: -0.3 },
  btnPDF: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },

  pagination: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    paddingVertical: 16,
  },
  pageBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  pageIndicatorPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    minWidth: 80,
    alignItems: "center",
  },
  pageIndicator: {
    fontSize: 13,
    fontWeight: "900",
    textAlign: "center",
    letterSpacing: 0.3,
  },

  // ⭐ Toast (feedback de éxito/error)
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
  },

  // ⭐ Modal (errores / avisos)
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
  modalBtnText: {
    color: "#FFF",
    fontWeight: "800",
    fontSize: 15,
  },
});