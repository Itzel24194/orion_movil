import React, { useState, useEffect } from "react";
import { Dimensions, StyleSheet, TouchableOpacity, View, ImageBackground, KeyboardAvoidingView, Platform, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, TextInput, Alert } from '../i18n/ui';
import { usePreferences } from '../context/PreferencesContext';
import { Ionicons } from "@expo/vector-icons";

import { login, isAdmin } from "../services/api";

const { width, height } = Dimensions.get("window");

const BACKGROUND_IMAGES = [
  "https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=1200", 
  "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=1200", 
  "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=1200", 
];

const translations = {
  es: {
    title: "ACCESO", userLabel: "Usuario / Correo", passLabel: "Contraseña",
    newAccount: "NUEVA CUENTA", forgot: "¿OLVIDASTE TU CONTRASEÑA?",
    denied: "Acceso denegado", errorMsg: "Correo o contraseña incorrectos",
    blocked: "Acceso bloqueado", blockedMsg: "Has superado el límite de 3 intentos.",
    remaining: "Te quedan", attemptsText: "intentos", loading: "Cargando..."
  },
  en: {
    title: "LOGIN", userLabel: "username", passLabel: "password",
    newAccount: "NEW ACCOUNT", forgot: "FORGOT PASSWORD?",
    denied: "Access denied", errorMsg: "Incorrect email or password",
    blocked: "Access locked", blockedMsg: "You have exceeded the 3 attempts limit.",
    remaining: "You have", attemptsText: "attempts remaining", loading: "Loading..."
  }
};

/**
 * Extrae el rol del usuario sin importar cómo venga la respuesta.
 */
function extraerRol(respuesta) {
  if (!respuesta) return null;

  const rolRaw =
    respuesta.rol ||
    respuesta.role ||
    respuesta.user?.rol ||
    respuesta.user?.role ||
    respuesta.data?.rol ||
    respuesta.data?.role ||
    respuesta.data?.user?.rol ||
    respuesta.data?.user?.role ||
    null;

  if (!rolRaw) return null;

  const rol = String(rolRaw).toLowerCase().trim();
  const normalizado = {
    "administrador": "admin",
    "administrator": "admin",
    "admin": "admin",
    "vendedor": "vendedor",
    "seller": "vendedor",
    "vendor": "vendedor",
    "cliente": "cliente",
    "client": "cliente",
    "customer": "cliente",
    "user": "cliente",
    "usuario": "cliente",
  };

  return normalizado[rol] || rol;
}

