// src/screens/PaymentMethodsScreen.js
import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { request } from "../services/api";
import { usePreferences } from "../context/PreferencesContext";

const CUENTA_BASE = "/api/v1/cuenta";
const EP_METODOS = `${CUENTA_BASE}/metodos-pago`;

// ================================================================
// ⭐ INTERNACIONALIZACIÓN (ES/EN)
// ================================================================
const T = {
  es: {
    headerTitle: "Métodos de Pago",
    headerSub: "Administra tus tarjetas y métodos guardados.",
    add: "Agregar",
    back: "Atrás",
    close: "Cerrar",

    loading: "Cargando...",
    loadErrTitle: "Error",
    loadErrSub: "No se pudieron cargar tus métodos de pago.",

    emptyTitle: "No tienes métodos guardados",
    emptyText:
      "Agrega una tarjeta, PayPal u OXXO para pagar más rápido en tu próxima compra.",
    emptyAdd: "Agregar mi primer método",

    // Títulos / detalle por método
    titleCard: (marca, ultimos4) => `${marca} •••• ${ultimos4}`,
    titleCardFallback: "Tarjeta",
    titlePaypal: "PayPal",
    titleOxxo: "Pago en OXXO",
    titleFallback: "Método de pago",
    oxxoRefPrefix: "Referencia:",
    oxxoRefPending: "Referencia al pagar en tienda",

    badgePredeterminada: "Predeterminada",
    markPredA11y: "Marcar como predeterminada",
    deleteA11y: "Eliminar método",

    // Modal
    modalTitle: "Nuevo método de pago",
    labelTipo: "Tipo de método",
    tipoTarjeta: "Tarjeta",
    tipoPaypal: "PayPal",
    tipoOxxo: "OXXO",

    // Tarjeta
    labelNumero: "Número de tarjeta *",
    placeholderNumero: "1234 5678 9012 3456",
    labelTitular: "Nombre del titular *",
    placeholderTitular: "Como aparece en la tarjeta",
    labelMes: "Mes *",
    placeholderMes: "MM",
    labelAnio: "Año *",
    placeholderAnio: "AA",
    labelCvc: "CVC *",
    placeholderCvc: "123",

    // PayPal
    labelEmailPaypal: "Email de PayPal *",
    placeholderEmailPaypal: "usuario@ejemplo.com",

    // OXXO
    oxxoInfo:
      "Se generará una referencia de pago al finalizar tu compra.",

    // Botones / acciones
    guardar: "Guardar método",
    cancelar: "Cancelar",
    eliminar: "Eliminar",
    eliminarTitle: "Eliminar método",
    eliminarSub: "¿Quitar este método de pago?",
    guardadoTitle: "Listo",
    guardadoSub: "Método agregado correctamente.",
    guardarErrTitle: "Error",
    guardarErrSub: "No se pudo guardar el método.",
    eliminarErrSub: "No se pudo eliminar el método.",
    predErrSub: "No se pudo actualizar el método.",

    // Validaciones
    valTitleTarjeta: "Tarjeta",
    valNumero: "Número de tarjeta inválido.",
    valTitular: "Ingresa el nombre del titular.",
    valMes: "Mes de expiración inválido (01-12).",
    valAnio: "Año de expiración inválido (2 dígitos).",
    valCvc: "CVC inválido (3 o 4 dígitos).",
    valTitlePaypal: "PayPal",
    valEmail: "Ingresa un email válido.",
  },
  en: {
    headerTitle: "Payment Methods",
    headerSub: "Manage your saved cards and methods.",
    add: "Add",
    back: "Back",
    close: "Close",

    loading: "Loading...",
    loadErrTitle: "Error",
    loadErrSub: "Could not load your payment methods.",

    emptyTitle: "You have no saved methods",
    emptyText:
      "Add a card, PayPal or OXXO to pay faster on your next purchase.",
    emptyAdd: "Add my first method",

    titleCard: (marca, ultimos4) => `${marca} •••• ${ultimos4}`,
    titleCardFallback: "Card",
    titlePaypal: "PayPal",
    titleOxxo: "OXXO payment",
    titleFallback: "Payment method",
    oxxoRefPrefix: "Reference:",
    oxxoRefPending: "Reference at store payment",

    badgePredeterminada: "Default",
    markPredA11y: "Mark as default",
    deleteA11y: "Delete method",

    modalTitle: "New payment method",
    labelTipo: "Method type",
    tipoTarjeta: "Card",
    tipoPaypal: "PayPal",
    tipoOxxo: "OXXO",

    labelNumero: "Card number *",
    placeholderNumero: "1234 5678 9012 3456",
    labelTitular: "Cardholder name *",
    placeholderTitular: "As it appears on the card",
    labelMes: "Month *",
    placeholderMes: "MM",
    labelAnio: "Year *",
    placeholderAnio: "YY",
    labelCvc: "CVC *",
    placeholderCvc: "123",

    labelEmailPaypal: "PayPal email *",
    placeholderEmailPaypal: "user@example.com",

    oxxoInfo:
      "A payment reference will be generated when you finish your purchase.",

    guardar: "Save method",
    cancelar: "Cancel",
    eliminar: "Delete",
    eliminarTitle: "Delete method",
    eliminarSub: "Remove this payment method?",
    guardadoTitle: "Done",
    guardadoSub: "Method added successfully.",
    guardarErrTitle: "Error",
    guardarErrSub: "Could not save the method.",
    eliminarErrSub: "Could not delete the method.",
    predErrSub: "Could not update the method.",

    valTitleTarjeta: "Card",
    valNumero: "Invalid card number.",
    valTitular: "Enter the cardholder name.",
    valMes: "Invalid expiration month (01-12).",
    valAnio: "Invalid expiration year (2 digits).",
    valCvc: "Invalid CVC (3 or 4 digits).",
    valTitlePaypal: "PayPal",
    valEmail: "Enter a valid email.",
  },
};

