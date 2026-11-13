// screens/NuevaSolicitudScreen.js
import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    TextInput,
    ScrollView,
    StyleSheet,
    ActivityIndicator,
    TouchableOpacity,
    Alert,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { fetchOrders, crearSolicitud } from '../services/api';
import { mensajeSeguro } from '../services/errorHandler';
import { validarSolicitud } from '../services/validators';
import { usePreferences } from '../context/PreferencesContext';

const TIPOS = [
    { key: 'devolucion', label: 'Devolución' },
    { key: 'garantia', label: 'Garantía' },
    { key: 'producto_defectuoso', label: 'Producto defectuoso' },
    { key: 'otro', label: 'Otro' },
];

export default function NuevaSolicitudScreen({ navigation, route }) {
    const { palette: p } = usePreferences();
    const prePedidoId = route.params?.pedido_id;

    const [pedidos, setPedidos] = useState([]);
    const [pedidoId, setPedidoId] = useState(prePedidoId || '');
    const [tipo, setTipo] = useState('');
    const [descripcion, setDescripcion] = useState('');
    const [loadingPedidos, setLoadingPedidos] = useState(true);
    const [enviando, setEnviando] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                const data = await fetchOrders();
                const lista = Array.isArray(data) ? data : data?.orders || data?.pedidos || [];
                setPedidos(lista);
                if (!pedidoId && lista.length > 0) {
                    setPedidoId(String(lista[0].id || lista[0]._id || lista[0].numero_pedido || ''));
                }
            } catch (e) {
                // silencioso: se puede crear igual si prePedidoId existe
            } finally {
                setLoadingPedidos(false);
            }
        })();
    }, []);

    const enviar = async () => {
        const errores = validarSolicitud({ pedido_id: pedidoId, tipo, descripcion });
        if (errores.length > 0) {
            Alert.alert('Datos incompletos', errores.join('\n'));
            return;
        }

        setEnviando(true);
        try {
            await crearSolicitud({ pedido_id: pedidoId, tipo, descripcion });
            Alert.alert('Listo', 'Solicitud creada correctamente', [
                { text: 'OK', onPress: () => navigation.goBack() },
            ]);
        } catch (e) {
            Alert.alert('Error', mensajeSeguro(e));
        } finally {
            setEnviando(false);
        }
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
                <Text style={[styles.heading, { color: p.text }]}>Nueva Solicitud</Text>
                <View style={{ width: 40 }} />
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={{ flex: 1 }}
            >
                <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
                    {/* PEDIDO */}
                    <Text style={[styles.label, { color: p.subtle }]}>Pedido</Text>
                    {loadingPedidos ? (
                        <ActivityIndicator color={p.primary} style={{ marginVertical: 12 }} />
                    ) : pedidos.length === 0 ? (
                        <TextInput
                            value={pedidoId}
                            onChangeText={setPedidoId}
                            placeholder="Ej. ORD-12345"
                            placeholderTextColor={p.subtle}
                            style={[styles.input, { backgroundColor: p.surface, borderColor: p.border, color: p.text }]}
                        />
                    ) : (
                        <View style={styles.chipsRow}>
                            {pedidos.slice(0, 10).map((ped, idx) => {
                                const id = String(ped.id || ped._id || ped.numero_pedido || `p${idx}`);
                                const activo = pedidoId === id;
                                return (
                                    <TouchableOpacity
                                        key={id}
                                        onPress={() => setPedidoId(id)}
                                        style={[
                                            styles.chip,
                                            {
                                                backgroundColor: activo ? p.primary + '20' : p.surface,
                                                borderColor: activo ? p.primary : p.border,
                                            },
                                        ]}
                                    >
                                        <Text style={{ color: activo ? p.primary : p.text, fontSize: 12, fontWeight: '700' }}>
                                            {id}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    )}

                    {/* TIPO */}
                    <Text style={[styles.label, { color: p.subtle }]}>Tipo</Text>
                    <View style={styles.chipsRow}>
                        {TIPOS.map((t) => {
                            const activo = tipo === t.key;
                            return (
                                <TouchableOpacity
                                    key={t.key}
                                    onPress={() => setTipo(t.key)}
                                    style={[
                                        styles.chip,
                                        {
                                            backgroundColor: activo ? p.primary + '20' : p.surface,
                                            borderColor: activo ? p.primary : p.border,
                                        },
                                    ]}
                                >
                                    <Text style={{ color: activo ? p.primary : p.text, fontSize: 12, fontWeight: '700' }}>
                                        {t.label}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    {/* DESCRIPCIÓN */}
                    <Text style={[styles.label, { color: p.subtle }]}>Descripción (mín. 10 caracteres)</Text>
                    <TextInput
                        value={descripcion}
                        onChangeText={setDescripcion}
                        multiline
                        numberOfLines={5}
                        placeholder="Describe el motivo de la solicitud…"
                        placeholderTextColor={p.subtle}
                        style={[
                            styles.input,
                            styles.textarea,
                            { backgroundColor: p.surface, borderColor: p.border, color: p.text },
                        ]}
                    />
                    <Text style={{ color: p.subtle, fontSize: 11, alignSelf: 'flex-end', marginTop: 4 }}>
                        {descripcion.trim().length}/10
                    </Text>

                    {/* BOTÓN */}
                    <TouchableOpacity
                        onPress={enviar}
                        disabled={enviando}
                        style={[
                            styles.btnPrimary,
                            { backgroundColor: p.primary, opacity: enviando ? 0.6 : 1 },
                        ]}
                    >
                        {enviando ? (
                            <ActivityIndicator color="#FFF" />
                        ) : (
                            <>
                                <Feather name="send" size={16} color="#FFF" />
                                <Text style={styles.btnPrimaryText}>Enviar solicitud</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </ScrollView>
            </KeyboardAvoidingView>
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
    label: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginTop: 16, marginBottom: 8 },
    input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
    textarea: { minHeight: 100, textAlignVertical: 'top' },
    chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
    btnPrimary: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 14,
        borderRadius: 12,
        marginTop: 24,
    },
    btnPrimaryText: { color: '#FFF', fontWeight: '800', fontSize: 15 },
});