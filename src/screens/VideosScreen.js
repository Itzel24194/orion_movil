import React, { useContext, useState } from 'react';
import { FlatList, ScrollView, Share, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '../i18n/ui';
import { VideoView, useVideoPlayer } from 'expo-video';
import { Feather, Ionicons } from '@expo/vector-icons';
import { ProductContext } from '../context/ProductContext';
import { usePreferences } from '../context/PreferencesContext';
import SmartImage from '../components/SmartImage';

function VideoPlayerCard({ url }) {
  const player = useVideoPlayer(url, player => { player.loop = true; player.play(); });
  return <VideoView style={styles.video} player={player} contentFit="contain" allowsFullscreen />;
}
const getImage = item => typeof item.image === 'string' ? { uri: item.image } : item.image;
export default function VideosScreen({ navigation }) {
  const { products = [] } = useContext(ProductContext);
  const { palette: p, t } = usePreferences();
  const [selected, setSelected] = useState(null);
  const media = products.filter(item => item.image || item.videoUrl);
  const videos = media.filter(item => /^https:\/\//i.test(item.videoUrl || ''));
  const selectedVideo = selected ? videos.find(x => x.id === selected) : videos[0];
  const share = async product => {
    try { await Share.share({ message: `${product.name} · ORION · $${product.price}` }); } catch { /* Diálogo cancelado */ }
  };
  return <SafeAreaView style={[styles.page, { backgroundColor: p.background }]}>
    <View style={styles.head}><TouchableOpacity onPress={() => navigation.goBack()} style={[styles.back, { backgroundColor: p.surface }]}><Feather name="arrow-left" color={p.text} size={22}/></TouchableOpacity><Text style={[styles.title, { color: p.text }]}>{t('multimedia')} ORION</Text><View style={{ width: 40 }}/></View>
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <Text style={[styles.section, { color: p.text }]}>Videos de productos</Text>
      {selectedVideo ? <View style={[styles.feature, { backgroundColor: p.surface }]}>
        <VideoPlayerCard key={selectedVideo.id} url={selectedVideo.videoUrl}/>
        <Text style={[styles.videoName, { color: p.text }]}>{selectedVideo.name}</Text>
        <TouchableOpacity onPress={() => navigation.navigate('ProductDetail', { product: selectedVideo })} style={[styles.cta, { backgroundColor: p.primary }]}><Text style={styles.ctaText}>Ver producto</Text><Feather name="arrow-up-right" color="white" size={17}/></TouchableOpacity>
      </View> : <View style={[styles.emptyVideo, { backgroundColor: p.surface, borderColor: p.border }]}><Ionicons name="videocam-outline" color={p.primary} size={35}/><Text style={[styles.emptyVideoText, { color: p.text }]}>{t('noVideos')}</Text><Text style={{ color: p.subtle, textAlign: 'center', fontSize: 12 }}>Agrega una URL HTTPS .mp4 en el campo videoUrl de cada producto.</Text></View>}
      {videos.length > 1 && <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }}>{videos.map(item => <TouchableOpacity key={item.id} onPress={() => setSelected(item.id)} style={[styles.clip, { backgroundColor: p.surface, borderColor: selectedVideo?.id === item.id ? p.primary : p.border }]}><SmartImage style={styles.clipImg} source={getImage(item)}/><Text numberOfLines={1} style={{ color: p.text, fontWeight: '700', maxWidth: 90, fontSize: 11 }}>{item.name}</Text></TouchableOpacity>)}</ScrollView>}
      <Text style={[styles.section, { color: p.text, marginTop: 30 }]}>Galería del catálogo</Text>
      <Text style={{ color: p.subtle, marginBottom: 16 }}>Imágenes de productos (no son videos).</Text>
      <View style={styles.gallery}>{media.map(item => <View key={item.id} style={[styles.card, { backgroundColor: p.surface, borderColor: p.border }]}>
        <TouchableOpacity onPress={() => navigation.navigate('ProductDetail', { product: item })}><SmartImage source={getImage(item)} style={styles.thumb} resizeMode="contain"/><Text style={[styles.name, { color: p.text }]} numberOfLines={2}>{item.name}</Text></TouchableOpacity>
        <View style={styles.actions}><Text style={{ color: p.subtle, fontSize: 10 }}>FOTO</Text><TouchableOpacity onPress={() => share(item)}><Ionicons name="share-social-outline" size={21} color={p.primary}/></TouchableOpacity></View>
      </View>)}</View>
    </ScrollView>
  </SafeAreaView>;
}
const styles = StyleSheet.create({ page: { flex: 1 }, head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 }, back: { padding: 10, borderRadius: 12 }, title: { fontWeight: '900', fontSize: 19 }, section: { fontSize: 20, fontWeight: '900', marginBottom: 12 }, feature: { borderRadius: 18, overflow: 'hidden', paddingBottom: 16 }, video: { width: '100%', height: 240, backgroundColor: 'black' }, videoName: { fontSize: 16, fontWeight: '800', padding: 14 }, cta: { marginHorizontal: 14, borderRadius: 12, padding: 13, flexDirection: 'row', justifyContent: 'center', gap: 8 }, ctaText: { color: 'white', fontWeight: '800' }, emptyVideo: { padding: 30, borderWidth: 1, borderRadius: 20, gap: 10, alignItems: 'center' }, emptyVideoText: { fontSize: 15, fontWeight: '800', textAlign: 'center' }, clip: { padding: 8, borderRadius: 14, borderWidth: 1, marginRight: 9 }, clipImg: { width: 90, height: 70, borderRadius: 8 }, gallery: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, card: { width: '48%', flexGrow: 1, flexBasis: '42%', borderRadius: 16, borderWidth: 1, overflow: 'hidden', paddingBottom: 10 }, thumb: { width: '100%', height: 150, backgroundColor: '#EEEFF4' }, name: { fontSize: 13, fontWeight: '800', padding: 10, minHeight: 52 }, actions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 10 } });
