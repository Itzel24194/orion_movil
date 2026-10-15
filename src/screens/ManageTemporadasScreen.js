import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View, StyleSheet, ScrollView, TouchableOpacity, FlatList, Modal,
  ActivityIndicator, TextInput as RNTextInput, KeyboardAvoidingView,
  Platform, Switch, RefreshControl, Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text, Alert } from "../i18n/ui";
import { Ionicons, MaterialCommunityIcons, Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";

import {
  fetchTemporadas,
  createTemporada,
  updateTemporada,
  deleteTemporada,
  resolveUrl,
} from "../services/api";

import { usePreferences } from "../context/PreferencesContext";

// ================================================================
// CONSTANTES
// ================================================================

const PAGE_SIZE = 10;

const COLORES = [
  "#7C3AED", "#3b82f6", "#ec4899", "#10b981",
  "#f59e0b", "#ef4444", "#06b6d4", "#84cc16",
];

const FILTROS = [
  { id: "todas",     labelKey: "Todas",       icon: "grid" },
  { id: "en_curso",  labelKey: "En curso",    icon: "play-circle" },
  { id: "proxima",   labelKey: "Próximas",    icon: "clock" },
  { id: "finalizada",labelKey: "Pasadas",     icon: "check-circle" },
  { id: "destacada", labelKey: "Destacadas",  icon: "star" },
];

// ================================================================
// HELPERS
// ================================================================

const pad = (n) => String(n).padStart(2, "0");

const toISODate = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const parseISODate = (s) => {
  if (!s) return null;
  const d = new Date(`${s}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
};

const formatFecha = (iso) => {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return `${pad(d.getDate())} ${["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"][d.getMonth()]} ${d.getFullYear()}`;
  } catch {
    return "—";
  }
};

const esFechaValida = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && parseISODate(s);

const estadoTemporada = (t) => {
  if (!t.activa) return { key: "inactiva", labelKey: "Inactiva", color: "#64748B", icon: "pause-circle" };
  const hoy = new Date();
  const fi = t.fecha_inicio ? new Date(t.fecha_inicio) : null;
  const ff = t.fecha_fin ? new Date(t.fecha_fin) : null;
  if (fi && hoy < fi) return { key: "proxima", labelKey: "Próxima", color: "#3b82f6", icon: "clock" };
  if (ff && hoy > ff) return { key: "finalizada", labelKey: "Finalizada", color: "#64748B", icon: "check-circle" };
  if (fi && ff && hoy >= fi && hoy <= ff) return { key: "en_curso", labelKey: "En curso", color: "#10b981", icon: "play-circle" };
  return { key: "activa", labelKey: "Activa", color: "#10b981", icon: "check-circle" };
};

const progresoTemporada = (t) => {
  if (!t.fecha_inicio || !t.fecha_fin) return 0;
  const fi = new Date(t.fecha_inicio).getTime();
  const ff = new Date(t.fecha_fin).getTime();
  const ahora = Date.now();
  if (ahora <= fi) return 0;
  if (ahora >= ff) return 1;
  return (ahora - fi) / (ff - fi);
};

const diasRestantes = (t) => {
  if (!t.fecha_fin) return null;
  const ff = new Date(t.fecha_fin).getTime();
  return Math.ceil((ff - Date.now()) / (1000 * 60 * 60 * 24));
};

const duracionTotal = (t) => {
  if (!t.fecha_inicio || !t.fecha_fin) return null;
  const fi = new Date(t.fecha_inicio).getTime();
  const ff = new Date(t.fecha_fin).getTime();
  return Math.round((ff - fi) / (1000 * 60 * 60 * 24));
};

// ================================================================
// COMPONENTE
// ================================================================

export default function ManageTemporadasScreen({ navigation }) {
  const { t } = usePreferences();

  const [temporadas, setTemporadas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);

  const [filtro, setFiltro] = useState("todas");

  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  const [detalle, setDetalle] = useState(null);

  // 🆕 estado para subir imagen
  const [uploadingImage, setUploadingImage] = useState(false);

  const hoy = new Date();
  const defaultForm = () => ({
    nombre: "",
    descripcion: "",
    imagen: "",
    color: "#7C3AED",
    destacada: false,
    fecha_inicio: toISODate(hoy),
    fecha_fin: toISODate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)),
    activa: true,
  });
  const [form, setForm] = useState(defaultForm());

  // ================================================================
  // CARGA
  // ================================================================

  const cargar = useCallback(async ({ isRefresh = false } = {}) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const data = await fetchTemporadas({ incluir_inactivas: true });
      setTemporadas(Array.isArray(data) ? data : []);
      setPage(1);
    } catch (e) {
      console.log("❌ Error cargando temporadas:", e?.message);
      setError(e?.message || "No se pudieron cargar las temporadas");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  // ================================================================
  // DERIVADOS
  // ================================================================

  const ordenadas = useMemo(
    () =>
      [...temporadas].sort((a, b) => {
        const fa = a.fecha_inicio ? new Date(a.fecha_inicio).getTime() : 0;
        const fb = b.fecha_inicio ? new Date(b.fecha_inicio).getTime() : 0;
        return fb - fa;
      }),
    [temporadas]
  );

  const filtradas = useMemo(() => {
    if (filtro === "todas") return ordenadas;
    if (filtro === "destacada") return ordenadas.filter((x) => x.destacada);
    return ordenadas.filter((x) => estadoTemporada(x).key === filtro);
  }, [ordenadas, filtro]);

  const paginadas = useMemo(
    () => filtradas.slice(0, page * PAGE_SIZE),
    [filtradas, page]
  );

  const hayMas = paginadas.length < filtradas.length;

  const conteos = useMemo(() => {
    const c = { todas: ordenadas.length, en_curso: 0, proxima: 0, finalizada: 0, destacada: 0 };
    ordenadas.forEach((x) => {
      const e = estadoTemporada(x);
      if (c[e.key] !== undefined) c[e.key]++;
      if (x.destacada) c.destacada++;
    });
    return c;
  }, [ordenadas]);

  const enCurso = useMemo(
    () => ordenadas.find((x) => estadoTemporada(x).key === "en_curso" && x.destacada)
      || ordenadas.find((x) => estadoTemporada(x).key === "en_curso"),
    [ordenadas]
  );

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
  // 🆕 SUBIR IMAGEN DESDE GALERÍA
  // ================================================================

  const pedirPermisosGaleria = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        t("Permiso denegado"),
        t("Necesitamos acceso a tu galería para subir la imagen.")
      );
      return false;
    }
    return true;
  };

  const seleccionarDeGaleria = async () => {
    try {
      const ok = await pedirPermisosGaleria();
      if (!ok) return;

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
        base64: true, // 👈 nos da la imagen en base64
      });

      if (result.canceled) return;

      const asset = result.assets?.[0];
      if (!asset?.base64) {
        Alert.alert(t("Error"), t("No se pudo leer la imagen."));
        return;
      }

      // Formato data URI listo para backend que acepte base64
      const mime = asset.mimeType || "image/jpeg";
      const dataUri = `data:${mime};base64,${asset.base64}`;

      setForm((f) => ({ ...f, imagen: dataUri }));
    } catch (e) {
      console.log("❌ Error seleccionando imagen:", e);
      Alert.alert(t("Error"), t("No se pudo abrir la galería."));
    }
  };

  const tomarFoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(t("Permiso denegado"), t("Necesitamos acceso a la cámara."));
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
        base64: true,
      });

      if (result.canceled) return;

      const asset = result.assets?.[0];
      if (!asset?.base64) return;

      const mime = asset.mimeType || "image/jpeg";
      const dataUri = `data:${mime};base64,${asset.base64}`;

      setForm((f) => ({ ...f, imagen: dataUri }));
    } catch (e) {
      console.log("❌ Error tomando foto:", e);
      Alert.alert(t("Error"), t("No se pudo abrir la cámara."));
    }
  };

  const abrirOpcionesImagen = () => {
    Alert.alert(
      t("Imagen de la temporada"),
      t("¿De dónde quieres obtener la imagen?"),
      [
        { text: t("Galería"), onPress: seleccionarDeGaleria },
        { text: t("Cámara"), onPress: tomarFoto },
        {
          text: t("Quitar imagen"),
          style: "destructive",
          onPress: () => setForm((f) => ({ ...f, imagen: "" })),
        },
        { text: t("Cancelar"), style: "cancel" },
      ]
    );
  };

  // ================================================================
  // MODALES CRUD
  // ================================================================

  const abrirCrear = () => {
    setEditing(null);
    setForm(defaultForm());
    setModalVisible(true);
  };

  const abrirEditar = (item) => {
    setEditing(item);
    setForm({
      nombre: item.nombre || "",
      descripcion: item.descripcion || "",
      imagen: item.imagenRaw || item.imagen || "",
      color: item.color || "#7C3AED",
      destacada: !!item.destacada,
      fecha_inicio: item.fecha_inicio ? toISODate(new Date(item.fecha_inicio)) : toISODate(new Date()),
      fecha_fin: item.fecha_fin ? toISODate(new Date(item.fecha_fin)) : toISODate(new Date()),
      activa: item.activa !== false,
    });
    setDetalle(null);
    setModalVisible(true);
  };

  const cerrarModal = () => {
    if (saving) return;
    setModalVisible(false);
  };

  const abrirDetalle = (item) => setDetalle(item);
  const cerrarDetalle = () => setDetalle(null);

  const editarDesdeDetalle = () => {
    if (!detalle) return;
    const item = detalle;
    setDetalle(null);
    setTimeout(() => abrirEditar(item), 250);
  };

  const eliminarDesdeDetalle = () => {
    if (!detalle) return;
    const item = detalle;
    setDetalle(null);
    setTimeout(() => confirmarEliminar(item), 250);
  };

  // ================================================================
  // GUARDAR / ELIMINAR
  // ================================================================

  const guardar = async () => {
    if (!form.nombre.trim()) {
      Alert.alert(t("Campo requerido"), t("El nombre de la temporada es obligatorio."));
      return;
    }
    if (!esFechaValida(form.fecha_inicio)) {
      Alert.alert(t("Fecha inválida"), t("Usa el formato YYYY-MM-DD (ej. 2025-01-15)"));
      return;
    }
    if (!esFechaValida(form.fecha_fin)) {
      Alert.alert(t("Fecha inválida"), t("Usa el formato YYYY-MM-DD (ej. 2025-02-15)"));
      return;
    }
    const fi = parseISODate(form.fecha_inicio);
    const ff = parseISODate(form.fecha_fin);
    if (fi > ff) {
      Alert.alert(t("Fechas incoherentes"), t("La fecha de inicio no puede ser mayor a la de fin."));
      return;
    }

    setSaving(true);
    try {
      const payload = {
        nombre: form.nombre.trim(),
        descripcion: form.descripcion.trim(),
        imagen: form.imagen.trim(),
        color: form.color,
        destacada: !!form.destacada,
        fecha_inicio: form.fecha_inicio,
        fecha_fin: form.fecha_fin,
        activa: !!form.activa,
      };

      if (editing) {
        await updateTemporada(editing.id, payload);
      } else {
        await createTemporada(payload);
      }
      setModalVisible(false);
      await cargar({ isRefresh: true });
    } catch (e) {
      Alert.alert(t("Error"), e?.message || t("No se pudo guardar la temporada"));
    } finally {
      setSaving(false);
    }
  };

  const confirmarEliminar = (item) => {
    const productos = item.productosCount || 0;
    const msg = productos > 0
      ? `"${item.nombre}" ${t("tiene")} ${productos} ${t("producto(s) asociado(s). El servidor rechazará la operación.")}`
      : `${t("¿Seguro que deseas eliminar")} "${item.nombre}"?`;

    Alert.alert(t("Eliminar temporada"), msg, [
      { text: t("Cancelar"), style: "cancel" },
      {
        text: t("Eliminar"),
        style: "destructive",
        onPress: async () => {
          try {
            await deleteTemporada(item.id);
            await cargar({ isRefresh: true });
          } catch (e) {
            Alert.alert(t("No se pudo eliminar"), e?.message || t("Error del servidor"));
          }
        },
      },
    ]);
  };

  // ================================================================
  // HERO
  // ================================================================

  const renderHero = () => {
    if (!enCurso) return null;
    const color = enCurso.color || "#10b981";
    const progreso = progresoTemporada(enCurso);
    const dias = diasRestantes(enCurso);
    const imagenUrl = enCurso.imagen ? resolveUrl(enCurso.imagen) : null;

    return (
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => abrirDetalle(enCurso)}
        style={[styles.hero, { borderColor: `${color}40` }]}
      >
        <View style={[styles.heroBg, { backgroundColor: `${color}10` }]} />
        {imagenUrl && (
          <Image source={{ uri: imagenUrl }} style={styles.heroImage} resizeMode="cover" />
        )}
        <View style={styles.heroOverlay}>
          <View style={styles.heroBadge}>
            <View style={[styles.heroDot, { backgroundColor: color }]} />
            <Text style={[styles.heroBadgeText, { color }]}>
              {t("EN CURSO · TOCA PARA VER")}
            </Text>
          </View>
          <Text style={styles.heroTitle} numberOfLines={1}>{enCurso.nombre}</Text>
          {enCurso.descripcion ? (
            <Text style={styles.heroDesc} numberOfLines={2}>{enCurso.descripcion}</Text>
          ) : null}

          <View style={styles.heroProgressWrap}>
            <View style={styles.heroProgressBg}>
              <View
                style={[
                  styles.heroProgressFill,
                  { width: `${Math.round(progreso * 100)}%`, backgroundColor: color },
                ]}
              />
            </View>
            <Text style={styles.heroProgressText}>
              {dias !== null && dias >= 0
                ? `${dias} ${t(dias === 1 ? "día restante" : "días restantes")}`
                : t("Finalizando")}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // ================================================================
  // FILTROS
  // ================================================================

  const renderFiltros = () => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.filtrosRow}
    >
      {FILTROS.map((f) => {
        const activo = filtro === f.id;
        const count = conteos[f.id] ?? 0;
        return (
          <TouchableOpacity
            key={f.id}
            style={[styles.chip, activo && styles.chipActive]}
            onPress={() => cambiarFiltro(f.id)}
            activeOpacity={0.7}
          >
            <Feather name={f.icon} size={13} color={activo ? "#FFF" : "#94A3B8"} />
            <Text style={[styles.chipText, activo && styles.chipTextActive]}>
              {t(f.labelKey)}
            </Text>
            <View style={[styles.chipBadge, activo && styles.chipBadgeActive]}>
              <Text style={[styles.chipBadgeText, activo && styles.chipBadgeTextActive]}>
                {count}
              </Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );

  // ================================================================
  // CARD
  // ================================================================

  const renderItem = ({ item }) => {
    const estado = estadoTemporada(item);
    const color = item.color || estado.color;
    const imagenUrl = item.imagen ? resolveUrl(item.imagen) : null;
    const progreso = progresoTemporada(item);
    const mostrarProgreso = estado.key === "en_curso";
    const dias = diasRestantes(item);

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => abrirDetalle(item)}
        activeOpacity={0.85}
      >
        <View style={[styles.cardAccent, { backgroundColor: color }]} />

        <View style={styles.cardBody}>
          {imagenUrl ? (
            <Image source={{ uri: imagenUrl }} style={styles.cardImg} resizeMode="cover" />
          ) : (
            <View style={[styles.cardImgPlaceholder, { backgroundColor: `${color}18` }]}>
              <Feather name="calendar" size={22} color={color} />
            </View>
          )}

          <View style={{ flex: 1 }}>
            <View style={styles.cardTopRow}>
              <View style={{ flex: 1 }}>
                <View style={styles.cardTitleRow}>
                  <Text style={styles.cardTitle} numberOfLines={1}>{item.nombre}</Text>
                  {item.destacada && (
                    <View style={styles.starPill}>
                      <Ionicons name="star" size={10} color="#f59e0b" />
                    </View>
                  )}
                </View>
                <View style={styles.statusRow}>
                  <Feather name={estado.icon} size={11} color={estado.color} />
                  <Text style={[styles.statusText, { color: estado.color }]}>
                    {t(estado.labelKey)}
                  </Text>
                  {dias !== null && estado.key === "en_curso" && (
                    <Text style={styles.diasText}>· {dias}d {t("restantes")}</Text>
                  )}
                </View>
              </View>
            </View>

            {item.descripcion ? (
              <Text style={styles.cardDesc} numberOfLines={1}>{item.descripcion}</Text>
            ) : null}

            <View style={styles.fechasRow}>
              <Text style={styles.fechaText}>{formatFecha(item.fecha_inicio)}</Text>
              <Feather name="arrow-right" size={11} color="#334155" />
              <Text style={styles.fechaText}>{formatFecha(item.fecha_fin)}</Text>
            </View>

            {mostrarProgreso && (
              <View style={styles.progressWrap}>
                <View style={styles.progressBg}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${Math.round(progreso * 100)}%`, backgroundColor: color },
                    ]}
                  />
                </View>
                <Text style={styles.progressPct}>{Math.round(progreso * 100)}%</Text>
              </View>
            )}
          </View>

          <View style={styles.cardActions}>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={(e) => { e.stopPropagation?.(); abrirDetalle(item); }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Feather name="eye" size={15} color="#10b981" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionBtn}
              onPress={(e) => { e.stopPropagation?.(); abrirEditar(item); }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Feather name="edit-2" size={15} color="#3b82f6" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionBtn}
              onPress={(e) => { e.stopPropagation?.(); confirmarEliminar(item); }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Feather name="trash-2" size={15} color="#ef4444" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.cardFooter}>
          <View style={styles.productosPill}>
            <Ionicons name="cube-outline" size={11} color="#94A3B8" />
            <Text style={styles.productosText}>
              {item.productosCount} {t(item.productosCount === 1 ? "producto" : "productos")}
            </Text>
          </View>
          <Feather name="chevron-right" size={14} color="#334155" />
        </View>
      </TouchableOpacity>
    );
  };

  // ================================================================
  // FOOTER / HEADER / EMPTY
  // ================================================================

  const renderFooter = () => {
    if (loadingMore) {
      return (
        <View style={styles.footerLoading}>
          <ActivityIndicator color="#7C3AED" />
          <Text style={styles.footerLoadingText}>{t("Cargando más…")}</Text>
        </View>
      );
    }
    if (!hayMas && filtradas.length > 0) {
      return (
        <View style={styles.footerEnd}>
          <View style={styles.footerEndLine} />
          <Text style={styles.footerEndText}>
            {t("Mostrando")} {paginadas.length} {t("de")} {filtradas.length}
          </Text>
          <View style={styles.footerEndLine} />
        </View>
      );
    }
    return null;
  };

  const renderListHeader = () => {
    if (filtradas.length === 0) return null;
    const etiquetaFiltro = FILTROS.find((f) => f.id === filtro)?.labelKey;
    return (
      <View style={styles.listHeader}>
        <Text style={styles.listHeaderText}>
          {filtradas.length} {t(filtradas.length === 1 ? "temporada" : "temporadas")}
          {filtro !== "todas" ? ` · ${t("filtro")}: ${t(etiquetaFiltro)}` : ""}
          {" · "}{t("toca para ver detalle")}
        </Text>
      </View>
    );
  };

  const renderEmpty = () => {
    if (loading) return null;
    const esFiltro = filtro !== "todas";
    const etiquetaFiltro = FILTROS.find((f) => f.id === filtro)?.labelKey;
    return (
      <View style={styles.center}>
        <View style={styles.emptyIconWrap}>
          <MaterialCommunityIcons name="calendar-blank-outline" size={48} color="#334155" />
        </View>
        <Text style={styles.emptyTitle}>
          {esFiltro ? t("Sin resultados") : t("Aún no hay temporadas")}
        </Text>
        <Text style={styles.emptySub}>
          {esFiltro
            ? `${t("No hay temporadas en")} "${t(etiquetaFiltro)}".`
            : t('Crea la primera con el botón "Nueva".')}
        </Text>
        {esFiltro && (
          <TouchableOpacity
            style={styles.emptyBtn}
            onPress={() => cambiarFiltro("todas")}
          >
            <Text style={styles.emptyBtnText}>{t("Ver todas")}</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // ================================================================
  // MODAL DE DETALLE
  // ================================================================

  const renderDetalle = () => {
    if (!detalle) return null;
    const item = detalle;
    const estado = estadoTemporada(item);
    const color = item.color || estado.color;
    const imagenUrl = item.imagen ? resolveUrl(item.imagen) : null;
    const progreso = progresoTemporada(item);
    const dias = diasRestantes(item);
    const duracion = duracionTotal(item);

    return (
      <Modal
        visible={!!detalle}
        transparent
        animationType="slide"
        onRequestClose={cerrarDetalle}
      >
        <View style={styles.detalleOverlay}>
          <View style={styles.detalleCard}>
            <View style={[styles.detalleHeader, { backgroundColor: `${color}20` }]}>
              <View style={[styles.detalleAccent, { backgroundColor: color }]} />

              {imagenUrl && (
                <Image
                  source={{ uri: imagenUrl }}
                  style={styles.detalleBanner}
                  resizeMode="cover"
                />
              )}

              <View style={styles.detalleHeaderContent}>
                <View style={styles.detalleTitleRow}>
                  <Text style={styles.detalleTitle} numberOfLines={2}>{item.nombre}</Text>
                  {item.destacada && (
                    <View style={styles.detalleStarPill}>
                      <Ionicons name="star" size={11} color="#f59e0b" />
                      <Text style={styles.detalleStarText}>{t("Destacada")}</Text>
                    </View>
                  )}
                </View>

                <View style={styles.detalleStatusPill}>
                  <Feather name={estado.icon} size={12} color={estado.color} />
                  <Text style={[styles.detalleStatusText, { color: estado.color }]}>
                    {t(estado.labelKey)}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.detalleClose}
                onPress={cerrarDetalle}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={22} color="#FFF" />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.detalleScroll}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.detalleSection}>
                <Text style={styles.detalleSectionLabel}>{t("Descripción")}</Text>
                <Text style={[styles.detalleDescripcion, !item.descripcion && styles.detallePlaceholder]}>
                  {item.descripcion || t("Sin descripción")}
                </Text>
              </View>

              <View style={styles.detalleSection}>
                <Text style={styles.detalleSectionLabel}>{t("Periodo")}</Text>
                <View style={styles.detalleFechasGrid}>
                  <View style={styles.detalleFechaBox}>
                    <View style={[styles.detalleFechaIcon, { backgroundColor: `${color}20` }]}>
                      <Feather name="calendar" size={14} color={color} />
                    </View>
                    <Text style={styles.detalleFechaLabel}>{t("Inicio")}</Text>
                    <Text style={styles.detalleFechaValor}>{formatFecha(item.fecha_inicio)}</Text>
                  </View>

                  <View style={styles.detalleFechaBox}>
                    <View style={[styles.detalleFechaIcon, { backgroundColor: `${color}20` }]}>
                      <Feather name="calendar" size={14} color={color} />
                    </View>
                    <Text style={styles.detalleFechaLabel}>{t("Fin")}</Text>
                    <Text style={styles.detalleFechaValor}>{formatFecha(item.fecha_fin)}</Text>
                  </View>
                </View>

                {duracion !== null && (
                  <Text style={styles.detalleDuracion}>
                    {t("Duración")}: <Text style={{ color: "#E2E8F0", fontWeight: "700" }}>{duracion} {t("días")}</Text>
                  </Text>
                )}
              </View>

              {estado.key === "en_curso" && (
                <View style={styles.detalleSection}>
                  <Text style={styles.detalleSectionLabel}>{t("Progreso")}</Text>
                  <View style={styles.detalleProgressWrap}>
                    <View style={styles.detalleProgressBg}>
                      <View
                        style={[
                          styles.detalleProgressFill,
                          { width: `${Math.round(progreso * 100)}%`, backgroundColor: color },
                        ]}
                      />
                    </View>
                    <Text style={styles.detalleProgressPct}>
                      {Math.round(progreso * 100)}%
                    </Text>
                  </View>
                  {dias !== null && (
                    <Text style={styles.detalleDias}>
                      {dias >= 0
                        ? `${t("Quedan")} ${dias} ${t(dias === 1 ? "día" : "días")} ${t("para que termine")}`
                        : t("Finalizando…")}
                    </Text>
                  )}
                </View>
              )}

              <View style={styles.detalleSection}>
                <Text style={styles.detalleSectionLabel}>{t("Estadísticas")}</Text>
                <View style={styles.detalleStatsGrid}>
                  <View style={styles.detalleStatCard}>
                    <Ionicons name="cube-outline" size={20} color="#94A3B8" />
                    <Text style={styles.detalleStatNumber}>{item.productosCount || 0}</Text>
                    <Text style={styles.detalleStatLabel}>{t("Productos")}</Text>
                  </View>

                  <View style={styles.detalleStatCard}>
                    <Feather name={estado.icon} size={20} color={estado.color} />
                    <Text style={[styles.detalleStatNumber, { color: estado.color }]}>
                      {t(estado.labelKey)}
                    </Text>
                    <Text style={styles.detalleStatLabel}>{t("Estado actual")}</Text>
                  </View>
                </View>
              </View>

              <View style={styles.detalleSection}>
                <Text style={styles.detalleSectionLabel}>{t("ID")}</Text>
                <Text style={styles.detalleIdText} numberOfLines={1}>{item.id}</Text>
              </View>
            </ScrollView>

            <View style={styles.detalleActions}>
              <TouchableOpacity
                style={[styles.detalleBtn, styles.detalleBtnDelete]}
                onPress={eliminarDesdeDetalle}
              >
                <Feather name="trash-2" size={16} color="#f87171" />
                <Text style={styles.detalleBtnDeleteText}>{t("Eliminar")}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.detalleBtn, styles.detalleBtnEdit]}
                onPress={editarDesdeDetalle}
              >
                <Feather name="edit-2" size={16} color="#FFF" />
                <Text style={styles.detalleBtnEditText}>{t("Editar")}</Text>
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
          <Text style={styles.headerTitle}>{t("Temporadas")}</Text>
          <Text style={styles.headerSub}>
            {temporadas.length} {t("registradas")}
          </Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={abrirCrear}>
          <Ionicons name="add" size={20} color="#FFF" />
          <Text style={styles.addBtnText}>{t("Nueva")}</Text>
        </TouchableOpacity>
      </View>

      {error && (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle" size={18} color="#EF4444" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => cargar()}>
            <Text style={styles.retryText}>{t("Reintentar")}</Text>
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
          ListHeaderComponent={
            <>
              {renderHero()}
              {renderFiltros()}
              {renderListHeader()}
            </>
          }
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
              colors={["#7C3AED"]}
              tintColor="#7C3AED"
              progressBackgroundColor="#0f172a"
            />
          }
        />
      )}

      {renderDetalle()}

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
                {editing ? t("Editar temporada") : t("Nueva temporada")}
              </Text>
              <TouchableOpacity onPress={cerrarModal}>
                <Ionicons name="close" size={22} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.label}>{t("Nombre *")}</Text>
              <RNTextInput
                style={styles.input}
                value={form.nombre}
                onChangeText={(v) => setForm((f) => ({ ...f, nombre: v }))}
                placeholder={t("Ej. Primavera-Verano 2025")}
                placeholderTextColor="#475569"
              />

              <Text style={styles.label}>{t("Descripción")}</Text>
              <RNTextInput
                style={[styles.input, styles.inputMultiline]}
                value={form.descripcion}
                onChangeText={(v) => setForm((f) => ({ ...f, descripcion: v }))}
                placeholder={t("Colores vibrantes y telas ligeras…")}
                placeholderTextColor="#475569"
                multiline
                numberOfLines={3}
              />

              <Text style={styles.label}>{t("Fecha de inicio * (YYYY-MM-DD)")}</Text>
              <RNTextInput
                style={styles.input}
                value={form.fecha_inicio}
                onChangeText={(v) => setForm((f) => ({ ...f, fecha_inicio: v }))}
                placeholder="2025-01-15"
                placeholderTextColor="#475569"
                autoCapitalize="none"
                keyboardType="numbers-and-punctuation"
              />

              <Text style={styles.label}>{t("Fecha de fin * (YYYY-MM-DD)")}</Text>
              <RNTextInput
                style={styles.input}
                value={form.fecha_fin}
                onChangeText={(v) => setForm((f) => ({ ...f, fecha_fin: v }))}
                placeholder="2025-06-30"
                placeholderTextColor="#475569"
                autoCapitalize="none"
                keyboardType="numbers-and-punctuation"
              />

              <Text style={styles.label}>{t("Color")}</Text>
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

              {/* ============================================== */}
              {/* 🆕 SECCIÓN DE IMAGEN CON GALERÍA Y CÁMARA      */}
              {/* ============================================== */}
              <Text style={styles.label}>{t("Imagen / Banner")}</Text>

              <View style={styles.imagePickerRow}>
                <TouchableOpacity
                  style={styles.imagePickerBtn}
                  onPress={seleccionarDeGaleria}
                >
                  <Feather name="image" size={16} color="#FFF" />
                  <Text style={styles.imagePickerBtnText}>{t("Galería")}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.imagePickerBtn}
                  onPress={tomarFoto}
                >
                  <Feather name="camera" size={16} color="#FFF" />
                  <Text style={styles.imagePickerBtnText}>{t("Cámara")}</Text>
                </TouchableOpacity>

                {form.imagen ? (
                  <TouchableOpacity
                    style={[styles.imagePickerBtn, styles.imagePickerBtnDanger]}
                    onPress={() => setForm((f) => ({ ...f, imagen: "" }))}
                  >
                    <Feather name="trash-2" size={16} color="#f87171" />
                  </TouchableOpacity>
                ) : null}
              </View>

              {form.imagen ? (
                <Image
                  source={{ uri: resolveUrl(form.imagen) }}
                  style={styles.previewImage}
                  resizeMode="cover"
                />
              ) : null}

              <Text style={[styles.label, { marginTop: 6 }]}>
                {t("O pega una URL directa")}
              </Text>
              <RNTextInput
                style={styles.input}
                value={form.imagen.startsWith("data:") ? "" : form.imagen}
                onChangeText={(v) => setForm((f) => ({ ...f, imagen: v }))}
                placeholder="https://..."
                placeholderTextColor="#475569"
                autoCapitalize="none"
              />

              <View style={styles.switchRow}>
                <View style={styles.switchLeft}>
                  <Ionicons name="star" size={15} color="#f59e0b" />
                  <Text style={styles.switchLabel}>{t("Destacada")}</Text>
                </View>
                <Switch
                  value={form.destacada}
                  onValueChange={(v) => setForm((f) => ({ ...f, destacada: v }))}
                  trackColor={{ false: "#1e293b", true: "#f59e0b80" }}
                  thumbColor={form.destacada ? "#f59e0b" : "#64748B"}
                />
              </View>

              <View style={styles.switchRow}>
                <View style={styles.switchLeft}>
                  <Ionicons name="checkmark-circle" size={15} color="#10b981" />
                  <Text style={styles.switchLabel}>{t("Activa")}</Text>
                </View>
                <Switch
                  value={form.activa}
                  onValueChange={(v) => setForm((f) => ({ ...f, activa: v }))}
                  trackColor={{ false: "#1e293b", true: "#10b98180" }}
                  thumbColor={form.activa ? "#10b981" : "#64748B"}
                />
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.btn, styles.btnCancel]}
                  onPress={cerrarModal}
                  disabled={saving}
                >
                  <Text style={styles.btnCancelText}>{t("Cancelar")}</Text>
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
                      {editing ? t("Guardar cambios") : t("Crear temporada")}
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
  listHeader: { paddingHorizontal: 4, paddingBottom: 8 },
  listHeaderText: { color: "#64748B", fontSize: 11, fontStyle: "italic" },

  hero: {
    borderRadius: 18, overflow: "hidden", marginBottom: 16,
    borderWidth: 1, position: "relative", backgroundColor: "#0f172a",
  },
  heroBg: { ...StyleSheet.absoluteFillObject },
  heroImage: { width: "100%", height: 110, backgroundColor: "#020617" },
  heroOverlay: { padding: 16 },
  heroBadge: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 6 },
  heroDot: { width: 6, height: 6, borderRadius: 3 },
  heroBadgeText: { fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  heroTitle: { color: "#FFF", fontSize: 18, fontWeight: "800" },
  heroDesc: { color: "#94A3B8", fontSize: 12, marginTop: 4, lineHeight: 16 },
  heroProgressWrap: { marginTop: 14 },
  heroProgressBg: {
    height: 6, backgroundColor: "#020617", borderRadius: 3,
    overflow: "hidden", borderWidth: 1, borderColor: "#1e293b",
  },
  heroProgressFill: { height: "100%" },
  heroProgressText: { color: "#94A3B8", fontSize: 11, marginTop: 6, fontWeight: "600" },

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
  cardImg: { width: 54, height: 54, borderRadius: 12 },
  cardImgPlaceholder: {
    width: 54, height: 54, borderRadius: 12,
    justifyContent: "center", alignItems: "center",
  },
  cardTopRow: { marginBottom: 6 },
  cardTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  cardTitle: { color: "#FFF", fontSize: 14, fontWeight: "700", flexShrink: 1 },
  starPill: {
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: "#f59e0b20", justifyContent: "center", alignItems: "center",
  },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  statusText: { fontSize: 11, fontWeight: "700" },
  diasText: { color: "#64748B", fontSize: 10, marginLeft: 4 },
  cardDesc: { color: "#94A3B8", fontSize: 11, lineHeight: 15, marginBottom: 6 },
  fechasRow: {
    flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6,
  },
  fechaText: { color: "#CBD5E1", fontSize: 11, fontWeight: "600" },
  progressWrap: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  progressBg: {
    flex: 1, height: 4, backgroundColor: "#020617",
    borderRadius: 2, overflow: "hidden",
  },
  progressFill: { height: "100%" },
  progressPct: { color: "#64748B", fontSize: 10, fontWeight: "700", minWidth: 30, textAlign: "right" },
  cardActions: { justifyContent: "space-between", alignItems: "center", gap: 6 },
  actionBtn: {
    padding: 6, borderRadius: 8,
    backgroundColor: "#020617", borderWidth: 1, borderColor: "#1e293b",
  },
  cardFooter: {
    borderTopWidth: 1, borderTopColor: "#1e293b",
    paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: "#0b1220",
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  productosPill: { flexDirection: "row", alignItems: "center", gap: 5 },
  productosText: { color: "#94A3B8", fontSize: 11, fontWeight: "600" },

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

  modalOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: "#0f172a",
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, maxHeight: "92%",
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
  previewImage: {
    height: 140, borderRadius: 12, marginTop: 10,
    borderWidth: 1, borderColor: "#1e293b",
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  colorDot: {
    width: 32, height: 32, borderRadius: 16,
    borderWidth: 2, borderColor: "transparent",
  },
  colorDotActive: { borderColor: "#FFF", transform: [{ scale: 1.1 }] },
  switchRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    marginTop: 18, paddingHorizontal: 4,
  },
  switchLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  switchLabel: { color: "#E2E8F0", fontSize: 14, fontWeight: "600" },
  modalActions: { flexDirection: "row", gap: 12, marginTop: 24, marginBottom: 10 },
  btn: {
    flex: 1, paddingVertical: 14, borderRadius: 12,
    alignItems: "center", justifyContent: "center",
  },
  btnCancel: { backgroundColor: "#1e293b" },
  btnCancelText: { color: "#94A3B8", fontWeight: "700" },
  btnSave: { backgroundColor: "#7C3AED" },
  btnSaveText: { color: "#FFF", fontWeight: "700" },

  // 🆕 estilos del selector de imagen
  imagePickerRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 4,
  },
  imagePickerBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#7C3AED",
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10,
  },
  imagePickerBtnText: { color: "#FFF", fontWeight: "700", fontSize: 13 },
  imagePickerBtnDanger: {
    backgroundColor: "#450a0a",
    borderWidth: 1, borderColor: "#7f1d1d",
    paddingHorizontal: 12,
  },

  detalleOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.85)", justifyContent: "flex-end",
  },
  detalleCard: {
    backgroundColor: "#0f172a",
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: "90%", overflow: "hidden",
    borderTopWidth: 1, borderColor: "#1e293b",
  },
  detalleHeader: {
    position: "relative", paddingTop: 16, paddingHorizontal: 20,
    paddingBottom: 20, overflow: "hidden",
  },
  detalleAccent: { position: "absolute", top: 0, left: 0, right: 0, height: 4 },
  detalleBanner: {
    width: "100%", height: 140, borderRadius: 14, marginBottom: 14,
    backgroundColor: "#020617",
  },
  detalleHeaderContent: { paddingRight: 40 },
  detalleTitleRow: {
    flexDirection: "row", alignItems: "flex-start",
    gap: 8, marginBottom: 8,
  },
  detalleTitle: {
    color: "#FFF", fontSize: 22, fontWeight: "800", flex: 1, lineHeight: 28,
  },
  detalleStarPill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "#f59e0b20", paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 20,
  },
  detalleStarText: { color: "#f59e0b", fontSize: 10, fontWeight: "700" },
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
  detalleScroll: { paddingHorizontal: 20, maxHeight: 400 },
  detalleSection: { marginBottom: 20 },
  detalleSectionLabel: {
    color: "#64748B", fontSize: 11, fontWeight: "700",
    textTransform: "uppercase", letterSpacing: 1, marginBottom: 8,
  },
  detalleDescripcion: { color: "#E2E8F0", fontSize: 14, lineHeight: 20 },
  detallePlaceholder: { color: "#475569", fontStyle: "italic" },
  detalleFechasGrid: { flexDirection: "row", gap: 10, marginBottom: 10 },
  detalleFechaBox: {
    flex: 1, backgroundColor: "#020617",
    padding: 12, borderRadius: 12,
    borderWidth: 1, borderColor: "#1e293b",
  },
  detalleFechaIcon: {
    width: 28, height: 28, borderRadius: 14,
    justifyContent: "center", alignItems: "center",
    marginBottom: 8,
  },
  detalleFechaLabel: {
    color: "#64748B", fontSize: 10, fontWeight: "700",
    textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 3,
  },
  detalleFechaValor: { color: "#FFF", fontSize: 13, fontWeight: "700" },
  detalleDuracion: { color: "#64748B", fontSize: 12, marginTop: 4 },
  detalleProgressWrap: {
    flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8,
  },
  detalleProgressBg: {
    flex: 1, height: 8, backgroundColor: "#020617",
    borderRadius: 4, overflow: "hidden",
    borderWidth: 1, borderColor: "#1e293b",
  },
  detalleProgressFill: { height: "100%" },
  detalleProgressPct: {
    color: "#FFF", fontSize: 13, fontWeight: "800",
    minWidth: 44, textAlign: "right",
  },
  detalleDias: { color: "#94A3B8", fontSize: 12, fontStyle: "italic" },
  detalleStatsGrid: { flexDirection: "row", gap: 10 },
  detalleStatCard: {
    flex: 1, backgroundColor: "#020617",
    padding: 14, borderRadius: 12,
    alignItems: "center",
    borderWidth: 1, borderColor: "#1e293b",
  },
  detalleStatNumber: {
    color: "#FFF", fontSize: 20, fontWeight: "900",
    marginTop: 6, marginBottom: 2,
  },
  detalleStatLabel: {
    color: "#64748B", fontSize: 10, fontWeight: "600",
    textTransform: "uppercase", letterSpacing: 0.5,
  },
  detalleIdText: {
    color: "#475569", fontSize: 11,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  detalleActions: {
    flexDirection: "row", gap: 12,
    padding: 20, paddingTop: 16,
    borderTopWidth: 1, borderTopColor: "#1e293b",
    backgroundColor: "#0b1220",
  },
  detalleBtn: {
    flex: 1, flexDirection: "row",
    alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 13, borderRadius: 12,
  },
  detalleBtnDelete: {
    backgroundColor: "#450a0a",
    borderWidth: 1, borderColor: "#7f1d1d",
  },
  detalleBtnDeleteText: { color: "#f87171", fontWeight: "700", fontSize: 13 },
  detalleBtnEdit: { backgroundColor: "#7C3AED" },
  detalleBtnEditText: { color: "#FFF", fontWeight: "700", fontSize: 13 },
});