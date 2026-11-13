// src/screens/FavoritesScreen.js
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '../i18n/ui';
import { useFocusEffect } from '@react-navigation/native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { usePreferences } from '../context/PreferencesContext';

// ⭐ Importamos de forma segura: si algo no existe, no rompe el bundle
import * as API from '../services/api';

const fetchFavoritos =
  API.fetchFavoritos || (async () => []);

const quitarFavorito =
  API.quitarFavorito || (async () => ({ ok: true }));

// ⭐ Fallback interno por si resolveProductPhoto no existe
const resolveProductPhoto =
  API.resolveProductPhoto ||
  ((raw) => {
    if (!raw) return null;
    if (typeof raw !== 'string') return null;
    const s = raw.trim();
    if (!s) return null;
    if (/^(https?:|data:|file:)/i.test(s)) return s;
    return s;
  });

// ================================================================
// i18n
// ================================================================
const T = {
  es: {
    title: 'Mis favoritos',
    subtitleOne: 'producto',
    subtitleMany: 'productos',
    loading: 'Cargando favoritos...',
    removeTitle: 'Quitar de favoritos',
    removeSub: '¿Quieres quitar este producto de tus favoritos?',
    removeCancel: 'Cancelar',
    removeConfirm: 'Quitar',
    removeError: 'No se pudo quitar.',
    noPhoto: 'Sin foto',
    noName: 'Producto sin nombre',
    ver: 'Ver',
    verAccessibility: 'Ver producto',
    removeAccessibility: 'Quitar de favoritos',
    errorTitle: 'No se pudieron cargar tus favoritos.',
    errorSub: 'Verifica tu conexión e intenta de nuevo.',
    emptyTitle: 'Aún no tienes productos favoritos.',
    emptySub: 'Toca el corazón en los productos que te gusten.',
    explorar: 'Explorar productos',
    back: 'Atrás',
    refresh: 'Refrescar',
  },
  en: {
    title: 'My favorites',
    subtitleOne: 'product',
    subtitleMany: 'products',
    loading: 'Loading favorites...',
    removeTitle: 'Remove from favorites',
    removeSub: 'Do you want to remove this product from your favorites?',
    removeCancel: 'Cancel',
    removeConfirm: 'Remove',
    removeError: 'Could not remove.',
    noPhoto: 'No photo',
    noName: 'Unnamed product',
    ver: 'View',
    verAccessibility: 'View product',
    removeAccessibility: 'Remove from favorites',
    errorTitle: 'Could not load your favorites.',
    errorSub: 'Check your connection and try again.',
    emptyTitle: 'You have no favorite products yet.',
    emptySub: 'Tap the heart on the products you like.',
    explorar: 'Browse products',
    back: 'Back',
    refresh: 'Refresh',
  },
};

const getLang = (language) => {
  const l = String(language || 'es').toLowerCase();
  return l.startsWith('en') ? 'en' : 'es';
};

