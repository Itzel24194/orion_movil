// screens/HomeScreen.js
import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Modal,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, TextInput } from '../i18n/ui';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { ProductContext } from '../context/ProductContext';
import { usePreferences } from '../context/PreferencesContext';
import {
  fetchProductos,
  fetchTemporadas,
  fetchCategorias,
  resolveProductPhoto,
  resolveUrl,
} from '../services/api';

// ================================================================
// SMART ICON
// ================================================================
const FEATHER_ICONS = new Set([
  'grid','user','users','smile','smartphone','home','activity','star','gift',
  'shopping-bag','book','truck','box','music','coffee','tag','heart','image',
  'search','close','plus','chevron-down','chevron-right','chevron-up',
  'arrow-right','arrow-left','check','calendar','clock','package','layers',
  'zap','sun','moon','award','briefcase','camera','cloud','download','eye',
  'film','filter','flag','globe','headphones','shield','shopping-cart',
  'speaker','thumbs-up','umbrella','watch','wind','wifi','scissors','anchor',
  'send','github','alert-circle','droplet','edit-2','sliders','menu','x',
]);

const IONICONS_ICONS = new Set([
  'woman','man','happy','sparkles','car','basketball','game-controller',
  'phone-portrait','shirt','footsteps','flower','leaf','pizza','ice-cream',
  'wine','beer','cafe','restaurant','fitness','bicycle','airplane','boat',
  'train','subway','walk','body','accessibility','color-palette','brush',
  'pencil','cut','school','library','paw','fish','bug','rose','diamond',
  'ribbon','medal','trophy',
]);

const FEATHER_ALIASES = {
  woman: 'user', man: 'user', happy: 'smile', sparkles: 'star', car: 'truck',
  basketball: 'activity', 'game-controller': 'box', 'phone-portrait': 'smartphone',
  shirt: 'shopping-bag', footsteps: 'activity', flower: 'heart', leaf: 'heart',
  pizza: 'coffee', 'ice-cream': 'coffee', wine: 'coffee', beer: 'coffee',
  cafe: 'coffee', restaurant: 'coffee', fitness: 'activity', bicycle: 'activity',
  airplane: 'send', boat: 'send', train: 'truck', subway: 'truck',
  walk: 'activity', body: 'user', accessibility: 'user',
  'color-palette': 'droplet', brush: 'edit-2', pencil: 'edit-2', cut: 'scissors',
  school: 'book', library: 'book', paw: 'github', fish: 'anchor',
  bug: 'alert-circle', rose: 'heart', diamond: 'star', ribbon: 'award',
  medal: 'award', trophy: 'award',
};

function SmartIcon({ name, size = 16, color = '#FFF' }) {
  const n = String(name || '').trim().toLowerCase();
  if (!n) return <Feather name="grid" size={size} color={color} />;
  if (FEATHER_ICONS.has(n)) return <Feather name={n} size={size} color={color} />;
  if (IONICONS_ICONS.has(n)) return <Ionicons name={n} size={size} color={color} />;
  if (FEATHER_ALIASES[n]) return <Feather name={FEATHER_ALIASES[n]} size={size} color={color} />;
  return <Feather name="grid" size={size} color={color} />;
}

