import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  Modal,
  ActivityIndicator,
  TextInput as RNTextInput,
  KeyboardAvoidingView,
  Platform,
  Image,
  Switch,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text, Alert } from "../i18n/ui";
import { Ionicons, MaterialCommunityIcons, Feather } from "@expo/vector-icons";

import {
  fetchCategorias,
  createCategoria,
  updateCategoria,
  deleteCategoria,
  seedCategorias,
  resolveUrl,
} from "../services/api";

// ================================================================
// CONSTANTES
// ================================================================

const ICONOS = [
  "grid", "user", "users", "smile", "smartphone", "home",
  "activity", "star", "gift", "shopping-bag", "book",
  "truck", "box", "music", "coffee", "tag", "heart",
];

const ICONO_FALLBACK = {
  woman: "user",
  man: "user",
  happy: "smile",
  sparkles: "star",
  car: "truck",
  "gamepad-2": "box",
  "phone-portrait": "smartphone",
  basketball: "activity",
  "game-controller": "box",
};

const COLORES = [
  "#8B5CF6", "#3b82f6", "#ec4899", "#10b981",
  "#f59e0b", "#ef4444", "#06b6d4", "#84cc16",
];

const NIVEL_LABEL = { 1: "Categoría", 2: "Subcategoría", 3: "Sub-subcategoría" };
const MAX_NIVEL = 3;

// ================================================================
// HELPERS
// ================================================================

const safeIcon = (name) => {
  if (!name) return "grid";
  if (ICONOS.includes(name)) return name;
  return ICONO_FALLBACK[name] || "grid";
};

// ================================================================
// COMPONENTE PRINCIPAL
// ================================================================

