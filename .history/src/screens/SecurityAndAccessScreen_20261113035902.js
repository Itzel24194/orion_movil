// screens/SecurityAndAccessScreen.js
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Image,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { usePreferences } from "../context/PreferencesContext";
import { Text } from "../i18n/ui";
import {
  loadSession,
  cambiarPassword,
  fetchEstado2FA,
  iniciar2FA,
  confirmar2FA,
  desactivar2FA,
  regenerarCodigos2FA,
  fetchSesiones,
  cerrarSesion as cerrarSesionApi,
  cerrarTodasSesiones as cerrarTodasSesionesApi,
} from "../services/api";

let LocalAuthentication = null;
let SecureStore = null;
try {
  LocalAuthentication = require("expo-local-authentication");
} catch (e) {
  if (__DEV__) {
    console.warn(
      "[Security] expo-local-authentication no instalado. Biometría deshabilitada."
    );
  }
}
try {
  SecureStore = require("expo-secure-store");
} catch (e) {
  if (__DEV__) {
    console.warn(
      "[Security] expo-secure-store no instalado. Biometría deshabilitada."
    );
  }
}

const BIOMETRICS_AVAILABLE = !!(LocalAuthentication && SecureStore);

const FALLBACK_PALETTE = {
  background: "#0F172A",
  surface: "#1E293B",
  text: "#F1F5F9",
  subtle: "#94A3B8",
  border: "#334155",
  primary: "#6366F1",
  danger: "#EF4444",
  success: "#22C55E",
  warning: "#F59E0B",
};

const withFallback = (p = {}) => ({ ...FALLBACK_PALETTE, ...(p || {}) });

const BIOMETRIC_KEY_ENABLED = "@orion/security/biometric_enabled";
const BIOMETRIC_KEY_TOKEN = "@orion/security/biometric_token";

