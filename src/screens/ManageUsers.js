// screens/admin/ManageUsersScreen.jsx
import React, {
  useState, useEffect, useCallback, useMemo, memo, useRef,
} from "react";
import {
  View, StyleSheet, FlatList, TouchableOpacity, TextInput, Image,
  ActivityIndicator, Modal, ScrollView, RefreshControl, Alert as RNAlert,
  Switch, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text, Alert } from "../i18n/ui";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

import {
  fetchAdminUsers,
  fetchAdminUserDetail,
  updateAdminUser,
  changeUserRole,
  toggleAdminUser,
  deleteAdminUser,
} from "../services/api";

// ================================================================
// Design tokens
// ================================================================
const T = {
  bg: "#08090D",
  surface: "#101219",
  surface2: "#161923",
  surface3: "#1C1F2B",
  border: "#232633",
  borderSoft: "#1A1D27",
  text: "#F1F3F9",
  textSub: "#9BA1B0",
  textMuted: "#5F6575",
  admin: "#8B5CF6",
  vendedor: "#F59E0B",
  cliente: "#3B82F6",
  success: "#10B981",
  danger: "#EF4444",
  primary: "#8B5CF6",
};

const ROLE_TO_BACKEND = {
  admin: "administrador",
  vendedor: "vendedor",
  cliente: "cliente",
};

const ROLE_META = {
  todos:    { label: "Todos",      color: T.primary,  icon: "apps" },
  admin:    { label: "Admin",      color: T.admin,    icon: "shield-checkmark" },
  vendedor: { label: "Vendedores", color: T.vendedor, icon: "storefront" },
  cliente:  { label: "Clientes",   color: T.cliente,  icon: "people" },
};

const ROLE_COLORS = { admin: T.admin, vendedor: T.vendedor, cliente: T.cliente };

const GENEROS = [
  { label: "Mujer",      value: "Femenino"   },
  { label: "Hombre",     value: "Masculino"  },
  { label: "Indefinido", value: "Indefinido" },
];

const PAGE_SIZE   = 10;
const DEBOUNCE_MS = 300;

// ================================================================
// Helpers
// ================================================================
const nombreCompleto = (u) =>
  [u?.nombre, u?.apellido_paterno, u?.apellido_materno]
    .filter(Boolean)
    .join(" ")
    .trim() || "Sin nombre";

const normalizarGenero = (valor) => {
  if (!valor) return "Indefinido";
  const v = String(valor).trim().toLowerCase();
  if (["masculino", "hombre", "m", "male", "man"].includes(v)) return "Masculino";
  if (["femenino", "mujer", "f", "female", "woman"].includes(v)) return "Femenino";
  return "Indefinido";
};

const getGeneroItem = (u) =>
  normalizarGenero(u?.genero ?? u?.sexo ?? "");

// ⭐ Normaliza fecha_nacimiento a YYYY-MM-DD
const normalizeFechaInput = (v) => {
  if (!v) return "";
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  try {
    const d = new Date(s);
    if (isNaN(d.getTime())) return "";
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
  } catch { return ""; }
};

// ⭐ ¿el valor viene con contenido real?
const isPresent = (v) => {
  if (v === undefined || v === null) return false;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "string") return v.trim().length > 0;
  if (typeof v === "object") return Object.keys(v).length > 0;
  return true;
};

const pickDir = (d = {}) => ({
  id: d.id ?? d._id ?? null,
  nombre:
    d.alias || d.nombre ||
    (d.calle
      ? `${d.calle}${d.numero_exterior || d.numero ? " " + (d.numero_exterior || d.numero) : ""}`
      : "Dirección"),
  calle: d.calle || "",
  numero: d.numero_exterior ?? d.numero ?? d.numeroExt ?? "",
  numero_interior: d.numero_interior || "",
  cp: String(d.codigo_postal ?? d.cp ?? "").replace(/\D/g, ""),
  colonia: d.colonia || "",
  ciudad: d.ciudad || "",
  estado: d.estado || "",
  pais: d.pais || "México",
  referencias: d.referencias || "",
  telefono: d.telefono || "",
  predeterminada: !!d.predeterminada,
});

const getFechaRegistro = (u) => {
  if (!u) return null;
  const direct = u.fecha_registro || u.created_at || u.creado_en || u.createdAt;
  if (direct) return direct;
  const raw = u._raw || {};
  const fromRaw =
    raw.fecha_registro || raw.created_at || raw.creado_en || raw.createdAt || raw.fecha_alta;
  if (fromRaw) return fromRaw;
  const id = u.id || u._id || raw._id;
  if (id && typeof id === "string" && id.length >= 8) {
    const hex = id.substring(0, 8);
    if (/^[0-9a-f]{8}$/i.test(hex)) {
      const ts = parseInt(hex, 16);
      if (!isNaN(ts)) {
        const d = new Date(ts * 1000);
        const y = d.getFullYear();
        if (y > 2000 && y < 2100) return d.toISOString();
      }
    }
  }
  return null;
};

const getUltimoAcceso = (u) => {
  if (!u) return null;
  return (
    u.ultimo_acceso || u.ultimo_login ||
    u._raw?.ultimo_acceso || u._raw?.ultimo_login || u._raw?.last_login || null
  );
};

// ⭐ FIX: parseo manual para evitar desfase UTC-6 en México
const MESES_CORTOS = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];

const fmtFecha = (v) => {
  if (!v) return "—";

  if (typeof v === "string") {
    const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) {
      const y = m[1];
      const mo = parseInt(m[2], 10) - 1;
      const d = m[3];
      if (mo >= 0 && mo < 12) return `${d} ${MESES_CORTOS[mo]} ${y}`;
    }
  }

  try {
    const d = new Date(v);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("es-MX", {
      day: "2-digit", month: "short", year: "numeric",
    });
  } catch { return "—"; }
};

const fmtFechaHora = (v) => {
  if (!v) return "—";
  try {
    const d = new Date(v);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleString("es-MX", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return "—"; }
};

// ================================================================
// Avatar
// ================================================================
const Avatar = memo(function Avatar({ item, color, size = 44 }) {
  const [imgError, setImgError] = useState(false);
  const initial = (item?.nombre || "?").charAt(0).toUpperCase();
  const uri = item?.fotoUrl || item?.foto;
  const showImage = uri && !imgError;

  if (showImage) {
    return (
      <Image
        source={{ uri }}
        style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}
        onError={() => setImgError(true)}
      />
    );
  }
  return (
    <View
      style={[
        styles.avatar,
        {
          width: size, height: size, borderRadius: size / 2,
          backgroundColor: color + "1A",
          borderWidth: 1, borderColor: color + "35",
        },
      ]}
    >
      <Text style={[styles.avatarText, { color, fontSize: size / 2.5 }]}>{initial}</Text>
    </View>
  );
});

