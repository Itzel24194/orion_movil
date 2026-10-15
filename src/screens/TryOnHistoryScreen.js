import React, { useCallback, useState } from 'react';
import { FlatList, Image, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text, Alert } from '../i18n/ui';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import { deleteTryOnImage, getTryOnHistory } from '../services/tryOnHistory';

export default function TryOnHistoryScreen({ navigation }) {
  const [items, setItems] = useState([]);
  useFocusEffect(useCallback(() => { let active = true; getTryOnHistory().then(value => { if (active) setItems(value); }); return () => { active = false; }; }, []));
  const erase = (entry) => Alert.alert('Eliminar look', '¿Quieres borrar esta imagen de ORION?', [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Eliminar', style: 'destructive', onPress: async () => { await deleteTryOnImage(entry.id); setItems(await getTryOnHistory()); } },
  ]);
  const share = async uri => {
    try { if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'image/png' });
      else Alert.alert('Compartir', 'No disponible en este dispositivo.');
    } catch { Alert.alert('Error', 'No se pudo compartir este look.'); }
  };
  return <View style={styles.page}>
    <View style={styles.header}><TouchableOpacity onPress={() => navigation.goBack()}><Ionicons name="arrow-back" size={24} color="#FFF" /></TouchableOpacity><Text style={styles.title}>Mis looks guardados</Text><View style={{ width: 24 }} /></View>
    <FlatList data={items} keyExtractor={item => item.id} numColumns={2} columnWrapperStyle={{ gap: 12 }} contentContainerStyle={{ padding: 16, gap: 12 }}
      ListEmptyComponent={<Text style={styles.empty}>Aún no has guardado looks. Crea uno desde el espejo virtual.</Text>}
      renderItem={({ item }) => <View style={styles.card}>
        <Image source={{ uri: item.uri }} style={styles.image} />
        <Text numberOfLines={1} style={styles.name}>{item.name}</Text>
        <Text style={styles.label}>{item.color} · {new Date(item.createdAt).toLocaleDateString('es-MX')}</Text>
        <View style={styles.actions}>
          <TouchableOpacity onPress={() => share(item.uri)}><Ionicons name="share-outline" color="#928BFF" size={22}/></TouchableOpacity>
          <TouchableOpacity onPress={() => erase(item)}><Ionicons name="trash-outline" color="#F87171" size={22}/></TouchableOpacity>
        </View>
      </View>} />
  </View>;
}
const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: '#0B1020' }, header: { paddingTop: 54, paddingBottom: 14, paddingHorizontal: 18, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, title: { color: 'white', fontSize: 19, fontWeight: '800' }, empty: { color: '#B3BBD0', textAlign: 'center', padding: 30 }, card: { flex: 1, backgroundColor: '#1C2436', borderRadius: 14, padding: 8, maxWidth: '50%' }, image: { height: 185, borderRadius: 10 }, name: { color: 'white', fontWeight: '700', marginTop: 8 }, label: { color: '#B7C0D1', fontSize: 11, marginTop: 4 }, actions: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 10 } });
