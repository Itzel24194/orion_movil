// URL del backend web (Flask + MongoDB).
// Define EXPO_PUBLIC_API_URL en un archivo .env (ver .env.example).
// En celular físico usa la IP de tu PC en la red, ej. http://192.168.1.50:5000
// En emulador Android usa http://10.0.2.2:5000
export const API_URL = (process.env.EXPO_PUBLIC_API_URL || 'http://192.168.100.53:5000').replace(/\/+$/, '');
export const REQUEST_TIMEOUT_MS = 15000;
