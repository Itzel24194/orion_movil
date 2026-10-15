// src/screens/CategoriesScreen.js
import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  StyleSheet, View, StatusBar, TouchableOpacity, ScrollView, FlatList,
  Image, Dimensions, ActivityIndicator, Keyboard,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text, TextInput } from "../i18n/ui";
import { Ionicons } from "@expo/vector-icons";

import {
  fetchCategoriasTree,
  fetchProductos,
  resolveUrl,
  resolveProductPhoto,
} from "../services/api";

const { width } = Dimensions.get("window");

// ================================================================
// SEGURIDAD — Validación de IDs
// ================================================================
const OBJECT_ID_RE = /^[a-f0-9]{24}$/i;
const isSafeId = (id) => typeof id === "string" && OBJECT_ID_RE.test(id);

// Máximo de caracteres del buscador
const MAX_SEARCH_LEN = 80;

const sanitizeSearch = (raw) => {
  const s = String(raw || "");
  return s
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_SEARCH_LEN);
};

// ================================================================
// ÍCONOS — todos de Ionicons
// ================================================================
const ICONO_POR_NOMBRE = {
  mujer: "woman", hombre: "man",
  niños: "happy", ninos: "happy",
  "niños y bebés": "happy", bebes: "happy", bebés: "happy",
  electrónica: "phone-portrait", electronica: "phone-portrait",
  hogar: "home", deportes: "football", belleza: "sparkles",
  juguetes: "gift", libros: "book",
  música: "musical-notes", musica: "musical-notes",
  mascotas: "paw", automotriz: "car-sport",
  herramientas: "construct", videojuegos: "game-controller",
  moda: "shirt", calzado: "bag-handle", ropa: "shirt",
  accesorios: "watch", joyería: "star", joyeria: "star",
  alimentos: "basket", bebidas: "cafe", arte: "color-palette",
  jardín: "flower", jardin: "flower",
  tenis: "footsteps", tenis_deportivos: "footsteps",
};

const IONICONS_VALIDOS = new Set([
  "grid", "grid-outline", "person", "people",
  "woman", "man", "happy",
  "phone-portrait", "home", "football", "sparkles",
  "gift", "game-controller", "book", "musical-notes",
  "paw", "car-sport", "construct", "shirt",
  "bag-handle", "watch", "basket", "cafe", "color-palette",
  "flower", "leaf", "planet", "heart", "star", "footsteps",
  "shopping-bag", "cube", "apps", "layers", "pricetag",
]);

const safeIonicons = (name) =>
  IONICONS_VALIDOS.has(name) ? name : "grid";

const getIcono = (nombre, iconoBackend) => {
  if (iconoBackend) return safeIonicons(iconoBackend);
  const key = String(nombre || "").toLowerCase().trim();
  return ICONO_POR_NOMBRE[key] || "grid";
};

// Pantalla de productos para CLIENTES
const PRODUCTS_SCREEN = "Products";

// ================================================================
// ⭐ HELPERS DE PRODUCTO
// ================================================================
const getPrecioProducto = (p) => {
  const vars = Array.isArray(p?.variables) ? p.variables : [];
  if (vars.length > 0) return Number(vars[0].precio) || 0;
  return Number(p?.precio || p?.price || 0);
};

const getFotoProducto = (p) => {
  const fotos = Array.isArray(p?.fotos) ? p.fotos.filter(Boolean) : [];
  const primera = fotos[0];
  if (!primera) return null;
  return resolveProductPhoto(primera);
};