// ================================================================
// Tarjeta
// ================================================================
const UserCard = memo(function UserCard({ item, onPress, onToggle, onDelete }) {
  const color = ROLE_COLORS[item.rol] || T.textSub;

  return (
    <View style={styles.card}>
      <TouchableOpacity
        activeOpacity={0.75}
        onPress={() => onPress(item)}
        style={styles.cardHeader}
      >
        <Avatar item={item} color={color} size={48} />

        <View style={styles.cardInfo}>
          <Text style={styles.cardName} numberOfLines={1}>
            {nombreCompleto(item)}
          </Text>
          <View style={styles.cardMetaRow}>
            <Ionicons name="mail-outline" size={11} color={T.textMuted} />
            <Text style={styles.cardMeta} numberOfLines={1}>
              {item.email || "Sin email"}
            </Text>
          </View>
          {item.telefono ? (
            <View style={styles.cardMetaRow}>
              <Ionicons name="call-outline" size={11} color={T.textMuted} />
              <Text style={styles.cardMeta} numberOfLines={1}>{item.telefono}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.cardRight}>
          <View
            style={[
              styles.roleBadge,
              { backgroundColor: color + "1A", borderColor: color + "35" },
            ]}
          >
            <View style={[styles.roleDot, { backgroundColor: color }]} />
            <Text style={[styles.roleBadgeText, { color }]}>
              {item.rol.toUpperCase()}
            </Text>
          </View>
          <Ionicons
            name="chevron-forward" size={16} color={T.textMuted}
            style={{ marginTop: 8 }}
          />
        </View>
      </TouchableOpacity>

      <View style={styles.cardDivider} />

      <View style={styles.cardFooter}>
        <TouchableOpacity
          style={[styles.statusPill, item.activo ? styles.statusOn : styles.statusOff]}
          onPress={() => onToggle(item)}
          activeOpacity={0.7}
        >
          <View
            style={[
              styles.statusDot,
              { backgroundColor: item.activo ? T.success : T.danger },
            ]}
          />
          <Text
            style={[
              styles.statusText,
              { color: item.activo ? T.success : T.danger },
            ]}
          >
            {item.activo ? "Activo" : "Inactivo"}
          </Text>
        </TouchableOpacity>

        <View style={{ flex: 1 }} />

        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => onPress(item)}
          activeOpacity={0.7}
        >
          <Ionicons name="pencil-outline" size={15} color="#60A5FA" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.iconBtn, styles.iconBtnDanger]}
          onPress={() => onDelete(item)}
          activeOpacity={0.7}
        >
          <Ionicons name="trash-outline" size={15} color="#F87171" />
        </TouchableOpacity>
      </View>
    </View>
  );
});

// ================================================================
// Paginación
// ================================================================
const Pagination = memo(function Pagination({
  page, pages, total, onChange, busy,
}) {
  if (total <= 0) return null;

  const goto = (p) => {
    if (p >= 1 && p <= pages && p !== page && !busy) onChange(p);
  };

  const prevDisabled = page <= 1 || busy;
  const nextDisabled = page >= pages || busy;

  return (
    <View style={styles.paginationBar}>
      <TouchableOpacity
        style={[styles.pageArrow, prevDisabled && styles.pageArrowDisabled]}
        onPress={() => goto(page - 1)}
        disabled={prevDisabled}
        activeOpacity={0.7}
      >
        <Ionicons
          name="chevron-back" size={18}
          color={prevDisabled ? T.textMuted : T.text}
        />
      </TouchableOpacity>

      <View style={styles.pageCenter}>
        <Text style={styles.pageCurrent}>
          Página <Text style={styles.pageCurrentBold}>{page}</Text> de{" "}
          <Text style={styles.pageCurrentBold}>{pages}</Text>
        </Text>
        <Text style={styles.pageTotal}>{total} usuarios en total</Text>
      </View>

      <TouchableOpacity
        style={[styles.pageArrow, nextDisabled && styles.pageArrowDisabled]}
        onPress={() => goto(page + 1)}
        disabled={nextDisabled}
        activeOpacity={0.7}
      >
        <Ionicons
          name="chevron-forward" size={18}
          color={nextDisabled ? T.textMuted : T.text}
        />
      </TouchableOpacity>
    </View>
  );
});

// ================================================================
// InfoRow / Section / Tab
// ================================================================
const InfoRow = ({ icon, label, value, last }) => (
  <View style={[styles.infoRow, !last && styles.infoRowBorder]}>
    <View style={styles.infoLeft}>
      <Ionicons name={icon} size={13} color={T.textMuted} />
      <Text style={styles.infoLabel}>{label}</Text>
    </View>
    <Text style={styles.infoValue} numberOfLines={2}>{value ?? "—"}</Text>
  </View>
);

const Section = ({ icon, title, children }) => (
  <View style={styles.section}>
    <View style={styles.sectionHeader}>
      <View style={styles.sectionIconWrap}>
        <Ionicons name={icon} size={13} color={T.primary} />
      </View>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
    <View style={styles.sectionBody}>{children}</View>
  </View>
);

const Tab = ({ active, icon, label, onPress }) => (
  <TouchableOpacity
    style={[styles.tabBtn, active && styles.tabBtnActive]}
    onPress={onPress}
    activeOpacity={0.7}
  >
    <Ionicons name={icon} size={13} color={active ? "#FFF" : T.textSub} />
    <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
  </TouchableOpacity>
);