const getLang = (language) => {
  const l = String(language || "es").toLowerCase();
  return l.startsWith("en") ? "en" : "es";
};

// ────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────
const formatearNumeroTarjeta = (v) => {
  const digits = String(v || "").replace(/\D/g, "").slice(0, 19);
  return digits.replace(/(.{4})/g, "$1 ").trim();
};

const detectarMarca = (num) => {
  const n = String(num || "").replace(/\s/g, "");
  if (/^4/.test(n)) return "Visa";
  if (/^5[1-5]/.test(n)) return "Mastercard";
  if (/^2[2-7]/.test(n)) return "Mastercard";
  if (/^3[47]/.test(n)) return "American Express";
  if (/^6(?:011|5)/.test(n)) return "Discover";
  return "Tarjeta";
};

const iconoParaTipo = (tipo) => {
  if (tipo === "paypal") return { name: "logo-paypal", color: "#003087" };
  if (tipo === "oxxo") return { name: "storefront", color: "#E30613" };
  return { name: "card", color: "#10B981" };
};

const tituloParaMetodo = (m, t) => {
  if (m.tipo === "tarjeta") {
    const marca = m.marca || t.titleCardFallback;
    const ultimos4 = m.ultimos4 || "····";
    return t.titleCard(marca, ultimos4);
  }
  if (m.tipo === "paypal") return t.titlePaypal;
  if (m.tipo === "oxxo") return t.titleOxxo;
  return t.titleFallback;
};

const detalleParaMetodo = (m, t) => {
  if (m.tipo === "tarjeta") {
    const titular = (m.titular || "").trim();
    const expira = (m.expira || "").trim();
    if (titular && expira) return `${titular} · ${expira}`;
    return titular || expira || "";
  }
  if (m.tipo === "paypal") return m.email || "";
  if (m.tipo === "oxxo")
    return m.referencia
      ? `${t.oxxoRefPrefix} ${m.referencia}`
      : t.oxxoRefPending;
  return "";
};

