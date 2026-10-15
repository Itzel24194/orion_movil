import React, { useState } from "react";
import { StyleSheet, View, ScrollView, TouchableOpacity, Switch, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, Alert } from '../i18n/ui';
import { Ionicons } from "@expo/vector-icons";

import { getCurrentUser, requestPasswordReset } from "../services/api";

export default function SecurityAndAccessScreen({ navigation }) {
  const [isBiometricEnabled, setIsBiometricEnabled] = useState(false);
  const [isTwoFactorEnabled, setIsTwoFactorEnabled] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);

  // 📧 FUNCIÓN REAL PARA RESTABLECER CONTRASEÑA
  const handleResetPassword = async () => {
    const userEmail = (await getCurrentUser())?.email;

    if (!userEmail) {
      Alert.alert("Error", "No se detectó un correo electrónico activo.");
      return;
    }

    Alert.alert(
      "Cambiar Contraseña",
      `Enviaremos un correo a ${userEmail} para restablecer tu contraseña. ¿Deseas continuar?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Enviar Correo",
          onPress: async () => {
            setSendingEmail(true);
            try {
              await requestPasswordReset(userEmail);
              Alert.alert(
                "¡Correo Enviado!",
                "Revisa tu bandeja de entrada o la carpeta de spam para seguir las instrucciones de cambio."
              );
            } catch (error) {
              console.error(error);
              Alert.alert("Error", "No pudimos enviar el correo de recuperación en este momento.");
            } finally {
              setSendingEmail(false);
            }
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
      
      {/* HEADER PREMIUM */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Seguridad y Acceso</Text>
        <View style={{ width: 40 }} /> {/* Dummy view para balancear */}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        {/* SECCIÓN 1: INICIO DE SESIÓN */}
        <Text style={styles.sectionTitle}>Inicio de Sesión</Text>
        <View style={styles.menuGroup}>
          <TouchableOpacity 
            style={styles.card} 
            onPress={handleResetPassword} 
            disabled={sendingEmail}
            activeOpacity={0.7}
          >
            <View style={[styles.iconContainer, { backgroundColor: "#14B8A615" }]}>
              <Ionicons name="key" size={20} color="#14B8A6" />
            </View>
            <View style={styles.textContainer}>
              <Text style={styles.cardText}>Cambiar Contraseña</Text>
              <Text style={styles.cardSubtext}>Te enviaremos un correo de restablecimiento seguro</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
          </TouchableOpacity>
        </View>

        {/* SECCIÓN 2: SEGURIDAD AVANZADA */}
        <Text style={styles.sectionTitle}>Seguridad Avanzada</Text>
        <View style={styles.menuGroup}>
          
          {/* BIOMÉTRICOS */}
          <View style={styles.card}>
            <View style={[styles.iconContainer, { backgroundColor: "#6366F115" }]}>
              <Ionicons name="finger-print" size={20} color="#6366F1" />
            </View>
            <View style={styles.textContainer}>
              <Text style={styles.cardText}>Datos Biométricos</Text>
              <Text style={styles.cardSubtext}>Acceder con Face ID o Huella Dactilar</Text>
            </View>
            <Switch
              value={isBiometricEnabled}
              onValueChange={(value) => setIsBiometricEnabled(value)}
              trackColor={{ false: "#E2E8F0", true: "#6366F1" }}
              thumbColor="#FFF"
            />
          </View>

          <View style={styles.menuDivider} />

          {/* VERIFICACIÓN 2 PASOS */}
          <View style={styles.card}>
            <View style={[styles.iconContainer, { backgroundColor: "#F59E0B15" }]}>
              <Ionicons name="shield-lock" size={20} color="#F59E0B" />
            </View>
            <View style={styles.textContainer}>
              <Text style={styles.cardText}>Verificación en 2 Pasos</Text>
              <Text style={styles.cardSubtext}>Agrega una capa extra protegiendo tu cuenta</Text>
            </View>
            <Switch
              value={isTwoFactorEnabled}
              onValueChange={(value) => setIsTwoFactorEnabled(value)}
              trackColor={{ false: "#E2E8F0", true: "#F59E0B" }}
              thumbColor="#FFF"
            />
          </View>
        </View>

        {/* DISPOSITIVOS */}
        <Text style={styles.sectionTitle}>Sesiones Activas</Text>
        <View style={styles.menuGroup}>
          <View style={styles.card}>
            <View style={[styles.iconContainer, { backgroundColor: "#10B98115" }]}>
              <Ionicons name="smartphone" size={20} color="#10B981" />
            </View>
            <View style={styles.textContainer}>
              <Text style={styles.cardText}>Este Dispositivo</Text>
              <Text style={styles.cardSubtext}>Activo ahora • México</Text>
            </View>
            <View style={styles.activeBadge}>
              <Text style={styles.activeBadgeText}>Actual</Text>
            </View>
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#FFF",
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#0F172A" },
  scrollContent: { paddingTop: 20, paddingBottom: 40 },
  
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
    marginBottom: 25,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  iconContainer: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  textContainer: { flex: 1, marginLeft: 14, paddingRight: 8 },
  cardText: { color: "#1E293B", fontSize: 15, fontWeight: "600" },
  cardSubtext: { color: "#94A3B8", fontSize: 12, marginTop: 2, lineHeight: 16 },
  menuDivider: { height: 1, backgroundColor: "#F8FAFC", marginLeft: 66 },
  
  activeBadge: {
    backgroundColor: "#10B98115",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  activeBadgeText: { color: "#10B981", fontSize: 11, fontWeight: "700" }
});