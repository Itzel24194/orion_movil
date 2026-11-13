// src/services/pushNotifications.js
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
 
// Cómo se muestra la notificación con la app abierta (primer plano)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});
 
export async function registerForPushNotifications() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('solicitudes', {
      name: 'Solicitudes',
      importance: Notifications.AndroidImportance.MAX,
    });
  }
  if (!Device.isDevice) return { token: null, status: 'no_device' };
 
  // 1) Permisos
  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') {
    ({ status } = await Notifications.requestPermissionsAsync());
  }
  if (status !== 'granted') return { token: null, status: 'denied' };
 
  // 2) Token Expo Push
  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
  return { token: data, status: 'granted' };
}

