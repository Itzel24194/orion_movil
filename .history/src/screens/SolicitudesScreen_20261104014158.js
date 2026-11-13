// screens/SolicitudesScreen.js
import React, { useCallback, useEffect, useState } from 'react';
import {
    View,
    Text,
    FlatList,
    StyleSheet,
    ActivityIndicator,
    TouchableOpacity,
    RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, Ionicons } from '@expo/vector-icons';
import { fetchSolicitudes } from '../services/api';
import { mensajeSeguro } from '../services/errorHandler';
import { usePreferences } from '../context/PreferencesContext';

export default function SolicitudesScreen({ navigation }) {
    const { palette: p } = usePreferences();

    const [solicitudes, setSolicitudes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refrescando, setRefrescando] = useState(false);
    const [error, setError] = useState(null);

    // ----------------------------------------------------------------
    // Carga de datos
    // ----------------------------------------------------------------
    const cargar = useCallback(async (esRefresh = false) => {
        if (esRefresh) setRefrescando(true);
        else setLoading(true);
        setError(null);

        try {
            const data = await fetchSolicitudes();
            setSolicitudes(Array.isArray(data) ? data : []);
        } catch (e) {
            setError(mensajeSeguro(e));
        } finally {
            setLoading(false);
            setRefrescando(false);
        }
    }, []);

    useEffect(() => {
        cargar();
    }, [cargar]);

    // Refrescar automáticamente cuando regresas a esta pantalla
    useEffect(() => {
        const unsubscribe = navigation.addListener('focus', () => {
            cargar(true);
        });
        return unsubscribe;
    }, [navigation, cargar]);

    // ----------------------------------------------------------------
    // Helpers de presentación
    // ----------------------------------------------------------------
    const formatearFecha = (iso) => {
        if (!iso) return '';
        try {
            return new Date(iso).toLocaleString('es-MX', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
            });
        } catch {
            return '';
        }
    };

    const colorEstado = (estado) => {
        const e = String(estado || '').toLowerCase();
        if (e === 'pendiente') return '#F59E0B';
        if (e === 'en_revision') return '#3B82F6';
        if (e === 'aprobada') return '#10B981';
        if (e === 'rechazada') return '#EF4444';
        return p.primary || '#7C3AED';
    };

    const etiquetaEstado = (estado) => {
        const e = String(estado || '').toLowerCase();
        if (e === 'pendiente') return 'Pendiente';
        if (e === 'en_revision') return 'En revisión';
        if (e === 'aprobada') return 'Aprobada';
        if (e === 'rechazada') return 'Rechazada';
        return estado || '—';
    };

    const etiquetaTipo = (tipo) => {
        const t = String(tipo || '').toLowerCase();
        if (t === 'devolucion') return 'Devolución';
        if (t === 'garantia') return 'Garantía';
        if (t === 'producto_defectuoso') return 'Producto defectuoso';
        if (t === 'otro') return 'Otro';
        return tipo || 'Solicitud';
    };

    // ----------------------------------------------------------------
    // Navegación
    // ----------------------------------------------------------------
    const irANueva = () => {
        navigation.navigate('NuevaSolicitud');
    };

    const irADetalle = (solicitud) => {
        navigation.navigate('SolicitudDetalle', { id: solicitud.id });
    };

    // ----------------------------------------------------------------
    // Render de cada tarjeta
    // ----------------------------------------------------------------
    const renderItem = ({ item }) => {
        const color = colorEstado(item.estado);
        return (
            <TouchableOpacity
                onPress={() => irADetalle(item)}
                activeOpacity={0.85}
                style={[styles.card, { backgroundColor: p.surface, borderColor: p.border }]}
            >
                <View style={styles.cardHeader}>
                    <View style={[styles.iconWrap, { backgroundColor: color + '20' }]}>
                        <Feather name="file-text" size={18} color={color} />
                    </View>

                    <View style={{ flex: 1 }}>
                        <Text style={[styles.cardTitle, { color: p.text }]} numberOfLines={1}>
                            {etiquetaTipo(item.tipo)}
                        </Text>
                        <Text style={[styles.cardSub, { color: p.subtle }]} numberOfLines={1}>
                            Pedido: {item.pedido_id || '—'}
                        </Text>
                    </View>

                    <View style={[styles.estadoBadge, { backgroundColor: color + '20' }]}>
                        <Text style={[styles.estadoText, { color }]}>
                            {etiquetaEstado(item.estado)}
                        </Text>
                    </View>
                </View>

                <Text style={[styles.descripcion, { color: p.text }]} numberOfLines={2}>
                    {item.descripcion || ''}
                </Text>

                <View style={styles.cardFooter}>
                    <Text style={[styles.fecha, { color: p.subtle }]}>
                        {formatearFecha(item.fecha_creacion)}
                    </Text>
                    <Feather name="chevron-right" size={16} color={p.subtle} />
                </View>
            </TouchableOpacity>
        );
    };

    // ----------------------------------------------------------------
    // Render
    // ----------------------------------------------------------------
    return (
        <SafeAreaView style={[styles.page, { backgroundColor: p.background }]} edges={['top', 'left', 'right']}>

            {/* HEADER */}
            <View style={[styles.top, { borderBottomColor: p.border }]}>
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    style={[styles.back, { backgroundColor: p.surface }]}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    <Feather name="arrow-left" color={p.text} size={22} />
                </TouchableOpacity>

                <Text style={[styles.heading, { color: p.text }]}>Mis Solicitudes</Text>

                <TouchableOpacity
                    onPress={() => cargar()}
                    style={[styles.back, { backgroundColor: p.surface }]}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    <Feather name="refresh-cw" color={p.primary} size={18} />
                </TouchableOpacity>
            </View>

            {/* ESTADOS: carga / error / lista */}
            {loading && solicitudes.length === 0 ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={p.primary} />
                    <Text style={{ color: p.subtle, marginTop: 12 }}>Cargando solicitudes…</Text>
                </View>
            ) : error && solicitudes.length === 0 ? (
                <View style={styles.center}>
                    <Ionicons name="alert-circle-outline" size={48} color={p.danger || '#EF4444'} />
                    <Text
                        style={{
                            color: p.danger || '#EF4444',
                            marginTop: 10,
                            textAlign: 'center',
                            paddingHorizontal: 24,
                        }}
                    >
                        {error}
                    </Text>
                    <TouchableOpacity
                        onPress={() => cargar()}
                        style={[styles.btnRetry, { backgroundColor: p.primary }]}
                    >
                        <Feather name="refresh-cw" size={14} color="#FFF" />
                        <Text style={styles.btnRetryText}>Reintentar</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <FlatList
                    data={solicitudes}
                    keyExtractor={(item) => String(item.id)}
                    renderItem={renderItem}
                    contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 110, flexGrow: 1 }}
                    refreshControl={
                        <RefreshControl
                            refreshing={refrescando}
                            onRefresh={() => cargar(true)}
                            tintColor={p.primary}
                            colors={[p.primary]}
                        />
                    }
                    ListEmptyComponent={
                        <View style={styles.empty}>
                            <Ionicons name="document-text-outline" size={64} color={p.subtle} />
                            <Text style={[styles.emptyTitle, { color: p.text }]}>
                                Aún no tienes solicitudes
                            </Text>
                            <Text style={[styles.emptySub, { color: p.subtle }]}>
                                Toca "Nueva" para reportar una devolución, garantía o producto defectuoso.
                            </Text>
                        </View>
                    }
                    showsVerticalScrollIndicator={false}
                />
            )}

            {/* BOTÓN FLOTANTE: NUEVA SOLICITUD */}
            <TouchableOpacity
                onPress={irANueva}
                activeOpacity={0.85}
                style={[styles.fab, { backgroundColor: p.primary }]}
            >
                <Feather name="plus" size={22} color="#FFF" />
                <Text style={styles.fabText}>Nueva</Text>
            </TouchableOpacity>

        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    page: { flex: 1 },

    top: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottomWidth: 1,
    },
    back: { borderRadius: 12, padding: 9 },
    heading: { fontSize: 18, fontWeight: '900' },

    center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },

    card: {
        borderRadius: 14,
        borderWidth: 1,
        padding: 14,
        marginVertical: 6,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 8,
    },
    iconWrap: {
        width: 36,
        height: 36,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cardTitle: { fontSize: 14, fontWeight: '800' },
    cardSub: { fontSize: 11, marginTop: 2 },

    estadoBadge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
    },
    estadoText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },

    descripcion: { fontSize: 12.5, lineHeight: 18 },

    cardFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 10,
    },
    fecha: { fontSize: 11 },

    empty: {
        alignItems: 'center',
        paddingVertical: 60,
        paddingHorizontal: 24,
    },
    emptyTitle: { fontSize: 16, fontWeight: '800', marginTop: 16, textAlign: 'center' },
    emptySub: { fontSize: 12.5, textAlign: 'center', marginTop: 8, lineHeight: 18 },

    fab: {
        position: 'absolute',
        bottom: 20,
        right: 20,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 18,
        paddingVertical: 14,
        borderRadius: 50,
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
        elevation: 6,
    },
    fabText: { color: '#FFF', fontWeight: '800', fontSize: 14 },

    btnRetry: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 50,
        marginTop: 16,
    },
    btnRetryText: { color: '#FFF', fontWeight: '800', fontSize: 13 },
});