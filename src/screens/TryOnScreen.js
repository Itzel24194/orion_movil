// screens/TryOnScreen.js
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Image,
  PanResponder,
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Text } from '../i18n/ui';
import { WebView } from 'react-native-webview';
import * as FileSystem from 'expo-file-system/legacy';
import { useCameraPermissions } from 'expo-camera';
import { Ionicons, Feather } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import * as Haptics from 'expo-haptics';
import { storeTryOnImage } from '../services/tryOnHistory';
import { fetchComplexion, resolveProductPhoto } from '../services/api';
import * as ApiModule from '../services/api';
import { SIZES, SIZE_FACTOR, estimateSize, garmentKind } from '../services/garment';
import { TRYON_HTML } from '../services/tryOnHtml';

const resolveCleanPhotoSafe = (foto) => {
  try {
    if (typeof ApiModule.resolveCleanPhoto === 'function') {
      return ApiModule.resolveCleanPhoto(foto);
    }
  } catch {}
  return null;
};

const imageToDataUriSafe = async (source) => {
  const mod = await import('../services/garment');
  if (typeof mod.imageToDataUri === 'function') {
    return mod.imageToDataUri(source);
  }
  throw new Error('imageToDataUri no disponible');
};

function colorToHex(nombre) {
  const n = String(nombre || '').toLowerCase().trim();
  const map = {
    negro: '#181A22', blanco: '#F9FAFB', azul: '#2563EB', 'azul marino': '#1E3A8A',
    rojo: '#DC2626', verde: '#10B981', vino: '#7F1D1D', rosa: '#EC4899',
    morado: '#8B5CF6', violeta: '#7C3AED', amarillo: '#FACC15', naranja: '#F97316',
    café: '#78350F', cafe: '#78350F', marrón: '#78350F', marron: '#78350F',
    gris: '#6B7280', beige: '#E7D3B3', nude: '#E8C6B0', dorado: '#F59E0B',
    plateado: '#C0C0C0', plata: '#C0C0C0', celeste: '#7DD3FC', turquesa: '#14B8A6',
    menta: '#6EE7B7', crema: '#FEF3C7', mostaza: '#CA8A04', coral: '#FB7185',
    salmón: '#FDA4AF', salmon: '#FDA4AF', chocolate: '#5C3A21', camel: '#B08968',
    khaki: '#A3A380', oliva: '#65A30D',
  };
  if (map[n]) return map[n];
  for (const k of Object.keys(map)) if (n.includes(k)) return map[k];
  return '#94A3B8';
}

function normalizeProduct(raw) {
  if (!raw) return null;
  const variables = Array.isArray(raw.variables) ? raw.variables
    : Array.isArray(raw.variantes) ? raw.variantes : [];
  const fotos = Array.isArray(raw.fotos)
    ? raw.fotos.map(f => typeof f === 'string' ? f : f?.url || f?.nombre || '').filter(Boolean)
    : Array.isArray(raw.imagenes) ? raw.imagenes.filter(Boolean) : [];
  return {
    id: String(raw.id || raw._id || ''),
    nombre: raw.nombre || raw.name || 'Producto',
    descripcion: raw.descripcion || raw.description || '',
    categoria_nombre: raw.categoria_nombre || raw.category || '',
    marca_nombre: raw.marca_nombre || raw.brand || '',
    fotos,
    variables: variables.map(v => ({
      sku: v.sku || '',
      color: (v.color || '').trim(),
      tamano: String(v.tamano || v.talla || v.size || '').replace(/\s+/g, ' ').trim(),
      precio: Number(v.precio ?? v.price ?? 0),
      stock: Number(v.stock ?? v.v.cantidad ?? 0),
    })),
    _raw: raw,
  };
}

