import React, { useState, useEffect } from "react";
import { usePreferences } from "../context/PreferencesContext";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  useColorScheme,
  Platform,
  Alert as RNAlert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text, Alert } from "../i18n/ui";

import * as ImagePicker from "expo-image-picker";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";

import { getCurrentUser, fetchMe, logout } from "../services/api";

/* =========================================================
   PALETAS DE TEMA (claro / oscuro)
   ========================================================= */
const PALETTES = {
  light: {
    background: "#F8FAFC",
    card: "#FFFFFF",
    cardElevated: "#FFFFFF",
    textPrimary: "#0F172A",
    textSecondary: "#64748B",
    textMuted: "#94A3B8",
    border: "#F1F5F9",
    divider: "#F1F5F9",
    iconBg: "#F1F5F9",
    chevron: "#CBD5E1",
    // Header lila
    headerGradientTop: "#A78BFA",   // violet-400
    headerGradientBottom: "#6366F1", // indigo-500
    headerText: "#FFFFFF",
    headerSubtext: "rgba(255,255,255,0.85)",
    avatarRing: "rgba(255,255,255,0.65)",
    // Acentos
    accent: "#6366F1",
    accentSoft: "rgba(99,102,241,0.12)",
    danger: "#EF4444",
    dangerBorder: "#FEE2E2",
    logoutBg: "#FFFFFF",
    logoutText: "#EF4444",
  },
  dark: {
    background: "#0B1220",
    card: "#111A2E",
    cardElevated: "#16213B",
    textPrimary: "#F8FAFC",
    textSecondary: "#94A3B8",
    textMuted: "#64748B",
    border: "#1E293B",
    divider: "#1E293B",
    iconBg: "#1E293B",
    chevron: "#475569",
    // Header lila (más profundo para dark)
    headerGradientTop: "#7C3AED",   // violet-600
    headerGradientBottom: "#4338CA", // indigo-700
    headerText: "#F8FAFC",
    headerSubtext: "rgba(248,250,252,0.75)",
    avatarRing: "rgba(248,250,252,0.35)",
    // Acentos
    accent: "#818CF8",
    accentSoft: "rgba(129,140,248,0.15)",
    danger: "#F87171",
    dangerBorder: "#3B1D1D",
    logoutBg: "#111A2E",
    logoutText: "#F87171",
  },
};

/* =========================================================
   ALERT universal (móvil + web)
   ========================================================= */
function showAlert(title, message, buttons) {
  if (Platform.OS === "web") {
    const confirmed = window.confirm(`${title}\n\n${message || ""}`);
    if (!confirmed) {
      const cancel = buttons?.find((b) => b.style === "cancel");
      cancel?.onPress?.();
      return;
    }
    const ok = buttons?.find((b) => b.style !== "cancel");
    ok?.onPress?.();
    return;
  }
  if (typeof RNAlert?.alert === "function") {
    RNAlert.alert(title, message, buttons);
  } else {
    // Si el Alert de ../i18n/ui es el que debe usarse, cae aquí
    Alert.alert(title, message, buttons);
  }
}

/* =========================================================
   COMPONENTE
   ========================================================= */
