import React, { useState, useEffect } from "react";
import { usePreferences } from "../context/PreferencesContext";
import { View, StyleSheet, TouchableOpacity, ScrollView, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, Alert } from '../i18n/ui';

import * as ImagePicker from "expo-image-picker";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";

import { getCurrentUser, fetchMe, logout } from "../services/api";

export default function ProfileScreen({ navigation }) {
  const { mode, language, setMode, setLanguage } = usePreferences();
  const openPreferences = () => Alert.alert('Configuración ORION', 'Selecciona una opción', [
    { text: 'Tema oscuro / claro', onPress: () => Alert.alert('Apariencia', '¿Qué tema deseas utilizar?', [
      { text: 'Claro', onPress: () => setMode('light') }, { text: 'Oscuro', onPress: () => setMode('dark') }, { text: 'Sistema', onPress: () => setMode('system') },
    ]) },
    { text: 'Español / English', onPress: () => Alert.alert('Idioma', 'Elige el idioma', [
      { text: 'Español', onPress: () => setLanguage('es') }, { text: 'English', onPress: () => setLanguage('en') },
    ]) },
    { text: 'Cerrar', style: 'cancel' },
  ]);

  const [profileImage, setProfileImage] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Estado para los datos del usuario (reemplazando la simulación fija)
  const [userData, setUserData] = useState({
    name: "Cargando...",
    email: "...",
    stats: { compras: 0, favoritos: 0, cupones: 0 },
    defaultPayment: "Visa •••• 4820",
    defaultAddress: "Av. Reforma 405, CDMX",
    unreadNotifications: true
  });

  // 🔄 OBTENER LOS DATOS REALES DESDE EL BACKEND (MongoDB)
  useEffect(() => {
    const fetchUserData = async () => {
      const currentUser = await getCurrentUser();

      if (currentUser) {
        try {
          let data = currentUser;
          try { data = await fetchMe(); } catch { /* usa los datos de la sesión guardada */ }
          setUserData(prevState => ({
            ...prevState,
            name: data.name || "Usuario de Orion",
            email: data.email,
          }));
        } catch (error) {
          console.error("Error cargando perfil:", error);
          Alert.alert("Error", "No se pudo cargar la información del perfil.");
        } finally {
          setLoading(false);
        }
      } else {
        setLoading(false);
        // Si no hay sesión activa, redirigir al Login por seguridad
        navigation.replace("Login");
      }
    };

    fetchUserData();
  }, []);

  // 🚪 FUNCIÓN PARA CERRAR SESIÓN
  const handleLogout = () => {
    Alert.alert(
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
            } catch (error) {
              Alert.alert("Error", "Hubo un problema al intentar cerrar sesión.");
            }
          }
        }
      ]
    );
  };

  const seleccionarFoto = async () => {
    const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permiso.granted) {
      Alert.alert(
        "Permiso requerido",
        "Necesitamos acceso a tu galería para actualizar tu foto de perfil."
      );
      return;
    }

    const resultado = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!resultado.canceled) {
      setProfileImage(resultado.assets[0].uri);
    }
  };

  const menuOptions = [
    { 
      id: "orders", 
      title: "Mis Pedidos", 
      subtext: "Consultar solicitudes registradas", 
      icon: "bag-handle", 
      color: "#6366F1", 
      action: () => navigation.navigate("Orders") 
    },
    { 
      id: "favorites", 
      title: "Favoritos", 
      subtext: "Ver tus artículos guardados", 
      icon: "heart", 
      color: "#EC4899" 
    },
    { 
      id: "payments", 
      title: "Métodos de Pago", 
      subtext: userData.defaultPayment, 
      icon: "card", 
      color: "#10B981" 
    },
    { 
      id: "addresses", 
      title: "Direcciones", 
      subtext: userData.defaultAddress, 
      icon: "location", 
      color: "#F59E0B" 
    },
    { 
      id: "notifications", 
      title: "Notificaciones", 
      subtext: "Configurar alertas y avisos", 
      icon: "notifications", 
      color: "#3B82F6",
      badge: userData.unreadNotifications
    },
    { 
  id: "security", 
  title: "Seguridad y Acceso", 
  subtext: "Contraseña y datos biométricos", 
  icon: "shield-checkmark", 
  color: "#14B8A6",
  action: () => navigation.navigate("SecurityAndAccess") // <-- NUEVA ACCIÓN DE NAVEGACIÓN
},
    { 
      id: "settings", 
      title: "Configuración", 
      subtext: `Tema: ${mode} · Idioma: ${language}`,
      action: openPreferences, 
      icon: "settings", 
      color: "#64748B" 
    },
  ];

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        
        {/* ENCABEZADO DE PERFIL */}
        <View style={styles.header}>
          <TouchableOpacity onPress={seleccionarFoto} activeOpacity={0.8} style={styles.avatarWrapper}>
            {profileImage ? (
              <Image source={{ uri: profileImage }} style={styles.profileImage} />
            ) : (
              <View style={styles.avatarContainer}>
                <Ionicons name="person" size={55} color="#94A3B8" />
              </View>
            )}
            <View style={styles.editBadge}>
              <Ionicons name="camera" size={14} color="#FFF" />
            </View>
          </TouchableOpacity>

          <Text style={styles.name}>{userData.name}</Text>
          <Text style={styles.email}>{userData.email}</Text>
        </View>

        {/* CONTENEDOR DE ESTADÍSTICAS */}
        <View style={styles.statsContainer}>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{userData.stats.compras}</Text>
            <Text style={styles.statLabel}>Compras</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{userData.stats.favoritos}</Text>
            <Text style={styles.statLabel}>Favoritos</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{userData.stats.cupones}</Text>
            <Text style={styles.statLabel}>Cupones</Text>
          </View>
        </View>

        {/* LISTA DE OPCIONES: MI CUENTA */}
        <Text style={styles.sectionTitle}>Mi Cuenta</Text>
        <View style={styles.menuGroup}>
          {menuOptions.map((item, index) => (
            <View key={item.id}>
              <TouchableOpacity style={styles.card} onPress={item.action} activeOpacity={0.6}>
                <View style={[styles.iconContainer, { backgroundColor: `${item.color}15` }]}>
                  <Ionicons name={item.icon} size={20} color={item.color} />
                </View>
                
                <View style={styles.textContainer}>
                  <Text style={styles.cardText}>{item.title}</Text>
                  <Text style={styles.cardSubtext} numberOfLines={1}>{item.subtext}</Text>
                </View>

                {item.badge && <View style={styles.alertDot} />}

                <Ionicons name="chevron-forward" size={16} color="#CBD5E1" style={styles.chevron} />
              </TouchableOpacity>
              {index < menuOptions.length - 1 && <View style={styles.menuDivider} />}
            </View>
          ))}
        </View>

        {/* SECCIÓN: SOPORTE */}
        <Text style={styles.sectionTitle}>Soporte</Text>
        <View style={styles.menuGroup}>
          <TouchableOpacity style={styles.card} activeOpacity={0.6}>
            <View style={[styles.iconContainer, { backgroundColor: "#8B5CF615" }]}>
              <MaterialIcons name="support-agent" size={20} color="#8B5CF6" />
            </View>
            <View style={styles.textContainer}>
              <Text style={styles.cardText}>Ayuda y Soporte</Text>
              <Text style={styles.cardSubtext}>Canal de atención 24/7</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#CBD5E1" style={styles.chevron} />
          </TouchableOpacity>
        </View>

        {/* BOTÓN CERRAR SESIÓN */}
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
          activeOpacity={0.7}
        >
          <Ionicons name="log-out-outline" size={20} color="#EF4444" />
          <Text style={styles.logoutText}>Cerrar Sesión</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  loadingContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    alignItems: "center",
    paddingTop: 30,
    paddingBottom: 25,
  },
  avatarWrapper: {
    position: "relative",
    marginBottom: 12,
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: "#6366F1",
  },
  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  editBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: "#6366F1",
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "#F8FAFC",
    shadowColor: "#6366F1",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  name: {
    color: "#0F172A",
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  email: {
    color: "#64748B",
    fontSize: 14,
    marginTop: 3,
  },
  statsContainer: {
    flexDirection: "row",
    backgroundColor: "#FFF",
    marginHorizontal: 20,
    borderRadius: 20,
    paddingVertical: 16,
    marginBottom: 25,
    alignItems: "center",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  statBox: {
    flex: 1,
    alignItems: "center",
  },
  statNumber: {
    color: "#6366F1",
    fontSize: 18,
    fontWeight: "750",
  },
  statLabel: {
    color: "#64748B",
    fontSize: 12,
    marginTop: 3,
    fontWeight: "500",
  },
  statDivider: {
    width: 1,
    height: 20,
    backgroundColor: "#F1F5F9",
  },
  sectionTitle: {
    color: "#94A3B8",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginLeft: 24,
    marginBottom: 8,
  },
  menuGroup: {
    backgroundColor: "#FFF",
    marginHorizontal: 20,
    borderRadius: 20,
    paddingVertical: 2,
    marginBottom: 22,
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
    color: "#1E293B",
    fontSize: 15,
    fontWeight: "600",
  },
  cardSubtext: {
    color: "#94A3B8",
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
    opacity: 0.8,
  },
  menuDivider: {
    height: 1,
    backgroundColor: "#F8FAFC",
    marginLeft: 64,
  },
  logoutButton: {
    flexDirection: "row",
    backgroundColor: "#FFF",
    marginHorizontal: 20,
    padding: 16,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 5,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    shadowColor: "#EF4444",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
  },
  logoutText: {
    color: "#EF4444",
    fontWeight: "700",
    fontSize: 15,
    marginLeft: 8,
  },
});