// ================================================================
// HELPERS
// ================================================================
const currency = (v) =>
  `$${Number(v || 0).toLocaleString('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const pad = (n) => String(n).padStart(2, '0');
const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

const formatFechaCorta = (iso) => {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return `${pad(d.getDate())} ${MESES[d.getMonth()]}`;
  } catch { return '—'; }
};

const diasRestantes = (temp) => {
  if (!temp?.fecha_fin) return null;
  return Math.ceil((new Date(temp.fecha_fin).getTime() - Date.now()) / 86400000);
};

const estadoTemporada = (temp) => {
  if (!temp || temp.activa === false) return 'inactiva';
  const hoy = new Date();
  const fi = temp.fecha_inicio ? new Date(temp.fecha_inicio) : null;
  const ff = temp.fecha_fin ? new Date(temp.fecha_fin) : null;
  if (fi && hoy < fi) return 'proxima';
  if (ff && hoy > ff) return 'finalizada';
  return 'en_curso';
};

const getFotoUrl = (p) => {
  const fotos = Array.isArray(p?.fotos) ? p.fotos : [];
  const primera = fotos.find(Boolean);
  return primera ? resolveProductPhoto(primera) : null;
};

const getPrecio = (p) => {
  const vars = Array.isArray(p?.variables) ? p.variables : [];
  if (vars.length === 0) return 0;
  return Number(vars[0].precio) || 0;
};

const getStock = (p) => {
  const vars = Array.isArray(p?.variables) ? p.variables : [];
  return vars.reduce((s, v) => s + (Number(v.stock) || 0), 0);
};

// ================================================================
// COMPONENTE
// ================================================================
export default function HomeScreen({ navigation }) {
  const { cart = [] } = useContext(ProductContext) || {};
  const { palette: p, t, isDark } = usePreferences();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [productos, setProductos] = useState([]);
  const [temporadas, setTemporadas] = useState([]);
  const [categorias, setCategorias] = useState([]);

  const [search, setSearch] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [categoriaId, setCategoriaId] = useState(null);
  const [temporadaFiltro, setTemporadaFiltro] = useState(null);

  // Selector TryOn
  const [tryOnPickerVisible, setTryOnPickerVisible] = useState(false);

  // ---------- CARGA ----------
  const cargar = useCallback(async ({ isRefresh = false } = {}) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const [prods, temps, cats] = await Promise.all([
        fetchProductos().catch(() => []),
        fetchTemporadas({ incluir_inactivas: false }).catch(() => []),
        fetchCategorias().catch(() => []),
      ]);
      setProductos(Array.isArray(prods) ? prods : []);
      setTemporadas(Array.isArray(temps) ? temps : []);
      setCategorias(Array.isArray(cats) ? cats : []);
    } catch (e) {
      console.log('❌ Home load error:', e?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  // ---------- ÁRBOL DE CATEGORÍAS ----------
  const categoriasPorId = useMemo(() => {
    const m = {};
    (categorias || []).forEach((c) => { m[String(c.id)] = c; });
    return m;
  }, [categorias]);

  const hijosPorPadre = useMemo(() => {
    const m = {};
    (categorias || []).forEach((c) => {
      const pid = c.padre_id ? String(c.padre_id) : '__root__';
      if (!m[pid]) m[pid] = [];
      m[pid].push(c);
    });
    Object.keys(m).forEach((k) => {
      m[k].sort((a, b) => (a.orden || 0) - (b.orden || 0));
    });
    return m;
  }, [categorias]);

  const categoriasRaiz = useMemo(
    () => hijosPorPadre['__root__'] || [],
    [hijosPorPadre]
  );

  const getDescendientes = useCallback(
    (catId) => {
      const result = new Set();
      const stack = [String(catId)];
      while (stack.length) {
        const cur = stack.pop();
        if (result.has(cur)) continue;
        result.add(cur);
        const hijos = hijosPorPadre[cur] || [];
        hijos.forEach((h) => stack.push(String(h.id)));
      }
      return result;
    },
    [hijosPorPadre]
  );

  const categoriasVisibles = useMemo(
    () => categoriasRaiz.filter((c) => c.activo !== false),
    [categoriasRaiz]
  );

  // ---------- TEMPORADAS ----------
  const temporadasVisibles = useMemo(() => {
    return (temporadas || [])
      .filter((temp) => ['en_curso', 'proxima'].includes(estadoTemporada(temp)))
      .sort((a, b) => {
        const ea = estadoTemporada(a) === 'en_curso' ? 0 : 1;
        const eb = estadoTemporada(b) === 'en_curso' ? 0 : 1;
        return ea - eb;
      })
      .slice(0, 8);
  }, [temporadas]);

  const temporadaHero = temporadasVisibles[0] || null;

  // ---------- BÚSQUEDA LIVE ----------
  const sugerencias = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return (productos || [])
      .filter((prod) => {
        const nombre = (prod.nombre || '').toLowerCase();
        const catNombre = (prod.categoria_nombre || '').toLowerCase();
        const marcaNombre = (prod.marca_nombre || '').toLowerCase();
        return (
          nombre.includes(q) ||
          catNombre.includes(q) ||
          marcaNombre.includes(q)
        );
      })
      .slice(0, 8);
  }, [search, productos]);

  // ---------- FILTRADO ----------
  const productosFiltrados = useMemo(() => {
    const q = search.trim().toLowerCase();
    const idsCategoria = categoriaId ? getDescendientes(categoriaId) : null;

    return (productos || []).filter((prod) => {
      const nombre = (prod.nombre || '').toLowerCase();
      const catNombre = (prod.categoria_nombre || '').toLowerCase();
      const marcaNombre = (prod.marca_nombre || '').toLowerCase();

      const matchSearch =
        !q || nombre.includes(q) || catNombre.includes(q) || marcaNombre.includes(q);
      const matchCat = !idsCategoria || idsCategoria.has(String(prod.categoria_id));
      const matchTemp =
        !temporadaFiltro || String(prod.temporada_id) === String(temporadaFiltro);

      return matchSearch && matchCat && matchTemp;
    });
  }, [productos, search, categoriaId, temporadaFiltro, getDescendientes]);

  const productosEnTemporada = useMemo(() => {
    const s = new Set();
    temporadasVisibles.forEach((temp) => {
      (productos || []).forEach((prod) => {
        if (String(prod.temporada_id) === String(temp.id)) s.add(String(prod.id));
      });
    });
    return s;
  }, [temporadasVisibles, productos]);

  // ---------- HANDLERS ----------
  const visitProduct = (prod) => {
    Haptics.selectionAsync().catch(() => {});
    Keyboard.dismiss();
    setSearchFocused(false);
    navigation.navigate('ProductDetail', { product: prod });
  };

  const visitTemporada = (temp) => {
    Haptics.selectionAsync().catch(() => {});
    const activa = String(temporadaFiltro) === String(temp.id);
    setTemporadaFiltro(activa ? null : temp.id);
    setCategoriaId(null);
    setSearch('');
  };

  const visitCategoria = (cat) => {
    Haptics.selectionAsync().catch(() => {});
    const activa = String(categoriaId) === String(cat.id);
    setCategoriaId(activa ? null : cat.id);
    setTemporadaFiltro(null);
  };

  const limpiarFiltros = () => {
    setSearch('');
    setCategoriaId(null);
    setTemporadaFiltro(null);
    setSearchFocused(false);
    Keyboard.dismiss();
  };

  const elegirProductoParaTryOn = (prod) => {
    setTryOnPickerVisible(false);
    setTimeout(() => {
      navigation.navigate('TryOn', { product: prod });
    }, 200);
  };

  const abrirTryOn = () => {
    Haptics.selectionAsync().catch(() => {});
    if (productos.length === 0) {
      // No hay productos: avisa
      setTryOnPickerVisible(true);
      return;
    }
    if (productos.length === 1) {
      navigation.navigate('TryOn', { product: productos[0] });
      return;
    }
    // Más de uno: muestra selector
    setTryOnPickerVisible(true);
  };

  const filtrosActivos = !!search.trim() || !!categoriaId || !!temporadaFiltro;

  // ================================================================
  // RENDER — HERO
  // ================================================================
  const renderHero = () => {
    if (temporadaHero) {
      const imagen = temporadaHero.imagen ? resolveUrl(temporadaHero.imagen) : null;
      const color = temporadaHero.color || '#7C3AED';
      const dias = diasRestantes(temporadaHero);
      const esEnCurso = estadoTemporada(temporadaHero) === 'en_curso';
      const activo = String(temporadaFiltro) === String(temporadaHero.id);

      return (
        <TouchableOpacity
          activeOpacity={0.92}
          onPress={() => visitTemporada(temporadaHero)}
          style={styles.heroWrap}
        >
          {imagen ? (
            <Image source={{ uri: imagen }} style={styles.heroImg} contentFit="cover" />
          ) : (
            <LinearGradient
              colors={[color, '#1e1b4b', '#0f172a']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroImg}
            />
          )}
          <LinearGradient
            colors={['rgba(0,0,0,0.05)', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.9)']}
            locations={[0, 0.5, 1]}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={styles.heroContent}>
            <View style={styles.heroTopRow}>
              <View
                style={[
                  styles.heroPill,
                  { backgroundColor: esEnCurso ? '#10b981' : '#3b82f6' },
                ]}
              >
                <Ionicons name="flash" size={10} color="#FFF" />
                <Text style={styles.heroPillText}>
                  {esEnCurso ? 'EN CURSO' : 'PRÓXIMA'}
                </Text>
              </View>
              {dias !== null && (
                <View style={styles.heroDias}>
                  <Ionicons name="time-outline" size={11} color="#FFF" />
                  <Text style={styles.heroDiasText}>
                    {dias >= 0 ? `${dias} días` : 'Final'}
                  </Text>
                </View>
              )}
            </View>
            <View style={{ flex: 1, justifyContent: 'flex-end' }}>
              <Text style={styles.heroKicker}>
                {temporadaHero.destacada ? '★ DESTACADA' : 'TEMPORADA'}
              </Text>
              <Text style={styles.heroTitle} numberOfLines={2}>
                {temporadaHero.nombre}
              </Text>
              {!!temporadaHero.descripcion && (
                <Text style={styles.heroSub} numberOfLines={2}>
                  {temporadaHero.descripcion}
                </Text>
              )}
              <View style={styles.heroBtnRow}>
                <View style={styles.heroBtn}>
                  <Text style={styles.heroBtnText}>
                    {activo ? 'Quitar filtro' : 'Ver colección'}
                  </Text>
                  <Ionicons
                    name={activo ? 'close' : 'arrow-forward'}
                    size={12}
                    color="#0f172a"
                  />
                </View>
                <Text style={styles.heroCount}>
                  {temporadaHero.productosCount || 0} productos
                </Text>
              </View>
            </View>
          </View>
        </TouchableOpacity>
      );
    }

    // Hero TryOn con gradiente morado
    return (
      <TouchableOpacity
        activeOpacity={0.92}
        onPress={abrirTryOn}
        style={styles.heroWrap}
      >
        <LinearGradient
          colors={['#6d28d9', '#7c3aed', '#a855f7', '#ec4899']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroImg}
        />
        {/* Burbujas decorativas */}
        <View style={[styles.bubble, { top: 20, right: 30, width: 90, height: 90 }]} />
        <View style={[styles.bubble, { top: 70, right: 100, width: 50, height: 50 }]} />
        <View style={[styles.bubble, { bottom: 30, right: 20, width: 120, height: 120 }]} />

        <View style={styles.heroContent}>
          <View style={styles.heroTopRow}>
            <View style={[styles.heroPill, { backgroundColor: 'rgba(255,255,255,0.22)' }]}>
              <Ionicons name="sparkles" size={10} color="#FFF" />
              <Text style={styles.heroPillText}>ORION STUDIO</Text>
            </View>
          </View>
          <View style={{ flex: 1, justifyContent: 'flex-end' }}>
            <Text style={styles.heroKicker}>ESPEJO VIRTUAL</Text>
            <Text style={styles.heroTitle}>Tu estilo en tiempo real.</Text>
            <Text style={styles.heroSub}>
              Prueba prendas con realidad aumentada y ajusta tu look al instante.
            </Text>
            <View style={styles.heroBtnRow}>
              <View style={styles.heroBtn}>
                <Text style={styles.heroBtnText}>
                  {t('tryNow') || 'Probar ahora'}
                </Text>
                <Ionicons name="arrow-forward" size={12} color="#6d28d9" />
              </View>
              {productos.length > 0 && (
                <Text style={styles.heroCount}>
                  {productos.length} disponibles
                </Text>
              )}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // ================================================================
  // RENDER — TEMPORADA CARD
  // ================================================================
  const renderTemporadaCard = (temp) => {
    const estado = estadoTemporada(temp);
    const color = temp.color || '#7C3AED';
    const imagen = temp.imagen ? resolveUrl(temp.imagen) : null;
    const dias = diasRestantes(temp);
    const esEnCurso = estado === 'en_curso';
    const activa = String(temporadaFiltro) === String(temp.id);

    return (
      <TouchableOpacity
        key={temp.id}
        activeOpacity={0.9}
        onPress={() => visitTemporada(temp)}
        style={[
          styles.tempCard,
          {
            borderColor: activa ? color : 'transparent',
            borderWidth: activa ? 2.5 : 0,
          },
        ]}
      >
        {imagen ? (
          <Image source={{ uri: imagen }} style={styles.tempImage} contentFit="cover" />
        ) : (
          <LinearGradient colors={[color, '#0f172a']} style={styles.tempImage}>
            <Feather name="calendar" size={28} color="#FFF" />
          </LinearGradient>
        )}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.85)']}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={styles.tempBadgeRow}>
          <View
            style={[
              styles.tempBadge,
              { backgroundColor: esEnCurso ? '#10b981' : '#3b82f6' },
            ]}
          >
            <Text style={styles.tempBadgeText}>
              {esEnCurso ? 'EN CURSO' : 'PRÓXIMA'}
            </Text>
          </View>
          {temp.destacada && (
            <View style={styles.tempStar}>
              <Ionicons name="star" size={10} color="#f59e0b" />
            </View>
          )}
        </View>
        <View style={styles.tempBody}>
          <Text style={styles.tempName} numberOfLines={1}>{temp.nombre}</Text>
          <View style={styles.tempMeta}>
            <Feather name="clock" size={10} color="#FFF" />
            <Text style={styles.tempMetaText}>
              {dias !== null && dias >= 0 ? `${dias}d` : 'Final'}
            </Text>
            <Text style={styles.tempMetaText}>·</Text>
            <Feather name="package" size={10} color="#FFF" />
            <Text style={styles.tempMetaText}>{temp.productosCount || 0}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // ================================================================
  // RENDER — CATEGORÍA CHIP
  // ================================================================
  const renderCategoriaChip = (cat) => {
    const activa = String(categoriaId) === String(cat.id);
    const color = cat.color || '#7C3AED';
    const idsDesc = getDescendientes(cat.id);
    const count = (productos || []).filter((prod) =>
      idsDesc.has(String(prod.categoria_id))
    ).length;

    return (
      <TouchableOpacity
        key={cat.id}
        activeOpacity={0.85}
        onPress={() => visitCategoria(cat)}
        style={[
          styles.catChip,
          {
            backgroundColor: activa ? color : p.surface,
            borderColor: activa ? color : p.border,
          },
        ]}
      >
        <View
          style={[
            styles.catIconWrap,
            { backgroundColor: activa ? 'rgba(255,255,255,0.25)' : `${color}22` },
          ]}
        >
          <SmartIcon name={cat.icono} size={17} color={activa ? '#FFF' : color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text
            style={[styles.catChipText, { color: activa ? '#FFF' : p.text }]}
            numberOfLines={1}
          >
            {cat.nombre}
          </Text>
          <Text
            style={[
              styles.catChipCount,
              { color: activa ? 'rgba(255,255,255,0.8)' : p.subtle },
            ]}
          >
            {count} {count === 1 ? 'producto' : 'productos'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  // ================================================================
  // RENDER — PRODUCTO CARD
  // ================================================================
  const renderProductCard = ({ item }) => {
    const foto = getFotoUrl(item);
    const precio = getPrecio(item);
    const stock = getStock(item);
    const enTemporada = productosEnTemporada.has(String(item.id));
    const agotado = stock === 0;

    return (
      <TouchableOpacity
        activeOpacity={0.9}
        style={[styles.card, { backgroundColor: p.surface, borderColor: p.border }]}
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
            <View style={[styles.cardImg, styles.cardImgEmpty, { backgroundColor: p.soft }]}>
              <Feather name="image" size={26} color={p.subtle} />
            </View>
          )}

          {enTemporada && !agotado && (
            <LinearGradient
              colors={['#f59e0b', '#ec4899']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.badgeNuevo}
            >
              <Ionicons name="sparkles" size={9} color="#FFF" />
              <Text style={styles.badgeNuevoText}>NUEVO</Text>
            </LinearGradient>
          )}

          {agotado && (
            <View style={styles.stockOverlay}>
              <Text style={styles.stockOverlayText}>AGOTADO</Text>
            </View>
          )}

          <View style={styles.priceTag}>
            <Text style={styles.priceTagText}>{currency(precio)}</Text>
          </View>
        </View>

        <View style={styles.cardBody}>
          <Text numberOfLines={2} style={[styles.cardName, { color: p.text }]}>
            {item.nombre}
          </Text>
          {!!item.categoria_nombre && (
            <Text style={[styles.cardCat, { color: p.subtle }]} numberOfLines={1}>
              {item.categoria_nombre}
              {item.marca_nombre ? ` · ${item.marca_nombre}` : ''}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  // ================================================================
  // RENDER — SUGERENCIAS DE BÚSQUEDA (dropdown)
  // ================================================================
  const renderSugerencias = () => {
    if (!searchFocused || !search.trim()) return null;
    if (sugerencias.length === 0) {
      return (
        <View style={[styles.sugerenciasWrap, { backgroundColor: p.surface, borderColor: p.border }]}>
          <View style={styles.sugerenciaEmpty}>
            <Feather name="search" size={16} color={p.subtle} />
            <Text style={[styles.sugerenciaEmptyText, { color: p.subtle }]}>
              Sin resultados para "{search}"
            </Text>
          </View>
        </View>
      );
    }
    return (
      <View style={[styles.sugerenciasWrap, { backgroundColor: p.surface, borderColor: p.border }]}>
        {sugerencias.map((prod, i) => {
          const foto = getFotoUrl(prod);
          return (
            <TouchableOpacity
              key={prod.id}
              activeOpacity={0.7}
              onPress={() => visitProduct(prod)}
              style={[
                styles.sugerenciaRow,
                i !== sugerencias.length - 1 && { borderBottomColor: p.border, borderBottomWidth: 1 },
              ]}
            >
              <View style={styles.sugerenciaImgWrap}>
                {foto ? (
                  <Image source={{ uri: foto }} style={styles.sugerenciaImg} contentFit="cover" />
                ) : (
                  <View style={[styles.sugerenciaImg, { backgroundColor: p.soft, justifyContent: 'center', alignItems: 'center' }]}>
                    <Feather name="image" size={14} color={p.subtle} />
                  </View>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.sugerenciaName, { color: p.text }]} numberOfLines={1}>
                  {prod.nombre}
                </Text>
                <Text style={[styles.sugerenciaSub, { color: p.subtle }]} numberOfLines={1}>
                  {prod.categoria_nombre || 'Sin categoría'}
                  {prod.marca_nombre ? ` · ${prod.marca_nombre}` : ''}
                </Text>
              </View>
              <Text style={[styles.sugerenciaPrecio, { color: p.primary }]}>
                {currency(getPrecio(prod))}
              </Text>
              <Feather name="arrow-up-right" size={14} color={p.subtle} />
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity
          style={[styles.sugerenciaVerTodos, { borderTopColor: p.border }]}
          onPress={() => { setSearchFocused(false); Keyboard.dismiss(); }}
        >
          <Text style={[styles.sugerenciaVerTodosText, { color: p.primary }]}>
            Ver todos los resultados ({productosFiltrados.length})
          </Text>
          <Feather name="chevron-down" size={14} color={p.primary} />
        </TouchableOpacity>
      </View>
    );
  };

  // ================================================================
  // RENDER — EMPTY
  // ================================================================
  const renderEmpty = () => {
    if (loading) return null;
    return (
      <View style={styles.empty}>
        <LinearGradient
          colors={[`${p.primary}40`, `${p.primary}10`]}
          style={styles.emptyIconWrap}
        >
          <Feather name="search" size={34} color={p.primary} />
        </LinearGradient>
        <Text style={[styles.emptyTitle, { color: p.text }]}>
          {filtrosActivos ? 'Sin resultados' : 'Aún no hay productos'}
        </Text>
        <Text style={[styles.emptySub, { color: p.subtle }]}>
          {filtrosActivos
            ? 'Prueba con otra categoría o búsqueda.'
            : 'Vuelve pronto para descubrir novedades.'}
        </Text>
        {filtrosActivos && (
          <TouchableOpacity
            style={[styles.emptyBtn, { backgroundColor: p.primary }]}
            onPress={limpiarFiltros}
          >
            <Feather name="x" size={14} color="#FFF" />
            <Text style={styles.emptyBtnText}>Limpiar filtros</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // ================================================================
  // RENDER — FILTROS ACTIVOS
  // ================================================================
  const renderFiltrosActivos = () => {
    if (!filtrosActivos) return null;
    const activos = [];
    if (temporadaFiltro) {
      const temp = temporadas.find((x) => String(x.id) === String(temporadaFiltro));
      if (temp) activos.push({
        label: temp.nombre,
        color: temp.color || '#7C3AED',
        onRemove: () => setTemporadaFiltro(null),
      });
    }
    if (categoriaId) {
      const cat = categoriasPorId[String(categoriaId)];
      if (cat) activos.push({
        label: cat.nombre,
        color: cat.color || '#7C3AED',
        onRemove: () => setCategoriaId(null),
      });
    }
    if (activos.length === 0) return null;

    return (
      <View style={styles.filtrosRow}>
        {activos.map((f, i) => (
          <View
            key={i}
            style={[
              styles.filtroChip,
              { backgroundColor: `${f.color}22`, borderColor: f.color },
            ]}
          >
            <Text style={[styles.filtroChipText, { color: f.color }]}>{f.label}</Text>
            <TouchableOpacity onPress={f.onRemove}>
              <Ionicons name="close-circle" size={14} color={f.color} />
            </TouchableOpacity>
          </View>
        ))}
        <TouchableOpacity onPress={limpiarFiltros} style={styles.clearAllBtn}>
          <Text style={[styles.clearAllText, { color: p.subtle }]}>Limpiar todo</Text>
        </TouchableOpacity>
      </View>
    );
  };

  // ================================================================
  // RENDER PRINCIPAL
  // ================================================================
  return (
    <SafeAreaView style={[styles.page, { backgroundColor: p.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={p.background} />

      {/* HEADER */}
      <View style={styles.top}>
        <View>
          <Text style={[styles.brand, { color: p.text }]}>
            ORION<Text style={{ color: p.primary }}>.</Text>
          </Text>
          <Text style={[styles.tagline, { color: p.subtle }]}>
            {t('subtitle') || 'Moda inteligente'}
          </Text>
        </View>
        <View style={styles.navIcons}>
          <TouchableOpacity
            style={[styles.navBtn, { backgroundColor: p.surface }]}
            onPress={() => navigation.navigate('Videos')}
          >
            <Ionicons name="play-circle-outline" color={p.text} size={21} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.navBtn, { backgroundColor: p.surface }]}
            onPress={() => navigation.navigate('Cart')}
          >
            <Ionicons name="bag-outline" color={p.text} size={21} />
            {cart.length > 0 && (
              <View style={styles.dot}>
                <Text style={styles.dotText}>{cart.length > 9 ? '9+' : cart.length}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.navBtn, { backgroundColor: p.surface }]}
            onPress={() => navigation.navigate('Profile')}
          >
            <Ionicons name="person-outline" color={p.text} size={21} />
          </TouchableOpacity>
        </View>
      </View>

      {/* SEARCH */}
      <View style={{ zIndex: 10 }}>
        <View style={[styles.search, { backgroundColor: p.surface, borderColor: searchFocused ? p.primary : p.border }]}>
          <Feather name="search" size={18} color={searchFocused ? p.primary : p.subtle} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
            placeholder={t('search') || 'Buscar productos...'}
            placeholderTextColor={p.subtle}
            style={[styles.input, { color: p.text }]}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color={p.subtle} />
            </TouchableOpacity>
          )}
        </View>

        {/* DROPDOWN SUGERENCIAS */}
        {renderSugerencias()}
      </View>

      {/* CONTENIDO */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={p.primary} />
        </View>
      ) : (
        <TouchableWithoutFeedback onPress={() => { setSearchFocused(false); Keyboard.dismiss(); }}>
          <FlatList
            data={searchFocused && search.trim() ? [] : productosFiltrados}
            keyExtractor={(item) => String(item.id)}
            numColumns={2}
            columnWrapperStyle={styles.column}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            renderItem={renderProductCard}
            ListHeaderComponent={
              <>
                {renderHero()}

                {temporadasVisibles.length > 0 && (
                  <>
                    <View style={styles.sectionRow}>
                      <View style={styles.sectionTitleRow}>
                        <LinearGradient
                          colors={['#7c3aed', '#ec4899']}
                          style={styles.sectionBar}
                        />
                        <Text style={[styles.sectionTitle, { color: p.text }]}>
                          {t('Temporadas') || 'Temporadas'}
                        </Text>
                      </View>
                      <Text style={[styles.sectionCount, { color: p.subtle }]}>
                        {temporadasVisibles.length}{' '}
                        {temporadasVisibles.length === 1 ? 'activa' : 'activas'}
                      </Text>
                    </View>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.tempList}
                    >
                      {temporadasVisibles.map(renderTemporadaCard)}
                    </ScrollView>
                  </>
                )}

                {categoriasVisibles.length > 0 && (
                  <>
                    <View style={styles.sectionRow}>
                      <View style={styles.sectionTitleRow}>
                        <LinearGradient
                          colors={['#7c3aed', '#ec4899']}
                          style={styles.sectionBar}
                        />
                        <Text style={[styles.sectionTitle, { color: p.text }]}>
                          {t('categories') || 'Categorías'}
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => navigation.navigate('Categories')}
                        style={styles.seeAllBtn}
                      >
                        <Text style={{ color: p.primary, fontWeight: '800', fontSize: 12 }}>
                          Ver todas
                        </Text>
                        <Feather name="chevron-right" size={14} color={p.primary} />
                      </TouchableOpacity>
                    </View>

                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.catList}
                    >
                      <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={() => setCategoriaId(null)}
                        style={[
                          styles.catChip,
                          {
                            backgroundColor: !categoriaId ? p.primary : p.surface,
                            borderColor: !categoriaId ? p.primary : p.border,
                          },
                        ]}
                      >
                        <View
                          style={[
                            styles.catIconWrap,
                            { backgroundColor: !categoriaId ? 'rgba(255,255,255,0.25)' : `${p.primary}22` },
                          ]}
                        >
                          <Feather name="grid" size={17} color={!categoriaId ? '#FFF' : p.primary} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text
                            style={[styles.catChipText, { color: !categoriaId ? '#FFF' : p.text }]}
                            numberOfLines={1}
                          >
                            {t('all') || 'Todo'}
                          </Text>
                          <Text
                            style={[
                              styles.catChipCount,
                              { color: !categoriaId ? 'rgba(255,255,255,0.8)' : p.subtle },
                            ]}
                          >
                            {productos.length} productos
                          </Text>
                        </View>
                      </TouchableOpacity>
                      {categoriasVisibles.map(renderCategoriaChip)}
                    </ScrollView>
                  </>
                )}

                {renderFiltrosActivos()}

                <View style={styles.sectionRow}>
                  <View style={styles.sectionTitleRow}>
                    <LinearGradient
                      colors={['#7c3aed', '#ec4899']}
                      style={styles.sectionBar}
                    />
                    <Text style={[styles.sectionTitle, { color: p.text }]}>
                      {t('discoveries') || 'Descubrimientos'}
                    </Text>
                  </View>
                  <Text style={[styles.sectionCount, { color: p.subtle }]}>
                    {productosFiltrados.length}{' '}
                    {productosFiltrados.length === 1 ? 'artículo' : 'artículos'}
                  </Text>
                </View>
              </>
            }
            ListEmptyComponent={renderEmpty}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => cargar({ isRefresh: true })}
                colors={[p.primary]}
                tintColor={p.primary}
                progressBackgroundColor={p.surface}
              />
            }
          />
        </TouchableWithoutFeedback>
      )}

      {/* BOTTOM TABS */}
      <View style={[styles.tabs, { backgroundColor: p.surface, borderTopColor: p.border }]}>
        {[
          ['home', t('home') || 'Inicio', 'Home'],
          ['grid', t('categories') || 'Categorías', 'Categories'],
          ['play-circle', t('multimedia') || 'Videos', 'Videos'],
          ['shopping-bag', t('cart') || 'Carrito', 'Cart'],
        ].map(([icon, label, page]) => {
          const active = page === 'Home';
          return (
            <TouchableOpacity
              key={page}
              style={styles.tab}
              onPress={() => !active && navigation.navigate(page)}
              activeOpacity={0.7}
            >
              {active ? (
                <LinearGradient
                  colors={['#7c3aed', '#ec4899']}
                  style={styles.tabIconActive}
                >
                  <Feather name={icon} size={18} color="#FFF" />
                </LinearGradient>
              ) : (
                <View style={styles.tabIconWrap}>
                  <Feather name={icon} size={20} color={p.subtle} />
                </View>
              )}
              <Text
                style={{
                  color: active ? p.primary : p.subtle,
                  fontSize: 10,
                  fontWeight: '800',
                  marginTop: 2,
                }}
              >
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* MODAL SELECTOR TRYON */}
      <Modal
        visible={tryOnPickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setTryOnPickerVisible(false)}
      >
        <View style={styles.pickerOverlay}>
          <View style={[styles.pickerCard, { backgroundColor: p.surface }]}>
            <LinearGradient
              colors={['#7c3aed', '#ec4899']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.pickerHeader}
            >
              <View style={styles.pickerIconWrap}>
                <Ionicons name="sparkles" size={24} color="#FFF" />
              </View>
              <Text style={styles.pickerTitle}>Elige una prenda</Text>
              <Text style={styles.pickerSub}>
                {productos.length > 0
                  ? 'Selecciona un producto para probarlo en el espejo virtual'
                  : 'Aún no hay productos disponibles'}
              </Text>
            </LinearGradient>

            <View style={styles.pickerCloseRow}>
              <TouchableOpacity
                onPress={() => setTryOnPickerVisible(false)}
                style={styles.pickerClose}
              >
                <Ionicons name="close" size={20} color={p.subtle} />
              </TouchableOpacity>
            </View>

            {productos.length === 0 ? (
              <View style={styles.pickerEmpty}>
                <Feather name="package" size={40} color={p.subtle} />
                <Text style={[styles.pickerEmptyTitle, { color: p.text }]}>
                  Sin productos
                </Text>
                <Text style={[styles.pickerEmptySub, { color: p.subtle }]}>
                  Agrega productos desde el panel de administración.
                </Text>
              </View>
            ) : (
              <FlatList
                data={productos.slice(0, 30)}
                keyExtractor={(it) => String(it.id)}
                numColumns={2}
                columnWrapperStyle={styles.column}
                contentContainerStyle={{ padding: 14 }}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => {
                  const foto = getFotoUrl(item);
                  return (
                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={() => elegirProductoParaTryOn(item)}
                      style={[
                        styles.pickerItem,
                        { backgroundColor: p.background, borderColor: p.border },
                      ]}
                    >
                      {foto ? (
                        <Image
                          source={{ uri: foto }}
                          style={styles.pickerImg}
                          contentFit="cover"
                        />
                      ) : (
                        <View style={[styles.pickerImg, { backgroundColor: p.soft, justifyContent: 'center', alignItems: 'center' }]}>
                          <Feather name="image" size={20} color={p.subtle} />
                        </View>
                      )}
                      <Text
                        style={[styles.pickerItemName, { color: p.text }]}
                        numberOfLines={1}
                      >
                        {item.nombre}
                      </Text>
                    </TouchableOpacity>
                  );
                }}
              />
            )}
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
  page: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  top: {
    paddingTop: 12,
    paddingHorizontal: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brand: { fontWeight: '900', fontSize: 28, letterSpacing: 1.5 },
  tagline: { fontSize: 12, marginTop: 2, letterSpacing: 0.3 },
  navIcons: { flexDirection: 'row', gap: 8 },
  navBtn: { padding: 10, borderRadius: 14 },
  dot: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    backgroundColor: '#ef4444',
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#0f172a',
  },
  dotText: { color: '#FFF', fontSize: 9, fontWeight: '900' },

  search: {
    marginHorizontal: 18,
    marginTop: 16,
    marginBottom: 4,
    borderRadius: 16,
    borderWidth: 1.5,
    flexDirection: 'row',
    paddingHorizontal: 14,
    alignItems: 'center',
    gap: 9,
  },
  input: { flex: 1, height: 46, fontSize: 14 },

  // Sugerencias
  sugerenciasWrap: {
    marginHorizontal: 18,
    marginTop: 6,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    maxHeight: 400,
  },
  sugerenciaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  sugerenciaImgWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    overflow: 'hidden',
  },
  sugerenciaImg: { width: 40, height: 40 },
  sugerenciaName: { fontSize: 13, fontWeight: '700' },
  sugerenciaSub: { fontSize: 11, marginTop: 2 },
  sugerenciaPrecio: { fontSize: 12, fontWeight: '800', marginRight: 6 },
  sugerenciaEmpty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 16,
  },
  sugerenciaEmptyText: { fontSize: 13, fontStyle: 'italic' },
  sugerenciaVerTodos: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 12,
    borderTopWidth: 1,
  },
  sugerenciaVerTodosText: { fontSize: 12, fontWeight: '800' },

  listContent: { paddingHorizontal: 16, paddingBottom: 30 },
  column: { gap: 12 },

  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    marginTop: 22,
  },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionBar: { width: 4, height: 18, borderRadius: 2 },
  sectionTitle: { fontWeight: '900', fontSize: 17, letterSpacing: 0.2 },
  sectionCount: { fontSize: 11, fontWeight: '600' },
  seeAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 8, paddingVertical: 4 },

  // Hero
  heroWrap: {
    height: 230,
    marginTop: 16,
    borderRadius: 26,
    overflow: 'hidden',
    position: 'relative',
  },
  heroImg: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bubble: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  heroContent: { flex: 1, padding: 20, justifyContent: 'space-between' },
  heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  heroPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  heroPillText: { color: '#FFF', fontSize: 10, letterSpacing: 1, fontWeight: '900' },
  heroDias: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  heroDiasText: { color: '#FFF', fontSize: 10, fontWeight: '800' },
  heroKicker: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 10,
    letterSpacing: 2,
    fontWeight: '900',
    marginBottom: 4,
  },
  heroTitle: { color: '#FFF', fontWeight: '900', fontSize: 25, lineHeight: 29, letterSpacing: 0.3 },
  heroSub: { color: 'rgba(255,255,255,0.9)', fontSize: 12, marginTop: 6, lineHeight: 17 },
  heroBtnRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 },
  heroBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFF',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 12,
  },
  heroBtnText: { color: '#0f172a', fontSize: 12, fontWeight: '900' },
  heroCount: { color: '#FFF', fontSize: 11, fontWeight: '700' },

  // Temporadas
  tempList: { gap: 12, paddingRight: 8, paddingBottom: 4 },
  tempCard: {
    width: 210,
    height: 160,
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#0f172a',
  },
  tempImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tempBadgeRow: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  tempBadge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  tempBadgeText: { color: '#FFF', fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  tempStar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tempBody: { position: 'absolute', left: 12, right: 12, bottom: 10 },
  tempName: { color: '#FFF', fontSize: 14, fontWeight: '900' },
  tempMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  tempMetaText: { color: 'rgba(255,255,255,0.85)', fontSize: 10, fontWeight: '700' },

  // Categorías
  catList: { gap: 10, paddingRight: 8, paddingBottom: 4 },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 8,
    paddingRight: 14,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    minWidth: 145,
  },
  catIconWrap: { width: 34, height: 34, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
  catChipText: { fontSize: 12, fontWeight: '800' },
  catChipCount: { fontSize: 10, fontWeight: '600', marginTop: 1 },

  // Filtros activos
  filtrosRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 16 },
  filtroChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
  },
  filtroChipText: { fontSize: 11, fontWeight: '800' },
  clearAllBtn: { paddingHorizontal: 8, paddingVertical: 5 },
  clearAllText: { fontSize: 11, fontWeight: '700', textDecorationLine: 'underline' },

  // Producto
  card: {
    flex: 1,
    minWidth: 0,
    borderWidth: 1,
    borderRadius: 18,
    marginBottom: 12,
    overflow: 'hidden',
  },
  cardImgWrap: { position: 'relative' },
  cardImg: { width: '100%', height: 165, backgroundColor: '#F0F1F6' },
  cardImgEmpty: { justifyContent: 'center', alignItems: 'center' },
  badgeNuevo: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
  },
  badgeNuevoText: { color: '#FFF', fontSize: 9, fontWeight: '900', letterSpacing: 0.3 },
  stockOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stockOverlayText: {
    color: '#FFF',
    fontWeight: '900',
    fontSize: 12,
    letterSpacing: 1.5,
    borderWidth: 1,
    borderColor: '#FFF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  priceTag: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.78)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  priceTagText: { color: '#FFF', fontSize: 12, fontWeight: '900' },

  cardBody: { padding: 10 },
  cardName: { fontWeight: '800', fontSize: 13, minHeight: 34, lineHeight: 17 },
  cardCat: { fontSize: 10, marginTop: 3, fontWeight: '600' },

  // Empty
  empty: { alignItems: 'center', padding: 40, gap: 10 },
  emptyIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  emptyTitle: { fontSize: 16, fontWeight: '900', textAlign: 'center' },
  emptySub: { fontSize: 13, textAlign: 'center', paddingHorizontal: 20 },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 14,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
  },
  emptyBtnText: { color: '#FFF', fontWeight: '800', fontSize: 13 },

  // Tabs
  tabs: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 8,
    borderTopWidth: 1,
  },
  tab: { alignItems: 'center', gap: 2 },
  tabIconWrap: { padding: 6, borderRadius: 12 },
  tabIconActive: {
    width: 38,
    height: 38,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Modal picker TryOn
  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  pickerCard: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    maxHeight: '88%',
    overflow: 'hidden',
  },
  pickerHeader: {
    padding: 24,
    alignItems: 'center',
    paddingBottom: 20,
  },
  pickerIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.22)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  pickerTitle: { color: '#FFF', fontSize: 20, fontWeight: '900' },
  pickerSub: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 6,
    paddingHorizontal: 20,
  },
  pickerCloseRow: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 2,
  },
  pickerClose: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerEmpty: { padding: 40, alignItems: 'center', gap: 8 },
  pickerEmptyTitle: { fontSize: 15, fontWeight: '800', marginTop: 8 },
  pickerEmptySub: { fontSize: 12, textAlign: 'center' },
  pickerItem: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 10,
  },
  pickerImg: { width: '100%', height: 120 },
  pickerItemName: { fontSize: 12, fontWeight: '700', padding: 8 },
});