import React, { useState, useEffect } from "react";
import { View, StyleSheet, ScrollView, TouchableOpacity, Dimensions, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, Alert } from '../i18n/ui';
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

import { getCurrentUser, fetchMe, logout } from "../services/api";

const { width } = Dimensions.get("window");

export default function AdminProfileScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [adminData, setAdminData] = useState({
    name: "Cargando...",
    email: "...",
  });

  // 🔄 CARGAR DATOS DEL ADMINISTRADOR DESDE EL BACKEND (MongoDB)
  useEffect(() => {
    const fetchAdminData = async () => {
      const currentUser = await getCurrentUser();

      if (currentUser) {
        try {
          let data = currentUser;
          try { data = await fetchMe(); } catch { /* usa los datos de la sesión guardada */ }
          setAdminData({
            name: data.name || "Administrador",
            email: data.email,
          });
        } catch (error) {
          console.error("Error al obtener perfil del Admin:", error);
          Alert.alert("Error", "No se pudieron recuperar los datos de administración.");
        } finally {
          setLoading(false);
        }
      } else {
        setLoading(false);
        // Redirigir si se pierde la sesión activa
        navigation.replace("Login");
      }
    };

    fetchAdminData();
  }, []);

  // 🚪 CERRAR SESIÓN
  const handleLogout = () => {
    Alert.alert(
      "Cerrar Sesión", 
      "¿Seguro que deseas salir del entorno administrativo?", 
      [
        { text: "Cancelar", style: "cancel" },
        { 
          text: "Salir", 
          style: "destructive", 
          onPress: async () => {
            try {
              await logout();
              navigation.replace("Login");
            } catch (error) {
              Alert.alert("Error", "No se pudo cerrar la sesión correctamente.");
            }
          } 
        },
      ]
    );
  };

  const profileOptions = [
    {
      id: "crud",
      title: "Base de Datos Principal",
      subtitle: "Acceso directo a tu CRUD original de productos",
      icon: "database-edit",
      iconColor: "#7C3AED",
      action: () => navigation.navigate("Crud"),
    },
    {
      id: "security",
      title: "Seguridad y Llaves API",
      subtitle: "Tokens de acceso y contraseñas del sistema",
      icon: "shield-key",
      iconColor: "#0EA5E9",
      action: () => Alert.alert("Seguridad", "Configuración de encriptación en modo local."),
    },
    {
      id: "logs",
      title: "Historial de Cambios (Logs)",
      subtitle: "Registro de auditoría de inventario",
      icon: "file-document-multiple",
      iconColor: "#10B981",
      action: () => Alert.alert("Auditoría", "No se registran modificaciones pendientes."),
    },
    {
      id: "support",
      title: "Soporte Técnico de ORION",
      subtitle: "Documentación del sistema y reportes",
      icon: "help-circle",
      iconColor: "#F59E0B",
      action: () => Alert.alert("Soporte", "Consola en entorno de desarrollo local v1.0.0"),
    },
  ];

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color="#7C3AED" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* HEADER DE PERFIL */}
      <View style={styles.header}>
        <View style={styles.avatarContainer}>
          <MaterialCommunityIcons name="shield-account" size={40} color="#7C3AED" />
          <View style={styles.activeBadge} />
        </View>
        <Text style={styles.adminName}>{adminData.name}</Text>
        <Text style={styles.adminEmail}>{adminData.email}</Text>
        
        <View style={styles.roleBadge}>
          <Text style={styles.roleText}>SUPER ADMIN</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={styles.content}>
        
        {/* BANNER DINÁMICO DE BIENVENIDA */}
        <View style={styles.welcomeBanner}>
          <Text style={styles.welcomeTitle}>¡Bienvenido de vuelta!</Text>
          <Text style={styles.welcomeSubtitle}>
            Sesión activa como <Text style={styles.welcomeHighlight}>{adminData.name}</Text>
          </Text>
        </View>

        {/* PANEL DE RENDIMIENTO RÁPIDO */}
        <Text style={styles.sectionTitle}>Estado del Servidor</Text>
        <View style={styles.serverStatusCard}>
          <View style={styles.statusRow}>
            <View style={styles.statusIndicatorContainer}>
              <View style={styles.greenDot} />
              <Text style={styles.statusText}>Servicios Activos</Text>
            </View>
            <Text style={styles.latencyText}>12 ms</Text>
          </View>
          <View style={styles.divider} />
          <Text style={styles.serverInfo}>
            Entorno seguro de simulación local. Todo el tráfico y renderizado se ejecutan de manera óptima en el dispositivo.
          </Text>
        </View>

        {/* MENÚ DE OPCIONES DE CONFIGURACIÓN */}
        <Text style={styles.sectionTitle}>Herramientas de Control</Text>
        <View style={styles.menuContainer}>
          {profileOptions.map((option, index) => (
            <View key={option.id}>
              <TouchableOpacity
                style={styles.menuItem}
                onPress={option.action}
                activeOpacity={0.7}
              >
                <View style={[styles.iconBox, { backgroundColor: `${option.iconColor}12` }]}>
                  <MaterialCommunityIcons name={option.icon} size={22} color={option.iconColor} />
                </View>

                <View style={styles.menuTextContainer}>
                  <Text style={styles.menuItemTitle}>{option.title}</Text>
                  <Text style={styles.menuItemSubtitle}>{option.subtitle}</Text>
                </View>

                <Ionicons name="chevron-forward" size={16} color="#475569" />
              </TouchableOpacity>
              
              {index < profileOptions.length - 1 && <View style={styles.menuDivider} />}
            </View>
          ))}
        </View>

        {/* BOTÓN DE CERRAR SESIÓN TOTAL */}
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
        >
          <Ionicons name="log-out-outline" size={20} color="#EF4444" style={{ marginRight: 8 }} />
          <Text style={styles.logoutText}>Cerrar Sesión Segura</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#020617",
  },
  loadingContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    alignItems: "center",
    paddingTop: 40,
    paddingBottom: 25,
    backgroundColor: "#0f172a",
    borderBottomWidth: 1,
    borderColor: "#1e293b",
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#7C3AED15",
    borderWidth: 2,
    borderColor: "#7C3AED40",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
    marginBottom: 12,
  },
  activeBadge: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#22C55E",
    borderWidth: 2,
    borderColor: "#0f172a",
  },
  adminName: {
    color: "#FFF",
    fontSize: 20,
    fontWeight: "bold",
  },
  adminEmail: {
    color: "#64748B",
    fontSize: 13,
    marginTop: 2,
  },
  roleBadge: {
    backgroundColor: "#7C3AED20",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#7C3AED40",
    marginTop: 10,
  },
  roleText: {
    color: "#C4B5FD",
    fontSize: 11,
    fontWeight: "bold",
    letterSpacing: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  welcomeBanner: {
    backgroundColor: "linear-gradient(135deg, #7C3AED10, #0EA5E910)",
    borderWidth: 1,
    borderColor: "#7C3AED25",
    padding: 16,
    borderRadius: 18,
    marginTop: 20,
    alignItems: "flex-start",
  },
  welcomeTitle: {
    color: "#C4B5FD",
    fontSize: 16,
    fontWeight: "bold",
  },
  welcomeSubtitle: {
    color: "#94A3B8",
    fontSize: 13,
    marginTop: 4,
  },
  welcomeHighlight: {
    color: "#FFF",
    fontWeight: "bold",
  },
  sectionTitle: {
    color: "#64748B",
    fontSize: 12,
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginTop: 25,
    marginBottom: 12,
  },
  serverStatusCard: {
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#1e293b",
    borderRadius: 20,
    padding: 16,
  },
  statusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statusIndicatorContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  greenDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#22C55E",
  },
  statusText: {
    color: "#E2E8F0",
    fontSize: 14,
    fontWeight: "600",
  },
  latencyText: {
    color: "#22C55E",
    fontSize: 13,
    fontWeight: "bold",
    backgroundColor: "#22C55E10",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  divider: {
    height: 1,
    backgroundColor: "#1e293b",
    marginVertical: 12,
  },
  serverInfo: {
    color: "#64748B",
    fontSize: 12,
    lineHeight: 18,
  },
  menuContainer: {
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#1e293b",
    borderRadius: 20,
    paddingVertical: 8,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  menuTextContainer: {
    flex: 1,
  },
  menuItemTitle: {
    color: "#F1F5F9",
    fontSize: 15,
    fontWeight: "600",
  },
  menuItemSubtitle: {
    color: "#64748B",
    fontSize: 12,
    marginTop: 2,
  },
  menuDivider: {
    height: 1,
    backgroundColor: "#1e293b",
    marginLeft: 68,
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EF444410",
    borderWidth: 1,
    borderColor: "#EF444430",
    paddingVertical: 15,
    borderRadius: 16,
    marginTop: 30,
    marginBottom: 40,
  },
  logoutText: {
    color: "#EF4444",
    fontWeight: "bold",
    fontSize: 15,
  },
});