import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View, StyleSheet, ScrollView, TouchableOpacity, FlatList, Modal,
  ActivityIndicator, TextInput as RNTextInput, KeyboardAvoidingView,
  Platform, Switch, RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text, Alert } from "../i18n/ui";
import { Ionicons, MaterialCommunityIcons, Feather } from "@expo/vector-icons";

import {
  fetchMarcas,
  createMarca,
  updateMarca,
  deleteMarca,
  aprobarMarca,
  negarMarca,
} from "../services/api";

// ================================================================
// CONSTANTES
// ================================================================

const PAGE_SIZE = 10;

const FILTROS = [
  { id: "todas",      label: "Todas",       icon: "grid" },
  { id: "activo",     label: "Activas",     icon: "check-circle" },
  { id: "pendiente",  label: "Pendientes",  icon: "clock" },
  { id: "negado",     label: "Negadas",     icon: "x-circle" },
];

const STATUS_META = {
  activo:    { color: "#10b981", icon: "check-circle",   label: "Activa" },
  pendiente: { color: "#f59e0b", icon: "clock",          label: "Pendiente" },
  negado:    { color: "#ef4444", icon: "x-circle",       label: "Negada" },
};

const metaStatus = (status) =>
  STATUS_META[status] || { color: "#64748B", icon: "circle", label: status || "—" };

const safeFetch = (fn, ...args) => {
  if (typeof fn !== "function") return Promise.resolve([]);
  try {
    return Promise.resolve(fn(...args)).catch(() => []);
  } catch {
    return Promise.resolve([]);
  }
};

// ================================================================
// COMPONENTE
// ================================================================