// ================================================================
// Helpers
// ================================================================
const currency = (n, lang = 'es') =>
  `$${Number(n || 0).toLocaleString(lang === 'en' ? 'en-US' : 'es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const primeraFoto = (item) => {
  if (!item) return null;

  const tryValue = (raw) => {
    if (!raw) return null;

    if (typeof raw === 'string') {
      const s = raw.trim();
      if (!s) return null;
      if (/^data:image\//i.test(s)) return s;
      if (/^https?:\/\//i.test(s)) return s;
      // Intentar resolver con fallback
      try {
        const url = resolveProductPhoto(s);
        if (url) return url;
      } catch {}
      return null;
    }

    if (typeof raw === 'object') {
      const u =
        raw.url ||
        raw.src ||
        raw.href ||
        raw.nombre ||
        raw.path ||
        raw.filename ||
        '';
      return tryValue(u);
    }

    return null;
  };

  const directa = tryValue(item.imagen ?? item.imagen_resuelta);
  if (directa) return directa;

  if (Array.isArray(item.fotos)) {
    for (const f of item.fotos) {
      const url = tryValue(f);
      if (url) return url;
    }
  }

  if (Array.isArray(item.imagenes)) {
    for (const f of item.imagenes) {
      const url = tryValue(f);
      if (url) return url;
    }
  }

  return null;
};

// ⭐ Alert universal (web usa window.confirm)
const showConfirm = (title, message, onConfirm, onCancel) => {
  if (Platform.OS === 'web') {
    const ok = window.confirm(`${title}\n\n${message}`);
    if (ok) onConfirm?.();
    else onCancel?.();
    return;
  }
  Alert.alert(
    title,
    message,
    [
      { text: 'Cancelar', style: 'cancel', onPress: onCancel },
      { text: 'Quitar', style: 'destructive', onPress: onConfirm },
    ]
  );
};

// ================================================================
// Componente
// ================================================================
export default function FavoritesScreen({ navigation }) {
  const prefs = usePreferences() || {};
  const p = prefs.palette || {
    background: '#0F172A',
    surface: '#1E293B',
    text: '#FFF',
    primary: '#6366F1',
    subtle: '#94A3B8',
    border: '#334155',
  };
  const lang = getLang(prefs.language);
  const t = T[lang];

  const [favoritos, setFavoritos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [quitando, setQuitando] = useState({});

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(false);
    try {
      const list = await fetchFavoritos();
      if (__DEV__) {
        console.log('[FavoritesScreen] favoritos:', Array.isArray(list) ? list.length : 0);
      }
      setFavoritos(Array.isArray(list) ? list : []);
    } catch (e) {
      console.warn('[FavoritesScreen] load:', e?.message || e);
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

  const total = favoritos.length;

  const quitar = (item) => {
    showConfirm(
      t.removeTitle,
      t.removeSub,
      async () => {
        setQuitando((s) => ({ ...s, [item.id]: true }));
        try {
          await quitarFavorito(item.id);
          setFavoritos((prev) => prev.filter((x) => x.id !== item.id));
        } catch (e) {
          if (Platform.OS === 'web') {
            window.alert(e?.message || t.removeError);
          } else {
            Alert.alert('Error', e?.message || t.removeError);
          }
        } finally {
          setQuitando((s) => {
            const next = { ...s };
            delete next[item.id];
            return next;
          });
        }
      }
    );
  };

  const abrirProducto = (item) => {
    if (!item?.id) return;
    navigation.navigate('ProductDetail', {
      product: {
        id: item.id,
        _id: item._id || item.id,
        nombre: item.nombre,
        name: item.nombre,
        descripcion: item.descripcion,
        description: item.descripcion,
        precio: item.precio,
        price: item.precio,
        categoria_nombre: item.categoria_nombre,
        marca_nombre: item.marca_nombre,
        fotos: item.fotos || (item.imagen ? [item.imagen] : []),
        imagen: item.imagen,
        imagenes: item.imagenes,
        variables: item.variables || item.variantes || [],
        variantes: item.variables || item.variantes || [],
      },
    });
  };

  const renderItem = ({ item }) => {
    const img = primeraFoto(item);
    const ocupado = !!quitando[item.id];

    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: p.surface, borderColor: p.border }]}
        activeOpacity={0.85}
        onPress={() => abrirProducto(item)}
      >
        <View style={[styles.imgWrap, { backgroundColor: p.background }]}>
          {img ? (
            <Image
              source={{ uri: img }}
              style={styles.img}
              contentFit="cover"
              transition={150}
              onError={(e) =>
                console.warn(
                  '[FavoritesScreen] img error:',
                  String(img).slice(0, 80),
                  e?.message
                )
              }
            />
          ) : (
            <View style={styles.imgPlaceholder}>
              <Ionicons name="image-outline" size={32} color={p.subtle} />
              <Text style={{ color: p.subtle, fontSize: 10, marginTop: 4 }}>
                {t.noPhoto}
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.favRemove, { backgroundColor: p.background }]}
            onPress={() => quitar(item)}
            disabled={ocupado}
            accessibilityLabel={t.removeAccessibility}
          >
            {ocupado ? (
              <ActivityIndicator size="small" color="#B91C1C" />
            ) : (
              <Feather name="x" size={16} color="#B91C1C" />
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.body}>
          {!!item.marca_nombre && (
            <Text style={[styles.brand, { color: p.subtle }]}>
              {String(item.marca_nombre).toUpperCase()}
            </Text>
          )}

          <Text style={[styles.name, { color: p.text }]} numberOfLines={2}>
            {item.nombre || t.noName}
          </Text>

          <View style={styles.footerRow}>
            <Text style={[styles.price, { color: p.text }]}>
              {currency(item.precio, lang)}
            </Text>
            <TouchableOpacity
              style={[styles.verBtn, { backgroundColor: p.primary }]}
              onPress={() => abrirProducto(item)}
              activeOpacity={0.85}
              accessibilityLabel={t.verAccessibility}
            >
              <Feather name="eye" size={13} color="#FFF" />
              <Text style={styles.verBtnText}>{t.ver}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => {
    if (loading) return null;
    return (
      <View style={styles.center}>
        <Ionicons
          name={error ? 'alert-circle-outline' : 'heart-outline'}
          size={46}
          color={p.subtle}
        />
        <Text style={[styles.emptyTitle, { color: p.text }]}>
          {error ? t.errorTitle : t.emptyTitle}
        </Text>
        <Text style={[styles.emptySub, { color: p.subtle }]}>
          {error ? t.errorSub : t.emptySub}
        </Text>

        {!error && (
          <TouchableOpacity
            style={[styles.btnPrimary, { backgroundColor: p.primary }]}
            onPress={() => navigation.navigate('Products')}
            activeOpacity={0.85}
          >
            <Feather name="shopping-bag" size={16} color="#FFF" />
            <Text style={styles.btnPrimaryText}>{t.explorar}</Text>
          </TouchableOpacity>
        )}
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
          style={[styles.iconBtn, { backgroundColor: p.surface, borderColor: p.border }]}
          onPress={() => navigation.goBack()}
          accessibilityLabel={t.back}
        >
          <Feather name="arrow-left" size={20} color={p.text} />
        </TouchableOpacity>

        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: p.text }]}>{t.title}</Text>
          <Text style={[styles.subtitle, { color: p.subtle }]}>
            {total} {total === 1 ? t.subtitleOne : t.subtitleMany}
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.iconBtn, { backgroundColor: p.surface, borderColor: p.border }]}
          onPress={onRefresh}
          accessibilityLabel={t.refresh}
        >
          <Ionicons name="refresh" size={20} color={p.primary} />
        </TouchableOpacity>
      </View>

      {loading && !favoritos.length ? (
        <View style={styles.center}>
          <ActivityIndicator color={p.primary} />
          <Text style={{ color: p.subtle, marginTop: 12 }}>{t.loading}</Text>
        </View>
      ) : (
        <FlatList
          data={favoritos}
          keyExtractor={(item, index) => String(item.id ?? item._id ?? `fav-${index}`)}
          renderItem={renderItem}
          numColumns={2}
          columnWrapperStyle={{ gap: 12 }}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 14,
            paddingBottom: 30,
            flexGrow: 1,
            gap: 12,
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
    </SafeAreaView>
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

  card: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 12,
  },
  imgWrap: {
    width: '100%',
    aspectRatio: 1,
    position: 'relative',
  },
  img: { width: '100%', height: '100%' },
  imgPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  favRemove: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },

  body: { padding: 10, gap: 4 },
  brand: { fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },
  name: { fontSize: 13, fontWeight: '800', lineHeight: 17, minHeight: 34 },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  price: { fontSize: 15, fontWeight: '900' },
  verBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  verBtnText: { color: '#FFF', fontSize: 11, fontWeight: '900' },

  center: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    gap: 10,
  },
  emptyTitle: { fontSize: 16, fontWeight: '900', textAlign: 'center' },
  emptySub: { fontSize: 13, textAlign: 'center', lineHeight: 19 },

  btnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 999,
    marginTop: 12,
  },
  btnPrimaryText: { color: '#FFF', fontSize: 14, fontWeight: '900' },
});