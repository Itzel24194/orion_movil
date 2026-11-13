// screens/AdminDashboardScreen.js
import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  TextInput,
  Linking,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text, Alert } from "../i18n/ui";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";

import { usePreferences } from "../context/PreferencesContext";

import {
  fetchAdminStats,
  adminListarSesiones,
  fetchSolicitudesAdmin,          // ⭐ NUEVO
  getCurrentUser,
  isAdmin,
  request,
} from "../services/api";

const { width } = Dimensions.get("window");
const CUENTA_BASE = "/api/v1/cuenta";

const RUTAS_DISPONIBLES = [
  "ManageUsers",
  "ManageCategories",
  "ManageTemporadas",
  "ManageProducts",
  "ManageBrands",
  "ManageOrders",
  "ManageCoupons",
  "GenerateCoupons",
  "ManagePromotions",
  "ManageChat",
  "AdminSolicitudes",   // ⭐ NUEVO
];

// ============================================================
// i18n
// ============================================================
const T = {
  es: {
    headerTitle: "Panel de Control ⚙️",
    headerSubtitle: "Administrador ORION",
    searchPlaceholder: "Buscar módulo...",
    sectionGeneral: "Vista General",
    statUsers: "Usuarios",
    statOrders: "Pedidos",
    statCoupons: "Cupones",
    emptyModules: "No se encontraron módulos",
    manage: "Gestionar",
    comingSoon: "Próximamente",
    openWeb: "Abrir Web",
    // alertas
    accessRestrictedTitle: "Acceso restringido",
    accessRestrictedMsg: "Esta sección es solo para administradores.",
    webOnlyTitle: "Función de Escritorio 💻",
    webOnlyMsg:
      "Para configurar envíos, pagos o ajustes complejos, ingresa a la versión web desde tu computadora.",
    understood: "Entendido",
    goToWeb: "Ir a la Web",
    moduleDevTitle: "Módulo en Desarrollo 🚧",
    moduleDevMsg: (title) =>
      `La pantalla "${title}" se está configurando para la app móvil. Pronto estará disponible.`,
    ok: "OK",
    // categorías
    catQuick: "Acciones Rápidas",
    catMarketing: "Marketing y Ventas",
    catCatalog: "Catálogo",
    catMonitor: "Monitoreo e IA",
    catConfig: "Configuración",
    // módulos (clave → {title, description, badge})
    modules: {
      orders: {
        title: "Pedidos",
        description: "Monitorear despachos, estados de envío y reclamos.",
        badge: null,
      },
      users: {
        title: "Usuarios",
        description: "Control de clientes, roles de acceso y bloqueos.",
        badge: "Activo",
      },
      products: {
        title: "Productos",
        description: "Catálogo con variantes, colores, tallas y stock.",
        badge: null,
      },
      chat: {
        title: "Soporte / Chat",
        description: "Conversaciones activas y respuestas automáticas.",
        badge: null,
      },
      notifications: {
        title: "Notificaciones",
        description: "Nuevos pedidos, cancelaciones y alertas del sistema.",
        badge: null,
      },
      // ⭐ NUEVO
      solicitudes: {
        title: "Solicitudes de clientes",
        description: "Responde devoluciones, garantías y productos defectuosos.",
        badge: null,
      },
      promotions: {
        title: "Promociones",
        description: "Banners principales y ofertas flash temporales.",
        badge: "Nuevo",
      },
      coupons: {
        title: "Cupones",
        description: "Creación de códigos de descuento (ej. ORION20).",
        badge: null,
      },
      brands: {
        title: "Marcas",
        description: "Administrar marcas asociadas a tus productos.",
        badge: null,
      },
      reviews: {
        title: "Reseñas",
        description: "Moderar reseñas de clientes y respuestas.",
        badge: null,
      },
      wallet: {
        title: "Monedero Digital",
        description: "Saldos de clientes, movimientos y ajustes.",
        badge: null,
      },
      loyalty: {
        title: "Lealtad y Puntos",
        description: "Administrar puntos, niveles y cupones masivos.",
        badge: null,
      },
      categories: {
        title: "Categorías",
        description: "Organizar, crear y editar categorías del catálogo.",
        badge: null,
      },
      temporadas: {
        title: "Temporadas",
        description: "Agrupar productos por temporada y periodos.",
        badge: null,
      },
      "sales-report": {
        title: "Ventas del Día",
        description: "Estadísticas de ingresos, gráficas y exportación.",
        badge: null,
      },
      "ml-analytics": {
        title: "Análisis y ML",
        description: "Modelos de regresión, segmentación y predicciones.",
        badge: "Pro",
      },
      fraud: {
        title: "Detección de Fraude",
        description: "Alertas de transacciones sospechosas y bloqueos.",
        badge: null,
      },
      "web-config": {
        title: "Configuración Avanzada",
        description: "Envíos, pagos y ajustes complejos (solo en Web).",
        badge: "Web",
      },
    },
  },
  en: {
    headerTitle: "Control Panel ⚙️",
    headerSubtitle: "ORION Administrator",
    searchPlaceholder: "Search modules...",
    sectionGeneral: "Overview",
    statUsers: "Users",
    statOrders: "Orders",
    statCoupons: "Coupons",
    emptyModules: "No modules found",
    manage: "Manage",
    comingSoon: "Coming soon",
    openWeb: "Open Web",
    accessRestrictedTitle: "Restricted access",
    accessRestrictedMsg: "This section is for administrators only.",
    webOnlyTitle: "Desktop Feature 💻",
    webOnlyMsg:
      "To configure shipping, payments, or complex settings, open the web version on your computer.",
    understood: "Understood",
    goToWeb: "Go to Web",
    moduleDevTitle: "Module in Development 🚧",
    moduleDevMsg: (title) =>
      `The "${title}" screen is being set up for the mobile app. Coming soon.`,
    ok: "OK",
    catQuick: "Quick Actions",
    catMarketing: "Marketing & Sales",
    catCatalog: "Catalog",
    catMonitor: "Monitoring & AI",
    catConfig: "Settings",
    modules: {
      orders: {
        title: "Orders",
        description: "Monitor shipments, delivery status, and claims.",
        badge: null,
      },
      users: {
        title: "Users",
        description: "Manage customers, access roles, and bans.",
        badge: "Active",
      },
      products: {
        title: "Products",
        description: "Catalog with variants, colors, sizes, and stock.",
        badge: null,
      },
      chat: {
        title: "Support / Chat",
        description: "Active conversations and automated replies.",
        badge: null,
      },
      notifications: {
        title: "Notifications",
        description: "New orders, cancellations, and system alerts.",
        badge: null,
      },
      // ⭐ NUEVO
      solicitudes: {
        title: "Customer requests",
        description: "Reply to returns, warranties, and defective products.",
        badge: null,
      },
      promotions: {
        title: "Promotions",
        description: "Main banners and temporary flash deals.",
        badge: "New",
      },
      coupons: {
        title: "Coupons",
        description: "Create discount codes (e.g. ORION20).",
        badge: null,
      },
      brands: {
        title: "Brands",
        description: "Manage brands associated with your products.",
        badge: null,
      },
      reviews: {
        title: "Reviews",
        description: "Moderate customer reviews and replies.",
        badge: null,
      },
      wallet: {
        title: "Digital Wallet",
        description: "Customer balances, movements, and adjustments.",
        badge: null,
      },
      loyalty: {
        title: "Loyalty & Points",
        description: "Manage points, tiers, and bulk coupons.",
        badge: null,
      },
      categories: {
        title: "Categories",
        description: "Organize, create, and edit catalog categories.",
        badge: null,
      },
      temporadas: {
        title: "Seasons",
        description: "Group products by season and periods.",
        badge: null,
      },
      "sales-report": {
        title: "Daily Sales",
        description: "Revenue stats, charts, and exports.",
        badge: null,
      },
      "ml-analytics": {
        title: "Analytics & ML",
        description: "Regression models, segmentation, and predictions.",
        badge: "Pro",
      },
      fraud: {
        title: "Fraud Detection",
        description: "Suspicious transaction alerts and blocks.",
        badge: null,
      },
      "web-config": {
        title: "Advanced Settings",
        description: "Shipping, payments, and complex settings (web only).",
        badge: "Web",
      },
    },
  },
};

