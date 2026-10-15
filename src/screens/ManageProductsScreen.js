import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View, StyleSheet, ScrollView, TouchableOpacity, FlatList, Modal,
  ActivityIndicator, TextInput as RNTextInput, KeyboardAvoidingView,
  Platform, Switch, RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text, Alert } from "../i18n/ui";
import { Ionicons, MaterialCommunityIcons, Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useVideoPlayer, VideoView } from "expo-video";
import { usePreferences } from "../context/PreferencesContext";

import {
  fetchProductos,
  fetchProducto,
  createProducto,
  updateProducto,
  deleteProducto,
  fetchCategorias,
  fetchMarcas,
  fetchTemporadas,
  resolveUrl,
  resolveProductPhoto,
} from "../services/api";

// ================================================================
// HELPERS GLOBALES
// ================================================================

const safeFetch = (fn, ...args) => {
  if (typeof fn !== "function") return Promise.resolve([]);
  try {
    const result = fn(...args);
    return Promise.resolve(result).catch(() => []);
  } catch {
    return Promise.resolve([]);
  }
};

const PAGE_SIZE = 10;

const FILTROS = [
  { id: "todos",     labelKey: "Todos",     icon: "grid" },
  { id: "activo",    labelKey: "Activos",   icon: "check-circle" },
  { id: "inactivo",  labelKey: "Inactivos", icon: "pause-circle" },
  { id: "sin-stock", labelKey: "Agotados",  icon: "x-circle" },
  { id: "stock-bajo",labelKey: "Bajo stock",icon: "alert-triangle" },
];

const fmtPrecio = (n) => `$${Number(n || 0).toFixed(2)}`;

const colorEstado = (p) => {
  if (p.estado === "inactivo") return "#64748B";
  if (p.totalStock === 0) return "#ef4444";
  if (p.totalStock < 10) return "#f59e0b";
  return "#10b981";
};

const labelEstadoKey = (p) => {
  if (p.estado === "inactivo") return "Inactivo";
  if (p.totalStock === 0) return "Agotado";
  if (p.totalStock < 10) return "Stock bajo";
  return "Activo";
};

const normVariante = (v = {}) => ({
  sku: v.sku || v.SKU || "",
  color: v.color || "",
  tamano: String(v.tamano || v.talla || v.size || "")
    .replace(/\s+/g, " ")
    .trim(),
  precio: Number(v.precio ?? v.price ?? 0),
  stock: Number(v.stock ?? v.cantidad ?? 0),
});

// ================================================================
// COMPONENTES INTERNOS — Carrusel de fotos y reproductor de video
// ================================================================

const CAROUSEL_SIZE = 64;

function ProductPhotoCarousel({ fotos, itemId, size = CAROUSEL_SIZE }) {
  const [idx, setIdx] = useState(0);
  const arr = Array.isArray(fotos) ? fotos : [];

  if (arr.length === 0) {
    return (
      <View
        style={[
          styles.cardImgPlaceholder,
          { width: size, height: size, backgroundColor: "#020617" },
        ]}
      >
        <Feather name="box" size={size * 0.35} color="#334155" />
      </View>
    );
  }

  return (
    <View style={{ width: size, height: size }}>
      <FlatList
        data={arr}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(_, i) => `${itemId}-foto-${i}`}
        renderItem={({ item: foto }) => (
          <Image
            source={{ uri: resolveProductPhoto(foto) }}
            style={{ width: size, height: size, borderRadius: 12, backgroundColor: "#020617" }}
            contentFit="cover"
            transition={150}
            cachePolicy="memory-disk"
          />
        )}
        onMomentumScrollEnd={(e) => {
          const n = Math.round(e.nativeEvent.contentOffset.x / size);
          setIdx(Math.max(0, Math.min(n, arr.length - 1)));
        }}
        style={{ borderRadius: 12, overflow: "hidden" }}
      />
      {arr.length > 1 && (
        <View style={styles.carouselPill}>
          <Ionicons name="images" size={9} color="#FFF" />
          <Text style={styles.carouselPillText}>{idx + 1}/{arr.length}</Text>
        </View>
      )}
    </View>
  );
}

function ProductVideoPlayer({ uri, itemId, idx }) {
  // Los videos viven en la misma carpeta que las fotos: /static/uploads/productos/
  const resolved = resolveProductPhoto(uri);
  const player = useVideoPlayer(resolved || "", (p) => {
    p.loop = false;
    p.muted = true;
  });

  if (!resolved) {
    return (
      <View style={[styles.detalleVideo, styles.videoPlaceholder]}>
        <Feather name="video-off" size={20} color="#64748B" />
        <Text style={styles.videoPlaceholderText}>
          {typeof uri === "string" ? uri : "Video no disponible"}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.detalleVideoWrap}>
      <VideoView
        player={player}
        style={styles.detalleVideo}
        allowsFullscreen
        allowsPictureInPicture
        nativeControls
        contentFit="contain"
      />
    </View>
  );
}

// ================================================================
// PANTALLA PRINCIPAL
// ================================================================