// ================================================================
// Pantalla principal
// ================================================================
export default function ManageUsersScreen({ navigation }) {
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy]             = useState(false);
  const [buscando, setBuscando]     = useState(false);

  const [usuarios, setUsuarios] = useState([]);
  const [total, setTotal]       = useState(0);
  const [page, setPage]         = useState(1);
  const [pages, setPages]       = useState(1);
  const [error, setError]       = useState(null);

  const [filtroRol, setFiltroRol]         = useState("todos");
  const [busqueda, setBusqueda]           = useState("");
  const [busquedaDebounced, setBusquedaD] = useState("");

  const [item, setItem]           = useState(null);
  const [tab, setTab]             = useState("datos");
  const [form, setForm]           = useState({});
  const [guardando, setGuardando] = useState(false);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);

  const primeraCargaRef = useRef(true);
  const cacheRef = useRef({ key: "", data: null, serverPaginates: true });

  useEffect(() => {
    if (busqueda === busquedaDebounced) return;
    const t = setTimeout(() => setBusquedaD(busqueda.trim()), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [busqueda, busquedaDebounced]);

  const cargar = useCallback(
    async (targetPage = 1, { silent = false, searching = false } = {}) => {
      if (!silent) setBusy(true);
      if (searching) setBuscando(true);
      setError(null);

      const cacheKey = `${filtroRol}|${busquedaDebounced}`;
      const cache = cacheRef.current;

      if (cache.key === cacheKey && cache.data && cache.serverPaginates === false) {
        const full = cache.data;
        const totalF = full.length;
        const pagesF = Math.max(1, Math.ceil(full.length / PAGE_SIZE));
        const start = (targetPage - 1) * PAGE_SIZE;
        const lista = full.slice(start, start + PAGE_SIZE);

        setUsuarios(lista);
        setTotal(totalF);
        setPage(targetPage);
        setPages(pagesF);
        setLoading(false);
        setRefreshing(false);
        setBusy(false);
        setBuscando(false);
        primeraCargaRef.current = false;
        return;
      }

      const rolParaBackend =
        filtroRol !== "todos" ? (ROLE_TO_BACKEND[filtroRol] || filtroRol) : undefined;

      try { const res = await fetchAdminUsers({
          page: targetPage,
          limit: PAGE_SIZE,
          rol: rolParaBackend,
          q: busquedaDebounced || undefined,
        });
        const serverList = Array.isArray(res.usuarios) ? res.usuarios : [];
        const serverIgnoredLimit = serverList.length > PAGE_SIZE;
        if (__DEV__ && serverList[0]) {
          const u0 = serverList[0];
          console.log("🔎 [ManageUsers] Primer usuario recibido:", {
            id: u0.id,
            nombre: u0.nombre,
            genero: u0.genero,
            sexo: u0.sexo,
            tieneDirecciones: Array.isArray(u0.direcciones) ? u0.direcciones.length : "no array",
            tieneComplexion: !!u0.complexion,
            tieneIntereses: !!u0.intereses,
          });
        }

        if (serverIgnoredLimit) {
          cacheRef.current = { key: cacheKey, data: serverList, serverPaginates: false };

          const full = serverList;
          const totalF = full.length;
          const pagesF = Math.max(1, Math.ceil(full.length / PAGE_SIZE));
          const start = (targetPage - 1) * PAGE_SIZE;
          const lista = full.slice(start, start + PAGE_SIZE);

          setUsuarios(lista);
          setTotal(totalF);
          setPage(targetPage);
          setPages(pagesF);
        } else {
          cacheRef.current = { key: cacheKey, data: null, serverPaginates: true };

          setUsuarios(serverList);
          setTotal(res.total);
          setPage(res.page);
          setPages(res.pages);
        }
      } catch (e) {
        console.log("❌ Error cargando usuarios:", e.message, "| status:", e.status);
        if (e.status === 403) setError("No tienes permisos de administrador.");
        else if (e.status === 401) setError("Tu sesión expiró. Inicia sesión de nuevo.");
        else if (e.status === 0) setError("Sin conexión con el servidor.");
        else setError(e.message || "Error al cargar usuarios");
      } finally {
        setLoading(false);
        setRefreshing(false);
        setBusy(false);
        setBuscando(false);
        primeraCargaRef.current = false;
      }
    },
    [filtroRol, busquedaDebounced]
  );

  useEffect(() => {
    const esPrimera = primeraCargaRef.current;
    cargar(1, { searching: !esPrimera, silent: !esPrimera });
  }, [cargar]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    cacheRef.current = { key: "", data: null, serverPaginates: true };
    cargar(page, { silent: true });
  }, [cargar, page]);

  const irAPagina = useCallback((p) => cargar(p, { silent: true }), [cargar]);

  // ============================================================
  // ⭐ abrirModal — CORREGIDO
  //    Si el listado YA trae complexión/intereses/direcciones,
  //    NO pide detalle (evita perder los datos).
  // ============================================================
  const abrirModal = useCallback(async (u) => {
    // 1) Guardar el item COMPLETO del listado tal cual llegó
    setItem(u);
    setTab("datos");

    setForm({
      nombre: u.nombre || "",
      apellido_paterno: u.apellido_paterno || "",
      apellido_materno: u.apellido_materno || "",
      email: u.email || "",
      telefono: u.telefono || "",
      genero: getGeneroItem(u),
      fecha_nacimiento: normalizeFechaInput(u.fecha_nacimiento),
      rol: u.rol || "cliente",
      activo: u.activo !== false,
      password: "",
    });

    // ⭐ 2. Si el listado YA trae datos de detalle, no pedir nada más
    const yaTieneDetalle =
      isPresent(u?.complexion) ||
      isPresent(u?.intereses) ||
      (Array.isArray(u?.direcciones) && u.direcciones.length > 0);

    if (yaTieneDetalle) {
      if (__DEV__) {
        console.log("✅ [abrirModal] listado ya trae datos:", {
          complexion: isPresent(u?.complexion),
          intereses: isPresent(u?.intereses),
          direcciones: u?.direcciones?.length || 0,
        });
      }
      return;
    }

    // 3) Si NO trae datos, intentar pedir detalle fresco
    try {
      setCargandoDetalle(true);

      if (__DEV__) console.log("🔵 [abrirModal] listado vacío, pidiendo detalle para:", u.id);

      const full = await fetchAdminUserDetail(u.id);

      if (__DEV__) {
        console.log("🔵 [abrirModal] detalle recibido:", full);
      }

      if (!full) {
        if (__DEV__) console.warn("⚠️ [abrirModal] sin detalle, se queda con datos del listado");
        return;
      }

      // ⭐ 4. Merge DEFENSIVO: solo sobreescribe con campos presentes
      setItem((prev) => {
        const merged = { ...(prev || {}) };

        const keys = [
          "nombre", "apellido_paterno", "apellido_materno",
          "email", "telefono", "genero", "sexo", "rol",
          "email_confirmado", "fecha_registro", "ultimo_acceso",
          "foto", "fotoUrl",
        ];
        for (const k of keys) {
          if (isPresent(full[k])) merged[k] = full[k];
        }

        if (full.activo !== undefined) merged.activo = full.activo !== false;
        if (full.email_confirmado !== undefined) {
          merged.email_confirmado = full.email_confirmado !== false;
        }

        const fechaFuente = isPresent(full.fecha_nacimiento)
          ? full.fecha_nacimiento
          : merged.fecha_nacimiento;
        merged.fecha_nacimiento = normalizeFechaInput(fechaFuente) || null;

        // ⭐ Complexión/Intereses/Direcciones: SOLO sobreescribir si vienen con contenido
        if (isPresent(full.complexion)) merged.complexion = full.complexion;
        if (isPresent(full.intereses)) merged.intereses = full.intereses;
        if (Array.isArray(full.direcciones) && full.direcciones.length > 0) {
          merged.direcciones = full.direcciones;
        } else if (!Array.isArray(merged.direcciones)) {
          merged.direcciones = [];
        }

        return merged;
      });

      setForm((f) => ({
        ...f,
        genero: isPresent(full.genero) || isPresent(full.sexo) ? getGeneroItem(full) : f.genero,
        nombre: isPresent(full.nombre) ? full.nombre : f.nombre,
        apellido_paterno: isPresent(full.apellido_paterno) ? full.apellido_paterno : f.apellido_paterno,
        apellido_materno: isPresent(full.apellido_materno) ? full.apellido_materno : f.apellido_materno,
        email: isPresent(full.email) ? full.email : f.email,
        telefono: isPresent(full.telefono) ? full.telefono : f.telefono,
        fecha_nacimiento: isPresent(full.fecha_nacimiento)
          ? normalizeFechaInput(full.fecha_nacimiento)
          : f.fecha_nacimiento,
        rol: isPresent(full.rol) ? full.rol : f.rol,
        activo: full.activo !== undefined ? full.activo !== false : f.activo,
      }));
    } catch (e) {
      if (__DEV__) console.error("❌ [abrirModal] Error pidiendo detalle:", e);
    } finally {
      setCargandoDetalle(false);
    }
  }, []);

  const cerrarModal = useCallback(() => {
    setItem(null);
    setGuardando(false);
    setCargandoDetalle(false);
  }, []);

  // ============================================================
  // guardar
  // ============================================================
  const guardar = useCallback(async () => {
    if (!item) return;
    setGuardando(true);
    try {
      const payload = {
        nombre: form.nombre?.trim(),
        apellido_paterno: form.apellido_paterno?.trim(),
        apellido_materno: form.apellido_materno?.trim(),
        email: form.email?.trim(),
        telefono: form.telefono?.trim(),
        genero: form.genero || "Indefinido",
        fecha_nacimiento: form.fecha_nacimiento || undefined,
        activo: form.activo,
      };
      if (form.password && form.password.length >= 6) payload.password = form.password;

      if (__DEV__) console.log("🚀 [guardar] payload:", JSON.stringify(payload));

      const res = await updateAdminUser(item.id, payload);

      if (__DEV__) console.log("✅ [guardar] res:", JSON.stringify(res, null, 2));

      if (form.rol !== item.rol) {
        await changeUserRole(item.id, ROLE_TO_BACKEND[form.rol] || form.rol);
      }

      const actualizado = res?.usuario || res?.data || null;

      setUsuarios((prev) =>
        prev.map((u) =>
          u.id === item.id
            ? {
                ...u,
                ...(actualizado || payload),
                rol: form.rol || u.rol,
                genero: actualizado?.genero || form.genero,
                sexo: actualizado?.sexo || form.genero,
              }
            : u
        )
      );

      setItem((prev) =>
        prev
          ? {
              ...prev,
              ...(actualizado || payload),
              rol: form.rol || prev.rol,
              genero: actualizado?.genero || form.genero,
              sexo: actualizado?.sexo || form.genero,
            }
          : prev
      );

      cacheRef.current = { key: "", data: null, serverPaginates: true };
      cerrarModal();
      Alert.alert("✅ Listo", "Usuario actualizado");
    } catch (e) {
      Alert.alert("Error", e.message || "No se pudo actualizar");
    } finally {
      setGuardando(false);
    }
  }, [item, form, cerrarModal]);

  const toggleActivo = useCallback(
    async (u) => {
      try {
        await toggleAdminUser(u.id);
        cacheRef.current = { key: "", data: null, serverPaginates: true };
        await cargar(page, { silent: true });
      } catch (e) {
        Alert.alert("Error", e.message || "No se pudo cambiar el estado");
      }
    },
    [cargar, page]
  );

  const confirmarEliminar = useCallback(
    (u) => {
      RNAlert.alert(
        "Eliminar usuario",
        `¿Seguro que quieres eliminar a ${nombreCompleto(u)}?`,
        [
          { text: "Cancelar", style: "cancel" },
          {
            text: "Eliminar",
            style: "destructive",
            onPress: async () => {
              try {
                await deleteAdminUser(u.id);
                cacheRef.current = { key: "", data: null, serverPaginates: true };
                await cargar(page, { silent: true });
              } catch (e) {
                Alert.alert("Error", e.message || "No se pudo eliminar");
              }
            },
          },
        ]
      );
    },
    [cargar, page]
  );

  const renderUsuario = useCallback(
    ({ item: u }) => (
      <UserCard
        item={u}
        onPress={abrirModal}
        onToggle={toggleActivo}
        onDelete={confirmarEliminar}
      />
    ),
    [abrirModal, toggleActivo, confirmarEliminar]
  );

  const direccionesNorm = useMemo(
    () => (item?.direcciones || []).map(pickDir),
    [item]
  );

  const generoDetalle = useMemo(() => getGeneroItem(item), [item]);

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={T.primary} />
        <Text style={styles.loadingText}>Cargando usuarios…</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={20} color={T.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Usuarios</Text>
          <View style={styles.headerPill}>
            <View style={styles.headerPillDot} />
            <Text style={styles.headerPillText}>
              {total} {total === 1 ? "registrado" : "registrados"}
            </Text>
          </View>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* BUSCADOR */}
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={17} color={T.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por nombre o email"
          placeholderTextColor={T.textMuted}
          value={busqueda}
          onChangeText={setBusqueda}
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
        />
        {buscando ? (
          <ActivityIndicator size="small" color={T.primary} />
        ) : busqueda ? (
          <TouchableOpacity
            onPress={() => setBusqueda("")}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close-circle" size={17} color={T.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* FILTROS */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filtersContent}
        style={styles.filtersScroll}
      >
        {Object.entries(ROLE_META).map(([key, meta]) => {
          const active = filtroRol === key;
          return (
            <TouchableOpacity
              key={key}
              style={[
                styles.filtroBtn,
                active && {
                  backgroundColor: meta.color + "1A",
                  borderColor: meta.color + "55",
                },
              ]}
              onPress={() => setFiltroRol(key)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={meta.icon} size={12}
                color={active ? meta.color : T.textSub}
              />
              <Text style={[styles.filtroText, active && { color: meta.color }]}>
                {meta.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ERROR */}
      {error && (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle" size={18} color={T.danger} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => cargar(page, { silent: true })}>
            <Text style={styles.retryText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* LISTA */}
      <FlatList
        data={usuarios}
        keyExtractor={(i) => i.id}
        renderItem={renderUsuario}
        contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.primary} />
        }
        initialNumToRender={PAGE_SIZE}
        maxToRenderPerBatch={10}
        windowSize={7}
        removeClippedSubviews
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          !error && (
            <View style={styles.empty}>
              <View style={styles.emptyIconWrap}>
                <MaterialCommunityIcons
                  name="account-search-outline" size={40} color={T.textMuted}
                />
              </View>
              <Text style={styles.emptyTitle}>
                {busqueda || filtroRol !== "todos" ? "Sin coincidencias" : "Sin usuarios"}
              </Text>
              <Text style={styles.emptySubtitle}>
                {busqueda || filtroRol !== "todos"
                  ? "Prueba con otro término o cambia el filtro"
                  : "Aún no hay usuarios registrados"}
              </Text>
            </View>
          )
        }
      />

      {/* PAGINACIÓN */}
      <Pagination
        page={page}
        pages={pages}
        total={total}
        onChange={irAPagina}
        busy={busy}
      />

      {/* MODAL */}
      <Modal
        visible={!!item}
        transparent
        animationType="slide"
        onRequestClose={cerrarModal}
      >
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <View style={styles.modalGrabber} />

            <View style={styles.modalTitleRow}>
              <Text style={styles.modalTitle}>
                {tab === "datos" ? "Editar usuario" : "Detalles del usuario"}
              </Text>
              <TouchableOpacity
                onPress={cerrarModal}
                style={styles.modalClose}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={18} color={T.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.tabsRow}>
              <Tab
                active={tab === "datos"} icon="pencil" label="Editar"
                onPress={() => setTab("datos")}
              />
              <Tab
                active={tab === "detalles"} icon="information-circle-outline" label="Detalles"
                onPress={() => setTab("detalles")}
              />
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 20 }}
              keyboardShouldPersistTaps="handled"
            >
              {tab === "datos" ? (
                <>
                  <Text style={styles.fieldLabel}>Nombre</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={form.nombre}
                    onChangeText={(v) => setForm((f) => ({ ...f, nombre: v }))}
                    placeholderTextColor={T.textMuted}
                    placeholder="—"
                  />

                  <Text style={styles.fieldLabel}>Apellido Paterno</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={form.apellido_paterno}
                    onChangeText={(v) => setForm((f) => ({ ...f, apellido_paterno: v }))}
                    placeholderTextColor={T.textMuted}
                    placeholder="—"
                  />

                  <Text style={styles.fieldLabel}>Apellido Materno</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={form.apellido_materno}
                    onChangeText={(v) => setForm((f) => ({ ...f, apellido_materno: v }))}
                    placeholderTextColor={T.textMuted}
                    placeholder="—"
                  />

                  <Text style={styles.fieldLabel}>Email</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={form.email}
                    onChangeText={(v) => setForm((f) => ({ ...f, email: v }))}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    placeholderTextColor={T.textMuted}
                    placeholder="—"
                  />

                  <Text style={styles.fieldLabel}>Teléfono</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={form.telefono}
                    onChangeText={(v) => setForm((f) => ({ ...f, telefono: v }))}
                    keyboardType="phone-pad"
                    placeholderTextColor={T.textMuted}
                    placeholder="—"
                  />

                  <Text style={styles.fieldLabel}>Fecha de nacimiento (YYYY-MM-DD)</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={form.fecha_nacimiento}
                    onChangeText={(v) => setForm((f) => ({ ...f, fecha_nacimiento: v }))}
                    placeholder="1990-01-15"
                    placeholderTextColor={T.textMuted}
                  />

                  <Text style={styles.fieldLabel}>Género</Text>
                  <View style={styles.chipsRow}>
                    {GENEROS.map((g) => {
                      const active = form.genero === g.value;
                      return (
                        <TouchableOpacity
                          key={g.value}
                          style={[styles.chipBtn, active && styles.chipBtnActive]}
                          onPress={() =>
                            setForm((f) => ({ ...f, genero: g.value }))
                          }
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.chipText, active && styles.chipTextActive]}>
                            {g.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <Text style={styles.fieldLabel}>Rol</Text>
                  <View style={styles.rolesRow}>
                    {["cliente", "vendedor", "admin"].map((r) => {
                      const active = form.rol === r;
                      const c = ROLE_COLORS[r];
                      const meta = ROLE_META[r];
                      return (
                        <TouchableOpacity
                          key={r}
                          style={[
                            styles.rolBtn,
                            active && { backgroundColor: c + "1F", borderColor: c + "66" },
                          ]}
                          onPress={() => setForm((f) => ({ ...f, rol: r }))}
                          activeOpacity={0.7}
                        >
                          <Ionicons
                            name={meta.icon} size={13}
                            color={active ? c : T.textSub}
                          />
                          <Text style={[styles.rolText, active && { color: c }]}>
                            {r.charAt(0).toUpperCase() + r.slice(1)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <View style={styles.switchRow}>
                    <View style={styles.switchLeft}>
                      <View
                        style={[
                          styles.switchIcon,
                          {
                            backgroundColor: form.activo
                              ? T.success + "1A"
                              : T.danger + "1A",
                          },
                        ]}
                      >
                        <Ionicons
                          name={form.activo ? "checkmark-circle" : "close-circle"}
                          size={14}
                          color={form.activo ? T.success : T.danger}
                        />
                      </View>
                      <Text style={styles.switchLabel}>
                        {form.activo ? "Usuario activo" : "Usuario inactivo"}
                      </Text>
                    </View>
                    <Switch
                      value={form.activo}
                      onValueChange={(v) => setForm((f) => ({ ...f, activo: v }))}
                      trackColor={{ false: T.surface3, true: T.primary + "AA" }}
                      thumbColor="#FFF"
                    />
                  </View>

                  <Text style={styles.fieldLabel}>Nueva contraseña (opcional)</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={form.password}
                    onChangeText={(v) => setForm((f) => ({ ...f, password: v }))}
                    secureTextEntry
                    placeholder="Dejar vacío para no cambiar"
                    placeholderTextColor={T.textMuted}
                  />
                </>
              ) : (
                <>
                  <View style={styles.detalleHeader}>
                    <Avatar
                      item={item || {}}
                      color={ROLE_COLORS[item?.rol] || T.textSub}
                      size={84}
                    />
                    <Text style={styles.detalleNombre}>
                      {nombreCompleto(item || {})}
                    </Text>
                    <Text style={styles.detalleEmail}>{item?.email || "—"}</Text>
                    <View
                      style={[
                        styles.detalleRolBadge,
                        {
                          backgroundColor: (ROLE_COLORS[item?.rol] || T.textSub) + "1A",
                          borderColor: (ROLE_COLORS[item?.rol] || T.textSub) + "40",
                        },
                      ]}
                    >
                      <Ionicons
                        name={ROLE_META[item?.rol]?.icon || "person"}
                        size={11}
                        color={ROLE_COLORS[item?.rol] || T.textSub}
                      />
                      <Text
                        style={[
                          styles.detalleRolText,
                          { color: ROLE_COLORS[item?.rol] || T.textSub },
                        ]}
                      >
                        {String(item?.rol || "").toUpperCase()}
                      </Text>
                    </View>
                  </View>

                  <Section icon="person-outline" title="Información personal">
                    <InfoRow icon="id-card-outline" label="ID" value={item?.id} />
                    <InfoRow icon="person-outline" label="Nombre" value={item?.nombre} />
                    <InfoRow
                      icon="people-outline" label="Apellido Paterno"
                      value={item?.apellido_paterno}
                    />
                    <InfoRow
                      icon="people-outline" label="Apellido Materno"
                      value={item?.apellido_materno}
                    />
                    <InfoRow icon="mail-outline" label="Email" value={item?.email} />
                    <InfoRow icon="call-outline" label="Teléfono" value={item?.telefono} />
                    <InfoRow
                      icon="male-female-outline" label="Género"
                      value={generoDetalle}
                    />
                    <InfoRow
                      icon="calendar-outline" label="Fecha nacimiento"
                      value={fmtFecha(item?.fecha_nacimiento)}
                      last
                    />
                  </Section>

                  <Section icon="shield-checkmark-outline" title="Estado y acceso">
                    <InfoRow
                      icon="checkmark-circle-outline" label="Activo"
                      value={item?.activo ? "Sí" : "No"}
                    />
                    <InfoRow
                      icon="mail-unread-outline" label="Email confirmado"
                      value={item?.email_confirmado ? "Sí" : "No"}
                    />
                    <InfoRow
                      icon="calendar-outline" label="Fecha de registro"
                      value={fmtFecha(getFechaRegistro(item))}
                    />
                    <InfoRow
                      icon="time-outline" label="Último acceso"
                      value={fmtFechaHora(getUltimoAcceso(item))}
                      last
                    />
                  </Section>

                  <Section
                    icon="location-outline"
                    title={`Direcciones · ${direccionesNorm.length}`}
                  >
                    {cargandoDetalle && direccionesNorm.length === 0 ? (
                      <View style={{ paddingVertical: 14, alignItems: "center" }}>
                        <ActivityIndicator size="small" color={T.primary} />
                        <Text style={[styles.emptySection, { marginTop: 8 }]}>
                          Cargando direcciones…
                        </Text>
                      </View>
                    ) : direccionesNorm.length === 0 ? (
                      <Text style={styles.emptySection}>
                        Sin direcciones registradas
                      </Text>
                    ) : (
                      direccionesNorm.map((d, i) => (
                        <View
                          key={d.id ?? i}
                          style={[
                            styles.detalleCard,
                            i === direccionesNorm.length - 1 && { marginBottom: 0 },
                          ]}
                        >
                          <View style={styles.detalleCardHeader}>
                            <Ionicons
                              name={d.predeterminada ? "star" : "location"}
                              size={13}
                              color={d.predeterminada ? T.vendedor : T.primary}
                            />
                            <Text style={styles.detalleCardTitle} numberOfLines={1}>
                              {d.nombre || `Dirección ${i + 1}`}
                            </Text>
                            {d.predeterminada ? (
                              <View style={styles.predeterminadaBadge}>
                                <Text style={styles.predeterminadaText}>Principal</Text>
                              </View>
                            ) : null}
                          </View>

                          <Text style={styles.detalleCardText}>
                            {[d.calle, d.numero].filter(Boolean).join(" ")}
                            {d.numero_interior ? ` int. ${d.numero_interior}` : ""}
                            {d.colonia ? `, ${d.colonia}` : ""}
                            {d.cp ? `, CP ${d.cp}` : ""}
                          </Text>

                          {(d.ciudad || d.estado) && (
                            <Text style={styles.detalleCardText}>
                              {[d.ciudad, d.estado].filter(Boolean).join(", ")}
                              {d.pais ? `, ${d.pais}` : ""}
                            </Text>
                          )}

                          {d.telefono ? (
                            <Text style={styles.detalleCardText}>
                              Tel: {d.telefono}
                            </Text>
                          ) : null}

                          {d.referencias ? (
                            <Text style={styles.detalleCardText}>
                              Ref: {d.referencias}
                            </Text>
                          ) : null}
                        </View>
                      ))
                    )}
                  </Section>

                  <Section icon="body-outline" title="Complexión">
                    {!item?.complexion ? (
                      <Text style={styles.emptySection}>
                        Sin datos de complexión
                      </Text>
                    ) : (
                      <View style={styles.chipGrid}>
                        {item.complexion.altura_cm && (
                          <View style={styles.infoChip}>
                            <Text style={styles.infoChipLabel}>Altura</Text>
                            <Text style={styles.infoChipValue}>
                              {item.complexion.altura_cm} cm
                            </Text>
                          </View>
                        )}
                        {item.complexion.peso_kg && (
                          <View style={styles.infoChip}>
                            <Text style={styles.infoChipLabel}>Peso</Text>
                            <Text style={styles.infoChipValue}>
                              {item.complexion.peso_kg} kg
                            </Text>
                          </View>
                        )}
                        {item.complexion.complexion && (
                          <View style={styles.infoChip}>
                            <Text style={styles.infoChipLabel}>Tipo</Text>
                            <Text style={styles.infoChipValue}>
                              {item.complexion.complexion}
                            </Text>
                          </View>
                        )}
                        {item.complexion.talla_camisa && (
                          <View style={styles.infoChip}>
                            <Text style={styles.infoChipLabel}>Camisa</Text>
                            <Text style={styles.infoChipValue}>
                              {item.complexion.talla_camisa}
                            </Text>
                          </View>
                        )}
                        {item.complexion.talla_pantalon && (
                          <View style={styles.infoChip}>
                            <Text style={styles.infoChipLabel}>Pantalón</Text>
                            <Text style={styles.infoChipValue}>
                              {item.complexion.talla_pantalon}
                            </Text>
                          </View>
                        )}
                        {item.complexion.talla_calzado && (
                          <View style={styles.infoChip}>
                            <Text style={styles.infoChipLabel}>Calzado</Text>
                            <Text style={styles.infoChipValue}>
                              {item.complexion.talla_calzado}
                            </Text>
                          </View>
                        )}
                        {item.complexion.talla_sujetador && (
                          <View style={styles.infoChip}>
                            <Text style={styles.infoChipLabel}>Sujetador</Text>
                            <Text style={styles.infoChipValue}>
                              {item.complexion.talla_sujetador}
                            </Text>
                          </View>
                        )}
                      </View>
                    )}
                  </Section>

                  <Section icon="heart-outline" title="Intereses">
                    {!item?.intereses ? (
                      <Text style={styles.emptySection}>
                        Sin intereses registrados
                      </Text>
                    ) : (
                      <View style={{ gap: 14 }}>
                        {item.intereses.frecuencia && (
                          <View style={styles.interesRow}>
                            <Text style={styles.interesLabel}>Frecuencia</Text>
                            <Text style={styles.interesValue}>
                              {item.intereses.frecuencia}
                            </Text>
                          </View>
                        )}
                        {["categorias", "marcas", "actividades", "ocasiones"].map((k) =>
                          Array.isArray(item.intereses[k]) && item.intereses[k].length > 0 ? (
                            <View key={k}>
                              <Text style={styles.interesLabel}>{k}</Text>
                              <View style={styles.tagWrap}>
                                {item.intereses[k].map((v, i) => (
                                  <View key={i} style={styles.tag}>
                                    <Text style={styles.tagText}>{v}</Text>
                                  </View>
                                ))}
                              </View>
                            </View>
                          ) : null
                        )}
                      </View>
                    )}
                  </Section>
                </>
              )}
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalCancel]}
                onPress={cerrarModal}
                activeOpacity={0.7}
              >
                <Text style={styles.modalBtnText}>
                  {tab === "datos" ? "Cancelar" : "Cerrar"}
                </Text>
              </TouchableOpacity>
              {tab === "datos" && (
                <TouchableOpacity
                  style={[
                    styles.modalBtn, styles.modalSave,
                    guardando && { opacity: 0.6 },
                  ]}
                  onPress={guardar}
                  disabled={guardando}
                  activeOpacity={0.8}
                >
                  {guardando ? (
                    <ActivityIndicator color="#FFF" size="small" />
                  ) : (
                    <>
                      <Ionicons name="checkmark" size={16} color="#FFF" />
                      <Text style={styles.modalBtnText}>Guardar</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ================================================================
// Estilos
// ================================================================
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.bg },
  center: { justifyContent: "center", alignItems: "center" },
  loadingText: { color: T.textSub, marginTop: 14, fontSize: 13, fontWeight: "500" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "android" ? 16 : 6,
    paddingBottom: 16,
    backgroundColor: T.bg,
    borderBottomWidth: 1,
    borderColor: T.borderSoft,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: T.surface,
    borderWidth: 1, borderColor: T.border,
    alignItems: "center", justifyContent: "center",
  },
  headerCenter: { flex: 1, alignItems: "center" },
  headerTitle: { color: T.text, fontSize: 17, fontWeight: "700", letterSpacing: 0.2 },
  headerPill: {
    flexDirection: "row", alignItems: "center", gap: 5, marginTop: 4,
    paddingHorizontal: 8, paddingVertical: 2,
    backgroundColor: T.surface, borderRadius: 20,
    borderWidth: 1, borderColor: T.borderSoft,
  },
  headerPillDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: T.success },
  headerPillText: {
    color: T.textSub, fontSize: 10, fontWeight: "600", letterSpacing: 0.2,
  },

  searchWrap: {
    flexDirection: "row", alignItems: "center",
    marginHorizontal: 16, marginTop: 14,
    paddingHorizontal: 14,
    backgroundColor: T.surface, borderRadius: 12,
    borderWidth: 1, borderColor: T.border,
    gap: 10, height: 44,
  },
  searchInput: { flex: 1, color: T.text, fontSize: 14, paddingVertical: 0 },

  filtersScroll: { maxHeight: 44, marginTop: 12, marginBottom: 4 },
  filtersContent: { paddingHorizontal: 16, gap: 8, alignItems: "center" },
  filtroBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 14, height: 34, borderRadius: 20,
    backgroundColor: T.surface, borderWidth: 1, borderColor: T.border,
  },
  filtroText: { color: T.textSub, fontSize: 12, fontWeight: "700", letterSpacing: 0.1 },

  errorBox: {
    flexDirection: "row", alignItems: "center", gap: 10,
    marginHorizontal: 16, marginTop: 12, padding: 12,
    borderRadius: 12, backgroundColor: T.danger + "14",
    borderWidth: 1, borderColor: T.danger + "40",
  },
  errorText: { color: "#FCA5A5", flex: 1, fontSize: 13 },
  retryText: { color: T.text, fontWeight: "700", fontSize: 13 },

  card: {
    backgroundColor: T.surface,
    borderWidth: 1, borderColor: T.border,
    borderRadius: 16, marginBottom: 10, overflow: "hidden",
  },
  cardHeader: { flexDirection: "row", alignItems: "center", padding: 14 },
  cardInfo: { flex: 1, marginLeft: 12, marginRight: 8 },
  cardName: { color: T.text, fontSize: 15, fontWeight: "700", letterSpacing: 0.1 },
  cardMetaRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 3 },
  cardMeta: { color: T.textSub, fontSize: 12, flex: 1, fontWeight: "500" },
  cardRight: { alignItems: "flex-end" },
  roleBadge: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 8, borderWidth: 1,
  },
  roleDot: { width: 5, height: 5, borderRadius: 3 },
  roleBadgeText: { fontSize: 9, fontWeight: "800", letterSpacing: 0.6 },

  cardDivider: { height: 1, backgroundColor: T.borderSoft, marginHorizontal: 14 },
  cardFooter: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 14, paddingVertical: 10, gap: 6,
  },
  statusPill: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
  },
  statusOn: { backgroundColor: T.success + "14" },
  statusOff: { backgroundColor: T.danger + "14" },
  statusDot: { width: 5, height: 5, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: "700", letterSpacing: 0.1 },

  iconBtn: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: T.surface2,
    borderWidth: 1, borderColor: T.border,
    alignItems: "center", justifyContent: "center",
  },
  iconBtnDanger: {
    backgroundColor: T.danger + "10",
    borderColor: T.danger + "30",
  },

  avatar: {
    justifyContent: "center", alignItems: "center",
    backgroundColor: T.surface2, overflow: "hidden",
  },
  avatarText: { fontWeight: "800", letterSpacing: 0.3 },

  empty: { alignItems: "center", paddingVertical: 70 },
  emptyIconWrap: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: T.surface,
    borderWidth: 1, borderColor: T.border,
    alignItems: "center", justifyContent: "center",
    marginBottom: 16,
  },
  emptyTitle: { color: T.text, fontSize: 15, fontWeight: "700" },
  emptySubtitle: {
    color: T.textMuted, fontSize: 12, marginTop: 6,
    textAlign: "center", maxWidth: 220, lineHeight: 17,
  },
  emptySection: {
    color: T.textMuted, fontSize: 13,
    fontStyle: "italic", paddingVertical: 4,
  },

  paginationBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: T.bg,
    borderTopWidth: 1,
    borderColor: T.borderSoft,
    gap: 12,
  },
  pageArrow: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
    alignItems: "center",
    justifyContent: "center",
  },
  pageArrowDisabled: { opacity: 0.35 },
  pageCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  pageCurrent: {
    color: T.textSub,
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  pageCurrentBold: {
    color: T.text,
    fontWeight: "800",
    fontSize: 14,
  },
  pageTotal: {
    color: T.textMuted,
    fontSize: 10,
    fontWeight: "600",
    marginTop: 3,
    letterSpacing: 0.2,
  },

  modalBg: { flex: 1, backgroundColor: "#000000D9", justifyContent: "flex-end" },
  modalCard: {
    backgroundColor: T.surface,
    borderTopLeftRadius: 22, borderTopRightRadius: 22,
    borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1,
    borderColor: T.border,
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 20,
    maxHeight: "92%",
  },
  modalGrabber: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: T.border, alignSelf: "center", marginBottom: 14,
  },
  modalTitleRow: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", marginBottom: 14,
  },
  modalTitle: { color: T.text, fontSize: 17, fontWeight: "700", letterSpacing: 0.2 },
  modalClose: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: T.surface2,
    borderWidth: 1, borderColor: T.border,
    alignItems: "center", justifyContent: "center",
  },

  tabsRow: {
    flexDirection: "row", gap: 4, marginBottom: 18,
    backgroundColor: T.bg, padding: 4, borderRadius: 12,
    borderWidth: 1, borderColor: T.borderSoft,
  },
  tabBtn: {
    flex: 1, paddingVertical: 9, borderRadius: 9,
    alignItems: "center", justifyContent: "center",
    flexDirection: "row", gap: 6,
  },
  tabBtnActive: { backgroundColor: T.primary },
  tabText: { color: T.textSub, fontSize: 13, fontWeight: "700" },
  tabTextActive: { color: "#FFF" },

  fieldLabel: {
    color: T.textSub, fontSize: 11, fontWeight: "700",
    letterSpacing: 0.3, textTransform: "uppercase",
    marginTop: 14, marginBottom: 6,
  },
  fieldInput: {
    backgroundColor: T.bg, color: T.text,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    borderWidth: 1, borderColor: T.border, fontSize: 14,
  },
  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chipBtn: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: T.bg, borderWidth: 1, borderColor: T.border,
  },
  chipBtnActive: {
    backgroundColor: T.primary + "1A",
    borderColor: T.primary + "60",
  },
  chipText: { color: T.textSub, fontSize: 12, fontWeight: "600" },
  chipTextActive: { color: "#C4B5FD", fontWeight: "700" },

  rolesRow: { flexDirection: "row", gap: 8 },
  rolBtn: {
    flex: 1, paddingVertical: 11, borderRadius: 12,
    backgroundColor: T.bg,
    borderWidth: 1, borderColor: T.border,
    alignItems: "center", justifyContent: "center",
    flexDirection: "row", gap: 6,
  },
  rolText: { color: T.textSub, fontSize: 12, fontWeight: "700" },

  switchRow: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", marginTop: 20, paddingVertical: 4,
  },
  switchLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  switchIcon: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: "center", justifyContent: "center",
  },
  switchLabel: { color: T.textSub, fontSize: 13, fontWeight: "600" },

  detalleHeader: {
    alignItems: "center", paddingVertical: 22,
    borderBottomWidth: 1, borderColor: T.borderSoft, marginBottom: 6,
  },
  detalleNombre: {
    color: T.text, fontSize: 20, fontWeight: "800",
    marginTop: 14, textAlign: "center", letterSpacing: 0.2,
  },
  detalleEmail: { color: T.textSub, fontSize: 13, marginTop: 5, fontWeight: "500" },
  detalleRolBadge: {
    flexDirection: "row", alignItems: "center", gap: 5,
    marginTop: 12, paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: 20, borderWidth: 1,
  },
  detalleRolText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.8 },

  section: { marginTop: 22 },
  sectionHeader: {
    flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10,
  },
  sectionIconWrap: {
    width: 22, height: 22, borderRadius: 6,
    backgroundColor: T.primary + "1A",
    alignItems: "center", justifyContent: "center",
  },
  sectionTitle: {
    color: T.text, fontSize: 11, fontWeight: "800",
    letterSpacing: 1, textTransform: "uppercase",
  },
  sectionBody: {
    backgroundColor: T.bg, borderRadius: 12,
    borderWidth: 1, borderColor: T.borderSoft,
    paddingHorizontal: 12, paddingVertical: 4,
  },

  infoRow: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", paddingVertical: 10, gap: 12,
  },
  infoRowBorder: { borderBottomWidth: 1, borderColor: T.borderSoft },
  infoLeft: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  infoLabel: { color: T.textSub, fontSize: 12, fontWeight: "600" },
  infoValue: {
    color: T.text, fontSize: 12, fontWeight: "600",
    maxWidth: "60%", textAlign: "right",
  },

  chipGrid: {
    flexDirection: "row", flexWrap: "wrap", gap: 8, paddingVertical: 8,
  },
  infoChip: {
    minWidth: 90, backgroundColor: T.surface,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1, borderColor: T.borderSoft,
  },
  infoChipLabel: {
    color: T.textMuted, fontSize: 9, fontWeight: "800",
    textTransform: "uppercase", letterSpacing: 0.6,
  },
  infoChipValue: {
    color: T.text, fontSize: 14, fontWeight: "700", marginTop: 3,
  },

  detalleCard: {
    backgroundColor: T.surface, borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: T.borderSoft,
    marginBottom: 8, marginTop: 8,
  },
  detalleCardHeader: {
    flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6,
  },
  detalleCardTitle: { color: T.text, fontSize: 13, fontWeight: "700", flex: 1 },
  detalleCardText: {
    color: T.textSub, fontSize: 12, marginTop: 2, fontWeight: "500",
  },
  predeterminadaBadge: {
    backgroundColor: T.vendedor + "1A",
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6,
    borderWidth: 1, borderColor: T.vendedor + "40",
  },
  predeterminadaText: {
    color: T.vendedor, fontSize: 9, fontWeight: "800", letterSpacing: 0.3,
  },

  interesRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
  },
  interesLabel: {
    color: T.textMuted, fontSize: 10, fontWeight: "800",
    textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 6,
  },
  interesValue: { color: T.text, fontSize: 13, fontWeight: "700" },
  tagWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  tag: {
    backgroundColor: T.primary + "1A",
    borderWidth: 1, borderColor: T.primary + "40",
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
  },
  tagText: { color: "#C4B5FD", fontSize: 11, fontWeight: "700" },

  modalActions: { flexDirection: "row", gap: 10, marginTop: 18 },
  modalBtn: {
    flex: 1, paddingVertical: 13, borderRadius: 12,
    alignItems: "center", justifyContent: "center",
    flexDirection: "row", gap: 6,
  },
  modalCancel: {
    backgroundColor: T.surface2,
    borderWidth: 1, borderColor: T.border,
  },
  modalSave: { backgroundColor: T.primary },
  modalBtnText: {
    color: T.text, fontWeight: "700", fontSize: 14, letterSpacing: 0.2,
  },
});