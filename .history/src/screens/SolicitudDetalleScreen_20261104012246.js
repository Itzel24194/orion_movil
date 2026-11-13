// screens/SolicitudDetalleScreen.js
import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    ActivityIndicator,
    TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, Ionicons } from '@expo/vector-icons';
import { fetchSolicitudDetalle } from '../services/api';
import { mensajeSeguro } from '../services/errorHandler';
import { usePreferences } from '../context/PreferencesContext';

export default function SolicitudDetalleScreen({ navigation, route }) {
    const { palette: p } = usePreferences();
    const { id } = route.params || {};

    const [solicitud, setSolicitud] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const cargar = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await fetchSolicitudDetalle(id);
            setSolicitud(data);
        } catch (e) {
            setError(mensajeSeguro(e));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        cargar();
    }, [id]);

    const formatearFecha = (iso) => {
        if (!iso) return '—';
        try {
            return new Date(iso).toLocaleString('es-MX', {
                day: '2-digit',
                month: 'long',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
            });
        } catch {
            return '—';
        }
    };

    const colorEstado = (estado) => {
        const e = String(estado || '').toLowerCase();
        if (e === 'pendiente') return '#F59E0B';
        if (e === 'en_revision') return '#3B82F6';
        if (e === 'aprobada') return '#10B981';
        if (e === 'rechazada') return '#EF4444';
        return p.primary;
    };

    const etiquetaEstado = (estado) => {
        const e = String(estado || '').toLowerCase();
        if (e === 'pendiente') return 'Pendiente';
        if (e === 'en_revision') return 'En revisión';
        if (e === 'aprobada') return 'Aprobada';
        if (e === 'rechazada') return 'Rechazada';
        return estado || '—';
    };

    return (
        <SafeAreaView style={[styles.page, { backgroundColor: p.background }]}>
            <View style={styles.top}>
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    style={[styles.back, { backgroundColor: p.surface }]}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    <Feather name="arrow-left" color={p.text} size={22} />
                </TouchableOpacity>
                <Text style={[styles.heading, { color: p.text }]}>Detalle</Text>
                <View style={{ width: 40 }} />
            </View>

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={p.primary} />
                </View>
            ) : error ? (
                <View style={styles.center}>
                    <Ionicons name="alert-circle-outline" size={48} color={p.danger} />
                    <Text style={{ color: p.danger, marginTop: 12, textAlign: 'center', paddingHorizontal: 24 }}>
                        {error}
                    </Text>
                    <TouchableOpacity
                        onPress={cargar}
                        style={[styles.btnRetry, { backgroundColor: p.primary }]}
                    >
                        <Feather name="refresh-cw" size={14} color="#FFF" />
                        <Text style={styles.btnRetryText}>Reintentar</Text>
                    </TouchableOpacity>
                </View>
            ) : solicitud ? (
                <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
                    <View style={[styles.card, { backgroundColor: p.surface, borderColor: p.border }]}>
                        <View style={styles.rowBetween}>
                            <Text style={[styles.tipo, { color: p.text }]}>
                                {solicitud.tipo?.replace(/_/g, ' ') || 'Solicitud'}
                            </Text>
                            <View
                                style={[
                                    styles.estadoBadge,
                                    { backgroundColor: colorEstado(solicitud.estado) + '20' },
                                ]}
                            >
                                <Text
                                    style={[styles.estadoText, { color: colorEstado(solicitud.estado) }]}
                                >
                                    {etiquetaEstado(solicitud.estado)}
                                </Text>
                            </View>
                        </View>

                        <View style={styles.separador} />

                        <Text style={[styles.label, { color: p.subtle }]}>Pedido</Text>
                        <Text style={[styles.valor, { color: p.text }]}>
                            {solicitud.pedido_id || '—'}
                        </Text>

                        <Text style={[styles.label, { color: p.subtle }]}>Descripción</Text>
                        <Text style={[styles.valor, { color: p.text }]}>
                            {solicitud.descripcion || '—'}
                        </Text>

                        <Text style={[styles.label, { color: p.subtle }]}>Fecha de creación</Text>
                        <Text style={[styles.valor, { color: p.text }]}>
                            {formatearFecha(solicitud.fecha_creacion)}
                        </Text>

                        <Text style={[styles.label, { color: p.subtle }]}>Respuesta del administrador</Text>
                        <Text style={[styles.valor, { color: p.text }]}>
                            {solicitud.respuesta_admin || 'Aún sin respuesta'}
                        </Text>
                    </View>
                </ScrollView>
            ) : null}
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
    },
    back: { borderRadius: 12, padding: 9 },
    heading: { fontSize: 18, fontWeight: '900' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
    card: { borderRadius: 14, borderWidth: 1, padding: 16 },
    rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    tipo: { fontSize: 16, fontWeight: '900', textTransform: 'capitalize' },
    estadoBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    estadoText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
    separador: { height: 1, backgroundColor: '#00000015', marginVertical: 12 },
    label: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginTop: 12 },
    valor: { fontSize: 14, marginTop: 4, lineHeight: 20 },
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