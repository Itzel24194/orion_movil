// src/screens/ManageOrdersScreen.js
import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput as RNTextInput,
  Modal,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Platform,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "../i18n/ui";
import { Ionicons, MaterialCommunityIcons, FontAwesome5, Feather } from "@expo/vector-icons";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system/legacy";

import { request, resolveProductPhoto } from "../services/api";

// =============================================================
// Config
// =============================================================
const PAGE_SIZE = 20;

const ESTADOS = [
  { key: "todos", label: "Todos", color: "#64748B", icon: "list" },
  { key: "pendiente", label: "Pendiente", color: "#F59E0B", icon: "time" },
  { key: "confirmado", label: "Confirmado", color: "#3B82F6", icon: "checkmark-circle" },
  { key: "preparando", label: "Preparando", color: "#8B5CF6", icon: "cube" },
  { key: "enviado", label: "Enviado", color: "#06B6D4", icon: "car" },
  { key: "entregado", label: "Entregado", color: "#10B981", icon: "checkmark-done" },
  { key: "cancelado", label: "Cancelado", color: "#EF4444", icon: "close-circle" },
];

const ESTADO_COLORS = {
  pendiente: "#F59E0B",
  confirmado: "#3B82F6",
  preparando: "#8B5CF6",
  enviado: "#06B6D4",
  entregado: "#10B981",
  cancelado: "#EF4444",
};

// =============================================================
// Helpers
// =============================================================
const fmtMoney = (n) => `$${Number(n || 0).toFixed(2)}`;

const fmtDate = (d) => {
  if (!d) return "—";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "—";
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
};

const getFechaPedido = (pedido) => {
  return pedido.created_at || pedido.fecha || pedido.fecha_creacion || null;
};

const EP_LIST     = (qs) => `/api/v1/admin/pedidos${qs ? `?${qs}` : ""}`;
const EP_DETAIL   = (id) => `/api/v1/admin/pedidos/${id}`;
const EP_ESTADO   = (id) => `/api/v1/admin/pedidos/estado/${id}`;
const EP_ELIMINAR = (id) => `/api/v1/admin/pedidos/eliminar/${id}`;

const getList   = (qs) => request(EP_LIST(qs), { method: "GET" });
const getDetail = (id) => request(EP_DETAIL(id), { method: "GET" });
const setEstado = (id, estado) =>
  request(EP_ESTADO(id), { method: "POST", body: { estado } });
const eliminar  = (id) => request(EP_ELIMINAR(id), { method: "DELETE" });