export default function ManageCategoriesScreen({ navigation }) {
  // ---------- Estado de datos ----------
  const [categorias, setCategorias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // ---------- Estado de expansión (árbol) ----------
  const [expandidos, setExpandidos] = useState(new Set());

  // ---------- Estado del modal ----------
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    nombre: "",
    icono: "grid",
    color: "#8B5CF6",
    imagen: "",
    padre_id: null,
    destacada: false,
    orden: 0,
    activo: true,
  });

  // ================================================================
  // CARGA DE DATOS
  // ================================================================

  const cargar = useCallback(async ({ isRefresh = false } = {}) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const data = await fetchCategorias();
      setCategorias(Array.isArray(data) ? data : []);
    } catch (e) {
      console.log("❌ Error cargando categorías:", e?.message);
      setError(e?.message || "No se pudieron cargar las categorías");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // ================================================================
  // DATOS DERIVADOS
  // ================================================================

  const categoriasPorId = useMemo(() => {
    const m = {};
    categorias.forEach((c) => {
      m[c.id] = c;
    });
    return m;
  }, [categorias]);

  const hijosDe = useCallback(
    (padreId) => categorias.filter((c) => c.padre_id === padreId),
    [categorias]
  );

  const raices = useMemo(
    () =>
      categorias
        .filter((c) => !c.padre_id)
        .sort((a, b) => (a.orden || 0) - (b.orden || 0)),
    [categorias]
  );

  // Lista visible según expansión
  const listaVisible = useMemo(() => {
    const out = [];

    const agregarNodos = (nodos, nivelVisual) => {
      nodos.forEach((n) => {
        const hijos = hijosDe(n.id).sort((a, b) => (a.orden || 0) - (b.orden || 0));
        const tieneHijos = hijos.length > 0;
        const estaExpandido = expandidos.has(n.id);

        out.push({
          ...n,
          _nivelVisual: nivelVisual,
          _tieneHijos: tieneHijos,
          _expandido: estaExpandido,
          _totalHijos: hijos.length,
        });

        if (tieneHijos && estaExpandido) {
          agregarNodos(hijos, nivelVisual + 1);
        }
      });
    };

    agregarNodos(raices, 0);
    return out;
  }, [raices, expandidos, hijosDe]);

  // ================================================================
  // HANDLERS — EXPANSIÓN
  // ================================================================

  const toggleExpandir = (id) => {
    setExpandidos((prev) => {
      const nuevo = new Set(prev);
      if (nuevo.has(id)) nuevo.delete(id);
      else nuevo.add(id);
      return nuevo;
    });
  };

  const expandirTodo = () => {
    const todos = new Set(
      categorias.filter((c) => hijosDe(c.id).length > 0).map((c) => c.id)
    );
    setExpandidos(todos);
  };

  const colapsarTodo = () => {
    setExpandidos(new Set());
  };

  // ================================================================
  // HANDLERS — MODAL
  // ================================================================

  const abrirCrear = (padre = null) => {
    // 🎯 Bloquea si el padre es nivel 3 (nieto)
    if (padre) {
      const nivelPadre =
        Number(padre.nivel) ||
        (padre._nivelVisual != null ? padre._nivelVisual + 1 : 1);

      if (nivelPadre >= MAX_NIVEL) {
        Alert.alert(
          "Nivel máximo alcanzado",
          `"${padre.nombre}" ya está en el nivel ${MAX_NIVEL}. No se permiten más subcategorías debajo.`
        );
        return;
      }
    }

    setEditing(null);
    setForm({
      nombre: "",
      icono: "grid",
      color: padre?.color || "#8B5CF6",
      imagen: "",
      padre_id: padre?.id || null,
      destacada: false,
      orden: 0,
      activo: true,
    });
    setModalVisible(true);
  };

  const abrirEditar = (cat) => {
    setEditing(cat);
    setForm({
      nombre: cat.nombre || "",
      icono: safeIcon(cat.icono),
      color: cat.color || "#8B5CF6",
      imagen: cat.imagen || "",
      padre_id: cat.padre_id || null,
      destacada: !!cat.destacada,
      orden: Number(cat.orden || 0),
      activo: cat.activo !== false,
    });
    setModalVisible(true);
  };

  const cerrarModal = () => {
    if (saving) return;
    setModalVisible(false);
  };

  // ================================================================
  // HANDLERS — CRUD
  // ================================================================

  const guardar = async () => {
    if (!form.nombre.trim()) {
      Alert.alert("Campo requerido", "El nombre de la categoría es obligatorio.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        nombre: form.nombre.trim(),
        padre_id: form.padre_id || null,
        icono: form.icono || "grid",
        color: form.color || "#8B5CF6",
        imagen: form.imagen.trim() || "",
        destacada: !!form.destacada,
        orden: Number(form.orden) || 0,
      };

      if (editing) {
        await updateCategoria(editing.id, { ...payload, activo: form.activo !== false });
      } else {
        await createCategoria(payload);
        if (form.padre_id) {
          setExpandidos((prev) => new Set(prev).add(form.padre_id));
        }
      }
      setModalVisible(false);
      await cargar({ isRefresh: true });
    } catch (e) {
      Alert.alert("Error", e?.message || "No se pudo guardar la categoría");
    } finally {
      setSaving(false);
    }
  };

  const confirmarEliminar = (cat) => {
    const hijos = hijosDe(cat.id).length;
    const msg = hijos > 0
      ? `"${cat.nombre}" tiene ${hijos} subcategoría(s). El servidor rechazará la operación hasta que elimines las hijas.`
      : `¿Seguro que deseas eliminar "${cat.nombre}"?`;

    Alert.alert("Eliminar categoría", msg, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteCategoria(cat.id);
            await cargar({ isRefresh: true });
          } catch (e) {
            Alert.alert("No se pudo eliminar", e?.message || "Error del servidor");
          }
        },
      },
    ]);
  };

  const poblarDemo = () => {
    Alert.alert(
      "Cargar estructura demo",
      "Se crearán ~200 categorías (Mujer, Hombre, Niños, Electrónica…). ¿Continuar?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Sí, cargar",
          onPress: async () => {
            try {
              const r = await seedCategorias(false);
              Alert.alert("Listo", r?.message || "Categorías cargadas");
              await cargar({ isRefresh: true });
            } catch (e) {
              Alert.alert(
                "Seed",
                e?.message || "No se pudo cargar (¿ya hay categorías? usa force)"
              );
            }
          },
        },
      ]
    );
  };

  // ================================================================
  // RENDER — FILA DE CATEGORÍA
  // ================================================================

  const renderItem = ({ item }) => {
    const color = item.color || "#8B5CF6";
    const nivelVisual = item._nivelVisual;
    const tieneHijos = item._tieneHijos;
    const expandido = item._expandido;
    const imagenUrl = item.imagen ? resolveUrl(item.imagen) : null;

    // 🎯 Nivel real calculado desde la jerarquía (más confiable)
    const nivelReal = nivelVisual + 1; // raíz=1, hijo=2, nieto=3
    const puedeAnadirHijos = nivelReal < MAX_NIVEL;

    const indentacion = nivelVisual * 24;

    return (
      <View style={[styles.row, { marginLeft: 8 + indentacion }]}>
        {/* Chevron expandir/colapsar */}
        <TouchableOpacity
          style={styles.chevronBtn}
          onPress={() => tieneHijos && toggleExpandir(item.id)}
          disabled={!tieneHijos}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          {tieneHijos ? (
            <Ionicons
              name={expandido ? "chevron-down" : "chevron-forward"}
              size={18}
              color="#94A3B8"
            />
          ) : (
            <View style={styles.leafDot} />
          )}
        </TouchableOpacity>

        {/* Icono / imagen */}
        <View style={[styles.rowIcon, { backgroundColor: `${color}20` }]}>
          {imagenUrl ? (
            <Image source={{ uri: imagenUrl }} style={styles.rowImg} />
          ) : (
            <Feather name={safeIcon(item.icono)} size={16} color={color} />
          )}
        </View>

        {/* Texto */}
        <View style={{ flex: 1 }}>
          <View style={styles.rowTitleWrap}>
            <Text style={styles.rowTitle} numberOfLines={1}>
              {item.nombre}
            </Text>
            {item.destacada && <Ionicons name="star" size={11} color="#f59e0b" />}
            {!item.activo && (
              <View style={styles.inactivoPill}>
                <Text style={styles.inactivoPillText}>Inactiva</Text>
              </View>
            )}
          </View>
          <Text style={styles.rowSub}>
            {NIVEL_LABEL[nivelReal] || `Nivel ${nivelReal}`}
            {tieneHijos ? ` · ${item._totalHijos} hijas` : ""}
          </Text>
        </View>

        {/* Botón "+" SOLO si puede tener hijos (nivel 1 o 2) */}
        {puedeAnadirHijos && (
          <TouchableOpacity
            style={styles.rowAction}
            onPress={() => abrirCrear(item)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="add-circle-outline" size={20} color="#10b981" />
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.rowAction}
          onPress={() => abrirEditar(item)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather name="edit-2" size={16} color="#3b82f6" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.rowAction}
          onPress={() => confirmarEliminar(item)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather name="trash-2" size={16} color="#ef4444" />
        </TouchableOpacity>
      </View>
    );
  };

  // ================================================================
  // RENDER — VACÍO / CABECERA
  // ================================================================

  const renderEmpty = () => {
    if (loading) return null;
    return (
      <View style={styles.center}>
        <MaterialCommunityIcons name="folder-table" size={56} color="#334155" />
        <Text style={styles.emptyTitle}>Aún no hay categorías</Text>
        <Text style={styles.emptySub}>
          Crea la primera con "Nueva" o carga la estructura demo con el ícono de la barra.
        </Text>
      </View>
    );
  };

  const renderHeader = () => {
    if (raices.length === 0) return null;
    return (
      <View style={styles.listHeader}>
        <Text style={styles.listHeaderText}>
          {raices.length} categorías raíz · toca ▶ para desplegar
        </Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerActionBtn} onPress={expandirTodo}>
            <Feather name="chevrons-down" size={12} color="#94A3B8" />
            <Text style={styles.headerActionText}>Expandir</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerActionBtn} onPress={colapsarTodo}>
            <Feather name="chevrons-up" size={12} color="#94A3B8" />
            <Text style={styles.headerActionText}>Colapsar</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // ================================================================
  // RENDER PRINCIPAL
  // ================================================================

  return (
    <SafeAreaView style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#FFF" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Gestión de Categorías</Text>
          <Text style={styles.headerSub}>
            {categorias.length} total · {raices.length} raíz
          </Text>
        </View>
        <TouchableOpacity style={styles.iconBtn} onPress={poblarDemo}>
          <MaterialCommunityIcons name="database-plus-outline" size={20} color="#94A3B8" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.addBtn} onPress={() => abrirCrear(null)}>
          <Ionicons name="add" size={20} color="#FFF" />
          <Text style={styles.addBtnText}>Nueva</Text>
        </TouchableOpacity>
      </View>

      {/* ERROR */}
      {error && (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle" size={18} color="#EF4444" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => cargar()}>
            <Text style={styles.retryText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* CONTENIDO */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#7C3AED" />
        </View>
      ) : (
        <FlatList
          data={listaVisible}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => cargar({ isRefresh: true })}
              colors={["#7C3AED"]}
              tintColor="#7C3AED"
              progressBackgroundColor="#0f172a"
            />
          }
        />
      )}

      {/* MODAL CREAR / EDITAR */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={cerrarModal}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editing ? "Editar categoría" : "Nueva categoría"}
              </Text>
              <TouchableOpacity onPress={cerrarModal}>
                <Ionicons name="close" size={22} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.label}>Nombre *</Text>
              <RNTextInput
                style={styles.input}
                value={form.nombre}
                onChangeText={(t) => setForm((f) => ({ ...f, nombre: t }))}
                placeholder="Ej. Electrónica"
                placeholderTextColor="#475569"
              />

              {form.padre_id && (
                <View style={styles.parentInfo}>
                  <Ionicons name="git-branch-outline" size={14} color="#94A3B8" />
                  <Text style={styles.parentInfoText}>
                    Subcategoría de: {categoriasPorId[form.padre_id]?.nombre || "—"}
                  </Text>
                </View>
              )}

              <Text style={styles.label}>Color</Text>
              <View style={styles.chipRow}>
                {COLORES.map((c) => (
                  <TouchableOpacity
                    key={c}
                    style={[
                      styles.colorDot,
                      { backgroundColor: c },
                      form.color === c && styles.colorDotActive,
                    ]}
                    onPress={() => setForm((f) => ({ ...f, color: c }))}
                  />
                ))}
              </View>

              <Text style={styles.label}>Ícono</Text>
              <View style={styles.chipRow}>
                {ICONOS.map((ic) => (
                  <TouchableOpacity
                    key={ic}
                    style={[
                      styles.iconChip,
                      form.icono === ic && {
                        borderColor: form.color,
                        backgroundColor: `${form.color}20`,
                      },
                    ]}
                    onPress={() => setForm((f) => ({ ...f, icono: ic }))}
                  >
                    <Feather
                      name={ic}
                      size={18}
                      color={form.icono === ic ? form.color : "#94A3B8"}
                    />
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>URL de imagen (opcional)</Text>
              <RNTextInput
                style={styles.input}
                value={form.imagen}
                onChangeText={(t) => setForm((f) => ({ ...f, imagen: t }))}
                placeholder="https://..."
                placeholderTextColor="#475569"
                autoCapitalize="none"
              />

              <Text style={styles.label}>Orden (menor = primero)</Text>
              <RNTextInput
                style={styles.input}
                value={String(form.orden)}
                onChangeText={(t) =>
                  setForm((f) => ({ ...f, orden: t.replace(/[^0-9]/g, "") }))
                }
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor="#475569"
              />

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Destacada</Text>
                <Switch
                  value={form.destacada}
                  onValueChange={(v) => setForm((f) => ({ ...f, destacada: v }))}
                  trackColor={{ false: "#1e293b", true: "#7C3AED80" }}
                  thumbColor={form.destacada ? "#7C3AED" : "#64748B"}
                />
              </View>

              {editing && (
                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>Activa</Text>
                  <Switch
                    value={form.activo}
                    onValueChange={(v) => setForm((f) => ({ ...f, activo: v }))}
                    trackColor={{ false: "#1e293b", true: "#10b98180" }}
                    thumbColor={form.activo ? "#10b981" : "#64748B"}
                  />
                </View>
              )}

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.btn, styles.btnCancel]}
                  onPress={cerrarModal}
                  disabled={saving}
                >
                  <Text style={styles.btnCancelText}>Cancelar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.btn, styles.btnSave]}
                  onPress={guardar}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <Text style={styles.btnSaveText}>
                      {editing ? "Guardar cambios" : "Crear categoría"}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
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
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 50,
    paddingBottom: 16,
    backgroundColor: "#0f172a",
    borderBottomWidth: 1,
    borderColor: "#1e293b",
  },
  backBtn: { padding: 6, borderRadius: 10, backgroundColor: "#1e293b" },
  iconBtn: {
    padding: 8,
    borderRadius: 10,
    backgroundColor: "#1e293b",
    borderWidth: 1,
    borderColor: "#334155",
  },
  headerTitle: { color: "#FFF", fontSize: 17, fontWeight: "bold" },
  headerSub: { color: "#64748B", fontSize: 12, marginTop: 2 },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#7C3AED",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  addBtnText: { color: "#FFF", fontWeight: "700", fontSize: 13 },

  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    margin: 16,
    padding: 12,
    backgroundColor: "#450a0a",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#7f1d1d",
  },
  errorText: { flex: 1, color: "#fecaca", fontSize: 13 },
  retryText: { color: "#f87171", fontWeight: "700", fontSize: 13 },

  emptyTitle: { color: "#FFF", fontSize: 16, fontWeight: "700", marginTop: 14 },
  emptySub: { color: "#64748B", fontSize: 13, marginTop: 6, textAlign: "center" },

  listContent: { paddingVertical: 8, paddingBottom: 40 },
  listHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#0f172a",
    marginBottom: 4,
  },
  listHeaderText: { color: "#64748B", fontSize: 11, fontStyle: "italic", flex: 1 },
  headerActions: { flexDirection: "row", gap: 12 },
  headerActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "#0f172a",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#1e293b",
  },
  headerActionText: { color: "#94A3B8", fontSize: 10, fontWeight: "600" },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingRight: 14,
    marginRight: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#0f172a",
  },
  chevronBtn: {
    width: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  leafDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#334155",
  },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  rowImg: { width: 34, height: 34, borderRadius: 9 },
  rowTitleWrap: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  rowTitle: { color: "#E2E8F0", fontSize: 13, fontWeight: "600", maxWidth: 160 },
  rowSub: { color: "#64748B", fontSize: 10, marginTop: 2 },
  rowAction: { padding: 5 },
  inactivoPill: {
    backgroundColor: "#7f1d1d40",
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 5,
  },
  inactivoPillText: { color: "#fca5a5", fontSize: 8, fontWeight: "700" },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: "#0f172a",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: "92%",
    borderTopWidth: 1,
    borderColor: "#1e293b",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: { color: "#FFF", fontSize: 17, fontWeight: "bold" },

  label: {
    color: "#94A3B8",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 14,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: "#020617",
    borderWidth: 1,
    borderColor: "#1e293b",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#FFF",
    fontSize: 14,
  },
  parentInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
    padding: 10,
    backgroundColor: "#020617",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#1e293b",
  },
  parentInfoText: { color: "#94A3B8", fontSize: 12 },

  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  colorDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "transparent",
  },
  colorDotActive: { borderColor: "#FFF", transform: [{ scale: 1.1 }] },
  iconChip: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#1e293b",
    backgroundColor: "#020617",
  },

  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 18,
    paddingHorizontal: 4,
  },
  switchLabel: { color: "#E2E8F0", fontSize: 14, fontWeight: "600" },

  modalActions: { flexDirection: "row", gap: 12, marginTop: 24, marginBottom: 10 },
  btn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  btnCancel: { backgroundColor: "#1e293b" },
  btnCancelText: { color: "#94A3B8", fontWeight: "700" },
  btnSave: { backgroundColor: "#7C3AED" },
  btnSaveText: { color: "#FFF", fontWeight: "700" },
});