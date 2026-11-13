// screens/ProfileScreen.js
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Image,
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  UIManager,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { usePreferences } from "../context/PreferencesContext";
import { Text } from "../i18n/ui";
import {
  getCurrentUser,
  fetchMe,
  logout,
  isAdmin,
  request,
  loadSession,
} from "../services/api";
import { API_URL } from "../config/api";

const enableLayoutAnimation = () => {
  if (
    Platform.OS === "android" &&
    !global?.nativeFabricUIManager &&
    UIManager?.setLayoutAnimationEnabledExperimental
  ) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }
};
enableLayoutAnimation();

const API_PREFIX = "/api/v1";
const CUENTA_BASE = `${API_PREFIX}/cuenta`;

const FALLBACK_PALETTE = {
  background: "#0F172A",
  surface: "#1E293B",
  text: "#121213",
  subtle: "#020202",
  border: "#334155",
  primary: "#6366F1",
};

const withFallback = (p = {}) => ({ ...FALLBACK_PALETTE, ...(p || {}) });

const T = {
  es: {
    headerTitle: "Mi Cuenta",
    myAccount: "Mi Cuenta",
    adminBadge: "Administrador",
    purchases: "Compras",
    favorites: "Favoritos",
    errorLoad: "No se pudo cargar la información del perfil.",
    logout: "Cerrar Sesión",
    confirmLogout: "¿Estás seguro de que deseas salir de tu cuenta?",
    cancel: "Cancelar",
    yesExit: "Salir",
    confirm: "Confirmar",
    logoutTitle: "Cerrar sesión",

    activityTitle: "Mi Actividad",
    servicesTitle: "Mis Compras y Servicios",
    dataTitle: "Datos Personales y Preferencias",
    settingsSectionTitle: "Configuración",
    supportTitle: "Soporte y Contacto",
    adminTitle: "Administración",

    myOrders: "Mis Pedidos",
    myOrdersSub: "Consultar solicitudes registradas",
    favoritesSub: "Ver tus artículos guardados",
    notifications: "Notificaciones",
    notificationsSub: "Alertas y avisos",

    payments: "Métodos de Pago",
    paymentsSub: "Tarjetas, PayPal y OXXO",
    addresses: "Direcciones",
    addressesSub: "Gestionar direcciones de envío",
    returns: "Devoluciones",
    returnsSub: "Solicita un cambio o reembolso",
    wallet: "Monedero Digital",
    walletSub: "Tu saldo y movimientos",
    walletCard: "Mi Cartera",
    walletCardSub: "Administra tus métodos y saldos",
    billing: "Facturación",
    billingSub: "Datos fiscales y facturas (CFDI)",
    loyalty: "Cliente Consentido",
    loyaltySub: "Niveles, puntos y beneficios exclusivos",

    personalData: "Datos Personales",
    personalDataSub: "Nombre, correo y teléfono",
    interests: "Intereses",
    interestsSub: "Preferencias de producto y estilo",
    privacy: "Privacidad",
    privacySub: "Quién puede ver tu información",
    security: "Seguridad y Contraseña",
    securitySub: "Cambiar contraseña y 2FA",

    settings: "Configuración",
    settingsSub: "Tema e idioma",

    support: "Soporte",
    contact: "Contacto",
    contactSub: "Escríbenos o llámanos",
    chatNova: "Chatear con Nova",
    chatNovaSub: "Asistente IA 24/7",

    admin: "Administración",
    adminPanel: "Panel de Administración",
    adminPanelSub: "Pedidos, productos, cupones y usuarios",
    adminChat: "Chat de Soporte",
    adminChatSub: "Conversaciones de clientes",

    configTitle: "Configuración ORION",
    configChoose: "Selecciona una opción",
    themeOption: "Tema oscuro / claro",
    languageOption: "Español / English",
    appearance: "Apariencia",
    appearanceDesc: "¿Qué tema deseas utilizar?",
    light: "Claro",
    dark: "Oscuro",
    system: "Sistema",
    language: "Idioma",
    languageDesc: "Elige el idioma",
    close: "Cerrar",
    errorLogout: "No se pudo cerrar sesión.",

    permissionTitle: "Permiso requerido",
    permissionGallery: "Necesitamos acceso a tu galería.",
    restrictedTitle: "Acceso restringido",
    restrictedAdmin: "Solo administradores.",
    unavailableTitle: "Pantalla no disponible",
    unavailableBody: (route) =>
      `Aún no existe la pantalla "${route}". Créala en tu navegador para habilitar esta opción.`,

    photoTitle: "Foto de perfil",
    photoDesc: "¿Qué deseas hacer?",
    photoPick: "Elegir de la galería",
    photoPickTitle: "Foto de perfil",
    photoRemove: "Quitar foto",
    photoUpdated: "Foto de perfil actualizada",
    photoLocal: "Foto actualizada solo en este dispositivo (sin endpoint de servidor)",
    photoRemoved: "Foto eliminada",
    photoUploadError: "No se pudo subir la foto",
    photoNotLocal: "Solo se pueden subir fotos desde la galería o cámara.",
    photoInvalid: "Falta el archivo o formato inválido. Intenta con otra foto.",
    sessionExpired: "Sesión expirada. Vuelve a iniciar sesión.",
    serverNoRoute: "El servidor no tiene la ruta de subida. Reinicia el servidor.",
    fileSystemUnavailable: "No se pudo leer la foto del dispositivo.",

    photoViewerTitle: "Foto de perfil",
    photoViewerChange: "Cambiar foto",
    photoViewerClose: "Cerrar",
    photoViewerEmpty: "Aún no tienes foto de perfil",
    photoViewerAdd: "Añadir foto",

    itemsCount: (n) => `${n} ${n === 1 ? "opción" : "opciones"}`,
  },
  en: {
    headerTitle: "My Account",
    myAccount: "My Account",
    adminBadge: "Administrator",
    purchases: "Purchases",
    favorites: "Favorites",
    errorLoad: "Could not load profile info.",
    logout: "Log Out",
    confirmLogout: "Are you sure you want to log out?",
    cancel: "Cancel",
    yesExit: "Log out",
    confirm: "Confirm",
    logoutTitle: "Log out",

    activityTitle: "My Activity",
    servicesTitle: "My Purchases & Services",
    dataTitle: "Personal Data & Preferences",
    settingsSectionTitle: "Settings",
    supportTitle: "Support & Contact",
    adminTitle: "Administration",

    myOrders: "My Orders",
    myOrdersSub: "View your requests",
    favoritesSub: "Your saved items",
    notifications: "Notifications",
    notificationsSub: "Alerts and updates",

    payments: "Payment Methods",
    paymentsSub: "Cards, PayPal and OXXO",
    addresses: "Addresses",
    addressesSub: "Manage shipping addresses",
    returns: "Returns",
    returnsSub: "Request an exchange or refund",
    wallet: "Digital Wallet",
    walletSub: "Your balance and transactions",
    walletCard: "My Wallet",
    walletCardSub: "Manage your payment methods and balances",
    billing: "Billing",
    billingSub: "Tax data and invoices (CFDI)",
    loyalty: "Preferred Customer",
    loyaltySub: "Tiers, points and exclusive benefits",

    personalData: "Personal Data",
    personalDataSub: "Name, email and phone",
    interests: "Interests",
    interestsSub: "Product and style preferences",
    privacy: "Privacy",
    privacySub: "Who can see your information",
    security: "Security & Password",
    securitySub: "Change password and 2FA",

    settings: "Settings",
    settingsSub: "Theme and language",

    support: "Support",
    contact: "Contact",
    contactSub: "Write or call us",
    chatNova: "Chat with Nova",
    chatNovaSub: "AI assistant 24/7",

    admin: "Administration",
    adminPanel: "Admin Panel",
    adminPanelSub: "Orders, products, coupons and users",
    adminChat: "Support Chat",
    adminChatSub: "Customer conversations",

    configTitle: "ORION Settings",
    configChoose: "Choose an option",
    themeOption: "Dark / Light theme",
    languageOption: "Español / English",
    appearance: "Appearance",
    appearanceDesc: "Which theme do you want to use?",
    light: "Light",
    dark: "Dark",
    system: "System",
    language: "Language",
    languageDesc: "Choose the language",
    close: "Close",
    errorLogout: "Could not log out.",

    permissionTitle: "Permission required",
    permissionGallery: "We need access to your gallery.",
    restrictedTitle: "Restricted access",
    restrictedAdmin: "Admins only.",
    unavailableTitle: "Screen unavailable",
    unavailableBody: (route) =>
      `Screen "${route}" does not exist yet. Create it in your navigator to enable this option.`,

    photoTitle: "Profile photo",
    photoDesc: "What do you want to do?",
    photoPick: "Choose from gallery",
    photoPickTitle: "Profile photo",
    photoRemove: "Remove photo",
    photoUpdated: "Profile photo updated",
    photoLocal: "Photo updated on this device only (no server endpoint)",
    photoRemoved: "Photo removed",
    photoUploadError: "Could not upload photo",
    photoNotLocal: "You can only upload photos from the gallery or camera.",
    photoInvalid: "Missing file or invalid format. Try another photo.",
    sessionExpired: "Session expired. Please log in again.",
    serverNoRoute: "Server does not have the upload route. Restart the server.",
    fileSystemUnavailable: "Could not read the photo from the device.",

    photoViewerTitle: "Profile photo",
    photoViewerChange: "Change photo",
    photoViewerClose: "Close",
    photoViewerEmpty: "You don't have a profile photo yet",
    photoViewerAdd: "Add photo",

    itemsCount: (n) => `${n} ${n === 1 ? "option" : "options"}`,
  },
};

