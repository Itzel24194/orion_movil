import React, { useState, useRef, useEffect } from "react";
import { View, StyleSheet, TouchableOpacity, ScrollView, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '../i18n/ui';
import { Ionicons } from "@expo/vector-icons";

export default function ChatBotScreen({ navigation }) {
  const scrollRef = useRef();

  const [messages, setMessages] = useState([
    {
      id: "1",
      from: "bot",
      text: "¡Hola! 👋 Soy Nova, el asistente inteligente de ORION.\n\nEstoy aquí para resolver tus dudas de forma inmediata. Selecciona una de las opciones frecuentes para comenzar:",
      time: getCurrentTime(),
    },
  ]);

  const questions = [
    { id: "1", text: "🛍 ¿Cómo comprar?", icon: "basket" },
    { id: "2", text: "💳 Métodos de pago", icon: "card" },
    { id: "3", text: "🚚 Tiempo de envío", icon: "rocket" },
    { id: "4", text: "📦 Rastrear pedido", icon: "cube" },
    { id: "5", text: "🔄 Devoluciones", icon: "refresh" },
    { id: "6", text: "🎁 Promociones", icon: "gift" },
    { id: "7", text: "☎ Contactar soporte", icon: "call" },
  ];

  const answers = {
    "🛍 ¿Cómo comprar?":
      "1. Explora nuestros productos.\n2. Selecciona tu talla y color ideales.\n3. Presiona 'Agregar al carrito'.\n4. Ve al ícono de carrito en el menú inferior y finaliza tu pago de forma segura.",

    "💳 Métodos de pago":
      "Soportamos pagos cifrados mediante tarjetas de crédito/débito (Visa, Mastercard, Amex) y plataformas digitales de procesamiento directo.",

    "🚚 Tiempo de envío":
      "Nuestros envíos prioritarios tardan de 2 a 5 días hábiles en llegar a la puerta de tu hogar.",

    "📦 Rastrear pedido":
      "Una vez enviado, recibirás una notificación automática con tu guía. Podrás consultar el estatus en tiempo real desde 'Mis Compras'.",

    "🔄 Devoluciones":
      "Cuentas con 30 días de garantía total protegida. El artículo debe estar sin usar y conservar sus etiquetas originales.",

    "🎁 Promociones":
      "¡Actualmente tienes cupones de envío gratis activos! Revisa la sección de ofertas en el menú de inicio para aplicarlos.",

    "☎ Contactar soporte":
      "Si requieres atención humana, nuestro soporte está activo de Lunes a Viernes de 9:00 AM a 6:00 PM vía chat integrado.",
  };

  function getCurrentTime() {
    const date = new Date();
    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  const sendQuestion = (questionText) => {
    // Evitar respuestas si el bot ya está respondiendo
    const userMessage = {
      id: Math.random().toString(),
      from: "user",
      text: questionText,
      time: getCurrentTime(),
    };

    setMessages((prev) => [...prev, userMessage]);

    // Simular un retraso natural de escritura del Bot corporativo
    setTimeout(() => {
      const botMessage = {
        id: Math.random().toString(),
        from: "bot",
        text: answers[questionText] || "Disculpa, no entendí tu solicitud. Por favor selecciona una opción válida.",
        time: getCurrentTime(),
      };
      setMessages((prev) => [...prev, botMessage]);
    }, 600);
  };

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  return (
    <SafeAreaView style={styles.container}>
      {/* HEADER CORPORATIVO */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#FFF" />
        </TouchableOpacity>

        <View style={styles.avatar}>
          <Ionicons name="hardware-chip" size={22} color="#0EA5E9" />
          <View style={styles.onlineDot} />
        </View>

        <View>
          <Text style={styles.headerTitle}>Nova IA</Text>
          <Text style={styles.onlineText}>Asistente Corporativo</Text>
        </View>
      </View>

      {/* ÁREA DE CONVERSACIÓN */}
      <ScrollView
        ref={scrollRef}
        style={styles.chatArea}
        contentContainerStyle={{ paddingVertical: 20 }}
        showsVerticalScrollIndicator={false}
      >
        {messages.map((msg) => (
          <View
            key={msg.id}
            style={[
              styles.messageRow,
              msg.from === "user" ? styles.userRow : styles.botRow,
            ]}
          >
            {msg.from === "bot" && (
              <View style={styles.miniBotAvatar}>
                <Ionicons name="hardware-chip" size={14} color="#FFF" />
              </View>
            )}

            <View
              style={[
                styles.bubble,
                msg.from === "user" ? styles.userBubble : styles.botBubble,
              ]}
            >
              <Text style={msg.from === "user" ? styles.userText : styles.botText}>
                {msg.text}
              </Text>
              <Text style={[styles.timeText, msg.from === "user" && { color: "#93C5FD" }]}>
                {msg.time}
              </Text>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* FOOTER: SELECTOR HORIZONTAL DE PREGUNTAS (ESTILO MERCADO LIBRE / AMAZON) */}
      <View style={styles.footer}>
        <Text style={styles.footerTitle}>¿En qué puedo ayudarte hoy?</Text>
        <FlatList
          data={questions}
          keyExtractor={(item) => item.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 10, paddingHorizontal: 5 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.suggestionChip}
              onPress={() => sendQuestion(item.text)}
              activeOpacity={0.7}
            >
              <Ionicons name={item.icon} size={16} color="#3483FA" style={{ marginRight: 6 }} />
              <Text style={styles.suggestionText}>{item.text}</Text>
            </TouchableOpacity>
          )}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#020617", // Consistencia Modo Oscuro Premium
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 50,
    paddingBottom: 15,
    paddingHorizontal: 20,
    backgroundColor: "#0f172a",
    borderBottomWidth: 1,
    borderColor: "#1e293b",
  },
  backBtn: {
    marginRight: 15,
    padding: 4,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#0ea5e915",
    borderWidth: 1,
    borderColor: "#0EA5E930",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    position: "relative",
  },
  onlineDot: {
    position: "absolute",
    bottom: -1,
    right: -1,
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: "#22C55E",
    borderWidth: 2,
    borderColor: "#0f172a",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#FFF",
  },
  onlineText: {
    color: "#64748B",
    fontSize: 12,
    marginTop: 2,
  },
  chatArea: {
    flex: 1,
    paddingHorizontal: 15,
  },
  messageRow: {
    flexDirection: "row",
    marginBottom: 16,
    maxWidth: "85%",
  },
  userRow: {
    alignSelf: "flex-end",
    justifyContent: "flex-end",
  },
  botRow: {
    alignSelf: "flex-start",
    justifyContent: "flex-start",
  },
  miniBotAvatar: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: "#0EA5E9",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
    alignSelf: "flex-end",
  },
  bubble: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
  },
  userBubble: {
    backgroundColor: "#3483FA", // Azul Mercado Libre oficial
    borderBottomRightRadius: 4,
  },
  botBubble: {
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#1e293b",
    borderBottomLeftRadius: 4,
  },
  userText: {
    color: "#FFF",
    fontSize: 15,
    lineHeight: 22,
  },
  botText: {
    color: "#E2E8F0",
    fontSize: 15,
    lineHeight: 22,
  },
  timeText: {
    fontSize: 10,
    color: "#64748B",
    marginTop: 6,
    alignSelf: "flex-end",
  },
  footer: {
    backgroundColor: "#0f172a",
    paddingTop: 15,
    paddingBottom: 30,
    borderTopWidth: 1,
    borderColor: "#1e293b",
  },
  footerTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#94A3B8",
    marginBottom: 12,
    marginHorizontal: 20,
  },
  suggestionChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1e293b",
    borderWidth: 1,
    borderColor: "#334155",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 50,
    marginLeft: 12,
  },
  suggestionText: {
    color: "#F1F5F9",
    fontWeight: "600",
    fontSize: 13,
  },
});