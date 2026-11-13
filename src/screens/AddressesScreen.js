// src/screens/AddressesScreen.js
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '../i18n/ui';
import { useFocusEffect } from '@react-navigation/native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { usePreferences } from '../context/PreferencesContext';

import {
  fetchDirecciones,
  crearDireccion,
  actualizarDireccion,
  eliminarDireccion,
  marcarDireccionPredeterminada,
} from '../services/api';

// ================================================================
// ⭐ INTERNACIONALIZACIÓN (ES/EN)
// ================================================================
const T = {
  es: {
    headerTitle: 'Mis direcciones',
    subtitleOne: 'dirección',
    subtitleMany: 'direcciones',
    loading: 'Cargando direcciones...',
    back: 'Atrás',
    refresh: 'Refrescar',

    // Modal
    modalCreateTitle: 'Nueva dirección',
    modalEditTitle: 'Editar dirección',
    close: 'Cerrar',

    // Field labels
    labelNombre: 'Nombre (opcional)',
    labelCalle: 'Calle *',
    labelNumero: 'Núm *',
    labelCp: 'CP *',
    labelColonia: 'Colonia *',
    labelCiudad: 'Ciudad *',
    labelEstado: 'Estado *',
    labelReferencias: 'Referencias',

    // Placeholders
    phNombre: 'Ej: Casa, Oficina',
    phCalle: 'Av. Reforma',
    phNumero: '123',
    phCp: '52180',
    phColonia: 'Centro',
    phCiudad: 'CDMX',
    phEstado: 'CDMX',
    phReferencias: 'Entre calles, piso, etc.',

    // Switch
    switchPredeterminada: 'Establecer como predeterminada',

    // Botones
    guardarCambios: 'Guardar cambios',
    guardarDireccion: 'Guardar dirección',
    cancelar: 'Cancelar',
    eliminar: 'Eliminar',

    // Tarjeta
    predeterminadaBadge: 'Predeterminada',
    marcarPredeterminada: 'Marcar como predeterminada',
    addressFallback: (id) => `Dirección #${id}`,
    cpPrefix: 'CP',

    // Empty / error
    errorTitle: 'No se pudieron cargar tus direcciones.',
    errorSub: 'Verifica tu conexión e intenta de nuevo.',
    emptyTitle: 'Aún no tienes direcciones.',
    emptySub: 'Agrega una para agilizar tus compras.',

    // Validaciones
    valCalle: 'La calle es obligatoria.',
    valNumero:
      'El número exterior es obligatorio y debe ser válido (ej. 56, 123-A, S/N).',
    valColonia: 'La colonia es obligatoria.',
    valCiudad: 'La ciudad es obligatoria.',
    valEstado: 'El estado es obligatorio.',
    valCp: 'El código postal debe tener exactamente 5 dígitos (ej. 52180).',
    guardarErr: 'No se pudo guardar la dirección.',

    // Alert eliminar
    eliminarTitle: 'Eliminar dirección',
    eliminarSub: '¿Estás seguro de eliminar esta dirección?',
    eliminarErr: 'No se pudo eliminar.',
    actualizarErr: 'No se pudo actualizar.',
  },
  en: {
    headerTitle: 'My addresses',
    subtitleOne: 'address',
    subtitleMany: 'addresses',
    loading: 'Loading addresses...',
    back: 'Back',
    refresh: 'Refresh',

    modalCreateTitle: 'New address',
    modalEditTitle: 'Edit address',
    close: 'Close',

    labelNombre: 'Name (optional)',
    labelCalle: 'Street *',
    labelNumero: 'Number *',
    labelCp: 'ZIP code *',
    labelColonia: 'Neighborhood *',
    labelCiudad: 'City *',
    labelEstado: 'State *',
    labelReferencias: 'References',

    phNombre: 'e.g. Home, Office',
    phCalle: 'Main St',
    phNumero: '123',
    phCp: '52180',
    phColonia: 'Downtown',
    phCiudad: 'CDMX',
    phEstado: 'CDMX',
    phReferencias: 'Between streets, floor, etc.',

    switchPredeterminada: 'Set as default',

    guardarCambios: 'Save changes',
    guardarDireccion: 'Save address',
    cancelar: 'Cancel',
    eliminar: 'Delete',

    predeterminadaBadge: 'Default',
    marcarPredeterminada: 'Set as default',
    addressFallback: (id) => `Address #${id}`,
    cpPrefix: 'ZIP',

    errorTitle: 'Could not load your addresses.',
    errorSub: 'Check your connection and try again.',
    emptyTitle: 'You have no addresses yet.',
    emptySub: 'Add one to speed up your purchases.',

    valCalle: 'Street is required.',
    valNumero:
      'The exterior number is required and must be valid (e.g. 56, 123-A, N/A).',
    valColonia: 'Neighborhood is required.',
    valCiudad: 'City is required.',
    valEstado: 'State is required.',
    valCp: 'The ZIP code must have exactly 5 digits (e.g. 52180).',
    guardarErr: 'Could not save the address.',

    eliminarTitle: 'Delete address',
    eliminarSub: 'Are you sure you want to delete this address?',
    eliminarErr: 'Could not delete.',
    actualizarErr: 'Could not update.',
  },
};

