// src/screens/ProductsScreen.js
import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
  Keyboard,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text, TextInput } from "../i18n/ui";
import { Ionicons, Feather } from "@expo/vector-icons";
import { Image } from "expo-image";

import { fetchProductos, resolveProductPhoto } from "../services/api";

const { width } = Dimensions.get("window");
const CARD_W = (width - 16 * 2 - 12) / 2;

// ================================================================
// SEGURIDAD
// ================================================================
const OBJECT_ID_RE = /^[a-f0-9]{24}$/i;
const isSafeId = (id) =>
  (typeof id === "string" || typeof id === "number") &&
  OBJECT_ID_RE.test(String(id));

const MAX_IDS_FILTRO = 100;

const sanitizeSearch = (raw) => {
  const s = String(raw || "");
  return s
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
};

// ================================================================
// HELPERS
// ================================================================
const currency = (v) =>
  `$${Number(v || 0).toLocaleString("es-MX", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const getFotoUrl = (p) => {
  const fotos = Array.isArray(p?.fotos) ? p.fotos.filter(Boolean) : [];
  const primera = fotos[0];
  return primera ? resolveProductPhoto(primera) : null;
};

const getPrecio = (p) => {
  const vars = Array.isArray(p?.variables) ? p.variables : [];
  if (vars.length === 0) return 0;
  return Number(vars[0].precio) || 0;
};

const getPrecioMax = (p) => {
  const vars = Array.isArray(p?.variables) ? p.variables : [];
  if (vars.length === 0) return 0;
  return vars.reduce((max, v) => Math.max(max, Number(v.precio) || 0), 0);
};

const getStock = (p) => {
  const vars = Array.isArray(p?.variables) ? p.variables : [];
  return vars.reduce((s, v) => s + (Number(v.stock) || 0), 0);
};

const getCategoriaId = (p) => {
  const raw = p?.categoria_id ?? p?.category_id ?? p?.categoryId ?? null;
  return raw == null ? null : String(raw);
};

const getMarca = (p) =>
  String(p?.marca_nombre || p?.brand || p?.marca || "").trim();

const getNombre = (p) =>
  String(p?.nombre || p?.name || "Producto").trim();

// ================================================================
// COMPONENTE
// ================================================================
export default function ProductsScreen({ navigation, route }) {
  const {
    filtroCategoriaId,
    filtroCategoriaNombre,
    filtroPadreNombre,
    filtroCategoriaIds,
  } = route?.params || {};

  const idsPermitidos = useMemo(() => {
    const set = new Set();

    const fuente = Array.isArray(filtroCategoriaIds)
      ? filtroCategoriaIds
      : [];

    for (const id of fuente) {
      if (set.size >= MAX_IDS_FILTRO) break;
      if (isSafeId(id)) set.add(String(id));
    }

    if (filtroCategoriaId && isSafeId(filtroCategoriaId)) {
      set.add(String(filtroCategoriaId));
    }

    return set;
  }, [filtroCategoriaIds, filtroCategoriaId]);

  const hayFiltroCategoria = idsPermitidos.size > 0;

  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");

  const searchSeguro = useMemo(() => sanitizeSearch(search), [search]);

  const titulo = String(filtroCategoriaNombre || "Productos").slice(0, 60);
  const subtitulo = filtroPadreNombre
    ? `en ${String(filtroPadreNombre).slice(0, 60)}`
    : null;

  // ================================================================
  // CARGA
  // ================================================================
  const cargar = useCallback(async ({ isRefresh = false } = {}) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const data = await fetchProductos();
      setProductos(Array.isArray(data) ? data : []);
    } catch (e) {
      console.log("❌ ProductsScreen error:", e?.message);
      setError(e?.message || "No se pudieron cargar los productos");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // ================================================================
  // FILTRADO
  // ================================================================
  const productosFiltrados = useMemo(() => {
    let lista = productos;

    if (hayFiltroCategoria) {
      lista = lista.filter((p) => {
        const catId = getCategoriaId(p);
        if (!catId) return false;
        return idsPermitidos.has(catId);
      });
    }

    const q = searchSeguro.toLowerCase();
    if (!q) return lista;

    return lista.filter((p) => {
      const nombre = getNombre(p).toLowerCase();
      const desc = String(p.descripcion || "").toLowerCase();
      const cat = String(p.categoria_nombre || "").toLowerCase();
      const marca = getMarca(p).toLowerCase();
      return (
        nombre.includes(q) ||
        desc.includes(q) ||
        cat.includes(q) ||
        marca.includes(q)
      );
    });
  }, [productos, searchSeguro, hayFiltroCategoria, idsPermitidos]);

  const visitProduct = (prod) => {
    Keyboard.dismiss();
    navigation.navigate("ProductDetail", { product: prod });
  };

  // ================================================================
  // RENDER — CARD
  // ================================================================
  const renderItem = ({ item }) => {
    const foto = getFotoUrl(item);
    const precio = getPrecio(item);
    const precioMax = getPrecioMax(item);
    const stock = getStock(item);
    const agotado = stock === 0;
    const tieneVariasVariantes = precioMax > precio;

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.9}
        onPress={() => visitProduct(item)}
      >
        <View style={styles.cardImgWrap}>
          {foto ? (
            <Image
              source={{ uri: foto }}
              style={styles.cardImg}
              contentFit="cover"
              transition={250}
              cachePolicy="memory-disk"
            />
          ) : (
            <View style={[styles.cardImg, styles.cardImgEmpty]}>
              <Feather name="image" size={28} color="#94A3B8" />
            </View>
          )}

          {agotado && (
            <View style={styles.stockOverlay}>
              <View style={styles.stockOverlayPill}>
                <Text style={styles.stockOverlayText}>AGOTADO</Text>
              </View>
            </View>
          )}

          <View style={styles.priceTag}>
            <Text style={styles.priceTagText}>
              {tieneVariasVariantes ? "Desde " : ""}
              {currency(precio)}
            </Text>
          </View>

          {stock > 0 && stock < 5 && (
            <View style={styles.lowStockBadge}>
              <Feather name="alert-triangle" size={9} color="#FFF" />
              <Text style={styles.lowStockText}>{stock}</Text>
            </View>
          )}
        </View>

        <View style={styles.cardBody}>
          <Text style={styles.cardName} numberOfLines={2}>
            {getNombre(item)}
          </Text>

          {(item.categoria_nombre || item.marca_nombre) && (
            <View style={styles.cardMetaRow}>
              {!!item.categoria_nombre && (
                <View style={styles.metaPill}>
                  <Text style={styles.metaPillText} numberOfLines={1}>
                    {item.categoria_nombre}
                  </Text>
                </View>
              )}
              {!!item.marca_nombre && (
                <Text style={styles.cardCat} numberOfLines={1}>
                  {item.marca_nombre}
                </Text>
              )}
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  // ================================================================
  // RENDER — EMPTY
  // ================================================================
  const renderEmpty = () => {
    if (loading) return null;
    const buscando = !!searchSeguro;

    return (
      <View style={styles.empty}>
        <View style={styles.emptyIconWrap}>
          <Feather
            name={buscando ? "search" : "package"}
            size={40}
            color="#94A3B8"
          />
        </View>
        <Text style={styles.emptyTitle}>
          {buscando ? "Sin resultados" : "Sin productos"}
        </Text>
        <Text style={styles.emptySub}>
          {buscando
            ? `No encontramos productos para "${searchSeguro}"`
            : hayFiltroCategoria
            ? "Aún no hay productos en esta categoría"
            : "Aún no hay productos"}
        </Text>

        {buscando && (
          <TouchableOpacity
            style={styles.emptyBtn}
            onPress={() => {
              setSearch("");
              Keyboard.dismiss();
            }}
          >
            <Feather name="x" size={14} color="#FFF" />
            <Text style={styles.emptyBtnText}>Limpiar búsqueda</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

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
          style={styles.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={22} color="#1E293B" />
        </TouchableOpacity>

        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {titulo}
          </Text>
          {subtitulo && (
            <Text style={styles.headerSub} numberOfLines={1}>
              {subtitulo}
            </Text>
          )}
        </View>

        <TouchableOpacity
          style={styles.headerIconBtn}
          onPress={() => {
            setSearch("");
            Keyboard.dismiss();
            cargar({ isRefresh: true });
          }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather name="refresh-cw" size={18} color="#64748B" />
        </TouchableOpacity>
      </View>

      {/* SEARCH */}
      <View style={styles.searchWrap}>
        <Feather
          name="search"
          size={16}
          color={searchSeguro ? "#8B5CF6" : "#64748B"}
        />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar nombre, marca o categoría…"
          placeholderTextColor="#94A3B8"
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={80}
        />
        {search.length > 0 && (
          <TouchableOpacity
            onPress={() => setSearch("")}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close-circle" size={17} color="#94A3B8" />
          </TouchableOpacity>
        )}
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
          <ActivityIndicator size="large" color="#8B5CF6" />
          <Text style={styles.loadingText}>Cargando productos…</Text>
        </View>
      ) : (
        <FlatList
          data={productosFiltrados}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          numColumns={2}
          columnWrapperStyle={styles.column}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          ListEmptyComponent={renderEmpty}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => cargar({ isRefresh: true })}
              colors={["#8B5CF6"]}
              tintColor="#8B5CF6"
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

// ================================================================
// ESTILOS
// ================================================================
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8F7F4" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 40 },
  loadingText: { color: "#64748B", marginTop: 14, fontSize: 14 },

  // HEADER
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "#F5F3EF",
    borderBottomWidth: 1,
    borderColor: "#EADCC9",
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "#FFF",
    justifyContent: "center",
    alignItems: "center",
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "#FFF",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: { fontSize: 16, fontWeight: "800", color: "#1E293B" },
  headerSub: { fontSize: 11, color: "#94A3B8", marginTop: 2 },

  // SEARCH
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 14,
    marginTop: 12,
    paddingHorizontal: 14,
    height: 44,
    backgroundColor: "#FFF",
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
  },
  searchInput: {
    flex: 1,
    color: "#1E293B",
    fontSize: 13,
    fontWeight: "500",
    padding: 0,
  },

  // ERROR
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

  // LIST
  listContent: { padding: 16, paddingBottom: 30 },
  column: { gap: 12 },

  // CARD
  card: {
    width: CARD_W,
    backgroundColor: "#FFF",
    borderRadius: 16,
    marginBottom: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  cardImgWrap: { position: "relative" },
  cardImg: {
    width: "100%",
    height: CARD_W * 1.15,
    backgroundColor: "#F0F1F6",
  },
  cardImgEmpty: { justifyContent: "center", alignItems: "center" },

  stockOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
  },
  stockOverlayPill: {
    borderWidth: 1.5,
    borderColor: "#FFF",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
  },
  stockOverlayText: {
    color: "#FFF",
    fontWeight: "900",
    fontSize: 11,
    letterSpacing: 1.5,
  },

  priceTag: {
    position: "absolute",
    bottom: 8,
    right: 8,
    backgroundColor: "rgba(0,0,0,0.78)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  priceTagText: { color: "#FFF", fontSize: 12, fontWeight: "900" },

  lowStockBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#F59E0B",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  lowStockText: { color: "#FFF", fontSize: 10, fontWeight: "900" },

  cardBody: { padding: 10 },
  cardName: {
    fontWeight: "800",
    fontSize: 13,
    minHeight: 34,
    lineHeight: 17,
    color: "#1E293B",
  },
  cardMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
    flexWrap: "wrap",
  },
  metaPill: {
    backgroundColor: "#F3EFFF",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    maxWidth: "70%",
  },
  metaPillText: { fontSize: 9, fontWeight: "800", color: "#8B5CF6" },
  cardCat: { fontSize: 10, fontWeight: "600", color: "#94A3B8", flexShrink: 1 },

  // EMPTY
  empty: { alignItems: "center", padding: 40, gap: 10 },
  emptyIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  emptyTitle: { fontSize: 16, fontWeight: "900", color: "#1E293B" },
  emptySub: {
    fontSize: 13,
    color: "#94A3B8",
    textAlign: "center",
    paddingHorizontal: 20,
  },
  emptyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#8B5CF6",
    borderRadius: 10,
  },
  emptyBtnText: { color: "#FFF", fontWeight: "800", fontSize: 12 },
});