// =============================================================
// Componente principal
// =============================================================
export default function ManageOrdersScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [pedidos, setPedidos] = useState([]);
  const [filtro, setFiltro] = useState("todos");
  const [busqueda, setBusqueda] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [meta, setMeta] = useState({ total: 0, pages: 1 });
  const [detalle, setDetalle] = useState(null);
  const [detalleLoading, setDetalleLoading] = useState(false);
  const [cambiandoEstado, setCambiandoEstado] = useState(null);

  // =========================================================
  // Cargar lista
  // =========================================================
  const cargar = useCallback(
    async ({ reset = false, showSpinner = true } = {}) => {
      const pageToUse = reset ? 1 : page + 1;
      if (showSpinner && !refreshing) setLoading(true);
      if (!reset) setLoadingMore(true);

      try {
        const params = new URLSearchParams();
        if (filtro !== "todos") params.append("estado", filtro);
        params.append("page", String(pageToUse));
        params.append("limit", String(PAGE_SIZE));

        const json = await getList(params.toString());
        const data = Array.isArray(json?.data) ? json.data : [];
        const totalPages = json?.meta?.pages ?? 1;

        setPedidos((prev) => (reset ? data : [...prev, ...data]));
        setMeta({
          total: json?.meta?.total ?? data.length,
          pages: totalPages,
        });
        setPage(pageToUse);
        setHasMore(pageToUse < totalPages);
      } catch (e) {
        console.log("❌ Error cargando pedidos:", e.message);
        Alert.alert("Error", e.message || "No se pudieron cargar los pedidos");
      } finally {
        setLoading(false);
        setLoadingMore(false);
        setRefreshing(false);
      }
    },
    [filtro, page, refreshing]
  );

  useEffect(() => {
    cargar({ reset: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtro]);

  // Filtro local
  const pedidosFiltrados = React.useMemo(() => {
    if (!busqueda.trim()) return pedidos;
    const q = busqueda.toLowerCase().trim();
    
    return pedidos.filter((p) => {
      const fechaStr = fmtDate(getFechaPedido(p)).toLowerCase();
      const productosNombres = (p.items_list || []).map(it => (it.nombre || "").toLowerCase()).join(" ");
      
      const textoBuscable = [
        p.numero_pedido,
        p.usuario_nombre,
        p.usuario_email,
        fechaStr,
        p.metodo_pago,
        p.estado,
        p.total?.toString(),
        productosNombres
      ].join(" ").toLowerCase();

      return textoBuscable.includes(q);
    });
  }, [pedidos, busqueda]);

  const onRefresh = () => {
    setRefreshing(true);
    cargar({ reset: true, showSpinner: false });
  };

  const onLoadMore = () => {
    if (!loading && !loadingMore && hasMore) {
      cargar({ reset: false, showSpinner: false });
    }
  };

  // =========================================================
  // EXPORTAR PDF
  // =========================================================
  const exportarPDF = async (pedido) => {
    if (!pedido) return;

    try {
      const itemsHtml = (pedido.items_list || [])
        .map(
          (it) => `
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${it.cantidad}x ${it.nombre}</td>
            <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">$${Number(it.precio).toFixed(2)}</td>
            <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right; font-weight: bold;">$${Number(it.precio * it.cantidad).toFixed(2)}</td>
          </tr>
        `
        )
        .join("");

      const html = `
        <html>
          <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
            <style>
              body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 40px; color: #333; }
              .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #e10098; padding-bottom: 20px; }
              .header h1 { color: #e10098; margin: 0; font-size: 28px; }
              .header p { color: #666; margin: 5px 0 0 0; font-size: 14px; }
              .info { margin-bottom: 30px; font-size: 14px; line-height: 1.6; }
              .info strong { color: #1a1a2e; }
              table { width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 14px; }
              th { background: #f8fafc; padding: 10px; text-align: left; color: #64748b; border-bottom: 2px solid #e2e8f0; }
              .totals { text-align: right; font-size: 14px; line-height: 1.8; margin-bottom: 30px; }
              .totals .final { font-size: 20px; font-weight: bold; color: #e10098; }
              .footer { text-align: center; color: #999; font-size: 12px; margin-top: 50px; border-top: 1px solid #eee; padding-top: 20px; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>ORION.</h1>
              <p>Recibo de Pedido #${pedido.numero_pedido || pedido._id}</p>
            </div>
            
            <div class="info">
              <p><strong>Fecha:</strong> ${fmtDate(getFechaPedido(pedido))}</p>
              <p><strong>Cliente:</strong> ${pedido.usuario_nombre || "Usuario"}</p>
              <p><strong>Email:</strong> ${pedido.usuario_email || "Sin email"}</p>
              <p><strong>Estado:</strong> ${(pedido.estado || "Pendiente").toUpperCase()}</p>
            </div>

            <table>
              <thead>
                <tr>
                  <th>Producto</th>
                  <th style="text-align: right;">Precio</th>
                  <th style="text-align: right;">Total</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHtml}
              </tbody>
            </table>

            <div class="totals">
              <p>Subtotal: <strong>$${Number(pedido.subtotal || 0).toFixed(2)}</strong></p>
              <p>IVA: <strong>$${Number(pedido.iva || 0).toFixed(2)}</strong></p>
              <p>Envío: <strong>${pedido.envio === 0 ? "Gratis" : "$" + Number(pedido.envio).toFixed(2)}</strong></p>
              <p class="final">TOTAL: $${Number(pedido.total || 0).toFixed(2)}</p>
            </div>

            ${pedido.notas ? `<div class="info"><p><strong>Notas:</strong><br/>${pedido.notas}</p></div>` : ""}

            <div class="footer">
              Gracias por tu compra en ORION.<br/>
              Este documento es un comprobante de tu pedido.
            </div>
          </body>
        </html>
      `;

      const { base64 } = await Print.printToFileAsync({ html, base64: true });
      if (!base64) throw new Error("No se pudo generar el PDF");

      const fileName = `Pedido_${pedido.numero_pedido || pedido._id}.pdf`;
      const fileUri = FileSystem.cacheDirectory + fileName;

      await FileSystem.writeAsStringAsync(fileUri, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          UTI: 'com.adobe.pdf',
          mimeType: 'application/pdf',
          dialogTitle: 'Compartir Pedido'
        });
      } else {
        Alert.alert("Éxito", "El PDF se generó correctamente.");
      }
    } catch (error) {
      console.log("Error generando PDF:", error);
      Alert.alert("Error", "No se pudo generar el PDF del pedido.");
    }
  };

  // =========================================================
  // Ver detalle
  // =========================================================
  const abrirDetalle = async (pedido) => {
    setDetalle(pedido);
    setDetalleLoading(true);
    try {
      const json = await getDetail(pedido._id);
      if (json?.data) setDetalle(json.data);
    } catch (e) {
      console.log("⚠️ No se pudo refrescar detalle:", e.message);
    } finally {
      setDetalleLoading(false);
    }
  };

  // =========================================================
  // Cambiar estado
  // =========================================================
  const cambiarEstado = (pedido, nuevoEstado) => {
    if (pedido.estado === nuevoEstado) return;
    Alert.alert(
      "Cambiar estado",
      `¿Cambiar el pedido #${pedido.numero_pedido} a "${nuevoEstado}"?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Sí, cambiar",
          onPress: async () => {
            setCambiandoEstado(pedido._id);
            try {
              await setEstado(pedido._id, nuevoEstado);
              setPedidos((prev) =>
                prev.map((p) =>
                  p._id === pedido._id ? { ...p, estado: nuevoEstado } : p
                )
              );
              if (detalle && detalle._id === pedido._id) {
                setDetalle({ ...detalle, estado: nuevoEstado });
              }
              Alert.alert("✅ Listo", `Estado actualizado a ${nuevoEstado}`);
            } catch (e) {
              Alert.alert("Error", e.message);
            } finally {
              setCambiandoEstado(null);
            }
          },
        },
      ]
    );
  };

  // =========================================================
  // Eliminar
  // =========================================================
  const eliminarPedido = (pedido) => {
    Alert.alert(
      "Eliminar pedido",
      `¿Eliminar el pedido #${pedido.numero_pedido}? Esta acción no se puede deshacer.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            try {
              await eliminar(pedido._id);
              setPedidos((prev) => prev.filter((p) => p._id !== pedido._id));
              if (detalle && detalle._id === pedido._id) setDetalle(null);
              Alert.alert("✅ Eliminado", "Pedido eliminado correctamente");
            } catch (e) {
              Alert.alert("Error", e.message);
            }
          },
        },
      ]
    );
  };

  // =========================================================
  // Tarjeta (Lista)
  // =========================================================
  const renderPedido = ({ item }) => {
    const color = ESTADO_COLORS[item.estado] || "#64748B";
    const fechaMostrar = getFechaPedido(item);

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.85}
        onPress={() => abrirDetalle(item)}
      >
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <FontAwesome5 name="receipt" size={12} color="#e10098" />
              <Text style={styles.cardNumero}>#{item.numero_pedido}</Text>
              {item.msi_meses > 0 && (
                <View style={styles.badgeMsi}>
                  <Text style={styles.badgeMsiText}>{item.msi_meses} MSI</Text>
                </View>
              )}
              {item.envio === 0 && item.tipo_envio !== "click_collect" && (
                <View style={styles.badgeEnvio}>
                  <Text style={styles.badgeEnvioText}>Envío gratis</Text>
                </View>
              )}
            </View>
            <Text style={styles.cardFecha}>
              <Ionicons name="calendar-outline" size={10} /> {fmtDate(fechaMostrar)}
            </Text>
            <Text style={styles.cardCliente} numberOfLines={1}>
              <Ionicons name="person" size={10} /> {item.usuario_nombre || "Usuario"}{" "}
              <Text style={{ color: "#94A3B8", fontSize: 10 }}>
                ({item.usuario_email || "Sin email"})
              </Text>
            </Text>
          </View>

          <View style={{ alignItems: "flex-end", gap: 4 }}>
            <Text style={styles.cardTotal}>{fmtMoney(item.total)}</Text>
            <View
              style={[
                styles.badge,
                { backgroundColor: `${color}22`, borderColor: `${color}66` },
              ]}
            >
              <Text style={[styles.badgeText, { color }]}>
                {String(item.estado || "").toUpperCase()}
              </Text>
            </View>
            {item.tipo_envio === "click_collect" && (
              <View style={styles.badgePickup}>
                <Text style={styles.badgePickupText}>Click & Collect</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.productsContainer}>
          <Text style={styles.productsTitle}>
            <Feather name="box" size={12} color="#e10098" /> Productos ({item.items_list?.length || 0})
          </Text>
          {(item.items_list || []).slice(0, 3).map((it, idx) => {
            const imagenUrl = resolveProductPhoto(it.imagen || it.foto);
            return (
              <View key={idx} style={styles.productRow}>
                {imagenUrl ? (
                  <Image source={{ uri: imagenUrl }} style={styles.productImg} />
                ) : (
                  <View style={[styles.productImg, { justifyContent: 'center', alignItems: 'center' }]}>
                    <Feather name="box" size={14} color="#64748B" />
                  </View>
                )}
                <Text style={styles.productName} numberOfLines={1}>{it.nombre}</Text>
                <Text style={styles.productQty}>x{it.cantidad}</Text>
                <Text style={styles.productPrice}>{fmtMoney((it.precio || 0) * (it.cantidad || 1))}</Text>
              </View>
            );
          })}
          {(item.items_list?.length || 0) > 3 && (
            <Text style={styles.moreProducts}>+ {item.items_list.length - 3} productos más...</Text>
          )}
        </View>

        <View style={styles.cardFooter}>
          <View style={styles.footerLeft}>
            <Text style={styles.footerText}>
              <Ionicons name="card-outline" size={11} /> {item.metodo_pago || "—"}
            </Text>
            <Text style={styles.footerText}>
              <Ionicons name="bicycle-outline" size={11} /> {item.tipo_envio === "click_collect" ? "Pickup" : "Domicilio"}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.verBtn}
            onPress={() => abrirDetalle(item)}
          >
            <Text style={styles.verBtnText}>Ver Detalle</Text>
            <Ionicons name="chevron-forward" size={14} color="#FFF" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  // =========================================================
  // Header
  // =========================================================
  const Header = (
    <>
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={16} color="#64748B" />
          <RNTextInput
            style={styles.searchInput}
            placeholder="Buscar pedido, cliente, fecha, producto..."
            placeholderTextColor="#475569"
            value={busqueda}
            onChangeText={setBusqueda}
            returnKeyType="search"
          />
          {busqueda.length > 0 && (
            <TouchableOpacity onPress={() => setBusqueda("")}>
              <Ionicons name="close-circle" size={16} color="#64748B" />
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.totalChip}>
          <Text style={styles.totalChipText}>{meta.total} Pedidos</Text>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filtrosScroll}
        keyboardShouldPersistTaps="handled"
      >
        {ESTADOS.map((e) => {
          const active = filtro === e.key;
          return (
            <TouchableOpacity
              key={e.key}
              onPress={() => setFiltro(e.key)}
              style={[
                styles.filtroBtn,
                active && { backgroundColor: e.color, borderColor: e.color },
              ]}
            >
              <Ionicons
                name={e.icon}
                size={12}
                color={active ? "#FFF" : e.color}
              />
              <Text
                style={[
                  styles.filtroText,
                  { color: active ? "#FFF" : e.color },
                ]}
              >
                {e.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </>
  );

  // =========================================================
  // Render principal
  // =========================================================
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
          <Ionicons name="arrow-back" size={22} color="#FFF" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Gestión de Pedidos</Text>
          <Text style={styles.subtitle}>Administra el flujo de envíos</Text>
        </View>
        <TouchableOpacity onPress={onRefresh} style={styles.iconBtn}>
          <Ionicons name="refresh" size={20} color="#7C3AED" />
        </TouchableOpacity>
      </View>

      {loading && pedidos.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#7C3AED" />
          <Text style={styles.loadingText}>Cargando pedidos...</Text>
        </View>
      ) : (
        <FlatList
          data={pedidosFiltrados}
          keyExtractor={(item, index) => `${item._id || index}-${index}`}
          renderItem={renderPedido}
          ListHeaderComponent={Header}
          contentContainerStyle={{ paddingBottom: 30 }}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#7C3AED"
            />
          }
          onEndReached={onLoadMore}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="file-tray-outline" size={64} color="#334155" />
              <Text style={styles.emptyTitle}>No hay pedidos</Text>
              <Text style={styles.emptyText}>
                {busqueda
                  ? `No se encontraron resultados para "${busqueda}"`
                  : "Aún no se han registrado pedidos en el sistema."}
              </Text>
            </View>
          }
          ListFooterComponent={
            hasMore ? (
              <TouchableOpacity
                style={styles.loadMoreBtn}
                onPress={onLoadMore}
                disabled={loadingMore}
              >
                {loadingMore ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <>
                    <Ionicons name="chevron-down" size={16} color="#FFF" />
                    <Text style={styles.loadMoreText}>Cargar más pedidos</Text>
                  </>
                )}
              </TouchableOpacity>
            ) : pedidos.length > 0 ? (
              <Text style={styles.endOfListText}>— Fin de los resultados —</Text>
            ) : null
          }
        />
      )}

      {/* MODAL DETALLE (REDISEÑADO) */}
      <Modal
        visible={!!detalle}
        animationType="slide"
        transparent
        onRequestClose={() => setDetalle(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {detalle && (
              <>
                {/* Header del modal con color de estado */}
                <View style={styles.modalHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalTitle}>#{detalle.numero_pedido}</Text>
                    <Text style={styles.modalSub}>{fmtDate(getFechaPedido(detalle))}</Text>
                  </View>
                  <View style={[styles.modalEstadoBadge, { backgroundColor: `${ESTADO_COLORS[detalle.estado]}22`, borderColor: `${ESTADO_COLORS[detalle.estado]}66` }]}>
                    <Text style={[styles.modalEstadoText, { color: ESTADO_COLORS[detalle.estado] }]}>
                      {(detalle.estado || "pendiente").toUpperCase()}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => setDetalle(null)} style={styles.modalClose}>
                    <Ionicons name="close" size={22} color="#94A3B8" />
                  </TouchableOpacity>
                </View>

                {detalleLoading && (
                  <ActivityIndicator color="#7C3AED" style={{ marginVertical: 10 }} />
                )}

                <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
                  {/* Botón de Exportar PDF */}
                  <View style={styles.topActionsRow}>
                    <TouchableOpacity style={styles.actionExportBtn} onPress={() => exportarPDF(detalle)}>
                      <Ionicons name="document-text-outline" size={16} color="#FFF" />
                      <Text style={styles.actionExportText}>Exportar a PDF</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Cliente */}
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Cliente</Text>
                    <View style={styles.clienteCard}>
                      <View style={styles.clienteAvatar}>
                        <Ionicons name="person" size={20} color="#e10098" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.clienteNombre}>{detalle.usuario_nombre || "Usuario"}</Text>
                        <Text style={styles.clienteEmail}>{detalle.usuario_email || "Sin email"}</Text>
                        {detalle.usuario_telefono && (
                          <Text style={styles.clienteTelefono}>{detalle.usuario_telefono}</Text>
                        )}
                      </View>
                    </View>
                  </View>

                  {/* Selector de Estado */}
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Actualizar Estado</Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.estadoScroll}
                    >
                      {ESTADOS.filter((e) => e.key !== "todos").map((e) => {
                        const active = detalle.estado === e.key;
                        return (
                          <TouchableOpacity
                            key={e.key}
                            disabled={cambiandoEstado === detalle._id}
                            onPress={() => cambiarEstado(detalle, e.key)}
                            style={[
                              styles.estadoBtn,
                              active && {
                                backgroundColor: e.color,
                                borderColor: e.color,
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.estadoBtnText,
                                { color: active ? "#FFF" : e.color },
                              ]}
                            >
                              {e.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>

                  {/* Productos */}
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>
                      Productos ({detalle.items_list?.length || 0})
                    </Text>
                    {(detalle.items_list || []).map((it, idx) => {
                      const imagenUrl = resolveProductPhoto(it.imagen || it.foto);
                      return (
                        <View key={idx} style={styles.itemRow}>
                          {imagenUrl ? (
                            <Image source={{ uri: imagenUrl }} style={styles.modalProductImg} />
                          ) : (
                            <View style={[styles.modalProductImg, { justifyContent: 'center', alignItems: 'center' }]}>
                              <Feather name="box" size={20} color="#64748B" />
                            </View>
                          )}
                          <View style={{ flex: 1, marginLeft: 12 }}>
                            <Text style={styles.itemName} numberOfLines={1}>{it.nombre}</Text>
                            <Text style={styles.itemMeta}>
                              Cant: {it.cantidad}
                              {it.atributos?.color ? ` · ${it.atributos.color}` : ""}
                              {it.atributos?.tamano ? ` · ${it.atributos.tamano}` : ""}
                              {it.sku ? ` · ${it.sku}` : ""}
                            </Text>
                          </View>
                          <Text style={styles.itemPrice}>
                            {fmtMoney((it.precio || 0) * (it.cantidad || 1))}
                          </Text>
                        </View>
                      );
                    })}
                  </View>

                  {/* Desglose */}
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Desglose</Text>
                    <View style={styles.desgloseCard}>
                      <Row label="Subtotal" value={fmtMoney(detalle.subtotal)} />
                      {detalle.descuento_total > 0 && (
                        <Row label="Descuentos" value={`-${fmtMoney(detalle.descuento_total)}`} color="#10B981" />
                      )}
                      <Row label="IVA" value={fmtMoney(detalle.iva)} />
                      <Row
                        label="Envío"
                        value={detalle.envio === 0 ? "Gratis" : fmtMoney(detalle.envio)}
                        color={detalle.envio === 0 ? "#10B981" : undefined}
                      />
                      <View style={styles.totalRow}>
                        <Text style={styles.totalLabel}>TOTAL</Text>
                        <Text style={styles.totalValue}>{fmtMoney(detalle.total)}</Text>
                      </View>
                    </View>
                  </View>

                  {/* Envío */}
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Envío</Text>
                    <View style={styles.infoCard}>
                      <View style={styles.infoRow}>
                        <Ionicons name={detalle.tipo_envio === "click_collect" ? "storefront" : "bicycle"} size={18} color="#e10098" />
                        <Text style={styles.infoLabel}>
                          {detalle.tipo_envio === "click_collect" ? "Click & Collect" : "Domicilio"}
                        </Text>
                      </View>
                      {detalle.tipo_envio === "click_collect" ? (
                        <>
                          {detalle.tienda_recogida && (
                            <Text style={styles.infoText}>Tienda: {detalle.tienda_recogida}</Text>
                          )}
                          {detalle.codigo_recogida && (
                            <Text style={styles.infoText}>Código: {detalle.codigo_recogida}</Text>
                          )}
                        </>
                      ) : detalle.direccion ? (
                        <>
                          <Text style={styles.infoText}>
                            {detalle.direccion.calle} {detalle.direccion.numero}
                          </Text>
                          <Text style={styles.infoText}>
                            {detalle.direccion.colonia}, {detalle.direccion.ciudad}
                          </Text>
                          <Text style={styles.infoText}>
                            CP {detalle.direccion.cp} · {detalle.direccion.estado}
                          </Text>
                          {detalle.direccion.referencias && (
                            <Text style={styles.infoText}>Ref: {detalle.direccion.referencias}</Text>
                          )}
                        </>
                      ) : (
                        <Text style={styles.infoText}>Sin dirección registrada</Text>
                      )}
                    </View>
                  </View>

                  {/* Pago */}
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Pago</Text>
                    <View style={styles.infoCard}>
                      <View style={styles.infoRow}>
                        <Ionicons name="card" size={18} color="#e10098" />
                        <Text style={styles.infoLabel}>{detalle.metodo_pago || "No especificado"}</Text>
                      </View>
                      <Row
                        label="Estado del pago"
                        value={detalle.pago_estado || "pendiente"}
                        color={detalle.pago_estado === "pagado" ? "#10B981" : "#F59E0B"}
                      />
                      {detalle.msi_meses > 0 && (
                        <Row label="Meses sin intereses" value={`${detalle.msi_meses} MSI`} />
                      )}
                    </View>
                  </View>

                  {/* Beneficios */}
                  {(detalle.puntos_ganados > 0 || detalle.cashback_ganado > 0) && (
                    <View style={styles.section}>
                      <Text style={styles.sectionTitle}>Beneficios</Text>
                      <View style={styles.infoCard}>
                        {detalle.puntos_ganados > 0 && (
                          <View style={styles.beneficioRow}>
                            <FontAwesome5 name="crown" size={14} color="#C99B2E" />
                            <Text style={styles.beneficioText}>Puntos ganados: {detalle.puntos_ganados}</Text>
                          </View>
                        )}
                        {detalle.cashback_ganado > 0 && (
                          <View style={styles.beneficioRow}>
                            <Ionicons name="wallet" size={14} color="#16a34a" />
                            <Text style={styles.beneficioText}>Cashback: {fmtMoney(detalle.cashback_ganado)}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  )}

                  {/* Notas */}
                  {detalle.notas ? (
                    <View style={styles.section}>
                      <Text style={styles.sectionTitle}>Notas internas</Text>
                      <View style={styles.infoCard}>
                        <Text style={styles.notasText}>{detalle.notas}</Text>
                      </View>
                    </View>
                  ) : null}

                  {/* Eliminar */}
                  <View style={styles.actionsRow}>
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.actionDanger]}
                      onPress={() => eliminarPedido(detalle)}
                    >
                      <Ionicons name="trash" size={16} color="#EF4444" />
                      <Text style={[styles.actionText, { color: "#EF4444" }]}>
                        Eliminar Pedido
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <View style={{ height: 40 }} />
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// =============================================================
// Row
// =============================================================
function Row({ label, value, color }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, color && { color }]}>{value}</Text>
    </View>
  );
}

// =============================================================
// Estilos
// =============================================================
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#020617" },

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "android" ? 40 : 10,
    paddingBottom: 15,
    backgroundColor: "#0f172a",
    borderBottomWidth: 1,
    borderColor: "#1e293b",
  },
  backBtn: { padding: 6 },
  iconBtn: {
    padding: 8,
    backgroundColor: "#7C3AED15",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#7C3AED30",
  },
  title: { color: "#FFF", fontSize: 18, fontWeight: "bold" },
  subtitle: { color: "#64748B", fontSize: 12, marginTop: 2 },

  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  loadingText: { color: "#64748B", fontSize: 13 },

  searchRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 15,
    paddingBottom: 10,
  },
  searchBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#1e293b",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
  },
  searchInput: { flex: 1, color: "#FFF", fontSize: 13, paddingVertical: 0 },

  totalChip: {
    backgroundColor: "#e1009820",
    borderWidth: 1,
    borderColor: "#e1009860",
    borderRadius: 12,
    paddingHorizontal: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  totalChipText: { color: "#e10098", fontWeight: "bold", fontSize: 13 },

  filtrosScroll: { paddingHorizontal: 20, gap: 8, paddingBottom: 15 },
  filtroBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 50,
    borderWidth: 1.5,
    borderColor: "#1e293b",
    backgroundColor: "#0f172a",
  },
  filtroText: { fontSize: 12, fontWeight: "600" },

  // Tarjeta
  card: {
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#1e293b",
    borderRadius: 16,
    padding: 15,
    marginHorizontal: 20,
    marginBottom: 12,
  },
  cardHeader: { flexDirection: "row", gap: 10 },
  cardNumero: { color: "#FFF", fontSize: 15, fontWeight: "bold" },
  cardFecha: { color: "#64748B", fontSize: 11, marginTop: 3 },
  cardCliente: { color: "#CBD5E1", fontSize: 12, marginTop: 3 },
  badgeMsi: {
    backgroundColor: "#dbeafe",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeMsiText: { color: "#1e40af", fontSize: 9, fontWeight: "bold" },
  badgeEnvio: {
    backgroundColor: "#d1fae5",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeEnvioText: { color: "#065f46", fontSize: 9, fontWeight: "bold" },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  badgeText: { fontSize: 10, fontWeight: "bold" },
  badgePickup: {
    backgroundColor: "#fef3c7",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
  badgePickupText: { color: "#92400e", fontSize: 9, fontWeight: "bold" },
  cardTotal: { color: "#A78BFA", fontSize: 16, fontWeight: "bold" },

  productsContainer: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#1e293b",
  },
  productsTitle: {
    color: "#94A3B8",
    fontSize: 11,
    fontWeight: "bold",
    marginBottom: 8,
  },
  productRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  productImg: {
    width: 30,
    height: 30,
    borderRadius: 6,
    backgroundColor: "#1e293b",
    marginRight: 10,
  },
  modalProductImg: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: "#1e293b",
  },
  productName: { flex: 1, color: "#FFF", fontSize: 12 },
  productQty: { color: "#64748B", fontSize: 11, marginRight: 10 },
  productPrice: { color: "#A78BFA", fontSize: 12, fontWeight: "bold" },
  moreProducts: { color: "#7C3AED", fontSize: 11, fontStyle: "italic", marginTop: 4 },

  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#1e293b",
  },
  footerLeft: { flexDirection: "row", gap: 10 },
  footerText: { color: "#94A3B8", fontSize: 11 },
  verBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#e10098",
    borderRadius: 50,
  },
  verBtnText: { color: "#FFF", fontSize: 12, fontWeight: "bold" },

  empty: { alignItems: "center", paddingVertical: 60, paddingHorizontal: 40 },
  emptyTitle: { color: "#CBD5E1", fontSize: 16, fontWeight: "bold", marginTop: 15 },
  emptyText: { color: "#64748B", fontSize: 13, textAlign: "center", marginTop: 6 },

  loadMoreBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#1e293b",
    borderRadius: 12,
    marginHorizontal: 20,
    paddingVertical: 14,
    marginTop: 10,
    marginBottom: 20,
  },
  loadMoreText: { color: "#FFF", fontSize: 13, fontWeight: "bold" },
  endOfListText: {
    textAlign: "center",
    color: "#475569",
    fontSize: 12,
    marginVertical: 20,
    fontStyle: "italic",
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.8)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#020617",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 15,
    maxHeight: "95%",
    borderTopWidth: 2,
    borderColor: "#e10098",
    flex: 1,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingBottom: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#1e293b",
    gap: 10,
  },
  modalTitle: { color: "#FFF", fontSize: 20, fontWeight: "bold" },
  modalSub: { color: "#64748B", fontSize: 12, marginTop: 3 },
  modalClose: { padding: 6 },
  modalEstadoBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 50,
    borderWidth: 1,
  },
  modalEstadoText: { fontSize: 10, fontWeight: "bold" },

  topActionsRow: {
    flexDirection: "row",
    paddingHorizontal: 20,
    marginTop: 15,
    gap: 10,
  },
  actionExportBtn: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#e10098",
    borderRadius: 14,
    paddingVertical: 14,
    gap: 8,
    shadowColor: "#e10098",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  actionExportText: { color: "#FFF", fontSize: 14, fontWeight: "bold" },

  section: { marginTop: 20, paddingHorizontal: 20 },
  sectionTitle: {
    color: "#94A3B8",
    fontSize: 12,
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: 10,
  },

  // Cliente card
  clienteCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0f172a",
    borderRadius: 16,
    padding: 15,
    borderWidth: 1,
    borderColor: "#1e293b",
  },
  clienteAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#e1009820",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
  },
  clienteNombre: { color: "#FFF", fontSize: 15, fontWeight: "bold" },
  clienteEmail: { color: "#94A3B8", fontSize: 12, marginTop: 2 },
  clienteTelefono: { color: "#64748B", fontSize: 12, marginTop: 2 },

  // Selector de estado
  estadoScroll: { gap: 10 },
  estadoBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 50,
    borderWidth: 1.5,
    borderColor: "#1e293b",
    backgroundColor: "#0f172a",
  },
  estadoBtnText: { fontSize: 12, fontWeight: "bold" },

  // Productos
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1e293b",
  },
  itemName: { color: "#FFF", fontSize: 14, fontWeight: "600" },
  itemMeta: { color: "#64748B", fontSize: 11, marginTop: 3 },
  itemPrice: { color: "#A78BFA", fontSize: 14, fontWeight: "bold" },

  // Desglose
  desgloseCard: {
    backgroundColor: "#0f172a",
    borderRadius: 16,
    padding: 15,
    borderWidth: 1,
    borderColor: "#1e293b",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  rowLabel: { color: "#94A3B8", fontSize: 13 },
  rowValue: { color: "#FFF", fontSize: 13, fontWeight: "600" },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 12,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#1e293b",
  },
  totalLabel: { color: "#FFF", fontSize: 15, fontWeight: "bold" },
  totalValue: { color: "#A78BFA", fontSize: 20, fontWeight: "bold" },

  // Info cards (Envío, Pago, etc.)
  infoCard: {
    backgroundColor: "#0f172a",
    borderRadius: 16,
    padding: 15,
    borderWidth: 1,
    borderColor: "#1e293b",
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  infoLabel: { color: "#FFF", fontSize: 14, fontWeight: "600" },
  infoText: { color: "#94A3B8", fontSize: 13, lineHeight: 20 },
  notasText: { color: "#CBD5E1", fontSize: 13, lineHeight: 20, fontStyle: "italic" },

  beneficioRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 4,
  },
  beneficioText: { color: "#CBD5E1", fontSize: 13 },

  actionsRow: { flexDirection: "row", gap: 10, marginTop: 25, paddingHorizontal: 20 },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#EF4444",
  },
  actionDanger: { backgroundColor: "#EF444410" },
  actionText: { fontSize: 14, fontWeight: "bold" },
});