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

// =========================================================
// PALETAS DE TEMA
// =========================================================
const PALETTES = {
  light: {
    background: "#F5F6FC", // Fondo lila muy claro/grisáceo de la imagen
    card: "#FFFFFF",
    textPrimary: "#0F172A",
    textSecondary: "#64748B",
    textMuted: "#94A3B8",
    border: "#E2E8F0",
    iconBg: "#F1F5F9",
    // Colores de la imagen
    headerGradientTop: "#E0E7FF", // Lila suave superior
    headerGradientBottom: "#C7D2FE", // Lila suave inferior
    nameText: "#0F172A",
    emailText: "#64748B",
    accent: "#6366F1",
    danger: "#EF4444",
  },
  dark: {
    background: "#0B1220",
    card: "#111A2E",
    textPrimary: "#F8FAFC",
    textSecondary: "#94A3B8",
    textMuted: "#64748B",
    border: "#1E293B",
    iconBg: "#1E293B",
    headerGradientTop: "#312E81",
    headerGradientBottom: "#1E1B4B",
    nameText: "#F8FAFC",
    emailText: "#94A3B8",
    accent: "#818CF8",
    danger: "#F87171",
  },
};

// =========================================================
// ALERT UNIVERSAL
// =========================================================
function showAlert(title, message, buttons) {
  if (Platform.OS === "web") {
    const confirmed = window.confirm(`${title}\n\n${message || ""}`);
    if (!confirmed) {
      buttons?.find((b) => b.style === "cancel")?.onPress?.();
      return;
    }
    buttons?.find((b) => b.style !== "cancel")?.onPress?.();
    return;
  }
  if (typeof RNAlert?.alert === "function") {
    RNAlert.alert(title, message, buttons);
  } else {
    Alert.alert(title, message, buttons);
  }
}