// ────────────────────────────────────────────────────────────────
// Screen
// ────────────────────────────────────────────────────────────────
export default function PaymentMethodsScreen({ navigation }) {
  const prefs = usePreferences() || {};
  const mode = prefs.mode;
  const lang = getLang(prefs.language);
  const tI18n = T[lang];
  const isDark = mode === "dark";

  const [methods, setMethods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form
  const [tipo, setTipo] = useState("tarjeta");
  const [numero, setNumero] = useState("");
  const [titular, setTitular] = useState("");
  const [expMonth, setExpMonth] = useState("");
  const [expYear, setExpYear] = useState("");
  const [cvc, setCvc] = useState("");
  const [emailPaypal, setEmailPaypal] = useState("");

  const t = useMemo(() => (isDark ? darkTheme : lightTheme), [isDark]);

  // ─── Carga
  const cargar = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const data = await request(EP_METODOS, { method: "GET" });
        const lista =
          (Array.isArray(data?.metodos) && data.metodos) ||
          (Array.isArray(data?.data) && data.data) ||
          (Array.isArray(data) && data) ||
          [];
        setMethods(lista);
      } catch (e) {
        console.error("[PaymentMethods] cargar:", e?.message || e);
        if (!silent) {
          Alert.alert(
            tI18n.loadErrTitle,
            e?.message || tI18n.loadErrSub
          );
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [tI18n]
  );

  useEffect(() => {
    cargar();
  }, [cargar]);

  const onRefresh = () => {
    setRefreshing(true);
    cargar(true);
  };

  const resetForm = () => {
    setTipo("tarjeta");
    setNumero("");
    setTitular("");
    setExpMonth("");
    setExpYear("");
    setCvc("");
    setEmailPaypal("");
  };

  const abrirModal = () => {
    resetForm();
    setModalVisible(true);
  };

  // ─── Guardar
  const guardar = async () => {
    if (tipo === "tarjeta") {
      const n = numero.replace(/\s/g, "");
      if (n.length < 13)
        return Alert.alert(tI18n.valTitleTarjeta, tI18n.valNumero);
      if (!titular.trim())
        return Alert.alert(tI18n.valTitleTarjeta, tI18n.valTitular);
      if (
        !/^\d{2}$/.test(expMonth) ||
        parseInt(expMonth, 10) < 1 ||
        parseInt(expMonth, 10) > 12
      )
        return Alert.alert(tI18n.valTitleTarjeta, tI18n.valMes);
      if (!/^\d{2}$/.test(expYear))
        return Alert.alert(tI18n.valTitleTarjeta, tI18n.valAnio);
      if (!/^\d{3,4}$/.test(cvc))
        return Alert.alert(tI18n.valTitleTarjeta, tI18n.valCvc);
    } else if (tipo === "paypal") {
      if (!emailPaypal.includes("@"))
        return Alert.alert(tI18n.valTitlePaypal, tI18n.valEmail);
    }

    setSaving(true);
    try {
      let payload;
      if (tipo === "tarjeta") {
        const tokenId =
          "tok_" +
          Date.now().toString(36) +
          "_" +
          Math.random().toString(36).slice(2, 10);
        const n = numero.replace(/\s/g, "");
        payload = {
          tipo: "tarjeta",
          token_id: tokenId,
          marca: detectarMarca(n),
          ultimos4: n.slice(-4),
          titular: titular.trim(),
          expira: `${expMonth}/${expYear}`,
        };
      } else if (tipo === "paypal") {
        payload = { tipo: "paypal", email: emailPaypal.trim() };
      } else {
        payload = { tipo: "oxxo" };
      }

      await request(EP_METODOS, { method: "POST", body: payload });
      setModalVisible(false);
      resetForm();
      await cargar(true);
      Alert.alert(tI18n.guardadoTitle, tI18n.guardadoSub);
    } catch (e) {
      console.error("[PaymentMethods] guardar:", e?.message || e);
      Alert.alert(tI18n.guardarErrTitle, e?.message || tI18n.guardarErrSub);
    } finally {
      setSaving(false);
    }
  };

  // ─── Eliminar
  const eliminar = (id) => {
    Alert.alert(tI18n.eliminarTitle, tI18n.eliminarSub, [
      { text: tI18n.cancelar, style: "cancel" },
      {
        text: tI18n.eliminar,
        style: "destructive",
        onPress: async () => {
          try {
            await request(`${EP_METODOS}/${encodeURIComponent(id)}`, {
              method: "DELETE",
            });
            await cargar(true);
          } catch (e) {
            console.error("[PaymentMethods] eliminar:", e?.message || e);
            Alert.alert(tI18n.guardarErrTitle, e?.message || tI18n.eliminarErrSub);
          }
        },
      },
    ]);
  };

  // ─── Predeterminada
  const marcarPredeterminado = async (id) => {
    try {
      await request(
        `${EP_METODOS}/${encodeURIComponent(id)}/predeterminado`,
        { method: "POST" }
      );
      await cargar(true);
    } catch (e) {
      console.error("[PaymentMethods] predeterminado:", e?.message || e);
      Alert.alert(tI18n.guardarErrTitle, e?.message || tI18n.predErrSub);
    }
  };

  // ─── Render de un método
  const renderMetodo = (m, idx) => {
    const key = m.id || m._id || `m-${idx}`;
    const icono = iconoParaTipo(m.tipo);
    const detalle = detalleParaMetodo(m, tI18n);

    return (
      <View
        key={key}
        style={[
          styles.card,
          { backgroundColor: t.card, borderColor: t.border },
        ]}
      >
        <View style={[styles.cardIcon, { backgroundColor: t.iconBg }]}>
          <Ionicons name={icono.name} size={24} color={icono.color} />
        </View>

        <View style={{ flex: 1 }}>
          <View style={styles.cardTitleRow}>
            <Text
              style={[styles.cardTitle, { color: t.text }]}
              numberOfLines={1}
            >
              {tituloParaMetodo(m, tI18n)}
            </Text>
            {m.predeterminado && (
              <View style={styles.badgePred}>
                <Text style={styles.badgePredText}>
                  {tI18n.badgePredeterminada}
                </Text>
              </View>
            )}
          </View>
          {!!detalle && (
            <Text
              style={[styles.cardSub, { color: t.textMuted }]}
              numberOfLines={1}
            >
              {detalle}
            </Text>
          )}
        </View>

        <View style={styles.cardActions}>
          {!m.predeterminado && (
            <TouchableOpacity
              onPress={() => marcarPredeterminado(key)}
              style={styles.iconBtn}
              accessibilityLabel={tI18n.markPredA11y}
            >
              <Ionicons name="star-outline" size={20} color="#10B981" />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => eliminar(key)}
            style={styles.iconBtn}
            accessibilityLabel={tI18n.deleteA11y}
          >
            <Ionicons name="trash-outline" size={20} color="#EF4444" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const tipos = [
    { key: "tarjeta", label: tI18n.tipoTarjeta, icon: "card" },
    { key: "paypal", label: tI18n.tipoPaypal, icon: "logo-paypal" },
    { key: "oxxo", label: tI18n.tipoOxxo, icon: "storefront" },
  ];

  // ─── Render principal
  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: t.bg }]}
      edges={["top", "left", "right"]}
    >
      {/* HEADER con flecha atrás */}
      <View
        style={[
          styles.header,
          { backgroundColor: t.bg, borderBottomColor: t.border },
        ]}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          accessibilityLabel={tI18n.back}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={22} color={t.text} />
        </TouchableOpacity>

        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: t.text }]}>
            {tI18n.headerTitle}
          </Text>
          <Text style={[styles.headerSub, { color: t.textMuted }]}>
            {tI18n.headerSub}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.addBtn}
          onPress={abrirModal}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={20} color="#FFF" />
          <Text style={styles.addBtnText}>{tI18n.add}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#6366F1"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color="#6366F1" />
          </View>
        ) : methods.length === 0 ? (
          <View style={styles.empty}>
            <View style={[styles.emptyIcon, { backgroundColor: t.iconBg }]}>
              <Ionicons name="card-outline" size={44} color={t.textMuted} />
            </View>
            <Text style={[styles.emptyTitle, { color: t.text }]}>
              {tI18n.emptyTitle}
            </Text>
            <Text style={[styles.emptyText, { color: t.textMuted }]}>
              {tI18n.emptyText}
            </Text>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={abrirModal}
              activeOpacity={0.85}
            >
              <Ionicons name="add-circle" size={18} color="#FFF" />
              <Text style={styles.primaryBtnText}>
                {tI18n.emptyAdd}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          methods.map(renderMetodo)
        )}
      </ScrollView>

      {/* MODAL: Agregar método */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => !saving && setModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalBackdrop}
        >
          <View style={[styles.modalCard, { backgroundColor: t.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: t.text }]}>
                {tI18n.modalTitle}
              </Text>
              <TouchableOpacity
                onPress={() => !saving && setModalVisible(false)}
                accessibilityLabel={tI18n.close}
              >
                <Ionicons name="close" size={24} color={t.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 10 }}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={[styles.label, { color: t.textMuted }]}>
                {tI18n.labelTipo}
              </Text>
              <View style={styles.tipoRow}>
                {tipos.map((opt) => (
                  <TouchableOpacity
                    key={opt.key}
                    onPress={() => setTipo(opt.key)}
                    style={[
                      styles.tipoBtn,
                      { borderColor: t.border, backgroundColor: t.bg },
                      tipo === opt.key && styles.tipoBtnActive,
                    ]}
                    activeOpacity={0.85}
                  >
                    <Ionicons
                      name={opt.icon}
                      size={18}
                      color={tipo === opt.key ? "#FFF" : t.text}
                    />
                    <Text
                      style={[
                        styles.tipoBtnText,
                        { color: tipo === opt.key ? "#FFF" : t.text },
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {tipo === "tarjeta" && (
                <>
                  <Text style={[styles.label, { color: t.textMuted }]}>
                    {tI18n.labelNumero}
                  </Text>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        borderColor: t.border,
                        color: t.text,
                        backgroundColor: t.bg,
                      },
                    ]}
                    value={numero}
                    onChangeText={(v) => setNumero(formatearNumeroTarjeta(v))}
                    keyboardType="number-pad"
                    placeholder={tI18n.placeholderNumero}
                    placeholderTextColor={t.textMuted}
                    maxLength={19}
                  />

                  <Text style={[styles.label, { color: t.textMuted }]}>
                    {tI18n.labelTitular}
                  </Text>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        borderColor: t.border,
                        color: t.text,
                        backgroundColor: t.bg,
                      },
                    ]}
                    value={titular}
                    onChangeText={setTitular}
                    placeholder={tI18n.placeholderTitular}
                    placeholderTextColor={t.textMuted}
                    autoCapitalize="characters"
                  />

                  <View style={{ flexDirection: "row", gap: 10 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.label, { color: t.textMuted }]}>
                        {tI18n.labelMes}
                      </Text>
                      <TextInput
                        style={[
                          styles.input,
                          {
                            borderColor: t.border,
                            color: t.text,
                            backgroundColor: t.bg,
                          },
                        ]}
                        value={expMonth}
                        onChangeText={(v) =>
                          setExpMonth(v.replace(/\D/g, "").slice(0, 2))
                        }
                        keyboardType="number-pad"
                        placeholder={tI18n.placeholderMes}
                        placeholderTextColor={t.textMuted}
                        maxLength={2}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.label, { color: t.textMuted }]}>
                        {tI18n.labelAnio}
                      </Text>
                      <TextInput
                        style={[
                          styles.input,
                          {
                            borderColor: t.border,
                            color: t.text,
                            backgroundColor: t.bg,
                          },
                        ]}
                        value={expYear}
                        onChangeText={(v) =>
                          setExpYear(v.replace(/\D/g, "").slice(0, 2))
                        }
                        keyboardType="number-pad"
                        placeholder={tI18n.placeholderAnio}
                        placeholderTextColor={t.textMuted}
                        maxLength={2}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.label, { color: t.textMuted }]}>
                        {tI18n.labelCvc}
                      </Text>
                      <TextInput
                        style={[
                          styles.input,
                          {
                            borderColor: t.border,
                            color: t.text,
                            backgroundColor: t.bg,
                          },
                        ]}
                        value={cvc}
                        onChangeText={(v) =>
                          setCvc(v.replace(/\D/g, "").slice(0, 4))
                        }
                        keyboardType="number-pad"
                        placeholder={tI18n.placeholderCvc}
                        placeholderTextColor={t.textMuted}
                        maxLength={4}
                        secureTextEntry
                      />
                    </View>
                  </View>
                </>
              )}

              {tipo === "paypal" && (
                <>
                  <Text style={[styles.label, { color: t.textMuted }]}>
                    {tI18n.labelEmailPaypal}
                  </Text>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        borderColor: t.border,
                        color: t.text,
                        backgroundColor: t.bg,
                      },
                    ]}
                    value={emailPaypal}
                    onChangeText={setEmailPaypal}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    placeholder={tI18n.placeholderEmailPaypal}
                    placeholderTextColor={t.textMuted}
                  />
                </>
              )}

              {tipo === "oxxo" && (
                <View
                  style={[
                    styles.infoBox,
                    {
                      backgroundColor: isDark ? "#1E293B" : "#F1F5F9",
                      borderColor: t.border,
                    },
                  ]}
                >
                  <Ionicons
                    name="storefront"
                    size={18}
                    color={t.textMuted}
                  />
                  <Text
                    style={{ flex: 1, color: t.text, fontSize: 13 }}
                  >
                    {tI18n.oxxoInfo}
                  </Text>
                </View>
              )}
            </ScrollView>

            <TouchableOpacity
              style={[styles.primaryBtn, { marginTop: 12 }]}
              onPress={guardar}
              disabled={saving}
              activeOpacity={0.85}
            >
              {saving ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={18} color="#FFF" />
                  <Text style={styles.primaryBtnText}>{tI18n.guardar}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

// ────────────────────────────────────────────────────────────────
// Temas
// ────────────────────────────────────────────────────────────────
const lightTheme = {
  bg: "#FFFFFF",
  card: "#F8FAFC",
  border: "#E2E8F0",
  text: "#0F172A",
  textMuted: "#64748B",
  iconBg: "#F1F5F9",
};

const darkTheme = {
  bg: "#020617",
  card: "#0F172A",
  border: "#1E293B",
  text: "#F1F5F9",
  textMuted: "#94A3B8",
  iconBg: "#1E293B",
};

// ────────────────────────────────────────────────────────────────
// Estilos
// ────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },

  // Header con flecha atrás
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 18, fontWeight: "800" },
  headerSub: { fontSize: 12, marginTop: 2 },

  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#6366F1",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  addBtnText: { color: "#FFF", fontWeight: "700", fontSize: 13 },

  scrollContent: { paddingHorizontal: 16, paddingVertical: 16, paddingBottom: 40 },

  // Loading
  loadingWrap: { paddingTop: 60, alignItems: "center" },

  // Cards de métodos
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderWidth: 1,
    padding: 16,
    borderRadius: 18,
    marginBottom: 12,
  },
  cardIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  cardTitle: { fontSize: 15, fontWeight: "700" },
  cardSub: { fontSize: 12, marginTop: 3 },
  badgePred: {
    backgroundColor: "#D1FAE5",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  badgePredText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#065F46",
    letterSpacing: 0.3,
  },
  cardActions: { flexDirection: "row", gap: 4 },
  iconBtn: { padding: 8, borderRadius: 10 },

  // Estado vacío
  empty: { alignItems: "center", paddingVertical: 60, paddingHorizontal: 24 },
  emptyIcon: {
    width: 96,
    height: 96,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "800",
    marginBottom: 8,
    textAlign: "center",
  },
  emptyText: {
    fontSize: 13,
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 19,
  },

  // Botón primario
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#6366F1",
    paddingVertical: 14,
    borderRadius: 999,
    paddingHorizontal: 24,
  },
  primaryBtnText: { color: "#FFF", fontWeight: "800", fontSize: 15 },

  // Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.55)",
    justifyContent: "flex-end",
  },
  modalCard: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: "90%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  modalTitle: { fontSize: 18, fontWeight: "800" },

  label: { fontSize: 12, fontWeight: "700", marginTop: 12, marginBottom: 4 },
  input: {
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },

  tipoRow: { flexDirection: "row", gap: 8, marginTop: 4 },
  tipoBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  tipoBtnActive: { backgroundColor: "#6366F1", borderColor: "#6366F1" },
  tipoBtnText: { fontSize: 13, fontWeight: "700" },

  infoBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginTop: 14,
  },
});