const getLang = (language) => {
  const l = String(language || 'es').toLowerCase();
  return l.startsWith('en') ? 'en' : 'es';
};

// ────────────────────────────────────────────────────────────────
// Form base
// ────────────────────────────────────────────────────────────────
const FORM_VACIO = {
  nombre: '',
  calle: '',
  numero: '',
  colonia: '',
  ciudad: '',
  estado: '',
  cp: '',
  referencias: '',
  predeterminada: false,
};

// ⭐ Validador de CP: exactamente 5 dígitos (México)
const esCpValido = (cp) => /^\d{5}$/.test(String(cp || '').trim());

// ⭐ Validador de número: obligatorio, acepta 1, 56, 123, 123-A, S/N
const esNumeroValido = (num) => {
  const s = String(num || '').trim();
  if (!s) return false;
  // Acepta dígitos, letras, guiones, slash y espacios
  return /^[0-9A-Za-z\-\/\s]+$/.test(s);
};

export default function AddressesScreen({ navigation }) {
  const prefs = usePreferences() || {};
  const p = prefs.palette || {};
  const lang = getLang(prefs.language);
  const t = T[lang];

  const [direcciones, setDirecciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(FORM_VACIO);
  const [guardando, setGuardando] = useState(false);
  const [formError, setFormError] = useState('');

  // ── Carga ────────────────────────────────────────────────────
  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(false);
    try {
      const list = await fetchDirecciones();
      setDirecciones(Array.isArray(list) ? list : []);
    } catch (e) {
      console.warn('[direcciones] load', e?.message);
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = () => {
    setRefreshing(true);
    load(true);
  };

  const total = direcciones.length;

  const calleCompleta = useMemo(
    () => (d) =>
      d.calle_completa ||
      [
        [d.calle, d.numero].filter(Boolean).join(' '),
        d.colonia,
        d.ciudad,
        d.estado,
        d.cp ? `${t.cpPrefix} ${d.cp}` : '',
      ]
        .filter(Boolean)
        .join(', '),
    [t]
  );

  // ── Modal ────────────────────────────────────────────────────
  const abrirCrear = () => {
    setEditando(null);
    setForm({ ...FORM_VACIO, predeterminada: total === 0 });
    setFormError('');
    setModalVisible(true);
  };

  const abrirEditar = (d) => {
    setEditando(d.id);
    setForm({
      nombre: d.nombre || d.alias || '',
      calle: d.calle || '',
      numero: String(d.numero ?? d.numero_exterior ?? ''),
      colonia: d.colonia || '',
      ciudad: d.ciudad || '',
      estado: d.estado || '',
      cp: String(d.cp ?? d.codigo_postal ?? ''),
      referencias: d.referencias || '',
      predeterminada: !!d.predeterminada,
    });
    setFormError('');
    setModalVisible(true);
  };

  const cerrarModal = () => {
    if (guardando) return;
    setModalVisible(false);
    setFormError('');
  };

  const setField = (k, v) => setForm((s) => ({ ...s, [k]: v }));

  // ── Guardar ──────────────────────────────────────────────────
  const guardar = async () => {
    setFormError('');

    // ⭐ Validaciones
    if (!form.calle.trim()) return setFormError(t.valCalle);
    if (!esNumeroValido(form.numero))
      return setFormError(t.valNumero);
    if (!form.colonia.trim()) return setFormError(t.valColonia);
    if (!form.ciudad.trim()) return setFormError(t.valCiudad);
    if (!form.estado.trim()) return setFormError(t.valEstado);
    if (!esCpValido(form.cp)) return setFormError(t.valCp);

    const payload = {
      nombre: form.nombre.trim(),
      calle: form.calle.trim(),
      numero: form.numero.trim(),
      colonia: form.colonia.trim(),
      ciudad: form.ciudad.trim(),
      estado: form.estado.trim(),
      cp: form.cp.trim(),
      referencias: form.referencias.trim(),
      predeterminada: !!form.predeterminada,
    };

    setGuardando(true);
    try {
      let list;
      if (editando != null) {
        list = await actualizarDireccion(editando, payload);
      } else {
        list = await crearDireccion(payload);
      }
      if (Array.isArray(list)) setDirecciones(list);
      else await load(true);
      setModalVisible(false);
    } catch (e) {
      setFormError(e?.message || t.guardarErr);
    } finally {
      setGuardando(false);
    }
  };

  // ── Eliminar ─────────────────────────────────────────────────
  const eliminar = (d) => {
    Alert.alert(
      t.eliminarTitle,
      t.eliminarSub,
      [
        { text: t.cancelar, style: 'cancel' },
        {
          text: t.eliminar,
          style: 'destructive',
          onPress: async () => {
            try {
              const list = await eliminarDireccion(d.id);
              if (Array.isArray(list)) setDirecciones(list);
              else await load(true);
            } catch (e) {
              Alert.alert('Error', e?.message || t.eliminarErr);
            }
          },
        },
      ]
    );
  };

  // ── Marcar predeterminada ────────────────────────────────────
  const marcarPredeterminada = async (d) => {
    if (d.predeterminada) return;
    try {
      const list = await marcarDireccionPredeterminada(d.id);
      if (Array.isArray(list)) setDirecciones(list);
      else await load(true);
    } catch (e) {
      Alert.alert('Error', e?.message || t.actualizarErr);
    }
  };

  // ── Render item ──────────────────────────────────────────────
  const renderItem = ({ item: dir }) => {
    const pred = !!dir.predeterminada;
    return (
      <View
        style={[
          styles.card,
          {
            backgroundColor: p.surface,
            borderColor: pred ? p.primary : p.border,
            borderWidth: pred ? 1.6 : 1,
          },
        ]}
      >
        <View style={styles.rowBetween}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.cardTitle, { color: p.text }]}>
              {dir.nombre || t.addressFallback(dir.id)}
            </Text>
            {pred && (
              <View style={[styles.pill, { backgroundColor: p.primary }]}>
                <Feather name="star" size={10} color="#FFF" />
                <Text style={styles.pillText}>{t.predeterminadaBadge}</Text>
              </View>
            )}
          </View>

          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              onPress={() => abrirEditar(dir)}
              style={[
                styles.iconBtn,
                { backgroundColor: p.background, borderColor: p.border },
              ]}
            >
              <Feather name="edit-2" size={15} color={p.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => eliminar(dir)}
              style={[
                styles.iconBtn,
                { backgroundColor: p.background, borderColor: p.border },
              ]}
            >
              <Feather name="trash-2" size={15} color="#B91C1C" />
            </TouchableOpacity>
          </View>
        </View>

        <Text style={[styles.cardLine, { color: p.text }]}>
          <Feather name="map-pin" size={12} color={p.subtle} />{' '}
          {calleCompleta(dir)}
        </Text>

        {!!dir.referencias && (
          <Text style={[styles.cardRef, { color: p.subtle }]}>
            <Feather name="info" size={11} color={p.subtle} /> {dir.referencias}
          </Text>
        )}

        {!pred && (
          <TouchableOpacity
            onPress={() => marcarPredeterminada(dir)}
            style={[styles.btnGhost, { borderColor: p.border, marginTop: 10 }]}
            activeOpacity={0.85}
          >
            <Feather name="star" size={13} color={p.primary} />
            <Text style={[styles.btnGhostText, { color: p.primary }]}>
              {t.marcarPredeterminada}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderEmpty = () => {
    if (loading) return null;
    return (
      <View style={styles.center}>
        <Ionicons
          name={error ? 'alert-circle-outline' : 'location-outline'}
          size={46}
          color={p.subtle}
        />
        <Text style={[styles.emptyTitle, { color: p.text }]}>
          {error ? t.errorTitle : t.emptyTitle}
        </Text>
        <Text style={[styles.emptySub, { color: p.subtle }]}>
          {error ? t.errorSub : t.emptySub}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView
      style={[styles.page, { backgroundColor: p.background }]}
      edges={['top', 'left', 'right']}
    >
      <View
        style={[
          styles.header,
          { backgroundColor: p.background, borderBottomColor: p.border },
        ]}
      >
        <TouchableOpacity
          style={[styles.iconBtn, { backgroundColor: p.surface }]}
          onPress={() => navigation.goBack()}
          accessibilityLabel={t.back}
        >
          <Feather name="arrow-left" size={20} color={p.text} />
        </TouchableOpacity>

        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: p.text }]}>
            {t.headerTitle}
          </Text>
          <Text style={[styles.subtitle, { color: p.subtle }]}>
            {total} {total === 1 ? t.subtitleOne : t.subtitleMany}
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.iconBtn, { backgroundColor: p.surface }]}
          onPress={onRefresh}
          accessibilityLabel={t.refresh}
        >
          <Ionicons name="refresh" size={20} color={p.primary} />
        </TouchableOpacity>
      </View>

      {loading && !direcciones.length ? (
        <View style={styles.center}>
          <ActivityIndicator color={p.primary} />
          <Text style={{ color: p.subtle, marginTop: 12 }}>
            {t.loading}
          </Text>
        </View>
      ) : (
        <FlatList
          data={direcciones}
          keyExtractor={(item) => String(item.id ?? item._id)}
          renderItem={renderItem}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: 120,
            flexGrow: 1,
          }}
          ListEmptyComponent={renderEmpty}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={p.primary}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      <TouchableOpacity
        style={[styles.fab, { backgroundColor: p.primary }]}
        onPress={abrirCrear}
        activeOpacity={0.85}
      >
        <Feather name="plus" size={22} color="#FFF" />
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={cerrarModal}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ width: '100%' }}
          >
            <View
              style={[
                styles.modalCard,
                { backgroundColor: p.background, borderColor: p.border },
              ]}
            >
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: p.text }]}>
                  {editando != null ? t.modalEditTitle : t.modalCreateTitle}
                </Text>
                <TouchableOpacity onPress={cerrarModal} accessibilityLabel={t.close}>
                  <Feather name="x" size={22} color={p.text} />
                </TouchableOpacity>
              </View>

              <ScrollView
                style={{ maxHeight: '80%' }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <Field
                  label={t.labelNombre}
                  placeholder={t.phNombre}
                  value={form.nombre}
                  onChangeText={(v) => setField('nombre', v)}
                  p={p}
                />

                <View style={styles.rowGap}>
                  <View style={{ flex: 2 }}>
                    <Field
                      label={t.labelCalle}
                      placeholder={t.phCalle}
                      value={form.calle}
                      onChangeText={(v) => setField('calle', v)}
                      p={p}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Field
                      label={t.labelNumero}
                      placeholder={t.phNumero}
                      value={form.numero}
                      onChangeText={(v) => setField('numero', v)}
                      p={p}
                    />
                  </View>
                </View>

                <View style={styles.rowGap}>
                  <View style={{ flex: 1 }}>
                    <Field
                      label={t.labelCp}
                      placeholder={t.phCp}
                      keyboardType="number-pad"
                      maxLength={5}
                      value={form.cp}
                      onChangeText={(v) =>
                        setField('cp', v.replace(/\D/g, '').slice(0, 5))
                      }
                      p={p}
                    />
                  </View>
                  <View style={{ flex: 2 }}>
                    <Field
                      label={t.labelColonia}
                      placeholder={t.phColonia}
                      value={form.colonia}
                      onChangeText={(v) => setField('colonia', v)}
                      p={p}
                    />
                  </View>
                </View>

                <View style={styles.rowGap}>
                  <View style={{ flex: 1 }}>
                    <Field
                      label={t.labelCiudad}
                      placeholder={t.phCiudad}
                      value={form.ciudad}
                      onChangeText={(v) => setField('ciudad', v)}
                      p={p}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Field
                      label={t.labelEstado}
                      placeholder={t.phEstado}
                      value={form.estado}
                      onChangeText={(v) => setField('estado', v)}
                      p={p}
                    />
                  </View>
                </View>

                <Field
                  label={t.labelReferencias}
                  placeholder={t.phReferencias}
                  value={form.referencias}
                  onChangeText={(v) => setField('referencias', v)}
                  p={p}
                  multiline
                />

                <View style={styles.switchRow}>
                  <Text style={{ color: p.text, fontWeight: '700' }}>
                    {t.switchPredeterminada}
                  </Text>
                  <Switch
                    value={!!form.predeterminada}
                    onValueChange={(v) => setField('predeterminada', v)}
                    trackColor={{ true: p.primary }}
                    thumbColor="#FFF"
                  />
                </View>

                {!!formError && (
                  <Text style={styles.formError}>{formError}</Text>
                )}

                <TouchableOpacity
                  onPress={guardar}
                  disabled={guardando}
                  style={[
                    styles.btnPrimary,
                    {
                      backgroundColor: p.primary,
                      opacity: guardando ? 0.7 : 1,
                    },
                  ]}
                  activeOpacity={0.85}
                >
                  {guardando ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <>
                      <Feather name="save" size={16} color="#FFF" />
                      <Text style={styles.btnPrimaryText}>
                        {editando != null
                          ? t.guardarCambios
                          : t.guardarDireccion}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={cerrarModal}
                  disabled={guardando}
                  style={[
                    styles.btnGhost,
                    { borderColor: p.border, marginTop: 8 },
                  ]}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.btnGhostText, { color: p.text }]}>
                    {t.cancelar}
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Field({ label, p, multiline, ...rest }) {
  return (
    <View style={{ marginTop: 10 }}>
      <Text style={[styles.fieldLabel, { color: p.subtle }]}>{label}</Text>
      <TextInput
        {...rest}
        multiline={!!multiline}
        placeholderTextColor={p.subtle}
        style={[
          styles.input,
          {
            color: p.text,
            borderColor: p.border,
            backgroundColor: p.surface,
            height: multiline ? 70 : 44,
            textAlignVertical: multiline ? 'top' : 'center',
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 18, fontWeight: '900' },
  subtitle: { fontSize: 12, marginTop: 2 },

  card: { padding: 14, borderRadius: 16, marginBottom: 12 },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  cardTitle: { fontSize: 15, fontWeight: '900' },
  cardLine: { fontSize: 13, marginTop: 8, lineHeight: 19 },
  cardRef: { fontSize: 12, marginTop: 6, lineHeight: 17 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    marginTop: 6,
  },
  pillText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.3,
  },

  center: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    gap: 10,
  },
  emptyTitle: { fontSize: 16, fontWeight: '900', textAlign: 'center' },
  emptySub: { fontSize: 13, textAlign: 'center', lineHeight: 19 },

  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 1,
    padding: 18,
    paddingBottom: 28,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  modalTitle: { fontSize: 16, fontWeight: '900' },

  fieldLabel: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  rowGap: { flexDirection: 'row', gap: 10 },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
  },
  formError: {
    color: '#B91C1C',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 10,
  },
  btnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 999,
    marginTop: 16,
  },
  btnPrimaryText: { color: '#FFF', fontSize: 14, fontWeight: '900' },
  btnGhost: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1.5,
  },
  btnGhostText: { fontSize: 13, fontWeight: '800' },
});