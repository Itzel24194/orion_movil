// navigation/AppNavigator.js
import React, { useEffect, useState } from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { usePreferences } from "../context/PreferencesContext";
import { getCurrentUser, isAdmin } from "../services/api";

// ================================================================
// PANTALLAS — ADMIN
// ================================================================
import AdminDashboardScreen from "../screens/AdminDashboardScreen";
import AdminProfileScreen from "../screens/AdminProfileScreen";
import CrudScreen from "../screens/CrudScreen";
import ManageUsers from "../screens/ManageUsers";
import ManageCategoriesScreen from "../screens/ManageCategoriesScreen";
import ManageTemporadasScreen from "../screens/ManageTemporadasScreen";
import ManageProductsScreen from "../screens/ManageProductsScreen";
import ManageBrandsScreen from "../screens/ManageBrandsScreen";
import ManageOrdersScreen from "../screens/ManageOrdersScreen";
import ManageCouponsScreen from "../screens/ManageCouponsScreen";
import GenerateCouponsScreen from "../screens/GenerateCouponsScreen";
import ManagePromotionsScreen from "../screens/ManagePromotionsScreen";
import GeneratePromotionsScreen from "../screens/GeneratePromotionsScreen";

import AdminSolicitudesScreen from "../screens/AdminSolicitudesScreen";

//  OPTATIVAS (se cargan solo si existen)
let SalesReportScreen, AnalyticsMLScreen, FraudDetectionScreen;
let ManageReviewsScreen, ManageWalletScreen, ManageLoyaltyScreen, ManageChatScreen;
try { SalesReportScreen = require("../screens/SalesReportScreen").default; } catch {}
try { AnalyticsMLScreen = require("../screens/AnalyticsMLScreen").default; } catch {}
try { FraudDetectionScreen = require("../screens/FraudDetectionScreen").default; } catch {}
try { ManageReviewsScreen = require("../screens/ManageReviewsScreen").default; } catch {}
try { ManageWalletScreen = require("../screens/ManageWalletScreen").default; } catch {}
try { ManageLoyaltyScreen = require("../screens/ManageLoyaltyScreen").default; } catch {}
try { ManageChatScreen = require("../screens/ManageChatScreen").default; } catch {}

// ================================================================
// PANTALLAS — CLIENTE
// ================================================================
import SplashScreen from "../screens/SplashScreen";
import LoginScreen from "../screens/LoginScreen";
import RegisterScreen from "../screens/RegisterScreen";
import HomeScreen from "../screens/HomeScreen";
import CategoriesScreen from "../screens/CategoriesScreen";
import ProductsScreen from "../screens/ProductsScreen";
import ProductDetailScreen from "../screens/ProductDetailScreen";
import CartScreen from "../screens/CartScreen";
import CheckoutScreen from "../screens/CheckoutScreen";
import OrdersScreen from "../screens/OrdersScreen";
import OrderDetailScreen from "../screens/OrderDetailScreen";
import FavoritesScreen from "../screens/FavoritesScreen";
import ProfileScreen from "../screens/ProfileScreen";
import SecurityAndAccessScreen from "../screens/SecurityAndAccessScreen";
import VideosScreen from "../screens/VideosScreen";
import ChatBotScreen from "../screens/ChatBotScreen";
import TryOnScreen from "../screens/TryOnScreen";
import TryOnHistoryScreen from "../screens/TryOnHistoryScreen";

// ⭐ NUEVAS PANTALLAS CLIENTE
import PaymentMethodsScreen from "../screens/PaymentMethodsScreen";
import AddressesScreen from "../screens/AddressesScreen";
import NotificationsScreen from "../screens/NotificationsScreen";
import SupportScreen from "../screens/SupportScreen";

// ⭐⭐ SOLICITUDES (NUEVO — para la actividad de sincronización)
import SolicitudesScreen from "../screens/SolicitudesScreen";
import SolicitudDetalleScreen from "../screens/SolicitudDetalleScreen";
import NuevaSolicitudScreen from "../screens/NuevaSolicitudScreen";

// ⭐ PANTALLAS DEL PERFIL (opcionales: si no existen, ComingSoon)
let ReturnsScreen, WalletScreen, WalletCardScreen, BillingScreen, LoyaltyScreen;
let PersonalDataScreen, InterestsScreen, PrivacyScreen, ContactScreen;
let ForgotPasswordScreen;

