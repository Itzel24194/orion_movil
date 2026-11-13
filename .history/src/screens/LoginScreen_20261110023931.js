import React, { useState, useEffect, useRef } from "react";
import {
  Dimensions,
  StyleSheet,
  TouchableOpacity,
  View,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  Animated,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Text, TextInput, Alert } from "../i18n/ui";
import { usePreferences } from "../context/PreferencesContext";
import { Ionicons } from "@expo/vector-icons";

import { login, verify2FA, isAdmin, request } from "../services/api";
import { registerForPushNotifications } from "../services/pushNotifications";

const { width, height } = Dimensions.get("window");

const BACKGROUND_IMAGES = [
  "https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=1200",
  "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=1200",
  "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=1200",
];

const translations = {
  es: {
    title: "ENTRAR",
    subtitle: "ORION",
    userLabel: "USUARIO",
    passLabel: "CONTRASEÑA",
    btnAcceder: "ACCEDER",
    newAccount: "¿AÚN NO TIENES CUENTA? REGÍSTRATE",
    forgot: "RECUPERAR ACCESO",
    denied: "Acceso denegado",
    errorMsg: "Correo o contraseña incorrectos",
    blocked: "Acceso bloqueado",
    blockedMsg: "Has superado el límite de 3 intentos.",
    remaining: "Te quedan",
    attemptsText: "intentos",
    loading: "Cargando...",
    fieldsRequired: "Por favor llena todos los campos",
    noConnection: "Sin conexión",

    // ⭐ 2FA
    twoFATitle: "VERIFICACIÓN 2FA",
    twoFASubtitle: "Ingresa el código de 6 dígitos de tu autenticador",
    twoFACodeLabel: "CÓDIGO",
    btnVerify: "VERIFICAR",
    btnCancel2FA: "CANCELAR",
    codeInvalid: "Ingresa los 6 dígitos",
    codeWrong: "Código incorrecto",
    twoFASentTo: "Código enviado",

    // ⭐ Push
    pushDeniedTitle: "Notificaciones desactivadas",
    pushDenied: "Activa las notificaciones en los Ajustes del dispositivo para recibir avisos sobre tus solicitudes.",
  },
  en: {
    title: "LOGIN",
    subtitle: "ORION",
    userLabel: "USERNAME",
    passLabel: "PASSWORD",
    btnAcceder: "ACCESS",
    newAccount: "DON'T HAVE AN ACCOUNT? SIGN UP",
    forgot: "RECOVER ACCESS",
    denied: "Access denied",
    errorMsg: "Incorrect email or password",
    blocked: "Access locked",
    blockedMsg: "You have exceeded the 3 attempts limit.",
    remaining: "You have",
    attemptsText: "attempts remaining",
    loading: "Loading...",
    fieldsRequired: "Please fill in all fields",
    noConnection: "No connection",

    // ⭐ 2FA
    twoFATitle: "2FA VERIFICATION",
    twoFASubtitle: "Enter the 6-digit code from your authenticator",
    twoFACodeLabel: "CODE",
    btnVerify: "VERIFY",
    btnCancel2FA: "CANCEL",
    codeInvalid: "Enter all 6 digits",
    codeWrong: "Incorrect code",
    twoFASentTo: "Code sent to",

    // ⭐ Push
    pushDeniedTitle: "Notifications disabled",
    pushDenied: "Enable notifications in your device settings to receive updates about your requests.",
  },
};

/**
 * ⭐ Registra el dispositivo para notificaciones push:
 * pide permiso, obtiene el token Expo y lo guarda en el backend.
 * Devuelve el status ('granted' | 'denied' | 'no_device' | 'error').
 * Nunca lanza error: un fallo aquí no debe impedir el login.
 */