export default function TryOnScreen({ route, navigation }) {
  const rawProduct = route.params?.product;
  const product = useMemo(() => normalizeProduct(rawProduct), [rawProduct]);
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState('front');
  const [photo, setPhoto] = useState(null);
  const [busy, setBusy] = useState(false);

  // ⭐ Modo por defecto: MANUAL (usa WebView con detector)
  const [mode, setMode] = useState('manual');

  // Estado WebView
  const webRef = useRef(null);
  const inited = useRef(false);
  const [webLoaded, setWebLoaded] = useState(false);
  const [autoReady, setAutoReady] = useState(false);
  const [poseOk, setPoseOk] = useState(false);
  const [autoPhoto, setAutoPhoto] = useState(false);
  const [garmentData, setGarmentData] = useState(null);
  const [webKey, setWebKey] = useState(0);

  // Colores
  const colorOptions = useMemo(() => {
    const base = [{ name: 'Original', tint: null, color: '#D1D5DB' }];
    if (!product) return base;
    const unicos = Array.from(new Set(product.variables.map(v => v.color).filter(Boolean)));
    return [...base, ...unicos.map(nombre => ({
      name: nombre, tint: colorToHex(nombre), color: colorToHex(nombre),
    }))];
  }, [product]);

  const [selectedColor, setSelectedColor] = useState(() => {
    const routeColor = route.params?.selectedColor;
    if (routeColor) {
      const match = colorOptions.find(c => c.name === routeColor);
      if (match) return match;
    }
    return colorOptions[0];
  });

  // Offset (en modo manual) que enviamos al WebView
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [garmentScale, setGarmentScale] = useState(1);
  const offsetRef = useRef({ x: 0, y: 0 });
  const startRef = useRef({ x: 0, y: 0 });

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => {
      startRef.x = offsetRef.x;
      startRef.y = offsetRef.y;
    },
    onPanResponderMove: (_, g) => {
      const nx = startRef.x + g.dx;
      const ny = startRef.y + g.dy;
      offsetRef.x = nx;
      offsetRef.y = ny;
      setOffset({ x: nx, y: ny });
      // Enviar al WebView para que dibuje la prenda desplazada
      try {
        webRef.current?.postMessage(JSON.stringify({
          type: 'offset',
          value: { x: nx, y: ny },
        }));
      } catch {}
    },
  }), []);

  // Complexión / talla
  const [complexion, setComplexion] = useState(null);
  const recommended = estimateSize(complexion);
  const [size, setSize] = useState(
    route.params?.selectedSize && SIZES.includes(route.params.selectedSize)
      ? route.params.selectedSize : null
  );
  const activeSize = size || recommended || 'M';
  const sizeFactor = (SIZE_FACTOR[activeSize] || 1) / (SIZE_FACTOR[recommended || 'M'] || 1);
  const kind = garmentKind(product);

  // URLs
  const urlOriginal = useMemo(() => {
    if (!product || product.fotos.length === 0) return null;
    return resolveProductPhoto(product.fotos[0]);
  }, [product]);

  const urlLimpia = useMemo(() => {
    if (!product || product.fotos.length === 0) return null;
    return resolveCleanPhotoSafe(product.fotos[0]);
  }, [product]);

  // data URI para WebView
  useEffect(() => {
    if (!urlOriginal) return undefined;
    let alive = true;
    imageToDataUriSafe({ uri: urlOriginal })
      .then(d => { if (alive) setGarmentData(d); })
      .catch(() => {});
    return () => { alive = false; };
  }, [urlOriginal]);

  // Complexión
  useEffect(() => {
    let alive = true;
    fetchComplexion().then(c => { if (alive) setComplexion(c); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  // Init WebView
  useEffect(() => {
    if (!webLoaded || !garmentData || !permission?.granted || inited.current) return;
    inited.current = true;
    webRef.current?.postMessage(JSON.stringify({
      type: 'init',
      garment: garmentData,
      kind,
      tint: selectedColor.tint,
      sizeFactor,
      facing: facing === 'front' ? 'user' : 'environment',
      manual: mode === 'manual', // ⭐ el HTML puede usar esto para permitir arrastre interno
    }));
  }, [webLoaded, garmentData, permission?.granted]);

  useEffect(() => {
    if (inited.current) {
      webRef.current?.postMessage(JSON.stringify({
        type: 'config',
        tint: selectedColor.tint || null,
        sizeFactor,
        offset,
      }));
    }
  }, [selectedColor, sizeFactor, offset]);

  useEffect(() => {
    inited.current = false;
    setWebLoaded(false);
    setAutoReady(false);
    setPoseOk(false);
    setWebKey(k => k + 1);
  }, [mode]);

  const onWebMessage = async e => {
    let m; try { m = JSON.parse(e.nativeEvent.data); } catch { return; }
    if (m.type === 'loaded') setWebLoaded(true);
    else if (m.type === 'ready') setAutoReady(true);
    else if (m.type === 'pose') setPoseOk(!!m.data);
    else if (m.type === 'error') {
      if (m.data === 'detector' || m.data === 'camera') {
        Alert.alert(
          'Detector no disponible',
          'El detector corporal no funciona en Expo Go. Necesitas un dev build.'
        );
      }
    } else if (m.type === 'photo') {
      try {
        const path = `${FileSystem.cacheDirectory}orion-look-${Date.now()}.png`;
        await FileSystem.writeAsStringAsync(path, String(m.data).split(',')[1], { encoding: FileSystem.EncodingType.Base64 });
        setAutoPhoto(true); setPhoto(path);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      } catch { Alert.alert('Cámara', 'No fue posible capturar.'); }
      finally { setBusy(false); }
    }
  };

  const takePhoto = async () => {
    if (!autoReady || busy) return;
    setBusy(true);
    webRef.current?.postMessage(JSON.stringify({ type: 'capture' }));
    setTimeout(() => setBusy(false), 6000);
  };

  const makeComposite = async () => {
    if (!photo) throw new Error('Primero captura.');
    return photo;
  };

  const share = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const uri = await makeComposite();
      if (Platform.OS === 'web' || !(await Sharing.isAvailableAsync())) {
        Alert.alert('No disponible', 'Compartir requiere Android o iOS.');
      } else {
        await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Compartir' });
      }
    } catch { Alert.alert('Error', 'No se pudo compartir.'); }
    finally { setBusy(false); }
  };

  const save = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const uri = await makeComposite();
      await storeTryOnImage(uri, product?._raw, selectedColor.name);
      Alert.alert('Guardado', 'Tu look se guardó.');
    } catch { Alert.alert('Error', 'No se pudo guardar.'); }
    finally { setBusy(false); }
  };

  const reset = () => {
    offsetRef.x = 0; offsetRef.y = 0;
    setOffset({ x: 0, y: 0 });
    setGarmentScale(1);
    try {
      webRef.current?.postMessage(JSON.stringify({
        type: 'offset',
        value: { x: 0, y: 0 },
      }));
    } catch {}
  };

  const cambiarEscala = (delta) => {
    setGarmentScale(s => Math.max(0.4, Math.min(3, s + delta)));
    Haptics.selectionAsync().catch(() => {});
  };

  if (!permission) {
    return (
      <View style={styles.center}>
        <Ionicons name="camera-outline" size={54} color="#AEA5FF" />
        <Text style={styles.light}>Solicitando permiso…</Text>
        <TouchableOpacity onPress={requestPermission} style={styles.primary}>
          <Text style={styles.primaryText}>Conceder permiso</Text>
        </TouchableOpacity>
      </View>
    );
  }
  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Ionicons name="camera-off-outline" size={54} color="#EF4444" />
        <Text style={styles.light}>Sin acceso a la cámara</Text>
        <TouchableOpacity onPress={requestPermission} style={styles.primary}>
          <Text style={styles.primaryText}>Permitir cámara</Text>
        </TouchableOpacity>
      </View>
    );
  }
  if (!product) {
    return (
      <View style={styles.center}>
        <Feather name="package" size={54} color="#AEA5FF" />
        <Text style={styles.light}>Producto no disponible.</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.primary}>
          <Text style={styles.primaryText}>Regresar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const statusText = !garmentData ? 'Cargando prenda…'
    : !webLoaded ? 'Cargando motor…'
    : !autoReady ? 'Cargando detector corporal…'
    : poseOk ? 'Detección corporal activa'
    : mode === 'manual'
      ? 'Arrastra la prenda si quieres ajustarla'
      : 'Colócate de frente a la cámara';

  return (
    <View style={styles.page}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.icon}>
          <Ionicons name="arrow-back" size={22} color="white" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Espejo virtual</Text>
          <Text style={styles.headerSub} numberOfLines={1}>{product.nombre}</Text>
        </View>
        <TouchableOpacity onPress={() => navigation.navigate('TryOnHistory')} style={styles.icon}>
          <Ionicons name="time-outline" size={22} color="white" />
        </TouchableOpacity>
      </View>

      <View style={styles.preview}>
        {/* WebView con detector (manual y auto) */}
        <WebView
          key={webKey}
          ref={webRef}
          style={styles.web}
          originWhitelist={['*']}
          source={{ html: TRYON_HTML, baseUrl: 'https://orion-tryon.local/' }}
          javaScriptEnabled
          domStorageEnabled
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          mediaCapturePermissionGrantType="grant"
          onPermissionRequest={(req) => req.grant(req.resources)}
          scrollEnabled={false}
          bounces={false}
          onMessage={onWebMessage}
          androidLayerType="hardware"
        />

        {/* Overlay para arrastrar la prenda (solo modo manual) */}
        {mode === 'manual' && !photo && (
          <View
            {...panResponder.panHandlers}
            style={StyleSheet.absoluteFillObject}
            pointerEvents="box-only"
          />
        )}

        {/* Foto capturada */}
        {photo && (
          <Image source={{ uri: photo }} resizeMode="cover" style={StyleSheet.absoluteFillObject} />
        )}

        {/* Controles flotantes */}
        {!photo && (
          <>
            <TouchableOpacity
              onPress={() => {
                setFacing(f => f === 'front' ? 'back' : 'front');
                if (inited.current) {
                  webRef.current?.postMessage(JSON.stringify({
                    type: 'facing',
                    value: facing === 'front' ? 'environment' : 'user',
                  }));
                }
              }}
              style={styles.turn}
            >
              <Ionicons name="camera-reverse-outline" size={22} color="white" />
            </TouchableOpacity>

            {mode === 'manual' && (
              <TouchableOpacity onPress={reset} style={styles.reset}>
                <Ionicons name="scan-outline" size={16} color="white" />
                <Text style={styles.resetText}>Centrar</Text>
              </TouchableOpacity>
            )}

            {mode === 'manual' && (
              <View style={styles.scaleBar}>
                <TouchableOpacity onPress={() => cambiarEscala(-0.1)} style={styles.scaleBtn}>
                  <Feather name="minus" size={20} color="white" />
                </TouchableOpacity>
                <Text style={styles.scaleText}>{Math.round(garmentScale * 100)}%</Text>
                <TouchableOpacity onPress={() => cambiarEscala(0.1)} style={styles.scaleBtn}>
                  <Feather name="plus" size={20} color="white" />
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.modeSwitch}>
              {[
                { id: 'manual', label: 'Manual' },
                { id: 'auto', label: 'Automático' },
              ].map(m => (
                <TouchableOpacity
                  key={m.id}
                  onPress={() => { setPhoto(null); setAutoPhoto(false); setMode(m.id); }}
                  style={[styles.modeBtn, mode === m.id && styles.modeBtnActive]}
                >
                  <Text style={styles.modeBtnText}>{m.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        <View style={styles.mode}>
          <Text style={styles.modeText}>{statusText}</Text>
        </View>
      </View>

      <View style={styles.controls}>
        <Text style={styles.instructions}>
          {mode === 'manual'
            ? 'Detector corporal · arrastra para ajustar posición'
            : 'Detección corporal automática'}
        </Text>

        {!photo && (
          <View style={styles.sizeBox}>
            <Text style={styles.sizeLabel}>Talla</Text>
            <View style={styles.sizeChipsRow}>
              {SIZES.map(sz => (
                <TouchableOpacity
                  key={sz}
                  onPress={() => setSize(sz)}
                  style={[styles.sizeChip, sz === activeSize && styles.sizeChipActive]}
                >
                  <Text style={[styles.sizeChipText, sz === activeSize && { color: 'white' }]}>{sz}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {colorOptions.length > 1 && (
          <View style={styles.colors}>
            {colorOptions.map(c => (
              <TouchableOpacity
                key={c.name}
                onPress={() => setSelectedColor(c)}
                style={[styles.swatchOuter, c.name === selectedColor.name && styles.swatchActive]}
              >
                <View style={[styles.swatch, { backgroundColor: c.color }]} />
                <Text style={styles.swatchText} numberOfLines={1}>{c.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {!photo ? (
          <TouchableOpacity
            disabled={!autoReady || busy}
            onPress={takePhoto}
            style={[styles.capture, (!autoReady || busy) && { opacity: 0.4 }]}
          >
            <View style={styles.captureInner} />
          </TouchableOpacity>
        ) : (
          <View style={styles.actions}>
            <TouchableOpacity onPress={() => { setPhoto(null); setAutoPhoto(false); }} style={styles.secondary}>
              <Ionicons name="refresh-outline" size={19} color="white" />
              <Text style={styles.actionText}>Repetir</Text>
            </TouchableOpacity>
            <TouchableOpacity disabled={busy} onPress={share} style={styles.secondary}>
              <Ionicons name="share-outline" size={19} color="white" />
              <Text style={styles.actionText}>Compartir</Text>
            </TouchableOpacity>
            <TouchableOpacity disabled={busy} onPress={save} style={styles.primary}>
              <Ionicons name="save-outline" size={19} color="white" />
              <Text style={styles.actionText}>Guardar</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#0B1020' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0B1020', gap: 20, padding: 24 },
  light: { color: 'white', fontSize: 17, textAlign: 'center' },

  header: {
    paddingTop: 46, paddingBottom: 14, paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12,
  },
  headerTitle: { color: 'white', fontSize: 18, fontWeight: '800', textAlign: 'center' },
  headerSub: { color: '#94A3B8', fontSize: 12, textAlign: 'center', maxWidth: 240 },
  icon: { backgroundColor: '#273048', padding: 10, borderRadius: 14 },

  preview: {
    flex: 1, marginHorizontal: 14, backgroundColor: '#283047',
    borderRadius: 22, overflow: 'hidden', position: 'relative',
  },
  web: { ...StyleSheet.absoluteFillObject, backgroundColor: '#0B1020' },

  modeSwitch: {
    position: 'absolute', top: 12, alignSelf: 'center',
    flexDirection: 'row', backgroundColor: '#111827CC',
    borderRadius: 14, padding: 3,
  },
  modeBtn: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 11 },
  modeBtnActive: { backgroundColor: '#635BEB' },
  modeBtnText: { color: 'white', fontSize: 12, fontWeight: '700' },

  turn: { position: 'absolute', top: 12, left: 12, borderRadius: 12, padding: 9, backgroundColor: '#111827CC' },
  reset: {
    position: 'absolute', top: 12, right: 12,
    flexDirection: 'row', gap: 6, borderRadius: 12, padding: 9,
    backgroundColor: '#111827CC', alignItems: 'center',
  },
  resetText: { color: 'white', fontSize: 12, fontWeight: '700' },

  scaleBar: {
    position: 'absolute', bottom: 50, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#111827CC', borderRadius: 22,
    paddingHorizontal: 14, paddingVertical: 6,
  },
  scaleBtn: { padding: 8 },
  scaleText: { color: '#FFF', fontSize: 13, fontWeight: '700', minWidth: 50, textAlign: 'center' },

  mode: {
    position: 'absolute', bottom: 10, alignSelf: 'center',
    paddingVertical: 6, paddingHorizontal: 12,
    backgroundColor: '#111827CC', borderRadius: 20, maxWidth: '90%',
  },
  modeText: { color: '#EEE', fontSize: 11, textAlign: 'center' },

  controls: { paddingTop: 12, paddingBottom: 26, paddingHorizontal: 16, gap: 9 },
  instructions: { color: '#E2E8F0', fontSize: 13, textAlign: 'center' },

  sizeBox: { gap: 6, alignItems: 'center' },
  sizeLabel: { color: '#D1D5DB', fontSize: 12, fontWeight: '700' },
  sizeChipsRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6, marginTop: 4 },
  sizeChip: { paddingVertical: 5, paddingHorizontal: 10, borderRadius: 10, backgroundColor: '#273048' },
  sizeChipActive: { backgroundColor: '#635BEB' },
  sizeChipText: { color: '#E2E8F0', fontSize: 12, fontWeight: '700' },

  colors: { flexDirection: 'row', justifyContent: 'space-around', flexWrap: 'wrap', gap: 8 },
  swatchOuter: { alignItems: 'center', padding: 3, borderRadius: 12, borderWidth: 1, borderColor: 'transparent', minWidth: 48 },
  swatchActive: { borderColor: '#AAA3FF' },
  swatch: { width: 26, height: 26, borderWidth: 1, borderColor: '#64748B', borderRadius: 13 },
  swatchText: { color: '#D1D5DB', fontSize: 10, marginTop: 2 },

  capture: { alignSelf: 'center', width: 66, height: 66, borderRadius: 33, borderWidth: 3, borderColor: 'white', justifyContent: 'center', alignItems: 'center', marginTop: 4 },
  captureInner: { width: 52, height: 52, borderRadius: 26, backgroundColor: 'white' },

  actions: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginTop: 6 },
  secondary: { flex: 1, flexDirection: 'row', backgroundColor: '#273048', borderRadius: 14, justifyContent: 'center', paddingVertical: 14, gap: 6, alignItems: 'center' },
  primary: { flex: 1, flexDirection: 'row', backgroundColor: '#635BEB', borderRadius: 14, justifyContent: 'center', paddingVertical: 14, paddingHorizontal: 12, gap: 6, alignItems: 'center' },
  primaryText: { color: 'white', fontWeight: '800' },
  actionText: { color: 'white', fontWeight: '700', fontSize: 12 },
});