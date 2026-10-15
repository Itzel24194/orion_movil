import React, { useState } from "react";
import { View, TouchableOpacity, StyleSheet, ActivityIndicator, Dimensions, KeyboardAvoidingView, Platform, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, TextInput, Alert } from '../i18n/ui';

import { Ionicons } from "@expo/vector-icons";

import { register, login } from "../services/api";

const { width, height } = Dimensions.get("window");

export default function RegisterScreen({ navigation }) {
  // Estados para capturar el texto de los inputs
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    // 1. Validaciones básicas de campos vacíos
    if (!name.trim() || !email.trim() || !password) {
      Alert.alert("Acceso denegado", "Por favor, completa todos los campos del formulario.");
      return;
    }

    if (password.length < 6) {
      Alert.alert("Seguridad", "La contraseña debe contener al menos 6 caracteres.");
      return;
    }

    // Activamos la carga limpiamente (Evita que se congele)
    setLoading(true);

    try {
      // Crear el usuario en el backend web (MongoDB)
      await register({ name: name.trim(), email: email.trim().toLowerCase(), password });
      // Iniciar sesión para obtener el token JWT
      await login(email.trim().toLowerCase(), password);

      setLoading(false);
      
      Alert.alert("¡Éxito!", "Tu cuenta premium ha sido creada correctamente.", [
        { text: "Entrar", onPress: () => navigation.replace("Home", { role: "user" }) }
      ]);

    } catch (error) {
      // Apagamos el estado de carga pase lo que pase para evitar congelamientos
      setLoading(false);
      console.error(error);
      
      if (error.status === 0) {
        Alert.alert("Error de conexión", error.message);
      } else if (error.status === 409) {
        Alert.alert("Error de registro", "Este correo electrónico ya se encuentra registrado.");
      } else {
        Alert.alert("Error de registro", error.message || "No se pudo crear la cuenta.");
      }
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0A141E" />
      
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <SafeAreaView style={styles.innerContainer}>
          
          {/* BOTÓN SUPERIOR PARA VOLVER */}
          <TouchableOpacity 
            style={styles.backArrowButton} 
            onPress={() => navigation.goBack()}
            disabled={loading}
          >
            <Ionicons name="arrow-back" size={24} color="rgba(255, 255, 255, 0.6)" />
          </TouchableOpacity>

          {/* TÍTULO ESTILO CINEMÁTICO */}
          <View style={styles.titleContainer}>
            <Text style={styles.mainTitle}>NUEVA CUENTA</Text>
          </View>

          {/* FORMULARIO ETÉREO MINIMALISTA */}
          <View style={styles.formContainer}>
            
            {/* INPUT: NOMBRE */}
            <View style={styles.inputWrapper}>
              <Text style={styles.inputLabel}>Nombre Completo</Text>
              <TextInput
                style={styles.lineInput}
                value={name}
                onChangeText={setName}
                placeholderTextColor="rgba(255,255,255,0.2)"
                selectionColor="#4FD1C5"
                editable={!loading}
              />
            </View>

            {/* INPUT: CORREO */}
            <View style={styles.inputWrapper}>
              <Text style={styles.inputLabel}>Correo Electrónico</Text>
              <TextInput
                style={styles.lineInput}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                selectionColor="#4FD1C5"
                editable={!loading}
              />
            </View>

            {/* INPUT: CONTRASEÑA */}
            <View style={styles.inputWrapper}>
              <Text style={styles.inputLabel}>Contraseña</Text>
              <TextInput
                style={styles.lineInput}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                selectionColor="#4FD1C5"
                editable={!loading}
              />
            </View>

            {/* BOTÓN CIRCULAR CON FLECHA / CARGANDO */}
            <TouchableOpacity 
              style={[styles.circularButton, loading && styles.buttonDisabled]} 
              activeOpacity={0.8}
              onPress={handleRegister}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <Ionicons name="checkmark" size={24} color="#FFF" />
              )}
            </TouchableOpacity>

          </View>

          {/* ACCIONES INFERIORES */}
          <View style={styles.footerContainer}>
            <TouchableOpacity onPress={() => !loading && navigation.goBack()} disabled={loading}>
              <Text style={styles.footerLinkText}>¿YA TIENES CUENTA? INICIA SESIÓN</Text>
            </TouchableOpacity>
          </View>

        </SafeAreaView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0A141E", // Fondo oscuro premium a juego con el overlay del login
  },
  keyboardView: {
    flex: 1,
  },
  innerContainer: {
    flex: 1,
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  backArrowButton: {
    alignSelf: "flex-start",
    marginTop: Platform.OS === "android" ? 45 : 15,
    padding: 8,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 20,
  },
  titleContainer: {
    marginTop: height * 0.02,
    alignItems: "center",
  },
  mainTitle: {
    color: "#FFF",
    fontSize: 28,
    fontWeight: "300",
    letterSpacing: 8,
    textAlign: "center",
  },
  formContainer: {
    width: "100%",
    alignItems: "center",
    marginTop: -20,
  },
  inputWrapper: {
    width: "100%",
    marginBottom: 30,
    alignItems: "center",
  },
  inputLabel: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 13,
    fontStyle: "italic",
    letterSpacing: 2,
    marginBottom: 4,
    textAlign: "center",
  },
  lineInput: {
    width: "100%",
    height: 40,
    color: "#FFF",
    fontSize: 16,
    textAlign: "center",
    borderBottomWidth: 1,
    borderColor: "rgba(79, 209, 197, 0.6)",
    paddingVertical: 4,
  },
  circularButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(79, 209, 197, 0.8)",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 20,
    shadowColor: "#4FD1C5",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  buttonDisabled: {
    backgroundColor: "rgba(148, 163, 184, 0.3)",
    shadowOpacity: 0,
    elevation: 0,
  },
  footerContainer: {
    width: "100%",
    alignItems: "center",
    marginBottom: Platform.OS === "ios" ? 20 : 40,
  },
  footerLinkText: {
    color: "rgba(255, 255, 255, 0.4)",
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 1.5,
    textAlign: "center",
  },
});