async function registrarPush() {
  try {
    const { token, status } = await registerForPushNotifications();
    if (token) {
      if (__DEV__) console.log("🔔 Expo push token:", token);
      await request("/api/v1/solicitudes/push-token", {
        method: "POST",
        auth: true,
        body: { token, plataforma: Platform.OS },
      });
    }
    return status;
  } catch (e) {
    if (__DEV__) console.log("⚠️ Push no registrado:", e?.message || e);
    return "error";
  }
}

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
    administrador: "admin",
    administrator: "admin",
    admin: "admin",
    vendedor: "vendedor",
    seller: "vendedor",
    vendor: "vendedor",
    cliente: "cliente",
    client: "cliente",
    customer: "cliente",
    user: "cliente",
    usuario: "cliente",
  };

  return normalizado[rol] || rol;
}

export default function LoginScreen({ navigation }) {
  const { language: lang, setLanguage: setLang } = usePreferences();
  const text = translations[lang];

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [focusField, setFocusField] = useState(null);

  const [attempts, setAttempts] = useState(0);
  const [isBlocked, setIsBlocked] = useState(false);
  const [backgroundImage, setBackgroundImage] = useState(BACKGROUND_IMAGES[0]);

  // ⭐ Estado del 2FA
  const [twoFA, setTwoFA] = useState(null); // { temp_token, message }
  const [codigo2fa, setCodigo2fa] = useState("");
  const [verifying2fa, setVerifying2fa] = useState(false);

  // Animación de entrada del formulario
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  // Animación de presión del botón
  const btnScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const randomIndex = Math.floor(Math.random() * BACKGROUND_IMAGES.length);
    setBackgroundImage(BACKGROUND_IMAGES[randomIndex]);

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const animatePress = (toValue) => {
    Animated.spring(btnScale, {
      toValue,
      useNativeDriver: true,
      speed: 30,
      bounciness: 4,
    }).start();
  };

  // ⭐ Navegar al rol correcto
  const navigateByRole = (res) => {
    // ⭐ Registrar push en segundo plano (login normal y 2FA pasan por aquí)
    registrarPush().then((status) => {
      if (status === "denied") {
        Alert.alert(text.pushDeniedTitle, text.pushDenied);
      }
    });
    const rol = extraerRol(res);
    if (__DEV__) console.log("🔍 Rol detectado:", rol);
    if (rol === "admin" || isAdmin(res)) {
      navigation.replace("AdminDashboard", { role: "admin" });
    } else if (rol === "vendedor") {
      navigation.replace("AdminDashboard", { role: "vendedor" });
    } else {
      navigation.replace("Home", { role: "user" });
    }
  };

  const handleLogin = async () => {
    if (isBlocked) {
      Alert.alert(text.blocked, text.blockedMsg);
      return;
    }
    if (!email || !password) {
      Alert.alert(text.denied, text.fieldsRequired);
      return;
    }

    setLoading(true);
    try {
      const res = await login(email.trim(), password);
      if (__DEV__) console.log("🔍 LOGIN respuesta:", JSON.stringify(res, null, 2));

      // ⭐ 2FA: el backend pide el código
      if (res?.requires_2fa) {
        setTwoFA({
          temp_token: res.temp_token,
          message: res.message || text.twoFATitle,
        });
        setCodigo2fa("");
        setLoading(false);
        return;
      }

      // Login normal
      setAttempts(0);
      setLoading(false);
      navigateByRole(res);
    } catch (error) {
      if (__DEV__) console.log("❌ Error en login:", error);
      setLoading(false);

      if (error && error.status === 0) {
        Alert.alert(text.noConnection, error.message);
        return;
      }

      if (error?.data?.code === "email_no_confirmado") {
        Alert.alert(
          text.denied,
          error.message || "Confirma tu correo antes de iniciar sesión."
        );
        return;
      }

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

  // ⭐ Verificar código 2FA
  const handleVerify2FA = async () => {
    const c = String(codigo2fa || "").replace(/\D/g, "").slice(0, 6);
    if (c.length !== 6) {
      Alert.alert(text.denied, text.codeInvalid);
      return;
    }
    if (!twoFA?.temp_token) {
      Alert.alert(text.denied, text.codeWrong);
      return;
    }

    setVerifying2fa(true);
    try {
      const user = await verify2FA(twoFA.temp_token, c);
      if (__DEV__) console.log("✅ 2FA OK:", JSON.stringify(user, null, 2));
      setVerifying2fa(false);
      setTwoFA(null);
      setCodigo2fa("");
      setAttempts(0);
      navigateByRole(user);
    } catch (error) {
      if (__DEV__) console.log("❌ Error 2FA:", error);
      setVerifying2fa(false);
      Alert.alert(text.denied, error?.message || text.codeWrong);
    }
  };

  const cancel2FA = () => {
    setTwoFA(null);
    setCodigo2fa("");
  };

  return (
    <ImageBackground
      source={{ uri: backgroundImage }}
      style={styles.backgroundImage}
      resizeMode="cover"
    >
      <StatusBar barStyle="light-content" transparent backgroundColor="transparent" />

      <View style={styles.darkOverlay} />
      <LinearGradient
        colors={["rgba(26,0,26,0.55)", "rgba(0,0,0,0.85)", "rgba(0,20,40,0.55)"]}
        start={{ x: 0.2, y: 0.1 }}
        end={{ x: 0.8, y: 0.9 }}
        style={StyleSheet.absoluteFillObject}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.container}
      >
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

          <Animated.View
            style={[
              styles.form,
              { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
            ]}
          >
            <Text style={styles.brandTitle}>{text.subtitle}</Text>
            <View style={styles.brandUnderline} />

            {/* ⭐ MODO 2FA: pedir código */}
            {twoFA ? (
              <>
                <Text style={styles.cardTitle}>{text.twoFATitle}</Text>
                <Text style={styles.twoFASubtitle}>{text.twoFASubtitle}</Text>

                <View style={styles.inputWrapper}>
                  <Text style={styles.inputLabel}>{text.twoFACodeLabel}</Text>
                  <View
                    style={[
                      styles.inputPill,
                      focusField === "otp" && styles.inputPillFocused,
                    ]}
                  >
                    <Ionicons
                      name="shield-checkmark-outline"
                      size={18}
                      color={focusField === "otp" ? "#00d4ff" : "rgba(255,255,255,0.45)"}
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={[styles.inputBox, styles.otpInput]}
                      value={codigo2fa}
                      onChangeText={(v) => setCodigo2fa(v.replace(/\D/g, "").slice(0, 6))}
                      keyboardType="number-pad"
                      maxLength={6}
                      selectionColor="#00d4ff"
                      placeholderTextColor="rgba(255,255,255,0.3)"
                      editable={!verifying2fa}
                      autoFocus
                      onFocus={() => setFocusField("otp")}
                      onBlur={() => setFocusField(null)}
                      onSubmitEditing={handleVerify2FA}
                      returnKeyType="done"
                    />
                  </View>
                </View>

                <Animated.View
                  style={[styles.btnEntryWrap, { transform: [{ scale: btnScale }] }]}
                >
                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={handleVerify2FA}
                    onPressIn={() => animatePress(0.97)}
                    onPressOut={() => animatePress(1)}
                    disabled={verifying2fa}
                    style={{ borderRadius: 18, overflow: "hidden" }}
                  >
                    <LinearGradient
                      colors={["#ff007f", "#c026d3", "#00d4ff"]}
                      locations={[0, 0.5, 1]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.btnEntry}
                    >
                      {verifying2fa ? (
                        <ActivityIndicator size="small" color="#FFF" />
                      ) : (
                        <View style={styles.btnContent}>
                          <Text style={styles.btnEntryText}>{text.btnVerify}</Text>
                          <Ionicons
                            name="checkmark"
                            size={18}
                            color="#FFF"
                            style={{ marginLeft: 10 }}
                          />
                        </View>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                </Animated.View>

                <View style={styles.links}>
                  <TouchableOpacity onPress={cancel2FA} disabled={verifying2fa}>
                    <Text style={[styles.linkSubText]}>{text.btnCancel2FA}</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <Text style={styles.cardTitle}>{text.title}</Text>

                {/* ─── Campo USUARIO ─── */}
                <View style={styles.inputWrapper}>
                  <Text style={styles.inputLabel}>{text.userLabel}</Text>
                  <View
                    style={[
                      styles.inputPill,
                      focusField === "email" && styles.inputPillFocused,
                    ]}
                  >
                    <Ionicons
                      name="person-outline"
                      size={18}
                      color={focusField === "email" ? "#00d4ff" : "rgba(255,255,255,0.45)"}
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={styles.inputBox}
                      value={email}
                      onChangeText={setEmail}
                      autoCapitalize="none"
                      keyboardType="email-address"
                      selectionColor="#00d4ff"
                      placeholderTextColor="rgba(255,255,255,0.3)"
                      editable={!isBlocked && !loading}
                      onFocus={() => setFocusField("email")}
                      onBlur={() => setFocusField(null)}
                      onSubmitEditing={() => setFocusField("password")}
                      returnKeyType="next"
                    />
                  </View>
                </View>

                {/* ─── Campo CONTRASEÑA ─── */}
                <View style={styles.inputWrapper}>
                  <Text style={styles.inputLabel}>{text.passLabel}</Text>
                  <View
                    style={[
                      styles.inputPill,
                      focusField === "password" && styles.inputPillFocused,
                    ]}
                  >
                    <Ionicons
                      name="lock-closed-outline"
                      size={18}
                      color={focusField === "password" ? "#00d4ff" : "rgba(255,255,255,0.45)"}
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={styles.inputBox}
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPassword}
                      selectionColor="#00d4ff"
                      placeholderTextColor="rgba(255,255,255,0.3)"
                      editable={!isBlocked && !loading}
                      onFocus={() => setFocusField("password")}
                      onBlur={() => setFocusField(null)}
                      onSubmitEditing={handleLogin}
                      returnKeyType="go"
                    />
                    <TouchableOpacity
                      onPress={() => setShowPassword((v) => !v)}
                      style={styles.eyeBtn}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Ionicons
                        name={showPassword ? "eye-outline" : "eye-off-outline"}
                        size={18}
                        color="rgba(255,255,255,0.45)"
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* ─── Botón ACCEDER PRO ─── */}
                <Animated.View
                  style={[
                    styles.btnEntryWrap,
                    { transform: [{ scale: btnScale }] },
                    (isBlocked || loading) && styles.btnEntryDisabled,
                  ]}
                >
                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={handleLogin}
                    onPressIn={() => animatePress(0.97)}
                    onPressOut={() => animatePress(1)}
                    disabled={isBlocked || loading}
                    style={{ borderRadius: 18, overflow: "hidden" }}
                  >
                    <LinearGradient
                      colors={
                        isBlocked || loading
                          ? ["#334155", "#334155"]
                          : ["#ff007f", "#c026d3", "#00d4ff"]
                      }
                      locations={
                        isBlocked || loading
                          ? [0, 1]
                          : [0, 0.5, 1]
                      }
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.btnEntry}
                    >
                      {!(isBlocked || loading) && (
                        <LinearGradient
                          colors={["rgba(255,255,255,0.28)", "rgba(255,255,255,0)"]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 0, y: 1 }}
                          style={styles.btnHighlight}
                          pointerEvents="none"
                        />
                      )}

                      {loading ? (
                        <ActivityIndicator size="small" color="#FFF" />
                      ) : (
                        <View style={styles.btnContent}>
                          <Text style={styles.btnEntryText}>{text.btnAcceder}</Text>
                          <Ionicons
                            name="arrow-forward"
                            size={18}
                            color="#FFF"
                            style={{ marginLeft: 10 }}
                          />
                        </View>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                </Animated.View>

                {/* ─── Links inferiores ─── */}
                <View style={styles.links}>
                  <TouchableOpacity
                    onPress={() => navigation.navigate("Register")}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.linkText}>{text.newAccount}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => navigation.navigate("ForgotPassword")}
                    style={{ marginTop: 14 }}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.linkSubText}>{text.forgot}</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </Animated.View>

          <View style={{ height: 20 }} />
        </SafeAreaView>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  backgroundImage: { width: width, height: height },

  darkOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(2, 2, 2, 0.55)",
  },

  container: { flex: 1 },

  innerContainer: {
    flex: 1,
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: Platform.OS === "android" ? 0 : 8,
  },

  languageContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Platform.OS === "android" ? 40 : 15,
    alignSelf: "flex-end",
    backgroundColor: "rgba(0,0,0,0.4)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  langText: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
  },
  langActive: { color: "#4FD1C5" },
  langDivider: {
    color: "rgba(255,255,255,0.15)",
    marginHorizontal: 8,
    fontSize: 11,
  },

  form: {
    width: "100%",
    maxWidth: 400,
    alignItems: "center",
    paddingHorizontal: 8,
  },

  brandTitle: {
    color: "#FFFFFF",
    fontSize: 32,
    fontWeight: "900",
    letterSpacing: 14,
    textAlign: "center",
    textTransform: "uppercase",
    marginLeft: 14,
  },
  brandUnderline: {
    width: 60,
    height: 2,
    backgroundColor: "#ff007f",
    marginTop: 12,
    marginBottom: 26,
    borderRadius: 2,
  },

  cardTitle: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 3,
    marginBottom: 32,
    textAlign: "center",
    textTransform: "uppercase",
  },

  twoFASubtitle: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 22,
    textAlign: "center",
    letterSpacing: 0.5,
    paddingHorizontal: 10,
  },

  inputWrapper: {
    width: "100%",
    marginBottom: 18,
  },
  inputLabel: {
    color: "rgba(255, 255, 255, 0.5)",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 2.5,
    marginBottom: 8,
    marginLeft: 4,
    textTransform: "uppercase",
  },
  inputPill: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    backgroundColor: "rgba(10, 12, 20, 0.55)",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === "ios" ? 14 : 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  inputPillFocused: {
    borderColor: "rgba(0, 212, 255, 0.6)",
    backgroundColor: "rgba(10, 12, 20, 0.7)",
  },
  inputIcon: {
    marginRight: 10,
  },
  inputBox: {
    flex: 1,
    color: "#FFF",
    fontSize: 15,
    fontWeight: "500",
    padding: 0,
  },
  otpInput: {
    letterSpacing: 10,
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
  },
  eyeBtn: {
    padding: 4,
    marginLeft: 6,
  },

  btnEntryWrap: {
    width: "100%",
    marginTop: 16,
    borderRadius: 18,
    shadowColor: "#ff007f",
    shadowOpacity: 0.45,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  btnEntryDisabled: {
    shadowOpacity: 0,
    elevation: 0,
  },
  btnEntry: {
    width: "100%",
    paddingVertical: 17,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    overflow: "hidden",
    position: "relative",
  },
  btnHighlight: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "50%",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
  },
  btnContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  btnEntryText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 3,
    textTransform: "uppercase",
    textShadowColor: "rgba(0,0,0,0.35)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },

  links: {
    width: "100%",
    marginTop: 30,
    alignItems: "center",
  },
  linkText: {
    color: "rgba(255, 255, 255, 0.6)",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
    textAlign: "center",
  },
  linkSubText: {
    color: "rgba(255, 255, 255, 0.4)",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.5,
    textAlign: "center",
  },
  textDisabled: {
    color: "rgba(255, 255, 255, 0.15)",
  },
});