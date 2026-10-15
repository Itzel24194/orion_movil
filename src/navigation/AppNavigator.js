// navigation/AppNavigator.js
import { createNativeStackNavigator } from "@react-navigation/native-stack";

// ================================================================
// PANTALLAS
// ================================================================
// Admin
import AdminDashboardScreen from "../screens/AdminDashboardScreen";
import AdminProfileScreen from "../screens/AdminProfileScreen";
import CrudScreen from "../screens/CrudScreen";
import ManageUsers from "../screens/ManageUsers";
import ManageCategoriesScreen from "../screens/ManageCategoriesScreen";
import ManageTemporadasScreen from "../screens/ManageTemporadasScreen";
import ManageProductsScreen from "../screens/ManageProductsScreen";
import ManageBrandsScreen from "../screens/ManageBrandsScreen";

// Cliente
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
import FavoritesScreen from "../screens/FavoritesScreen";
import ProfileScreen from "../screens/ProfileScreen";
import SecurityAndAccessScreen from "../screens/SecurityAndAccessScreen";
import VideosScreen from "../screens/VideosScreen";
import ChatBotScreen from "../screens/ChatBotScreen";
import TryOnScreen from "../screens/TryOnScreen";
import TryOnHistoryScreen from "../screens/TryOnHistoryScreen";

import { usePreferences } from "../context/PreferencesContext";

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  const { t } = usePreferences();

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {/* ==================== AUTH / SPLASH ==================== */}
      <Stack.Screen name="Splash" component={SplashScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />

      {/* ==================== CLIENTE ==================== */}
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="Categories" component={CategoriesScreen} />
      <Stack.Screen name="Products" component={ProductsScreen} />
      <Stack.Screen name="ProductDetail" component={ProductDetailScreen} />
      <Stack.Screen name="Cart" component={CartScreen} />
      <Stack.Screen name="Checkout" component={CheckoutScreen} />
      <Stack.Screen name="Orders" component={OrdersScreen} />
      <Stack.Screen name="Favorites" component={FavoritesScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen
        name="SecurityAndAccess"
        component={SecurityAndAccessScreen}
      />
      <Stack.Screen name="Videos" component={VideosScreen} />
      <Stack.Screen name="ChatBot" component={ChatBotScreen} />
      <Stack.Screen name="TryOn" component={TryOnScreen} />
      <Stack.Screen name="TryOnHistory" component={TryOnHistoryScreen} />

      {/* ==================== ADMIN ==================== */}
      <Stack.Screen
        name="AdminProfile"
        component={AdminProfileScreen}
        options={{ animation: "slide_from_right" }}
      />
      <Stack.Screen
        name="AdminDashboard"
        component={AdminDashboardScreen}
        options={{ title: t("Panel de Control") }}
      />
      <Stack.Screen name="Crud" component={CrudScreen} />
      <Stack.Screen name="ManageUsers" component={ManageUsers} />
      <Stack.Screen
        name="ManageCategories"
        component={ManageCategoriesScreen}
      />
      <Stack.Screen
        name="ManageTemporadas"
        component={ManageTemporadasScreen}
      />
      <Stack.Screen
        name="ManageProducts"
        component={ManageProductsScreen}
      />
      <Stack.Screen
        name="ManageBrands"
        component={ManageBrandsScreen}
      />
    </Stack.Navigator>
  );
}