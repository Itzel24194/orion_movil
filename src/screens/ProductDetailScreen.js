// screens/ProductDetailScreen.js
import React, { useContext, useMemo, useRef, useState, useEffect, useCallback } from 'react';
import {
  Animated,
  Dimensions,
  FlatList,
  Modal,
  ScrollView,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, TextInput, Alert } from '../i18n/ui';
import { Feather, Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useVideoPlayer, VideoView } from 'expo-video';
import * as Haptics from 'expo-haptics';
import { ProductContext } from '../context/ProductContext';
import { usePreferences } from '../context/PreferencesContext';
import {
  resolveProductPhoto,
  fetchProductos,
} from '../services/api';

const { width: SCREEN_W } = Dimensions.get('window');

// ================================================================
// SEGURIDAD — Helpers
// ================================================================
const sanitizeText = (raw, max = 200) => {
  if (raw == null) return '';
  return String(raw)
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
};

const sanitizeSearch = (raw) => {
  const s = String(raw || '');
  return s
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
};

const buildCartItem = (product, variant, qty, selectedSize, selectedColor) => {
  const stockVariante = Number(variant?.stock) || 0;

  return {
    id: String(product?.id || '').trim(),
    productId: String(product?.id || '').trim(),
    producto_id: String(product?.id || '').trim(),

    nombre: sanitizeText(product?.nombre, 120) || 'Producto',
    name: sanitizeText(product?.nombre, 120) || 'Producto',

    categoria_nombre: sanitizeText(product?.categoria_nombre, 80) || null,
    marca_nombre: sanitizeText(product?.marca_nombre, 80) || null,

    variantSku: variant?.sku ? String(variant.sku).slice(0, 60) : null,
    sku: variant?.sku ? String(variant.sku).slice(0, 60) : null,
    selectedSize: selectedSize ? String(selectedSize).slice(0, 40) : null,
    selectedColor: selectedColor ? String(selectedColor).slice(0, 40) : null,

    selectedStock: stockVariante,
    variantStock: stockVariante,

    quantity: Math.max(1, Math.min(999, Number(qty) || 1)),
    cantidad: Math.max(1, Math.min(999, Number(qty) || 1)),

    unitPrice: Number(variant?.precio) || 0,
    precio: Number(variant?.precio) || 0,

    imagen: (() => {
      const fotos = Array.isArray(product?.fotos) ? product.fotos : [];
      const primera = fotos[0];
      if (!primera) return null;
      if (typeof primera === 'string') return primera.split('/').pop();
      return (primera?.nombre || primera?.url || '').split('/').pop() || null;
    })(),
  };
};

const puedeAgregarConStock = (variante, qty) => {
  if (!variante) return false;
  const stock = Number(variante.stock) || 0;
  const cantidad = Number(qty) || 1;
  return stock > 0 && cantidad > 0 && cantidad <= stock;
};

