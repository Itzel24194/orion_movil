import React, { useState, useEffect } from 'react';
import { StyleSheet, View, TouchableOpacity, ScrollView, Image, ActivityIndicator } from 'react-native';
import { Text, TextInput, Alert } from '../i18n/ui';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

import { fetchProducts, createProduct, updateProduct, deleteProduct } from '../services/api';

export default function AdminPanel() {
  
  // 1. ESTADOS PRINCIPALES
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);

  // 2. ESTADOS PARA EL FORMULARIO
  const [idEditando, setIdEditando] = useState(null);
  const [nombre, setNombre] = useState('');
  const [categoria, setCategoria] = useState('Calzado');
  const [precio, setPrecio] = useState('');
  const [estado, setEstado] = useState('Activo');
  const [stock, setStock] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [imagenCargada, setImagenCargada] = useState(null);

  // ==========================================
  // CARGAR INVENTARIO DESDE EL BACKEND (MongoDB)
  // ==========================================
  const cargarProductos = async () => {
    try {
      const lista = (await fetchProducts()).map(p => ({
        ...p,
        image: p.image,
        createdAtStr: 'Sin fecha',
      }));
      setProductos(lista);
    } catch (error) {
      console.log("Error al leer productos:", error);
      Alert.alert("Error", "No se pudo sincronizar el inventario.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargarProductos(); }, []);

  // ==========================================
  // OBTENER IMAGEN DESDE LA GALERÍA EL CELULAR
  // ==========================================
  const seleccionarImagen = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert('Permiso denegado', 'Se necesitan permisos para acceder a tus fotos.');
      return;
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled) {
      setImagenCargada(result.assets[0].uri);
    }
  };

  const limpiarFormulario = () => {
    setIdEditando(null);
    setNombre('');
    setCategoria('Calzado');
    setPrecio('');
    setEstado('Activo');
    setStock('');
    setDescripcion('');
    setVideoUrl('');
    setImagenCargada(null);
  };

  // ==========================================
  // GUARDAR / ACTUALIZAR EN EL BACKEND
  // ==========================================
  const guardarProducto = async () => {
    if (!nombre || !precio || !stock) {
      Alert.alert("Campos obligatorios", "Por favor llena Nombre, Precio y Stock.");
      return;
    }

    if (videoUrl.trim() && !/^https:\/\/[^\s]+\.mp4(\?[^\s]*)?$/i.test(videoUrl.trim())) {
      Alert.alert('Video no válido', 'Usa una URL HTTPS directa a un archivo .mp4.');
      return;
    }
    const fotoFinal = imagenCargada || 'https://via.placeholder.com/200';
    
    // Datos base que se enviarán al backend
    const datosProducto = {
      name: nombre,
      category: categoria,
      price: precio,
      status: estado,
      stock: parseInt(stock) || 0,
      description: descripcion,
      videoUrl: videoUrl.trim(),
      image: fotoFinal,
    };

    try {
      if (idEditando) {
        // MODO: EDITAR
        await updateProduct(idEditando, datosProducto);
        Alert.alert("Éxito", "Producto actualizado en la nube.");
      } else {
        // MODO: CREAR
        await createProduct(datosProducto);
        Alert.alert("Éxito", "Producto registrado en el sistema.");
      }
      limpiarFormulario();
      cargarProductos();
    } catch (error) {
      console.log("Error al guardar:", error);
      Alert.alert("Error", "Hubo un problema al guardar los cambios.");
    }
  };

  // ==========================================
  // PREPARAR DATOS EN EL FORMULARIO PARA EDITAR
  // ==========================================
  const editarProducto = (item) => {
    setIdEditando(item.id);
    setNombre(item.name);
    setCategoria(item.category);
    setPrecio(item.price);
    setEstado(item.status || 'Activo');
    setStock(String(item.stock));
    setDescripcion(item.description);
    setVideoUrl(item.videoUrl || '');
    setImagenCargada(item.image);
  };

  // ==========================================
  // ELIMINAR EN EL BACKEND
  // ==========================================
  const eliminarProducto = (id) => {
    Alert.alert(
      "Eliminar Producto",
      "¿Estás seguro de que quieres borrar este producto permanentemente de la base de datos?",
      [
        { text: "Cancelar", style: "cancel" },
        { 
          text: "Eliminar", 
          style: "destructive",
          onPress: async () => {
            try {
              await deleteProduct(id);
              cargarProductos();
              Alert.alert("Eliminado", "El producto ha sido eliminado.");
              if (idEditando === id) limpiarFormulario();
            } catch (error) {
              console.log("Error al eliminar:", error);
              Alert.alert("Error", "No se pudo borrar el producto.");
            }
          }
        }
      ]
    );
  };

  // Cálculos dinámicos de estadísticas basados en la base de datos
  const totalProductos = productos.length;
  const totalStock = productos.reduce((acc, item) => acc + (item.stock || 0), 0);
  const productosAgotados = productos.filter(item => item.status === 'Agotado' || item.stock === 0).length;

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#7C3AED" />
        <Text style={{ color: '#94A3B8', marginTop: 15 }}>Sincronizando inventario...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Panel Admin</Text>
      <Text style={styles.subtitle}>Gestión de Inventario en Tiempo Real</Text>

      {/* Tarjetas de Estadísticas */}
      <View style={styles.dashboard}>
        <View style={styles.statCard}>
          <Ionicons name="cube" size={20} color="#6366F1" />
          <Text style={styles.statNumber}>{totalProductos}</Text>
          <Text style={styles.statText}>Items</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="file-tray-full" size={20} color="#22C55E" />
          <Text style={styles.statNumber}>{totalStock}</Text>
          <Text style={styles.statText}>Tot. Stock</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="alert-circle" size={20} color="#DC2626" />
          <Text style={styles.statNumber}>{productosAgotados}</Text>
          <Text style={styles.statText}>Agotados</Text>
        </View>
      </View>

      {/* Formulario de Registro / Edición */}
      <View style={{ backgroundColor: '#0f172a', padding: 15, borderRadius: 20, marginBottom: 25, borderWidth: 1, borderColor: '#1e293b' }}>
        <Text style={[styles.sectionTitle, { marginTop: 0 }]}>
          {idEditando ? "📝 Editar Producto" : "➕ Agregar Producto"}
        </Text>

        <Text style={styles.label}>Nombre del Producto *</Text>
        <TextInput 
          style={styles.input} 
          placeholder="Ej. Tenis Nike Air" 
          placeholderTextColor="#64748B"
          value={nombre}
          onChangeText={setNombre}
        />

        <Text style={styles.label}>Categoría</Text>
        <View style={{ flexDirection: 'row', marginBottom: 15 }}>
          {['Calzado', 'Ropa', 'Accesorios'].map((cat) => (
            <TouchableOpacity 
              key={cat} 
              style={[styles.categoryButton, categoria === cat && styles.categoryActive]}
              onPress={() => setCategoria(cat)}
            >
              <Text style={styles.categoryText}>{cat}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ flexDirection: 'row', gap: 15 }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Precio ($) *</Text>
            <TextInput 
              style={styles.input} 
              placeholder="99.99" 
              placeholderTextColor="#64748B"
              keyboardType="numeric"
              value={precio}
              onChangeText={setPrecio}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Stock Disponible *</Text>
            <TextInput 
              style={styles.input} 
              placeholder="10" 
              placeholderTextColor="#64748B"
              keyboardType="numeric"
              value={stock}
              onChangeText={setStock}
            />
          </View>
        </View>

        <Text style={styles.label}>Estado del Artículo</Text>
        <View style={styles.statusContainer}>
          <TouchableOpacity 
            style={[styles.statusButton, estado === 'Activo' && styles.activeStatus]}
            onPress={() => setEstado('Activo')}
          >
            <Text style={styles.statusText}>Activo</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.statusButton, estado === 'Agotado' && styles.outStatus]}
            onPress={() => setEstado('Agotado')}
          >
            <Text style={styles.statusText}>Agotado</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>Imagen del Producto</Text>
        <TouchableOpacity style={styles.imageButton} onPress={seleccionarImagen}>
          <Ionicons name="image" size={22} color="#FFF" />
          <Text style={styles.buttonText}>
            {imagenCargada ? "Cambiar Imagen" : "Subir Foto desde Galería"}
          </Text>
        </TouchableOpacity>

        {imagenCargada ? (
          <Image source={{ uri: imagenCargada }} style={styles.preview} />
        ) : null}

        <Text style={styles.label}>Video del producto (HTTPS .mp4, opcional)</Text>
        <TextInput style={styles.input} placeholder="https://misitio.com/video.mp4" placeholderTextColor="#64748B" value={videoUrl} onChangeText={setVideoUrl} autoCapitalize="none" />
        <Text style={styles.label}>Descripción</Text>
        <TextInput 
          style={[styles.input, styles.descriptionInput]} 
          placeholder="Escribe detalles del producto..." 
          placeholderTextColor="#64748B"
          multiline
          value={descripcion}
          onChangeText={setDescripcion}
        />

        <TouchableOpacity style={styles.saveButton} onPress={guardarProducto}>
          <Ionicons name="checkmark-circle" size={22} color="#FFF" />
          <Text style={styles.buttonText}>{idEditando ? "Actualizar Cambios" : "Guardar Producto"}</Text>
        </TouchableOpacity>

        {idEditando && (
          <TouchableOpacity 
            style={[styles.saveButton, { backgroundColor: '#475569', marginTop: -10 }]} 
            onPress={limpiarFormulario}
          >
            <Text style={styles.buttonText}>Cancelar Edición</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Renderizado de la lista */}
      <Text style={styles.sectionTitle}>Listado de Inventario ({productos.length})</Text>
      
      {productos.map((item) => (
        <View key={item.id} style={styles.card}>
          <Image source={{ uri: item.image }} style={styles.productImage} />

          <View style={styles.infoContainer}>
            <Text style={styles.productName}>{item.name}</Text>
            <Text style={styles.productCategory}>{item.category}</Text>

            <View style={styles.row}>
              <Text style={styles.price}>${item.price}</Text>
              <Text style={[
                styles.status,
                item.status === "Activo" ? styles.statusActive : styles.statusOut
              ]}>
                {item.status || "Activo"}
              </Text>
            </View>

            <Text style={styles.stock}>Stock disponible: {item.stock || 0}</Text>
            <Text style={styles.description}>{item.description}</Text>
            <Text style={styles.date}>Creado: {item.createdAtStr}</Text>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.editButton} onPress={() => editarProducto(item)}>
              <Ionicons name="create" size={22} color="#FFF" />
              <Text style={styles.actionText}>Editar</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.deleteButton} onPress={() => eliminarProducto(item.id)}>
              <Ionicons name="trash" size={22} color="#FFF" />
              <Text style={styles.actionText}>Eliminar</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}
      <View style={{ height: 60 }} />
    </ScrollView>
  );
}

