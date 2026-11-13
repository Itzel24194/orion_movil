import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  useWindowDimensions,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

export default function ProfileSetupScreen({ navigation }) {
  const { width } = useWindowDimensions();
  const isCompact = width < 360;
  const hPad = isCompact ? 20 : 24;

  // Estados del formulario
  const [nombre, setNombre] = useState("");
  const [apellidoP, setApellidoP] = useState("");
  const [apellidoM, setApellidoM] = useState("");
  const [dia, setDia] = useState("");
  const [mes, setMes] = useState("");
  const [anio, setAnio] = useState("");
  const [genero, setGenero] = useState(null); // 'mujer' | 'hombre' | 'indefinido'
  const [loading, setLoading] = useState(false);

  const handleFinalizar = async () => {
    // Validaciones
    if (!nombre.trim() || !apellidoP.trim()) {
      Alert.alert("Campos incompletos", "Nombre y apellido paterno son obligatorios.");
      return;
    }
    if (!dia || !mes || !anio) {
      Alert.alert("Fecha incompleta", "Ingresa tu fecha de nacimiento completa.");
      return;
    }
    const d = parseInt(dia, 10);
    const m = parseInt(mes, 10);
    const y = parseInt(anio, 10);
    if (d < 1 || d > 31 || m < 1 || m > 12 || y < 1900 || y > 2026) {
      Alert.alert("Fecha inválida", "Verifica los valores de día, mes y año.");
      return;
    }
    if (!genero) {
      Alert.alert("Género", "Selecciona una opción.");
      return;
    }

    setLoading(true);
    try {
      // Aquí llamas a tu API para guardar el perfil
      // await api.post('/api/v1/perfil', { nombre, apellido_p: apellidoP, apellido_m: apellidoM, dia, mes, anio, genero });
      
      // Simulación
      await new Promise((r) => setTimeout(r, 1200));
      
      setLoading(false);
      Alert.alert("Perfil completado", "¡Bienvenido a ORION!", [
        { text: "Continuar", onPress: () => navigation.replace("Home", { role: "user" }) },
      ]);
    } catch (error) {
      setLoading(false);
      Alert.alert("Error", error.message || "No se pudo guardar el perfil.");
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0A0F" />

      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.flex}
        >
          <ScrollView
            contentContainerStyle={[
              styles.scrollContent,
              { paddingHorizontal: hPad, paddingVertical: 24 },
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            bounces={false}
          >
            <View style={[styles.wrapper, { maxWidth: Math.min(width - hPad * 2, 420) }]}>
              
              {/* Título */}
              <Text style={[styles.title, isCompact && { fontSize: 28 }]}>
                Completa tu perfil
              </Text>
              <Text style={styles.subtitle}>
                Solo unos datos más para personalizar tu experiencia.
              </Text>

              {/* Formulario */}
              <View style={styles.form}>
                
                {/* Nombre */}
                <View style={styles.field}>
                  <Text style={styles.label}>Nombre(s) *</Text>
                  <TextInput
                    style={styles.input}
                    value={nombre}
                    onChangeText={setNombre}
                    placeholder="Ej. Ana María"
                    placeholderTextColor="rgba(255,255,255,0.25)"
                    selectionColor="#00d4ff"
                    editable={!loading}
                  />
                </View>

                {/* Apellido Paterno */}
                <View style={styles.field}>
                  <Text style={styles.label}>Apellido paterno *</Text>
                  <TextInput
                    style={styles.input}
                    value={apellidoP}
                    onChangeText={setApellidoP}
                    placeholder="Ej. García"
                    placeholderTextColor="rgba(255,255,255,0.25)"
                    selectionColor="#00d4ff"
                    editable={!loading}
                  />
                </View>

                {/* Apellido Materno */}
                <View style={styles.field}>
                  <Text style={styles.label}>Apellido materno (opcional)</Text>
                  <TextInput
                    style={styles.input}
                    value={apellidoM}
                    onChangeText={setApellidoM}
                    placeholder="Ej. López"
                    placeholderTextColor="rgba(255,255,255,0.25)"
                    selectionColor="#00d4ff"
                    editable={!loading}
                  />
                </View>

                {/* Fecha de nacimiento */}
                <View style={styles.field}>
                  <Text style={styles.label}>Fecha de nacimiento *</Text>
                  <View style={styles.dateRow}>
                    <TextInput
                      style={[styles.input, styles.dateInput]}
                      value={dia}
                      onChangeText={setDia}
                      placeholder="DD"
                      placeholderTextColor="rgba(255,255,255,0.25)"
                      keyboardType="number-pad"
                      maxLength={2}
                      selectionColor="#00d4ff"
                      editable={!loading}
                    />
                    <TextInput
                      style={[styles.input, styles.dateInput]}
                      value={mes}
                      onChangeText={setMes}
                      placeholder="MM"
                      placeholderTextColor="rgba(255,255,255,0.25)"
                      keyboardType="number-pad"
                      maxLength={2}
                      selectionColor="#00d4ff"
                      editable={!loading}
                    />
                    <TextInput
                      style={[styles.input, styles.dateInputYear]}
                      value={anio}
                      onChangeText={setAnio}
                      placeholder="AAAA"
                      placeholderTextColor="rgba(255,255,255,0.25)"
                      keyboardType="number-pad"
                      maxLength={4}
                      selectionColor="#00d4ff"
                      editable={!loading}
                    />
                  </View>
                </View>

                {/* Género */}
                <View style={styles.field}>
                  <Text style={styles.label}>Género *</Text>
                  <View style={styles.genderRow}>
                    {[
                      { key: "mujer", label: "Mujer" },
                      { key: "hombre", label: "Hombre" },
                      { key: "indefinido", label: "Indefinido" },
                    ].map((opt) => (
                      <TouchableOpacity
                        key={opt.key}
                        onPress={() => !loading && setGenero(opt.key)}
                        activeOpacity={0.8}
                        style={[
                          styles.genderOption,
                          genero === opt.key && styles.genderOptionSelected,
                        ]}
                      >
                        <View
                          style={[
                            styles.genderDot,
                            genero === opt.key && styles.genderDotSelected,
                          ]}
                        />
                        <Text
                          style={[
                            styles.genderText,
                            genero === opt.key && styles.genderTextSelected,
                          ]}
                        >
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Botón */}
                <TouchableOpacity
                  onPress={handleFinalizar}
                  disabled={loading}
                  activeOpacity={0.85}
                  style={[styles.btn, loading && styles.btnDisabled]}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#0A0A0F" />
                  ) : (
                    <Text style={styles.btnText}>Finalizar registro</Text>
                  )}
                </TouchableOpacity>

              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0A0A0F" },
  safe: { flex: 1 },
  flex: { flex: 1 },

  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
  },
  wrapper: {
    width: "100%",
    alignSelf: "center",
  },

  title: {
    color: "#FFFFFF",
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  subtitle: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 14,
    marginTop: 8,
    lineHeight: 20,
  },

  form: {
    marginTop: 28,
  },
  field: {
    marginBottom: 18,
  },
  label: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 8,
  },
  input: {
    minHeight: 52,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === "ios" ? 14 : 10,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "500",
  },

  dateRow: {
    flexDirection: "row",
    gap: 10,
  },
  dateInput: {
    flex: 1,
    textAlign: "center",
  },
  dateInputYear: {
    flex: 1.4,
    textAlign: "center",
  },

  genderRow: {
    flexDirection: "row",
    gap: 10,
  },
  genderOption: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 8,
  },
  genderOptionSelected: {
    borderColor: "#00d4ff",
    backgroundColor: "rgba(0, 212, 255, 0.08)",
  },
  genderDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.25)",
    marginRight: 6,
  },
  genderDotSelected: {
    borderColor: "#00d4ff",
    backgroundColor: "#00d4ff",
  },
  genderText: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 13,
    fontWeight: "500",
  },
  genderTextSelected: {
    color: "#FFFFFF",
    fontWeight: "600",
  },

  btn: {
    minHeight: 54,
    marginTop: 12,
    borderRadius: 12,
    backgroundColor: "#00d4ff",
    alignItems: "center",
    justifyContent: "center",
  },
  btnDisabled: {
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  btnText: {
    color: "#0A0A0F",
    fontSize: 15,
    fontWeight: "700",
  },
});