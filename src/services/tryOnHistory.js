import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
const KEY = '@orion/tryon/history/v1';

export async function getTryOnHistory() {
  try {
    const list = JSON.parse((await AsyncStorage.getItem(KEY)) || '[]');
    return Array.isArray(list) ? list : [];
  } catch { return []; }
}
export async function storeTryOnImage(tempUri, product, color) {
  // Solo en el dispositivo. No se suben fotografías al servidor ni a terceros.
  if (!FileSystem.documentDirectory) throw new Error('El guardado local no está disponible.');
  const id = `${Date.now()}`;
  const uri = `${FileSystem.documentDirectory}orion-tryon-${id}.png`;
  await FileSystem.copyAsync({ from: tempUri, to: uri });
  const entry = { id, uri, productId: String(product.id), name: product.name, color, createdAt: Date.now() };
  const list = await getTryOnHistory();
  const all = [entry, ...list];
  await AsyncStorage.setItem(KEY, JSON.stringify(all.slice(0, 40)));
  // Eliminar archivos antiguos al limitar el historial.
  for (const old of all.slice(40)) {
    if (old.uri?.startsWith(FileSystem.documentDirectory)) {
      await FileSystem.deleteAsync(old.uri, { idempotent: true }).catch(() => {});
    }
  }
  return entry;
}
export async function deleteTryOnImage(id) {
  const list = await getTryOnHistory();
  const found = list.find(item => item.id === id);
  const next = list.filter(item => item.id !== id);
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
  if (found?.uri?.startsWith(FileSystem.documentDirectory)) {
    await FileSystem.deleteAsync(found.uri, { idempotent: true }).catch(() => {});
  }
}
