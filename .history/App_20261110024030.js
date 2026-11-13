import React, { useEffect, useRef } from "react";
import { NavigationContainer, createNavigationContainerRef } from "@react-navigation/native";
import * as Notifications from "expo-notifications";
import AppNavigator from "./src/navigation/AppNavigator";
import { PreferencesProvider } from "./src/context/PreferencesContext";
import { ProductProvider } from "./src/context/ProductContext";
// ⭐ Importar el servicio ejecuta Notifications.setNotificationHandler (primer plano)
import "./src/services/pushNotifications";

export const navigationRef = createNavigationContainerRef();

// Abre el detalle de la solicitud indicada en la notificación
function abrirDesdeNotificacion(response, pendienteRef) {
  const data = response?.notification?.request?.content?.data || {};
  if (!data.solicitud_id) return;
  if (navigationRef.isReady()) {
    navigationRef.navigate("SolicitudDetalle", { id: String(data.solicitud_id) });
  } else {
    pendienteRef.current = response; // app aún cargando (arranque en frío)
  }
}

export default function App() {
  const pendienteRef = useRef(null);

  useEffect(() => {
    // Notificación recibida con la app abierta
    const subRecv = Notifications.addNotificationReceivedListener((n) => {
      if (__DEV__) {
        console.log("🔔 Recibida:", n.request.content.title, n.request.content.data);
      }
    });

    // El usuario TOCA la notificación -> abrir detalle de la solicitud
    const subTap = Notifications.addNotificationResponseReceivedListener((resp) => {
      abrirDesdeNotificacion(resp, pendienteRef);
    });

    // App abierta desde cero tocando una notificación
    Notifications.getLastNotificationResponseAsync().then((resp) => {
      if (resp) abrirDesdeNotificacion(resp, pendienteRef);
    });

    return () => {
      subRecv.remove();
      subTap.remove();
    };
  }, []);

  return (
    <PreferencesProvider>
    <ProductProvider>
      <NavigationContainer
        ref={navigationRef}
        onReady={() => {
          if (pendienteRef.current) {
            const r = pendienteRef.current;
            pendienteRef.current = null;
            abrirDesdeNotificacion(r, pendienteRef);
          }
        }}
      >
        <AppNavigator />
      </NavigationContainer>
    </ProductProvider>
    </PreferencesProvider>
  );
}