const getLang = (language) => {
  const l = String(language || "es").toLowerCase();
  return l.startsWith("en") ? "en" : "es";
};

// Los módulos base solo tienen metadatos (icono, color, ruta, key, categoría)
// Los textos (title/description/badge) vienen del diccionario T[lang].modules[key]
const BASE_MODULES = [
  { id: "orders", key: "orders", icon: "package-variant-closed", color: "#10b981", route: "ManageOrders", categoryKey: "catQuick" },
  { id: "users", key: "users", icon: "account-cog", color: "#3b82f6", route: "ManageUsers", categoryKey: "catQuick" },
  { id: "products", key: "products", icon: "package-variant", color: "#a855f7", route: "ManageProducts", categoryKey: "catQuick" },
  // ⭐ NUEVO: Solicitudes de clientes
  { id: "solicitudes", key: "solicitudes", icon: "inbox", color: "#7C3AED", route: "AdminSolicitudes", categoryKey: "catQuick" },
  { id: "chat", key: "chat", icon: "message-text", color: "#14b8a6", route: "ManageChat", categoryKey: "catQuick" },
  { id: "notifications", key: "notifications", icon: "bell-ring", color: "#f43f5e", route: "Notifications", categoryKey: "catQuick" },
  { id: "promotions", key: "promotions", icon: "lightning-bolt", color: "#ef4444", route: "ManagePromotions", categoryKey: "catMarketing" },
  { id: "coupons", key: "coupons", icon: "ticket-percent", color: "#f59e0b", route: "ManageCoupons", categoryKey: "catMarketing" },
  { id: "brands", key: "brands", icon: "tag-multiple", color: "#ec4899", route: "ManageBrands", categoryKey: "catMarketing" },
  { id: "reviews", key: "reviews", icon: "comment-text-multiple", color: "#eab308", route: "ManageReviews", categoryKey: "catMarketing" },
  { id: "wallet", key: "wallet", icon: "wallet", color: "#059669", route: "ManageWallet", categoryKey: "catMarketing" },
  { id: "loyalty", key: "loyalty", icon: "star-circle", color: "#d97706", route: "ManageLoyalty", categoryKey: "catMarketing" },
  { id: "categories", key: "categories", icon: "folder-table", color: "#8b5cf6", route: "ManageCategories", categoryKey: "catCatalog" },
  { id: "temporadas", key: "temporadas", icon: "calendar-month", color: "#06b6d4", route: "ManageTemporadas", categoryKey: "catCatalog" },
  { id: "sales-report", key: "sales-report", icon: "chart-line", color: "#0284c7", route: "SalesReport", categoryKey: "catMonitor" },
  { id: "ml-analytics", key: "ml-analytics", icon: "brain", color: "#7C3AED", route: "AnalyticsML", categoryKey: "catMonitor" },
  { id: "fraud", key: "fraud", icon: "shield-alert", color: "#dc2626", route: "FraudDetection", categoryKey: "catMonitor" },
  { id: "web-config", key: "web-config", icon: "monitor-dashboard", color: "#64748B", route: "WEB_ONLY", categoryKey: "catConfig" },
];