const T = {
  es: {
    title: "Seguridad y Acceso",
    subtitle: "Protege tu cuenta con contraseña, 2FA y biometría.",

    pwdTitle: "Cambiar contraseña",
    pwdSub: "Actualiza tu contraseña periódicamente.",
    pwdActual: "Contraseña actual",
    pwdNueva: "Nueva contraseña",
    pwdConfirmar: "Confirmar nueva contraseña",
    pwdSave: "Actualizar contraseña",
    pwdOk: "Contraseña actualizada correctamente",
    pwdErr: "No se pudo actualizar la contraseña",
    pwdMismatch: "Las contraseñas no coinciden",
    pwdShort: "La contraseña debe tener al menos 8 caracteres",
    pwdSame: "La nueva contraseña debe ser distinta a la actual",
    pwdRequired: "Completa todos los campos",
    pwdWeak: "Contraseña débil",
    pwdMedium: "Contraseña aceptable",
    pwdStrong: "Contraseña fuerte",
    pwdVeryStrong: "Contraseña muy fuerte",

    reqTitle: "La contraseña debe tener:",
    reqLen: "Mínimo 8 caracteres",
    reqUpper: "Una mayúscula (A-Z)",
    reqLower: "Una minúscula (a-z)",
    reqNum: "Un número (0-9)",
    reqSym: "Un símbolo (!@#$...)",
    reqDiff: "Distinta a la actual",

    tfaTitle: "Verificación en dos pasos (2FA)",
    tfaSub: "Añade una capa extra de seguridad con tu app autenticadora.",
    tfaActive: "Activo",
    tfaInactive: "Inactivo",
    tfaEnable: "Activar 2FA",
    tfaDisable: "Desactivar 2FA",
    tfaRegenerate: "Regenerar códigos",
    tfaStep1:
      "Paso 1: Descarga Google Authenticator, Authy o Microsoft Authenticator.",
    tfaStep2: "Paso 2: Escanea este código QR con la app.",
    tfaStep3: "Paso 3: Ingresa el código de 6 dígitos que muestra la app.",
    tfaManual: "O ingresa este código manualmente:",
    tfaCode: "Código de verificación",
    tfaActivate: "Activar 2FA",
    tfaCancel: "Cancelar",
    tfaConfirm: "Confirmar",
    tfaCodeInvalid: "Ingresa un código de 6 dígitos",
    tfaCodeWrong: "Código incorrecto",
    tfaDisabled: "2FA desactivado",
    tfaBackupTitle: "Guarda tus códigos de respaldo",
    tfaBackupSub:
      "Estos códigos te permitirán acceder si pierdes tu teléfono. No se volverán a mostrar.",
    tfaBackupDone: "Ya los guardé",
    tfaPasswordPrompt: "Confirma tu contraseña actual",
    tfaPasswordRequired: "Ingresa tu contraseña",
    tfaDisableWarn:
      "Al desactivar 2FA tu cuenta será menos segura. ¿Estás seguro?",
    tfaRemaining: (n) => `${n} códigos de respaldo restantes`,
    tfaNoQr: "El servidor no devolvió el QR. Usa el código manual.",
    tfaPyotpMissing: "El servidor no tiene pyotp instalado",
    tfaStartErr: "No se pudo iniciar 2FA",
    tfaBackendMissing:
      "El backend no expone /cuenta/2fa/iniciar. Revisa server.js.",
    tfaDisableErr: "No se pudo desactivar 2FA",
    tfaRegenerateErr: "No se pudieron regenerar los códigos",
    tfaRegenerateWarn:
      "Esto invalidará todos los códigos anteriores y generará 8 nuevos.",

    sessionsTitle: "Sesiones activas",
    sessionsSub: "Dispositivos donde tu cuenta está abierta ahora mismo.",
    sessionsEmpty: "No hay otras sesiones activas.",
    sessionsCurrent: "Esta sesión",
    sessionsCloseAll: "Cerrar todas las demás sesiones",
    sessionsCloseOne: "Cerrar sesión",
    sessionsConfirmOne: "¿Cerrar esta sesión?",
    sessionsConfirmAll:
      "¿Cerrar todas las demás sesiones? Tendrás que iniciar sesión de nuevo en esos dispositivos.",
    sessionsClosedOne: "Sesión cerrada",
    sessionsClosedAll: "Sesiones cerradas",
    sessionsLoadErr: "No se pudieron cargar las sesiones activas",
    sessionsUnsupported:
      "El backend aún no expone /cuenta/sesiones. Esta sección es informativa.",
    sessionsLastActive: (s) => `Última actividad: ${s}`,
    sessionsIp: "IP",
    sessionsCreated: "Iniciada",

    bioTitle: "Datos biométricos",
    bioSub:
      "Usa tu huella o reconocimiento facial para desbloquear la app sin escribir la contraseña.",
    bioAvailable: "Disponible en este dispositivo",
    bioUnavailable: "No disponible en este dispositivo",
    bioNotEnrolled:
      "Configura huella o rostro en los ajustes del sistema primero.",
    bioEnable: "Activar desbloqueo biométrico",
    bioDisable: "Desactivar desbloqueo biométrico",
    bioEnabled: "Desbloqueo biométrico activado",
    bioDisabled: "Desbloqueo biométrico desactivado",
    bioPrompt: "Confirma tu identidad para continuar",
    bioFail: "No se pudo verificar tu identidad",
    bioTypes: {
      fingerprint: "Huella digital",
      facial: "Reconocimiento facial",
      iris: "Iris",
    },
    bioNotSupported: "Este dispositivo no soporta biometría.",
    bioHint:
      "La biometría solo se usa localmente. No enviamos tus datos al servidor.",
    bioModuleMissing:
      "Instala expo-local-authentication y expo-secure-store y compila un development build (npx expo run:android). No funciona en Expo Go.",
    bioSecureStoreErr: "SecureStore no disponible.",

    save: "Guardar",
    cancel: "Cancelar",
    confirm: "Confirmar",
    error: "Error",
    ok: "OK",
    loading: "Cargando…",
    sessionExpired: "Sesión expirada. Vuelve a iniciar sesión.",
    refresh: "Refrescar",
  },
  en: {
    title: "Security & Access",
    subtitle: "Protect your account with password, 2FA and biometrics.",

    pwdTitle: "Change password",
    pwdSub: "Update your password regularly.",
    pwdActual: "Current password",
    pwdNueva: "New password",
    pwdConfirmar: "Confirm new password",
    pwdSave: "Update password",
    pwdOk: "Password updated successfully",
    pwdErr: "Could not update password",
    pwdMismatch: "Passwords do not match",
    pwdShort: "Password must be at least 8 characters",
    pwdSame: "New password must differ from current",
    pwdRequired: "Fill in all fields",
    pwdWeak: "Weak password",
    pwdMedium: "Acceptable password",
    pwdStrong: "Strong password",
    pwdVeryStrong: "Very strong password",

    reqTitle: "Password must contain:",
    reqLen: "At least 8 characters",
    reqUpper: "One uppercase letter (A-Z)",
    reqLower: "One lowercase letter (a-z)",
    reqNum: "One number (0-9)",
    reqSym: "One symbol (!@#$...)",
    reqDiff: "Different from current",

    tfaTitle: "Two-factor authentication (2FA)",
    tfaSub: "Add an extra layer of security with your authenticator app.",
    tfaActive: "Active",
    tfaInactive: "Inactive",
    tfaEnable: "Enable 2FA",
    tfaDisable: "Disable 2FA",
    tfaRegenerate: "Regenerate codes",
    tfaStep1:
      "Step 1: Download Google Authenticator, Authy or Microsoft Authenticator.",
    tfaStep2: "Step 2: Scan this QR code with the app.",
    tfaStep3: "Step 3: Enter the 6-digit code shown by the app.",
    tfaManual: "Or enter this code manually:",
    tfaCode: "Verification code",
    tfaActivate: "Enable 2FA",
    tfaCancel: "Cancel",
    tfaConfirm: "Confirm",
    tfaCodeInvalid: "Enter a 6-digit code",
    tfaCodeWrong: "Incorrect code",
    tfaDisabled: "2FA disabled",
    tfaBackupTitle: "Save your backup codes",
    tfaBackupSub:
      "These codes will let you access your account if you lose your phone. They will not be shown again.",
    tfaBackupDone: "I saved them",
    tfaPasswordPrompt: "Confirm your current password",
    tfaPasswordRequired: "Enter your password",
    tfaDisableWarn:
      "Disabling 2FA will make your account less secure. Are you sure?",
    tfaRemaining: (n) => `${n} backup codes remaining`,
    tfaNoQr: "Server did not return the QR. Use the manual code.",
    tfaPyotpMissing: "Server does not have pyotp installed",
    tfaStartErr: "Could not start 2FA",
    tfaBackendMissing:
      "Backend does not expose /cuenta/2fa/iniciar. Check server.js.",
    tfaDisableErr: "Could not disable 2FA",
    tfaRegenerateErr: "Could not regenerate the codes",
    tfaRegenerateWarn:
      "This will invalidate all previous codes and generate 8 new ones.",

    sessionsTitle: "Active sessions",
    sessionsSub: "Devices where your account is currently open.",
    sessionsEmpty: "No other active sessions.",
    sessionsCurrent: "This session",
    sessionsCloseAll: "Close all other sessions",
    sessionsCloseOne: "Sign out",
    sessionsConfirmOne: "Close this session?",
    sessionsConfirmAll:
      "Close all other sessions? You will need to sign in again on those devices.",
    sessionsClosedOne: "Session closed",
    sessionsClosedAll: "Sessions closed",
    sessionsLoadErr: "Could not load active sessions",
    sessionsUnsupported:
      "Backend does not expose /cuenta/sesiones yet. This section is informative.",
    sessionsLastActive: (s) => `Last active: ${s}`,
    sessionsIp: "IP",
    sessionsCreated: "Started",

    bioTitle: "Biometric data",
    bioSub:
      "Use your fingerprint or face recognition to unlock the app without typing your password.",
    bioAvailable: "Available on this device",
    bioUnavailable: "Not available on this device",
    bioNotEnrolled: "Set up fingerprint or face in system settings first.",
    bioEnable: "Enable biometric unlock",
    bioDisable: "Disable biometric unlock",
    bioEnabled: "Biometric unlock enabled",
    bioDisabled: "Biometric unlock disabled",
    bioPrompt: "Confirm your identity to continue",
    bioFail: "Could not verify your identity",
    bioTypes: {
      fingerprint: "Fingerprint",
      facial: "Face recognition",
      iris: "Iris",
    },
    bioNotSupported: "This device does not support biometrics.",
    bioHint:
      "Biometrics are used locally only. We never send your data to the server.",
    bioModuleMissing:
      "Install expo-local-authentication and expo-secure-store and build a development build (npx expo run:android). It does not work in Expo Go.",
    bioSecureStoreErr: "SecureStore not available.",

    save: "Save",
    cancel: "Cancel",
    confirm: "Confirm",
    error: "Error",
    ok: "OK",
    loading: "Loading…",
    sessionExpired: "Session expired. Please log in again.",
    refresh: "Refresh",
  },
};

const getLang = (language) => {
  const l = String(language || "es").toLowerCase();
  return l.startsWith("en") ? "en" : "es";
};

const evaluarPassword = (pwd, actual = "") => {
  const checks = {
    len: pwd.length >= 8,
    upper: /[A-Z]/.test(pwd),
    lower: /[a-z]/.test(pwd),
    num: /\d/.test(pwd),
    sym: /[^A-Za-z0-9]/.test(pwd),
    diff: pwd.length > 0 && pwd !== actual,
  };
  const passed = Object.values(checks).filter(Boolean).length;
  if (!pwd) return { level: 0, passed, checks };
  if (passed <= 2) return { level: 1, passed, checks };
  if (passed <= 4) return { level: 2, passed, checks };
  if (passed === 5) return { level: 3, passed, checks };
  return { level: 4, passed, checks };
};

const formatFecha = (iso) => {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso);
    return d.toLocaleString();
  } catch {
    return String(iso);
  }
};

// ⭐ Toast helpers
const TOAST_COLORS = {
  success: "#059669",
  error: "#DC2626",
  warning: "#D97706",
};
const TOAST_ICONS = {
  success: "checkmark-circle",
  error: "alert-circle",
  warning: "warning",
};

