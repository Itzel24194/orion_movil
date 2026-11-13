import { NavigationContainer } from "@react-navigation/native";
import AppNavigator from "./src/navigation/AppNavigator";
import { PreferencesProvider } from "./src/context/PreferencesContext";
import { ProductProvider } from "./src/context/ProductContext";

export default function App() {
  return (
    <PreferencesProvider>
    <ProductProvider>
      <NavigationContainer>
        <AppNavigator />
      </NavigationContainer>
    </ProductProvider>
    </PreferencesProvider>
  );
}