// Estilos limpios y estéticos ya integrados
const styles = StyleSheet.create({
  container:{ flex:1, backgroundColor:"#020617", padding:20, paddingTop:50 },
  title:{ fontSize:32, fontWeight:"900", color:"#FFF", textAlign:"center", letterSpacing:1 },
  subtitle:{ fontSize:16, color:"#94A3B8", textAlign:"center", marginTop:5, marginBottom:25 },
  dashboard:{ flexDirection:"row", justifyContent:"space-between", marginBottom:20 },
  statCard:{ backgroundColor:"#111827", width:"31%", padding:15, borderRadius:18, alignItems:"center" },
  statNumber:{ fontSize:22, fontWeight:"bold", color:"#FFF", marginTop:8 },
  statText:{ color:"#94A3B8", fontSize:12, marginTop:5 },
  label:{ color:"#CBD5E1", fontWeight:"bold", marginBottom:10 },
  categoryButton:{ backgroundColor:"#1E293B", paddingVertical:10, paddingHorizontal:18, borderRadius:20, marginRight:10 },
  categoryActive:{ backgroundColor:"#6366F1" },
  categoryText:{ color:"#FFF", fontWeight:"600" },
  sectionTitle:{ color:"#FFF", fontSize:22, fontWeight:"bold", marginBottom:15, marginTop:10 },
  input:{ backgroundColor:"#111827", color:"#FFF", padding:15, borderRadius:15, marginBottom:15 },
  descriptionInput:{ height:100, textAlignVertical:"top" },
  statusContainer:{ flexDirection:"row", marginBottom:15 },
  statusButton:{ backgroundColor:"#334155", padding:12, borderRadius:12, marginRight:10, paddingHorizontal:30 },
  activeStatus:{ backgroundColor:"#16A34A" },
  outStatus:{ backgroundColor:"#DC2626" },
  statusText:{ color:"#FFF", fontWeight:"bold" },
  imageButton:{ backgroundColor:"#2563EB", padding:16, borderRadius:15, flexDirection:"row", justifyContent:"center", alignItems:"center", marginBottom:15 },
  saveButton:{ backgroundColor:"#7C3AED", padding:18, borderRadius:15, flexDirection:"row", justifyContent:"center", alignItems:"center", marginBottom:20 },
  buttonText:{ color:"#FFF", fontWeight:"bold", marginLeft:10 },
  preview:{ height:220, width:"100%", borderRadius:20, marginBottom:20 },
  card:{ backgroundColor:"#111827", padding:15, borderRadius:22, marginBottom:20 },
  productImage:{ height:200, width:"100%", borderRadius:18, marginBottom:15 },
  infoContainer:{ paddingHorizontal:5 },
  productName:{ color:"#FFF", fontSize:22, fontWeight:"bold" },
  productCategory:{ color:"#A78BFA", marginTop:5, fontWeight:"600" },
  row:{ flexDirection:"row", justifyContent:"space-between", alignItems:"center", marginTop:12 },
  price:{ color:"#22C55E", fontSize:22, fontWeight:"bold" },
  status:{ paddingHorizontal:12, paddingVertical:6, borderRadius:15, color:"#FFF", fontWeight:"bold" },
  statusActive:{ backgroundColor:"#16A34A" },
  statusOut:{ backgroundColor:"#DC2626" },
  stock:{ color:"#FACC15", marginTop:12, fontWeight:"bold" },
  description:{ color:"#CBD5E1", marginTop:10, lineHeight:22 },
  date:{ color:"#64748B", marginTop:10, fontSize:12 },
  actions:{ flexDirection:"row", marginTop:15, gap:10 },
  editButton:{ backgroundColor:"#2563EB", flex:1, padding:12, borderRadius:12, flexDirection:"row", justifyContent:"center", alignItems:"center" },
  deleteButton:{ backgroundColor:"#DC2626", flex:1, padding:12, borderRadius:12, flexDirection:"row", justifyContent:"center", alignItems:"center" },
  actionText:{ color:"#FFF", fontWeight:"bold", marginLeft:8 }
});