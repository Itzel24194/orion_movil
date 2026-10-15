// screens/CartScreen.js
import React, { useContext, useMemo, useCallback } from "react";
import { View, FlatList, StyleSheet, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text, Alert } from "../i18n/ui";
import { Ionicons, Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { ProductContext } from "../context/ProductContext";
import {
  resolveProductPhoto,
  resolveCleanPhoto,
} from "../services/api";

// ================================================================
// SEGURIDAD — Límites duros
// ================================================================
const MAX_QUANTITY_PER_ITEM = 99;
const MAX_TOTAL_ITEMS = 200;

// ================================================================
// HELPERS
// ================================================================
const getNombre = (item) => item.nombre || item.name || "Producto";

const getPrecio = (item) => {
  if (item.unitPrice != null) return Number(item.unitPrice);
  if (item.precio != null) return Number(item.precio);
  if (item.price != null) return Number(item.price);
  const vars = Array.isArray(item.variables) ? item.variables : [];
  if (vars.length > 0) return Number(vars[0].precio) || 0;
  return 0;
};

const getFoto = (item) => {
  const cleanArr = Array.isArray(item.fotos_clean) ? item.fotos_clean : [];
  if (cleanArr.length > 0) {
    const url = resolveCleanPhoto(cleanArr[0]);
    if (url) return url;
  }
  const fotos = Array.isArray(item.fotos) ? item.fotos.filter(Boolean) : [];
  if (fotos.length > 0) {
    const url = resolveProductPhoto(fotos[0]);
    if (url) return url;
  }
  if (item.imagen) return resolveProductPhoto(item.imagen);
  if (item.image) return item.image;
  return null;
};

const fmtPrecio = (n) =>
  `$${Number(n || 0).toLocaleString("es-MX", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const getVarianteLabel = (item) => {
  const partes = [];
  if (item.selectedSize) partes.push(item.selectedSize);
  if (item.selectedColor) partes.push(item.selectedColor);
  if (item.variantSku && !item.selectedColor) partes.push(item.variantSku);
  return partes.join(" · ");
};

// ================================================================
// SEGURIDAD — Stock disponible
// Devuelve null si no hay información (NO tratarlo como agotado)
// ================================================================
const getStockDisponible = (item) => {
  // 1) Si el item trae el stock de la variante específica (nuevo formato)
  if (item.selectedStock != null) return Number(item.selectedStock);
  if (item.variantStock != null) return Number(item.variantStock);

  // 2) Buscar en variables (items viejos con ese campo)
  const vars = Array.isArray(item.variables) ? item.variables : [];
  if (vars.length > 0) {
    const match = vars.find((v) => {
      const okSku = !item.variantSku || v.sku === item.variantSku;
      const okColor = !item.selectedColor || v.color === item.selectedColor;
      const okSize = !item.selectedSize || v.tamano === item.selectedSize;
      return okSku && okColor && okSize;
    });
    if (match) return Number(match.stock) || 0;
    return vars.reduce((s, v) => s + (Number(v.stock) || 0), 0);
  }

  // 3) Stock plano si existe
  if (item.stock != null) return Number(item.stock);

  // 4) Sin información → null
  return null;
};

//  SEGURIDAD — Una sola fuente de verdad para "puede incrementar"
const puedeIncrementar = (item, cart) => {
  const cantidad = item.quantity || 1;
  const stock = getStockDisponible(item);

  // Si hay info de stock, validar
  if (stock !== null) {
    if (stock === 0) return { ok: false, motivo: "agotado" };
    if (cantidad >= stock) return { ok: false, motivo: "sin-stock" };
  }

  // Límite por artículo
  if (cantidad >= MAX_QUANTITY_PER_ITEM) {
    return { ok: false, motivo: "limite-articulo" };
  }

  // Límite total del carrito
  const totalActual = cart.reduce((s, it) => s + (it.quantity || 1), 0);
  if (totalActual >= MAX_TOTAL_ITEMS) {
    return { ok: false, motivo: "carrito-lleno" };
  }

  return { ok: true };
};

// ================================================================
// COMPONENTE
// ================================================================
export default function CartScreen({ navigation }) {
  const { cart, increaseQuantity, decreaseQuantity, removeItem } =
    useContext(ProductContext);

  const totalItems = useMemo(
    () => cart.reduce((s, it) => s + (it.quantity || 1), 0),
    [cart]
  );

  const total = useMemo(
    () =>
      cart.reduce(
        (sum, item) => sum + getPrecio(item) * (item.quantity || 1),
        0
      ),
    [cart]
  );

  const sortedCart = useMemo(
    () =>
      [...cart].sort((a, b) =>
        getNombre(a).localeCompare(getNombre(b), "es", { sensitivity: "base" })
      ),
    [cart]
  );

  const confirmRemoveItem = useCallback(
    (id) => {
      Alert.alert(
        "Eliminar producto",
        "¿Deseas quitar este producto del carrito?",
        [
          { text: "Cancelar", style: "cancel" },
          {
            text: "Eliminar",
            style: "destructive",
            onPress: () => removeItem(id),
          },
        ]
      );
    },
    [removeItem]
  );

  const safeIncrease = useCallback(
    (item) => {
      const key = item.cartKey || item.id;
      const check = puedeIncrementar(item, cart);

      if (!check.ok) {
        const stock = getStockDisponible(item);
        const mensajes = {
          agotado: "Este producto está agotado.",
          "sin-stock": `Solo hay ${stock} unidad${
            stock === 1 ? "" : "es"
          } disponible${stock === 1 ? "" : "s"} de este producto.`,
          "limite-articulo": `No puedes agregar más de ${MAX_QUANTITY_PER_ITEM} unidades del mismo producto.`,
          "carrito-lleno": `Tu carrito ya tiene ${MAX_TOTAL_ITEMS} artículos. Finaliza esta compra antes de agregar más.`,
        };
        Alert.alert(
          "No se puede agregar",
          mensajes[check.motivo] || "Acción no permitida."
        );
        return;
      }

      increaseQuantity(key);
    },
    [cart, increaseQuantity]
  );

  const handleCheckout = useCallback(() => {
    const problemas = cart.filter((item) => {
      const stock = getStockDisponible(item);
      if (stock === null) return false;
      return stock > 0 && (item.quantity || 1) > stock;
    });

    if (problemas.length > 0) {
      const nombres = problemas.map((p) => `• ${getNombre(p)}`).join("\n");
      Alert.alert(
        "Revisa tu carrito",
        `Los siguientes productos no tienen suficiente stock:\n\n${nombres}\n\nAjusta las cantidades antes de continuar.`
      );
      return;
    }

    const agotados = cart.filter((item) => getStockDisponible(item) === 0);
    if (agotados.length > 0) {
      const nombres = agotados.map((p) => `• ${getNombre(p)}`).join("\n");
      Alert.alert(
        "Productos agotados",
        `Debes quitar estos productos antes de continuar:\n\n${nombres}`
      );
      return;
    }

    // SEGURIDAD: solo IDs y cantidades. El backend recalcula precios.
    const itemsSeguros = cart.map((item) => ({
      productId: item.id,
      variantSku: item.variantSku || null,
      size: item.selectedSize || null,
      color: item.selectedColor || null,
      quantity: Math.max(1, Math.min(999, Number(item.quantity) || 1)),
    }));

    navigation.navigate("Checkout", { items: itemsSeguros });
  }, [cart, navigation]);

  // ================================================================
  // RENDER — Item
  // ================================================================
  const renderItem = ({ item, index }) => {
    const foto = getFoto(item);
    const precio = getPrecio(item);
    const cantidad = item.quantity || 1;
    const subtotal = precio * cantidad;
    const varianteLabel = getVarianteLabel(item);
    const stockDisponible = getStockDisponible(item);
    const tieneInfoStock = stockDisponible !== null;

    const stockBajo =
      tieneInfoStock && stockDisponible > 0 && stockDisponible < 10;
    const agotado = tieneInfoStock && stockDisponible === 0;
    const excedeStock =
      tieneInfoStock && stockDisponible > 0 && cantidad > stockDisponible;
    const check = puedeIncrementar(item, cart);

    return (
      <View
        style={[
          styles.card,
          excedeStock && styles.cardWarning,
          agotado && styles.cardDisabled,
        ]}
      >
        {/* Número de orden */}
        <View style={styles.numberBadge}>
          <Text style={styles.numberText}>{index + 1}</Text>
        </View>

        <View style={styles.cardInner}>
          {/* Imagen */}
          <View style={styles.imageWrap}>
            {foto ? (
              <Image
                source={{ uri: foto }}
                style={styles.image}
                contentFit="cover"
                transition={150}
                cachePolicy="memory-disk"
              />
            ) : (
              <View style={[styles.image, styles.imagePlaceholder]}>
                <Feather name="image" size={24} color="#CBD5E1" />
              </View>
            )}
          </View>

          {/* Info */}
          <View style={styles.info}>
            <Text style={styles.name} numberOfLines={2}>
              {getNombre(item)}
            </Text>

            {(item.categoria_nombre || item.marca_nombre) && (
              <Text style={styles.metaLine} numberOfLines={1}>
                {item.categoria_nombre || "Sin categoría"}
                {item.marca_nombre ? ` · ${item.marca_nombre}` : ""}
              </Text>
            )}

            {!!varianteLabel && (
              <View style={styles.variantePill}>
                <Feather name="tag" size={9} color="#6366F1" />
                <Text style={styles.varianteText} numberOfLines={1}>
                  {varianteLabel}
                </Text>
              </View>
            )}

            <View style={styles.priceRow}>
              <Text style={styles.price}>
                {fmtPrecio(precio)}
                <Text style={styles.priceUnit}> c/u</Text>
              </Text>
            </View>

            {excedeStock && (
              <View style={styles.warningPill}>
                <Feather name="alert-circle" size={10} color="#B91C1C" />
                <Text style={styles.warningText}>
                  Solo hay {stockDisponible} disponibles
                </Text>
              </View>
            )}

            {!excedeStock && !agotado && stockBajo && (
              <View style={styles.lowStockPill}>
                <Feather name="alert-triangle" size={9} color="#B45309" />
                <Text style={styles.lowStockText}>
                  Solo {stockDisponible} disponibles
                </Text>
              </View>
            )}

            {agotado && (
              <View style={styles.warningPill}>
                <Feather name="x-circle" size={9} color="#B91C1C" />
                <Text style={styles.warningText}>Agotado</Text>
              </View>
            )}

            {/* Stepper cantidad + eliminar */}
            <View style={styles.stepperRow}>
              <View style={styles.stepper}>
                <TouchableOpacity
                  style={[
                    styles.stepBtn,
                    cantidad <= 1 && styles.stepBtnDisabled,
                  ]}
                  onPress={() => decreaseQuantity(item.cartKey || item.id)}
                  disabled={cantidad <= 1}
                  activeOpacity={0.7}
                >
                  <Feather
                    name="minus"
                    size={14}
                    color={cantidad <= 1 ? "#CBD5E1" : "#475569"}
                  />
                </TouchableOpacity>

                <Text style={styles.qtyText}>{cantidad}</Text>

                <TouchableOpacity
                  style={[styles.stepBtn, !check.ok && styles.stepBtnDisabled]}
                  onPress={() => safeIncrease(item)}
                  disabled={!check.ok}
                  activeOpacity={0.7}
                >
                  <Feather
                    name="plus"
                    size={14}
                    color={!check.ok ? "#CBD5E1" : "#475569"}
                  />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={() => confirmRemoveItem(item.cartKey || item.id)}
                activeOpacity={0.6}
              >
                <Ionicons name="trash-outline" size={16} color="#EF4444" />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Subtotal */}
        <View style={styles.subtotalRow}>
          <Text style={styles.subtotalLabel}>Subtotal</Text>
          <Text style={styles.subtotalValue}>{fmtPrecio(subtotal)}</Text>
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
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={22} color="#0F172A" />
        </TouchableOpacity>

        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.headerTitle}>Mi Carrito</Text>
          <Text style={styles.itemCount}>
            {totalItems} {totalItems === 1 ? "artículo" : "artículos"}
          </Text>
        </View>

        <View style={styles.headerIcon}>
          <Feather name="shopping-bag" size={20} color="#6366F1" />
          {totalItems > 0 && (
            <View style={styles.headerBadge}>
              <Text style={styles.headerBadgeText}>
                {totalItems > 99 ? "99+" : totalItems}
              </Text>
            </View>
          )}
        </View>
      </View>

      {cart.length === 0 ? (
        /* EMPTY */
        <View style={styles.empty}>
          <View style={styles.emptyIconBg}>
            <Feather name="shopping-bag" size={44} color="#94A3B8" />
          </View>
          <Text style={styles.emptyTitle}>Tu carrito está vacío</Text>
          <Text style={styles.emptyText}>
            Explora nuestra tienda y agrega tus productos favoritos.
          </Text>
          <TouchableOpacity
            style={styles.exploreBtn}
            onPress={() => navigation.navigate("Home")}
            activeOpacity={0.8}
          >
            <Feather name="shopping-cart" size={16} color="#FFF" />
            <Text style={styles.exploreBtnText}>Explorar tienda</Text>
          </TouchableOpacity>
        </View>
      ) : (
        /* LISTA */
        <FlatList
          data={sortedCart}
          keyExtractor={(item) => item.cartKey || String(item.id)}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          renderItem={renderItem}
        />
      )}

      {/* FOOTER CHECKOUT */}
      {cart.length > 0 && (
        <View style={styles.footer}>
          <View style={styles.totalRow}>
            <View>
              <Text style={styles.totalLabel}>Total estimado</Text>
              <Text style={styles.totalItemsText}>
                {totalItems} {totalItems === 1 ? "artículo" : "artículos"}
              </Text>
            </View>
            <Text style={styles.totalPrice}>{fmtPrecio(total)}</Text>
          </View>

          <TouchableOpacity
            style={styles.checkoutBtn}
            onPress={handleCheckout}
            activeOpacity={0.85}
          >
            <Text style={styles.checkoutBtnText}>Continuar al pago</Text>
            <Feather name="arrow-right" size={18} color="#FFF" />
          </TouchableOpacity>

          <View style={styles.securityNote}>
            <Feather name="shield" size={11} color="#059669" />
            <Text style={styles.securityNoteText}>
              El precio final se valida al confirmar el pedido
            </Text>
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
  container: { flex: 1, backgroundColor: "#F8FAFC" },

  // HEADER
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: "#FFF",
    borderBottomWidth: 1,
    borderColor: "#F1F5F9",
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.5,
  },
  itemCount: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "600",
    marginTop: 2,
  },
  headerIcon: { position: "relative", padding: 6 },
  headerBadge: {
    position: "absolute",
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    backgroundColor: "#EF4444",
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#FFF",
  },
  headerBadgeText: { color: "#FFF", fontSize: 9, fontWeight: "900" },

  // LIST
  listContent: { padding: 16, paddingBottom: 220 },

  // CARD
  card: {
    backgroundColor: "#FFF",
    marginBottom: 14,
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    position: "relative",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardWarning: { borderColor: "#FECACA", backgroundColor: "#FFF5F5" },
  cardDisabled: { opacity: 0.55 },

  numberBadge: {
    position: "absolute",
    top: -8,
    left: -8,
    minWidth: 26,
    height: 26,
    paddingHorizontal: 6,
    backgroundColor: "#6366F1",
    borderRadius: 13,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#FFF",
    zIndex: 2,
  },
  numberText: { color: "#FFF", fontSize: 11, fontWeight: "900" },

  cardInner: { flexDirection: "row", alignItems: "flex-start" },

  imageWrap: {
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    padding: 3,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  image: { width: 84, height: 84, borderRadius: 11 },
  imagePlaceholder: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
  },

  info: { flex: 1, marginLeft: 12, minWidth: 0 },
  name: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A",
    lineHeight: 18,
  },
  metaLine: {
    fontSize: 10.5,
    color: "#94A3B8",
    marginTop: 3,
    fontWeight: "500",
  },
  variantePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    backgroundColor: "#EEF2FF",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    marginTop: 6,
  },
  varianteText: { fontSize: 10, color: "#6366F1", fontWeight: "700" },

  priceRow: { flexDirection: "row", alignItems: "center", marginTop: 6 },
  price: { fontSize: 14, color: "#0F172A", fontWeight: "800" },
  priceUnit: { fontSize: 10, color: "#94A3B8", fontWeight: "500" },

  lowStockPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    marginTop: 6,
  },
  lowStockText: { fontSize: 9.5, color: "#B45309", fontWeight: "700" },

  warningPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    backgroundColor: "#FEE2E2",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    marginTop: 6,
  },
  warningText: { fontSize: 9.5, color: "#B91C1C", fontWeight: "700" },

  stepperRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    borderRadius: 10,
    padding: 3,
  },
  stepBtn: {
    width: 30,
    height: 30,
    backgroundColor: "#FFF",
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  stepBtnDisabled: { backgroundColor: "#F8FAFC" },
  qtyText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A",
    marginHorizontal: 14,
    minWidth: 22,
    textAlign: "center",
  },

  deleteBtn: {
    width: 34,
    height: 34,
    backgroundColor: "#FEF2F2",
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },

  subtotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  subtotalLabel: {
    fontSize: 10,
    color: "#94A3B8",
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  subtotalValue: { fontSize: 16, fontWeight: "900", color: "#6366F1" },

  // FOOTER
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#FFF",
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 28,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 15,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  totalLabel: { fontSize: 13, fontWeight: "700", color: "#64748B" },
  totalItemsText: {
    fontSize: 11,
    color: "#94A3B8",
    fontWeight: "500",
    marginTop: 3,
  },
  totalPrice: { fontSize: 26, fontWeight: "900", color: "#6366F1" },

  checkoutBtn: {
    backgroundColor: "#6366F1",
    paddingVertical: 16,
    borderRadius: 16,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    shadowColor: "#6366F1",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 4,
  },
  checkoutBtnText: { color: "#FFF", fontWeight: "800", fontSize: 15 },

  securityNote: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    marginTop: 10,
  },
  securityNoteText: {
    fontSize: 10,
    color: "#64748B",
    fontWeight: "600",
  },

  // EMPTY
  empty: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
    paddingBottom: 80,
  },
  emptyIconBg: {
    width: 96,
    height: 96,
    backgroundColor: "#F1F5F9",
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 22,
  },
  emptyTitle: { fontSize: 18, color: "#1E293B", fontWeight: "800" },
  emptyText: {
    marginTop: 8,
    color: "#94A3B8",
    textAlign: "center",
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 24,
  },
  exploreBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#6366F1",
    paddingHorizontal: 22,
    paddingVertical: 13,
    borderRadius: 14,
  },
  exploreBtnText: { color: "#FFF", fontWeight: "800", fontSize: 14 },
});