const getLang = (language) => {
  const l = String(language || "es").toLowerCase();
  return l.startsWith("en") ? "en" : "es";
};

const check = (active) => (active ? "✓ " : "");

const pickPhotoUri = (u) => {
  if (!u || typeof u !== "object") return null;

  const candidates = [
    u.fotoUrl,
    u.foto_url,
    u.avatarUrl,
    u.avatar_url,
    u.foto,
    u.avatar,
    u.imagen,
    u.photo,
    u.profile_picture,
    u.picture,
  ];

  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
  }

  for (const nested of ["usuario", "data", "perfil", "profile", "user", "cuenta"]) {
    const sub = u[nested];
    if (sub && typeof sub === "object") {
      const found = pickPhotoUri(sub);
      if (found) return found;
    }
  }

  return null;
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

export default function ProfileScreen({ navigation }) {
  const prefs = usePreferences() || {};
  const p = useMemo(() => withFallback(prefs.palette), [prefs.palette]);
  const mode = prefs.mode || "system";
  const language = prefs.language || "es";
  const setMode = prefs.setMode || (() => {});
  const setLanguage = prefs.setLanguage || (() => {});
  const t = T[getLang(language)];

  const [profileImage, setProfileImage] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [unread, setUnread] = useState(false);
  const [prefsModal, setPrefsModal] = useState(null);

  // ⭐ Visor fullscreen de la foto
  const [photoViewer, setPhotoViewer] = useState(false);

  // ⭐ Toast state
  const [toast, setToast] = useState(null);
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTranslateY = useRef(new Animated.Value(-20)).current;
  const toastTimer = useRef(null);

  // ⭐ Confirm modal state
  const [confirmModal, setConfirmModal] = useState(null);

  const [openSection, setOpenSection] = useState("activity");

  const [userData, setUserData] = useState({
    name: "…",
    email: "…",
    fotoUrl: null,
    stats: { compras: 0, favoritos: 0 },
    defaultPayment: "—",
    defaultAddress: "—",
  });

  // ⭐ effectivePhoto declarada ANTES de las funciones que la usan
  const effectivePhoto = !imgError ? profileImage || userData.fotoUrl : null;

  // ─────────── Toast helpers ───────────
  const showToast = useCallback(
    (message, type = "success") => {
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
    },
    [toastOpacity, toastTranslateY]
  );

  const askConfirm = useCallback((opts) => {
    setConfirmModal(opts);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  const openPreferences = useCallback(() => setPrefsModal("main"), []);

  const toggleSection = useCallback((key) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenSection((prev) => (prev === key ? null : key));
  }, []);

  const goBack = useCallback(() => {
    const canGoBack = navigation.canGoBack?.() ?? false;
    if (canGoBack) navigation.goBack();
    else navigation.navigate("Home");
  }, [navigation]);

  const load = useCallback(
    async ({ silent = false } = {}) => {
      if (!silent) setLoading(true);
      try {
        const currentUser = await getCurrentUser();
        if (!currentUser) {
          setLoading(false);
          navigation.replace("Login");
          return;
        }

        let data = currentUser;
        try {
          const me = await fetchMe();
          if (me) data = { ...currentUser, ...me };
        } catch {}

        if (__DEV__) {
          console.log("🟢 [perfil] data:", data);
          console.log("🟢 [perfil] foto detectada:", pickPhotoUri(data));
        }

        setIsAdminUser(isAdmin(data));

        const foto = pickPhotoUri(data);
        if (foto) {
          setProfileImage(foto);
          setImgError(false);
        }

        let compras = 0;
        let favoritos = 0;

        try {
          const ordersRes = await request(`${API_PREFIX}/pedidos`);
          const arr = Array.isArray(ordersRes?.data)
            ? ordersRes.data
            : Array.isArray(ordersRes?.pedidos)
            ? ordersRes.pedidos
            : Array.isArray(ordersRes)
            ? ordersRes
            : [];
          compras = arr.length;
        } catch {}

        try {
          const favsRes = await request(`${CUENTA_BASE}/favoritos`);
          if (Array.isArray(favsRes?.ids)) favoritos = favsRes.ids.length;
          else if (Array.isArray(favsRes?.productos))
            favoritos = favsRes.productos.length;
          else if (Array.isArray(favsRes?.data))
            favoritos = favsRes.data.length;
          else if (Array.isArray(favsRes)) favoritos = favsRes.length;
        } catch {
          favoritos = Array.isArray(data?.favoritos) ? data.favoritos.length : 0;
        }

        try {
          const notifRes = await request(`${CUENTA_BASE}/notificaciones`);
          const arr = Array.isArray(notifRes?.notificaciones)
            ? notifRes.notificaciones
            : Array.isArray(notifRes?.data)
            ? notifRes.data
            : Array.isArray(notifRes)
            ? notifRes
            : [];
          setUnread(arr.some((n) => !(n.leida ?? n.read ?? n.vista ?? false)));
        } catch {}

        let defaultPayment = "—";
        let defaultAddress = "—";

        try {
          const mp = await request(`${CUENTA_BASE}/metodos-pago`);
          const metodos = Array.isArray(mp?.metodos)
            ? mp.metodos
            : Array.isArray(mp?.data)
            ? mp.data
            : [];
          const pred = metodos.find((m) => m.predeterminado) || metodos[0];
          if (pred) {
            if (pred.tipo === "tarjeta")
              defaultPayment = `${pred.marca || "Tarjeta"} •••• ${
                pred.ultimos4 || "----"
              }`;
            else if (pred.tipo === "paypal")
              defaultPayment = `PayPal · ${pred.email || ""}`;
            else if (pred.tipo === "oxxo")
              defaultPayment = `OXXO · ${pred.referencia || ""}`;
          }
        } catch {}

        try {
          const dRes = await request(`${CUENTA_BASE}/direcciones`);
          const arrD = Array.isArray(dRes?.data)
            ? dRes.data
            : Array.isArray(dRes?.direcciones)
            ? dRes.direcciones
            : Array.isArray(dRes)
            ? dRes
            : [];
          const predD = arrD.find((d) => d.predeterminada) || arrD[0];
          if (predD)
            defaultAddress = [predD.calle, predD.numero, predD.colonia]
              .filter(Boolean)
              .join(", ");
        } catch {}

        setUserData({
          name: data.name || "Usuario ORION",
          email: data.email || "",
          fotoUrl: foto || null,
          stats: { compras, favoritos },
          defaultPayment,
          defaultAddress,
        });
      } catch (error) {
        console.error("Error cargando perfil:", error);
        showToast(t.errorLoad, "error");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [navigation, t, showToast]
  );

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    setImgError(false);
    load({ silent: true });
  };

  const handleLogout = () => {
    askConfirm({
      title: t.logoutTitle,
      message: t.confirmLogout,
      confirmText: t.yesExit,
      danger: true,
      icon: "log-out-outline",
      onConfirm: async () => {
        try {
          await logout();
          navigation.replace("Login");
        } catch {
          showToast(t.errorLogout, "error");
        }
      },
    });
  };

  const uploadPhoto = useCallback(
    async (uri) => {
      if (!uri || !/^(file:|content:|ph:|assets-library:|data:)/i.test(uri)) {
        console.warn("[uploadPhoto] uri no es local:", uri);
        showToast(t.photoNotLocal, "warning");
        return;
      }

      setUploadingPhoto(true);
      setProfileImage(uri);
      setImgError(false);

      try {
        const { token } = await loadSession();
        if (!token) {
          showToast(t.sessionExpired, "error");
          return;
        }

        let FileSystem;
        try {
          FileSystem = require("expo-file-system/legacy");
        } catch {
          FileSystem = require("expo-file-system");
        }
        if (!FileSystem || typeof FileSystem.readAsStringAsync !== "function") {
          throw new Error(t.fileSystemUnavailable);
        }

        const filename = uri.split("/").pop() || `avatar_${Date.now()}.jpg`;
        const match = /\.(\w+)$/.exec(filename);
        const ext = (match ? match[1] : "jpg").toLowerCase();
        const mimeExt = ext === "jpg" ? "jpeg" : ext;

        const base64 = await FileSystem.readAsStringAsync(uri, {
          encoding: "base64",
        });

        if (!base64 || base64.length < 100) {
          throw new Error(t.photoInvalid);
        }

        const dataUri = `data:image/${mimeExt};base64,${base64}`;

        const apiBase = API_URL.replace(/\/+$/, "");
        const uploadUrl = `${apiBase}${CUENTA_BASE}/foto`;

        console.log("📤 [uploadPhoto] POST JSON base64 →", uploadUrl);
        console.log("📤 [uploadPhoto] filename →", filename);
        console.log("📤 [uploadPhoto] ext →", ext);
        console.log("📤 [uploadPhoto] base64 length →", base64.length);

        const res = await fetch(uploadUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            foto_base64: dataUri,
            filename,
          }),
        });

        const text = await res.text();
        let data = null;
        try {
          data = text ? JSON.parse(text) : null;
        } catch {
          data = { raw: text };
        }

        console.log("📤 [uploadPhoto] respuesta →", res.status, data);

        if (!res.ok) {
          const msg =
            (data && (data.message || data.error || data.mensaje)) ||
            `${t.photoUploadError} (${res.status})`;
          if (res.status === 401) throw new Error(t.sessionExpired);
          if (res.status === 404) throw new Error(t.serverNoRoute);
          if (res.status === 400) throw new Error(t.photoInvalid);
          throw new Error(msg);
        }

        const nuevaUrl =
          data?.fotoUrl ||
          data?.usuario?.fotoUrl ||
          pickPhotoUri(data) ||
          null;

        if (nuevaUrl) {
          setProfileImage(nuevaUrl);
          setUserData((prev) => ({ ...prev, fotoUrl: nuevaUrl }));
        }
        showToast(t.photoUpdated, "success");
      } catch (e) {
        console.warn("No se pudo subir la foto:", e?.message);
        showToast(e?.message || t.photoUploadError, "error");
        setProfileImage(userData.fotoUrl || null);
      } finally {
        setUploadingPhoto(false);
      }
    },
    [t, userData.fotoUrl, showToast]
  );

  // ⭐ Picker de foto (reutilizable desde el visor y desde el menú)
  const abrirPicker = useCallback(async () => {
    const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permiso.granted) {
      showToast(t.permissionGallery, "warning");
      return;
    }
    const resultado = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!resultado.canceled) await uploadPhoto(resultado.assets[0].uri);
  }, [t, uploadPhoto, showToast]);

  // ⭐ Menú de cambiar/quitar foto (se usa desde el badge de cámara)
  const seleccionarFoto = useCallback(async () => {
    if (profileImage || userData.fotoUrl) {
      setConfirmModal({
        variant: "photo",
        title: t.photoPickTitle,
        message: t.photoDesc,
        icon: "camera",
        danger: false,
        actions: [
          {
            label: t.photoPick,
            icon: "image",
            color: p.primary,
            onPress: () => abrirPicker(),
          },
          {
            label: t.photoRemove,
            icon: "trash",
            color: "#EF4444",
            onPress: async () => {
              try {
                await request(`${CUENTA_BASE}/foto`, { method: "DELETE" });
              } catch {}
              setProfileImage(null);
              setUserData((prev) => ({ ...prev, fotoUrl: null }));
              setImgError(false);
              setPhotoViewer(false);
              showToast(t.photoRemoved, "success");
            },
          },
        ],
      });
      return;
    }
    abrirPicker();
  }, [
    profileImage,
    userData.fotoUrl,
    t,
    abrirPicker,
    p.primary,
    showToast,
  ]);

  // ⭐ Tap en el avatar → abre el visor fullscreen (o picker si no hay foto)
  const abrirVisorFoto = useCallback(() => {
    if (effectivePhoto) {
      setPhotoViewer(true);
      return;
    }
    seleccionarFoto();
  }, [effectivePhoto, seleccionarFoto]);

  const safeNavigate = (routeName, params) => {
    try {
      navigation.navigate(routeName, params);
    } catch {
      showToast(t.unavailableBody(routeName), "warning");
    }
  };

  const abrirAdmin = () => {
    if (!isAdminUser) {
      showToast(t.restrictedAdmin, "warning");
      return;
    }
    safeNavigate("AdminDashboard");
  };

  const settingsSub = useMemo(() => {
    const themeLabel =
      mode === "dark" ? t.dark : mode === "light" ? t.light : t.system;
    const langLabel = getLang(language) === "en" ? "English" : "Español";
    return `${themeLabel} · ${langLabel}`;
  }, [mode, language, t]);

  const menuActividad = useMemo(
    () => [
      {
        id: "orders",
        title: t.myOrders,
        subtext: `${userData.stats.compras} ${t.purchases}`,
        icon: "bag-handle",
        color: "#6366F1",
        action: () => safeNavigate("Orders"),
      },
      {
        id: "favorites",
        title: t.favorites,
        subtext: t.favoritesSub,
        icon: "heart",
        color: "#EC4899",
        action: () => safeNavigate("Favorites"),
      },
      {
        id: "notifications",
        title: t.notifications,
        subtext: t.notificationsSub,
        icon: "notifications",
        color: "#3B82F6",
        badge: unread,
        action: () => safeNavigate("Notifications"),
      },
    ],
    [userData, unread, t]
  );

  const menuServicios = useMemo(
    () => [
      {
        id: "payments",
        title: t.payments,
        subtext: userData.defaultPayment,
        icon: "card",
        color: "#10B981",
        action: () => safeNavigate("PaymentMethods"),
      },
      {
        id: "addresses",
        title: t.addresses,
        subtext: userData.defaultAddress,
        icon: "location",
        color: "#F59E0B",
        action: () => safeNavigate("Addresses"),
      },
      {
        id: "returns",
        title: t.returns,
        subtext: t.returnsSub,
        icon: "return-down-back",
        color: "#EF4444",
        action: () => safeNavigate("Returns"),
      },
      {
        id: "wallet",
        title: t.wallet,
        subtext: t.walletSub,
        icon: "wallet",
        color: "#059669",
        action: () => safeNavigate("Wallet"),
      },
      {
        id: "walletCard",
        title: t.walletCard,
        subtext: t.walletCardSub,
        icon: "cash",
        color: "#0EA5E9",
        action: () => safeNavigate("WalletCard"),
      },
      {
        id: "billing",
        title: t.billing,
        subtext: t.billingSub,
        icon: "document-text",
        color: "#8B5CF6",
        action: () => safeNavigate("Billing"),
      },
      {
        id: "loyalty",
        title: t.loyalty,
        subtext: t.loyaltySub,
        icon: "star",
        color: "#D97706",
        action: () => safeNavigate("Loyalty"),
      },
    ],
    [userData, t]
  );

  const menuDatos = useMemo(
    () => [
      {
        id: "personalData",
        title: t.personalData,
        subtext: t.personalDataSub,
        icon: "person-circle",
        color: "#6366F1",
        action: () => safeNavigate("PersonalData"),
      },
      {
        id: "interests",
        title: t.interests,
        subtext: t.interestsSub,
        icon: "sparkles",
        color: "#EC4899",
        action: () => safeNavigate("Interests"),
      },
      {
        id: "privacy",
        title: t.privacy,
        subtext: t.privacySub,
        icon: "lock-closed",
        color: "#0EA5E9",
        action: () => safeNavigate("Privacy"),
      },
      {
        id: "security",
        title: t.security,
        subtext: t.securitySub,
        icon: "shield-checkmark",
        color: "#14B8A6",
        action: () => safeNavigate("SecurityAndAccess"),
      },
    ],
    [t]
  );

  const menuConfig = useMemo(
    () => [
      {
        id: "settings",
        title: t.settings,
        subtext: settingsSub,
        icon: "settings",
        color: "#64748B",
        action: openPreferences,
      },
    ],
    [settingsSub, openPreferences, t]
  );

  const menuSoporte = useMemo(
    () => [
      {
        id: "nova",
        title: t.chatNova,
        subtext: t.chatNovaSub,
        icon: "chatbubbles",
        color: "#7C3AED",
        action: () => safeNavigate("ChatBot"),
        onlineDot: true,
      },
      {
        id: "contact",
        title: t.contact,
        subtext: t.contactSub,
        icon: "mail",
        color: "#0284C7",
        action: () => safeNavigate("Contact"),
      },
    ],
    [t]
  );

  const handleModalBack = useCallback(() => {
    if (prefsModal === "theme" || prefsModal === "language") {
      setPrefsModal("main");
    } else {
      setPrefsModal(null);
    }
  }, [prefsModal]);

  const showBackArrow = prefsModal !== null;

  const TopBar = () => (
    <View style={[styles.topBarWrap, { backgroundColor: p.background }]}>
      <View
        style={[
          styles.topBar,
          {
            backgroundColor: `${p.primary}22`,
            borderColor: `${p.primary}44`,
            borderWidth: 1,
          },
        ]}
      >
        <TouchableOpacity
          onPress={goBack}
          style={styles.backBtnSolid}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={24} color="#000000" />
        </TouchableOpacity>

        <Text
          style={[styles.topBarTitle, { color: "#000000" }]}
          numberOfLines={1}
        >
          {t.headerTitle}
        </Text>

        <View style={styles.topBarSpacer} />
      </View>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: p.background }]}>
        <TopBar />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={p.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const renderSection = ({ key, title, items, icon, color }) => {
    const isOpen = openSection === key;
    return (
      <View style={styles.sectionBlock}>
        <TouchableOpacity
          style={[
            styles.sectionHeader,
            {
              backgroundColor: p.surface,
              borderColor: `${color}55`,
            },
          ]}
          onPress={() => toggleSection(key)}
          activeOpacity={0.75}
        >
          <View
            style={[
              styles.sectionIconWrap,
              { backgroundColor: `${color}22`, borderColor: `${color}55` },
            ]}
          >
            <Ionicons name={icon} size={18} color={color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.sectionHeaderTitle, { color: p.text }]}>
              {title}
            </Text>
            <Text style={[styles.sectionHeaderSub, { color: p.subtle }]}>
              {t.itemsCount(items.length)}
            </Text>
          </View>
          <View
            style={[
              styles.chevronWrap,
              {
                backgroundColor: isOpen ? `${color}22` : "transparent",
                borderColor: isOpen ? `${color}66` : `${color}55`,
              },
            ]}
          >
            <Ionicons
              name={isOpen ? "chevron-up" : "chevron-down"}
              size={16}
              color={isOpen ? color : p.subtle}
            />
          </View>
        </TouchableOpacity>

        {isOpen && (
          <View
            style={[
              styles.menuGroup,
              styles.menuGroupOpen,
              {
                backgroundColor: p.surface,
                borderColor: `${color}55`,
              },
            ]}
          >
            {items.map((item, index) => (
              <View key={item.id}>
                <MenuItem
                  palette={p}
                  icon={item.icon}
                  color={item.color}
                  title={item.title}
                  subtext={item.subtext}
                  badge={item.badge}
                  onlineDot={item.onlineDot}
                  onPress={item.action}
                />
                {index < items.length - 1 && <Divider palette={p} />}
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: p.background }]}>
      <TopBar />

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={p.primary}
          />
        }
      >
        <LinearGradient
          colors={[`${p.primary}33`, "transparent"]}
          style={styles.heroWrap}
        >
          <View style={styles.header}>
            <TouchableOpacity
              onPress={abrirVisorFoto}
              activeOpacity={0.85}
              style={styles.avatarWrapper}
              disabled={uploadingPhoto}
            >
              <View
                style={[
                  styles.avatarRing,
                  {
                    backgroundColor: `${p.primary}22`,
                    borderColor: `${p.primary}77`,
                  },
                ]}
              >
                {effectivePhoto ? (
                  <Image
                    source={{ uri: effectivePhoto }}
                    style={styles.profileImage}
                    onError={(e) => {
                      if (__DEV__)
                        console.log(
                          "❌ [perfil] error cargando imagen:",
                          effectivePhoto,
                          e?.nativeEvent
                        );
                      setImgError(true);
                    }}
                  />
                ) : (
                  <View
                    style={[
                      styles.avatarContainer,
                      { backgroundColor: p.surface, borderColor: p.border },
                    ]}
                  >
                    <Ionicons name="person" size={50} color={p.subtle} />
                  </View>
                )}
                {uploadingPhoto && (
                  <View style={styles.uploadingOverlay}>
                    <ActivityIndicator color="#FFF" />
                  </View>
                )}
              </View>
              {/* Badge de cámara: abre el menú de cambiar/quitar foto */}
              <TouchableOpacity
                style={[styles.editBadge, { backgroundColor: p.primary }]}
                onPress={(e) => {
                  e?.stopPropagation?.();
                  seleccionarFoto();
                }}
                activeOpacity={0.85}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="camera" size={13} color="#FFF" />
              </TouchableOpacity>
            </TouchableOpacity>

            <Text style={[styles.name, { color: p.text }]}>
              {userData.name}
            </Text>
            <Text style={[styles.email, { color: p.subtle }]}>
              {userData.email}
            </Text>

            {isAdminUser && (
              <View style={styles.adminBadge}>
                <Ionicons name="shield-checkmark" size={11} color="#FFF" />
                <Text style={styles.adminBadgeText}>{t.adminBadge}</Text>
              </View>
            )}
          </View>
        </LinearGradient>

        <View style={styles.statsRow}>
          <View
            style={[
              styles.statCard,
              { backgroundColor: p.surface, borderColor: `${p.primary}55` },
            ]}
          >
            <View
              style={[styles.statIconWrap, { backgroundColor: `${p.primary}22` }]}
            >
              <Ionicons name="bag-handle" size={16} color={p.primary} />
            </View>
            <Text style={[styles.statNumber, { color: p.text }]}>
              {userData.stats.compras}
            </Text>
            <Text style={[styles.statLabel, { color: p.subtle }]}>
              {t.purchases}
            </Text>
          </View>

          <View
            style={[
              styles.statCard,
              { backgroundColor: p.surface, borderColor: `#EC489955` },
            ]}
          >
            <View
              style={[styles.statIconWrap, { backgroundColor: "#EC489922" }]}
            >
              <Ionicons name="heart" size={16} color="#EC4899" />
            </View>
            <Text style={[styles.statNumber, { color: p.text }]}>
              {userData.stats.favoritos}
            </Text>
            <Text style={[styles.statLabel, { color: p.subtle }]}>
              {t.favorites}
            </Text>
          </View>
        </View>

        {isAdminUser && (
          <View style={styles.sectionBlock}>
            <TouchableOpacity
              style={[
                styles.sectionHeader,
                { backgroundColor: p.surface, borderColor: "#F59E0B55" },
              ]}
              onPress={() => toggleSection("admin")}
              activeOpacity={0.75}
            >
              <View
                style={[
                  styles.sectionIconWrap,
                  { backgroundColor: "#F59E0B22", borderColor: "#F59E0B55" },
                ]}
              >
                <Ionicons name="shield" size={18} color="#F59E0B" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.sectionHeaderTitle, { color: p.text }]}>
                  {t.adminTitle}
                </Text>
                <Text style={[styles.sectionHeaderSub, { color: p.subtle }]}>
                  {t.itemsCount(2)}
                </Text>
              </View>
              <View
                style={[
                  styles.chevronWrap,
                  {
                    backgroundColor:
                      openSection === "admin" ? "#F59E0B22" : "transparent",
                    borderColor:
                      openSection === "admin" ? "#F59E0B66" : "#F59E0B55",
                  },
                ]}
              >
                <Ionicons
                  name={
                    openSection === "admin" ? "chevron-up" : "chevron-down"
                  }
                  size={16}
                  color={openSection === "admin" ? "#F59E0B" : p.subtle}
                />
              </View>
            </TouchableOpacity>

            {openSection === "admin" && (
              <View
                style={[
                  styles.menuGroup,
                  styles.menuGroupOpen,
                  { backgroundColor: p.surface, borderColor: "#F59E0B55" },
                ]}
              >
                <MenuItem
                  palette={p}
                  icon="stats-chart"
                  color="#F59E0B"
                  title={t.adminPanel}
                  subtext={t.adminPanelSub}
                  onPress={abrirAdmin}
                />
                <Divider palette={p} />
                <MenuItem
                  palette={p}
                  icon="chatbubbles-outline"
                  color="#7C3AED"
                  title={t.adminChat}
                  subtext={t.adminChatSub}
                  onPress={() => safeNavigate("ManageChat")}
                />
              </View>
            )}
          </View>
        )}

        {renderSection({
          key: "activity",
          title: t.activityTitle,
          items: menuActividad,
          icon: "pulse",
          color: "#6366F1",
        })}

        {renderSection({
          key: "services",
          title: t.servicesTitle,
          items: menuServicios,
          icon: "bag-check",
          color: "#10B981",
        })}

        {renderSection({
          key: "data",
          title: t.dataTitle,
          items: menuDatos,
          icon: "person",
          color: "#0EA5E9",
        })}

        {renderSection({
          key: "settings",
          title: t.settingsSectionTitle,
          items: menuConfig,
          icon: "settings",
          color: "#64748B",
        })}

        {renderSection({
          key: "support",
          title: t.supportTitle,
          items: menuSoporte,
          icon: "headset",
          color: "#7C3AED",
        })}

        <TouchableOpacity
          style={[
            styles.logoutButton,
            { backgroundColor: p.surface, borderColor: "#EF444455" },
          ]}
          onPress={handleLogout}
          activeOpacity={0.75}
        >
          <View style={styles.logoutIconWrap}>
            <Ionicons name="log-out-outline" size={18} color="#EF4444" />
          </View>
          <Text style={styles.logoutText}>{t.logout}</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ═══════════ TOAST ═══════════ */}
      {toast ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.toast,
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
          <Text style={styles.toastText} numberOfLines={3}>
            {toast.message}
          </Text>
        </Animated.View>
      ) : null}

      {/* ═══════════ VISOR FULLSCREEN DE FOTO ═══════════ */}
      <Modal
        visible={photoViewer}
        transparent
        animationType="fade"
        onRequestClose={() => setPhotoViewer(false)}
        statusBarTranslucent
      >
        <View style={styles.viewerBackdrop}>
          <SafeAreaView style={styles.viewerTopBar}>
            <TouchableOpacity
              onPress={() => setPhotoViewer(false)}
              style={styles.viewerCloseBtn}
              activeOpacity={0.7}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="close" size={26} color="#FFF" />
            </TouchableOpacity>
          </SafeAreaView>

          <Pressable
            style={styles.viewerImageWrap}
            onPress={() => setPhotoViewer(false)}
          >
            {effectivePhoto ? (
              <Image
                source={{ uri: effectivePhoto }}
                style={styles.viewerImage}
                resizeMode="contain"
              />
            ) : (
              <View style={styles.viewerEmptyWrap}>
                <Ionicons name="person" size={90} color="#475569" />
                <Text style={styles.viewerEmptyText}>
                  {t.photoViewerEmpty}
                </Text>
              </View>
            )}
          </Pressable>

          <SafeAreaView style={styles.viewerBottomBar}>
            <TouchableOpacity
              onPress={() => {
                setPhotoViewer(false);
                setTimeout(() => seleccionarFoto(), 150);
              }}
              style={styles.viewerActionBtn}
              activeOpacity={0.85}
            >
              <Ionicons name="camera" size={18} color="#FFF" />
              <Text style={styles.viewerActionText}>
                {effectivePhoto ? t.photoViewerChange : t.photoViewerAdd}
              </Text>
            </TouchableOpacity>
          </SafeAreaView>
        </View>
      </Modal>

      {/* ═══════════ CONFIRM MODAL (logout / cambiar foto / avisos) ═══════════ */}
      <Modal
        visible={!!confirmModal}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmModal(null)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setConfirmModal(null)}
        >
          <Pressable
            style={[
              styles.modalCard,
              { backgroundColor: p.surface, borderColor: `${p.primary}55` },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <View
              style={[
                styles.confirmIconWrap,
                {
                  backgroundColor: confirmModal?.danger
                    ? "#EF444422"
                    : `${p.primary}22`,
                },
              ]}
            >
              <Ionicons
                name={confirmModal?.icon || "help-circle"}
                size={30}
                color={confirmModal?.danger ? "#EF4444" : p.primary}
              />
            </View>
            <Text style={[styles.modalTitle, { color: p.text }]}>
              {confirmModal?.title}
            </Text>
            <Text style={[styles.confirmMessage, { color: p.subtle }]}>
              {confirmModal?.message}
            </Text>

            {/* Variante con acciones personalizadas (foto) */}
            {Array.isArray(confirmModal?.actions) && (
              <View style={{ marginTop: 6 }}>
                {confirmModal.actions.map((a, idx) => (
                  <TouchableOpacity
                    key={a.label}
                    style={[
                      styles.modalOption,
                      { borderColor: p.border },
                      idx === confirmModal.actions.length - 1 && {
                        borderBottomWidth: 0,
                      },
                    ]}
                    onPress={() => {
                      setConfirmModal(null);
                      setTimeout(() => a.onPress?.(), 150);
                    }}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.modalIconWrap,
                        { backgroundColor: `${a.color || p.primary}22` },
                      ]}
                    >
                      <Ionicons
                        name={a.icon || "ellipse"}
                        size={16}
                        color={a.color || p.primary}
                      />
                    </View>
                    <Text
                      style={[
                        styles.modalOptionText,
                        { color: a.color || p.text },
                      ]}
                    >
                      {a.label}
                    </Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  onPress={() => setConfirmModal(null)}
                  style={[
                    styles.secondaryBtn,
                    {
                      borderColor: `${p.subtle}55`,
                      marginTop: 12,
                      justifyContent: "center",
                    },
                  ]}
                  activeOpacity={0.85}
                >
                  <Text
                    style={[styles.secondaryBtnText, { color: p.subtle }]}
                  >
                    {t.cancel}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Variante simple (confirmación ok/cancel) */}
            {!Array.isArray(confirmModal?.actions) && (
              <View style={styles.modalBtnRow}>
                <TouchableOpacity
                  style={[
                    styles.secondaryBtn,
                    { borderColor: `${p.subtle}55`, flex: 1 },
                  ]}
                  onPress={() => setConfirmModal(null)}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.secondaryBtnText, { color: p.subtle }]}>
                    {t.cancel}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.primaryBtn,
                    {
                      backgroundColor: confirmModal?.danger
                        ? "#EF4444"
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
                  <Text style={styles.primaryBtnText}>
                    {confirmModal?.confirmText || t.confirm}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* ═══════════ MODAL PREFERENCIAS ═══════════ */}
      <Modal
        visible={prefsModal !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPrefsModal(null)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setPrefsModal(null)}
        >
          <Pressable
            style={[
              styles.modalCard,
              { backgroundColor: p.surface, borderColor: `${p.primary}55` },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHeader}>
              {showBackArrow && (
                <TouchableOpacity
                  onPress={handleModalBack}
                  style={[
                    styles.modalIconBtn,
                    { backgroundColor: `${p.primary}22` },
                  ]}
                  activeOpacity={0.7}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="arrow-back" size={18} color={p.primary} />
                </TouchableOpacity>
              )}
              <Text
                style={[
                  styles.modalTitle,
                  { color: p.text },
                  showBackArrow
                    ? { flex: 1, marginLeft: 8, textAlign: "left" }
                    : null,
                ]}
              >
                {prefsModal === "theme"
                  ? t.appearance
                  : prefsModal === "language"
                  ? t.language
                  : t.configTitle}
              </Text>
              {showBackArrow && (
                <TouchableOpacity
                  onPress={() => setPrefsModal(null)}
                  style={styles.modalIconBtn}
                  activeOpacity={0.7}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close" size={18} color={p.subtle} />
                </TouchableOpacity>
              )}
            </View>

            {prefsModal === "main" && (
              <>
                <ModalOption
                  palette={p}
                  icon="color-palette"
                  title={t.themeOption}
                  onPress={() => setPrefsModal("theme")}
                />
                <ModalOption
                  palette={p}
                  icon="language"
                  title={t.languageOption}
                  onPress={() => setPrefsModal("language")}
                />
                <ModalOption
                  palette={p}
                  icon="close"
                  title={t.close}
                  onPress={() => setPrefsModal(null)}
                  destructive
                />
              </>
            )}

            {prefsModal === "theme" && (
              <>
                <ModalOption
                  palette={p}
                  icon="sunny"
                  title={`${check(mode === "light")}${t.light}`}
                  onPress={() => {
                    setMode("light");
                    setPrefsModal(null);
                  }}
                />
                <ModalOption
                  palette={p}
                  icon="moon"
                  title={`${check(mode === "dark")}${t.dark}`}
                  onPress={() => {
                    setMode("dark");
                    setPrefsModal(null);
                  }}
                />
                <ModalOption
                  palette={p}
                  icon="phone-portrait"
                  title={`${check(mode === "system")}${t.system}`}
                  onPress={() => {
                    setMode("system");
                    setPrefsModal(null);
                  }}
                />
                <ModalOption
                  palette={p}
                  icon="arrow-back"
                  title={t.cancel}
                  onPress={() => setPrefsModal("main")}
                  destructive
                />
              </>
            )}

            {prefsModal === "language" && (
              <>
                <ModalOption
                  palette={p}
                  icon="flag"
                  title={`${check(getLang(language) === "es")}Español`}
                  onPress={() => {
                    setLanguage("es");
                    setPrefsModal(null);
                  }}
                />
                <ModalOption
                  palette={p}
                  icon="flag"
                  title={`${check(getLang(language) === "en")}English`}
                  onPress={() => {
                    setLanguage("en");
                    setPrefsModal(null);
                  }}
                />
                <ModalOption
                  palette={p}
                  icon="arrow-back"
                  title={t.cancel}
                  onPress={() => setPrefsModal("main")}
                  destructive
                />
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function Divider({ palette }) {
  return (
    <View
      style={{ height: 1, backgroundColor: palette.border, marginLeft: 64 }}
    />
  );
}

function MenuItem({
  palette,
  icon,
  color,
  title,
  subtext,
  onPress,
  badge,
  onlineDot,
}) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.65}>
      <View
        style={[
          styles.iconContainer,
          { backgroundColor: `${color}18`, borderColor: `${color}55` },
        ]}
      >
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <View style={styles.textContainer}>
        <Text style={[styles.cardText, { color: palette.text }]}>{title}</Text>
        <Text
          style={[styles.cardSubtext, { color: palette.subtle }]}
          numberOfLines={1}
        >
          {subtext}
        </Text>
      </View>
      {badge && <View style={styles.alertDot} />}
      {onlineDot && <View style={styles.onlineDot} />}
      <View style={styles.chevronWrapSmall}>
        <Ionicons
          name="chevron-forward"
          size={14}
          color={palette.subtle}
        />
      </View>
    </TouchableOpacity>
  );
}

function ModalOption({ palette, icon, title, onPress, destructive }) {
  const color = destructive ? "#EF4444" : palette.text;
  const bg = destructive ? "#EF444418" : `${palette.primary}18`;
  const iconColor = destructive ? "#EF4444" : palette.primary;
  return (
    <TouchableOpacity
      style={[styles.modalOption, { borderColor: palette.border }]}
      onPress={onPress}
      activeOpacity={0.65}
    >
      <View style={[styles.modalIconWrap, { backgroundColor: bg }]}>
        <Ionicons name={icon} size={16} color={iconColor} />
      </View>
      <Text style={[styles.modalOptionText, { color }]}>{title}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },

  topBarWrap: {
    paddingHorizontal: 0,
    paddingTop: 10,
    paddingBottom: 6,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 5,
  },
  backBtnSolid: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  topBarSpacer: {
    width: 40,
    height: 40,
  },
  topBarTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: -0.3,
  },

  heroWrap: { paddingTop: 20, paddingBottom: 24 },
  header: { alignItems: "center" },
  avatarWrapper: { position: "relative", marginBottom: 14 },
  avatarRing: {
    padding: 5,
    borderRadius: 60,
    borderWidth: 2,
  },
  profileImage: {
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  avatarContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
  },
  uploadingOverlay: {
    position: "absolute",
    top: 5,
    left: 5,
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "#00000088",
    justifyContent: "center",
    alignItems: "center",
  },
  editBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "#F8FAFC",
    elevation: 3,
  },
  name: { fontSize: 22, fontWeight: "800", letterSpacing: -0.4 },
  email: { fontSize: 13, marginTop: 4, fontWeight: "500" },
  adminBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    backgroundColor: "#F59E0B",
  },
  adminBadgeText: { color: "#FFF", fontSize: 10, fontWeight: "800" },

  statsRow: {
    flexDirection: "row",
    gap: 12,
    marginHorizontal: 20,
    marginBottom: 22,
  },
  statCard: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  statIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  statNumber: { fontSize: 20, fontWeight: "800", letterSpacing: -0.4 },
  statLabel: {
    fontSize: 11,
    fontWeight: "600",
    marginTop: 2,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  sectionBlock: { marginBottom: 12 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 20,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
  },
  sectionIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
  },
  sectionHeaderTitle: { fontSize: 14.5, fontWeight: "800", letterSpacing: -0.2 },
  sectionHeaderSub: { fontSize: 11, marginTop: 2, fontWeight: "500" },
  chevronWrap: {
    width: 28,
    height: 28,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
  },

  menuGroup: {
    marginHorizontal: 20,
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  menuGroupOpen: { marginTop: 6, paddingVertical: 2 },

  card: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
  },
  textContainer: { flex: 1, marginLeft: 12 },
  cardText: { fontSize: 14.5, fontWeight: "700", letterSpacing: -0.1 },
  cardSubtext: { fontSize: 11.5, marginTop: 2, fontWeight: "500" },
  alertDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#EF4444",
    marginRight: 8,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#22C55E",
    marginRight: 8,
  },
  chevronWrapSmall: {
    width: 24,
    height: 24,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },

  logoutButton: {
    flexDirection: "row",
    marginHorizontal: 20,
    padding: 14,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 6,
    borderWidth: 1,
    gap: 10,
  },
  logoutIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: "#EF444418",
    justifyContent: "center",
    alignItems: "center",
  },
  logoutText: {
    color: "#EF4444",
    fontWeight: "800",
    fontSize: 14,
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
    maxWidth: 380,
    borderRadius: 22,
    borderWidth: 1,
    padding: 20,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  modalIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  modalTitle: { fontSize: 17, fontWeight: "800", textAlign: "center" },
  modalOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
  },
  modalIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  modalOptionText: { fontSize: 14.5, fontWeight: "700" },

  // ⭐ Nuevos estilos para confirm / toast / botones
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
    lineHeight: 19,
    textAlign: "center",
    marginTop: 8,
    marginBottom: 12,
  },
  modalBtnRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  primaryBtn: {
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
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

  // ═══════════ VISOR FULLSCREEN ═══════════
  viewerBackdrop: {
    flex: 1,
    backgroundColor: "#000000",
    justifyContent: "space-between",
  },
  viewerTopBar: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  viewerCloseBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  viewerImageWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  viewerImage: {
    width: "100%",
    height: "100%",
  },
  viewerEmptyWrap: {
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  viewerEmptyText: {
    color: "#94A3B8",
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
  },
  viewerBottomBar: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    paddingTop: 12,
    alignItems: "center",
  },
  viewerActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.16)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
    minHeight: 46,
  },
  viewerActionText: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 18,
  },

  // ═══════════ TOAST ═══════════
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