export default function ProfileScreen({ navigation }) {
  const { mode, language, setMode, setLanguage } = usePreferences();
  const systemScheme = useColorScheme();

  const resolvedMode =
    mode === "system"
      ? systemScheme === "dark"
        ? "dark"
        : "light"
      : mode || "light";

  const theme = PALETTES[resolvedMode] || PALETTES.light;

  /* ---------- Preferencias ---------- */
  const openPreferences = () =>
    showAlert("Configuración ORION", "Selecciona una opción", [
      {
        text: "Tema oscuro / claro",
        onPress: () =>
          showAlert("Apariencia", "¿Qué tema deseas utilizar?", [
            { text: "Claro", onPress: () => setMode("light") },
            { text: "Oscuro", onPress: () => setMode("dark") },
            { text: "Sistema", onPress: () => setMode("system") },
            { text: "Cancelar", style: "cancel" },
          ]),
      },
      {
        text: "Español / English",
        onPress: () =>
          showAlert("Idioma", "Elige el idioma", [
            { text: "Español", onPress: () => setLanguage("es") },
            { text: "English", onPress: () => setLanguage("en") },
            { text: "Cancelar", style: "cancel" },
          ]),
      },
      { text: "Cerrar", style: "cancel" },
    ]);

  /* ---------- Estado ---------- */
  const [profileImage, setProfileImage] = useState(null);
  const [loading, setLoading] = useState(true);

  const [userData, setUserData] = useState({
    name: "Cargando...",
    email: "...",
    stats: { compras: 0, favoritos: 0, cupones: 0 },
    defaultPayment: "Visa •••• 4820",
    defaultAddress: "Av. Reforma 405, CDMX",
    unreadNotifications: true,
  });

  /* ---------- Cargar datos reales ---------- */
  useEffect(() => {
    let mounted = true;

    const run = async () => {
      try {
        const currentUser = await getCurrentUser();

        if (!currentUser) {
          if (mounted) navigation.replace("Login");
          return;
        }

        let data = currentUser;
        try {
          data = await fetchMe();
        } catch {
          /* usa datos de la sesión guardada */
        }

        if (mounted) {
          setUserData((prev) => ({
            ...prev,
            name: data.name || "Usuario de Orion",
            email: data.email || "sin correo",
          }));
        }
      } catch (error) {
        console.error("Error cargando perfil:", error);
        if (mounted) {
          showAlert("Error", "No se pudo cargar la información del perfil.", [
            { text: "OK" },
          ]);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    run();
    return () => {
      mounted = false;
    };
  }, [navigation]);

  /* ---------- Cerrar sesión ---------- */
  const handleLogout = () => {
    showAlert(
      "Cerrar Sesión",
      "¿Estás seguro de que deseas salir de tu cuenta?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Salir",
          style: "destructive",
          onPress: async () => {
            try {
              await logout();
              navigation.replace("Login");
            } catch {
              showAlert("Error", "Hubo un problema al intentar cerrar sesión.", [
                { text: "OK" },
              ]);
            }
          },
        },
      ]
    );
  };

  /* ---------- Foto de perfil ---------- */
  const seleccionarFoto = async () => {
    try {
      const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permiso.granted) {
        showAlert(
          "Permiso requerido",
          "Necesitamos acceso a tu galería para actualizar tu foto de perfil.",
          [{ text: "OK" }]
        );
        return;
      }

      const resultado = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!resultado.canceled && resultado.assets?.length) {
        setProfileImage(resultado.assets[0].uri);
      }
    } catch (e) {
      console.error("ImagePicker error:", e);
    }
  };

  /* ---------- Opciones del menú ---------- */
  const menuOptions = [
    {
      id: "orders",
      title: "Mis Pedidos",
      subtext: "Consultar solicitudes registradas",
      icon: "bag-handle",
      color: "#6366F1",
      action: () => navigation.navigate("Orders"),
    },
    {
      id: "favorites",
      title: "Favoritos",
      subtext: "Ver tus artículos guardados",
      icon: "heart",
      color: "#EC4899",
    },
    {
      id: "payments",
      title: "Métodos de Pago",
      subtext: userData.defaultPayment,
      icon: "card",
      color: "#10B981",
    },
    {
      id: "addresses",
      title: "Direcciones",
      subtext: userData.defaultAddress,
      icon: "location",
      color: "#F59E0B",
    },
    {
      id: "notifications",
      title: "Notificaciones",
      subtext: "Configurar alertas y avisos",
      icon: "notifications",
      color: "#3B82F6",
      badge: userData.unreadNotifications,
    },
    {
      id: "security",
      title: "Seguridad y Acceso",
      subtext: "Contraseña y datos biométricos",
      icon: "shield-checkmark",
      color: "#14B8A6",
      action: () => navigation.navigate("SecurityAndAccess"),
    },
    {
      id: "settings",
      title: "Configuración",
      subtext: `Tema: ${resolvedMode} · Idioma: ${language}`,
      action: openPreferences,
      icon: "settings",
      color: "#64748B",
    },
  ];

  /* ---------- Loading ---------- */
  if (loading) {
    return (
      <View
        style={[
          styles.container,
          styles.loadingContainer,
          { backgroundColor: theme.background },
        ]}
      >
        <ActivityIndicator size="large" color={theme.accent} />
        <Text style={[styles.loadingText, { color: theme.textMuted }]}>
          Cargando tu perfil…
        </Text>
      </View>
    );
  }

  /* ---------- Render ---------- */
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* ===== HEADER LILA ===== */}
        <View
          style={[
            styles.header,
            {
              backgroundColor: theme.headerGradientBottom,
              borderBottomLeftRadius: 28,
              borderBottomRightRadius: 28,
            },
          ]}
        >
          {/* capa superior para simular el gradiente lila */}
          <View
            pointerEvents="none"
            style={[
              styles.headerGradientOverlay,
              { backgroundColor: theme.headerGradientTop },
            ]}
          />

          <TouchableOpacity
            onPress={seleccionarFoto}
            activeOpacity={0.85}
            style={styles.avatarWrapper}
          >
            {profileImage ? (
              <Image
                source={{ uri: profileImage }}
                style={[styles.profileImage, { borderColor: theme.avatarRing }]}
              />
            ) : (
              <View
                style={[
                  styles.avatarContainer,
                  {
                    backgroundColor: "rgba(255,255,255,0.18)",
                    borderColor: theme.avatarRing,
                  },
                ]}
              >
                <Ionicons name="person" size={55} color="#FFFFFF" />
              </View>
            )}
            <View
              style={[
                styles.editBadge,
                {
                  backgroundColor: "#FFFFFF",
                  borderColor: theme.headerGradientBottom,
                },
              ]}
            >
              <Ionicons name="camera" size={14} color={theme.headerGradientBottom} />
            </View>
          </TouchableOpacity>

          <Text style={[styles.name, { color: theme.headerText }]}>
            {userData.name}
          </Text>
          <Text style={[styles.email, { color: theme.headerSubtext }]}>
            {userData.email}
          </Text>
        </View>

        {/* ===== ESTADÍSTICAS (flotan sobre el header) ===== */}
        <View
          style={[
            styles.statsContainer,
            {
              backgroundColor: theme.card,
              borderColor: theme.border,
              shadowColor: resolvedMode === "dark" ? "#000" : "#0F172A",
            },
          ]}
        >
          <View style={styles.statBox}>
            <Text style={[styles.statNumber, { color: theme.accent }]}>
              {userData.stats.compras}
            </Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
              Compras
            </Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
          <View style={styles.statBox}>
            <Text style={[styles.statNumber, { color: theme.accent }]}>
              {userData.stats.favoritos}
            </Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
              Favoritos
            </Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
          <View style={styles.statBox}>
            <Text style={[styles.statNumber, { color: theme.accent }]}>
              {userData.stats.cupones}
            </Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
              Cupones
            </Text>
          </View>
        </View>

        {/* ===== MI CUENTA ===== */}
        <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>
          Mi Cuenta
        </Text>
        <View
          style={[
            styles.menuGroup,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}
        >
          {menuOptions.map((item, index) => (
            <View key={item.id}>
              <TouchableOpacity
                style={styles.card}
                onPress={item.action}
                activeOpacity={0.6}
              >
                <View
                  style={[
                    styles.iconContainer,
                    {
                      backgroundColor:
                        resolvedMode === "dark"
                          ? `${item.color}25`
                          : `${item.color}15`,
                    },
                  ]}
                >
                  <Ionicons name={item.icon} size={20} color={item.color} />
                </View>

                <View style={styles.textContainer}>
                  <Text style={[styles.cardText, { color: theme.textPrimary }]}>
                    {item.title}
                  </Text>
                  <Text
                    style={[styles.cardSubtext, { color: theme.textMuted }]}
                    numberOfLines={1}
                  >
                    {item.subtext}
                  </Text>
                </View>

                {item.badge && <View style={styles.alertDot} />}

                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color={theme.chevron}
                  style={styles.chevron}
                />
              </TouchableOpacity>
              {index < menuOptions.length - 1 && (
                <View
                  style={[
                    styles.menuDivider,
                    { backgroundColor: theme.divider },
                  ]}
                />
              )}
            </View>
          ))}
        </View>

        {/* ===== SOPORTE ===== */}
        <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>
          Soporte
        </Text>
        <View
          style={[
            styles.menuGroup,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}
        >
          <TouchableOpacity style={styles.card} activeOpacity={0.6}>
            <View
              style={[
                styles.iconContainer,
                {
                  backgroundColor:
                    resolvedMode === "dark" ? "#8B5CF625" : "#8B5CF615",
                },
              ]}
            >
              <MaterialIcons name="support-agent" size={20} color="#8B5CF6" />
            </View>
            <View style={styles.textContainer}>
              <Text style={[styles.cardText, { color: theme.textPrimary }]}>
                Ayuda y Soporte
              </Text>
              <Text style={[styles.cardSubtext, { color: theme.textMuted }]}>
                Canal de atención 24/7
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={16}
              color={theme.chevron}
              style={styles.chevron}
            />
          </TouchableOpacity>
        </View>

        {/* ===== CERRAR SESIÓN ===== */}
        <TouchableOpacity
          style={[
            styles.logoutButton,
            {
              backgroundColor: theme.logoutBg,
              borderColor: theme.dangerBorder,
            },
          ]}
          onPress={handleLogout}
          activeOpacity={0.7}
        >
          <Ionicons name="log-out-outline" size={20} color={theme.logoutText} />
          <Text style={[styles.logoutText, { color: theme.logoutText }]}>
            Cerrar Sesión
          </Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

/* =========================================================
   ESTILOS (solo layout; los colores vienen del tema)
   ========================================================= */
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    fontWeight: "500",
  },

  /* Header lila */
  header: {
    alignItems: "center",
    paddingTop: 40,
    paddingBottom: 70, // espacio extra para que las stats floten
    overflow: "hidden",
    position: "relative",
  },
  headerGradientOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "55%",
    opacity: 0.55,
  },
  avatarWrapper: {
    position: "relative",
    marginBottom: 14,
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
  },
  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
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
  },
  name: {
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  email: {
    fontSize: 14,
    marginTop: 3,
  },

  /* Stats */
  statsContainer: {
    flexDirection: "row",
    marginHorizontal: 20,
    marginTop: -50, // flota sobre el header
    borderRadius: 20,
    paddingVertical: 16,
    marginBottom: 25,
    alignItems: "center",
    borderWidth: 1,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  statBox: {
    flex: 1,
    alignItems: "center",
  },
  statNumber: {
    fontSize: 18,
    fontWeight: "700",
  },
  statLabel: {
    fontSize: 12,
    marginTop: 3,
    fontWeight: "500",
  },
  statDivider: {
    width: 1,
    height: 20,
  },

  /* Secciones */
  sectionTitle: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginLeft: 24,
    marginBottom: 8,
  },
  menuGroup: {
    marginHorizontal: 20,
    borderRadius: 20,
    paddingVertical: 2,
    marginBottom: 22,
    borderWidth: 1,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  textContainer: {
    flex: 1,
    marginLeft: 14,
  },
  cardText: {
    fontSize: 15,
    fontWeight: "600",
  },
  cardSubtext: {
    fontSize: 12,
    marginTop: 2,
  },
  alertDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#EF4444",
    marginRight: 8,
  },
  chevron: {
    opacity: 0.9,
  },
  menuDivider: {
    height: 1,
    marginLeft: 64,
  },

  /* Logout */
  logoutButton: {
    flexDirection: "row",
    marginHorizontal: 20,
    padding: 16,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 5,
    borderWidth: 1,
  },
  logoutText: {
    fontWeight: "700",
    fontSize: 15,
    marginLeft: 8,
  },
});