export default function ProfileScreen({ navigation }) {
  const { mode, language, setMode, setLanguage } = usePreferences();
  const systemScheme = useColorScheme();

  const resolvedMode =
    mode === "system" ? (systemScheme === "dark" ? "dark" : "light") : mode || "light";
  const theme = PALETTES[resolvedMode] || PALETTES.light;

  // Estados de la UI
  const [profileImage, setProfileImage] = useState(null);
  const [loading, setLoading] = useState(true);
  // Estado para controlar qué acordeón está abierto (null = todos cerrados)
  const [expandedSection, setExpandedSection] = useState(null);

  const [userData, setUserData] = useState({
    name: "Cargando...",
    email: "...",
    stats: { compras: 25, favoritos: 4 }, // Valores de ejemplo como en tu imagen
  });

  // Cargar datos del backend
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
        try { data = await fetchMe(); } catch {}

        if (mounted) {
          setUserData((prev) => ({
            ...prev,
            name: data.nombre || "Daniel", // El backend devuelve "nombre"
            email: data.email || "sin correo",
          }));
        }
      } catch (error) {
        console.error("Error cargando perfil:", error);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    run();
    return () => { mounted = false; };
  }, [navigation]);

  const toggleSection = (section) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const handleLogout = () => {
    showAlert("Cerrar Sesión", "¿Estás seguro de que deseas salir?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Salir",
        style: "destructive",
        onPress: async () => {
          try {
            await logout();
            navigation.replace("Login");
          } catch {
            showAlert("Error", "Problema al cerrar sesión.");
          }
        },
      },
    ]);
  };

  const seleccionarFoto = async () => {
    try {
      const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permiso.granted) return;

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

  if (loading) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.accent} />
      </View>
    );
  }

  // Datos de los menús desplegables
  const accordions = [
    {
      id: "activity",
      title: "Mi Actividad",
      subtitle: "3 opciones",
      icon: "pulse",
      iconColor: "#6366F1",
      iconBg: "#EEF2FF",
      borderColor: "#C7D2FE",
      items: [
        { name: "Mis Pedidos", action: () => navigation.navigate("Orders") },
        { name: "Historial de Pruebas", action: () => navigation.navigate("TryOnHistory") },
        { name: "Notificaciones", action: () => {} },
      ],
    },
    {
      id: "purchases",
      title: "Mis Compras y Servicios",
      subtitle: "7 opciones",
      icon: "bag-handle",
      iconColor: "#10B981",
      iconBg: "#D1FAE5",
      borderColor: "#A7F3D0",
      items: [
        { name: "Métodos de Pago", action: () => {} },
        { name: "Direcciones", action: () => {} },
        { name: "Cupones", action: () => {} },
      ],
    },
    {
      id: "personal",
      title: "Datos Personales y Preferencias",
      subtitle: "4 opciones",
      icon: "person",
      iconColor: "#3B82F6",
      iconBg: "#DBEAFE",
      borderColor: "#BFDBFE",
      items: [
        { name: "Seguridad y Acceso", action: () => navigation.navigate("SecurityAndAccess") },
        { name: "Idioma", action: () => {} },
        { name: "Tema de la app", action: () => {} },
      ],
    },
    {
      id: "settings",
      title: "Configuración",
      subtitle: "1 opción",
      icon: "settings",
      iconColor: "#64748B",
      iconBg: "#F1F5F9",
      borderColor: "#E2E8F0",
      items: [
        { name: "Ayuda y Soporte", action: () => {} },
      ],
    },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      {/* BOTÓN SUPERIOR (Header de navegación) */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#6366F1" />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Mi Cuenta</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* ===== HEADER LILA ===== */}
        <View style={[styles.header, { backgroundColor: theme.headerGradientTop }]}>
          <View style={{ position: 'relative', alignItems: 'center', width: '100%' }}>
            
            {/* Avatar */}
            <TouchableOpacity onPress={seleccionarFoto} activeOpacity={0.85} style={styles.avatarWrapper}>
              {profileImage ? (
                <Image source={{ uri: profileImage }} style={styles.profileImage} />
              ) : (
                <View style={styles.avatarContainer}>
                  <Ionicons name="person" size={55} color="#FFFFFF" />
                </View>
              )}
              {/* Badge de cámara */}
              <View style={styles.editBadge}>
                <Ionicons name="camera" size={14} color="#FFFFFF" />
              </View>
            </TouchableOpacity>

            {/* Botón de ajustes flotante a la derecha del avatar */}
            <TouchableOpacity 
              style={styles.settingsFloatingButton} 
              onPress={() => showAlert("Ajustes", "Configuración rápida próximamente")}
            >
              <Ionicons name="settings-sharp" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <Text style={[styles.name, { color: theme.nameText }]}>
            {userData.name}
          </Text>
          <Text style={[styles.email, { color: theme.emailText }]}>
            {userData.email}
          </Text>
        </View>

        {/* ===== ESTADÍSTICAS (Dos tarjetas grandes) ===== */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { borderColor: '#C7D2FE', backgroundColor: theme.card }]}>
            <View style={[styles.statIconBox, { backgroundColor: '#EEF2FF' }]}>
              <Ionicons name="bag-handle" size={20} color="#6366F1" />
            </View>
            <Text style={[styles.statNumber, { color: theme.textPrimary }]}>
              {userData.stats.compras}
            </Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>COMPRAS</Text>
          </View>

          <View style={[styles.statCard, { borderColor: '#FBCFE8', backgroundColor: theme.card }]}>
            <View style={[styles.statIconBox, { backgroundColor: '#FCE7F3' }]}>
              <Ionicons name="heart" size={20} color="#EC4899" />
            </View>
            <Text style={[styles.statNumber, { color: theme.textPrimary }]}>
              {userData.stats.favoritos}
            </Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>FAVORITOS</Text>
          </View>
        </View>

        {/* ===== MENÚS DESPLEGABLES (ACORDEONES) ===== */}
        <View style={styles.menuContainer}>
          {accordions.map((acc) => {
            const isOpen = expandedSection === acc.id;
            return (
              <View key={acc.id} style={styles.accordionWrapper}>
                {/* Cabecera del Acordeón */}
                <TouchableOpacity
                  style={[
                    styles.accordionHeader,
                    { backgroundColor: theme.card, borderColor: acc.borderColor }
                  ]}
                  onPress={() => toggleSection(acc.id)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.iconContainer, { backgroundColor: acc.iconBg }]}>
                    <Ionicons name={acc.icon} size={20} color={acc.iconColor} />
                  </View>
                  <View style={styles.textContainer}>
                    <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>
                      {acc.title}
                    </Text>
                    <Text style={[styles.cardSubtext, { color: theme.textSecondary }]}>
                      {acc.subtitle}
                    </Text>
                  </View>
                  {/* Chevron que cambia de dirección */}
                  <View style={styles.chevronBox}>
                    <Ionicons
                      name={isOpen ? "chevron-up" : "chevron-down"}
                      size={20}
                      color={theme.textMuted}
                    />
                  </View>
                </TouchableOpacity>

                {/* Contenido Desplegable */}
                {isOpen && (
                  <View style={[styles.accordionContent, { backgroundColor: theme.card, borderColor: acc.borderColor }]}>
                    {acc.items.map((item, idx) => (
                      <TouchableOpacity
                        key={idx}
                        style={[
                          styles.subItem,
                          idx < acc.items.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.border }
                        ]}
                        onPress={item.action}
                      >
                        <Text style={[styles.subItemText, { color: theme.textPrimary }]}>
                          {item.name}
                        </Text>
                        <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {/* Botón de Cerrar Sesión */}
        <TouchableOpacity
          style={[styles.logoutButton, { backgroundColor: theme.card, borderColor: theme.border }]}
          onPress={handleLogout}
        >
          <Ionicons name="log-out-outline" size={20} color={theme.danger} />
          <Text style={[styles.logoutText, { color: theme.danger }]}>Cerrar Sesión</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { justifyContent: "center", alignItems: "center" },

  // Top Bar
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: "#E0E7FF", // Color lila del header superior
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#C7D2FE",
  },
  topBarTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 18,
    fontWeight: "600",
    color: "#FFFFFF", // Texto blanco como en la captura
    marginRight: 40, // Para compensar el botón de atrás
  },

  // Header Lila
  header: {
    alignItems: "center",
    paddingTop: 30,
    paddingBottom: 40,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  avatarWrapper: {
    position: "relative",
    marginBottom: 12,
  },
  profileImage: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 3,
    borderColor: "#FFFFFF",
  },
  avatarContainer: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: "#818CF8",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "#FFFFFF",
  },
  editBadge: {
    position: "absolute",
    bottom: 5,
    right: 5,
    backgroundColor: "#6366F1",
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#E0E7FF",
  },
  settingsFloatingButton: {
    position: "absolute",
    right: 40,
    bottom: 25,
    backgroundColor: "#94A3B8", // Gris del botón
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
  },
  name: {
    fontSize: 26,
    fontWeight: "700",
    marginTop: 8,
  },
  email: {
    fontSize: 14,
    marginTop: 4,
  },

  // Estadísticas (Tarjetas)
  statsRow: {
    flexDirection: "row",
    paddingHorizontal: 20,
    marginTop: 20,
    gap: 12,
  },
  statCard: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
  },
  statIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  statNumber: {
    fontSize: 28,
    fontWeight: "800",
  },
  statLabel: {
    fontSize: 11,
    fontWeight: "600",
    marginTop: 4,
    letterSpacing: 0.5,
  },

  // Acordeones
  menuContainer: {
    paddingHorizontal: 20,
    marginTop: 24,
    gap: 16,
  },
  accordionWrapper: {
    borderRadius: 16,
    overflow: "hidden",
  },
  accordionHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderWidth: 1.5,
    borderRadius: 16,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  textContainer: {
    flex: 1,
    marginLeft: 14,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  cardSubtext: {
    fontSize: 12,
    marginTop: 2,
  },
  chevronBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "#F8FAFC",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },

  // Contenido desplegable
  accordionContent: {
    marginTop: -16, // Se une visualmente al header
    paddingTop: 20,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    borderWidth: 1.5,
    borderTopWidth: 0,
  },
  subItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 20,
    marginLeft: 20, // Para alinear con el texto del header
  },
  subItemText: {
    fontSize: 15,
    fontWeight: "500",
  },

  // Logout
  logoutButton: {
    flexDirection: "row",
    marginHorizontal: 20,
    marginTop: 30,
    padding: 16,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    gap: 8,
  },
  logoutText: {
    fontWeight: "600",
    fontSize: 15,
  },
});