export default function SecurityAndAccessScreen({ navigation }) {
  const prefs = usePreferences() || {};
  const p = useMemo(() => withFallback(prefs.palette), [prefs.palette]);
  const language = prefs.language || "es";
  const t = T[getLang(language)];

  const [pwdActual, setPwdActual] = useState("");
  const [pwdNueva, setPwdNueva] = useState("");
  const [pwdConfirmar, setPwdConfirmar] = useState("");
  const [showPwdActual, setShowPwdActual] = useState(false);
  const [showPwdNueva, setShowPwdNueva] = useState(false);
  const [showPwdConfirmar, setShowPwdConfirmar] = useState(false);
  const [savingPwd, setSavingPwd] = useState(false);

  const [tfaLoading, setTfaLoading] = useState(true);
  const [tfaHabilitado, setTfaHabilitado] = useState(false);
  const [tfaBackupRestantes, setTfaBackupRestantes] = useState(0);
  const [tfaModal, setTfaModal] = useState(null);
  const [tfaSecreto, setTfaSecreto] = useState("");
  const [tfaQrBase64, setTfaQrBase64] = useState("");
  const [tfaCodigo, setTfaCodigo] = useState("");
  const [tfaError, setTfaError] = useState("");
  const [tfaProcesando, setTfaProcesando] = useState(false);
  const [tfaPassword, setTfaPassword] = useState("");
  const [tfaBackupCodigos, setTfaBackupCodigos] = useState([]);

  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionsError, setSessionsError] = useState(null);
  const [sessionsUnsupported, setSessionsUnsupported] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [closingAllSessions, setClosingAllSessions] = useState(false);

  const [bioSupported, setBioSupported] = useState(false);
  const [bioEnrolled, setBioEnrolled] = useState(false);
  const [bioTypes, setBioTypes] = useState([]);
  const [bioEnabled, setBioEnabled] = useState(false);
  const [bioBusy, setBioBusy] = useState(false);

  const [refreshing, setRefreshing] = useState(false);

  // ⭐ Toast state
  const [toast, setToast] = useState(null); // { type: 'success'|'error'|'warning', message }
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTranslateY = useRef(new Animated.Value(-20)).current;
  const toastTimer = useRef(null);

  // ⭐ Confirm modal state
  const [confirmModal, setConfirmModal] = useState(null);
  // { title, message, confirmText, danger, onConfirm }

  const showToast = useCallback((message, type = "success") => {
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
    }, 2800);
  }, [toastOpacity, toastTranslateY]);

  const askConfirm = useCallback((opts) => {
    setConfirmModal(opts);
  }, []);

  // ─────────────── 2FA ───────────────
  const cargarEstado2FA = useCallback(async () => {
    setTfaLoading(true);
    try {
      const data = await fetchEstado2FA();
      setTfaHabilitado(!!data.habilitado);
      setTfaBackupRestantes(Number(data.codigos_respaldo_restantes || 0));
    } catch (e) {
      if (__DEV__) console.warn("[Security] estado 2FA:", e?.message);
      setTfaHabilitado(false);
      setTfaBackupRestantes(0);
    } finally {
      setTfaLoading(false);
    }
  }, []);

  // ─────────────── Sesiones ───────────────
  const cargarSesiones = useCallback(async () => {
    setSessionsLoading(true);
    setSessionsError(null);
    setSessionsUnsupported(false);
    try {
      const lista = await fetchSesiones();
      setSessions(
        lista.map((s) => ({
          id: String(s.id || ""),
          actual: !!s.actual,
          dispositivo: s.dispositivo || "Dispositivo desconocido",
          ip: s.ip || "",
          inicio: s.inicio || "",
          ultimaActividad: s.ultimaActividad || "",
          raw: s.raw || s,
        }))
      );
    } catch (e) {
      if (e?.status === 404) {
        setSessionsUnsupported(true);
        setSessions([]);
      } else {
        setSessionsError(e?.message || t.sessionsLoadErr);
        setSessions([]);
      }
    } finally {
      setSessionsLoading(false);
    }
  }, [t.sessionsLoadErr]);

  // ─────────────── Biometría ───────────────
  const cargarBiometria = useCallback(async () => {
    if (!BIOMETRICS_AVAILABLE) {
      setBioSupported(false);
      setBioEnrolled(false);
      setBioTypes([]);
      setBioEnabled(false);
      return;
    }
    try {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      const enrolled = compatible
        ? await LocalAuthentication.isEnrolledAsync()
        : false;
      setBioSupported(compatible);
      setBioEnrolled(enrolled);

      let types = [];
      if (compatible) {
        try {
          types = await LocalAuthentication.supportedAuthenticationTypesAsync();
        } catch {}
      }
      setBioTypes(Array.isArray(types) ? types : []);

      let enabled = false;
      try {
        const stored = await SecureStore.getItemAsync(BIOMETRIC_KEY_ENABLED);
        enabled = stored === "1";
      } catch {}
      setBioEnabled(enabled);
    } catch (e) {
      if (__DEV__) console.warn("[Security] biometría:", e?.message);
    }
  }, []);

  useEffect(() => {
    cargarEstado2FA();
    cargarSesiones();
    cargarBiometria();
  }, [cargarEstado2FA, cargarSesiones, cargarBiometria]);

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    Promise.all([cargarEstado2FA(), cargarSesiones(), cargarBiometria()]).finally(
      () => setRefreshing(false)
    );
  }, [cargarEstado2FA, cargarSesiones, cargarBiometria]);

  const pwdEval = useMemo(
    () => evaluarPassword(pwdNueva, pwdActual),
    [pwdNueva, pwdActual]
  );

  const pwdLevelLabel = useMemo(() => {
    if (pwdEval.level === 1) return t.pwdWeak;
    if (pwdEval.level === 2) return t.pwdMedium;
    if (pwdEval.level === 3) return t.pwdStrong;
    if (pwdEval.level === 4) return t.pwdVeryStrong;
    return "";
  }, [pwdEval.level, t]);

  const pwdLevelColor = useMemo(() => {
    if (pwdEval.level === 1) return p.danger;
    if (pwdEval.level === 2) return p.warning;
    if (pwdEval.level === 3) return p.success;
    if (pwdEval.level === 4) return "#16A34A";
    return p.subtle;
  }, [pwdEval.level, p]);

  // ─────────────── Cambiar contraseña ───────────────
  const guardarPassword = async () => {
    if (!pwdActual || !pwdNueva || !pwdConfirmar) {
      showToast(t.pwdRequired, "error");
      return;
    }
    if (pwdNueva.length < 8) {
      showToast(t.pwdShort, "error");
      return;
    }
    if (pwdNueva !== pwdConfirmar) {
      showToast(t.pwdMismatch, "error");
      return;
    }
    if (pwdNueva === pwdActual) {
      showToast(t.pwdSame, "error");
      return;
    }
    setSavingPwd(true);
    try {
      await cambiarPassword({
        actual: pwdActual,
        nueva: pwdNueva,
        confirmar: pwdConfirmar,
      });
      setPwdActual("");
      setPwdNueva("");
      setPwdConfirmar("");
      showToast(t.pwdOk, "success");
    } catch (e) {
      if (e?.status === 401) {
        showToast(t.sessionExpired, "error");
      } else {
        showToast(e?.message || t.pwdErr, "error");
      }
    } finally {
      setSavingPwd(false);
    }
  };

  // ─────────────── 2FA: iniciar ───────────────
  const handleIniciar2FA = async () => {
    setTfaProcesando(true);
    setTfaError("");
    setTfaCodigo("");
    setTfaQrBase64("");
    setTfaSecreto("");
    try {
      const data = await iniciar2FA();
      setTfaSecreto(data.secreto || "");
      setTfaQrBase64(data.qr_base64 || "");
      setTfaModal("start");
      if (!data.qr_base64) setTfaError(t.tfaNoQr);
    } catch (e) {
      const msg = String(e?.message || "");
      if (/pyotp/i.test(msg)) {
        showToast(t.tfaPyotpMissing, "error");
      } else if (e?.status === 404) {
        showToast(t.tfaBackendMissing, "error");
      } else {
        showToast(msg || t.tfaStartErr, "error");
      }
    } finally {
      setTfaProcesando(false);
    }
  };

  const handleConfirmar2FA = async () => {
    const codigo = tfaCodigo.trim();
    if (!/^\d{6}$/.test(codigo)) {
      setTfaError(t.tfaCodeInvalid);
      return;
    }
    setTfaProcesando(true);
    setTfaError("");
    try {
      const data = await confirmar2FA(codigo);
      const codes = Array.isArray(data.codigos_respaldo)
        ? data.codigos_respaldo
        : [];
      setTfaBackupCodigos(codes);
      setTfaHabilitado(true);
      setTfaBackupRestantes(codes.length);
      setTfaModal("backup");
    } catch (e) {
      setTfaError(e?.message || t.tfaCodeWrong);
    } finally {
      setTfaProcesando(false);
    }
  };

  const handleDesactivar2FA = async () => {
    if (!tfaPassword.trim()) {
      setTfaError(t.tfaPasswordRequired);
      return;
    }
    setTfaProcesando(true);
    setTfaError("");
    try {
      await desactivar2FA(tfaPassword);
      setTfaHabilitado(false);
      setTfaBackupRestantes(0);
      setTfaPassword("");
      setTfaModal(null);
      showToast(t.tfaDisabled, "success");
    } catch (e) {
      setTfaError(e?.message || t.tfaDisableErr);
    } finally {
      setTfaProcesando(false);
    }
  };

  const handleRegenerar2FA = async () => {
    if (!tfaPassword.trim()) {
      setTfaError(t.tfaPasswordRequired);
      return;
    }
    setTfaProcesando(true);
    setTfaError("");
    try {
      const data = await regenerarCodigos2FA(tfaPassword);
      const codes = Array.isArray(data.codigos_respaldo)
        ? data.codigos_respaldo
        : [];
      setTfaBackupCodigos(codes);
      setTfaBackupRestantes(codes.length);
      setTfaPassword("");
      setTfaModal("backup");
    } catch (e) {
      setTfaError(e?.message || t.tfaRegenerateErr);
    } finally {
      setTfaProcesando(false);
    }
  };

  // ─────────────── Sesiones: cerrar una ───────────────
  const handleCerrarSesion = (s) => {
    if (s.actual) return;
    askConfirm({
      title: t.sessionsTitle,
      message: t.sessionsConfirmOne,
      confirmText: t.sessionsCloseOne,
      danger: true,
      icon: "log-out-outline",
      onConfirm: async () => {
        try {
          await cerrarSesionApi(s.id);
          setSessions((prev) => prev.filter((x) => x.id !== s.id));
          showToast(t.sessionsClosedOne, "success");
        } catch (e) {
          showToast(e?.message || t.sessionsLoadErr, "error");
        }
      },
    });
  };

  // ─────────────── Sesiones: cerrar todas ───────────────
  const handleCerrarTodasSesiones = () => {
    const otras = sessions.filter((s) => !s.actual);
    if (otras.length === 0) return;
    askConfirm({
      title: t.sessionsTitle,
      message: t.sessionsConfirmAll,
      confirmText: t.sessionsCloseAll,
      danger: true,
      icon: "power",
      onConfirm: async () => {
        setClosingAllSessions(true);
        try {
          await cerrarTodasSesionesApi();
          setSessions((prev) => prev.filter((s) => s.actual));
          showToast(t.sessionsClosedAll, "success");
        } catch (e) {
          let ok = 0;
          for (const s of otras) {
            try {
              await cerrarSesionApi(s.id);
              ok++;
            } catch {}
          }
          if (ok > 0) {
            setSessions((prev) => prev.filter((s) => s.actual));
            showToast(t.sessionsClosedAll, "success");
          } else {
            showToast(e?.message || t.sessionsLoadErr, "error");
          }
        } finally {
          setClosingAllSessions(false);
        }
      },
    });
  };

  // ─────────────── Biometría ───────────────
  const autenticarBiometria = async () => {
    if (!BIOMETRICS_AVAILABLE) return false;
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: t.bioPrompt,
        cancelLabel: t.cancel,
        disableDeviceFallback: false,
      });
      return !!result.success;
    } catch (e) {
      if (__DEV__) console.warn("[biometría] error:", e?.message);
      return false;
    }
  };

  const toggleBiometria = async (next) => {
    if (bioBusy) return;

    if (!BIOMETRICS_AVAILABLE) {
      showToast(t.bioModuleMissing, "warning");
      return;
    }

    setBioBusy(true);
    try {
      if (next) {
        if (!bioSupported) {
          showToast(t.bioNotSupported, "warning");
          return;
        }
        if (!bioEnrolled) {
          showToast(t.bioNotEnrolled, "warning");
          return;
        }
        const ok = await autenticarBiometria();
        if (!ok) {
          showToast(t.bioFail, "error");
          return;
        }
        const { token } = await loadSession();
        if (!token) {
          showToast(t.sessionExpired, "error");
          return;
        }
        try {
          await SecureStore.setItemAsync(BIOMETRIC_KEY_ENABLED, "1");
          await SecureStore.setItemAsync(BIOMETRIC_KEY_TOKEN, token);
        } catch {
          showToast(t.bioSecureStoreErr, "error");
          return;
        }
        setBioEnabled(true);
        showToast(t.bioEnabled, "success");
      } else {
        try {
          await SecureStore.deleteItemAsync(BIOMETRIC_KEY_TOKEN);
          await SecureStore.setItemAsync(BIOMETRIC_KEY_ENABLED, "0");
        } catch {}
        setBioEnabled(false);
        showToast(t.bioDisabled, "success");
      }
    } finally {
      setBioBusy(false);
    }
  };

  const s = useMemo(() => makeStyles(p), [p]);

  const bioTypesLabel = useMemo(() => {
    if (!bioTypes?.length || !BIOMETRICS_AVAILABLE) return "";
    return bioTypes
      .map((tp) => {
        if (tp === LocalAuthentication.AuthenticationType.FINGERPRINT)
          return t.bioTypes.fingerprint;
        if (tp === LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)
          return t.bioTypes.facial;
        if (tp === LocalAuthentication.AuthenticationType.IRIS)
          return t.bioTypes.iris;
        return "";
      })
      .filter(Boolean)
      .join(" · ");
  }, [bioTypes, t]);

  const reqsList = [
    { key: "len", label: t.reqLen },
    { key: "upper", label: t.reqUpper },
    { key: "lower", label: t.reqLower },
    { key: "num", label: t.reqNum },
    { key: "sym", label: t.reqSym },
    { key: "diff", label: t.reqDiff },
  ];

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={s.headerBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityLabel={t.cancel}
        >
          <Ionicons name="arrow-back" size={20} color={p.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle} numberOfLines={1}>
          {t.title}
        </Text>
        <View style={s.headerBtn} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={p.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <Text style={s.subtitle}>{t.subtitle}</Text>

        {/* ═══════════ CONTRASEÑA ═══════════ */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <View style={[s.cardIcon, { backgroundColor: `${p.primary}22` }]}>
              <Ionicons name="key" size={18} color={p.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.cardTitle}>{t.pwdTitle}</Text>
              <Text style={s.cardSub}>{t.pwdSub}</Text>
            </View>
          </View>

          <PasswordField
            label={t.pwdActual}
            value={pwdActual}
            onChangeText={setPwdActual}
            show={showPwdActual}
            onToggle={() => setShowPwdActual((v) => !v)}
            p={p}
            s={s}
          />
          <PasswordField
            label={t.pwdNueva}
            value={pwdNueva}
            onChangeText={setPwdNueva}
            show={showPwdNueva}
            onToggle={() => setShowPwdNueva((v) => !v)}
            p={p}
            s={s}
          />

          {pwdNueva.length > 0 && (
            <View style={s.reqsWrap}>
              <Text style={[s.reqsTitle, { color: p.subtle }]}>
                {t.reqTitle}
              </Text>
              {reqsList.map((r) => {
                const ok = pwdEval.checks[r.key];
                return (
                  <View key={r.key} style={s.reqItem}>
                    <Ionicons
                      name={ok ? "checkmark-circle" : "close-circle"}
                      size={14}
                      color={ok ? p.success : `${p.subtle}AA`}
                    />
                    <Text
                      style={[s.reqText, { color: ok ? p.success : p.subtle }]}
                    >
                      {r.label}
                    </Text>
                  </View>
                );
              })}

              <View style={s.pwdBars}>
                {[1, 2, 3, 4].map((i) => (
                  <View
                    key={i}
                    style={[
                      s.pwdBar,
                      {
                        backgroundColor:
                          pwdEval.level >= i ? pwdLevelColor : `${p.subtle}33`,
                      },
                    ]}
                  />
                ))}
              </View>
              <Text style={[s.pwdStrengthText, { color: pwdLevelColor }]}>
                {pwdLevelLabel}
              </Text>
            </View>
          )}

          <PasswordField
            label={t.pwdConfirmar}
            value={pwdConfirmar}
            onChangeText={setPwdConfirmar}
            show={showPwdConfirmar}
            onToggle={() => setShowPwdConfirmar((v) => !v)}
            p={p}
            s={s}
          />

          {pwdConfirmar.length > 0 && pwdNueva.length > 0 && (
            <Text
              style={{
                fontSize: 12,
                lineHeight: 16,
                marginTop: 6,
                fontWeight: "700",
                color: pwdNueva === pwdConfirmar ? p.success : p.danger,
              }}
            >
              {pwdNueva === pwdConfirmar ? "✓" : "✗ " + t.pwdMismatch}
            </Text>
          )}

          <TouchableOpacity
            style={[
              s.primaryBtn,
              {
                backgroundColor: p.primary,
                opacity: savingPwd ? 0.7 : 1,
              },
            ]}
            onPress={guardarPassword}
            disabled={savingPwd}
            activeOpacity={0.85}
          >
            {savingPwd ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <>
                <Ionicons name="lock-closed" size={16} color="#FFF" />
                <Text style={s.primaryBtnText}>{t.pwdSave}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* ═══════════ 2FA ═══════════ */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <View style={[s.cardIcon, { backgroundColor: "#10B98122" }]}>
              <Ionicons name="shield-checkmark" size={18} color="#10B981" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.cardTitle}>{t.tfaTitle}</Text>
              <Text style={s.cardSub}>{t.tfaSub}</Text>
            </View>
            {tfaLoading ? (
              <ActivityIndicator color={p.primary} />
            ) : (
              <View
                style={[
                  s.badge,
                  {
                    backgroundColor: tfaHabilitado
                      ? "#22C55E22"
                      : `${p.subtle}22`,
                    borderColor: tfaHabilitado ? "#22C55E55" : `${p.subtle}33`,
                  },
                ]}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: "800",
                    lineHeight: 14,
                    color: tfaHabilitado ? "#22C55E" : p.subtle,
                  }}
                >
                  {tfaHabilitado ? t.tfaActive : t.tfaInactive}
                </Text>
              </View>
            )}
          </View>

          {tfaHabilitado && (
            <Text style={[s.cardSub, { marginTop: 10 }]}>
              {t.tfaRemaining(tfaBackupRestantes)}
            </Text>
          )}

          <View style={s.btnRow}>
            {!tfaHabilitado ? (
              <TouchableOpacity
                style={[
                  s.primaryBtn,
                  {
                    backgroundColor: "#10B981",
                    flex: 1,
                    opacity: tfaProcesando ? 0.7 : 1,
                  },
                ]}
                onPress={handleIniciar2FA}
                disabled={tfaProcesando}
                activeOpacity={0.85}
              >
                {tfaProcesando ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <>
                    <Ionicons
                      name="shield-checkmark-outline"
                      size={16}
                      color="#FFF"
                    />
                    <Text style={s.primaryBtnText}>{t.tfaEnable}</Text>
                  </>
                )}
              </TouchableOpacity>
            ) : (
              <>
                <TouchableOpacity
                  style={[
                    s.secondaryBtn,
                    { borderColor: `${p.primary}55`, flex: 1 },
                  ]}
                  onPress={() => {
                    setTfaPassword("");
                    setTfaError("");
                    setTfaModal("regenerate");
                  }}
                  activeOpacity={0.85}
                >
                  <Ionicons name="refresh" size={16} color={p.primary} />
                  <Text style={[s.secondaryBtnText, { color: p.primary }]}>
                    {t.tfaRegenerate}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    s.secondaryBtn,
                    { borderColor: `${p.danger}55`, flex: 1 },
                  ]}
                  onPress={() => {
                    setTfaPassword("");
                    setTfaError("");
                    setTfaModal("disable");
                  }}
                  activeOpacity={0.85}
                >
                  <Ionicons name="shield-outline" size={16} color={p.danger} />
                  <Text style={[s.secondaryBtnText, { color: p.danger }]}>
                    {t.tfaDisable}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>

        {/* ═══════════ SESIONES ═══════════ */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <View style={[s.cardIcon, { backgroundColor: "#0EA5E922" }]}>
              <Ionicons name="phone-portrait" size={18} color="#0EA5E9" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.cardTitle}>{t.sessionsTitle}</Text>
              <Text style={s.cardSub}>{t.sessionsSub}</Text>
            </View>
            <TouchableOpacity
              onPress={cargarSesiones}
              style={s.headerBtnSmall}
              activeOpacity={0.7}
              accessibilityLabel={t.refresh}
            >
              <Ionicons name="refresh" size={18} color={p.subtle} />
            </TouchableOpacity>
          </View>

          {sessionsLoading ? (
            <View style={s.center}>
              <ActivityIndicator color={p.primary} />
              <Text style={[s.cardSub, { marginTop: 10 }]}>{t.loading}</Text>
            </View>
          ) : sessionsUnsupported ? (
            <Text style={[s.cardSub, { color: p.warning, marginTop: 10 }]}>
              {t.sessionsUnsupported}
            </Text>
          ) : sessionsError ? (
            <Text style={[s.cardSub, { color: p.danger, marginTop: 10 }]}>
              {sessionsError}
            </Text>
          ) : sessions.length === 0 ? (
            <Text style={[s.cardSub, { marginTop: 10 }]}>{t.sessionsEmpty}</Text>
          ) : (
            <View style={{ marginTop: 10 }}>
              {sessions.map((ss) => (
                <View
                  key={ss.id}
                  style={[s.sessionRow, { borderColor: `${p.subtle}22` }]}
                >
                  <View
                    style={[
                      s.sessionDot,
                      {
                        backgroundColor: ss.actual ? "#22C55E" : `${p.subtle}77`,
                      },
                    ]}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={[s.sessionTitle, { color: p.text }]}>
                      {ss.dispositivo}
                      {ss.actual ? ` · ${t.sessionsCurrent}` : ""}
                    </Text>
                    {!!ss.ip && (
                      <Text style={[s.sessionMeta, { color: p.subtle }]}>
                        {t.sessionsIp}: {ss.ip}
                      </Text>
                    )}
                    {!!ss.inicio && (
                      <Text style={[s.sessionMeta, { color: p.subtle }]}>
                        {t.sessionsCreated}: {formatFecha(ss.inicio)}
                      </Text>
                    )}
                    {!!ss.ultimaActividad && (
                      <Text style={[s.sessionMeta, { color: p.subtle }]}>
                        {t.sessionsLastActive(formatFecha(ss.ultimaActividad))}
                      </Text>
                    )}
                  </View>
                  {!ss.actual && (
                    <TouchableOpacity
                      onPress={() => handleCerrarSesion(ss)}
                      style={[s.sessionBtn, { borderColor: `${p.danger}55` }]}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name="log-out-outline"
                        size={14}
                        color={p.danger}
                      />
                    </TouchableOpacity>
                  )}
                </View>
              ))}

              {sessions.filter((x) => !x.actual).length > 0 && (
                <TouchableOpacity
                  style={[
                    s.secondaryBtn,
                    {
                      borderColor: `${p.danger}55`,
                      marginTop: 12,
                      justifyContent: "center",
                    },
                  ]}
                  onPress={handleCerrarTodasSesiones}
                  disabled={closingAllSessions}
                  activeOpacity={0.85}
                >
                  {closingAllSessions ? (
                    <ActivityIndicator color={p.danger} />
                  ) : (
                    <>
                      <Ionicons name="power" size={16} color={p.danger} />
                      <Text style={[s.secondaryBtnText, { color: p.danger }]}>
                        {t.sessionsCloseAll}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {/* ═══════════ BIOMETRÍA ═══════════ */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <View style={[s.cardIcon, { backgroundColor: "#8B5CF622" }]}>
              <Ionicons name="finger-print" size={18} color="#8B5CF6" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.cardTitle}>{t.bioTitle}</Text>
              <Text style={s.cardSub}>{t.bioSub}</Text>
            </View>
          </View>

          <View
            style={[
              s.bioStatus,
              {
                backgroundColor: bioSupported ? "#22C55E18" : `${p.subtle}18`,
                borderColor: bioSupported ? "#22C55E55" : `${p.subtle}33`,
              },
            ]}
          >
            <Ionicons
              name={bioSupported ? "checkmark-circle" : "close-circle"}
              size={16}
              color={bioSupported ? "#22C55E" : p.subtle}
            />
            <Text
              style={{
                color: p.text,
                fontSize: 12,
                fontWeight: "700",
                lineHeight: 16,
              }}
            >
              {bioSupported ? t.bioAvailable : t.bioUnavailable}
            </Text>
          </View>

          {!BIOMETRICS_AVAILABLE && (
            <Text style={[s.cardSub, { color: p.warning, marginTop: 10 }]}>
              {t.bioModuleMissing}
            </Text>
          )}

          {BIOMETRICS_AVAILABLE && bioSupported && !bioEnrolled && (
            <Text style={[s.cardSub, { color: p.warning, marginTop: 10 }]}>
              {t.bioNotEnrolled}
            </Text>
          )}

          {bioTypesLabel && (
            <Text style={[s.cardSub, { marginTop: 6 }]}>{bioTypesLabel}</Text>
          )}

          <View style={[s.rowBetween, { marginTop: 14 }]}>
            <Text style={s.rowLabel}>
              {bioEnabled ? t.bioDisable : t.bioEnable}
            </Text>
            <Switch
              value={bioEnabled}
              onValueChange={toggleBiometria}
              disabled={!bioSupported || !bioEnrolled || bioBusy}
              trackColor={{ false: `${p.subtle}55`, true: `${p.primary}88` }}
              thumbColor={bioEnabled ? p.primary : "#FFF"}
              ios_backgroundColor={`${p.subtle}55`}
            />
          </View>

          <Text style={[s.cardSub, { marginTop: 10, fontSize: 11 }]}>
            {t.bioHint}
          </Text>
        </View>
      </ScrollView>

      {/* ═══════════ TOAST ═══════════ */}
      {toast ? (
        <Animated.View
          pointerEvents="none"
          style={[
            s.toast,
            {
              backgroundColor: TOAST_COLORS[toast.type] || TOAST_COLORS.success,
              opacity: toastOpacity,
              transform: [{ translateY: toastTranslateY }],
            },
          ]}
        >
          <Ionicons
            name={TOAST_ICONS[toast.type] || "checkmark-circle"}
            size={18}
            color="#FFF"
          />
          <Text style={s.toastText} numberOfLines={3}>
            {toast.message}
          </Text>
        </Animated.View>
      ) : null}

      {/* ═══════════ CONFIRM MODAL ═══════════ */}
      <Modal
        visible={!!confirmModal}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmModal(null)}
      >
        <Pressable
          style={s.modalBackdrop}
          onPress={() => setConfirmModal(null)}
        >
          <Pressable style={s.modalCard} onPress={(e) => e.stopPropagation()}>
            <View
              style={[
                s.confirmIconWrap,
                {
                  backgroundColor: confirmModal?.danger
                    ? `${p.danger}22`
                    : `${p.primary}22`,
                },
              ]}
            >
              <Ionicons
                name={confirmModal?.icon || "help-circle"}
                size={30}
                color={confirmModal?.danger ? p.danger : p.primary}
              />
            </View>
            <Text style={s.modalTitle}>{confirmModal?.title}</Text>
            <Text style={s.confirmMessage}>{confirmModal?.message}</Text>
            <View style={s.modalBtnRow}>
              <TouchableOpacity
                style={[
                  s.secondaryBtn,
                  { borderColor: `${p.subtle}55`, flex: 1 },
                ]}
                onPress={() => setConfirmModal(null)}
                activeOpacity={0.85}
              >
                <Text style={[s.secondaryBtnText, { color: p.subtle }]}>
                  {t.cancel}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  s.primaryBtn,
                  {
                    backgroundColor: confirmModal?.danger
                      ? p.danger
                      : p.primary,
                    flex: 1,
                    marginTop: 0,
                  },
                ]}
                onPress={() => {
                  const fn = confirmModal?.onConfirm;
                  setConfirmModal(null);
                  if (fn) setTimeout(fn, 150);
                }}
                activeOpacity={0.85}
              >
                <Text style={s.primaryBtnText}>
                  {confirmModal?.confirmText || t.confirm}
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ═══════════ MODAL 2FA: INICIAR ═══════════ */}
      <Modal
        visible={tfaModal === "start"}
        transparent
        animationType="fade"
        onRequestClose={() => setTfaModal(null)}
      >
        <Pressable style={s.modalBackdrop} onPress={() => setTfaModal(null)}>
          <Pressable style={s.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={s.modalTitle}>{t.tfaTitle}</Text>
            <Text style={[s.cardSub, { marginTop: 10 }]}>{t.tfaStep1}</Text>
            <Text style={[s.cardSub, { marginTop: 6 }]}>{t.tfaStep2}</Text>

            {tfaQrBase64 ? (
              <View style={s.qrWrap}>
                <Image
                  source={{ uri: `data:image/png;base64,${tfaQrBase64}` }}
                  style={s.qrImg}
                  resizeMode="contain"
                />
              </View>
            ) : (
              <Text style={[s.cardSub, { color: p.warning, marginTop: 10 }]}>
                {t.tfaNoQr}
              </Text>
            )}

            <Text style={[s.cardSub, { marginTop: 10, fontWeight: "700" }]}>
              {t.tfaManual}
            </Text>
            <View
              style={[
                s.codeBox,
                {
                  borderColor: `${p.primary}55`,
                  backgroundColor: `${p.primary}11`,
                },
              ]}
            >
              <Text
                selectable
                style={{
                  color: p.text,
                  fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
                  fontSize: 13,
                  lineHeight: 18,
                }}
              >
                {tfaSecreto || "—"}
              </Text>
            </View>

            <Text style={[s.cardSub, { marginTop: 14 }]}>{t.tfaStep3}</Text>
            <TextInput
              value={tfaCodigo}
              onChangeText={(v) =>
                setTfaCodigo(v.replace(/\D/g, "").slice(0, 6))
              }
              keyboardType="number-pad"
              placeholder="000000"
              placeholderTextColor={`${p.subtle}88`}
              maxLength={6}
              style={[
                s.input,
                {
                  color: p.text,
                  borderColor: p.border,
                  textAlign: "center",
                  letterSpacing: 8,
                  fontSize: 20,
                  minHeight: 52,
                },
              ]}
            />

            {!!tfaError && (
              <Text style={[s.errorText, { color: p.danger }]}>
                {tfaError}
              </Text>
            )}

            <View style={s.modalBtnRow}>
              <TouchableOpacity
                style={[
                  s.secondaryBtn,
                  { borderColor: `${p.subtle}55`, flex: 1 },
                ]}
                onPress={() => setTfaModal(null)}
                activeOpacity={0.85}
              >
                <Text style={[s.secondaryBtnText, { color: p.subtle }]}>
                  {t.tfaCancel}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  s.primaryBtn,
                  {
                    backgroundColor: "#10B981",
                    flex: 1,
                    marginTop: 0,
                    opacity: tfaProcesando ? 0.7 : 1,
                  },
                ]}
                onPress={handleConfirmar2FA}
                disabled={tfaProcesando}
                activeOpacity={0.85}
              >
                {tfaProcesando ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={s.primaryBtnText}>{t.tfaActivate}</Text>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ═══════════ MODAL 2FA: BACKUP ═══════════ */}
      <Modal
        visible={tfaModal === "backup"}
        transparent
        animationType="fade"
        onRequestClose={() => setTfaModal(null)}
      >
        <Pressable style={s.modalBackdrop} onPress={() => {}}>
          <Pressable style={s.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={[s.modalTitle, { color: p.warning }]}>
              ⚠️ {t.tfaBackupTitle}
            </Text>
            <Text style={[s.cardSub, { marginTop: 10 }]}>
              {t.tfaBackupSub}
            </Text>

            <View style={s.backupGrid}>
              {tfaBackupCodigos.map((c, i) => (
                <View
                  key={`${c}-${i}`}
                  style={[
                    s.backupCode,
                    {
                      backgroundColor: `${p.warning}18`,
                      borderColor: `${p.warning}55`,
                    },
                  ]}
                >
                  <Text
                    style={{ color: p.text, fontWeight: "800", fontSize: 13 }}
                  >
                    {c}
                  </Text>
                </View>
              ))}
            </View>

            <TouchableOpacity
              style={[
                s.primaryBtn,
                { backgroundColor: p.primary, marginTop: 16 },
              ]}
              onPress={() => {
                setTfaModal(null);
                setTfaBackupCodigos([]);
              }}
              activeOpacity={0.85}
            >
              <Ionicons name="checkmark-circle" size={16} color="#FFF" />
              <Text style={s.primaryBtnText}>{t.tfaBackupDone}</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ═══════════ MODAL 2FA: DESACTIVAR ═══════════ */}
      <Modal
        visible={tfaModal === "disable"}
        transparent
        animationType="fade"
        onRequestClose={() => setTfaModal(null)}
      >
        <Pressable style={s.modalBackdrop} onPress={() => setTfaModal(null)}>
          <Pressable style={s.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={[s.modalTitle, { color: p.danger }]}>
              {t.tfaDisable}
            </Text>
            <Text style={[s.cardSub, { marginTop: 10 }]}>
              {t.tfaDisableWarn}
            </Text>

            <Text style={[s.cardSub, { marginTop: 14, fontWeight: "700" }]}>
              {t.tfaPasswordPrompt}
            </Text>
            <TextInput
              value={tfaPassword}
              onChangeText={setTfaPassword}
              secureTextEntry
              placeholder="••••••••"
              placeholderTextColor={`${p.subtle}88`}
              style={[s.input, { color: p.text, borderColor: p.border }]}
            />

            {!!tfaError && (
              <Text style={[s.errorText, { color: p.danger }]}>
                {tfaError}
              </Text>
            )}

            <View style={s.modalBtnRow}>
              <TouchableOpacity
                style={[
                  s.secondaryBtn,
                  { borderColor: `${p.subtle}55`, flex: 1 },
                ]}
                onPress={() => setTfaModal(null)}
                activeOpacity={0.85}
              >
                <Text style={[s.secondaryBtnText, { color: p.subtle }]}>
                  {t.tfaCancel}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  s.primaryBtn,
                  {
                    backgroundColor: p.danger,
                    flex: 1,
                    marginTop: 0,
                    opacity: tfaProcesando ? 0.7 : 1,
                  },
                ]}
                onPress={handleDesactivar2FA}
                disabled={tfaProcesando}
                activeOpacity={0.85}
              >
                {tfaProcesando ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={s.primaryBtnText}>{t.tfaDisable}</Text>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ═══════════ MODAL 2FA: REGENERAR ═══════════ */}
      <Modal
        visible={tfaModal === "regenerate"}
        transparent
        animationType="fade"
        onRequestClose={() => setTfaModal(null)}
      >
        <Pressable style={s.modalBackdrop} onPress={() => setTfaModal(null)}>
          <Pressable style={s.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={s.modalTitle}>{t.tfaRegenerate}</Text>
            <Text style={[s.cardSub, { marginTop: 10 }]}>
              {t.tfaRegenerateWarn}
            </Text>

            <Text style={[s.cardSub, { marginTop: 14, fontWeight: "700" }]}>
              {t.tfaPasswordPrompt}
            </Text>
            <TextInput
              value={tfaPassword}
              onChangeText={setTfaPassword}
              secureTextEntry
              placeholder="••••••••"
              placeholderTextColor={`${p.subtle}88`}
              style={[s.input, { color: p.text, borderColor: p.border }]}
            />

            {!!tfaError && (
              <Text style={[s.errorText, { color: p.danger }]}>
                {tfaError}
              </Text>
            )}

            <View style={s.modalBtnRow}>
              <TouchableOpacity
                style={[
                  s.secondaryBtn,
                  { borderColor: `${p.subtle}55`, flex: 1 },
                ]}
                onPress={() => setTfaModal(null)}
                activeOpacity={0.85}
              >
                <Text style={[s.secondaryBtnText, { color: p.subtle }]}>
                  {t.tfaCancel}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  s.primaryBtn,
                  {
                    backgroundColor: p.primary,
                    flex: 1,
                    marginTop: 0,
                    opacity: tfaProcesando ? 0.7 : 1,
                  },
                ]}
                onPress={handleRegenerar2FA}
                disabled={tfaProcesando}
                activeOpacity={0.85}
              >
                {tfaProcesando ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={s.primaryBtnText}>{t.tfaConfirm}</Text>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function PasswordField({ label, value, onChangeText, show, onToggle, p, s }) {
  return (
    <View style={{ marginTop: 14 }}>
      <Text
        style={{
          fontSize: 12,
          fontWeight: "700",
          color: p.subtle,
          marginBottom: 8,
        }}
      >
        {label}
      </Text>
      <View style={s.inputWrap}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={!show}
          placeholder="••••••••"
          placeholderTextColor={`${p.subtle}88`}
          style={[
            s.input,
            { color: p.text, borderColor: p.border, flex: 1, marginBottom: 0 },
          ]}
          autoCapitalize="none"
        />
        <TouchableOpacity onPress={onToggle} style={s.eyeBtn}>
          <Ionicons
            name={show ? "eye-off" : "eye"}
            size={18}
            color={p.subtle}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const makeStyles = (p) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: p.background },

    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: p.border,
    },
    headerBtn: {
      width: 38,
      height: 38,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: p.border,
      backgroundColor: p.surface,
      justifyContent: "center",
      alignItems: "center",
    },
    headerBtnSmall: {
      width: 34,
      height: 34,
      borderRadius: 10,
      justifyContent: "center",
      alignItems: "center",
    },
    headerTitle: {
      flex: 1,
      textAlign: "center",
      fontSize: 17,
      fontWeight: "800",
      color: p.text,
      letterSpacing: -0.3,
      lineHeight: 22,
    },

    subtitle: {
      color: p.subtle,
      fontSize: 13,
      lineHeight: 20,
      marginBottom: 16,
    },

    card: {
      backgroundColor: p.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: p.border,
      padding: 16,
      marginBottom: 16,
    },
    cardHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginBottom: 4,
    },
    cardIcon: {
      width: 36,
      height: 36,
      borderRadius: 10,
      justifyContent: "center",
      alignItems: "center",
    },
    cardTitle: {
      fontSize: 15,
      fontWeight: "800",
      color: p.text,
      lineHeight: 20,
      letterSpacing: -0.2,
    },
    cardSub: {
      fontSize: 12,
      color: p.subtle,
      lineHeight: 17,
      marginTop: 3,
    },

    badge: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
      borderWidth: 1,
    },

    inputWrap: {
      position: "relative",
      flexDirection: "row",
      alignItems: "center",
    },
    input: {
      borderWidth: 1,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 12,
      marginBottom: 10,
      fontSize: 14,
      minHeight: 46,
    },
    eyeBtn: { position: "absolute", right: 10, top: 13 },

    reqsWrap: {
      marginTop: 4,
      marginBottom: 10,
      padding: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: `${p.subtle}33`,
      backgroundColor: `${p.subtle}0D`,
    },
    reqsTitle: {
      fontSize: 11,
      fontWeight: "800",
      marginBottom: 8,
      textTransform: "uppercase",
      letterSpacing: 0.4,
    },
    reqItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingVertical: 2,
    },
    reqText: {
      fontSize: 12,
      lineHeight: 16,
      fontWeight: "600",
    },

    pwdStrengthWrap: { marginTop: 8, marginBottom: 4 },
    pwdBars: { flexDirection: "row", gap: 4, marginTop: 8 },
    pwdBar: { flex: 1, height: 4, borderRadius: 2 },
    pwdStrengthText: {
      fontSize: 11,
      fontWeight: "700",
      marginTop: 6,
      lineHeight: 14,
    },

    primaryBtn: {
      borderRadius: 12,
      paddingVertical: 13,
      paddingHorizontal: 16,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 14,
      flexDirection: "row",
      gap: 8,
      minHeight: 48,
      shadowColor: "#000",
      shadowOpacity: 0.15,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 3 },
      elevation: 4,
    },
    primaryBtnText: {
      color: "#FFF",
      fontWeight: "800",
      fontSize: 14,
      lineHeight: 18,
    },

    secondaryBtn: {
      borderWidth: 1,
      borderRadius: 12,
      paddingVertical: 12,
      paddingHorizontal: 12,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 6,
      minHeight: 46,
    },
    secondaryBtnText: { fontSize: 13, fontWeight: "800", lineHeight: 17 },

    btnRow: {
      flexDirection: "row",
      gap: 10,
      marginTop: 12,
      flexWrap: "wrap",
    },

    center: { alignItems: "center", paddingVertical: 20 },

    sessionRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 12,
      borderTopWidth: 1,
    },
    sessionDot: { width: 9, height: 9, borderRadius: 5 },
    sessionTitle: { fontSize: 13, fontWeight: "700", lineHeight: 18 },
    sessionMeta: { fontSize: 11, marginTop: 3, lineHeight: 15 },
    sessionBtn: {
      width: 34,
      height: 34,
      borderRadius: 9,
      borderWidth: 1,
      alignItems: "center",
      justifyContent: "center",
    },

    bioStatus: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 10,
      borderWidth: 1,
      marginTop: 14,
    },
    rowBetween: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
    },
    rowLabel: {
      color: p.text,
      fontSize: 14,
      fontWeight: "700",
      lineHeight: 18,
    },

    modalBackdrop: {
      flex: 1,
      backgroundColor: "#000000AA",
      justifyContent: "center",
      alignItems: "center",
      padding: 20,
    },
    modalCard: {
      width: "100%",
      maxWidth: 400,
      backgroundColor: p.surface,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: p.border,
      padding: 20,
      maxHeight: "90%",
    },
    modalTitle: {
      fontSize: 17,
      fontWeight: "800",
      color: p.text,
      textAlign: "center",
      lineHeight: 22,
    },
    modalBtnRow: {
      flexDirection: "row",
      gap: 10,
      marginTop: 16,
    },

    // ⭐ Confirm modal
    confirmIconWrap: {
      width: 64,
      height: 64,
      borderRadius: 20,
      alignSelf: "center",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 14,
    },
    confirmMessage: {
      fontSize: 13,
      color: p.subtle,
      lineHeight: 19,
      textAlign: "center",
      marginTop: 8,
      marginBottom: 4,
    },

    qrWrap: {
      alignItems: "center",
      marginTop: 14,
      backgroundColor: "#FFF",
      padding: 10,
      borderRadius: 12,
      alignSelf: "center",
    },
    qrImg: { width: 200, height: 200 },

    codeBox: {
      borderWidth: 1,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      marginTop: 8,
    },

    errorText: {
      fontSize: 12,
      fontWeight: "700",
      marginTop: 10,
      lineHeight: 16,
    },

    backupGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
      marginTop: 14,
    },
    backupCode: {
      width: "48%",
      paddingVertical: 12,
      borderRadius: 10,
      borderWidth: 1,
      alignItems: "center",
      justifyContent: "center",
      minHeight: 44,
    },

    // ⭐ Toast
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
      lineHeight: 17,
    },
  });