export default function AdminDashboardScreen({ navigation }) {
  const { language } = usePreferences() || {};
  const t = useMemo(() => T[getLang(language)], [language]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [autorizado, setAutorizado] = useState(false);
  const [notifNoLeidas, setNotifNoLeidas] = useState(0);

  // ⭐ NUEVO: conteo de solicitudes pendientes para badge
  const [solicitudesPendientes, setSolicitudesPendientes] = useState(0);

  const [stats, setStats] = useState({
    usersCount: "0",
    ordersToday: "0",
    couponsCount: "0",
    pendingOrdersCount: "0",
    chatActivas: 0,
  });

  // ⭐ GUARD: verificar que el usuario sea admin antes de cargar datos
  useEffect(() => {
    let alive = true;
    (async () => {
      const user = await getCurrentUser();
      if (!isAdmin(user)) {
        if (!alive) return;
        Alert.alert(
          t.accessRestrictedTitle,
          t.accessRestrictedMsg,
          [{ text: t.ok, onPress: () => navigation.replace("Home") }]
        );
        return;
      }
      if (alive) setAutorizado(true);
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation]);

  // ⭐ Contar notificaciones no leídas del admin
  const cargarNotifNoLeidas = useCallback(async () => {
    try {
      const data = await request(`${CUENTA_BASE}/notificaciones`);
      const lista =
        (Array.isArray(data?.notificaciones) && data.notificaciones) ||
        (Array.isArray(data?.data) && data.data) ||
        (Array.isArray(data) && data) ||
        [];
      const noLeidas = lista.filter((n) => !(n.leida ?? n.read ?? false)).length;
      setNotifNoLeidas(noLeidas);
    } catch {
      // silencioso
    }
  }, []);

  // ⭐ NUEVO: contar solicitudes pendientes
  const cargarSolicitudesPendientes = useCallback(async () => {
    try {
      const lista = await fetchSolicitudesAdmin({ estado: 'pendiente' });
      setSolicitudesPendientes(Array.isArray(lista) ? lista.length : 0);
    } catch {
      // silencioso
    }
  }, []);

  const loadData = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);

    try {
      const s = await fetchAdminStats().catch(() => ({}));

      const users = s.usersCount || 0;
      const orders = s.ordersToday || 0;
      const coupons = s.couponsCount || 0;
      const pending = s.pendingOrders || 0;

      let chatActivas = 0;
      try {
        const sesiones = await adminListarSesiones({ filtro: "activas" });
        chatActivas = Array.isArray(sesiones) ? sesiones.length : 0;
      } catch (err) {
        console.log("Chat sesiones no disponibles:", err?.message);
      }

      setStats({
        usersCount: String(users),
        ordersToday: String(orders),
        couponsCount: String(coupons),
        pendingOrdersCount: pending > 0 ? String(pending) : null,
        chatActivas,
      });

      await cargarNotifNoLeidas();
      await cargarSolicitudesPendientes();   // ⭐ NUEVO
    } catch (error) {
      console.log("⚠️ Error general al cargar stats:", error?.message || error);
    } finally {
      if (!isRefresh) setLoading(false);
      setRefreshing(false);
    }
  }, [cargarNotifNoLeidas, cargarSolicitudesPendientes]);

  useEffect(() => {
    if (!autorizado) return;
    let alive = true;

    (async () => {
      await loadData(false);
    })();

    const timer = setInterval(() => {
      if (alive) loadData(true);
    }, 30000);

    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [autorizado, loadData]);

  // ⭐ Refrescar al volver a esta pantalla
  useFocusEffect(
    useCallback(() => {
      if (autorizado) {
        cargarNotifNoLeidas();
        cargarSolicitudesPendientes();   // ⭐ NUEVO
      }
    }, [autorizado, cargarNotifNoLeidas, cargarSolicitudesPendientes])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData(true);
  }, [loadData]);

  // ⭐ Módulos con textos traducidos + badges dinámicos
  const adminModules = useMemo(() => {
    return BASE_MODULES.map((m) => {
      const dict = t.modules[m.key] || {};
      let badge = dict.badge ?? null;

      // badges dinámicos
      if (m.key === "orders") {
        badge = stats.pendingOrdersCount;
      } else if (m.key === "chat") {
        badge = stats.chatActivas > 0 ? `${stats.chatActivas}` : null;
      } else if (m.key === "notifications") {
        badge = notifNoLeidas > 0 ? `${notifNoLeidas}` : null;
      } else if (m.key === "solicitudes") {
        // ⭐ NUEVO
        badge = solicitudesPendientes > 0 ? `${solicitudesPendientes}` : null;
      }

      return {
        id: m.id,
        title: dict.title || m.key,
        description: dict.description || "",
        icon: m.icon,
        badge,
        color: m.color,
        route: m.route,
        category: t[m.categoryKey] || t.catQuick,
      };
    });
  }, [t, stats.pendingOrdersCount, stats.chatActivas, notifNoLeidas, solicitudesPendientes]);

  const handleModulePress = (route, title) => {
    if (route === "WEB_ONLY") {
      Alert.alert(
        t.webOnlyTitle,
        t.webOnlyMsg,
        [
          { text: t.understood, style: "cancel" },
          { text: t.goToWeb, onPress: () => Linking.openURL("https://orion.com/admin") },
        ]
      );
      return;
    }

    if (RUTAS_DISPONIBLES.includes(route)) {
      navigation.navigate(route);
    } else if (route === "Notifications") {
      navigation.navigate("Notifications");
    } else {
      Alert.alert(t.moduleDevTitle, t.moduleDevMsg(title));
    }
  };

  const statsData = useMemo(
    () => [
      { id: "1", label: t.statUsers, count: stats.usersCount, icon: "people", color: "#3b82f6" },
      { id: "2", label: t.statOrders, count: stats.ordersToday, icon: "receipt", color: "#10b981" },
      { id: "3", label: t.statCoupons, count: stats.couponsCount, icon: "ticket", color: "#f59e0b" },
    ],
    [t, stats.usersCount, stats.ordersToday, stats.couponsCount]
  );

  const filteredModules = useMemo(() => {
    if (!searchQuery) return adminModules;
    const query = searchQuery.toLowerCase();
    return adminModules.filter(
      (m) =>
        m.title.toLowerCase().includes(query) ||
        m.description.toLowerCase().includes(query)
    );
  }, [searchQuery, adminModules]);

  const groupedModules = useMemo(() => {
    return filteredModules.reduce((acc, module) => {
      const cat = module.category || "Otros";
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(module);
      return acc;
    }, {});
  }, [filteredModules]);

  if (!autorizado || loading) {
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
          <Text style={styles.headerTitle}>{t.headerTitle}</Text>
          <Text style={styles.headerSubtitle}>{t.headerSubtitle}</Text>
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <TouchableOpacity
            style={styles.notifBtn}
            onPress={() => navigation.navigate("Notifications")}
            activeOpacity={0.7}
          >
            <Ionicons name="notifications-outline" size={22} color="#FFF" />
            {notifNoLeidas > 0 && (
              <View style={styles.notifBadge}>
                <Text style={styles.notifBadgeText}>
                  {notifNoLeidas > 99 ? "99+" : notifNoLeidas}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.profileBtn}
            onPress={() => navigation.navigate("AdminProfile")}
            activeOpacity={0.7}
          >
            <Ionicons name="person-circle" size={35} color="#7C3AED" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        style={styles.scrollArea}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#7C3AED"
            colors={["#7C3AED"]}
            progressBackgroundColor="#0f172a"
          />
        }
      >
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#64748B" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder={t.searchPlaceholder}
            placeholderTextColor="#64748B"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {!searchQuery && (
          <>
            <Text style={styles.sectionTitle}>{t.sectionGeneral}</Text>
            <View style={styles.statsRow}>
              {statsData.map((item) => (
                <View key={item.id} style={styles.statCard}>
                  <View
                    style={[
                      styles.statIconContainer,
                      { backgroundColor: `${item.color}15` },
                    ]}
                  >
                    <Ionicons name={item.icon} size={20} color={item.color} />
                  </View>
                  <Text style={styles.statCount}>{item.count}</Text>
                  <Text style={styles.statLabel}>{item.label}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {Object.entries(groupedModules).map(([category, modules]) => (
          <View key={category}>
            <Text style={styles.sectionTitle}>{category}</Text>
            <View style={styles.modulesContainer}>
              {modules.map((item) => {
                const disponible =
                  RUTAS_DISPONIBLES.includes(item.route) ||
                  item.route === "Notifications";
                const esSoloWeb = item.route === "WEB_ONLY";

                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.moduleCard,
                      (!disponible && !esSoloWeb) && styles.moduleCardDisabled,
                    ]}
                    onPress={() => handleModulePress(item.route, item.title)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.moduleHeader}>
                      <View
                        style={[
                          styles.moduleIconContainer,
                          { backgroundColor: `${item.color}15` },
                        ]}
                      >
                        <MaterialCommunityIcons
                          name={item.icon}
                          size={24}
                          color={item.color}
                        />
                      </View>
                      {item.badge && (
                        <View
                          style={[
                            styles.badge,
                            { backgroundColor: `${item.color}20` },
                          ]}
                        >
                          <Text style={[styles.badgeText, { color: item.color }]}>
                            {item.badge}
                          </Text>
                        </View>
                      )}
                    </View>

                    <Text style={styles.moduleTitle}>{item.title}</Text>
                    <Text style={styles.moduleDescription}>{item.description}</Text>

                    <View style={styles.cardFooter}>
                      <Text style={[styles.manageText, { color: item.color }]}>
                        {esSoloWeb ? t.openWeb : (disponible ? t.manage : t.comingSoon)}
                      </Text>
                      <Ionicons name="arrow-forward" size={14} color={item.color} />
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ))}

        {filteredModules.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="search-outline" size={40} color="#334155" />
            <Text style={styles.emptyText}>{t.emptyModules}</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#020617" },
  loadingContainer: { justifyContent: "center", alignItems: "center" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    backgroundColor: "#0f172a",
    borderBottomWidth: 1,
    borderColor: "#1e293b",
  },
  headerTitle: { color: "#FFF", fontSize: 22, fontWeight: "bold" },
  headerSubtitle: { color: "#64748B", fontSize: 13, marginTop: 2 },

  notifBtn: {
    padding: 6,
    backgroundColor: "#7C3AED10",
    borderRadius: 50,
    borderWidth: 1,
    borderColor: "#7C3AED30",
    position: "relative",
  },
  notifBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: "#F43F5E",
    alignItems: "center",
    justifyContent: "center",
  },
  notifBadgeText: {
    color: "#FFF",
    fontSize: 9,
    fontWeight: "900",
  },

  profileBtn: {
    padding: 2,
    backgroundColor: "#7C3AED10",
    borderRadius: 50,
    borderWidth: 1,
    borderColor: "#7C3AED30",
  },
  scrollArea: { flex: 1, paddingHorizontal: 20 },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#1e293b",
    borderRadius: 12,
    marginTop: 20,
    paddingHorizontal: 12,
    height: 45,
  },
  searchIcon: { marginRight: 8 },
  searchInput: {
    flex: 1,
    color: "#FFF",
    fontSize: 15,
    height: "100%",
  },
  sectionTitle: {
    color: "#94A3B8",
    fontSize: 13,
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: 25,
    marginBottom: 15,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#1e293b",
    borderRadius: 16,
    padding: 15,
    alignItems: "flex-start",
  },
  statIconContainer: { padding: 8, borderRadius: 10, marginBottom: 12 },
  statCount: { color: "#FFF", fontSize: 18, fontWeight: "bold" },
  statLabel: { color: "#64748B", fontSize: 12, marginTop: 2 },
  modulesContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    paddingBottom: 10,
  },
  moduleCard: {
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#1e293b",
    width: width * 0.43,
    borderRadius: 20,
    padding: 16,
    marginBottom: 15,
    justifyContent: "space-between",
  },
  moduleCardDisabled: { opacity: 0.6 },
  moduleHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 15,
  },
  moduleIconContainer: { padding: 10, borderRadius: 14 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 10, fontWeight: "bold" },
  moduleTitle: {
    color: "#FFF",
    fontSize: 15,
    fontWeight: "bold",
    lineHeight: 20,
  },
  moduleDescription: {
    color: "#64748B",
    fontSize: 11,
    marginTop: 6,
    lineHeight: 16,
    minHeight: 32,
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 15,
    gap: 4,
  },
  manageText: { fontSize: 12, fontWeight: "bold" },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
  },
  emptyText: {
    color: "#64748B",
    marginTop: 10,
    fontSize: 15,
  },
});