try { ReturnsScreen = require("../screens/ReturnsScreen").default; } catch {}
try { WalletScreen = require("../screens/WalletScreen").default; } catch {}
try { WalletCardScreen = require("../screens/WalletCardScreen").default; } catch {}
try { BillingScreen = require("../screens/BillingScreen").default; } catch {}
try { LoyaltyScreen = require("../screens/LoyaltyScreen").default; } catch {}
try { PersonalDataScreen = require("../screens/PersonalDataScreen").default; } catch {}
try { InterestsScreen = require("../screens/InterestsScreen").default; } catch {}
try { PrivacyScreen = require("../screens/PrivacyScreen").default; } catch {}
try { ContactScreen = require("../screens/ContactScreen").default; } catch {}
try { ForgotPasswordScreen = require("../screens/ForgotPasswordScreen").default; } catch {}

const Stack = createNativeStackNavigator();

// ================================================================
// 🛡️ AdminGuard — SOLO para pantallas de admin
// ================================================================
function AdminGuard(Component) {
  return function GuardedAdminScreen(props) {
    const [estado, setEstado] = useState("verificando");

    useEffect(() => {
      let alive = true;
      (async () => {
        try {
          const user = await getCurrentUser();
          if (!alive) return;

          if (isAdmin(user)) {
            setEstado("ok");
          } else {
            const canGoHome = props.navigation.canGoBack?.() ?? false;
            if (canGoHome) {
              props.navigation.replace("Home");
            } else {
              props.navigation.replace("Login");
            }
          }
        } catch {
          if (!alive) return;
          props.navigation.replace("Login");
        }
      })();
      return () => { alive = false; };
    }, [props.navigation]);

    if (estado === "verificando") {
      return (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#020617" }}>
          <ActivityIndicator size="large" color="#7C3AED" />
        </View>
      );
    }

    return <Component {...props} />;
  };
}

// ================================================================
// Fallback para pantallas que aún no existen
// ================================================================
function ComingSoonScreen() {
  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 24, backgroundColor: "#020617" }}>
      <Text style={{ fontSize: 16, color: "#94A3B8", textAlign: "center" }}>
        Módulo en construcción
      </Text>
    </View>
  );
}

const wrapAdmin = (Comp) => AdminGuard(Comp || ComingSoonScreen);
const wrapOptional = (Comp) => Comp || ComingSoonScreen;

