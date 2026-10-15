import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '../i18n/ui';
import { useFocusEffect } from '@react-navigation/native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { getCurrentUser, fetchOrders } from '../services/api';
import { usePreferences } from '../context/PreferencesContext';
const currency = n => `$${Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;
export default function OrdersScreen({ navigation }) {
  const { palette: p } = usePreferences();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const load = useCallback(async () => {
    const user = await getCurrentUser();
    if (!user) { setLoading(false); setOrders([]); return; }
    setLoading(true); setError(false);
    try {
      const list = await fetchOrders();
      setOrders(list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)));
    } catch { setError(true); } finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  return <SafeAreaView style={[styles.page, { backgroundColor: p.background }]}>
    <View style={styles.header}><TouchableOpacity style={[styles.back, { backgroundColor: p.surface }]} onPress={() => navigation.goBack()}><Feather name="arrow-left" size={22} color={p.text}/></TouchableOpacity><Text style={[styles.title, { color: p.text }]}>Mis solicitudes</Text><TouchableOpacity onPress={load}><Ionicons name="refresh" size={23} color={p.primary}/></TouchableOpacity></View>
    {loading && !orders.length ? <View style={styles.center}><ActivityIndicator color={p.primary}/><Text style={{ color: p.subtle, marginTop: 12 }}>Cargando solicitudes...</Text></View>
    : <FlatList data={orders} keyExtractor={item => item.id} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 30, flexGrow: 1 }} refreshControl={<RefreshControl refreshing={loading} onRefresh={load}/>}
      ListEmptyComponent={<View style={styles.center}><Ionicons name={error ? 'alert-circle-outline' : 'receipt-outline'} size={40} color={p.subtle}/><Text style={[styles.empty, { color: p.text }]}>{error ? 'No se pudo consultar el servidor.' : 'Aún no hay solicitudes.'}</Text><Text style={{ color: p.subtle, textAlign: 'center' }}>{error ? 'Verifica tu conexión e inicia sesión de nuevo.' : 'Podrás consultarlas después de registrar una solicitud.'}</Text></View>}
      renderItem={({ item }) => <View style={[styles.card, { backgroundColor: p.surface, borderColor: p.border }]}><View style={styles.row}><Text style={{ color: p.subtle, fontSize: 12 }}>#{item.id.slice(0, 8).toUpperCase()}</Text><Text style={{ color: p.primary, fontWeight: '800' }}>{item.status === 'pendiente' ? 'PENDIENTE' : String(item.status).toUpperCase()}</Text></View>
        <Text style={[styles.name, { color: p.text }]}>{item.items?.map(x => `${x.quantity}× ${x.name}`).join(', ') || 'Artículos'}</Text>
        <Text style={{ color: p.subtle, marginTop: 8, fontSize: 12 }}>{(item.createdAt ? new Date(item.createdAt).toLocaleDateString('es-MX') : null) || 'Fecha pendiente'} · Sin pago procesado</Text>
        <View style={[styles.row, { marginTop: 14 }]}><Text style={{ color: p.subtle }}>Importe estimado</Text><Text style={[styles.total, { color: p.text }]}>{currency(item.totalEstimado)}</Text></View>
      </View>} />}
  </SafeAreaView>;
}
const styles = StyleSheet.create({ page: { flex: 1 }, header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 }, back: { padding: 10, borderRadius: 12 }, title: { fontSize: 19, fontWeight: '900' }, center: { padding: 30, alignItems: 'center', justifyContent: 'center', flex: 1, gap: 8 }, empty: { fontSize: 19, fontWeight: '900' }, card: { padding: 17, borderWidth: 1, borderRadius: 18, marginBottom: 12 }, row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 }, name: { fontSize: 14, fontWeight: '800', marginTop: 12 }, total: { fontSize: 17, fontWeight: '900' } });
