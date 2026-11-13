// navigation/AppNavigator.js
import React, { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { usePreferences } from "../context/PreferencesContext";
import { getCurrentUser, isAdmin } from "../services/api";

// ────────────── ADMIN ──────────────
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

// ────────────── CLIENTE ──────────────
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

// ────────────── PANTALLAS DE PERFIL ──────────────
import PaymentMethodsScreen from "../screens/PaymentMethodsScreen";
import AddressesScreen from "../screens/AddressesScreen";
import NotificationsScreen from "../screens/NotificationsScreen"; // ⭐ FALTABA
import SupportScreen from "../screens/SupportScreen";
import BillingScreen from "../screens/BillingScreen";
import WalletScreen from "../screens/WalletScreen";
import LoyaltyScreen from "../screens/LoyaltyScreen";
import PersonalDataScreen from "../screens/PersonalDataScreen";
import InterestsScreen from "../screens/InterestsScreen";
import PrivacyScreen from "../screens/PrivacyScreen";
import ContactScreen from "../screens/ContactScreen";
import ReturnsScreen from "../screens/ReturnsScreen";

// ────────────── SOLICITUDES (CLIENTE) ──────────────
import SolicitudesScreen from "../screens/SolicitudesScreen"; // ⭐ FALTABA
import SolicitudDetalleScreen from "../screens/SolicitudDetalleScreen"; // ⭐ FALTABA
import NuevaSolicitudScreen from "../screens/NuevaSolicitudScreen"; // ⭐ FALTABA

const Stack = createNativeStackNavigator();

// ────────────── Admin Guard ──────────────
function AdminGuard(Component) {
  return function Guarded(props) {
    const [ok, setOk] = useState(null);

    useEffect(() => {
      let mounted = true;
      (async () => {
        try {
          const user = await getCurrentUser();
          if (!mounted) return;
          if (isAdmin(user)) {
            setOk(true);
          } else {
            props.navigation.replace(
              props.navigation.canGoBack?.() ? "Home" : "Login"
            );
          }
        } catch {
          if (mounted) props.navigation.replace("Login");
        }
      })();
      return () => {
        mounted = false;
      };
    }, [props.navigation]);

    if (ok === null) {
      return (
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: "#020617",
          }}
        >
          <ActivityIndicator size="large" color="#7C3AED" />
        </View>
      );
    }
    return <Component {...props} />;
  };
}

const wrapAdmin = (C) => AdminGuard(C);

export default function AppNavigator() {
  const { t } = usePreferences();

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {/* ────────────── AUTH ────────────── */}
      <Stack.Screen name="Splash" component={SplashScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />

      {/* ────────────── CLIENTE ────────────── */}
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="Categories" component={CategoriesScreen} />
      <Stack.Screen name="Products" component={ProductsScreen} />
      <Stack.Screen name="ProductDetail" component={ProductDetailScreen} />
      <Stack.Screen name="Cart" component={CartScreen} />
      <Stack.Screen name="Checkout" component={CheckoutScreen} />
      <Stack.Screen name="Orders" component={OrdersScreen} />
      <Stack.Screen name="OrderDetail" component={OrderDetailScreen} />
      <Stack.Screen name="Favorites" component={FavoritesScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="SecurityAndAccess" component={SecurityAndAccessScreen} />
      <Stack.Screen name="Videos" component={VideosScreen} />
      <Stack.Screen name="ChatBot" component={ChatBotScreen} />
      <Stack.Screen name="TryOn" component={TryOnScreen} />
      <Stack.Screen name="TryOnHistory" component={TryOnHistoryScreen} />

      {/* ────────────── PANTALLAS DE PERFIL ────────────── */}
      <Stack.Screen name="PaymentMethods" component={PaymentMethodsScreen} />
      <Stack.Screen name="Addresses" component={AddressesScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="Support" component={SupportScreen} />
      <Stack.Screen name="Billing" component={BillingScreen} />
      <Stack.Screen name="Wallet" component={WalletScreen} />
      <Stack.Screen name="Loyalty" component={LoyaltyScreen} />
      <Stack.Screen name="PersonalData" component={PersonalDataScreen} />
      <Stack.Screen name="Interests" component={InterestsScreen} />
      <Stack.Screen name="Privacy" component={PrivacyScreen} />
      <Stack.Screen name="Contact" component={ContactScreen} />
      <Stack.Screen name="Returns" component={ReturnsScreen} />

      {/* ────────────── SOLICITUDES (CLIENTE) ────────────── */}
      <Stack.Screen name="Solicitudes" component={SolicitudesScreen} />
      <Stack.Screen name="SolicitudDetalle" component={SolicitudDetalleScreen} />
      <Stack.Screen name="NuevaSolicitud" component={NuevaSolicitudScreen} />

      {/* ────────────── ADMIN ────────────── */}
      <Stack.Screen name="AdminProfile" component={wrapAdmin(AdminProfileScreen)} />
      <Stack.Screen name="AdminDashboard" component={wrapAdmin(AdminDashboardScreen)} />
      <Stack.Screen name="Crud" component={wrapAdmin(CrudScreen)} />
      <Stack.Screen name="ManageUsers" component={wrapAdmin(ManageUsers)} />
      <Stack.Screen name="ManageCategories" component={wrapAdmin(ManageCategoriesScreen)} />
      <Stack.Screen name="ManageTemporadas" component={wrapAdmin(ManageTemporadasScreen)} />
      <Stack.Screen name="ManageProducts" component={wrapAdmin(ManageProductsScreen)} />
      <Stack.Screen name="ManageBrands" component={wrapAdmin(ManageBrandsScreen)} />
      <Stack.Screen name="ManageOrders" component={wrapAdmin(ManageOrdersScreen)} />
      <Stack.Screen name="ManageCoupons" component={wrapAdmin(ManageCouponsScreen)} />
      <Stack.Screen name="GenerateCoupons" component={wrapAdmin(GenerateCouponsScreen)} />
      <Stack.Screen name="ManagePromotions" component={wrapAdmin(ManagePromotionsScreen)} />
      <Stack.Screen name="GeneratePromotions" component={wrapAdmin(GeneratePromotionsScreen)} />
      <Stack.Screen name="AdminSolicitudes" component={wrapAdmin(AdminSolicitudesScreen)} />
    </Stack.Navigator>
  );
}