export default function AppNavigator() {
  const { t } = usePreferences();

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {/* ==================== AUTH / SPLASH ==================== */}
      <Stack.Screen name="Splash" component={SplashScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen
        name="ForgotPassword"
        component={wrapOptional(ForgotPasswordScreen)}
      />

      {/* ==================== CLIENTE (sin guards) ==================== */}
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="Categories" component={CategoriesScreen} />
      <Stack.Screen name="Products" component={ProductsScreen} />
      <Stack.Screen name="ProductDetail" component={ProductDetailScreen} />
      <Stack.Screen name="Cart" component={CartScreen} />
      <Stack.Screen name="Checkout" component={CheckoutScreen} />
      <Stack.Screen name="Orders" component={OrdersScreen} />
      <Stack.Screen name="OrderDetail" component={OrderDetailScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="SecurityAndAccess" component={SecurityAndAccessScreen} />
      <Stack.Screen name="Videos" component={VideosScreen} />
      <Stack.Screen name="ChatBot" component={ChatBotScreen} />
      <Stack.Screen name="TryOn" component={TryOnScreen} />
      <Stack.Screen name="TryOnHistory" component={TryOnHistoryScreen} />

      {/* ⭐ PANTALLAS CLIENTE */}
      <Stack.Screen
        name="Favorites"
        component={FavoritesScreen}
        options={{ title: "Favoritos" }}
      />
      <Stack.Screen
        name="PaymentMethods"
        component={PaymentMethodsScreen}
        options={{ title: "Métodos de Pago" }}
      />
      <Stack.Screen
        name="Addresses"
        component={AddressesScreen}
        options={{ title: "Direcciones" }}
      />
      <Stack.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{ title: "Notificaciones" }}
      />
      <Stack.Screen
        name="Support"
        component={SupportScreen}
        options={{ title: "Ayuda y Soporte" }}
      />

      {/* ================================================================
          ⭐⭐ SOLICITUDES (CLIENTE)
          ================================================================ */}
      <Stack.Screen
        name="Solicitudes"
        component={SolicitudesScreen}
        options={{ title: "Mis Solicitudes" }}
      />
      <Stack.Screen
        name="SolicitudDetalle"
        component={SolicitudDetalleScreen}
        options={{ title: "Detalle de Solicitud" }}
      />
      <Stack.Screen
        name="NuevaSolicitud"
        component={NuevaSolicitudScreen}
        options={{ title: "Nueva Solicitud" }}
      />

      {/* ==================== PANTALLAS DEL PERFIL ==================== */}
      <Stack.Screen
        name="Returns"
        component={wrapOptional(ReturnsScreen)}
        options={{ title: "Devoluciones" }}
      />
      <Stack.Screen
        name="Wallet"
        component={wrapOptional(WalletScreen)}
        options={{ title: "Monedero Digital" }}
      />
      <Stack.Screen
        name="WalletCard"
        component={wrapOptional(WalletCardScreen)}
        options={{ title: "Mi Cartera" }}
      />
      <Stack.Screen
        name="Billing"
        component={wrapOptional(BillingScreen)}
        options={{ title: "Facturación" }}
      />
      <Stack.Screen
        name="Loyalty"
        component={wrapOptional(LoyaltyScreen)}
        options={{ title: "Cliente Consentido" }}
      />

      {/* ⭐ NUEVAS: Datos Personales, Intereses, Privacidad */}
      <Stack.Screen
        name="PersonalData"
        component={wrapOptional(PersonalDataScreen)}
        options={{ title: "Datos Personales" }}
      />
      <Stack.Screen
        name="Interests"
        component={wrapOptional(InterestsScreen)}
        options={{ title: "Intereses" }}
      />
      <Stack.Screen
        name="Privacy"
        component={wrapOptional(PrivacyScreen)}
        options={{ title: "Privacidad" }}
      />
      <Stack.Screen
        name="Contact"
        component={wrapOptional(ContactScreen)}
        options={{ title: "Contacto" }}
      />

      {/* ==================== ADMIN ==================== */}
      <Stack.Screen
        name="AdminProfile"
        component={wrapAdmin(AdminProfileScreen)}
        options={{ animation: "slide_from_right" }}
      />
      <Stack.Screen
        name="AdminDashboard"
        component={wrapAdmin(AdminDashboardScreen)}
        options={{ title: t("Panel de Control") }}
      />
      <Stack.Screen name="Crud" component={wrapAdmin(CrudScreen)} />
      <Stack.Screen name="ManageUsers" component={wrapAdmin(ManageUsers)} />
      <Stack.Screen name="ManageCategories" component={wrapAdmin(ManageCategoriesScreen)} />
      <Stack.Screen name="ManageTemporadas" component={wrapAdmin(ManageTemporadasScreen)} />
      <Stack.Screen name="ManageProducts" component={wrapAdmin(ManageProductsScreen)} />
      <Stack.Screen name="ManageBrands" component={wrapAdmin(ManageBrandsScreen)} />
      <Stack.Screen
        name="ManageOrders"
        component={wrapAdmin(ManageOrdersScreen)}
        options={{ headerShown: false, animation: "slide_from_right" }}
      />
      <Stack.Screen
        name="ManageCoupons"
        component={wrapAdmin(ManageCouponsScreen)}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="GenerateCoupons"
        component={wrapAdmin(GenerateCouponsScreen)}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="ManagePromotions"
        component={wrapAdmin(ManagePromotionsScreen)}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="GeneratePromotions"
        component={wrapAdmin(GeneratePromotionsScreen)}
        options={{ headerShown: false }}
      />

      {/*Solicitudes de clientes (NUEVO) */}
      <Stack.Screen
        name="AdminSolicitudes"
        component={wrapAdmin(AdminSolicitudesScreen)}
        options={{ headerShown: false, animation: "slide_from_right" }}
      />

      {/* Opcionales del AdminDashboard */}
      <Stack.Screen
        name="SalesReport"
        component={wrapAdmin(SalesReportScreen)}
        options={{ headerShown: false, animation: "slide_from_right" }}
      />
      <Stack.Screen
        name="AnalyticsML"
        component={wrapAdmin(AnalyticsMLScreen)}
        options={{ headerShown: false, animation: "slide_from_right" }}
      />
      <Stack.Screen
        name="FraudDetection"
        component={wrapAdmin(FraudDetectionScreen)}
        options={{ headerShown: false, animation: "slide_from_right" }}
      />
      <Stack.Screen
        name="ManageReviews"
        component={wrapAdmin(ManageReviewsScreen)}
        options={{ headerShown: false, animation: "slide_from_right" }}
      />
      <Stack.Screen
        name="ManageWallet"
        component={wrapAdmin(ManageWalletScreen)}
        options={{ headerShown: false, animation: "slide_from_right" }}
      />
      <Stack.Screen
        name="ManageLoyalty"
        component={wrapAdmin(ManageLoyaltyScreen)}
        options={{ headerShown: false, animation: "slide_from_right" }}
      />
      <Stack.Screen
        name="ManageChat"
        component={wrapAdmin(ManageChatScreen)}
        options={{ headerShown: false, animation: "slide_from_right" }}
      />
    </Stack.Navigator>
  );
}