const currency = (v) =>
  `$${Number(v || 0).toLocaleString("es-MX", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

// ================================================================
// ⭐ BÚSQUEDA DE PRODUCTOS
// Filtra productos por nombre, marca, categoría o descripción.
// Cada producto lleva su ruta de categoría (si está disponible).
// ================================================================
const buscarProductos = (productos, termino) => {
  const q = String(termino || "").toLowerCase().trim();
  if (!q) return [];

  return productos
    .filter((p) => {
      const nombre = String(p.nombre || p.name || "").toLowerCase();
      const marca = String(p.marca_nombre || p.brand || "").toLowerCase();
      const cat = String(p.categoria_nombre || "").toLowerCase();
      const desc = String(p.descripcion || p.description || "").toLowerCase();
      return (
        nombre.includes(q) ||
        marca.includes(q) ||
        cat.includes(q) ||
        desc.includes(q)
      );
    })
    .slice(0, 100);
};

// ================================================================
// COMPONENTE
// ================================================================
export default function CategoriesScreen({ navigation }) {
  const [tree, setTree] = useState([]);
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [selectedSub, setSelectedSub] = useState(null);
  const [searchText, setSearchText] = useState("");

  // Carga inicial: árbol de categorías + todos los productos
  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [treeData, productosData] = await Promise.all([
        fetchCategoriasTree().catch(() => []),
        fetchProductos().catch(() => []),
      ]);
      setTree(Array.isArray(treeData) ? treeData : []);
      setProductos(Array.isArray(productosData) ? productosData : []);
      if (Array.isArray(treeData) && treeData.length > 0) setSelected(treeData[0]);
    } catch (e) {
      console.log("❌ Error cargando categorías:", e.message, e.status);
      setError(e.message || "No se pudieron cargar las categorías");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => { setSelectedSub(null); }, [selected?.id]);

  // ================================================================
  // MODO BÚSQUEDA
  // ================================================================
  const searchSeguro = useMemo(() => sanitizeSearch(searchText), [searchText]);
  const modoBusqueda = searchSeguro.length > 0;

  const resultadosBusqueda = useMemo(
    () => (modoBusqueda ? buscarProductos(productos, searchSeguro) : []),
    [modoBusqueda, productos, searchSeguro]
  );

  // Listas del modo navegación
  const subcategorias = selected?.hijos || [];
  const subSubcategorias = selectedSub?.hijos || [];

  // ================================================================
  // NAVEGAR A PRODUCTOS (filtrado por categoría)
  // ================================================================
  const irAProductos = (categoria, padre = null) => {
    Keyboard.dismiss();

    const catId = categoria?.id;
    if (!isSafeId(catId)) {
      console.log("⚠️ ID inválido, se ignora navegación:", catId);
      return;
    }

    const padreId = padre?.id && isSafeId(padre.id) ? padre.id : null;

    navigation.navigate(PRODUCTS_SCREEN, {
      filtroCategoriaId: String(catId),
      filtroCategoriaNombre: String(categoria.nombre || "").slice(0, 80),
      filtroPadreId: padreId,
      filtroPadreNombre: padre?.nombre
        ? String(padre.nombre).slice(0, 80)
        : null,
    });
  };

  // ================================================================
  // NAVEGAR A DETALLE DEL PRODUCTO
  // ================================================================
  const irAProducto = (producto) => {
    Keyboard.dismiss();
    navigation.navigate("ProductDetail", { product: producto });
  };

  const onPressCard = (item, padre = null) => {
    const tieneHijos = (item.hijos?.length || 0) > 0;
    if (tieneHijos && !padre) {
      setSelectedSub(item);
    } else {
      irAProductos(item, padre);
    }
  };

  // ================================================================
  // RENDER — Tarjeta de subcategoría
  // ================================================================
  const renderCard = ({ item }, padre) => {
    const tieneHijos = (item.hijos?.length || 0) > 0;
    const imagenUrl = item.imagen ? resolveUrl(item.imagen) : null;
    const color = selected?.color || "#8B5CF6";

    return (
      <TouchableOpacity
        style={styles.subcategoryCard}
        onPress={() => onPressCard(item, padre)}
        activeOpacity={0.75}
      >
        {imagenUrl ? (
          <Image source={{ uri: imagenUrl }} style={styles.subcategoryImage} />
        ) : (
          <View style={[styles.subcategoryImage, styles.subcategoryPlaceholder]}>
            <Ionicons
              name={getIcono(item.nombre, item.icono)}
              size={28}
              color={color}
            />
          </View>
        )}
        <Text style={styles.subcategoryText} numberOfLines={2}>
          {item.nombre}
        </Text>
        {tieneHijos && !padre ? (
          <Text style={styles.subcategoryCount}>
            {item.hijos.length} subcategoría{item.hijos.length === 1 ? "" : "s"}
          </Text>
        ) : (
          <Text style={styles.subcategoryCount}>Ver productos</Text>
        )}
      </TouchableOpacity>
    );
  };

  // ================================================================
  // RENDER — Resultado de búsqueda (PRODUCTO)
  // ================================================================
  const renderProductoResultado = ({ item }) => {
    const foto = getFotoProducto(item);
    const precio = getPrecioProducto(item);
    const catNombre = item.categoria_nombre || "";
    const marcaNombre = item.marca_nombre || "";

    return (
      <TouchableOpacity
        style={styles.productResultCard}
        onPress={() => irAProducto(item)}
        activeOpacity={0.8}
      >
        {/* Imagen */}
        <View style={styles.productResultImageWrap}>
          {foto ? (
            <Image
              source={{ uri: foto }}
              style={styles.productResultImage}
              contentFit="cover"
              transition={150}
              cachePolicy="memory-disk"
            />
          ) : (
            <View
              style={[
                styles.productResultImage,
                styles.productResultPlaceholder,
              ]}
            >
              <Ionicons name="image-outline" size={26} color="#94A3B8" />
            </View>
          )}
        </View>

        {/* Info */}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.productResultName} numberOfLines={2}>
            {item.nombre || item.name || "Producto"}
          </Text>

          {(catNombre || marcaNombre) && (
            <Text style={styles.productResultMeta} numberOfLines={1}>
              {catNombre}
              {marcaNombre ? `${catNombre ? " · " : ""}${marcaNombre}` : ""}
            </Text>
          )}

          {!!item.descripcion && (
            <Text
              style={styles.productResultDesc}
              numberOfLines={1}
            >
              {String(item.descripcion).slice(0, 80)}
            </Text>
          )}

          <View style={styles.productResultBottom}>
            <Text style={styles.productResultPrice}>{currency(precio)}</Text>
            <View style={styles.productResultBadge}>
              <Ionicons name="arrow-forward" size={12} color="#8B5CF6" />
              <Text style={styles.productResultBadgeText}>Ver</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // ================================================================
  // LOADING
  // ================================================================
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#8B5CF6" />
          <Text style={styles.loadingText}>Cargando categorías…</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ================================================================
  // RENDER PRINCIPAL
  // ================================================================
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="#F5F3EF" barStyle="dark-content" />

      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={22} color="#1E293B" />
        </TouchableOpacity>

        <View style={styles.searchBarContainer}>
          <Ionicons
            name="search"
            size={17}
            color={searchSeguro ? "#8B5CF6" : "#64748B"}
            style={{ marginLeft: 12 }}
          />
          <TextInput
            placeholder="Buscar productos…"
            placeholderTextColor="#94A3B8"
            style={styles.searchInput}
            value={searchText}
            onChangeText={setSearchText}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
            maxLength={MAX_SEARCH_LEN}
          />
          {searchText.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                setSearchText("");
                Keyboard.dismiss();
              }}
              style={styles.clearBtn}
            >
              <Ionicons name="close-circle" size={18} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ERROR */}
      {error && (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle" size={18} color="#EF4444" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={cargar}>
            <Text style={styles.retryText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* SIN CATEGORÍAS */}
      {!loading && tree.length === 0 && !error && !modoBusqueda && (
        <View style={styles.center}>
          <View style={styles.emptyIconWrap}>
            <Ionicons name="albums-outline" size={48} color="#CBD5E1" />
          </View>
          <Text style={styles.emptyTitle}>Aún no hay categorías</Text>
          <Text style={styles.emptySub}>
            Pídele al admin que cargue la estructura
          </Text>
        </View>
      )}

      {/* ============================================================
          MODO BÚSQUEDA — PRODUCTOS
      ============================================================ */}
      {modoBusqueda && (
        <View style={{ flex: 1 }}>
          <View style={styles.searchSummary}>
            <Text style={styles.searchSummaryText}>
              {resultadosBusqueda.length}{" "}
              {resultadosBusqueda.length === 1 ? "producto" : "productos"}{" "}
              para "<Text style={{ fontWeight: "800" }}>{searchSeguro}</Text>"
            </Text>
          </View>

          <FlatList
            data={resultadosBusqueda}
            keyExtractor={(item, i) => `${item.id || item._id}-${i}`}
            renderItem={renderProductoResultado}
            contentContainerStyle={styles.resultsList}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <View style={styles.center}>
                <View style={styles.emptyIconWrap}>
                  <Ionicons name="search-outline" size={40} color="#CBD5E1" />
                </View>
                <Text style={styles.emptyTitle}>Sin resultados</Text>
                <Text style={styles.emptySub}>
                  No encontramos productos para "{searchSeguro}"
                </Text>
              </View>
            }
          />
        </View>
      )}

      {/* ============================================================
          MODO NAVEGACIÓN — árbol sidebar + grid
      ============================================================ */}
      {!modoBusqueda && tree.length > 0 && (
        <View style={styles.mainContent}>
          {/* SIDEBAR */}
          <View style={styles.sidebar}>
            <ScrollView showsVerticalScrollIndicator={false}>
              {tree.map((cat) => {
                const isSelected = selected?.id === cat.id;
                const color = cat.color || "#8B5CF6";
                const numHijos = Array.isArray(cat.hijos) ? cat.hijos.length : 0;

                return (
                  <TouchableOpacity
                    key={String(cat.id)}
                    style={[
                      styles.sidebarTab,
                      isSelected && styles.sidebarTabActive,
                    ]}
                    onPress={() => setSelected(cat)}
                    activeOpacity={0.7}
                  >
                    {isSelected && (
                      <View
                        style={[
                          styles.activeIndicator,
                          { backgroundColor: color },
                        ]}
                      />
                    )}
                    <View
                      style={[
                        styles.sidebarIconWrap,
                        {
                          backgroundColor: isSelected
                            ? `${color}20`
                            : "transparent",
                        },
                      ]}
                    >
                      <Ionicons
                        name={getIcono(cat.nombre, cat.icono)}
                        size={22}
                        color={isSelected ? color : "#64748B"}
                      />
                    </View>
                    <Text
                      style={[
                        styles.sidebarText,
                        isSelected && { color: "#1E293B", fontWeight: "700" },
                      ]}
                      numberOfLines={2}
                    >
                      {cat.nombre}
                    </Text>
                    {numHijos > 0 && (
                      <View
                        style={[
                          styles.sidebarBadge,
                          {
                            backgroundColor: isSelected ? color : "#E2E8F0",
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.sidebarBadgeText,
                            { color: isSelected ? "#FFF" : "#64748B" },
                          ]}
                        >
                          {numHijos}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* GRID */}
          <View style={styles.gridContainer}>
            {selectedSub && (
              <TouchableOpacity
                style={styles.breadcrumb}
                onPress={() => setSelectedSub(null)}
                activeOpacity={0.7}
              >
                <Ionicons name="chevron-back" size={14} color="#8B5CF6" />
                <Text style={styles.breadcrumbText} numberOfLines={1}>
                  <Text style={{ fontWeight: "600" }}>{selected?.nombre}</Text>
                  {"  ›  "}
                  <Text style={{ fontWeight: "800" }}>
                    {selectedSub.nombre}
                  </Text>
                </Text>
              </TouchableOpacity>
            )}

            <View style={styles.gridHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.gridTitle} numberOfLines={1}>
                  {selectedSub
                    ? selectedSub.nombre
                    : selected?.nombre || "Categorías"}
                </Text>
                <Text style={styles.gridSubtitle}>
                  {(selectedSub ? subSubcategorias : subcategorias).length}{" "}
                  {(selectedSub ? subSubcategorias : subcategorias).length === 1
                    ? "subcategoría"
                    : "subcategorías"}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.viewAllBtn}
                onPress={() => {
                  if (selectedSub) setSelectedSub(null);
                  else if (selected) irAProductos(selected, null);
                }}
              >
                <Text style={styles.viewAllText}>
                  {selectedSub ? "Volver" : "Ver todo"}
                </Text>
                <Ionicons
                  name={selectedSub ? "arrow-undo" : "chevron-forward"}
                  size={12}
                  color="#8B5CF6"
                />
              </TouchableOpacity>
            </View>

            <FlatList
              data={selectedSub ? subSubcategorias : subcategorias}
              renderItem={(props) =>
                renderCard(props, selectedSub ? selectedSub : null)
              }
              keyExtractor={(item) => String(item.id)}
              numColumns={2}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.subcategoriesList}
              columnWrapperStyle={{ justifyContent: "space-between" }}
              ListEmptyComponent={
                <View style={styles.emptyGrid}>
                  <Ionicons
                    name="folder-open-outline"
                    size={40}
                    color="#CBD5E1"
                  />
                  <Text style={styles.emptyGridText}>
                    {selectedSub
                      ? "Sin sub-subcategorías"
                      : "Sin subcategorías"}
                  </Text>
                </View>
              }
            />
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

// ================================================================
// ESTILOS
// ================================================================
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFF" },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  loadingText: { color: "#64748B", marginTop: 14, fontSize: 14 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F5F3EF",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: "#EADCC9",
    gap: 8,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "#FFF",
    justifyContent: "center",
    alignItems: "center",
  },
  searchBarContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF",
    borderRadius: 22,
    height: 42,
    borderWidth: 1,
    borderColor: "#EADCC9",
  },
  searchInput: {
    flex: 1,
    paddingHorizontal: 8,
    color: "#1E293B",
    fontSize: 13,
    fontWeight: "500",
  },
  clearBtn: { paddingRight: 12, paddingVertical: 8 },

  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    margin: 16,
    padding: 12,
    backgroundColor: "#FEF2F2",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  errorText: { flex: 1, color: "#991B1B", fontSize: 13 },
  retryText: { color: "#8B5CF6", fontWeight: "700", fontSize: 13 },

  emptyIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: "#1E293B" },
  emptySub: {
    fontSize: 13,
    color: "#94A3B8",
    marginTop: 6,
    textAlign: "center",
  },

  // Modo búsqueda
  searchSummary: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#F8F7F4",
    borderBottomWidth: 1,
    borderColor: "#E2E8F0",
  },
  searchSummaryText: { fontSize: 12, color: "#64748B" },
  resultsList: { padding: 14 },

  productResultCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    backgroundColor: "#FFF",
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  productResultImageWrap: {
    width: 72,
    height: 72,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#F1F5F9",
  },
  productResultImage: { width: "100%", height: "100%" },
  productResultPlaceholder: {
    justifyContent: "center",
    alignItems: "center",
  },
  productResultName: {
    fontSize: 14,
    fontWeight: "800",
    color: "#1E293B",
    lineHeight: 18,
  },
  productResultMeta: {
    fontSize: 11,
    color: "#94A3B8",
    marginTop: 3,
    fontWeight: "600",
  },
  productResultDesc: {
    fontSize: 11,
    color: "#94A3B8",
    marginTop: 2,
    fontWeight: "500",
  },
  productResultBottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
  },
  productResultPrice: {
    fontSize: 15,
    fontWeight: "900",
    color: "#8B5CF6",
  },
  productResultBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: "#F3EFFF",
    borderRadius: 8,
  },
  productResultBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#8B5CF6",
  },

  // Modo navegación
  mainContent: { flex: 1, flexDirection: "row" },

  sidebar: {
    width: 104,
    backgroundColor: "#F8F7F4",
    borderRightWidth: 1,
    borderColor: "#E2E8F0",
  },
  sidebarTab: {
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 4,
    position: "relative",
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  sidebarTabActive: { backgroundColor: "#FFF" },
  activeIndicator: {
    position: "absolute",
    left: 0,
    top: 12,
    bottom: 12,
    width: 4,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
  },
  sidebarIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  sidebarText: {
    fontSize: 11,
    color: "#64748B",
    fontWeight: "600",
    marginTop: 6,
    textAlign: "center",
    paddingHorizontal: 2,
  },
  sidebarBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
  },
  sidebarBadgeText: { fontSize: 9, fontWeight: "800" },

  gridContainer: { flex: 1, padding: 16, backgroundColor: "#FFF" },

  breadcrumb: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 10,
    paddingVertical: 4,
  },
  breadcrumbText: { color: "#8B5CF6", fontSize: 12, flex: 1 },

  gridHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    gap: 8,
  },
  gridTitle: { fontSize: 18, fontWeight: "900", color: "#1E293B" },
  gridSubtitle: {
    fontSize: 11,
    color: "#94A3B8",
    marginTop: 2,
    fontWeight: "600",
  },
  viewAllBtn: { flexDirection: "row", alignItems: "center", gap: 2 },
  viewAllText: { fontSize: 12, color: "#8B5CF6", fontWeight: "700" },

  subcategoriesList: { paddingBottom: 20 },

  subcategoryCard: {
    width: (width - 104 - 32 - 12) / 2,
    backgroundColor: "#F8F7F4",
    marginBottom: 12,
    borderRadius: 14,
    padding: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  subcategoryImage: { width: "100%", height: 80, borderRadius: 10 },
  subcategoryPlaceholder: {
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  subcategoryText: {
    fontSize: 12,
    color: "#334155",
    fontWeight: "700",
    marginTop: 10,
    textAlign: "center",
  },
  subcategoryCount: {
    fontSize: 10,
    color: "#94A3B8",
    marginTop: 3,
    fontWeight: "600",
  },

  emptyGrid: { alignItems: "center", paddingVertical: 60, width: "100%" },
  emptyGridText: { color: "#94A3B8", marginTop: 10, fontSize: 13 },
});