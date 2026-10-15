// Utilidades del probador: tipo de prenda, tallas y conversión de imagen a base64.
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';

export const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'];
// Factor de holgura por talla (M = 1). Una talla mayor a la tuya se ve más suelta; una menor, más ajustada.
export const SIZE_FACTOR = { XS: 0.9, S: 0.95, M: 1, L: 1.06, XL: 1.12, XXL: 1.18, '3XL': 1.24 };

export function garmentKind(product) {
  const txt = `${product?.category || ''} ${product?.name || ''}`.toLowerCase();
  const has = (...w) => w.some(x => txt.includes(x));
  if (has('gorra', 'cap', 'sombrero', 'hat')) return 'head';
  if (has('lente', 'gafa', 'glasses', 'sunglass')) return 'glasses';
  if (has('audifono', 'audífono', 'headphone', 'auricular')) return 'headphones';
  if (has('reloj', 'watch')) return 'wrist';
  if (has('mochila', 'backpack', 'bolso', 'bag')) return 'back';
  if (has('tenis', 'zapato', 'calzado', 'sneaker', 'shoe', 'calceta', 'sock')) return 'feet';
  if (has('jean', 'pantal', 'pants', 'short', 'falda', 'skirt')) return has('short') ? 'shorts' : 'bottom';
  return has('sudadera', 'hoodie', 'chamarra', 'jacket', 'abrigo', 'coat') ? 'top-wide' : 'top';
}

// Talla de camisa: la guardada en la web; si no hay, por pecho (misma tabla que el backend) o por complexión.
export function estimateSize(c) {
  if (!c) return null;
  if (c.size && SIZES.includes(c.size)) return c.size;
  if (c.chest) {
    const t = [[86, 'XS'], [91, 'S'], [97, 'M'], [102, 'L'], [107, 'XL'], [112, 'XXL'], [120, '3XL']];
    return (t.find(([cm]) => c.chest <= cm) || [0, '3XL'])[1];
  }
  return ({ delgada: 'S', media: 'M', robusta: 'L', extra: 'XL' })[c.build] || null;
}

// Convierte la imagen del producto (asset local o URL) a data URI para poder procesarla en el WebView.
export async function imageToDataUri(source) {
  if (typeof source === 'string' && source.startsWith('data:')) return source;
  let uri;
  if (typeof source === 'string') uri = source;
  else if (source?.uri) uri = source.uri;
  else {
    const asset = Asset.fromModule(source);
    await asset.downloadAsync();
    uri = asset.localUri || asset.uri;
  }
  if (!uri) throw new Error('Imagen no disponible');
  let local = uri;
  if (/^https?:/i.test(uri)) {
    const dest = `${FileSystem.cacheDirectory}garment-${Date.now()}.img`;
    const res = await FileSystem.downloadAsync(uri, dest);
    local = res.uri;
  }
  const b64 = await FileSystem.readAsStringAsync(local, { encoding: FileSystem.EncodingType.Base64 });
  const isJpg = /\.jpe?g/i.test(uri) || /\.jpe?g/i.test(local);
  return `data:image/${isJpg ? 'jpeg' : 'png'};base64,${b64}`;
}
export const resolveSource = src => (typeof src === 'string' ? { uri: src } : src);
