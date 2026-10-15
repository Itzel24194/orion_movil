import React, { useState, useEffect } from "react";
import { View, StyleSheet, ScrollView, TouchableOpacity, Dimensions, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, Alert } from '../i18n/ui';
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

import { fetchAdminStats } from "../services/api";

const { width } = Dimensions.get("window");

// ⚠️ Rutas que SÍ están registradas en AppNavigator.js
const RUTAS_DISPONIBLES = [
  "ManageUsers",
  "ManageCategories",
  "ManageTemporadas",
  "ManageProducts",
  "ManageBrands",
  // "ManageOrders",
  // "ManageCoupons",
  // "ManagePromotions",
];

export default function AdminDashboardScreen({ navigation }) {
  const [loading, setLoading] = useState(true);

  const [stats, setStats] = useState({
    usersCount: "0",
    ordersToday: "0",
    couponsCount: "0",
    pendingOrdersCount: "0"
  });

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const s = await fetchAdminStats();
        if (!alive) return;
        setStats({
          usersCount: String(s.usersCount),
          ordersToday: String(s.ordersToday),
          couponsCount: String(s.couponsCount),
          pendingOrdersCount: s.pendingOrders > 0 ? `${s.pendingOrders} Pendientes` : "Al día",
        });
      } catch (error) {
        console.log("⚠️ Error al cargar stats admin:", error?.message || error);
      } finally {
        if (alive) setLoading(false);
      }
    };
    load();
    const timer = setInterval(load, 30000);
    return () => { alive = false; clearInterval(timer); };
  }, []);

  // Los 8 módulos de gestión
  const adminModules = [
    {
      id: "users",
      title: "Gestión de Usuarios",
      description: "Control de clientes, roles de acceso y bloqueos.",
      icon: "account-cog",
      badge: "Activo",
      color: "#3b82f6",
      route: "ManageUsers",
    },
    {
      id: "categories",
      title: "Gestión de Categorías",
      description: "Organizar, crear y editar categorías del catálogo.",
      icon: "folder-table",
      badge: null,
      color: "#8b5cf6",
      route: "ManageCategories",
    },
    {
      id: "temporadas",
      title: "Gestión de Temporadas",
      description: "Agrupar productos por temporada y periodos.",
      icon: "calendar-month",
      badge: null,
      color: "#06b6d4",
      route: "ManageTemporadas",
    },
    {
      id: "products",
      title: "Gestión de Productos",
      description: "Catálogo con variantes, colores, tallas y stock.",
      icon: "package-variant",
      badge: null,
      color: "#a855f7",
      route: "ManageProducts",
    },
    {
      id: "brands",
      title: "Gestión de Marcas",
      description: "Administrar marcas asociadas a tus productos.",
      icon: "tag-multiple",
      badge: null,
      color: "#ec4899",
      route: "ManageBrands",
    },
    {
      id: "orders",
      title: "Gestión de Pedidos",
      description: "Monitorear despachos, estados de envío y reclamos.",
      icon: "package-variant-closed",
      badge: stats.pendingOrdersCount,
      color: "#10b981",
      route: "ManageOrders",
    },
    {
      id: "coupons",
      title: "Gestión de Cupones",
      description: "Creación de códigos de descuento (ej. ORION20).",
      icon: "ticket-percent",
      badge: null,
      color: "#f59e0b",
      route: "ManageCoupons",
    },
    {
      id: "promotions",
      title: "Gestión de Promociones",
      description: "Banners principales y ofertas flash temporales.",
      icon: "lightning-bolt",
      badge: "Nuevo",
      color: "#ef4444",
      route: "ManagePromotions",
    },
  ];

  const handleModulePress = (route, title) => {
    if (!route) return;

    if (RUTAS_DISPONIBLES.includes(route)) {
      navigation.navigate(route);
    } else {
      Alert.alert(
        "Módulo en Desarrollo 🚧",
        `La pantalla "${title}" se está configurando. Pronto estará disponible.`
      );
    }
  };

  const statsData = [
    { id: "1", label: "Usuarios", count: stats.usersCount, icon: "people", color: "#3b82f6" },
    { id: "2", label: "Pedidos Hoy", count: stats.ordersToday, icon: "receipt", color: "#10b981" },
    { id: "3", label: "Cupones Activos", count: stats.couponsCount, icon: "ticket", color: "#f59e0b" },
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
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Panel de Control ⚙️</Text>
          <Text style={styles.headerSubtitle}>Entorno de Administrador ORION</Text>
        </View>

        <TouchableOpacity
          style={styles.profileBtn}
          onPress={() => navigation.navigate("AdminProfile")}
          activeOpacity={0.7}
        >
          <Ionicons name="person-circle" size={35} color="#7C3AED" />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollArea}>
        <Text style={styles.sectionTitle}>Vista General</Text>
        <View style={styles.statsRow}>
          {statsData.map((item) => (
            <View key={item.id} style={styles.statCard}>
              <View style={[styles.statIconContainer, { backgroundColor: `${item.color}15` }]}>
                <Ionicons name={item.icon} size={20} color={item.color} />
              </View>
              <Text style={styles.statCount}>{item.count}</Text>
              <Text style={styles.statLabel}>{item.label}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Módulos Operativos</Text>
        <View style={styles.modulesContainer}>
          {adminModules.map((item) => {
            const disponible = RUTAS_DISPONIBLES.includes(item.route);
            return (
              <TouchableOpacity
                key={item.id}
                style={[styles.moduleCard, !disponible && styles.moduleCardDisabled]}
                onPress={() => handleModulePress(item.route, item.title)}
                activeOpacity={0.7}
              >
                <View style={styles.moduleHeader}>
                  <View style={[styles.moduleIconContainer, { backgroundColor: `${item.color}15` }]}>
                    <MaterialCommunityIcons name={item.icon} size={24} color={item.color} />
                  </View>
                  {item.badge && (
                    <View style={[styles.badge, { backgroundColor: `${item.color}20` }]}>
                      <Text style={[styles.badgeText, { color: item.color }]}>{item.badge}</Text>
                    </View>
                  )}
                </View>

                <Text style={styles.moduleTitle}>{item.title}</Text>
                <Text style={styles.moduleDescription}>{item.description}</Text>

                <View style={styles.cardFooter}>
                  <Text style={[styles.manageText, { color: item.color }]}>
                    {disponible ? "Gestionar" : "Próximamente"}
                  </Text>
                  <Ionicons name="arrow-forward" size={14} color={item.color} />
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#020617" },
  loadingContainer: { justifyContent: "center", alignItems: "center" },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingTop: 50, paddingBottom: 20, paddingHorizontal: 20,
    backgroundColor: "#0f172a", borderBottomWidth: 1, borderColor: "#1e293b",
  },
  headerTitle: { color: "#FFF", fontSize: 22, fontWeight: "bold" },
  headerSubtitle: { color: "#64748B", fontSize: 13, marginTop: 2 },
  profileBtn: {
    padding: 2, backgroundColor: "#7C3AED10", borderRadius: 50,
    borderWidth: 1, borderColor: "#7C3AED30",
  },
  scrollArea: { flex: 1, paddingHorizontal: 20 },
  sectionTitle: {
    color: "#94A3B8", fontSize: 14, fontWeight: "bold",
    textTransform: "uppercase", letterSpacing: 1,
    marginTop: 25, marginBottom: 15,
  },
  statsRow: { flexDirection: "row", justifyContent: "space-between", gap: 10 },
  statCard: {
    flex: 1, backgroundColor: "#0f172a", borderWidth: 1, borderColor: "#1e293b",
    borderRadius: 16, padding: 15, alignItems: "flex-start",
  },
  statIconContainer: { padding: 8, borderRadius: 10, marginBottom: 12 },
  statCount: { color: "#FFF", fontSize: 18, fontWeight: "bold" },
  statLabel: { color: "#64748B", fontSize: 12, marginTop: 2 },
  modulesContainer: {
    flexDirection: "row", flexWrap: "wrap",
    justifyContent: "space-between", paddingBottom: 40,
  },
  moduleCard: {
    backgroundColor: "#0f172a", borderWidth: 1, borderColor: "#1e293b",
    width: width * 0.43, borderRadius: 20, padding: 16, marginBottom: 15,
    justifyContent: "space-between",
  },
  moduleCardDisabled: { opacity: 0.6 },
  moduleHeader: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "flex-start", marginBottom: 15,
  },
  moduleIconContainer: { padding: 10, borderRadius: 14 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 10, fontWeight: "bold" },
  moduleTitle: { color: "#FFF", fontSize: 15, fontWeight: "bold", lineHeight: 20 },
  moduleDescription: {
    color: "#64748B", fontSize: 11, marginTop: 6,
    lineHeight: 16, minHeight: 32,
  },
  cardFooter: { flexDirection: "row", alignItems: "center", marginTop: 15, gap: 4 },
  manageText: { fontSize: 12, fontWeight: "bold" },
});