export default function ManageBrandsScreen({ navigation }) {
  const [marcas, setMarcas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filtro, setFiltro] = useState("todas");
  const [busqueda, setBusqueda] = useState("");

  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  const [detalle, setDetalle] = useState(null);

  const [negarModal, setNegarModal] = useState(false);
  const [marcaANegar, setMarcaANegar] = useState(null);
  const [motivoNegar, setMotivoNegar] = useState("");

  const formDefault = () => ({
    nombre_comercial: "",
    rfc: "",
    correo: "",
    telefono: "",
    direccion: "",
    status: "pendiente",
    activa: true,
    notas_admin: "",
  });
  const [form, setForm] = useState(formDefault());

  // ================================================================
  // CARGA
  // ================================================================

  const cargar = useCallback(async ({ isRefresh = false } = {}) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const data = await safeFetch(fetchMarcas);
      setMarcas(Array.isArray(data) ? data : []);
      setPage(1);
    } catch (e) {
      console.log("❌ Error cargando marcas:", e?.message);
      setError(e?.message || "No se pudieron cargar las marcas");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  // ================================================================
  // DERIVADOS
  // ================================================================

  const filtradas = useMemo(() => {
    let lista = [...marcas];

    if (busqueda.trim()) {
      const q = busqueda.toLowerCase().trim();
      lista = lista.filter((m) =>
        (m.nombre_comercial || "").toLowerCase().includes(q) ||
        (m.rfc || "").toLowerCase().includes(q) ||
        (m.correo || "").toLowerCase().includes(q)
      );
    }

    if (filtro !== "todas") {
      lista = lista.filter((m) => m.status === filtro);
    }

    return lista.sort((a, b) =>
      (a.nombre_comercial || "").localeCompare(b.nombre_comercial || "")
    );
  }, [marcas, filtro, busqueda]);

  const paginadas = useMemo(
    () => filtradas.slice(0, page * PAGE_SIZE),
    [filtradas, page]
  );

  const hayMas = paginadas.length < filtradas.length;

  const conteos = useMemo(() => {
    const c = { todas: marcas.length, activo: 0, pendiente: 0, negado: 0 };
    marcas.forEach((m) => {
      if (c[m.status] !== undefined) c[m.status]++;
    });
    return c;
  }, [marcas]);

  // ================================================================
  // PAGINACIÓN
  // ================================================================

  const cargarMas = () => {
    if (loadingMore || !hayMas) return;
    setLoadingMore(true);
    setTimeout(() => {
      setPage((p) => p + 1);
      setLoadingMore(false);
    }, 250);
  };

  const cambiarFiltro = (id) => {
    setFiltro(id);
    setPage(1);
  };

  // ================================================================
  // MODALES CRUD
  // ================================================================

  const abrirCrear = () => {
    setEditing(null);
    setForm(formDefault());
    setModalVisible(true);
  };

  const abrirEditar = (m) => {
    setEditing(m);
    setForm({
      nombre_comercial: m.nombre_comercial || "",
      rfc: m.rfc || "",
      correo: m.correo || "",
      telefono: m.telefono || "",
      direccion: m.direccion || "",
      status: m.status || "pendiente",
      activa: m.activa !== false,
      notas_admin: m.notas_admin || "",
    });
    setDetalle(null);
    setModalVisible(true);
  };

  const cerrarModal = () => { if (!saving) setModalVisible(false); };

  // ================================================================
  // GUARDAR
  // ================================================================

  const guardar = async () => {
    if (!form.nombre_comercial.trim()) {
      Alert.alert("Campo requerido", "El nombre comercial es obligatorio.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        nombre_comercial: form.nombre_comercial.trim(),
        rfc: form.rfc.trim().toUpperCase(),
        correo: form.correo.trim(),
        telefono: form.telefono.trim(),
        direccion: form.direccion.trim(),
        status: form.status,
        activa: form.activa !== false,
        notas_admin: form.notas_admin.trim(),
      };

      if (editing) await updateMarca(editing.id, payload);
      else await createMarca(payload);

      setModalVisible(false);
      await cargar({ isRefresh: true });
    } catch (e) {
      Alert.alert("Error", e?.message || "No se pudo guardar la marca");
    } finally {
      setSaving(false);
    }
  };

  // ================================================================
  // APROBAR / NEGAR / ELIMINAR
  // ================================================================

  const confirmarAprobar = (m) => {
    Alert.alert(
      "Aprobar marca",
      `¿Aprobar "${m.nombre_comercial}"?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Aprobar",
          onPress: async () => {
            try {
              await aprobarMarca(m.id);
              await cargar({ isRefresh: true });
              setDetalle(null);
            } catch (e) {
              Alert.alert("Error", e?.message || "No se pudo aprobar");
            }
          },
        },
      ]
    );
  };

  const abrirNegarModal = (m) => {
    setMarcaANegar(m);
    setMotivoNegar("");
    setNegarModal(true);
    setDetalle(null);
  };

  const confirmarNegar = async () => {
    if (!motivoNegar.trim()) {
      Alert.alert("Motivo requerido", "Escribe el motivo de la negación.");
      return;
    }
    try {
      await negarMarca(marcaANegar.id, motivoNegar.trim());
      setNegarModal(false);
      setMarcaANegar(null);
      setMotivoNegar("");
      await cargar({ isRefresh: true });
    } catch (e) {
      Alert.alert("Error", e?.message || "No se pudo negar");
    }
  };

  const confirmarEliminar = (m) => {
    Alert.alert(
      "Eliminar marca",
      `¿Seguro que deseas eliminar "${m.nombre_comercial}"? Esta acción no se puede deshacer.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteMarca(m.id);
              await cargar({ isRefresh: true });
              setDetalle(null);
            } catch (e) {
              Alert.alert("No se pudo eliminar", e?.message || "Error del servidor");
            }
          },
        },
      ]
    );
  };

  // ================================================================
  // RENDER — FILTROS
  // ================================================================

  const renderFiltros = () => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtrosRow}>
      {FILTROS.map((f) => {
        const activo = filtro === f.id;
        const count = conteos[f.id] ?? 0;
        return (
          <TouchableOpacity key={f.id} style={[styles.chip, activo && styles.chipActive]}
            onPress={() => cambiarFiltro(f.id)} activeOpacity={0.7}>
            <Feather name={f.icon} size={13} color={activo ? "#FFF" : "#94A3B8"} />
            <Text style={[styles.chipText, activo && styles.chipTextActive]}>{f.label}</Text>
            <View style={[styles.chipBadge, activo && styles.chipBadgeActive]}>
              <Text style={[styles.chipBadgeText, activo && styles.chipBadgeTextActive]}>{count}</Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );

  // ================================================================
  // RENDER — CARD
  // ================================================================

  const renderItem = ({ item }) => {
    const meta = metaStatus(item.status);

    return (
      <TouchableOpacity style={styles.card} onPress={() => setDetalle(item)} activeOpacity={0.85}>
        <View style={[styles.cardAccent, { backgroundColor: meta.color }]} />

        <View style={styles.cardBody}>
          <View style={[styles.cardImgPlaceholder, { backgroundColor: `${meta.color}18` }]}>
            <MaterialCommunityIcons name="tag-multiple" size={26} color={meta.color} />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle} numberOfLines={1}>{item.nombre_comercial}</Text>

            <View style={styles.statusRow}>
              <Feather name={meta.icon} size={11} color={meta.color} />
              <Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text>
              {item.impi_count > 0 && (
                <Text style={styles.metaText}>· {item.impi_count} registros IMPI</Text>
              )}
            </View>

            {item.rfc ? (
              <Text style={styles.cardMeta} numberOfLines={1}>
                RFC: {item.rfc}
              </Text>
            ) : null}

            {(item.correo || item.telefono) ? (
              <Text style={styles.cardMeta} numberOfLines={1}>
                {item.correo}
                {item.correo && item.telefono ? " · " : ""}
                {item.telefono}
              </Text>
            ) : null}
          </View>

          <View style={styles.cardActions}>
            <TouchableOpacity style={styles.actionBtn}
              onPress={(e) => { e.stopPropagation?.(); setDetalle(item); }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Feather name="eye" size={15} color="#10b981" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn}
              onPress={(e) => { e.stopPropagation?.(); abrirEditar(item); }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Feather name="edit-2" size={15} color="#3b82f6" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn}
              onPress={(e) => { e.stopPropagation?.(); confirmarEliminar(item); }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Feather name="trash-2" size={15} color="#ef4444" />
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // ================================================================
  // FOOTER / EMPTY
  // ================================================================

  const renderFooter = () => {
    if (loadingMore) {
      return (
        <View style={styles.footerLoading}>
          <ActivityIndicator color="#7C3AED" />
          <Text style={styles.footerLoadingText}>Cargando más…</Text>
        </View>
      );
    }
    if (!hayMas && filtradas.length > 0) {
      return (
        <View style={styles.footerEnd}>
          <View style={styles.footerEndLine} />
          <Text style={styles.footerEndText}>
            Mostrando {paginadas.length} de {filtradas.length}
          </Text>
          <View style={styles.footerEndLine} />
        </View>
      );
    }
    return null;
  };

  const renderEmpty = () => {
    if (loading) return null;
    const esFiltro = filtro !== "todas" || busqueda.trim();
    return (
      <View style={styles.center}>
        <View style={styles.emptyIconWrap}>
          <MaterialCommunityIcons name="tag-multiple" size={48} color="#334155" />
        </View>
        <Text style={styles.emptyTitle}>{esFiltro ? "Sin resultados" : "Aún no hay marcas"}</Text>
        <Text style={styles.emptySub}>
          {esFiltro ? "Prueba con otro filtro." : 'Crea la primera con "Nueva".'}
        </Text>
        {esFiltro && (
          <TouchableOpacity style={styles.emptyBtn}
            onPress={() => { setFiltro("todas"); setBusqueda(""); }}>
            <Text style={styles.emptyBtnText}>Limpiar filtros</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // ================================================================
  // MODAL DETALLE
  // ================================================================

  const renderDetalle = () => {
    if (!detalle) return null;
    const m = detalle;
    const meta = metaStatus(m.status);

    return (
      <Modal visible={!!detalle} transparent animationType="slide" onRequestClose={() => setDetalle(null)}>
        <View style={styles.detalleOverlay}>
          <View style={styles.detalleCard}>
            <View style={[styles.detalleHeader, { backgroundColor: `${meta.color}20` }]}>
              <View style={[styles.detalleAccent, { backgroundColor: meta.color }]} />

              <View style={styles.detalleIconWrap}>
                <MaterialCommunityIcons name="tag-multiple" size={36} color={meta.color} />
              </View>

              <View style={styles.detalleHeaderContent}>
                <Text style={styles.detalleTitle} numberOfLines={2}>{m.nombre_comercial}</Text>
                <View style={styles.detalleStatusPill}>
                  <Feather name={meta.icon} size={12} color={meta.color} />
                  <Text style={[styles.detalleStatusText, { color: meta.color }]}>{meta.label}</Text>
                </View>
              </View>

              <TouchableOpacity style={styles.detalleClose} onPress={() => setDetalle(null)}>
                <Ionicons name="close" size={22} color="#FFF" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.detalleScroll} showsVerticalScrollIndicator={false}>
              <View style={styles.detalleSection}>
                <Text style={styles.detalleSectionLabel}>Información</Text>
                <View style={styles.detalleFechasGrid}>
                  <View style={styles.detalleFechaBox}>
                    <Text style={styles.detalleFechaLabel}>RFC</Text>
                    <Text style={styles.detalleFechaValor}>{m.rfc || "—"}</Text>
                  </View>
                  <View style={styles.detalleFechaBox}>
                    <Text style={styles.detalleFechaLabel}>Teléfono</Text>
                    <Text style={styles.detalleFechaValor}>{m.telefono || "—"}</Text>
                  </View>
                </View>
                <View style={[styles.detalleFechaBox, { marginTop: 8 }]}>
                  <Text style={styles.detalleFechaLabel}>Correo</Text>
                  <Text style={styles.detalleFechaValor}>{m.correo || "—"}</Text>
                </View>
                <View style={[styles.detalleFechaBox, { marginTop: 8 }]}>
                  <Text style={styles.detalleFechaLabel}>Dirección</Text>
                  <Text style={styles.detalleFechaValor}>{m.direccion || "—"}</Text>
                </View>
              </View>

              {m.notas_admin ? (
                <View style={styles.detalleSection}>
                  <Text style={styles.detalleSectionLabel}>Notas</Text>
                  <Text style={styles.detalleDescripcion}>{m.notas_admin}</Text>
                </View>
              ) : null}

              {m.impi_count > 0 && (
                <View style={styles.detalleSection}>
                  <Text style={styles.detalleSectionLabel}>
                    Acervo IMPI ({m.impi_count} registros)
                  </Text>
                  <Text style={styles.detalleDescripcion}>
                    Este marca tiene {m.impi_count} registro(s) extraído(s) del IMPI.
                    Descarga la ficha PDF desde el panel web para verlos completos.
                  </Text>
                </View>
              )}
            </ScrollView>

            <View style={styles.detalleActions}>
              {m.status !== "activo" && (
                <TouchableOpacity
                  style={[styles.detalleBtn, styles.detalleBtnApprove]}
                  onPress={() => confirmarAprobar(m)}
                >
                  <Feather name="check" size={16} color="#6ee7b7" />
                  <Text style={styles.detalleBtnApproveText}>Aprobar</Text>
                </TouchableOpacity>
              )}
              {m.status !== "negado" && (
                <TouchableOpacity
                  style={[styles.detalleBtn, styles.detalleBtnReject]}
                  onPress={() => abrirNegarModal(m)}
                >
                  <Feather name="x" size={16} color="#fbbf24" />
                  <Text style={styles.detalleBtnRejectText}>Negar</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.detalleBtn, styles.detalleBtnEdit]}
                onPress={() => abrirEditar(m)}
              >
                <Feather name="edit-2" size={16} color="#FFF" />
                <Text style={styles.detalleBtnEditText}>Editar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  // ================================================================
  // RENDER PRINCIPAL
  // ================================================================

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#FFF" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Marcas</Text>
          <Text style={styles.headerSub}>{marcas.length} registradas</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={abrirCrear}>
          <Ionicons name="add" size={20} color="#FFF" />
          <Text style={styles.addBtnText}>Nueva</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchWrap}>
        <Feather name="search" size={15} color="#64748B" />
        <RNTextInput
          style={styles.searchInput}
          placeholder="Buscar por nombre, RFC o correo..."
          placeholderTextColor="#475569"
          value={busqueda}
          onChangeText={(t) => { setBusqueda(t); setPage(1); }}
        />
        {busqueda.length > 0 && (
          <TouchableOpacity onPress={() => setBusqueda("")}>
            <Ionicons name="close-circle" size={16} color="#64748B" />
          </TouchableOpacity>
        )}
      </View>

      {error && (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle" size={18} color="#EF4444" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => cargar()}>
            <Text style={styles.retryText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      )}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#7C3AED" />
        </View>
      ) : (
        <FlatList
          data={paginadas}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          ListHeaderComponent={renderFiltros}
          ListEmptyComponent={renderEmpty}
          ListFooterComponent={renderFooter}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          onEndReached={cargarMas}
          onEndReachedThreshold={0.4}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => cargar({ isRefresh: true })}
              colors={["#7C3AED"]} tintColor="#7C3AED"
              progressBackgroundColor="#0f172a"
            />
          }
        />
      )}

      {renderDetalle()}

      {/* MODAL CREAR/EDITAR */}
      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={cerrarModal}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editing ? "Editar marca" : "Nueva marca"}
              </Text>
              <TouchableOpacity onPress={cerrarModal}>
                <Ionicons name="close" size={22} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.label}>Nombre comercial *</Text>
              <RNTextInput style={styles.input} value={form.nombre_comercial}
                onChangeText={(t) => setForm((f) => ({ ...f, nombre_comercial: t }))}
                placeholder="Ej. Nike" placeholderTextColor="#475569" />

              <Text style={styles.label}>RFC</Text>
              <RNTextInput style={styles.input} value={form.rfc}
                onChangeText={(t) => setForm((f) => ({ ...f, rfc: t.toUpperCase() }))}
                placeholder="ABC123456XYZ" placeholderTextColor="#475569"
                autoCapitalize="characters" maxLength={13} />

              <Text style={styles.label}>Correo</Text>
              <RNTextInput style={styles.input} value={form.correo}
                onChangeText={(t) => setForm((f) => ({ ...f, correo: t }))}
                placeholder="contacto@marca.com" placeholderTextColor="#475569"
                autoCapitalize="none" keyboardType="email-address" />

              <Text style={styles.label}>Teléfono</Text>
              <RNTextInput style={styles.input} value={form.telefono}
                onChangeText={(t) => setForm((f) => ({ ...f, telefono: t }))}
                placeholder="55 1234 5678" placeholderTextColor="#475569"
                keyboardType="phone-pad" />

              <Text style={styles.label}>Dirección</Text>
              <RNTextInput style={[styles.input, styles.inputMultiline]} value={form.direccion}
                onChangeText={(t) => setForm((f) => ({ ...f, direccion: t }))}
                placeholder="Av. Reforma 123, CDMX" placeholderTextColor="#475569"
                multiline />

              <Text style={styles.label}>Notas internas</Text>
              <RNTextInput style={[styles.input, styles.inputMultiline]} value={form.notas_admin}
                onChangeText={(t) => setForm((f) => ({ ...f, notas_admin: t }))}
                placeholder="Observaciones del admin…" placeholderTextColor="#475569"
                multiline />

              <Text style={styles.label}>Estado</Text>
              <View style={styles.statusPicker}>
                {Object.entries(STATUS_META).map(([key, meta]) => {
                  const activo = form.status === key;
                  return (
                    <TouchableOpacity key={key}
                      style={[styles.statusOption, activo && { backgroundColor: `${meta.color}20`, borderColor: meta.color }]}
                      onPress={() => setForm((f) => ({ ...f, status: key }))}>
                      <Feather name={meta.icon} size={13} color={activo ? meta.color : "#94A3B8"} />
                      <Text style={[styles.statusOptionText, activo && { color: meta.color, fontWeight: "700" }]}>
                        {meta.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.switchRow}>
                <View style={styles.switchLeft}>
                  <Ionicons
                    name={form.activa ? "checkmark-circle" : "pause-circle"}
                    size={15} color={form.activa ? "#10b981" : "#64748B"} />
                  <Text style={styles.switchLabel}>Marca activa</Text>
                </View>
                <Switch value={form.activa}
                  onValueChange={(v) => setForm((f) => ({ ...f, activa: v }))}
                  trackColor={{ false: "#1e293b", true: "#10b98180" }}
                  thumbColor={form.activa ? "#10b981" : "#64748B"} />
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity style={[styles.btn, styles.btnCancel]}
                  onPress={cerrarModal} disabled={saving}>
                  <Text style={styles.btnCancelText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.btn, styles.btnSave]}
                  onPress={guardar} disabled={saving}>
                  {saving ? <ActivityIndicator color="#FFF" /> : (
                    <Text style={styles.btnSaveText}>
                      {editing ? "Guardar cambios" : "Crear marca"}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* MODAL NEGAR */}
      <Modal visible={negarModal} transparent animationType="fade"
        onRequestClose={() => setNegarModal(false)}>
        <View style={styles.colorModalOverlay}>
          <View style={styles.colorModalCard}>
            <View style={styles.negarHeader}>
              <Feather name="x-circle" size={22} color="#fbbf24" />
              <Text style={styles.colorModalTitle}>Negar marca</Text>
            </View>
            <Text style={styles.negarSub}>
              {marcaANegar?.nombre_comercial}
            </Text>
            <Text style={styles.label}>Motivo *</Text>
            <RNTextInput style={[styles.input, styles.inputMultiline]} value={motivoNegar}
              onChangeText={setMotivoNegar}
              placeholder="Ej. Ya existe una marca similar registrada en el IMPI…"
              placeholderTextColor="#475569" multiline autoFocus />
            <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
              <TouchableOpacity style={[styles.btn, styles.btnCancel]}
                onPress={() => setNegarModal(false)}>
                <Text style={styles.btnCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, styles.btnNegar]}
                onPress={confirmarNegar}>
                <Text style={styles.btnSaveText}>Negar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ================================================================
// ESTILOS
// ================================================================

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#020617" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 40 },

  header: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 14, paddingTop: 50, paddingBottom: 16,
    backgroundColor: "#0f172a", borderBottomWidth: 1, borderColor: "#1e293b",
  },
  backBtn: { padding: 6, borderRadius: 10, backgroundColor: "#1e293b" },
  headerTitle: { color: "#FFF", fontSize: 18, fontWeight: "bold" },
  headerSub: { color: "#64748B", fontSize: 12, marginTop: 2 },
  addBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "#7C3AED", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
  },
  addBtnText: { color: "#FFF", fontWeight: "700", fontSize: 13 },

  searchWrap: {
    flexDirection: "row", alignItems: "center", gap: 8,
    marginHorizontal: 14, marginTop: 12,
    paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: "#0f172a", borderRadius: 12,
    borderWidth: 1, borderColor: "#1e293b",
  },
  searchInput: { flex: 1, color: "#FFF", fontSize: 13, padding: 0 },

  errorBox: {
    flexDirection: "row", alignItems: "center", gap: 10,
    margin: 16, padding: 12, backgroundColor: "#450a0a",
    borderRadius: 12, borderWidth: 1, borderColor: "#7f1d1d",
  },
  errorText: { flex: 1, color: "#fecaca", fontSize: 13 },
  retryText: { color: "#f87171", fontWeight: "700", fontSize: 13 },

  emptyIconWrap: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: "#0f172a", borderWidth: 1, borderColor: "#1e293b",
    justifyContent: "center", alignItems: "center", marginBottom: 16,
  },
  emptyTitle: { color: "#FFF", fontSize: 17, fontWeight: "700", marginTop: 4 },
  emptySub: { color: "#64748B", fontSize: 13, marginTop: 8, textAlign: "center", paddingHorizontal: 20 },
  emptyBtn: {
    marginTop: 18, paddingHorizontal: 20, paddingVertical: 10,
    backgroundColor: "#7C3AED", borderRadius: 10,
  },
  emptyBtnText: { color: "#FFF", fontWeight: "700", fontSize: 13 },

  listContent: { padding: 14, paddingBottom: 40 },

  filtrosRow: { gap: 8, paddingVertical: 4, paddingRight: 8, marginBottom: 10 },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: "#0f172a", borderRadius: 20,
    borderWidth: 1, borderColor: "#1e293b",
  },
  chipActive: { backgroundColor: "#7C3AED", borderColor: "#7C3AED" },
  chipText: { color: "#94A3B8", fontSize: 12, fontWeight: "600" },
  chipTextActive: { color: "#FFF" },
  chipBadge: {
    paddingHorizontal: 6, paddingVertical: 1,
    backgroundColor: "#020617", borderRadius: 8, marginLeft: 2,
  },
  chipBadgeActive: { backgroundColor: "rgba(255,255,255,0.2)" },
  chipBadgeText: { color: "#64748B", fontSize: 10, fontWeight: "700" },
  chipBadgeTextActive: { color: "#FFF" },

  card: {
    backgroundColor: "#0f172a", borderRadius: 16, marginBottom: 12,
    borderWidth: 1, borderColor: "#1e293b",
    overflow: "hidden", flexDirection: "row",
  },
  cardAccent: { width: 4 },
  cardBody: { flex: 1, flexDirection: "row", padding: 12, gap: 12 },

  cardImgPlaceholder: {
    width: 56, height: 56, borderRadius: 12,
    justifyContent: "center", alignItems: "center",
  },

  cardTitle: { color: "#FFF", fontSize: 14, fontWeight: "700" },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 4 },
  statusText: { fontSize: 11, fontWeight: "700" },
  metaText: { color: "#64748B", fontSize: 10 },
  cardMeta: { color: "#94A3B8", fontSize: 11, marginTop: 3 },

  cardActions: { justifyContent: "space-between", alignItems: "center", gap: 6 },
  actionBtn: {
    padding: 6, borderRadius: 8,
    backgroundColor: "#020617", borderWidth: 1, borderColor: "#1e293b",
  },

  footerLoading: {
    flexDirection: "row", justifyContent: "center",
    alignItems: "center", gap: 10, paddingVertical: 20,
  },
  footerLoadingText: { color: "#64748B", fontSize: 12 },
  footerEnd: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingVertical: 24, paddingHorizontal: 20,
  },
  footerEndLine: { flex: 1, height: 1, backgroundColor: "#0f172a" },
  footerEndText: { color: "#334155", fontSize: 11, fontStyle: "italic" },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
  modalCard: {
    backgroundColor: "#0f172a",
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, maxHeight: "95%",
    borderTopWidth: 1, borderColor: "#1e293b",
  },
  modalHeader: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", marginBottom: 16,
  },
  modalTitle: { color: "#FFF", fontSize: 17, fontWeight: "bold" },

  label: {
    color: "#94A3B8", fontSize: 12, fontWeight: "600",
    marginTop: 14, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5,
  },
  input: {
    backgroundColor: "#020617", borderWidth: 1, borderColor: "#1e293b",
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    color: "#FFF", fontSize: 14,
  },
  inputMultiline: { minHeight: 70, textAlignVertical: "top" },

  statusPicker: {
    flexDirection: "row", flexWrap: "wrap", gap: 8,
  },
  statusOption: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: "#020617", borderRadius: 20,
    borderWidth: 1, borderColor: "#1e293b",
  },
  statusOptionText: { color: "#94A3B8", fontSize: 12, fontWeight: "600" },

  switchRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    marginTop: 18, paddingHorizontal: 4,
  },
  switchLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  switchLabel: { color: "#E2E8F0", fontSize: 14, fontWeight: "600" },

  modalActions: { flexDirection: "row", gap: 12, marginTop: 24, marginBottom: 10 },
  btn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  btnCancel: { backgroundColor: "#1e293b" },
  btnCancelText: { color: "#94A3B8", fontWeight: "700" },
  btnSave: { backgroundColor: "#7C3AED" },
  btnSaveText: { color: "#FFF", fontWeight: "700" },
  btnNegar: { backgroundColor: "#dc2626" },

  colorModalOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "center", alignItems: "center", padding: 24,
  },
  colorModalCard: {
    width: "100%", maxWidth: 380,
    backgroundColor: "#0f172a", borderRadius: 20,
    padding: 20, borderWidth: 1, borderColor: "#1e293b",
  },
  colorModalTitle: { color: "#FFF", fontSize: 15, fontWeight: "700" },
  negarHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  negarSub: { color: "#94A3B8", fontSize: 13, marginBottom: 4 },

  detalleOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.85)", justifyContent: "flex-end" },
  detalleCard: {
    backgroundColor: "#0f172a",
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: "90%", overflow: "hidden",
    borderTopWidth: 1, borderColor: "#1e293b",
  },
  detalleHeader: {
    position: "relative", paddingTop: 16,
    paddingHorizontal: 20, paddingBottom: 20, overflow: "hidden",
  },
  detalleAccent: { position: "absolute", top: 0, left: 0, right: 0, height: 4 },
  detalleIconWrap: { marginBottom: 12 },
  detalleHeaderContent: { paddingRight: 40 },
  detalleTitle: { color: "#FFF", fontSize: 20, fontWeight: "800", marginBottom: 8 },
  detalleStatusPill: {
    flexDirection: "row", alignItems: "center", gap: 5,
    alignSelf: "flex-start",
    backgroundColor: "#020617",
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 20, borderWidth: 1, borderColor: "#1e293b",
  },
  detalleStatusText: { fontSize: 12, fontWeight: "700" },
  detalleClose: {
    position: "absolute", top: 12, right: 12,
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center", alignItems: "center",
  },
  detalleScroll: { paddingHorizontal: 20, maxHeight: 420 },
  detalleSection: { marginBottom: 20 },
  detalleSectionLabel: {
    color: "#64748B", fontSize: 11, fontWeight: "700",
    textTransform: "uppercase", letterSpacing: 1, marginBottom: 8,
  },
  detalleDescripcion: { color: "#E2E8F0", fontSize: 13, lineHeight: 19 },
  detalleFechasGrid: { flexDirection: "row", gap: 10 },
  detalleFechaBox: {
    flex: 1, backgroundColor: "#020617",
    padding: 12, borderRadius: 12,
    borderWidth: 1, borderColor: "#1e293b",
  },
  detalleFechaLabel: {
    color: "#64748B", fontSize: 10, fontWeight: "700",
    textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 3,
  },
  detalleFechaValor: { color: "#FFF", fontSize: 13, fontWeight: "700" },

  detalleActions: {
    flexDirection: "row", gap: 8, flexWrap: "wrap",
    padding: 16, paddingTop: 14,
    borderTopWidth: 1, borderTopColor: "#1e293b",
    backgroundColor: "#0b1220",
  },
  detalleBtn: {
    flex: 1, minWidth: 90,
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 12, borderRadius: 12,
  },
  detalleBtnApprove: { backgroundColor: "#064e3b", borderWidth: 1, borderColor: "#10b981" },
  detalleBtnApproveText: { color: "#6ee7b7", fontWeight: "700", fontSize: 12 },
  detalleBtnReject: { backgroundColor: "#78350f", borderWidth: 1, borderColor: "#f59e0b" },
  detalleBtnRejectText: { color: "#fbbf24", fontWeight: "700", fontSize: 12 },
  detalleBtnEdit: { backgroundColor: "#7C3AED" },
  detalleBtnEditText: { color: "#FFF", fontWeight: "700", fontSize: 12 },
});