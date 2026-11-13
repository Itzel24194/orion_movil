// screens/SolicitudesScreen.js
import React, { useEffect, useState } from 'react';
import {
    View, Text, FlatList, StyleSheet, ActivityIndicator, Alert, Button
} from 'react-native';
import { fetchSolicitudes, crearSolicitud } from '../services/api';
import { usePreferences } from '../context/PreferencesContext';

export default function SolicitudesScreen() {
    const { palette: p, isDark } = usePreferences();
    const [solicitudes, setSolicitudes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const cargarSolicitudes = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await fetchSolicitudes();
            setSolicitudes(data);
        } catch (e) {
            setError(e.message || 'Error al cargar solicitudes');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        cargarSolicitudes();
    }, []);

    const handleCrearSolicitud = async () => {
        // Aquí puedes abrir un modal o navegar a un formulario
        Alert.alert('Prueba', 'Aquí iría el formulario de nueva solicitud');
        // Ejemplo de llamada:
        // await crearSolicitud({ pedido_id: '...', tipo: 'devolucion', descripcion: '...' });
        // cargarSolicitudes(); // Refrescar la lista
    };

    if (loading) return <ActivityIndicator size="large" color={p.primary} style={{ flex: 1 }} />;
    if (error) return <Text style={{ color: p.danger, padding: 20 }}>{error}</Text>;

    return (
        <View style={[styles.container, { backgroundColor: p.background }]}>
            <Button title="Nueva Solicitud" onPress={handleCrearSolicitud} color={p.primary} />
            <FlatList
                data={solicitudes}
                keyExtractor={item => item.id}
                renderItem={({ item }) => (
                    <View style={[styles.card, { backgroundColor: p.surface, borderColor: p.border }]}>
                        <Text style={{ color: p.text, fontWeight: 'bold' }}>{item.tipo}</Text>
                        <Text style={{ color: p.subtle }}>{item.descripcion}</Text>
                        <Text style={{ color: p.primary }}>Estado: {item.estado}</Text>
                    </View>
                )}
                ListEmptyComponent={<Text style={{ color: p.subtle, textAlign: 'center', marginTop: 20 }}>No hay solicitudes</Text>}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 16 },
    card: { padding: 16, marginVertical: 8, borderRadius: 12, borderWidth: 1 },
});