export default function LoginScreen({ navigation }) {
  const { language: lang, setLanguage: setLang } = usePreferences();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  
  const [attempts, setAttempts] = useState(0);
  const [isBlocked, setIsBlocked] = useState(false);
  const [backgroundImage, setBackgroundImage] = useState(BACKGROUND_IMAGES[0]);

  useEffect(() => {
    const randomIndex = Math.floor(Math.random() * BACKGROUND_IMAGES.length);
    setBackgroundImage(BACKGROUND_IMAGES[randomIndex]);
  }, []);

  const text = translations[lang];

  const handleLogin = async () => {if (isBlocked) {
      Alert.alert(text.blocked, text.blockedMsg);
      return;
    }
    if (!email || !password) {
      Alert.alert(text.denied, "Por favor llena todos los campos");
      return;
    }
    setLoading(true);
    try { const respuesta = await login(email.trim(), password);
      console.log("🔍 LOGIN respuesta completa:", JSON.stringify(respuesta, null, 2));
      const rol = extraerRol(respuesta);
      console.log("🔍 Rol detectado:", rol);
      setLoading(false);
      setAttempts(0);
      if (rol === "admin" || isAdmin(respuesta)) {
        console.log(" Navegando a AdminDashboard");
        navigation.replace("AdminDashboard", { role: "admin" });
      } else if (rol === "vendedor") {
        console.log(" Navegando a AdminDashboard (vendedor)");
        navigation.replace("AdminDashboard", { role: "vendedor" });
      } else {
        console.log(" Navegando a Home (cliente)");
        navigation.replace("Home", { role: "user" });
      }
    } catch (error) {
      console.log("❌ Error en login:", error);
      if (error && error.status === 0) {
        setLoading(false);
        Alert.alert("Sin conexión", error.message);
        return;
      }
      setLoading(false);
      const nextAttempts = attempts + 1;
      setAttempts(nextAttempts);

      if (nextAttempts >= 3) {
        setIsBlocked(true);
        Alert.alert(text.blocked, text.blockedMsg);
      } else {
        const remainingAttempts = 3 - nextAttempts;
        Alert.alert(
          text.denied,
          `${text.errorMsg}\n\n⚠️ ${text.remaining} ${remainingAttempts} ${text.attemptsText}.`
        );
      }
    }
  };

  return (
    <ImageBackground source={{ uri: backgroundImage }} style={styles.backgroundImage} resizeMode="cover">
      <StatusBar barStyle="light-content" transparent backgroundColor="transparent" />
      <View style={styles.darkOverlay} />

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.container}>
        <SafeAreaView style={styles.innerContainer}>
          <View style={styles.languageContainer}>
            <TouchableOpacity onPress={() => setLang("es")}>
              <Text style={[styles.langText, lang === "es" && styles.langActive]}>ES</Text>
            </TouchableOpacity>
            <Text style={styles.langDivider}>|</Text>
            <TouchableOpacity onPress={() => setLang("en")}>
              <Text style={[styles.langText, lang === "en" && styles.langActive]}>EN</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.titleContainer}>
            <Text style={styles.mainTitle}>{text.title}</Text>
          </View>
          <View style={styles.formContainer}>
            <View style={styles.inputWrapper}>
              <Text style={styles.inputLabel}>{text.userLabel}</Text>
              <TextInput
                style={styles.lineInput}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                selectionColor="#4FD1C5"
                editable={!isBlocked && !loading}
              />
            </View>
            <View style={styles.inputWrapper}>
              <Text style={styles.inputLabel}>{text.passLabel}</Text>
              <TextInput
                style={styles.lineInput}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                selectionColor="#4FD1C5"
                editable={!isBlocked && !loading}
              />
            </View>
            <TouchableOpacity 
              style={[styles.circularButton, (isBlocked || loading) && styles.buttonDisabled]} 
              activeOpacity={0.8}
              onPress={handleLogin}
              disabled={isBlocked || loading}
            >
              <Ionicons name={loading ? "refresh-outline" : "arrow-forward"} size={22} color="#FFF" />
            </TouchableOpacity>
          </View>

          <View style={styles.footerContainer}>
            <TouchableOpacity onPress={() => !isBlocked && navigation.navigate("Register")} disabled={isBlocked}>
              <Text style={[styles.footerLinkText, isBlocked && styles.textDisabled]}>{text.newAccount}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.forgotTouch} disabled={isBlocked}>
              <Text style={[styles.footerLinkSubText, isBlocked && styles.textDisabled]}>{text.forgot}</Text>
            </TouchableOpacity>
          </View>

        </SafeAreaView>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  backgroundImage: { width: width, height: height },
  darkOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(10, 20, 30, 0.4)" },
  container: { flex: 1 },
  innerContainer: { flex: 1, justifyContent: "space-between", alignItems: "center", paddingHorizontal: 40 },
  languageContainer: { flexDirection: "row", alignItems: "center", marginTop: Platform.OS === "android" ? 40 : 15, alignSelf: "flex-end", backgroundColor: "rgba(0,0,0,0.4)", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  langText: { color: "rgba(255,255,255,0.4)", fontSize: 11, fontWeight: "700", letterSpacing: 1 },
  langActive: { color: "#4FD1C5" },
  langDivider: { color: "rgba(255,255,255,0.15)", marginHorizontal: 8, fontSize: 11 },
  titleContainer: { marginTop: height * 0.08, alignItems: "center" },
  mainTitle: { color: "#FFF", fontSize: 32, fontWeight: "300", letterSpacing: 10, textAlign: "center" },
  formContainer: { width: "100%", alignItems: "center", marginTop: -40 },
  inputWrapper: { width: "100%", marginBottom: 35, alignItems: "center" },
  inputLabel: { color: "rgba(255, 255, 255, 0.7)", fontSize: 14, fontStyle: "italic", letterSpacing: 2, marginBottom: 4, textAlign: "center" },
  lineInput: { width: "100%", height: 40, color: "#FFF", fontSize: 16, textAlign: "center", borderBottomWidth: 1, borderColor: "rgba(79, 209, 197, 0.6)", paddingVertical: 4 },
  circularButton: { width: 60, height: 60, borderRadius: 30, backgroundColor: "rgba(79, 209, 197, 0.8)", justifyContent: "center", alignItems: "center", marginTop: 20, elevation: 5 },
  buttonDisabled: { backgroundColor: "rgba(148, 163, 184, 0.3)" },
  textDisabled: { color: "rgba(255, 255, 255, 0.2)" },
  footerContainer: { width: "100%", alignItems: "center", marginBottom: Platform.OS === "ios" ? 20 : 40 },
  footerLinkText: { color: "rgba(255, 255, 255, 0.6)", fontSize: 12, fontWeight: "600", letterSpacing: 2 },
  forgotTouch: { marginTop: 14 },
  footerLinkSubText: { color: "rgba(255, 255, 255, 0.4)", fontSize: 10, fontWeight: "600", letterSpacing: 1.5 }
});