// ================================================================
// HELPERS GENERALES
// ================================================================
const price = (v) =>
  `$${Number(v || 0).toLocaleString('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const normalizeProduct = (raw) => {
  if (!raw) return null;

  const variables = Array.isArray(raw.variables)
    ? raw.variables
    : Array.isArray(raw.variantes)
    ? raw.variantes
    : [];

  const fotos = Array.isArray(raw.fotos)
    ? raw.fotos
        .map((f) => (typeof f === 'string' ? f : f?.url || f?.nombre || ''))
        .filter(Boolean)
    : [];

  const videos = Array.isArray(raw.videos)
    ? raw.videos
        .map((v) => (typeof v === 'string' ? v : v?.url || v?.nombre || ''))
        .filter(Boolean)
    : [];

  return {
    id: String(raw.id || raw._id || ''),
    nombre: sanitizeText(raw.nombre || raw.name || 'Producto', 120),
    descripcion: sanitizeText(raw.descripcion || raw.description || '', 500),
    categoria_nombre: sanitizeText(raw.categoria_nombre || raw.category || '', 80),
    marca_nombre: sanitizeText(raw.marca_nombre || raw.brand || '', 80),
    fotos,
    videos,
    variables: variables.map((v) => ({
      sku: sanitizeText(v.sku || '', 60),
      color: sanitizeText(v.color || '', 40),
      tamano: sanitizeText(
        String(v.tamano || v.talla || v.size || '').replace(/\s+/g, ' '),
        40
      ),
      precio: Number(v.precio ?? v.price ?? 0),
      stock: Number(v.stock ?? v.cantidad ?? 0),
    })),
  };
};

const prettySize = (tamano) => {
  if (!tamano) return '—';
  const limpio = tamano.replace(/^Talla\s*/i, '').replace(/\t/g, ' ').trim();
  return limpio || tamano;
};

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

const buscarProductos = (productos, termino) => {
  const q = String(termino || '').toLowerCase().trim();
  if (!q) return [];

  return productos
    .filter((p) => {
      const nombre = String(p.nombre || p.name || '').toLowerCase();
      const marca = String(p.marca_nombre || p.brand || '').toLowerCase();
      const cat = String(p.categoria_nombre || '').toLowerCase();
      const desc = String(p.descripcion || p.description || '').toLowerCase();
      return (
        nombre.includes(q) ||
        marca.includes(q) ||
        cat.includes(q) ||
        desc.includes(q)
      );
    })
    .slice(0, 50);
};

// ================================================================
// REPRODUCTOR DE VIDEO
// ================================================================
function VideoPlayer({ uri, height = 220 }) {
  const resolved = resolveProductPhoto(uri);
  const player = useVideoPlayer(resolved || '', (p) => {
    p.loop = false;
    p.muted = true;
  });

  if (!resolved) return null;

  return (
    <View style={[styles.videoWrap, { height }]}>
      <VideoView
        player={player}
        style={{ width: '100%', height: '100%' }}
        allowsFullscreen
        nativeControls
        contentFit="contain"
      />
    </View>
  );
}

// ================================================================
// COMPONENTE PRINCIPAL
// ================================================================
export default function ProductDetailScreen({ route, navigation }) {
  const rawProduct = route.params?.product;
  const [currentRawProduct, setCurrentRawProduct] = useState(rawProduct);

  const product = useMemo(
    () => normalizeProduct(currentRawProduct),
    [currentRawProduct]
  );

  const { addToCart } = useContext(ProductContext);
  const { palette: p, t, isDark } = usePreferences();

  const pulse = useRef(new Animated.Value(1)).current;

  // ⭐ Estados del buscador
  const [searchText, setSearchText] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [allProductos, setAllProductos] = useState([]);
  const [searchFocused, setSearchFocused] = useState(false);

  const [fotoIdx, setFotoIdx] = useState(0);
  const [selectedColor, setSelectedColor] = useState(
    product?.variables?.[0]?.color || null
  );
  const [selectedSize, setSelectedSize] = useState(null);
  const [qty, setQty] = useState(1);
  const [lightboxVisible, setLightboxVisible] = useState(false);
  const [stockWarning, setStockWarning] = useState(null);
  const [adding, setAdding] = useState(false);

  // ⭐ Carga de productos (para el buscador)
  useEffect(() => {
    (async () => {
      try {
        const data = await fetchProductos();
        setAllProductos(Array.isArray(data) ? data : []);
      } catch (e) {
        console.log("⚠️ No se pudieron cargar productos:", e?.message);
      }
    })();
  }, []);

  // ⭐ Resetear selección al cambiar de producto
  useEffect(() => {
    setSelectedColor(product?.variables?.[0]?.color || null);
    setSelectedSize(null);
    setQty(1);
    setFotoIdx(0);
  }, [currentRawProduct?.id]);

  // ⭐ Búsqueda reactiva
  const searchSeguro = useMemo(() => sanitizeSearch(searchText), [searchText]);
  const modoBusqueda = searchSeguro.length > 0;

  useEffect(() => {
    if (modoBusqueda) {
      setSearchResults(buscarProductos(allProductos, searchSeguro));
    } else {
      setSearchResults([]);
    }
  }, [modoBusqueda, searchSeguro, allProductos]);

  const coloresDisponibles = useMemo(() => {
    if (!product) return [];
    const map = new Map();
    product.variables.forEach((v) => {
      if (!v.color) return;
      if (!map.has(v.color))
        map.set(v.color, { nombre: v.color, stock: 0, variantes: [] });
      const entry = map.get(v.color);
      entry.stock += v.stock;
      entry.variantes.push(v);
    });
    return Array.from(map.values());
  }, [product]);

  const tallasDisponibles = useMemo(() => {
    if (!product) return [];
    const filtered = selectedColor
      ? product.variables.filter((v) => v.color === selectedColor)
      : product.variables;

    const map = new Map();
    filtered.forEach((v) => {
      const key = v.tamano || '—';
      if (!map.has(key)) {
        map.set(key, { tamano: key, stock: 0, precio: v.precio, sku: v.sku });
      }
      const entry = map.get(key);
      entry.stock += v.stock;
    });
    return Array.from(map.values());
  }, [product, selectedColor]);

  useEffect(() => {
    if (selectedSize === null && tallasDisponibles.length > 0) {
      const conStock = tallasDisponibles.find((s) => s.stock > 0);
      setSelectedSize((conStock || tallasDisponibles[0]).tamano);
    }
  }, [tallasDisponibles, selectedSize]);

  const varianteActiva = useMemo(() => {
    if (!product) return null;
    return (
      product.variables.find(
        (v) =>
          (!selectedColor || v.color === selectedColor) &&
          (!selectedSize || v.tamano === selectedSize)
      ) || null
    );
  }, [product, selectedColor, selectedSize]);

  const precioActual = useMemo(() => {
    if (varianteActiva) return varianteActiva.precio;
    if (product?.variables?.length) return product.variables[0].precio;
    return 0;
  }, [varianteActiva, product]);

  const stockActual = varianteActiva?.stock ?? 0;
  const stockBajo = stockActual > 0 && stockActual < 5;

  useEffect(() => {
    if (!varianteActiva) {
      setStockWarning(null);
      return;
    }
    if (qty > stockActual) {
      setStockWarning(`Solo quedan ${stockActual} unidades disponibles`);
    } else {
      setStockWarning(null);
    }
  }, [qty, stockActual, varianteActiva]);

  const puedeAgregar = useMemo(() => {
    if (!selectedSize) return false;
    if (coloresDisponibles.length > 0 && !selectedColor) return false;
    return puedeAgregarConStock(varianteActiva, qty);
  }, [selectedSize, selectedColor, coloresDisponibles.length, varianteActiva, qty]);

  const handleSelectColor = (colorNombre) => {
    Haptics.selectionAsync().catch(() => {});
    setSelectedColor(colorNombre);
    const tallasColor = product.variables.filter((v) => v.color === colorNombre);
    const tallaSigue = tallasColor.some(
      (v) => v.tamano === selectedSize && v.stock > 0
    );
    if (!tallaSigue) {
      const conStock = tallasColor.find((v) => v.stock > 0);
      setSelectedSize(conStock?.tamano || tallasColor[0]?.tamano || null);
    }
    setQty(1);
    setStockWarning(null);
  };

  const handleSelectSize = (tamano) => {
    Haptics.selectionAsync().catch(() => {});
    setSelectedSize(tamano);
    setQty(1);
    setStockWarning(null);
  };

  const add = () => {
    if (adding) return;
    if (!varianteActiva || !selectedSize) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      return;
    }

    if (!puedeAgregarConStock(varianteActiva, qty)) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      Alert.alert(
        'Stock insuficiente',
        `Solo quedan ${stockActual} unidades de este color y talla. Ajusta la cantidad.`
      );
      setQty(Math.max(1, Math.min(stockActual, qty)));
      return;
    }

    setAdding(true);

    const cartItem = buildCartItem(
      product,
      varianteActiva,
      qty,
      selectedSize,
      selectedColor
    );

    try {
      addToCart(cartItem);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => {}
      );
      Animated.sequence([
        Animated.spring(pulse, { toValue: 1.05, useNativeDriver: true }),
        Animated.spring(pulse, { toValue: 1, useNativeDriver: true }),
      ]).start();

      navigation.navigate('Cart');
    } finally {
      setTimeout(() => setAdding(false), 300);
    }
  };

  const goTryOn = () => {
    Haptics.selectionAsync().catch(() => {});
    navigation.navigate('TryOn', {
      product: {
        id: product.id,
        nombre: product.nombre,
        fotos: product.fotos,
        variables: product.variables,
        categoria_nombre: product.categoria_nombre,
        marca_nombre: product.marca_nombre,
      },
      selectedSize,
      selectedColor,
    });
  };

  // ⭐ Al tocar un resultado del buscador, cambiamos el producto
  const handleSelectSearchResult = useCallback((prod) => {
    Keyboard.dismiss();
    setSearchText("");
    setSearchFocused(false);
    setCurrentRawProduct(prod);
  }, []);

  if (!product) {
    return (
      <SafeAreaView style={[styles.page, { backgroundColor: p.background }]}>
        <View style={styles.center}>
          <Feather name="alert-circle" size={48} color={p.subtle} />
          <Text style={{ color: p.text, marginTop: 12, fontSize: 16 }}>
            Producto no disponible
          </Text>
          <TouchableOpacity
            style={[styles.retryBtn, { backgroundColor: p.primary }]}
            onPress={() => navigation.goBack()}
          >
            <Text style={{ color: '#FFF', fontWeight: '800' }}>Volver</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const tieneFotos = product.fotos.length > 0;
  const tieneVideos = product.videos.length > 0;

  return (
    <SafeAreaView style={[styles.page, { backgroundColor: p.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* HEADER: flecha atrás + título + carrito */}
      <View
        style={[
          styles.top,
          { backgroundColor: p.background, borderBottomColor: p.border },
        ]}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={[styles.icon, { backgroundColor: p.surface }]}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Feather name="arrow-left" size={22} color={p.text} />
        </TouchableOpacity>

        <Text style={[styles.topTitle, { color: p.text }]}>
          DETALLE DEL PRODUCTO
        </Text>

        <TouchableOpacity
          onPress={() => navigation.navigate('Cart')}
          style={[styles.icon, { backgroundColor: p.surface }]}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="bag-outline" size={22} color={p.text} />
        </TouchableOpacity>
      </View>

      {/* ⭐ BUSCADOR */}
      <View style={styles.searchWrap}>
        <Ionicons
          name="search"
          size={16}
          color={searchSeguro ? "#8B5CF6" : "#64748B"}
        />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar productos…"
          placeholderTextColor="#94A3B8"
          value={searchText}
          onChangeText={setSearchText}
          onFocus={() => setSearchFocused(true)}
          returnKeyType="search"
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={80}
        />
        {searchText.length > 0 && (
          <TouchableOpacity
            onPress={() => {
              setSearchText("");
              Keyboard.dismiss();
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close-circle" size={17} color="#94A3B8" />
          </TouchableOpacity>
        )}
      </View>

      {/* ⭐ RESULTADOS DEL BUSCADOR */}
      {modoBusqueda && searchFocused && (
        <View style={styles.searchResultsWrap}>
          {searchResults.length === 0 ? (
            <View style={styles.searchEmpty}>
              <Feather name="search" size={16} color="#94A3B8" />
              <Text style={styles.searchEmptyText}>
                Sin resultados para "{searchSeguro}"
              </Text>
            </View>
          ) : (
            <FlatList
              data={searchResults}
              keyboardShouldPersistTaps="handled"
              keyExtractor={(it, i) => `${it.id || it._id}-${i}`}
              renderItem={({ item }) => {
                const foto = getFotoProducto(item);
                const precio = getPrecioProducto(item);
                return (
                  <TouchableOpacity
                    style={styles.searchResultItem}
                    onPress={() => handleSelectSearchResult(item)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.searchResultImgWrap}>
                      {foto ? (
                        <Image
                          source={{ uri: foto }}
                          style={styles.searchResultImg}
                          contentFit="cover"
                        />
                      ) : (
                        <View
                          style={[
                            styles.searchResultImg,
                            { justifyContent: "center", alignItems: "center" },
                          ]}
                        >
                          <Feather name="image" size={14} color="#94A3B8" />
                        </View>
                      )}
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.searchResultName} numberOfLines={1}>
                        {item.nombre}
                      </Text>
                      <Text style={styles.searchResultMeta} numberOfLines={1}>
                        {item.categoria_nombre || ""}
                        {item.marca_nombre ? ` · ${item.marca_nombre}` : ""}
                      </Text>
                    </View>
                    <Text style={styles.searchResultPrice}>
                      {price(precio)}
                    </Text>
                  </TouchableOpacity>
                );
              }}
              style={{ maxHeight: 380 }}
            />
          )}
        </View>
      )}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* FOTOS */}
        <View style={[styles.imageBox, { backgroundColor: p.surface }]}>
          {tieneFotos ? (
            <>
              <FlatList
                data={product.fotos}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                keyExtractor={(_, i) => `foto-${i}`}
                onMomentumScrollEnd={(e) => {
                  const idx = Math.round(
                    e.nativeEvent.contentOffset.x / (SCREEN_W - 32)
                  );
                  setFotoIdx(idx);
                }}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    activeOpacity={0.95}
                    onPress={() => setLightboxVisible(true)}
                    style={{ width: SCREEN_W - 32, height: 340 }}
                  >
                    <Image
                      source={{ uri: resolveProductPhoto(item) }}
                      style={{ width: '100%', height: '100%' }}
                      contentFit="cover"
                      transition={250}
                      cachePolicy="memory-disk"
                    />
                  </TouchableOpacity>
                )}
              />

              {product.fotos.length > 1 && (
                <View style={styles.dotsRow}>
                  {product.fotos.map((_, i) => (
                    <View
                      key={i}
                      style={[
                        styles.dotDot,
                        {
                          backgroundColor:
                            i === fotoIdx ? '#FFF' : 'rgba(255,255,255,0.5)',
                          width: i === fotoIdx ? 18 : 6,
                        },
                      ]}
                    />
                  ))}
                </View>
              )}

              <View style={styles.badge}>
                <Text style={styles.badgeText}>ORION SELECT</Text>
              </View>

              <View style={styles.counterPill}>
                <Ionicons name="images" size={11} color="#FFF" />
                <Text style={styles.counterText}>
                  {fotoIdx + 1}/{product.fotos.length}
                </Text>
              </View>
            </>
          ) : (
            <View style={[styles.imagePlaceholder, { backgroundColor: p.soft }]}>
              <Feather name="image" size={48} color={p.subtle} />
              <Text style={{ color: p.subtle, marginTop: 10, fontSize: 13 }}>
                Sin fotos disponibles
              </Text>
            </View>
          )}
        </View>

        {/* THUMBNAILS */}
        {product.fotos.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.thumbsRow}
          >
            {product.fotos.map((f, i) => (
              <TouchableOpacity
                key={i}
                onPress={() => setFotoIdx(i)}
                style={[
                  styles.thumb,
                  {
                    borderColor: i === fotoIdx ? p.primary : 'transparent',
                    borderWidth: i === fotoIdx ? 2 : 0,
                  },
                ]}
              >
                <Image
                  source={{ uri: resolveProductPhoto(f) }}
                  style={{ width: '100%', height: '100%', borderRadius: 9 }}
                  contentFit="cover"
                />
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        <View style={styles.body}>
          {/* CATEGORÍA / MARCA */}
          <View style={styles.catRow}>
            {!!product.categoria_nombre && (
              <View
                style={[styles.catPill, { backgroundColor: `${p.primary}18` }]}
              >
                <Text style={[styles.category, { color: p.primary }]}>
                  {product.categoria_nombre.toUpperCase()}
                </Text>
              </View>
            )}
            {!!product.marca_nombre && (
              <View style={[styles.catPill, { backgroundColor: p.soft }]}>
                <Text style={[styles.category, { color: p.subtle }]}>
                  {product.marca_nombre.toUpperCase()}
                </Text>
              </View>
            )}
          </View>

          {/* NOMBRE */}
          <Text style={[styles.name, { color: p.text }]}>{product.nombre}</Text>

          {/* PRECIO + STOCK */}
          <View style={styles.priceRow}>
            <Text style={[styles.price, { color: p.text }]}>
              {price(precioActual)}
            </Text>
            {varianteActiva && (
              <View
                style={[
                  styles.stockPill,
                  {
                    backgroundColor:
                      stockActual === 0
                        ? '#450a0a'
                        : stockBajo
                        ? '#78350f'
                        : '#064e3b',
                  },
                ]}
              >
                <View
                  style={[
                    styles.stockDot,
                    {
                      backgroundColor:
                        stockActual === 0
                          ? '#fca5a5'
                          : stockBajo
                          ? '#fbbf24'
                          : '#6ee7b7',
                    },
                  ]}
                />
                <Text
                  style={[
                    styles.stockText,
                    {
                      color:
                        stockActual === 0
                          ? '#fca5a5'
                          : stockBajo
                          ? '#fbbf24'
                          : '#6ee7b7',
                    },
                  ]}
                >
                  {stockActual === 0
                    ? 'AGOTADO'
                    : `${stockActual} ${
                        stockActual === 1 ? 'disponible' : 'disponibles'
                      }`}
                </Text>
              </View>
            )}
          </View>

          {/* DESCRIPCIÓN */}
          <Text style={[styles.desc, { color: p.subtle }]}>
            {product.descripcion || 'Conoce más sobre este artículo de ORION.'}
          </Text>

          {/* TRY-ON */}
          <TouchableOpacity
            style={[
              styles.try,
              { backgroundColor: p.soft, borderColor: p.primary },
            ]}
            onPress={goTryOn}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={[`${p.primary}30`, `${p.primary}10`]}
              style={styles.tryIconWrap}
            >
              <Ionicons name="camera-outline" size={22} color={p.primary} />
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <Text style={[styles.tryTitle, { color: p.primary }]}>
                {t('virtual') || 'Probar con cámara'}
              </Text>
              <Text style={[styles.tryNote, { color: p.subtle }]}>
                Visualiza esta prenda con el espejo virtual
              </Text>
            </View>
            <Feather name="arrow-up-right" size={20} color={p.primary} />
          </TouchableOpacity>

          {/* COLORES */}
          {coloresDisponibles.length > 0 && (
            <>
              <View style={styles.captionRow}>
                <Text style={[styles.caption, { color: p.text }]}>Color:</Text>
                <Text style={[styles.captionValue, { color: p.primary }]}>
                  {selectedColor || '—'}
                </Text>
              </View>
              <View style={styles.choices}>
                {coloresDisponibles.map((c) => {
                  const activo = c.nombre === selectedColor;
                  const sinStock = c.stock === 0;
                  return (
                    <TouchableOpacity
                      key={c.nombre}
                      onPress={() => handleSelectColor(c.nombre)}
                      disabled={sinStock}
                      activeOpacity={0.85}
                      style={[
                        styles.colorWrap,
                        {
                          borderColor: activo ? p.primary : p.border,
                          backgroundColor: activo ? `${p.primary}15` : p.surface,
                          opacity: sinStock ? 0.4 : 1,
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.dot,
                          { backgroundColor: colorToHex(c.nombre) },
                        ]}
                      />
                      <Text
                        style={{ color: p.text, fontSize: 12, fontWeight: '600' }}
                      >
                        {c.nombre}
                      </Text>
                      {activo && (
                        <Feather name="check" size={12} color={p.primary} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}

          {/* TALLAS */}
          {tallasDisponibles.length > 0 && (
            <>
              <View style={styles.captionRow}>
                <Text style={[styles.caption, { color: p.text }]}>Talla:</Text>
                <Text style={[styles.captionValue, { color: p.primary }]}>
                  {selectedSize ? prettySize(selectedSize) : '—'}
                </Text>
              </View>
              <View style={styles.choices}>
                {tallasDisponibles.map((s) => {
                  const activo = s.tamano === selectedSize;
                  const sinStock = s.stock === 0;
                  return (
                    <TouchableOpacity
                      key={s.tamano}
                      onPress={() => handleSelectSize(s.tamano)}
                      disabled={sinStock}
                      activeOpacity={0.85}
                      style={[
                        styles.size,
                        {
                          backgroundColor: activo ? p.primary : p.surface,
                          borderColor: activo ? p.primary : p.border,
                          opacity: sinStock ? 0.4 : 1,
                        },
                      ]}
                    >
                      <Text
                        style={{
                          color: activo ? '#FFF' : p.text,
                          fontWeight: '800',
                          fontSize: 12,
                        }}
                        numberOfLines={1}
                      >
                        {prettySize(s.tamano)}
                      </Text>
                      {sinStock && (
                        <Text
                          style={{
                            fontSize: 8,
                            color: activo ? '#FFF' : p.subtle,
                            marginTop: 2,
                          }}
                        >
                          sin stock
                        </Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}

          {/* WARNING STOCK */}
          {!!stockWarning && (
            <View style={styles.warningBox}>
              <Feather name="alert-triangle" size={14} color="#f59e0b" />
              <Text style={styles.warningText}>{stockWarning}</Text>
            </View>
          )}

          {/* SKU */}
          {varianteActiva?.sku && (
            <View
              style={[
                styles.infoBox,
                { backgroundColor: p.surface, borderColor: p.border },
              ]}
            >
              <View style={styles.infoRow}>
                <Feather name="tag" size={13} color={p.subtle} />
                <Text style={[styles.infoLabel, { color: p.subtle }]}>SKU</Text>
                <Text
                  style={[styles.infoValue, { color: p.text }]}
                  numberOfLines={1}
                >
                  {varianteActiva.sku}
                </Text>
              </View>
            </View>
          )}

          {/* CANTIDAD */}
          <View style={[styles.qtyRow, { borderColor: p.border }]}>
            <Text style={[styles.caption, { color: p.text, marginBottom: 0 }]}>
              Cantidad
            </Text>
            <View style={styles.stepper}>
              <TouchableOpacity
                onPress={() => setQty((n) => Math.max(1, n - 1))}
                style={[styles.step, { backgroundColor: p.surface }]}
                disabled={qty <= 1}
              >
                <Feather
                  name="minus"
                  size={18}
                  color={qty <= 1 ? p.subtle : p.text}
                />
              </TouchableOpacity>
              <Text style={[styles.number, { color: p.text }]}>{qty}</Text>
              <TouchableOpacity
                onPress={() =>
                  setQty((n) => Math.min(Math.max(1, stockActual), n + 1))
                }
                style={[styles.step, { backgroundColor: p.surface }]}
                disabled={qty >= stockActual}
              >
                <Feather
                  name="plus"
                  size={18}
                  color={qty >= stockActual ? p.subtle : p.text}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* VIDEOS */}
          {tieneVideos && (
            <View style={{ marginTop: 22 }}>
              <View style={styles.captionRow}>
                <Text style={[styles.caption, { color: p.text }]}>
                  Videos ({product.videos.length})
                </Text>
              </View>
              {product.videos.map((v, i) => (
                <VideoPlayer key={i} uri={v} />
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* BOTTOM BAR */}
      <View
        style={[
          styles.bottom,
          { backgroundColor: p.surface, borderTopColor: p.border },
        ]}
      >
        <View>
          <Text style={{ color: p.subtle, fontSize: 11 }}>Total</Text>
          <Text style={[styles.bottomPrice, { color: p.text }]}>
            {price(precioActual * qty)}
          </Text>
        </View>
        <Animated.View style={{ transform: [{ scale: pulse }], flex: 1 }}>
          <TouchableOpacity
            onPress={add}
            disabled={!puedeAgregar || adding}
            activeOpacity={0.85}
            style={[
              styles.addButton,
              {
                backgroundColor: puedeAgregar ? p.primary : '#334155',
                opacity: puedeAgregar ? 1 : 0.7,
              },
            ]}
          >
            <Feather
              name={puedeAgregar ? 'shopping-bag' : 'x-circle'}
              color="#FFF"
              size={20}
            />
            <Text style={styles.addText}>
              {!selectedSize || (coloresDisponibles.length > 0 && !selectedColor)
                ? 'Elige opciones'
                : stockActual === 0
                ? 'Sin stock'
                : qty > stockActual
                ? 'Ajusta la cantidad'
                : 'Agregar al carrito'}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </View>

      {/* LIGHTBOX */}
      <Modal
        visible={lightboxVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setLightboxVisible(false)}
      >
        <View style={styles.lightboxOverlay}>
          <TouchableOpacity
            style={styles.lightboxClose}
            onPress={() => setLightboxVisible(false)}
          >
            <Ionicons name="close" size={26} color="#FFF" />
          </TouchableOpacity>
          <FlatList
            data={product.fotos}
            horizontal
            pagingEnabled
            initialScrollIndex={fotoIdx}
            getItemLayout={(_, i) => ({
              length: SCREEN_W,
              offset: SCREEN_W * i,
              index: i,
            })}
            keyExtractor={(_, i) => `lb-${i}`}
            renderItem={({ item }) => (
              <View
                style={{
                  width: SCREEN_W,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <Image
                  source={{ uri: resolveProductPhoto(item) }}
                  style={{ width: SCREEN_W, height: SCREEN_W }}
                  contentFit="contain"
                />
              </View>
            )}
          />
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ================================================================
// UTIL: color nombre → hex
// ================================================================
function colorToHex(nombre) {
  const n = String(nombre || '').toLowerCase().trim();
  const map = {
    negro: '#111111',
    blanco: '#F8FAFC',
    blanco_hueso: '#EFE9DC',
    azul: '#3B82F6',
    'azul marino': '#1E3A8A',
    'azul cielo': '#60A5FA',
    rojo: '#EF4444',
    verde: '#10B981',
    'verde olivo': '#65A30D',
    vino: '#7F1D1D',
    rosa: '#EC4899',
    rosa_palo: '#F9A8D4',
    morado: '#8B5CF6',
    violeta: '#7C3AED',
    lila: '#C4B5FD',
    amarillo: '#FACC15',
    naranja: '#F97316',
    cafe: '#78350F',
    café: '#78350F',
    marron: '#78350F',
    marrón: '#78350F',
    gris: '#6B7280',
    'gris claro': '#D1D5DB',
    'gris oscuro': '#374151',
    beige: '#E7D3B3',
    nude: '#E8C6B0',
    dorado: '#F59E0B',
    oro: '#F59E0B',
    plateado: '#C0C0C0',
    plata: '#C0C0C0',
    celeste: '#7DD3FC',
    turquesa: '#14B8A6',
    menta: '#6EE7B7',
    crema: '#FEF3C7',
    mostaza: '#CA8A04',
    coral: '#FB7185',
    salmon: '#FDA4AF',
    salmón: '#FDA4AF',
    chocolate: '#5C3A21',
    camel: '#B08968',
    khaki: '#A3A380',
    oliva: '#65A30D',
    transparente: '#E5E7EB',
  };

  if (map[n]) return map[n];

  for (const k of Object.keys(map)) {
    if (n.includes(k)) return map[k];
  }

  return '#94A3B8';
}

// ================================================================
// ESTILOS
// ================================================================
const styles = StyleSheet.create({
  page: { flex: 1 },

  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  icon: { borderRadius: 14, padding: 10 },
  topTitle: {
    fontWeight: '900',
    fontSize: 13,
    letterSpacing: 1.5,
    flex: 1,
    textAlign: 'center',
  },

  // Buscador
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 14,
    marginTop: 12,
    paddingHorizontal: 14,
    height: 42,
    backgroundColor: '#FFF',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  searchInput: {
    flex: 1,
    color: '#1E293B',
    fontSize: 13,
    fontWeight: '500',
    padding: 0,
  },

  searchResultsWrap: {
    marginHorizontal: 14,
    marginTop: 6,
    backgroundColor: '#FFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  searchEmpty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 16,
  },
  searchEmptyText: { fontSize: 13, color: '#94A3B8', fontStyle: 'italic' },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  searchResultImgWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#F1F5F9',
  },
  searchResultImg: { width: '100%', height: '100%' },
  searchResultName: { fontSize: 13, fontWeight: '700', color: '#1E293B' },
  searchResultMeta: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
  searchResultPrice: {
    fontSize: 12,
    fontWeight: '800',
    color: '#8B5CF6',
    marginLeft: 8,
  },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30 },
  retryBtn: {
    marginTop: 16,
    paddingHorizontal: 22,
    paddingVertical: 11,
    borderRadius: 12,
  },

  imageBox: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 24,
    height: 340,
    overflow: 'hidden',
    position: 'relative',
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  badge: {
    position: 'absolute',
    top: 16,
    left: 16,
    backgroundColor: 'rgba(35,38,79,0.9)',
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 10,
  },
  badgeText: { color: '#FFF', fontSize: 9, letterSpacing: 1.2, fontWeight: '900' },
  counterPill: {
    position: 'absolute',
    bottom: 14,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.75)',
  },
  counterText: { color: '#FFF', fontSize: 10, fontWeight: '800' },
  dotsRow: {
    position: 'absolute',
    bottom: 14,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dotDot: { height: 6, borderRadius: 3 },

  thumbsRow: { gap: 8, paddingHorizontal: 22, paddingVertical: 14 },
  thumb: {
    width: 60,
    height: 60,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#020617',
  },

  body: { paddingHorizontal: 22, paddingTop: 6 },
  catRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  catPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  category: { fontWeight: '900', fontSize: 10, letterSpacing: 1.2 },
  name: { fontSize: 25, fontWeight: '900', marginTop: 10, lineHeight: 30 },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
  },
  price: { fontSize: 24, fontWeight: '900' },
  stockPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
  },
  stockDot: { width: 6, height: 6, borderRadius: 3 },
  stockText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },

  desc: { fontSize: 14, lineHeight: 21, marginTop: 14 },

  try: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    marginTop: 20,
    marginBottom: 18,
  },
  tryIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tryTitle: { fontWeight: '900', fontSize: 14 },
  tryNote: { fontSize: 11, marginTop: 3 },

  captionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
    marginBottom: 10,
  },
  caption: { fontWeight: '800', fontSize: 14 },
  captionValue: { fontWeight: '900', fontSize: 14 },

  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  size: {
    minWidth: 62,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  colorWrap: {
    borderWidth: 2,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  dot: {
    width: 19,
    height: 19,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },

  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    padding: 10,
    backgroundColor: '#78350f25',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#78350f',
  },
  warningText: { color: '#fbbf24', fontSize: 12, fontWeight: '600' },

  infoBox: {
    marginTop: 18,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  infoValue: { flex: 1, fontSize: 12, fontWeight: '600' },

  qtyRow: {
    paddingVertical: 17,
    borderTopWidth: 1,
    marginTop: 21,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepper: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  step: { padding: 10, borderRadius: 10 },
  number: { fontSize: 16, fontWeight: '800', minWidth: 22, textAlign: 'center' },

  bottom: {
    padding: 15,
    flexDirection: 'row',
    gap: 16,
    alignItems: 'center',
    borderTopWidth: 1,
  },
  bottomPrice: { fontSize: 20, fontWeight: '900' },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 15,
    gap: 9,
  },
  addText: { color: '#FFF', fontSize: 13, fontWeight: '900' },

  videoWrap: {
    marginTop: 8,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#000',
  },

  lightboxOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
  },
  lightboxClose: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});