export default function ManageProductsScreen({ navigation }) {
  const { t } = usePreferences();

  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const [categorias, setCategorias] = useState([]);
  const [marcas, setMarcas] = useState([]);
  const [temporadas, setTemporadas] = useState([]);

  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filtro, setFiltro] = useState("todos");
  const [busqueda, setBusqueda] = useState("");

  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [detalle, setDetalle] = useState(null);

  const formDefault = () => ({
    nombre: "",
    descripcion: "",
    categoria_id: null,
    marca_id: null,
    temporada_id: null,
    estado: "activo",
    activo: true,
    fotos: [],
    videos: [],
    variables: [],
  });
  const [form, setForm] = useState(formDefault());

  const [nuevaFoto, setNuevaFoto] = useState("");
  const [nuevoVideo, setNuevoVideo] = useState("");
  const [colorModal, setColorModal] = useState(false);
  const [nuevoColor, setNuevoColor] = useState("");

  // ---------- CARGA ----------
  const cargar = useCallback(async ({ isRefresh = false } = {}) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const [prods, cats, marcaList, temps] = await Promise.all([
        safeFetch(fetchProductos),
        safeFetch(fetchCategorias),
        safeFetch(fetchMarcas),
        safeFetch(fetchTemporadas, { incluir_inactivas: true }),
      ]);

      setProductos(Array.isArray(prods) ? prods : []);
      setCategorias(Array.isArray(cats) ? cats : []);
      setMarcas(Array.isArray(marcaList) ? marcaList : []);
      setTemporadas(Array.isArray(temps) ? temps : []);
      setPage(1);
    } catch (e) {
      console.log("❌ Error cargando productos:", e?.message);
      setError(e?.message || t("No se pudieron cargar los productos"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  useEffect(() => { cargar(); }, [cargar]);

  // ---------- MAPAS ----------
  const categoriasMap = useMemo(() => {
    const m = {};
    categorias.forEach((c) => { m[String(c.id)] = c; });
    return m;
  }, [categorias]);

  const marcasMap = useMemo(() => {
    const m = {};
    marcas.forEach((marca) => { m[String(marca.id)] = marca; });
    return m;
  }, [marcas]);

  const temporadasMap = useMemo(() => {
    const m = {};
    temporadas.forEach((x) => { m[String(x.id)] = x; });
    return m;
  }, [temporadas]);

  // ---------- PRODUCTOS ENRIQUECIDOS ----------
  const productosEnriquecidos = useMemo(() => {
    return productos.map((p) => {
      const catId = p.categoria_id ? String(p.categoria_id) : null;
      const marcaId = p.marca_id
        ? String(p.marca_id)
        : (p.empresa_id ? String(p.empresa_id) : null);
      const tempId = p.temporada_id ? String(p.temporada_id) : null;

      const rawVars = Array.isArray(p.variables) && p.variables.length > 0
        ? p.variables
        : (Array.isArray(p.variantes) ? p.variantes : []);
      const variables = rawVars.map(normVariante);
      const totalStock = variables.reduce((s, v) => s + (Number(v.stock) || 0), 0);

      const fotos = Array.isArray(p.fotos) ? p.fotos.filter(Boolean) : [];
      const videos = Array.isArray(p.videos) ? p.videos.filter(Boolean) : [];

      return {
        ...p,
        categoria_id: catId,
        categoria_nombre:
          p.categoria_nombre ||
          (catId && categoriasMap[catId] ? categoriasMap[catId].nombre : null),
        marca_id: marcaId,
        marca_nombre:
          p.marca_nombre ||
          (marcaId && marcasMap[marcaId]
            ? (marcasMap[marcaId].nombre_comercial || marcasMap[marcaId].nombre)
            : null),
        temporada_id: tempId,
        temporada_nombre:
          p.temporada_nombre ||
          (tempId && temporadasMap[tempId] ? temporadasMap[tempId].nombre : null),
        fotos,
        videos,
        variables,
        totalStock,
        variantesCount: variables.length,
      };
    });
  }, [productos, categoriasMap, marcasMap, temporadasMap]);

  // ---------- FILTRADO ----------
  const filtrados = useMemo(() => {
    let lista = [...productosEnriquecidos];

    if (busqueda.trim()) {
      const q = busqueda.toLowerCase().trim();
      lista = lista.filter((p) =>
        (p.nombre || "").toLowerCase().includes(q) ||
        (p.descripcion || "").toLowerCase().includes(q) ||
        (p.categoria_nombre || "").toLowerCase().includes(q) ||
        (p.marca_nombre || "").toLowerCase().includes(q)
      );
    }

    if (filtro === "activo") lista = lista.filter((p) => p.estado === "activo" && p.activo !== false);
    if (filtro === "inactivo") lista = lista.filter((p) => p.estado === "inactivo" || p.activo === false);
    if (filtro === "sin-stock") lista = lista.filter((p) => p.totalStock === 0);
    if (filtro === "stock-bajo") lista = lista.filter((p) => p.totalStock > 0 && p.totalStock < 10);

    return lista;
  }, [productosEnriquecidos, filtro, busqueda]);

  const paginados = useMemo(
    () => filtrados.slice(0, page * PAGE_SIZE),
    [filtrados, page]
  );

  const hayMas = paginados.length < filtrados.length;

  const conteos = useMemo(() => {
    const c = {
      todos: productosEnriquecidos.length,
      activo: 0, inactivo: 0, "sin-stock": 0, "stock-bajo": 0,
    };
    productosEnriquecidos.forEach((p) => {
      if (p.estado === "activo" && p.activo !== false) c.activo++;
      if (p.estado === "inactivo" || p.activo === false) c.inactivo++;
      if (p.totalStock === 0) c["sin-stock"]++;
      if (p.totalStock > 0 && p.totalStock < 10) c["stock-bajo"]++;
    });
    return c;
  }, [productosEnriquecidos]);

  // ---------- PAGINACIÓN ----------
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

  // ---------- MODALES ----------
  const abrirCrear = () => {
    setEditing(null);
    setForm(formDefault());
    setModalVisible(true);
  };

  const abrirEditar = (p) => {
    setEditing(p);
    setForm({
      nombre: p.nombre || "",
      descripcion: p.descripcion || "",
      categoria_id: p.categoria_id || null,
      marca_id: p.marca_id || null,
      temporada_id: p.temporada_id || null,
      estado: p.estado || "activo",
      activo: p.activo !== false,
      fotos: Array.isArray(p.fotos) ? [...p.fotos] : [],
      videos: Array.isArray(p.videos) ? [...p.videos] : [],
      variables: Array.isArray(p.variables) ? p.variables.map((v) => ({
        sku: v.sku || "",
        color: v.color || "",
        tamano: v.tamano || "",
        precio: String(v.precio || ""),
        stock: String(v.stock || ""),
      })) : [],
    });
    setDetalle(null);
    setModalVisible(true);
  };

  const cerrarModal = () => { if (!saving) setModalVisible(false); };
  const cerrarDetalle = () => setDetalle(null);

  // ---------- FOTOS / VIDEOS / VARIANTES ----------
  const agregarFoto = () => {
    const url = nuevaFoto.trim();
    if (!url) return;
    if (form.fotos.length >= 6) { Alert.alert(t("Límite"), t("Máximo 6 fotos por producto.")); return; }
    setForm((f) => ({ ...f, fotos: [...f.fotos, url] }));
    setNuevaFoto("");
  };

  const quitarFoto = (i) =>
    setForm((f) => ({ ...f, fotos: f.fotos.filter((_, idx) => idx !== i) }));

  const agregarVideo = () => {
    const url = nuevoVideo.trim();
    if (!url) return;
    if (form.videos.length >= 3) { Alert.alert(t("Límite"), t("Máximo 3 videos por producto.")); return; }
    setForm((f) => ({ ...f, videos: [...f.videos, url] }));
    setNuevoVideo("");
  };

  const quitarVideo = (i) =>
    setForm((f) => ({ ...f, videos: f.videos.filter((_, idx) => idx !== i) }));

  const abrirModalColor = () => { setNuevoColor(""); setColorModal(true); };

  const confirmarAgregarColor = () => {
    const color = nuevoColor.trim();
    if (!color) return;
    const existe = form.variables.some((v) => v.color.toLowerCase() === color.toLowerCase());
    if (existe) { Alert.alert(t("Ya existe"), `${t("El color")} "${color}" ${t("ya está agregado.")}`); return; }
    setForm((f) => ({
      ...f,
      variables: [...f.variables, { sku: "", color, tamano: "", precio: "", stock: "" }],
    }));
    setColorModal(false);
  };

  const eliminarColor = (color) => {
    Alert.alert(t("Eliminar color"), `${t("¿Eliminar")} "${color}" ${t("y todas sus tallas?")}`, [
      { text: t("Cancelar"), style: "cancel" },
      {
        text: t("Eliminar"), style: "destructive",
        onPress: () => setForm((f) => ({
          ...f,
          variables: f.variables.filter((v) => v.color !== color),
        })),
      },
    ]);
  };

  const agregarTalla = (color) =>
    setForm((f) => ({
      ...f,
      variables: [...f.variables, { sku: "", color, tamano: "", precio: "", stock: "" }],
    }));

  const actualizarVariante = (index, campo, valor) => {
    setForm((f) => {
      const nuevas = [...f.variables];
      nuevas[index] = { ...nuevas[index], [campo]: valor };
      return { ...f, variables: nuevas };
    });
  };

  const eliminarVariante = (index) =>
    setForm((f) => ({ ...f, variables: f.variables.filter((_, i) => i !== index) }));

  // ---------- GUARDAR / ELIMINAR ----------
  const guardar = async () => {
    if (!form.nombre.trim()) { Alert.alert(t("Campo requerido"), t("El nombre es obligatorio.")); return; }
    if (!form.categoria_id) { Alert.alert(t("Campo requerido"), t("Selecciona una categoría.")); return; }
    if (!form.marca_id) { Alert.alert(t("Campo requerido"), t("Selecciona una marca.")); return; }
    if (form.variables.length === 0) { Alert.alert(t("Sin variantes"), t("Agrega al menos un color.")); return; }

    for (const v of form.variables) {
      if (!v.sku.trim() || !v.tamano.trim() || v.precio === "" || v.stock === "") {
        Alert.alert(t("Variantes incompletas"), t("Completa SKU, talla, precio y stock."));
        return;
      }
    }

    setSaving(true);
    try {
      const payload = {
        nombre: form.nombre.trim(),
        descripcion: form.descripcion.trim(),
        categoria_id: form.categoria_id,
        marca_id: form.marca_id,
        temporada_id: form.temporada_id || null,
        estado: form.estado,
        activo: form.activo !== false,
        fotos: form.fotos,
        videos: form.videos,
        variables: form.variables.map((v) => ({
          sku: v.sku.trim(),
          color: v.color.trim(),
          tamano: v.tamano.trim(),
          precio: Number(v.precio) || 0,
          stock: Number(v.stock) || 0,
        })),
      };

      if (editing) await updateProducto(editing.id, payload);
      else await createProducto(payload);

      setModalVisible(false);
      await cargar({ isRefresh: true });
    } catch (e) {
      Alert.alert(t("Error"), e?.message || t("No se pudo guardar el producto"));
    } finally {
      setSaving(false);
    }
  };

  const confirmarEliminar = (p) => {
    Alert.alert(t("Eliminar producto"), `${t("¿Seguro que deseas eliminar")} "${p.nombre}"?`, [
      { text: t("Cancelar"), style: "cancel" },
      {
        text: t("Eliminar"), style: "destructive",
        onPress: async () => {
          try {
            await deleteProducto(p.id);
            await cargar({ isRefresh: true });
            setDetalle(null);
          } catch (e) {
            Alert.alert(t("No se pudo eliminar"), e?.message || t("Error del servidor"));
          }
        },
      },
    ]);
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
            <Text style={[styles.chipText, activo && styles.chipTextActive]}>{t(f.labelKey)}</Text>
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
    const color = colorEstado(item);
    const estado = t(labelEstadoKey(item));
    const tieneVideos = (item.videos?.length || 0) > 0;

    return (
      <TouchableOpacity style={styles.card} onPress={() => setDetalle(item)} activeOpacity={0.85}>
        <View style={[styles.cardAccent, { backgroundColor: color }]} />

        <View style={styles.cardBody}>
          {/* Carrusel de fotos */}
          <View>
            <ProductPhotoCarousel fotos={item.fotos} itemId={item.id} size={CAROUSEL_SIZE} />
            {tieneVideos && (
              <View style={styles.videoPill}>
                <Ionicons name="videocam" size={9} color="#FFF" />
                <Text style={styles.videoPillText}>{item.videos.length}</Text>
              </View>
            )}
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle} numberOfLines={1}>{item.nombre}</Text>

            <View style={styles.statusRow}>
              <View style={[styles.statusDot, { backgroundColor: color }]} />
              <Text style={[styles.statusText, { color }]}>{estado}</Text>
              {item.variantesCount > 0 && (
                <Text style={styles.metaText}>
                  · {item.variantesCount} {t(item.variantesCount === 1 ? "variante" : "variantes")}
                </Text>
              )}
            </View>

            {(item.categoria_nombre || item.marca_nombre) && (
              <Text style={styles.cardMeta} numberOfLines={1}>
                {item.categoria_nombre || t("Sin categoría")}
                {item.marca_nombre ? ` · ${item.marca_nombre}` : ""}
              </Text>
            )}

            <View style={styles.cardFooterInline}>
              <View style={styles.stockPill}>
                <Ionicons name="cube-outline" size={11} color="#94A3B8" />
                <Text style={styles.stockText}>{item.totalStock} {t("uds")}</Text>
              </View>
              {item.variables?.[0] && (
                <Text style={styles.precioText}>{fmtPrecio(item.variables[0].precio)}</Text>
              )}
            </View>
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

  // ---------- FOOTER / EMPTY ----------
  const renderFooter = () => {
    if (loadingMore) {
      return (
        <View style={styles.footerLoading}>
          <ActivityIndicator color="#7C3AED" />
          <Text style={styles.footerLoadingText}>{t("Cargando más…")}</Text>
        </View>
      );
    }
    if (!hayMas && filtrados.length > 0) {
      return (
        <View style={styles.footerEnd}>
          <View style={styles.footerEndLine} />
          <Text style={styles.footerEndText}>
            {t("Mostrando")} {paginados.length} {t("de")} {filtrados.length}
          </Text>
          <View style={styles.footerEndLine} />
        </View>
      );
    }
    return null;
  };

  const renderEmpty = () => {
    if (loading) return null;
    const esFiltro = filtro !== "todos" || busqueda.trim();
    return (
      <View style={styles.center}>
        <View style={styles.emptyIconWrap}>
          <Feather name="package" size={48} color="#334155" />
        </View>
        <Text style={styles.emptyTitle}>{esFiltro ? t("Sin resultados") : t("Aún no hay productos")}</Text>
        <Text style={styles.emptySub}>
          {esFiltro ? t("Prueba con otro filtro.") : t('Crea el primero con "Nuevo".')}
        </Text>
        {esFiltro && (
          <TouchableOpacity style={styles.emptyBtn}
            onPress={() => { setFiltro("todos"); setBusqueda(""); }}>
            <Text style={styles.emptyBtnText}>{t("Limpiar filtros")}</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // ================================================================
  // MODAL DETALLE — con carrusel de fotos y reproductor de video
  // ================================================================

  const renderDetalle = () => {
    if (!detalle) return null;
    const p = detalle;
    const color = colorEstado(p);
    const estado = t(labelEstadoKey(p));

    const coloresMap = {};
    (p.variables || []).forEach((v) => {
      if (!coloresMap[v.color]) coloresMap[v.color] = [];
      coloresMap[v.color].push(v);
    });

    return (
      <Modal visible={!!detalle} transparent animationType="slide" onRequestClose={cerrarDetalle}>
        <View style={styles.detalleOverlay}>
          <View style={styles.detalleCard}>
            <View style={[styles.detalleHeader, { backgroundColor: `${color}20` }]}>
              <View style={[styles.detalleAccent, { backgroundColor: color }]} />

              <View style={styles.detalleHeaderContent}>
                <Text style={styles.detalleTitle} numberOfLines={2}>{p.nombre}</Text>
                <View style={styles.detalleStatusPill}>
                  <View style={[styles.stateDot, { backgroundColor: color }]} />
                  <Text style={[styles.detalleStatusText, { color }]}>{estado}</Text>
                </View>
              </View>

              <TouchableOpacity style={styles.detalleClose} onPress={cerrarDetalle}>
                <Ionicons name="close" size={22} color="#FFF" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.detalleScroll} showsVerticalScrollIndicator={false}>
              {p.descripcion ? (
                <View style={styles.detalleSection}>
                  <Text style={styles.detalleSectionLabel}>{t("Descripción")}</Text>
                  <Text style={styles.detalleDescripcion}>{p.descripcion}</Text>
                </View>
              ) : null}

              <View style={styles.detalleSection}>
                <Text style={styles.detalleSectionLabel}>{t("Información")}</Text>
                <View style={styles.detalleFechasGrid}>
                  <View style={styles.detalleFechaBox}>
                    <Text style={styles.detalleFechaLabel}>{t("Categoría")}</Text>
                    <Text style={styles.detalleFechaValor}>{p.categoria_nombre || "—"}</Text>
                  </View>
                  <View style={styles.detalleFechaBox}>
                    <Text style={styles.detalleFechaLabel}>{t("Marca")}</Text>
                    <Text style={styles.detalleFechaValor}>{p.marca_nombre || "—"}</Text>
                  </View>
                </View>
                {p.temporada_nombre ? (
                  <View style={[styles.detalleFechaBox, { marginTop: 8 }]}>
                    <Text style={styles.detalleFechaLabel}>{t("Temporada")}</Text>
                    <Text style={styles.detalleFechaValor}>{p.temporada_nombre}</Text>
                  </View>
                ) : null}
              </View>

              {/* FOTOS — carrusel horizontal grande */}
              <View style={styles.detalleSection}>
                <Text style={styles.detalleSectionLabel}>
                  {t("Fotos")} ({p.fotos.length}/6)
                </Text>
                {p.fotos.length === 0 ? (
                  <Text style={styles.detallePlaceholder}>{t("Sin fotos")}</Text>
                ) : (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 8, paddingRight: 8 }}
                  >
                    {p.fotos.map((f, i) => (
                      <Image
                        key={`${p.id}-big-${i}`}
                        source={{ uri: resolveProductPhoto(f) }}
                        style={styles.detalleThumb}
                        contentFit="cover"
                        transition={150}
                        cachePolicy="memory-disk"
                      />
                    ))}
                  </ScrollView>
                )}
              </View>

              {/* VIDEOS — reproductor real */}
              {p.videos.length > 0 && (
                <View style={styles.detalleSection}>
                  <Text style={styles.detalleSectionLabel}>
                    {t("Videos")} ({p.videos.length}/3)
                  </Text>
                  {p.videos.map((v, i) => (
                    <ProductVideoPlayer
                      key={`${p.id}-vid-${i}`}
                      uri={v}
                      itemId={p.id}
                      idx={i}
                    />
                  ))}
                </View>
              )}

              {/* VARIANTES */}
              <View style={styles.detalleSection}>
                <Text style={styles.detalleSectionLabel}>
                  {t("Colores y Tallas")} ({p.variantesCount})
                </Text>
                {Object.keys(coloresMap).length === 0 ? (
                  <Text style={styles.detallePlaceholder}>{t("Sin variantes")}</Text>
                ) : (
                  Object.entries(coloresMap).map(([colorNombre, variantes]) => (
                    <View key={colorNombre} style={styles.colorBlock}>
                      <View style={styles.colorHeader}>
                        <View style={styles.colorDot} />
                        <Text style={styles.colorHeaderText}>{colorNombre}</Text>
                        <Text style={styles.colorHeaderCount}>
                          {variantes.length} {t(variantes.length === 1 ? "talla" : "tallas")}
                        </Text>
                      </View>
                      {variantes.map((v, i) => (
                        <View key={i} style={styles.varianteRow}>
                          <Text style={styles.varianteTalla}>{v.tamano}</Text>
                          <Text style={styles.varianteSku} numberOfLines={1}>{v.sku}</Text>
                          <Text style={styles.variantePrecio}>{fmtPrecio(v.precio)}</Text>
                          <View style={[styles.varianteStock, {
                            backgroundColor:
                              v.stock === 0 ? "#450a0a" :
                              v.stock < 10 ? "#78350f" : "#064e3b",
                          }]}>
                            <Text style={[styles.varianteStockText, {
                              color:
                                v.stock === 0 ? "#fca5a5" :
                                v.stock < 10 ? "#fbbf24" : "#6ee7b7",
                            }]}>{v.stock}</Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  ))
                )}
              </View>
            </ScrollView>

            <View style={styles.detalleActions}>
              <TouchableOpacity style={[styles.detalleBtn, styles.detalleBtnDelete]}
                onPress={() => confirmarEliminar(p)}>
                <Feather name="trash-2" size={16} color="#f87171" />
                <Text style={styles.detalleBtnDeleteText}>{t("Eliminar")}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.detalleBtn, styles.detalleBtnEdit]}
                onPress={() => abrirEditar(p)}>
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
  // SELECTOR INLINE
  // ================================================================

  const SelectorInline = ({ label, value, options, onSelect, placeholder = "Seleccionar..." }) => (
    <View style={styles.selector}>
      <Text style={styles.label}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 6, paddingVertical: 2 }}>
        <TouchableOpacity
          style={[styles.selectChip, !value && styles.selectChipActive]}
          onPress={() => onSelect(null)}>
          <Text style={[styles.selectChipText, !value && styles.selectChipTextActive]}>
            {placeholder}
          </Text>
        </TouchableOpacity>
        {options.map((o) => {
          const active = String(value) === String(o.value);
          return (
            <TouchableOpacity key={o.value}
              style={[styles.selectChip, active && styles.selectChipActive]}
              onPress={() => onSelect(o.value)}>
              <Text style={[styles.selectChipText, active && styles.selectChipTextActive]}
                numberOfLines={1}>{o.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );

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
          <Text style={styles.headerTitle}>{t("Productos")}</Text>
          <Text style={styles.headerSub}>{productos.length} {t("registrados")}</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={abrirCrear}>
          <Ionicons name="add" size={20} color="#FFF" />
          <Text style={styles.addBtnText}>{t("Nuevo")}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchWrap}>
        <Feather name="search" size={15} color="#64748B" />
        <RNTextInput
          style={styles.searchInput}
          placeholder={t("Buscar por nombre, categoría, marca...")}
          placeholderTextColor="#475569"
          value={busqueda}
          onChangeText={(x) => { setBusqueda(x); setPage(1); }}
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
          data={paginados}
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
                {editing ? t("Editar producto") : t("Nuevo producto")}
              </Text>
              <TouchableOpacity onPress={cerrarModal}>
                <Ionicons name="close" size={22} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.label}>{t("Nombre *")}</Text>
              <RNTextInput style={styles.input} value={form.nombre}
                onChangeText={(x) => setForm((f) => ({ ...f, nombre: x }))}
                placeholder={t("Ej. Camiseta Deportiva")} placeholderTextColor="#475569" />

              <Text style={styles.label}>{t("Descripción")}</Text>
              <RNTextInput style={[styles.input, styles.inputMultiline]} value={form.descripcion}
                onChangeText={(x) => setForm((f) => ({ ...f, descripcion: x }))}
                placeholder={t("Materiales, características…")} placeholderTextColor="#475569" multiline />

              <SelectorInline label={t("Categoría *")} value={form.categoria_id}
                options={categorias.map((c) => ({
                  value: c.id,
                  label: `${"  ".repeat((c.nivel || 1) - 1)}${c.nombre}`,
                }))}
                onSelect={(v) => setForm((f) => ({ ...f, categoria_id: v }))}
                placeholder={t("Sin categoría")} />

              <SelectorInline label={t("Marca *")} value={form.marca_id}
                options={marcas.map((m) => ({
                  value: m.id,
                  label: m.nombre_comercial || m.nombre || t("Sin nombre"),
                }))}
                onSelect={(v) => setForm((f) => ({ ...f, marca_id: v }))}
                placeholder={t("Sin marca")} />

              <SelectorInline label={t("Temporada (opcional)")} value={form.temporada_id}
                options={temporadas.map((x) => ({ value: x.id, label: x.nombre }))}
                onSelect={(v) => setForm((f) => ({ ...f, temporada_id: v }))}
                placeholder={t("Sin temporada")} />

              <View style={styles.switchRow}>
                <View style={styles.switchLeft}>
                  <Ionicons
                    name={form.estado === "activo" ? "checkmark-circle" : "pause-circle"}
                    size={15} color={form.estado === "activo" ? "#10b981" : "#64748B"} />
                  <Text style={styles.switchLabel}>{t("Estado activo")}</Text>
                </View>
                <Switch value={form.estado === "activo"}
                  onValueChange={(v) => setForm((f) => ({ ...f, estado: v ? "activo" : "inactivo" }))}
                  trackColor={{ false: "#1e293b", true: "#10b98180" }}
                  thumbColor={form.estado === "activo" ? "#10b981" : "#64748B"} />
              </View>

              {/* FOTOS */}
              <View style={styles.separador} />
              <Text style={styles.sectionTitle}>{t("Fotos")} ({form.fotos.length}/6)</Text>
              <View style={styles.urlRow}>
                <RNTextInput style={[styles.input, { flex: 1 }]} value={nuevaFoto}
                  onChangeText={setNuevaFoto} placeholder={t("https://... o archivo.jpg")}
                  placeholderTextColor="#475569" autoCapitalize="none" />
                <TouchableOpacity style={styles.addUrlBtn} onPress={agregarFoto}>
                  <Feather name="plus" size={18} color="#FFF" />
                </TouchableOpacity>
              </View>

              {form.fotos.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    {form.fotos.map((f, i) => (
                      <View key={i} style={styles.fotoItem}>
                        <Image
                          source={{ uri: resolveProductPhoto(f) }}
                          style={styles.fotoImg}
                          contentFit="cover"
                          transition={100}
                        />
                        <TouchableOpacity style={styles.fotoRemove} onPress={() => quitarFoto(i)}>
                          <Ionicons name="close" size={12} color="#FFF" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                </ScrollView>
              )}

              {/* VIDEOS */}
              <View style={styles.separador} />
              <Text style={styles.sectionTitle}>{t("Videos")} ({form.videos.length}/3)</Text>
              <View style={styles.urlRow}>
                <RNTextInput style={[styles.input, { flex: 1 }]} value={nuevoVideo}
                  onChangeText={setNuevoVideo} placeholder="https://...mp4"
                  placeholderTextColor="#475569" autoCapitalize="none" />
                <TouchableOpacity style={styles.addUrlBtn} onPress={agregarVideo}>
                  <Feather name="plus" size={18} color="#FFF" />
                </TouchableOpacity>
              </View>

              {form.videos.map((v, i) => (
                <View key={i} style={styles.videoItem}>
                  <Feather name="video" size={14} color="#94A3B8" />
                  <Text style={styles.videoUrlText} numberOfLines={1}>{v}</Text>
                  <TouchableOpacity onPress={() => quitarVideo(i)}>
                    <Ionicons name="close-circle" size={18} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              ))}

              {/* VARIANTES */}
              <View style={styles.separador} />
              <View style={styles.variantesHeader}>
                <Text style={styles.sectionTitle}>
                  {t("Colores y Tallas")} ({form.variables.length})
                </Text>
                <TouchableOpacity style={styles.addColorBtn} onPress={abrirModalColor}>
                  <Feather name="plus" size={14} color="#FFF" />
                  <Text style={styles.addColorBtnText}>{t("Color")}</Text>
                </TouchableOpacity>
              </View>

              {form.variables.length === 0 ? (
                <View style={styles.emptyVariantes}>
                  <Feather name="droplet" size={36} color="#334155" />
                  <Text style={styles.emptyVariantesText}>{t("Agrega un color y sus tallas")}</Text>
                </View>
              ) : (
                Object.entries(
                  form.variables.reduce((acc, v, i) => {
                    if (!acc[v.color]) acc[v.color] = [];
                    acc[v.color].push({ ...v, _index: i });
                    return acc;
                  }, {})
                ).map(([colorNombre, variantes]) => (
                  <View key={colorNombre} style={styles.colorBlockForm}>
                    <View style={styles.colorFormHeader}>
                      <View style={styles.colorDot} />
                      <Text style={styles.colorFormTitle}>{colorNombre}</Text>
                      <TouchableOpacity onPress={() => eliminarColor(colorNombre)}
                        style={styles.colorFormDelete}>
                        <Feather name="trash-2" size={14} color="#f87171" />
                      </TouchableOpacity>
                    </View>

                    {variantes.map((v) => (
                      <View key={v._index} style={styles.varianteFormRow}>
                        <View style={styles.varianteInputs}>
                          <RNTextInput style={[styles.input, styles.inputSmall]} value={v.tamano}
                            onChangeText={(x) => actualizarVariante(v._index, "tamano", x)}
                            placeholder={t("Talla")} placeholderTextColor="#475569" />
                          <RNTextInput style={[styles.input, styles.inputSmall, { flex: 1.4 }]}
                            value={v.sku}
                            onChangeText={(x) => actualizarVariante(v._index, "sku", x)}
                            placeholder={t("SKU")} placeholderTextColor="#475569" autoCapitalize="characters" />
                        </View>
                        <View style={styles.varianteInputs}>
                          <RNTextInput style={[styles.input, styles.inputSmall]} value={v.precio}
                            onChangeText={(x) => actualizarVariante(v._index, "precio", x.replace(/[^0-9.]/g, ""))}
                            placeholder={t("Precio")} placeholderTextColor="#475569" keyboardType="numeric" />
                          <RNTextInput style={[styles.input, styles.inputSmall]} value={v.stock}
                            onChangeText={(x) => actualizarVariante(v._index, "stock", x.replace(/[^0-9]/g, ""))}
                            placeholder={t("Stock")} placeholderTextColor="#475569" keyboardType="numeric" />
                          <TouchableOpacity style={styles.varianteRemove}
                            onPress={() => eliminarVariante(v._index)}>
                            <Feather name="x" size={14} color="#ef4444" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}

                    <TouchableOpacity style={styles.addTallaBtn}
                      onPress={() => agregarTalla(colorNombre)}>
                      <Feather name="plus" size={12} color="#94A3B8" />
                      <Text style={styles.addTallaText}>{t("Agregar talla")}</Text>
                    </TouchableOpacity>
                  </View>
                ))
              )}

              <View style={styles.modalActions}>
                <TouchableOpacity style={[styles.btn, styles.btnCancel]}
                  onPress={cerrarModal} disabled={saving}>
                  <Text style={styles.btnCancelText}>{t("Cancelar")}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.btn, styles.btnSave]}
                  onPress={guardar} disabled={saving}>
                  {saving ? <ActivityIndicator color="#FFF" /> : (
                    <Text style={styles.btnSaveText}>
                      {editing ? t("Guardar cambios") : t("Crear producto")}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* MODAL COLOR */}
      <Modal visible={colorModal} transparent animationType="fade"
        onRequestClose={() => setColorModal(false)}>
        <View style={styles.colorModalOverlay}>
          <View style={styles.colorModalCard}>
            <Text style={styles.colorModalTitle}>{t("Nombre del color")}</Text>
            <RNTextInput style={styles.input} value={nuevoColor} onChangeText={setNuevoColor}
              placeholder={t("Ej. Rojo, Azul, Negro…")} placeholderTextColor="#475569" autoFocus />
            <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
              <TouchableOpacity style={[styles.btn, styles.btnCancel]}
                onPress={() => setColorModal(false)}>
                <Text style={styles.btnCancelText}>{t("Cancelar")}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, styles.btnSave]}
                onPress={confirmarAgregarColor}>
                <Text style={styles.btnSaveText}>{t("Agregar")}</Text>
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

  cardImg: { width: 60, height: 60, borderRadius: 12, backgroundColor: "#020617" },
  cardImgPlaceholder: {
    width: 60, height: 60, borderRadius: 12,
    justifyContent: "center", alignItems: "center",
  },

  // Carrusel
  carouselPill: {
    position: "absolute",
    bottom: 3, right: 3,
    flexDirection: "row", alignItems: "center", gap: 3,
    paddingHorizontal: 5, paddingVertical: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    borderRadius: 8,
  },
  carouselPillText: { color: "#FFF", fontSize: 9, fontWeight: "700" },
  videoPill: {
    position: "absolute",
    top: 3, right: 3,
    flexDirection: "row", alignItems: "center", gap: 3,
    paddingHorizontal: 5, paddingVertical: 1,
    backgroundColor: "rgba(124,58,237,0.9)",
    borderRadius: 8,
  },
  videoPillText: { color: "#FFF", fontSize: 9, fontWeight: "700" },

  cardTitle: { color: "#FFF", fontSize: 14, fontWeight: "700" },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 4 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: "700" },
  metaText: { color: "#64748B", fontSize: 10 },
  cardMeta: { color: "#94A3B8", fontSize: 11, marginTop: 4 },
  cardFooterInline: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    marginTop: 8,
  },
  stockPill: { flexDirection: "row", alignItems: "center", gap: 4 },
  stockText: { color: "#94A3B8", fontSize: 11, fontWeight: "600" },
  precioText: { color: "#10b981", fontSize: 13, fontWeight: "800" },

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
  sectionTitle: { color: "#E2E8F0", fontSize: 13, fontWeight: "700", marginTop: 8, marginBottom: 8 },
  input: {
    backgroundColor: "#020617", borderWidth: 1, borderColor: "#1e293b",
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    color: "#FFF", fontSize: 14,
  },
  inputMultiline: { minHeight: 70, textAlignVertical: "top" },
  inputSmall: { flex: 1, paddingVertical: 8, fontSize: 13 },

  separador: { height: 1, backgroundColor: "#1e293b", marginVertical: 16 },

  selector: { marginTop: 4 },
  selectChip: {
    paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: "#020617", borderRadius: 20,
    borderWidth: 1, borderColor: "#1e293b",
  },
  selectChipActive: { backgroundColor: "#7C3AED", borderColor: "#7C3AED" },
  selectChipText: { color: "#94A3B8", fontSize: 12, fontWeight: "600", maxWidth: 180 },
  selectChipTextActive: { color: "#FFF" },

  urlRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  addUrlBtn: {
    width: 42, height: 42, borderRadius: 12,
    backgroundColor: "#7C3AED",
    justifyContent: "center", alignItems: "center",
  },

  fotoItem: { position: "relative" },
  fotoImg: { width: 72, height: 72, borderRadius: 10, backgroundColor: "#020617" },
  fotoRemove: {
    position: "absolute", top: -6, right: -6,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: "#ef4444",
    justifyContent: "center", alignItems: "center",
    borderWidth: 2, borderColor: "#0f172a",
  },

  videoItem: {
    flexDirection: "row", alignItems: "center", gap: 8,
    padding: 10, marginTop: 8,
    backgroundColor: "#020617", borderRadius: 10,
    borderWidth: 1, borderColor: "#1e293b",
  },
  videoUrlText: { flex: 1, color: "#94A3B8", fontSize: 12 },

  variantesHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  addColorBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 10, paddingVertical: 6,
    backgroundColor: "#7C3AED", borderRadius: 8,
  },
  addColorBtnText: { color: "#FFF", fontSize: 12, fontWeight: "700" },

  emptyVariantes: {
    alignItems: "center", justifyContent: "center",
    padding: 24, marginTop: 8,
    backgroundColor: "#020617", borderRadius: 12,
    borderWidth: 1, borderColor: "#1e293b", borderStyle: "dashed",
  },
  emptyVariantesText: { color: "#64748B", fontSize: 12, marginTop: 8 },

  colorBlockForm: {
    marginTop: 12, padding: 12,
    backgroundColor: "#020617", borderRadius: 12,
    borderWidth: 1, borderColor: "#1e293b",
  },
  colorFormHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  colorDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: "#7C3AED" },
  colorFormTitle: { flex: 1, color: "#FFF", fontSize: 14, fontWeight: "700" },
  colorFormDelete: { padding: 4 },

  varianteFormRow: { marginBottom: 8 },
  varianteInputs: { flexDirection: "row", gap: 6, marginBottom: 6 },
  varianteRemove: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: "#450a0a", borderWidth: 1, borderColor: "#7f1d1d",
    justifyContent: "center", alignItems: "center",
  },
  addTallaBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 4, paddingVertical: 8, marginTop: 6,
    backgroundColor: "#0f172a", borderRadius: 8,
    borderWidth: 1, borderColor: "#1e293b", borderStyle: "dashed",
  },
  addTallaText: { color: "#94A3B8", fontSize: 11, fontWeight: "600" },

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

  colorModalOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "center", alignItems: "center", padding: 24,
  },
  colorModalCard: {
    width: "100%", maxWidth: 380,
    backgroundColor: "#0f172a", borderRadius: 20,
    padding: 20, borderWidth: 1, borderColor: "#1e293b",
  },
  colorModalTitle: { color: "#FFF", fontSize: 15, fontWeight: "700", marginBottom: 12 },

  detalleOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.85)", justifyContent: "flex-end" },
  detalleCard: {
    backgroundColor: "#0f172a",
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: "92%", overflow: "hidden",
    borderTopWidth: 1, borderColor: "#1e293b",
  },
  detalleHeader: {
    position: "relative", paddingTop: 16,
    paddingHorizontal: 20, paddingBottom: 20, overflow: "hidden",
  },
  detalleAccent: { position: "absolute", top: 0, left: 0, right: 0, height: 4 },
  detalleHeaderContent: { paddingRight: 40 },
  detalleTitle: { color: "#FFF", fontSize: 20, fontWeight: "800", marginBottom: 8 },
  detalleStatusPill: {
    flexDirection: "row", alignItems: "center", gap: 5,
    alignSelf: "flex-start",
    backgroundColor: "#020617",
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 20, borderWidth: 1, borderColor: "#1e293b",
  },
  stateDot: { width: 6, height: 6, borderRadius: 3 },
  detalleStatusText: { fontSize: 12, fontWeight: "700" },
  detalleClose: {
    position: "absolute", top: 12, right: 12,
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center", alignItems: "center",
  },
  detalleScroll: { paddingHorizontal: 20, maxHeight: 500 },
  detalleSection: { marginBottom: 20 },
  detalleSectionLabel: {
    color: "#64748B", fontSize: 11, fontWeight: "700",
    textTransform: "uppercase", letterSpacing: 1, marginBottom: 8,
  },
  detalleDescripcion: { color: "#E2E8F0", fontSize: 13, lineHeight: 19 },
  detallePlaceholder: { color: "#475569", fontStyle: "italic", fontSize: 12 },
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
  detalleThumb: { width: 90, height: 90, borderRadius: 10, backgroundColor: "#020617" },

  // Video player
  detalleVideoWrap: {
    marginTop: 8,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#1e293b",
    backgroundColor: "#000",
  },
  detalleVideo: {
    width: "100%",
    height: 200,
    backgroundColor: "#000",
  },
  videoPlaceholder: {
    height: 100,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#020617",
    borderRadius: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#1e293b",
  },
  videoPlaceholderText: {
    color: "#64748B",
    fontSize: 11,
    marginTop: 8,
    paddingHorizontal: 12,
    textAlign: "center",
  },

  colorBlock: { marginBottom: 12, borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: "#1e293b" },
  colorHeader: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 12, paddingVertical: 10, backgroundColor: "#020617",
  },
  colorHeaderText: { flex: 1, color: "#FFF", fontSize: 13, fontWeight: "700" },
  colorHeaderCount: { color: "#64748B", fontSize: 11 },

  varianteRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 12, paddingVertical: 8,
    borderTopWidth: 1, borderTopColor: "#0f172a",
  },
  varianteTalla: { color: "#E2E8F0", fontSize: 12, fontWeight: "700", minWidth: 40 },
  varianteSku: { flex: 1, color: "#64748B", fontSize: 11 },
  variantePrecio: { color: "#10b981", fontSize: 12, fontWeight: "700" },
  varianteStock: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  varianteStockText: { fontSize: 11, fontWeight: "700" },

  detalleActions: {
    flexDirection: "row", gap: 12,
    padding: 20, paddingTop: 16,
    borderTopWidth: 1, borderTopColor: "#1e293b",
    backgroundColor: "#0b1220",
  },
  detalleBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 13, borderRadius: 12,
  },
  detalleBtnDelete: { backgroundColor: "#450a0a", borderWidth: 1, borderColor: "#7f1d1d" },
  detalleBtnDeleteText: { color: "#f87171", fontWeight: "700", fontSize: 13 },
  detalleBtnEdit: { backgroundColor: "#7C3AED" },
  detalleBtnEditText: { color: "#FFF", fontWeight: "700", fontSize: 13 },
});